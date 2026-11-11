# 02: Decide the GPU flags and clipfix for the public build

**What to decide:** The manifest's `--disable-gpu`, `--disable-gpu-compositing` and `--disable-direct-composition` exist only because Cru's VFIO VM can't present CEF frames. Shipped as-is, every user gets slower software rendering, plus `clipfix.exe` — an unsigned helper that changes Bridge's window styles and may be flagged by antivirus. CEF flags are manifest-level, so they can't be switched at runtime.

**Options:**

- **A. One build for everyone, flags on.** Simplest. Costs performance and AV risk for all users.
- **B. Public build without the flags or clipfix; Cru keeps them locally.** `sign-install.sh` (dev) adds them; the release build doesn't. One extra code path, but the VM is the only known affected setup.
- **C. Two public builds (normal + "compatibility" for VMs / remote desktops).** Most flexible, doubles release artifacts and support questions.

Leaning B: the workaround targets an unusual display path, and a compatibility build can be added later if users report blank panels.

**Blocked by:** —

**Status:** ready-for-human

- [ ] Decision recorded here (and as an ADR in `docs/adr/` if B or C)
- [ ] If B: confirm the panel still renders correctly on a normal (non-VM) Windows machine without the flags and clipfix
