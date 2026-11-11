# Wide camera support

## Why

The panel is used almost entirely by landscape photographers, mainly to see where each frame of a focus stack was focused. Today it only draws focus data for Fujifilm. This effort extends it to the bodies landscape photographers commonly shoot.

## Requirements

- **Must work:** the single primary focus point, in the right place, on every target body.
- **Wanted, best-effort:** detected faces, for every make. They need not be perfect on every model.
- **Coverage:** for each make, the current generation plus at least two generations back, and the common crop-sensor bodies.
- **Simple and easy to extend.** Adding a make is one delegate file; adding a body is one sample. It does not have to be bulletproof.
- **Everything else is on request.** We are not trying to support every camera.

## Approach

- Keep delegating: exiftool extracts, and geometry is ported from the Focus-Points Lr plugin one make at a time (ADR 0001).
- Testing is one idea: each sample is a small committed JSON file (exiftool tags from a real camera file plus the expected points), and one test run checks them all outside Bridge. Raw files are never committed.
- Samples come from raw.pixls.us (CC0), with rawsamples.ch as a fallback for older bodies. Neither source records where focus was, so each sample is checked by eye before its expected output is committed.
- The target-body lists are a judgment call from 2026 buying guides and competition anecdotes; no real usage data for landscape photographers is published.

## Tickets, in priority order

| # | Ticket | Blocked by |
|---|---|---|
| 01 | Sample tests that run outside Bridge | — |
| 02 | Multi-make plumbing | 01 |
| 03 | Sony focus point | 01, 02 |
| 04 | Nikon Z focus area | 01, 02 |
| 05 | Canon focus points | 01, 02 |
| 06 | Nikon DSLR AF points | 01, 02, 04 |
| 07 | Fuji samples across generations | 01 |
| 08 | OM System / Olympus focus point | 01, 02 |

## Target bodies

| Make | Full frame / main line | Crop sensor | Ticket |
|---|---|---|---|
| Sony | A7R V, A7R IV, A7R III, A7R II; A7 IV, A7 III, A7 II | a6700, a6600, a6400 | 03 |
| Nikon Z | Z8, Z7 II, Z7; Z6 III, Z6 II, Z6 | Z50 II, Z50, Zfc | 04 |
| Canon | R5 II, R5, EOS R, 5D IV, 5D III; R6 II, R6; 6D II | R7, R10, 90D, 80D, 70D, 77D, 7D II | 05 |
| Nikon DSLR | D850, D810, D800 / D800E | D500, D7500 | 06 |
| Fujifilm | GFX 100S II, GFX 100S, GFX 50S II or 50R | X-H2, X-T5, X-T4, X-T3 | 07 |
| OM System / Olympus | — | OM-1 II, OM-1, E-M1 III, E-M1 II; OM-5, E-M5 III | 08 |

## Out of scope until someone asks

- Panasonic, Pentax and any other make.
- Point maps for other Nikon DSLRs.
- Inactive-point grids, extra phase-detect points, selected-but-not-in-focus points.
- A bulk sample corpus, invariant test suites, an HTML contact sheet, a generated support matrix.

## Open question

- (2026-11-11: `FocusDistance` is now shown for Nikon and OM System / Olympus, where exiftool gives it as one tag. Not shown for the other makes. Still Cru's call whether to keep, extend or drop it.)
- Whether to show the recorded focus distance in the shooting-info line. In-camera focus bracketing may keep the AF point fixed while shifting focus distance, in which case every frame of a bracket would show the same box. Not yet verified per make, and not yet decided. Ticket 08 includes it only if it is cheap.
