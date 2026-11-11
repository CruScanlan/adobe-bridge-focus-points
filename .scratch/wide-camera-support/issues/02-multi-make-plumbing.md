# 02: Multi-make plumbing

**What to build:** Make adding a manufacturer a one-file job. Today Fuji assumptions are baked into the panel and the exiftool wrapper. After this ticket, Fuji and DJI behave exactly as before, but:

- **Delegate registry.** Each delegate declares how it matches a file (`matches(tags)`) and which exiftool tags it needs. The panel picks the delegate from the registry and exiftool requests the union of all declared tags (wildcards allowed, for numbered tags). Adding a make means adding a delegate file and one registry entry — nothing else.
- **Reference frame.** A delegate returns its points together with the pixel frame they are expressed in (`{ frame: {width, height}, points }`). The overlay's coordinate space is set to that frame, so points line up whatever size the displayed preview is. Sony, Nikon and the other makes to come report coordinates in full-sensor pixels, not preview pixels, so this is required for all of them.
- **Best preview.** The panel displays the largest embedded image available (full-size embedded JPEG, then preview, then others) instead of only `PreviewImage`, so NEF, ARW, CR3 and ORF files render sharp.

Orientation handling stays where it is (rotating the container), per ADR 0004.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Fuji sample tests from ticket 01 still pass unchanged in expected output (frame added, same geometry)
- [ ] Fuji and DJI fixtures look identical in Bridge before and after (Cru confirms after sign-install)
- [ ] An unsupported NEF or ARW shows a sharp full-frame preview with the "not supported yet" status
- [ ] No manufacturer name appears in the panel's dispatch or tag-request code
- [ ] CLAUDE.md describes the delegate contract (matches, tags, frame + points)
