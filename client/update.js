/*
 * update.js - "a newer version is available" banner.
 *
 * At most once a day the panel asks GitHub's public releases API for the
 * latest release (pre-releases and drafts are never "latest"). If its tag is
 * newer than the installed version, a small dismissible banner links to the
 * download. Nothing is downloaded or installed here; the user runs the new
 * installer. Any failure (offline, rate limit, no Node) is silent.
 *
 * The installed version is the manifest's ExtensionBundleVersion, stamped by
 * tools/build-release.sh. A dev install is 0.0.0 and never checks.
 */
'use strict';

(function () {
    var REPO = 'CruScanlan/adobe-bridge-focus-points';
    var API = 'https://api.github.com/repos/' + REPO + '/releases/latest';
    var DAY = 24 * 60 * 60 * 1000;

    /** "v1.2.3-rc1" -> [1, 2, 3]. */
    function parse(version) {
        return String(version || '').replace(/^v/, '').split('-')[0].split('.').map(function (n) {
            return parseInt(n, 10) || 0;
        });
    }
    function isNewer(candidate, installed) {
        var a = parse(candidate), b = parse(installed);
        for (var i = 0; i < Math.max(a.length, b.length); i++) {
            if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
        }
        return false;
    }

    function store(key, value) {
        try {
            if (value === undefined) return localStorage.getItem('update.' + key);
            localStorage.setItem('update.' + key, value);
        } catch (e) { /* ignore */ }
        return null;
    }

    function installedVersion() {
        var path = require('path'), fs = require('fs');
        var root = new CSInterface().getSystemPath(SystemPath.EXTENSION);
        var xml = fs.readFileSync(path.join(root, 'CSXS', 'manifest.xml'), 'utf8');
        var m = /ExtensionBundleVersion="([^"]+)"/.exec(xml);
        return m ? m[1] : null;
    }

    function show(latest, installed) {
        var banner = document.getElementById('update');
        if (!banner || !latest || !isNewer(latest, installed) || store('dismissed') === latest) return;
        var mac = (typeof process !== 'undefined' && process.platform === 'darwin');
        var url = mac
            ? 'https://github.com/' + REPO + '#macos'
            : 'https://github.com/' + REPO + '/releases/latest';
        document.getElementById('update-text').textContent = latest + ' is available';
        document.getElementById('update-link').onclick = function () {
            try { window.cep.util.openURLInDefaultBrowser(url); } catch (e) { /* ignore */ }
            return false;
        };
        document.getElementById('update-dismiss').onclick = function () {
            store('dismissed', latest);
            banner.hidden = true;
        };
        banner.hidden = false;
    }

    try {
        var installed = installedVersion();
        if (!installed || installed === '0.0.0') return;
        // The last answer is kept, so the banner shows on every open between checks.
        show(store('latest'), installed);
        if (Date.now() - Number(store('checked') || 0) < DAY) return;
        store('checked', String(Date.now()));
        fetch(API, { headers: { Accept: 'application/vnd.github+json' } })
            .then(function (res) { return res.ok ? res.json() : null; })
            .then(function (release) {
                if (!release || !release.tag_name) return;
                store('latest', release.tag_name);
                show(release.tag_name, installed);
            })
            .catch(function () { /* offline: try again tomorrow */ });
    } catch (e) { /* no Node, no manifest: no banner */ }
})();
