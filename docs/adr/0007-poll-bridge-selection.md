# Drive live updates by polling the selection, not by events

Bridge's ExtendScript selection-changed event proved unreliable, so the panel polls the selected file path (~600 ms) and only re-runs exiftool and re-renders when the path changes. The host still dispatches a `CSXSEvent` on selection change, but that is a bonus path; polling is what must keep working. Do not replace polling with event-only updates.
