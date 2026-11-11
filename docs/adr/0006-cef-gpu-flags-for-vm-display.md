# Keep the CEF GPU / DirectComposition flags in the manifest

**Superseded by [ADR-0009](0009-no-cef-gpu-flags.md) on 2026-11-11.** The flags below were the cause of the blank panel, not the cure, and have been removed. The text is kept as the record of what was believed.

The development VM presents through an indirect display (headless GPU plus a virtual display driver), where Chromium's normal present paths fail silently: the panel runs and composites correctly, but nothing reaches the window. This happened after the Bridge 16.0.6 and 16.0.7 updates and looked exactly like the plugin had broken. The manifest's `CEFCommandLine` therefore carries `--disable-gpu`, `--disable-gpu-compositing` and `--disable-direct-composition`, cumulatively. Do not remove any of them, and confirm a blank panel is the present path (a correct CDP screenshot, a black pane on screen) before touching plugin code.
