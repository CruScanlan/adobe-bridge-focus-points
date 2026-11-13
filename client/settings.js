/*
 * settings.js - overlay appearance settings (the gear button's popover).
 *
 * Colour, opacity and thickness are CSS custom properties on the overlay
 * (`--af-color`, `--af-opacity`, `--af-width`) that styles.css reads, so a
 * change needs no re-render. Colour applies to the Focus layer only; faces
 * and crop keep their own colours. Values persist in localStorage.
 *
 * Plain DOM, no Node: it works even when the rest of the panel cannot start.
 */
'use strict';

(function () {
    var DEFAULTS = { color: '#39ff14', opacity: 100, thickness: 3 };
    var SWATCHES = ['#39ff14', '#ffffff', '#ff3b30', '#ff9500', '#00e5ff', '#ff4fd8', '#b388ff'];

    var overlay = document.getElementById('overlay');
    var btn = document.getElementById('settings-btn');
    var pop = document.getElementById('settings');
    var swatches = document.getElementById('set-swatches');
    var hex = document.getElementById('set-hex');
    var opacity = document.getElementById('set-opacity');
    var thickness = document.getElementById('set-thickness');
    var reset = document.getElementById('set-reset');
    if (!overlay || !btn || !pop) return;

    function load(key) {
        var v = null;
        try { v = localStorage.getItem('overlay.' + key); } catch (e) { /* ignore */ }
        return v;
    }
    function save(key, value) {
        try { localStorage.setItem('overlay.' + key, String(value)); } catch (e) { /* ignore */ }
    }

    function validColor(v) { return /^#[0-9a-f]{6}$/i.test(v || '') ? v.toLowerCase() : null; }
    function clamp(v, lo, hi, fallback) {
        var n = parseFloat(v);
        return isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback;
    }

    var state = {
        color: validColor(load('color')) || DEFAULTS.color,
        opacity: clamp(load('opacity'), 10, 100, DEFAULTS.opacity),
        thickness: clamp(load('thickness'), 1, 8, DEFAULTS.thickness),
    };

    function apply() {
        overlay.style.setProperty('--af-color', state.color);
        overlay.style.setProperty('--af-opacity', String(state.opacity / 100));
        overlay.style.setProperty('--af-width', state.thickness + 'px');

        hex.value = state.color;
        hex.classList.remove('invalid');
        opacity.value = state.opacity;
        thickness.value = state.thickness;
        document.getElementById('set-opacity-val').textContent = state.opacity + '%';
        document.getElementById('set-thickness-val').textContent = state.thickness + ' px';
        Array.prototype.forEach.call(swatches.children, function (el) {
            el.classList.toggle('current', el.dataset.color === state.color);
        });
    }

    function set(key, value) {
        state[key] = value;
        save(key, value);
        apply();
    }

    SWATCHES.forEach(function (c) {
        var el = document.createElement('button');
        el.type = 'button';
        el.className = 'swatch';
        el.dataset.color = c;
        el.title = c;
        el.style.background = c;
        el.addEventListener('click', function () { set('color', c); });
        swatches.appendChild(el);
    });

    hex.addEventListener('input', function () {
        var v = hex.value.trim();
        if (v && v.charAt(0) !== '#') v = '#' + v;
        var c = validColor(v);
        hex.classList.toggle('invalid', !c);
        if (c) { state.color = c; save('color', c); overlay.style.setProperty('--af-color', c); }
    });
    hex.addEventListener('blur', apply);
    opacity.addEventListener('input', function () { set('opacity', clamp(opacity.value, 10, 100, DEFAULTS.opacity)); });
    thickness.addEventListener('input', function () { set('thickness', clamp(thickness.value, 1, 8, DEFAULTS.thickness)); });
    reset.addEventListener('click', function () {
        set('color', DEFAULTS.color);
        set('opacity', DEFAULTS.opacity);
        set('thickness', DEFAULTS.thickness);
    });

    function close() { pop.hidden = true; btn.classList.remove('open'); }
    btn.addEventListener('click', function (ev) {
        ev.stopPropagation();
        pop.hidden = !pop.hidden;
        btn.classList.toggle('open', !pop.hidden);
    });
    pop.addEventListener('click', function (ev) { ev.stopPropagation(); });
    document.addEventListener('click', close);
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape') close(); });

    apply();
})();
