# LBCSystems — How the Library Works

Interactive 3D model of the Theodore Roosevelt Presidential Library's **energy, water and carbon systems**, built for the Library's pursuit of Living Building Challenge certification.

Live: **https://lbcsystems.labs.trlibrary.com** · Embed codes: **https://lbcsystems.labs.trlibrary.com/embed.html**

## What it shows
- **Energy:** 216 geothermal wells (~300 ft) under the shared parking lot, heat pumps, radiant floors and chilled beams, solar canopies (~352 kW), grid connection, and the 105% renewable goal.
- **Water:** Southwest Water Authority supply (7 gpm), 15,000-gal and 40,000-gal tanks, on-site membrane bioreactor, reuse for flushing, leach fields, prairie roof, eight mesic prairie basins.
- **Carbon:** mass timber (glulam/CLT) beam grid, embodied-carbon reduction (~26%, ~52% with biogenic carbon), rammed earth, reclaimed materials, 400,000 native plants, soil-carbon baseline, planned grazing and fire.

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
| `assets/data/footprints.json`, `beams.json` | Floor footprints and timber beam grid |
| `embed.js`, `embed.html` | Embed loader and staff embed codes |
| `tools/` | Python scripts used to generate the model and site data (reference only) |

**Sources.** Building geometry is derived from `20299_TRPL_STL Model Export_250611.stl` (BIM 360 archive): roof height field and floor footprints sampled from the 3.7M-triangle model. The site layout is traced from sheet L101 (Annotated Site Plan, SITES precertification, Aug 2026) and registered to the model (rotation −40.25°, 1 px = 1 ft at 100 dpi). Figures come from the LBC Ready Audit package, SITES/LEED precertification documents, MEI PV summary, Atelier Ten WBLCA (Apr 2026), Sherwood water narratives and ASI 002. See `TRPL/BIM/BIM_Archive_Audit_2026-10-12.md`.

**Approximate locations.** Well field, tanks, treatment, leach field and interior spaces are placed schematically from narrative descriptions, not surveyed drawings. The page says so.

## Before wider promotion, confirm
- Battery/microgrid shelter-in-place is **not** shown (narrative was a draft and the microgrid was partly value-engineered). Add only once confirmed.
- Leach field location (shown south-east of the building) and tank positions in the east berm.
- Grazing is described as planned ("the land plan calls for…") — update when grazing begins.
- Certification language: SITES and LEED Platinum *precertification*; Living Building Challenge *pursuing*.
