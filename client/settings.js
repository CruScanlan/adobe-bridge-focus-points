/*
 * settings.js - overlay appearance settings (the gear button's popover).
 *
 * Colour, opacity and thickness are CSS custom properties on the overlay
 * (`--af-color`, `--face-color`, `--crop-color`, `--af-opacity`, `--af-width`)
 * that styles.css reads, so a change needs no re-render. Each layer has its
 * own colour, picked with the Focus / Faces / Crop selector; opacity and
 * thickness apply to all three. Values persist in localStorage.
 *
 * Plain DOM, no Node: it works even when the rest of the panel cannot start.
 */
'use strict';

(function () {
    var DEFAULTS = { opacity: 100, thickness: 3 };
    // Per layer: default colour, CSS property, localStorage key.
    var LAYERS = {
        focus: { color: '#39ff14', prop: '--af-color', key: 'color' },
        faces: { color: '#39ff14', prop: '--face-color', key: 'color.faces' },
        crop: { color: '#4ab8ff', prop: '--crop-color', key: 'color.crop' },
    };
    var SWATCHES = ['#39ff14', '#ffd23f', '#4ab8ff', '#ffffff', '#ff3b30', '#ff9500', '#ff4fd8'];

    var overlay = document.getElementById('overlay');
    var btn = document.getElementById('settings-btn');
    var pop = document.getElementById('settings');
    var layerSel = document.getElementById('set-layer');
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

    var layer = 'focus'; // the layer whose colour is being edited
    var state = {
        colors: {},
        opacity: clamp(load('opacity'), 10, 100, DEFAULTS.opacity),
        thickness: clamp(load('thickness'), 1, 8, DEFAULTS.thickness),
    };

    Object.keys(LAYERS).forEach(function (name) {
        state.colors[name] = validColor(load(LAYERS[name].key)) || LAYERS[name].color;
    });

    function setColor(c) {
        state.colors[layer] = c;
        save(LAYERS[layer].key, c);
        overlay.style.setProperty(LAYERS[layer].prop, c);
    }

    function apply() {
        Object.keys(LAYERS).forEach(function (name) {
            overlay.style.setProperty(LAYERS[name].prop, state.colors[name]);
        });
        overlay.style.setProperty('--af-opacity', String(state.opacity / 100));
        overlay.style.setProperty('--af-width', state.thickness + 'px');

        hex.value = state.colors[layer];
        hex.classList.remove('invalid');
        opacity.value = state.opacity;
        thickness.value = state.thickness;
        document.getElementById('set-opacity-val').textContent = state.opacity + '%';
        document.getElementById('set-thickness-val').textContent = state.thickness + ' px';
        Array.prototype.forEach.call(swatches.children, function (el) {
            el.classList.toggle('current', el.dataset.color === state.colors[layer]);
        });
        Array.prototype.forEach.call(layerSel.children, function (el) {
            el.classList.toggle('current', el.dataset.layer === layer);
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
        el.addEventListener('click', function () { setColor(c); apply(); });
        swatches.appendChild(el);
    });

    Array.prototype.forEach.call(layerSel.children, function (el) {
        el.addEventListener('click', function () { layer = el.dataset.layer; apply(); });
    });

    hex.addEventListener('input', function () {
        var v = hex.value.trim();
        if (v && v.charAt(0) !== '#') v = '#' + v;
        var c = validColor(v);
        hex.classList.toggle('invalid', !c);
        if (c) setColor(c);
    });
    hex.addEventListener('blur', apply);
    opacity.addEventListener('input', function () { set('opacity', clamp(opacity.value, 10, 100, DEFAULTS.opacity)); });
    thickness.addEventListener('input', function () { set('thickness', clamp(thickness.value, 1, 8, DEFAULTS.thickness)); });
    reset.addEventListener('click', function () {
        Object.keys(LAYERS).forEach(function (name) {
            state.colors[name] = LAYERS[name].color;
            save(LAYERS[name].key, LAYERS[name].color);
        });
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
