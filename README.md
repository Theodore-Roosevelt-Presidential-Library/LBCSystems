# LBCSystems — How the Library Works

Interactive 3D model of the Theodore Roosevelt Presidential Library's **energy, water and carbon systems**, built for the Library's pursuit of Living Building Challenge certification.

Live: **https://lbcsystems.labs.trlibrary.com** · Embed codes: **https://lbcsystems.labs.trlibrary.com/embed.html**

## What it shows
The site is modeled as a cut-away diorama block of the butte (Sentinel Butte Formation strata on every cut face). Stops open **cutaways** into the ground or the building:

- **Energy:** quadrant cut through the bore field showing all 216 boreholes (300 ft, U-loops, grout) at their drawn positions; the 8 circuits, valve vault and the ~750 ft pair of 6" mains to MEP E148; a dollhouse cut of the mechanical room (WWHP-1/2/3, CH-1 200-ton magnetic-bearing chiller, HPLP-1/2, CO₂ hot-water heat pump, electric boiler, AHU-1) laid out from M301; a building section with radiant floors, chilled beams and fresh air; exploded samples of the roof assembly (prairie, R-70, 3" topping, 7-layer CLT, glulam) and the radiant slab; solar canopies (792 panels, ~352 kW).
- **Water:** supply from Southwest Water Authority (7 gpm); pit cut through the east berm with the three wastewater process tanks (from C510), lift station, 15,000-gal drinking-water and 40,000-gal fire/recycled tanks; the membrane bioreactor skid in E148 (12,800 gpd); pit through the southern leach field showing the 100 × 2 × 4 ft drain-rock trenches (53 of 54 traced from C510); prairie roof and basins.
- **Carbon:** roof assembly sample, embodied carbon (~26%, ~52% with biogenic carbon), rammed earth, reclaimed materials, a soil pit with prairie roots and soil cores, planned grazing.

Links can open a layer or stop: `/#water`, `/#energy/2`. Embeds: see `embed.html` (options: `data-layer`, `data-stop`, `data-lock`, `data-panel`, `data-height`).

## How it's built
Static site for GitHub Pages (no build step). three.js r160 is vendored in `assets/vendor/three` (MIT) and loaded with an import map.

| File | Purpose |
|---|---|
| `index.html`, `assets/app.css` | Page, TRPL brand fonts (served from trlibrary.com) and palette |
| `assets/app.js` | Scene, layers, animated flows, hotspots, camera, URL/embed handling |
| `assets/content.js` | **All visitor copy and figures.** Edit text here. |
| `assets/models/building.glb` | Building massing (roof surface, fascia, walls), ~95 KB |
| `assets/data/site.json` | Site features (basins, solar canopies, parking, the Boardwalk, road) in model feet |
| `assets/data/systems.json` | Wells (19 rows, 216 bores), mains, vault, leach trenches, process tanks, lift station, E148 room + equipment |
| `assets/data/terrain.bin` | Int16 terrain heights (0.1 ft), 5 ft grid, resampled from the CampusMap GLB |
| `assets/data/roof.bin` | Int16 roof-height field (0.1 ft), 2 ft grid, used for building section faces |
| `assets/data/footprints.json`, `beams.json` | Floor footprints and timber beam grid |
| `embed.js`, `embed.html` | Embed loader and staff embed codes |
| `tools/` | Python scripts used to generate the model and site data (reference only) |

**Sources.** Building geometry is derived from `20299_TRPL_STL Model Export_250611.stl` (BIM 360 archive): roof height field and floor footprints sampled from the 3.7M-triangle model. The site layout is traced from sheet L101 (Annotated Site Plan, SITES precertification, Aug 2026) and registered to the model (rotation −40.25°, 1 px = 1 ft at 100 dpi). Figures come from the LBC Ready Audit package, SITES/LEED precertification documents, MEI PV summary, Atelier Ten WBLCA (Apr 2026), Sherwood water narratives and ASI 002. See `TRPL/BIM/BIM_Archive_Audit_2026-10-12.md`.

**System geometry (v2).** Vector-extracted from the conformed drawing set (`20299 TRPL_Conformed Drawings.pdf`) and registered to the model frame by matching building outlines (`tools/regsheet.py`):
- M001 Mechanical Site Plan – Geothermal (1" = 50'): 216 boreholes + 2 test bores, circuit layout, 6" HPLS/HPLR mains, vault (registration IoU 0.89). `tools/ex477.py`
- C510 Overall Wastewater Plan (1" = 100'): leach trenches, process tanks, lift station (IoU 0.85). `tools/c510.py`; trench size/capacity from C511 notes.
- M301 Enlarged Plans – E148 (1/4" = 1'): equipment positions; M802 schedules for CH-1, HPLP, DWH-1, B-1.
- Terrain: `Theodore-Roosevelt-Presidential-Library/CampusMap` GLB, registered by roof footprint (IoU 0.92, 1 unit ≈ 33 ft). `tools/regcm.py`, `tools/terrain.py`. The CampusMap plateau is flattened around the building.
- `tools/systems.py` assembles `systems.json` and the binaries.

**Approximate locations.** The 15,000-gal and 40,000-gal tanks are placed in the east berm next to the process tanks (no drawing located yet). The mechanical room is placed along the east facade of the east building from M001/M301 and its orientation is approximate. Supply-line, leach-feed and tunnel routes are schematic. Equipment, pipe and well sizes are drawn larger than built so they read at site scale. The page notes this.

## Before wider promotion, confirm
- Battery/microgrid shelter-in-place is **not** shown (narrative was a draft and the microgrid was partly value-engineered). Add only once confirmed.
- Drinking-water and fire/recycled tank positions (placed approximately in the east berm).
- Final borehole depth (M001 conformed note says 300'; a 300 vs 350 ft study was open in 2022).
- Grazing is described as planned ("the land plan calls for…") — update when grazing begins.
- Certification language: SITES and LEED Platinum *precertification*; Living Building Challenge *pursuing*.
