// Copy and camera/cutaway settings for each stop.
// Figures come from the Library's conformed construction drawings (M001, M301, M802, C510, C511,
// C516, PV sheets), design narratives and Living Building Challenge documents (BIM 360 archive,
// audited Oct 2026). Positions are model feet: x/y on the site plane, z up (0 = main floor).
//
// cut:  a pit opened in the ground   { c:[x,y], ang, l, w }  (center, angle of the long side, length, width)
// bcut: a slice taken out of the building  { c:[x,y], ang, l, w, z }  (removed above height z)
// view: camera  { dist, tilt (0 flat .. 1.4 overhead), az (deg, direction from target toward camera; default 230) }
// show: callout ids to reveal for this stop

export const LAYERS = {
  overview: {
    label: 'Overview',
    title: 'How the Library Works',
    intro: 'Power from the sun and from the rock below. Water that’s cleaned and used again. A roof of native prairie. Pick a system to cut into the ground and the building and see the parts that make it work.',
    stats: [],
    stops: []
  },

  energy: {
    label: 'Energy',
    color: '#FC924E',
    title: 'Energy',
    intro: 'In everyday operation the Library runs on electricity alone, with no natural gas or propane on site. Its heating and cooling come from deep in the butte, and solar panels shade the parking lots.',
    stats: [
      ['216', 'geothermal wells'],
      ['300 ft', 'deep'],
      ['792', 'solar panels']
    ],
    stops: [
      { id: 'solar', title: 'Solar canopies',
        text: 'Timber canopies over the parking lots carry 792 solar panels, with more on the roof of the maintenance and land stewardship building. Together they are rated at about 352 kilowatts and are expected to make roughly 419,000 kilowatt-hours a year, while shading the cars below.',
        at: 'pv', trench: ['solarFeed'], view: { dist: 600, tilt: 0.7, az: 215 }, show: ['pv'],
        photo: ['117', 'Timber solar canopies over the parking lot'] },
      { id: 'wells', title: '216 wells, 300 feet down',
        text: 'Under the parking lot, 216 boreholes drop 300 feet through the banded sandstone, siltstone, clay and lignite of the badlands, set at least 20 feet apart. Each holds a loop of plastic pipe sealed in grout. A mix of water and antifreeze runs down one side and back up the other, trading heat with rock that holds a steady temperature all year.',
        at: 'field', cut: { c0: [985, -255], ang: -90, l: 900, w: 600 },
        view: { dist: 1500, tilt: 0.5, az: 312 }, show: ['depth', 'sb', 'clk', 'bc', 'loop'] },
      { id: 'circuits', title: 'Eight circuits, one vault',
        text: 'The wells are linked in eight circuits. Their pipes run in trenches beneath the pavement to a buried valve vault at the north end of the field, where they join two 6-inch mains: one carrying fluid out to the wells, one bringing it back.',
        at: 'vault', xray: true, view: { dist: 620, tilt: 1.05, az: 215 }, show: ['vault'] },
      { id: 'header', title: 'Down the hill to the plant',
        text: 'From the vault, the pair of mains runs about 750 feet beneath the drive and the drop-off loop to the mechanical room in the east building. Two pumps, each able to move 600 gallons a minute, keep the loop flowing.',
        at: 'headerMid', trench: ['header'], view: { dist: 230, tilt: 0.85, az: 215 }, show: ['mains'] },
      { id: 'plant', title: 'Inside the mechanical room',
        text: 'Three water-to-water heat pumps pull warmth out of the loop in winter. In summer a 200-ton chiller with a frictionless magnetic-bearing compressor cools the building and sends its heat back down the wells. Even the hot water for sinks comes from a heat pump, one that uses carbon dioxide as its refrigerant. The boiler is electric, too.',
        at: 'mech', bcut: { c: 'mech', ang: -101.3, l: 110, w: 70, z: 13 },
        view: { dist: 230, tilt: 1.0, az: 140 }, show: ['WWHP-2', 'CH-1', 'HPLP-1', 'DWH-1', 'B-1', 'AHU-1'] },
      { id: 'radiant', title: 'Warm floors, cool beams',
        text: 'Instead of blasting hot or cold air, the Library moves water. Tubing buried in the concrete floors warms or cools the slab, and 125 chilled beams overhead cool the rooms quietly. Five air handlers bring in fresh outdoor air, and a utility tunnel carries the pipes across to the west building.',
        at: 'specSlab', bcut: { c: [150, 30], ang: 0, l: 330, w: 150, z: 0.5 }, specimen: 'slab',
        view: { dist: 120, tilt: 0.36, az: 245 }, show: ['slab', 'beam', 'air'] },
      { id: 'envelope', title: 'Built to hold heat',
        text: 'The roof is insulated to R-70 and the windows are triple-paned, which matters on a butte where temperatures have ranged from −40°F to 116°F. Concrete floors and two-foot-thick rammed-earth walls soak up warmth and give it back slowly.',
        at: 'specRoof', bcut: { c: [150, 30], ang: 0, l: 330, w: 150, z: 0.5 }, specimen: 'roof',
        view: { dist: 95, tilt: 0.28, az: 245 }, show: ['roofLayers', 'clt', 'insul', 'glulam'] },
      { id: 'goal', title: 'The grid and the goal',
        text: 'Roughrider Electric Cooperative connects the Library to the regional grid. On-site solar is expected to cover about a fifth of what the building uses. The Library is pursuing Living Building Challenge certification, which asks for 105% of a building’s energy to come from renewable sources over a full year, so closing the gap will take off-site renewable power.',
        at: 'grid', view: { dist: 1500, tilt: 0.85, az: 215 } }
    ]
  },

  water: {
    label: 'Water',
    color: '#2FB5DA',
    title: 'Water',
    intro: 'In the Badlands, water is precious. The Library draws a small, steady stream from a regional pipeline, cleans all of its wastewater on site and puts it to work again, and lets rain soak back into the prairie.',
    stats: [
      ['7 gal/min', 'supply line'],
      ['100%', 'of wastewater treated on site'],
      ['8', 'prairie basins']
    ],
    stops: [
      { id: 'loop', title: 'Follow the water',
        text: 'Here is the whole system at once, with the ground made see-through. Drinking water arrives by pipeline and waits in a tank in the berm. Every drop that goes down a drain is cleaned on site, then either flushes a toilet again or soaks back into the ground. Rain soaks into the prairie roof and the basins. Each color in the key is one kind of water. Water that soaks in here drains toward the Little Missouri River, which flows into Lake Sakakawea, the same lake the Library’s water comes from.',
        at: [540, -90, 0], xray: true, roof: false, view: { dist: 780, tilt: 1.12, az: 230 }, show: ['potable', 'np', 'lSupply', 'lRecycled', 'lLeach', 'lWaste'] },
      { id: 'pipeline', title: 'A pipeline from Lake Sakakawea',
        text: 'Drinking water comes through the Southwest Water Authority pipeline. It is drawn from Lake Sakakawea, treated in Dickinson and piped about 86 miles. The Library’s connection is limited to 7 gallons a minute, so water is stored on site rather than drawn in big bursts.',
        at: 'road', trench: ['supply'], view: { dist: 420, tilt: 0.85, az: 205 } },
      { id: 'tanks', title: 'Tanks in the berm',
        text: 'Buried in the berm east of the building are the tanks that make the system work: three process tanks where wastewater settles and is first treated, a 15,000-gallon tank of drinking water, and a 40,000-gallon tank that holds 30,000 gallons for firefighting and 10,000 gallons of recycled water.',
        at: 'tanks', cut: { c: [585, 175], ang: 30, l: 150, w: 92 },
        view: { dist: 330, tilt: 0.62, az: 190 }, show: ['proc', 'potable', 'np', 'lift'] },
      { id: 'process', title: 'From flush to reuse',
        text: 'All of the Library’s wastewater is cleaned on site, up to 12,800 gallons a day. It drops into a lift station and is pumped to a trash trap, where solids settle out. Equalization tanks even out the flow over the day. In a membrane bioreactor in the mechanical room, microbes in an oxygen-poor zone and then an oxygen-rich zone, fed with bubbled air, break down the waste. Membranes filter the water, ultraviolet light disinfects it with no chlorine, and it waits in a holding tank until it’s needed. Leftover sludge is hauled off site.',
        at: 'process', specimen: 'process', view: { dist: 310, tilt: 0.14, az: 'perp' }, show: ['pf'],
        photo: ['102', 'The membrane bioreactor in the Library’s mechanical room'] },
      { id: 'reuse', title: 'Used again',
        text: 'Cleaned water is piped back into the building to flush toilets and urinals. Efficient fixtures plus recycled water cut the Library’s drinking-water use by about 60% compared with a typical building.',
        at: [480, 105, 4], trench: ['recycled'], roof: false, view: { dist: 260, tilt: 0.9, az: 200 } },
      { id: 'leach', title: 'Back into the ground',
        text: 'Water the building doesn’t reuse is pumped to leach fields inside the Boardwalk loop. Each field is a set of trenches 100 feet long, 2 feet wide and 4 feet deep, filled with drain rock around a perforated pipe, so the water seeps slowly into the soil. Together the fields can take 14,700 gallons a day.',
        at: 'leach', trench: ['leachFeed'], cut: { c: [612, -470], ang: -22, l: 120, w: 110, depth: 4.1 },
        view: { dist: 190, tilt: 0.5, az: 230 }, show: ['trench'] },
      { id: 'roof', title: 'Rain on a prairie roof',
        text: 'Rain soaks into the 15 inches of growing soil on the prairie roof, where the plants’ roots take it up. When the soil is full, extra water drains through pipes that let it out at the foot of the building, and it flows across the ground into the prairie basins.',
        at: 'roofdrain', view: { dist: 170, tilt: 0.32, az: 'drain' }, show: ['roofdrain'],
        photo: ['049', 'Visitors walking on the prairie roof'] },
      { id: 'basins', title: 'Eight prairie basins',
        text: 'Eight shallow basins planted with native grasses catch runoff from the roof, walkways and parking. Together they hold about 31,800 cubic feet of water, just over twice what the Living Building Challenge requires, and they cut peak runoff from a 100-year storm by more than half. Once new plants are established, irrigation is shut off for good, kept only for emergencies. After that the prairie lives on what falls from the sky, about 15 inches a year.',
        at: 'basin', view: { dist: 700, tilt: 1.0, az: 215 },
        photo: ['024', 'Restored prairie in front of the Library'] },
      { id: 'detention', title: 'Storm storage under the east lot',
        text: 'Rain that runs off the east parking lot drops through grates into an underground detention system, a bed of large chambers more than 200 feet long. It holds a storm’s runoff and lets it out slowly through a pipe, so the water doesn’t rush down the draws all at once. It stores stormwater; it isn’t a tank for reusing rain indoors.',
        at: 'detention', cut: { c: [1940.7, 485.5], ang: 115.4, l: 150, w: 70, depth: 16 },
        view: { dist: 260, tilt: 0.6, az: 210 }, show: ['detention'] }
    ]
  },

  carbon: {
    label: 'Carbon',
    color: '#7FB069',
    title: 'Carbon',
    intro: 'Every building carries carbon, both in what it is made of and in how it runs. The Library cuts both, and its prairie keeps drawing carbon down into the soil.',
    stats: [
      ['~52%', 'less embodied carbon*'],
      ['400,000', 'native plants'],
      ['0', 'gas lines']
    ],
    statNote: '*Compared with a typical steel-framed design, counting carbon stored in the wood. About 26% without it.',
    stops: [
      { id: 'timber', title: 'A roof of wood',
        text: 'Nearly 1,800 cubic meters of glulam beams and cross-laminated timber hold up the Library’s roof. Over the open breezeway, the beams cross in triangles that follow the curve of the roof, and where long spans needed steel, the steel is wrapped in wood. All of it is FSC-certified, and it holds on to the carbon the trees drew from the air while they grew.',
        at: [311, 112, 28], specimen: 'diagrid', bcut: { c: [311, 112], ang: 90, l: 176, w: 48, z: 28.6, bare: true }, view: { dist: 150, tilt: 0.95, az: 235 }, show: ['diagrid'],
        photo: ['004', 'The breezeway’s timber roof, looking out to the Badlands'] },
      { id: 'layers', title: 'Eight feet of roof',
        text: 'Peel the roof apart and it is about eight feet thick. From the top: native plants in 15 inches of growing soil, a waterproof membrane, R-70 insulation, a thin concrete topping, seven-layer cross-laminated timber panels, and glulam beams about four feet deep.',
        at: 'specRoof', bcut: { c: [150, 30], ang: 0, l: 330, w: 150, z: 0.5 }, specimen: 'roof',
        view: { dist: 110, tilt: 0.25, az: 245 }, show: ['roofLayers', 'soil', 'insul', 'topping', 'clt', 'glulam'],
        photo: ['092', 'Timber beams and a skylight in the roof'] },
      { id: 'embodied', title: 'Less carbon in the build',
        text: 'Making steel, cement and glass releases carbon long before a building opens. A whole-building life-cycle study found the Library’s materials carry about 26% less of that “embodied” carbon than a typical steel-framed building, and about 52% less when the carbon stored in the wood is counted.',
        at: 'ledger', specimen: 'ledger', view: { dist: 150, tilt: 0.3, az: 250 }, show: ['ledger0', 'ledger1', 'ledger2'] },
      { id: 'concrete', title: 'Cleaner concrete',
        text: 'Cement is the carbon-heavy part of concrete. The Library’s concrete, mixed at a ready-mix plant in Dickinson, replaces 50 to 70 percent of the cement with fly ash and slag, leftovers from power plants and steel mills. That cut the concrete’s carbon footprint nearly in half.',
        at: 'concrete', specimen: 'concrete', view: { dist: 110, tilt: 0.3, az: 250 }, show: ['mixTypical', 'mixLibrary', 'flyash'] },
      { id: 'earth', title: 'Walls from the Badlands',
        text: 'The rammed-earth wall in the main hall runs about 240 feet and is two feet thick. Crews from Winn Construction in Dickinson packed damp earth and gravel from the region, with a little cement, into forms a layer at a time, tamping each lift down to about eight inches. Its colors were matched to soil and rock samples gathered around Medora, so the wall echoes the banded buttes outside.',
        at: 'earth', specimen: 'earth', view: { dist: 80, tilt: 0.22, az: 250 }, show: ['earthLifts', 'earthThick'],
        photo: ['093', 'The rammed-earth wall in the main hall'] },
      { id: 'reused', title: 'Saved and used again',
        text: 'Heart pine floors in the galleries were milled from beams salvaged out of an old factory in Lavonia, Georgia. A copper beech that grew at Sagamore Hill, Roosevelt’s home on Long Island, became slabs for the entrance and tables. Rejected bricks from the Hebron Brick plant in North Dakota were crushed for paths, and timber mats used during construction became benches.',
        at: 'reuse', specimen: 'reuse', view: { dist: 72, tilt: 0.4, az: 255 }, show: ['pine', 'beech', 'brick', 'mats'],
        photo: ['094', 'A live-edge counter in front of the rammed-earth wall'] },
      { id: 'prairie', title: '400,000 prairie plants',
        text: 'Seed collecting began in the summer of 2022, a year before construction, on the site and at places like the Maltese Cross and Elkhorn Ranch. The seed was grown out in greenhouses, including at NDSU’s Hettinger Research Extension Center. About 130,000 of the plants cover the roof and another 270,000 grow across the grounds. Prairie roots run deep, carrying carbon underground and storing it in the soil.',
        at: 'roots', cut: { c: [60, -470], ang: 0, l: 70, w: 50, depth: 20 },
        view: { dist: 150, tilt: 0.4, az: 215 }, show: ['roots'],
        photo: ['028', 'Restored prairie on the Library grounds'] },
      { id: 'soil', title: 'Measuring the soil',
        text: 'Ecologists pulled 60 soil cores to set a baseline for soil carbon, so future measurements can show how much the restored prairie stores over time.',
        at: 'roots', cut: { c: [60, -470], ang: 0, l: 70, w: 50, depth: 20 },
        view: { dist: 120, tilt: 0.45, az: 160 }, show: ['cores'] },
      { id: 'grazing', title: 'Grazing like bison',
        text: 'The land plan calls for cattle to graze in short bursts followed by long rests, the way bison herds once moved across the plains, with prescribed fire every five to ten years. Both keep the prairie and its roots healthy. The paddocks drawn here are illustrative.',
        at: 'pasture', view: { dist: 900, tilt: 0.75, az: 215 } }
    ]
  }
};

export const PLACES = [
  { name: 'Theodore Roosevelt Presidential Library', at: [210, 100, 56], main: true },
  { name: 'The Boardwalk', at: 'loopW' },
  { name: 'Overlook', at: 'overlook' },
  { name: 'Prairie basins', at: 'basin' },
  { name: 'Solar canopies', at: 'pv' },
  { name: 'Trailhead', at: 'trailhead' }
];

// Callout text (id -> [title, detail]). Equipment tags come from the M301/M802 schedules.
export const CALLOUTS = {
  pv: ['792 panels', '352 kW on timber canopies'],
  depth: ['300 ft', 'bottom of each borehole'],
  sb: ['Sentinel Butte Formation', 'gray-brown sand, clay and lignite'],
  clk: ['Clinker (“scoria”)', 'rock baked red by a burning coal seam'],
  bc: ['Bullion Creek Formation', 'yellow-brown sand, silt and clay'],
  loop: ['U-shaped loop', 'down one side, up the other'],
  vault: ['Valve vault', '8 circuits join here'],
  mains: ['Two 6-inch mains', 'out to the wells and back'],
  'WWHP-2': ['Heat pumps', 'three water-to-water units'],
  'CH-1': ['Chiller', '200 tons, magnetic bearings'],
  'HPLP-1': ['Loop pumps', '600 gallons a minute each'],
  'DWH-1': ['Hot-water heat pump', 'CO₂ refrigerant'],
  'B-1': ['Electric boiler', ''],
  'AHU-1': ['Air handler', 'for the auditorium'],
  MBR: ['Membrane bioreactor', 'up to 12,800 gallons a day'],
  BREAK: ['Break tank', 'treated water out'],
  slab: ['Radiant slab', 'water tubing in the concrete'],
  beam: ['Chilled beams', '125 overhead'],
  air: ['Fresh air', 'from five air handlers'],
  roofLayers: ['Prairie roof', 'plants and growing soil'],
  insul: ['R-70 insulation', ''],
  clt: ['Cross-laminated timber', '7 layers'],
  glulam: ['Glulam beams', 'Douglas fir, about 4 ft deep'],
  soil: ['15 inches of soil', 'about three times a typical green roof'],
  topping: ['Concrete topping', '3 inches'],
  diagrid: ['Glulam beams in triangles', 'following the curve of the roof'],
  ledger0: ['Typical steel-framed building', 'embodied carbon, for comparison'],
  ledger1: ['The Library’s materials', 'about 26% less'],
  ledger2: ['Counting carbon stored in the wood', 'about 52% less'],
  mixTypical: ['Typical concrete', 'all the binder is cement'],
  mixLibrary: ['Library concrete', '50–70% of the cement replaced'],
  flyash: ['Fly ash and slag', 'industrial leftovers'],
  earthLifts: ['Packed in lifts', 'each tamped to about 8 inches'],
  earthThick: ['Two feet thick', 'earth and gravel from the region'],
  pine: ['Heart pine', 'from a factory in Lavonia, Georgia'],
  beech: ['Copper beech', 'from Sagamore Hill'],
  brick: ['Crushed Hebron brick', 'for paths'],
  mats: ['Timber-mat bench', 'mats reused from construction'],
  proc: ['Process tanks', 'settling and first treatment'],
  potable: ['15,000 gallons', 'drinking water'],
  np: ['40,000 gallons', 'fire storage + recycled water'],
  lift: ['Lift station', ''],
  trench: ['Leach trench', '100 × 2 × 4 ft, drain rock'],
  lSupply: ['In: drinking water', 'by pipeline from Lake Sakakawea'],
  lWaste: ['Down the drain', 'every drop goes to treatment'],
  lRecycled: ['Back in: recycled water', 'for toilets and urinals'],
  lLeach: ['Out: to the leach fields', 'soaks back into the ground'],
  roofdrain: ['Roof drain outlet', 'extra water out to the basins'],
  detention: ['Detention chambers', 'hold runoff, release it slowly'],
  roots: ['Prairie roots', 'carbon stored underground'],
  cores: ['Soil cores', 'a baseline for soil carbon']
};

export const NOTE = 'Built from the Library’s construction drawings and design documents, with the building from the Library’s campus model and the land from USGS 3D Elevation Program lidar. Pipes, tanks and equipment are drawn in their planned locations; the drinking-water and fire tanks are placed approximately. Rock layers follow the badlands around Medora and are drawn to illustrate, not from site borings. The Library has earned SITES and LEED Platinum precertification and is pursuing Living Building Challenge certification.';

// What the moving dots mean (key -> [label, color]); shown in the on-screen legend.
export const LEGEND = {
  sun: ['Sunlight', '#FFC94D'],
  solar: ['Solar electricity', '#FFE7A0'],
  grid: ['Power from the grid', '#FFFFFF'],
  loopOut: ['Loop fluid heading down into the rock', '#9AD0F5'],
  loopBack: ['Loop fluid coming back up', '#FFB27A'],
  heatingWater: ['Warm water for the floors', '#FF9F5E'],
  coolingWater: ['Chilled water for the beams', '#7CC0F0'],
  coolAir: ['Cool air sinking from the beams', '#BFE6F8'],
  freshAir: ['Fresh outdoor air', '#FFFFFF'],
  drinking: ['Drinking water', '#3FA2E6'],
  waste: ['Wastewater', '#9A8263'],
  treated: ['Cleaned, recycled water', '#A79BEA'],
  soak: ['Water soaking into the soil', '#C2B8FF'],
  rain: ['Rain and runoff', '#5AA9D6'],
  carbon: ['Carbon drawn from the air', '#5C7F8F'],
  air: ['Air bubbled in for the microbes', '#FFFFFF']
};
