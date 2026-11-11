# Keep the ExtendScript host tiny; do everything in a Node-enabled panel

Bridge has no UXP, so CEP is the only extension path, and ExtendScript (ES3) is the only code that can talk to Bridge. We keep `host/index.jsx` to a single job (report the selected file path) and put everything else (exiftool, delegates, rendering) in the HTML panel with Node.js enabled (`--enable-nodejs --mixed-context`), which can spawn processes and run modern JS. New logic belongs in the panel, not the host.
