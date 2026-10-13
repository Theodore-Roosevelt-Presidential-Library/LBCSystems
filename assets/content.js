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
        at: 'pv', view: { dist: 560, tilt: 0.75, az: 215 }, show: ['pv'] },
      { id: 'wells', title: '216 wells, 300 feet down',
        text: 'Under the parking lot, 216 boreholes drop 300 feet into the Sentinel Butte Formation, set at least 20 feet apart. Each holds a loop of plastic pipe sealed in grout. A mix of water and antifreeze runs down one side and back up the other, trading heat with rock that holds a steady temperature all year.',
        at: 'field', cut: { c0: [985, -255], ang: -90, l: 900, w: 600 },
        view: { dist: 1500, tilt: 0.5, az: 312 }, show: ['depth', 'rock', 'loop'] },
      { id: 'circuits', title: 'Eight circuits, one vault',
        text: 'The wells are linked in eight circuits. Their pipes run in trenches beneath the pavement to a buried valve vault at the north end of the field, where they join two 6-inch mains: one carrying fluid out to the wells, one bringing it back.',
        at: 'vault', xray: true, view: { dist: 620, tilt: 1.05, az: 215 }, show: ['vault'] },
      { id: 'header', title: 'Down the hill to the plant',
        text: 'From the vault, the pair of mains runs about 750 feet beneath the drive and the drop-off loop to the mechanical room in the east building. Two pumps, each able to move 600 gallons a minute, keep the loop flowing.',
        at: 'headerMid', xray: true, view: { dist: 900, tilt: 0.95, az: 200 }, show: ['mains'] },
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
      { id: 'pipeline', title: 'A pipeline from Lake Sakakawea',
        text: 'Drinking water comes through the Southwest Water Authority pipeline. It is drawn from Lake Sakakawea, treated in Dickinson and piped about 86 miles. The Library’s connection is limited to 7 gallons a minute, so water is stored on site rather than drawn in big bursts.',
        at: 'road', xray: true, view: { dist: 1000, tilt: 0.9, az: 200 } },
      { id: 'tanks', title: 'Tanks in the berm',
        text: 'Buried in the berm east of the building are the tanks that make the system work: three process tanks where wastewater settles and is first treated, a 15,000-gallon tank of drinking water, and a 40,000-gallon tank that holds 30,000 gallons for firefighting and 10,000 gallons of recycled water.',
        at: 'tanks', cut: { c: [585, 175], ang: 30, l: 150, w: 92 },
        view: { dist: 330, tilt: 0.62, az: 190 }, show: ['proc', 'potable', 'np', 'lift'] },
      { id: 'treat', title: 'Cleaned right here',
        text: 'A membrane bioreactor in the mechanical room can treat up to 12,800 gallons a day. Wastewater moves through a trash trap and equalization tanks, then microbes in oxygen-poor and oxygen-rich zones break down the waste. Membranes with pores far finer than a hair filter the water, and ultraviolet light disinfects it, with no chlorine.',
        at: 'mech', bcut: { c: 'mech', ang: -101.3, l: 110, w: 70, z: 13 },
        view: { dist: 220, tilt: 1.05, az: 120 }, show: ['MBR', 'BREAK', 'proc'] },
      { id: 'reuse', title: 'Used again',
        text: 'Treated water is stored and piped back into the building to flush toilets and urinals. Efficient fixtures plus recycled water cut the Library’s drinking-water use by about 60% compared with a typical building.',
        at: [200, 90, 6], roof: false, view: { dist: 650, tilt: 1.1, az: 210 } },
      { id: 'leach', title: 'Back into the ground',
        text: 'Water the building doesn’t reuse is pumped to leach fields inside the Boardwalk loop. Each field is a set of trenches 100 feet long, 2 feet wide and 4 feet deep, filled with drain rock around a perforated pipe, so the water seeps slowly into the soil. Together the fields can take 14,700 gallons a day.',
        at: 'leach', cut: { c: [612, -470], ang: -22, l: 120, w: 110, depth: 4.1 },
        view: { dist: 190, tilt: 0.5, az: 230 }, show: ['trench'] },
      { id: 'roof', title: 'Rain on a prairie roof',
        text: 'The roof is planted with native prairie that soaks up rain where it falls. What the roof can’t hold runs off into the prairie basins below.',
        at: [170, 140, 42], view: { dist: 520, tilt: 0.85, az: 215 } },
      { id: 'basins', title: 'Eight prairie basins',
        text: 'Eight shallow basins planted with native grasses catch runoff from the roof, walkways and parking. Together they hold about 31,800 cubic feet of water, just over twice what the Living Building Challenge requires, and they cut peak runoff from a 100-year storm by more than half.',
        at: 'basin', view: { dist: 700, tilt: 1.0, az: 215 } },
      { id: 'sprinklers', title: 'No sprinklers',
        text: 'Once new plants are established, the irrigation system is shut off for good, kept only for emergencies. After that, the prairie lives on what falls from the sky, about 15 inches a year.',
        at: 'lawn', view: { dist: 850, tilt: 1.0, az: 215 } },
      { id: 'loop', title: 'Back to the lake',
        text: 'Water that soaks in here drains toward the Little Missouri River, which flows into Lake Sakakawea, the same lake the Library’s water comes from.',
        at: 'valley', view: { dist: 2100, tilt: 0.7, az: 200 } }
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
        text: 'Douglas fir glulam beams hold up a roof of seven-layer cross-laminated timber panels, topped with a thin layer of concrete. All of the wood comes from FSC-certified forests, and it holds on to carbon the trees drew from the air while they grew.',
        at: 'specRoof', bcut: { c: [150, 30], ang: 0, l: 330, w: 150, z: 0.5 }, specimen: 'roof',
        view: { dist: 95, tilt: 0.28, az: 245 }, show: ['clt', 'glulam'] },
      { id: 'embodied', title: 'Less carbon in the build',
        text: 'Compared with a typical steel-framed building, the Library’s materials cut embodied carbon by about 26%, and by about 52% when the carbon stored in the wood is counted.',
        at: [300, 90, 26], view: { dist: 750, tilt: 0.95, az: 215 } },
      { id: 'earth', title: 'Walls from the Badlands',
        text: 'Rammed-earth walls, two feet thick, are built by compacting local soils in layers. Their colors were matched to soil and rock samples gathered around Medora, so the walls echo the banded buttes outside.',
        at: [100, -20, 12], view: { dist: 330, tilt: 0.55, az: 215 } },
      { id: 'reused', title: 'Saved and used again',
        text: 'Reclaimed heart pine floors in the galleries. End-grain oak in the auditorium and museum store. Crushed Hebron brick on the paths. Timber mats from construction, reborn as benches and lobby seating.',
        at: [310, 60, 8], roof: false, view: { dist: 620, tilt: 1.0, az: 215 } },
      { id: 'prairie', title: '400,000 prairie plants',
        text: 'About 130,000 native plants cover the roof, and another 270,000 grow across the grounds, most of them grown from seed collected on and near the site. Prairie roots run deep, carrying carbon underground and storing it in the soil.',
        at: 'roots', cut: { c: [60, -470], ang: 0, l: 70, w: 50 },
        view: { dist: 150, tilt: 0.4, az: 215 }, show: ['roots'] },
      { id: 'soil', title: 'Measuring the soil',
        text: 'Ecologists pulled 60 soil cores to set a baseline for soil carbon, so future measurements can show how much the restored prairie stores over time.',
        at: 'roots', cut: { c: [60, -470], ang: 0, l: 70, w: 50 },
        view: { dist: 190, tilt: 0.55, az: 160 }, show: ['cores'] },
      { id: 'grazing', title: 'Grazing like bison',
        text: 'The land plan calls for cattle to graze in short bursts followed by long rests, the way bison herds once moved across the plains, with prescribed fire every five to ten years. Both keep the prairie and its roots healthy.',
        at: 'pasture', view: { dist: 1200, tilt: 0.9, az: 215 } }
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
  rock: ['Sentinel Butte Formation', 'sandstone, siltstone, clay and lignite'],
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
  clt: ['Cross-laminated timber', '7 layers + 3-inch concrete topping'],
  glulam: ['Glulam beams', 'Douglas fir'],
  proc: ['Process tanks', 'settling and first treatment'],
  potable: ['15,000 gallons', 'drinking water'],
  np: ['40,000 gallons', 'fire storage + recycled water'],
  lift: ['Lift station', ''],
  trench: ['Leach trench', '100 × 2 × 4 ft, drain rock'],
  roots: ['Prairie roots', 'carbon stored underground'],
  cores: ['Soil cores', 'a baseline for soil carbon']
};

export const NOTE = 'Built from the Library’s construction drawings and design documents. Pipes, tanks and equipment are drawn in their planned locations; the drinking-water and fire tanks are placed approximately. The Library has earned SITES and LEED Platinum precertification and is pursuing Living Building Challenge certification.';
