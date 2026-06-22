/*
 * host/index.jsx - Bridge ExtendScript (ES3) host layer.
 *
 * CEP "split brain": ExtendScript is the ONLY thing that can talk to Bridge,
 * but it is feeble, so this stays tiny. Its sole job is to answer "what file
 * is selected?" and to ping the Node/JS panel when the selection changes.
 * All real work (exiftool, geometry, render) happens in the panel.
 */

/**
 * Return the absolute OS path of the first selected thumbnail, or "".
 * Called by the panel via CSInterface.evalScript on load and on demand.
 */
function getSelectedFile() {
    if (!app.document) return "";
    var sel = app.document.selections;
    if (!sel || sel.length === 0) return "";
    var thumb = sel[0];
    if (!thumb || !thumb.spec) return "";
    // fsName is the native filesystem path (what exiftool wants).
    return thumb.spec.fsName;
}

/**
 * Live updates: dispatch a CSXSEvent whenever the Bridge selection changes,
 * carrying the new path, so the panel does not have to poll. The panel still
 * calls getSelectedFile() once on load for the initial image.
 *
 * Mechanism (PlugPlugExternalObject + CSXSEvent) verified against Adobe's
 * BridgeSamples/ImageSelect.
 */
function _bfpSelectionsChanged(event) {
    if (event.object instanceof Document && event.type == "selectionsChanged") {
        try {
            // Loading the lib makes CSXSEvent available.
            new ExternalObject("lib:PlugPlugExternalObject");
            var e = new CSXSEvent();
            e.type = "com.cru.bridgefocuspoints.selectionChanged";
            e.data = getSelectedFile();
            e.dispatch();
        } catch (err) {}
    }
}

app.eventHandlers.push({ handler: _bfpSelectionsChanged });
