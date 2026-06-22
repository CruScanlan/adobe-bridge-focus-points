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
        preview: document.getElementById('preview'),
        overlay: document.getElementById('overlay'),
        placeholder: document.getElementById('placeholder'),
        status: document.getElementById('status'),
        coords: document.getElementById('coords'),
    };

    function setStatus(msg, kind) {
        if (!els.status) return;
        els.status.textContent = msg;
        els.status.className = kind || '';
    }

    // --- environment probe -----------------------------------------------------
    var hasRequire = (typeof require === 'function');
    var hasCSI = (typeof CSInterface === 'function');
    if (els.coords) {
        els.coords.textContent = 'node:' + (hasRequire ? 'yes' : 'no') +
            ' · CSInterface:' + (hasCSI ? 'yes' : 'no');
    }

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

    function drawPoints(result, imgW, imgH) {
        clearOverlay();
        els.overlay.setAttribute('viewBox', '0 0 ' + imgW + ' ' + imgH);
        els.overlay.style.width = els.preview.clientWidth + 'px';
        els.overlay.style.height = els.preview.clientHeight + 'px';
        if (!result || !result.points || !result.points.length) return;

        result.points.forEach(function (pt) {
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
                return;
            }
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
                var imgW = els.preview.naturalWidth, imgH = els.preview.naturalHeight;
                var result = delegate.getAfPoints(tags, { width: imgW, height: imgH });
                drawPoints(result, imgW, imgH);
                if (!result || !result.points.length) {
                    setStatus(name + ' — no focus point recorded', 'warn');
                } else {
                    var fp = result.focusPixel;
                    setStatus(name + ' — ' + (tags.Model || ''), 'ok');
                    els.coords.textContent = 'FocusPixel ' + Math.round(fp.x) + ',' + Math.round(fp.y);
                }
            };
            els.preview.onerror = function () { setStatus('Failed to display preview', 'error'); };
            els.preview.src = data.previewUrl;
        }, function (err) {
            if (currentPath !== filePath) return;
            setStatus('exiftool failed: ' + (err && err.message ? err.message : err), 'error');
        });
    }

    window.addEventListener('resize', function () {
        if (els.overlay.getAttribute('viewBox')) {
            els.overlay.style.width = els.preview.clientWidth + 'px';
            els.overlay.style.height = els.preview.clientHeight + 'px';
        }
    });

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
