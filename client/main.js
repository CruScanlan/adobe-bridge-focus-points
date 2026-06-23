/*
 * main.js - the Node/JS panel layer.
 *
 * Flow: ExtendScript reports selected path -> spawn exiftool -> Fuji delegate
 * computes AF box(es) -> SVG overlay draws them.
 *
 * Defensive bootstrap: nothing here is allowed to throw to the top level. If
 * the Node runtime or CSInterface isn't present (or a module fails to load),
 * the panel still renders and the status bar reports exactly what's available,
 * so a missing runtime never looks like a crash.
 */
'use strict';

(function () {
    var SVGNS = 'http://www.w3.org/2000/svg';
    var els = {
        stage: document.getElementById('stage'),
        preview: document.getElementById('preview'),
        overlay: document.getElementById('overlay'),
        placeholder: document.getElementById('placeholder'),
        status: document.getElementById('status'),
        shootinfo: document.getElementById('shootinfo'),
    };

    // Current render state, retained so a window resize can re-fit without
    // re-running exiftool. Native* are the decoded preview's own pixel dims
    // (image-orientation:none, so always the un-rotated/native frame).
    var nativeW = 0, nativeH = 0, curResult = null, curOri = { rotate: 0, mirror: false };

    function setStatus(msg, kind) {
        if (!els.status) return;
        els.status.textContent = msg;
        els.status.className = kind || '';
    }

    // --- layer toggles --------------------------------------------------------
    // Each overlay box belongs to a layer (focus/faces/crop). The checkboxes
    // gate which layers draw; state persists across selections + restarts via
    // localStorage, and toggling just re-renders the cached result (no exiftool).
    var LAYERS = { focus: 'tg-focus', faces: 'tg-faces', crop: 'tg-crop' };

    function layerOn(name) {
        var el = document.getElementById(LAYERS[name]);
        return el ? el.checked : true;
    }

    Object.keys(LAYERS).forEach(function (name) {
        var el = document.getElementById(LAYERS[name]);
        if (!el) return;
        var saved = null;
        try { saved = localStorage.getItem('layer.' + name); } catch (e) { /* ignore */ }
        if (saved !== null) el.checked = (saved === '1');
        el.addEventListener('change', function () {
            try { localStorage.setItem('layer.' + name, el.checked ? '1' : '0'); } catch (e) { /* ignore */ }
            renderRects(curResult);
        });
    });

    // Which layer a point belongs to, from its pointType.
    function layerOf(pointType) {
        if (pointType.indexOf('face') !== -1) return 'faces';
        if (pointType.indexOf('crop') !== -1) return 'crop';
        return 'focus';
    }

    // Disable (grey out) any toggle whose layer has no data in the current image,
    // so an inert checkbox never looks like it should do something. The saved
    // checked-state is left untouched, so it returns when the data does.
    function updateToggleAvail(result) {
        var present = { focus: false, faces: false, crop: false };
        if (result && result.points) {
            result.points.forEach(function (pt) { present[layerOf(pt.pointType)] = true; });
        }
        Object.keys(LAYERS).forEach(function (name) {
            var el = document.getElementById(LAYERS[name]);
            if (!el) return;
            el.disabled = !present[name];
            if (el.parentNode) el.parentNode.classList.toggle('unavailable', !present[name]);
        });
    }

    // --- shooting-info readout ------------------------------------------------
    // A compact "what/how it was shot" line for the bottom bar, e.g.
    //   X-H2 · 56mm · ƒ/1.2 · 1/250s · ISO 400 · AF-C · Eye
    function subjectLabel(tags) {
        var types = String(tags.FaceElementTypes || '');
        if (/eye/i.test(types)) return 'Eye';
        if (/face/i.test(types)) return 'Face';
        if (tags.FacesDetected && String(tags.FacesDetected) !== '0') return 'Face';
        return '';
    }

    function formatShootingInfo(tags) {
        var parts = [];
        if (tags.Model) parts.push(tags.Model);
        if (tags.FocalLength) {
            parts.push(String(tags.FocalLength).replace(/\s*mm$/i, '').replace(/\.0$/, '') + 'mm');
        }
        if (tags.FNumber != null && tags.FNumber !== '') parts.push('ƒ/' + tags.FNumber);
        if (tags.ExposureTime != null && tags.ExposureTime !== '') parts.push(tags.ExposureTime + 's');
        if (tags.ISO != null && tags.ISO !== '') parts.push('ISO ' + tags.ISO);
        var mode = tags.FocusMode2 || tags.AFMode || tags.FocusMode;
        if (mode) parts.push(mode);
        // AF area + size ordinal — handy for eyeballing the camera-sized box.
        if (/single/i.test(String(tags.AFAreaMode || '')) && tags.AFAreaPointSize != null) {
            parts.push('SP ' + tags.AFAreaPointSize);
        } else if (tags.AFAreaMode) {
            parts.push(tags.AFAreaMode);
        }
        var subj = subjectLabel(tags);
        if (subj) parts.push(subj);
        return parts.join('  ·  ');
    }

    function setShootingInfo(text) {
        if (els.shootinfo) els.shootinfo.textContent = text || '';
    }

    // --- environment probe -----------------------------------------------------
    // Node enablement is reported via the status line only when it's missing
    // (the actionable case); we keep the bottom-right corner free for controls.
    var hasRequire = (typeof require === 'function');
    var hasCSI = (typeof CSInterface === 'function');

    if (!hasRequire) {
        // Node not enabled. Shell still loaded fine -> this proves the panel
        // itself works and isolates Node enablement as the remaining problem.
        setStatus('Panel shell loaded OK, but Node is not enabled — exiftool needs it.', 'warn');
        els.placeholder.textContent = 'Shell OK · Node disabled';
        return;
    }

    // --- real pipeline (Node available) ---------------------------------------
    var path, exiftool, fuji, csInterface, EXT_ROOT;
    try {
        path = require('path');
        csInterface = new CSInterface();
        EXT_ROOT = csInterface.getSystemPath(SystemPath.EXTENSION);
        exiftool = require(path.join(EXT_ROOT, 'client', 'lib', 'exiftool.js'));
        fuji = require(path.join(EXT_ROOT, 'client', 'delegates', 'fujifilm.js'));
    } catch (err) {
        setStatus('Init failed: ' + (err && err.message ? err.message : err), 'error');
        return;
    }

    var currentPath = null;

    function delegateFor(tags) {
        var make = (tags.Make || '').toUpperCase();
        return make.indexOf('FUJI') !== -1 ? fuji : null;
    }

    function clearOverlay() {
        while (els.overlay.firstChild) els.overlay.removeChild(els.overlay.firstChild);
    }

    // Map the exiftool Orientation string to a rotation we apply ourselves.
    // CSS rotate() is clockwise-positive, matching EXIF "Rotate N CW". The four
    // mirrored variants add a horizontal flip; "Mirror vertical" (value 4) is
    // flip + 180. None of the current fixtures are mirrored, so those paths are
    // structurally correct but not yet visually verified.
    function orientationOf(tags) {
        var o = String(tags.Orientation || '').toLowerCase();
        var rotate = 0;
        if (o.indexOf('270') !== -1) rotate = 270;
        else if (o.indexOf('180') !== -1) rotate = 180;
        else if (o.indexOf('90') !== -1) rotate = 90;
        var mirror = o.indexOf('mirror') !== -1;
        if (o.indexOf('mirror vertical') !== -1) rotate = 180; // value 4: flip + 180
        return { rotate: rotate, mirror: mirror };
    }

    function transformFor(ori) {
        var t = '';
        if (ori.rotate) t += 'rotate(' + ori.rotate + 'deg) ';
        if (ori.mirror) t += 'scaleX(-1)';
        return t.trim() || 'none';
    }

    // Size the preview + overlay to fit the stage and rotate them together.
    // The pre-rotation box is fit so that its POST-rotation on-screen footprint
    // fits the stage: for 90/270 the footprint's width/height are swapped, so we
    // fit against the swapped bounds. Points stay in native pixel space (the SVG
    // viewBox), so rotating the whole container keeps each box glued to its
    // image feature with no per-point math.
    function layout() {
        if (!nativeW || !nativeH) return;
        var swap = (curOri.rotate === 90 || curOri.rotate === 270);
        var SW = els.stage.clientWidth, SH = els.stage.clientHeight;
        var boundW = swap ? SH : SW;
        var boundH = swap ? SW : SH;
        var s = Math.min(boundW / nativeW, boundH / nativeH);
        var w = nativeW * s, h = nativeH * s;
        var transform = transformFor(curOri);
        [els.preview, els.overlay].forEach(function (el) {
            el.style.width = w + 'px';
            el.style.height = h + 'px';
            el.style.transform = transform;
        });
        els.overlay.setAttribute('viewBox', '0 0 ' + nativeW + ' ' + nativeH);
        updateToggleAvail(curResult);
        renderRects(curResult);
    }

    function renderRects(result) {
        clearOverlay();
        if (!result || !result.points || !result.points.length) return;

        result.points.forEach(function (pt) {
            if (!layerOn(layerOf(pt.pointType))) return; // layer hidden by toggle
            var kind = pt.pointType.indexOf('face') !== -1 ? 'face'
                : pt.pointType.indexOf('crop') !== -1 ? 'crop' : 'af';
            var rect = document.createElementNS(SVGNS, 'rect');
            rect.setAttribute('x', pt.x - pt.width / 2);
            rect.setAttribute('y', pt.y - pt.height / 2);
            rect.setAttribute('width', pt.width);
            rect.setAttribute('height', pt.height);
            rect.setAttribute('class', 'af-box ' + (kind === 'af' ? '' : kind));
            els.overlay.appendChild(rect);

            if (pt.primary) {
                var c = 14;
                [[pt.x - c, pt.y, pt.x + c, pt.y], [pt.x, pt.y - c, pt.x, pt.y + c]]
                    .forEach(function (l) {
                        var line = document.createElementNS(SVGNS, 'line');
                        line.setAttribute('x1', l[0]); line.setAttribute('y1', l[1]);
                        line.setAttribute('x2', l[2]); line.setAttribute('y2', l[3]);
                        line.setAttribute('class', 'af-cross');
                        els.overlay.appendChild(line);
                    });
            }
        });
    }

    function loadFile(filePath) {
        currentPath = filePath;
        if (!filePath) {
            els.placeholder.style.display = '';
            els.preview.removeAttribute('src');
            clearOverlay();
            nativeW = nativeH = 0; curResult = null; curOri = { rotate: 0, mirror: false };
            updateToggleAvail(null);
            setShootingInfo('');
            setStatus('Select a photo in Bridge', '');
            return;
        }
        var name = filePath.split(/[\\/]/).pop();
        setStatus('Reading ' + name + '…', '');

        exiftool.readFocusData(filePath).then(function (data) {
            // A newer selection superseded this one while exiftool was working.
            if (currentPath !== filePath) return;

            var tags = data.tags || {};
            var delegate = delegateFor(tags);
            if (!delegate) {
                setStatus((tags.Make || 'This camera') + ' is not supported yet', 'warn');
                els.preview.removeAttribute('src');
                clearOverlay();
                updateToggleAvail(null);
                setShootingInfo('');
                return;
            }
            setShootingInfo(formatShootingInfo(tags));
            if (delegate.makerNotesFound && !delegate.makerNotesFound(tags, filePath)) {
                setStatus('No usable maker notes (DNG/converted?) — needs OOC RAF/JPEG', 'warn');
            }
            if (!data.previewUrl) {
                setStatus('No embedded preview to display', 'error');
                return;
            }

            els.preview.onload = function () {
                if (currentPath !== filePath) return; // superseded during decode
                els.placeholder.style.display = 'none';
                // image-orientation:none -> naturalW/H are the native (un-rotated)
                // pixel dims, the frame FocusPixel lives in. We rotate for display.
                nativeW = els.preview.naturalWidth;
                nativeH = els.preview.naturalHeight;
                curOri = orientationOf(tags);
                var result = delegate.getAfPoints(tags, { width: nativeW, height: nativeH });
                curResult = result;
                layout();
                if (!result || !result.points.length) {
                    setStatus(name + ' — no focus point recorded', 'warn');
                } else {
                    setStatus(name, 'ok');
                }
            };
            els.preview.onerror = function () { setStatus('Failed to display preview', 'error'); };
            els.preview.src = data.previewUrl;
        }, function (err) {
            if (currentPath !== filePath) return;
            setStatus('exiftool failed: ' + (err && err.message ? err.message : err), 'error');
        });
    }

    window.addEventListener('resize', layout);

    // Live selection tracking. Bridge's ExtendScript selection-changed event
    // is unreliable, so we poll getSelectedFile() and only do the expensive
    // work (exiftool + render) when the path actually changes.
    function clean(p) {
        if (!p || p === 'null' || p === 'undefined' || p === 'EvalScript error.') return '';
        return p;
    }
    function poll() {
        try {
            csInterface.evalScript('getSelectedFile()', function (p) {
                var path = clean(p);
                if (path !== currentPath) loadFile(path);
            });
        } catch (err) {
            setStatus('selection poll failed: ' + (err && err.message), 'error');
        }
    }
    // Keep the event path too — harmless if Bridge never fires it.
    try {
        csInterface.addEventListener('com.cru.bridgefocuspoints.selectionChanged', function (ev) {
            var p = clean(ev && ev.data);
            if (p !== currentPath) loadFile(p);
        });
    } catch (e) { /* ignore */ }

    poll();                       // initial selection
    setInterval(poll, 250);       // live updates
    setStatus('Ready — select a photo in Bridge', 'ok');

    // Shut the persistent exiftool process down when the panel goes away.
    window.addEventListener('beforeunload', function () {
        try { exiftool.stop(); } catch (e) { /* ignore */ }
    });
})();
