# 02: Decide the GPU flags and clipfix for the public build

**What to decide:** The manifest's `--disable-gpu`, `--disable-gpu-compositing` and `--disable-direct-composition` exist only because Cru's VFIO VM can't present CEF frames. Shipped as-is, every user gets slower software rendering, plus `clipfix.exe` — an unsigned helper that changes Bridge's window styles and may be flagged by antivirus. CEF flags are manifest-level, so they can't be switched at runtime.

**Options:**

- **A. One build for everyone, flags on.** Simplest. Costs performance and AV risk for all users.
- **B. Public build without the flags or clipfix; Cru keeps them locally.** `sign-install.sh` (dev) adds them; the release build doesn't. One extra code path, but the VM is the only known affected setup.
- **C. Two public builds (normal + "compatibility" for VMs / remote desktops).** Most flexible, doubles release artifacts and support questions.

Leaning B: the workaround targets an unusual display path, and a compatibility build can be added later if users report blank panels.

**Blocked by:** —

**Status:** resolved

- [x] Decision recorded here (and as an ADR in `docs/adr/` if B or C)
- [ ] If B: confirm the panel still renders correctly on a normal (non-VM) Windows machine without the flags and clipfix

## Answer

**None of A, B or C: no flags and no clipfix in any build, the VM included** (2026-11-11). Recorded as [ADR-0009](../../../docs/adr/0009-no-cef-gpu-flags.md).

The premise above was wrong. The flags were not compensating for the VM; they were causing the blank panel. They force CEF into software rendering, and Bridge repaints its tab-panel window straight over a software-rendered panel. With all three removed the panel is GPU-composited and was drawn on six consecutive normal launches on the VM (Bridge 16.0.8); with the helper stopped it stayed drawn through a tab switch and a minimise/restore. `clipfix.exe` only ever existed to protect the software-rendered panel, so it goes too.

The public build and Cru's build are therefore the same build, and it is the stock CEP configuration.

Still open:

- **The last checkbox is not done.** The panel has only been verified on the VM, not on an ordinary Windows machine.
- **Software-only machines.** Where CEF has no usable GPU and falls back to software by itself, the same overpaint should blank the panel. That is untested. The remedy is the unshipped helper kept in `tools/clipfix.cs`; shipping it would be a new ticket, raised only if a user reports a blank panel.
- **July 2026.** Default GPU compositing was reported blank on the VM on Bridge 16.0.6, which is what started the flags. The cause was never found and it has not recurred.

