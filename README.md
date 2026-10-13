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
| `assets/models/campus.glb` | Building, prairie roof, paths, Boardwalk, overlooks and people from the CampusMap model, transformed into model feet (meshopt, ~3.4 MB) |
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
- Building and landscape: `Theodore-Roosevelt-Presidential-Library/CampusMap` GLB, registered by roof footprint (IoU 0.92, 1 unit ≈ 33 ft). `tools/regcm.py`, `tools/export.mjs` (everything except the land mesh → `campus.glb`). Paths, the Boardwalk and people are draped onto the real terrain at load.
- Terrain: USGS 3DEP elevation (ImageServer exportImage, ~1 m) fetched in ND South ft (EPSG:6547) and resampled to the model frame at 6 ft (`tools/build_dem.py` → `terrain.bin`, 3,800 × 2,950 ft). Georeference from the two GPS'd thermal test bores on M001 (`tools/georef_pts.json`; rotation −40.76°; 2-point scale check 0.98). Vertical datum FFE 2516.0 ft (C514) = 0. The lidar predates construction, so ground inside the building footprint is clamped below the floor; finished grading (berms, lots) is not modeled.
- Rock layers follow the Medora-area sequence in TRPL's geology explorer (geology.labs.trlibrary.com, `#layers`): gray-brown Sentinel Butte Formation, the red HT Butte clinker band, yellow-brown Bullion Creek Formation below. The contact depths at the Library (clinker drawn about 52–84 ft below the main floor) are illustrative.
- Moving dots are tied to stops and explained in an on-screen legend (`LEGEND` in `content.js`). Pipes are drawn as see-through tubes with the liquid or power pulsing inside; stops with `trench: [...]` open the ground along a named route (`routes` in `app.js`). Sunlight is drawn as rays.
- Water additions: the treatment train as a labeled diagram over the process tanks (C510 process flow, C516 equipment list); roof drain outlets to the basins (C310.L note: green-roof stormwater piped to daylight within 5 ft of the building; outlet positions schematic); the Contech underground detention system under the east lot (C310.B, registered through C510; ~225 × 30 ft).
- `tools/systems.py` assembles `systems.json` and the binaries.

**Approximate locations.** The 15,000-gal and 40,000-gal tanks are placed in the east berm next to the process tanks (no drawing located yet). The mechanical room is placed along the east facade of the east building from M001/M301 and its orientation is approximate. Supply-line, leach-feed and tunnel routes are schematic. Equipment, pipe and well sizes are drawn larger than built so they read at site scale. The page notes this.

## Before wider promotion, confirm
- Battery/microgrid shelter-in-place is **not** shown (narrative was a draft and the microgrid was partly value-engineered). Add only once confirmed.
- Drinking-water and fire/recycled tank positions (placed approximately in the east berm).
- That no rainwater is reused indoors (narrative documents say so; the detention system is storm storage, not a cistern).
- Final borehole depth (M001 conformed note says 300'; a 300 vs 350 ft study was open in 2022).
- Formation under the site: the 2022 geotechnical report says weathered Sentinel Butte; the 2026 LBC Site Conditions document says Bullion Creek. The model shows a thin Sentinel Butte cap over clinker and Bullion Creek; confirm with a geologist before naming a formation in copy.
- Grazing is described as planned ("the land plan calls for…") — update when grazing begins.
- Certification language: SITES and LEED Platinum *precertification*; Living Building Challenge *pursuing*.

## Carbon and water rework (Oct 2026)
- **Photos** in the side panel come from the TRPL Acquia DAM (USGBC/Snappr LEED Platinum set, "Open Use"; no credit required), saved at 480 and 1400 px in `assets/photos/`.
- **Carbon** stops are built around published facts: Mercer Mass Timber (~1,800 m³ CLT + glulam, FSC; ENR, Panel World), triangulated glulam over the breezeway (WoodWorks), roof build-up ~8 ft with 15 in of soil (Metropolis, Buildings.com), low-carbon concrete with 50–70% cement replacement and ~50% lower GWP (ForConstructionPros), rammed earth 24 in thick, ~240 ft long, built by Winn Construction in compacted lifts (Grand Forks Herald, Buildings.com), heart pine from Lavonia GA (Pioneer Millworks), Sagamore Hill copper beech (JLG, BD+C), Hebron brick, timber-mat benches, seed collection from 2022 incl. Maltese Cross and Elkhorn Ranch, grown at NDSU Hettinger (Snøhetta). Embodied-carbon percentages (26% / 52%) are from the Atelier Ten WBLCA in the LBC package.
- Samples (carbon ledger, concrete cylinders, rammed-earth slice, reused materials) sit on the prairie south of the building and appear only on their stop. The breezeway diagrid, paddocks and the concrete binder split are illustrative.
- **Water** now opens with a "Follow the water" overview (all pipes, see-through ground, labeled in/out points) and drops the duplicate mechanical-room and sprinkler stops.

### Verify before promotion
- Whether the copper beech was planted by Theodore Roosevelt (some sources say so; the page says only that it grew at Sagamore Hill).
- That the benches in photo 019 are the reused timber mats; that the live-edge counter in photo 094 is the copper beech (caption avoids saying so).
- Rammed-earth soil source (Metropolis: within 50 miles; Dezeen: on site) and height (27 vs 30 ft) — page avoids both.
