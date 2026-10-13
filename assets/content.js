// Copy for each layer. Figures come from the Library's design, engineering and
// certification documents (BIM 360 archive, audited Oct 2026). See README for sources.
// Positions are in model feet: x/y on the site plane (y = model north-ish), z = height.

export const LAYERS = {
  overview: {
    label: 'Overview',
    title: 'How the Library Works',
    intro: 'Power from the sun and the ground below. Water that’s cleaned and used again. A roof of native prairie. Explore the systems at work on the butte above Medora, then pick a layer to see each one in motion.',
    stats: [],
    stops: []
  },

  energy: {
    label: 'Energy',
    color: '#FC924E',
    title: 'Energy',
    intro: 'The Library runs on electricity alone, with no natural gas or propane on site. Heating and cooling come from the ground under the parking lot, and solar panels shade the cars parked beneath them.',
    stats: [
      ['216', 'geothermal wells'],
      ['~300 ft', 'deep'],
      ['352 kW', 'of solar panels']
    ],
    stops: [
      { id: 'solar', title: 'Solar canopies',
        text: 'Solar panels sit on canopies over the shared parking lot, with more on the roof of the maintenance and land stewardship building. Together they are rated at about 352 kilowatts and are expected to produce roughly 419,000 kilowatt-hours a year, while giving parked cars some shade.',
        at: 'pv', view: { dist: 520, tilt: 0.95 } },
      { id: 'wells', title: '216 wells, 300 feet down',
        text: 'Under the parking lot, 216 geothermal wells reach about 300 feet into the Sentinel Butte Formation, where the rock stays near 51°F all year. Water moves through sealed loops, picking up the earth’s warmth in winter and giving heat back to the ground in summer. The wells handle all of the building’s cooling and most of its heating.',
        at: 'wells', underground: true, view: { dist: 1150, tilt: 0.45 } },
      { id: 'plant', title: 'Heat pumps',
        text: 'In the east building, water-to-water heat pumps and a high-efficiency chiller turn that steady ground temperature into heating and cooling. A tunnel carries the pipes across to the west building.',
        at: [390, 70, -6], underground: true, roof: false, view: { dist: 620, tilt: 0.9 } },
      { id: 'radiant', title: 'Warm floors, cool beams',
        text: 'Instead of blowing hot or cold air around, the Library moves water through radiant floors and through chilled beams overhead. Fresh air comes in through units that recover energy from the air on its way out.',
        at: [150, 100, 4], roof: false, view: { dist: 700, tilt: 1.1 } },
      { id: 'envelope', title: 'Built to hold heat',
        text: 'Rammed-earth walls and concrete floors absorb warmth and release it slowly. The roof is insulated to R-70 and the windows are triple-paned, which matters on a butte where temperatures have ranged from −40°F to 116°F.',
        at: [60, -20, 22], view: { dist: 360, tilt: 0.7 } },
      { id: 'goal', title: 'The grid and the goal',
        text: 'Roughrider Electric Cooperative connects the Library to the regional grid. The Library is pursuing Living Building Challenge certification, which asks a building to produce 105% of the energy it uses from renewable sources over a full year. On-site solar covers part of that, and the Library is working to add off-site renewable power to close the gap.',
        at: 'grid', view: { dist: 1100, tilt: 1.0 } }
    ]
  },

  water: {
    label: 'Water',
    color: '#2FB5DA',
    title: 'Water',
    intro: 'In the Badlands, water is precious. The Library draws a small, steady stream from a regional pipeline, treats all of its wastewater on site and uses it again, and lets rain soak back into the prairie.',
    stats: [
      ['7 gal/min', 'supply line'],
      ['100%', 'of wastewater treated on site'],
      ['8', 'prairie basins']
    ],
    stops: [
      { id: 'pipeline', title: 'A pipeline from Lake Sakakawea',
        text: 'Drinking water comes through the Southwest Water Authority pipeline. It is drawn from Lake Sakakawea, treated in Dickinson and piped about 86 miles. The Library’s connection is limited to 7 gallons per minute, so water is stored on site rather than drawn in big bursts.',
        at: 'road', view: { dist: 900, tilt: 1.0 } },
      { id: 'tanks', title: 'Tanks under the berm',
        text: 'Two fiberglass tanks are buried in the berm east of the building: 15,000 gallons for drinking water and 40,000 gallons for recycled water. The recycled-water tank also feeds dry hydrants that local firefighters can draw from.',
        at: 'tankD', underground: true, view: { dist: 520, tilt: 0.7 } },
      { id: 'inside', title: 'Less water inside',
        text: 'Efficient fixtures, plus recycled water for flushing, cut the Library’s drinking-water use by about 60% compared with a conventional building.',
        at: [200, 90, 6], roof: false, view: { dist: 700, tilt: 1.1 } },
      { id: 'treat', title: 'Treated right here',
        text: 'All of the Library’s wastewater is treated on site in a membrane bioreactor. Microbes break down the waste, fine membranes filter the water, and ultraviolet light disinfects it, with no chlorine.',
        at: [395, 30, -6], underground: true, roof: false, view: { dist: 600, tilt: 0.9 } },
      { id: 'reuse', title: 'Used again',
        text: 'Treated water goes to the 40,000-gallon tank and comes back into the building to flush toilets and urinals. Any extra soaks into the ground through leach fields.',
        at: 'tankN', underground: true, view: { dist: 520, tilt: 1.1 } },
      { id: 'roof', title: 'Rain on a prairie roof',
        text: 'The roof is planted with native prairie that soaks up rain where it falls. What the roof can’t hold runs off into the prairie basins below.',
        at: [170, 140, 42], view: { dist: 480, tilt: 0.85 } },
      { id: 'basins', title: 'Eight prairie basins',
        text: 'Eight shallow basins planted with native grasses catch runoff from the roof, walkways and parking. They can hold just over twice the water the Living Building Challenge requires, and they cut peak runoff from a 100-year storm by more than half.',
        at: 'basin', view: { dist: 700, tilt: 1.05 } },
      { id: 'sprinklers', title: 'No sprinklers',
        text: 'Once new plants are established, the irrigation line is cut and capped for good. After that, the prairie lives on what falls from the sky, about 15 inches a year.',
        at: 'lawn', view: { dist: 800, tilt: 1.0 } },
      { id: 'loop', title: 'Back to the lake',
        text: 'Water that soaks in here drains toward the Little Missouri River, which flows into Lake Sakakawea, the same lake the Library’s water comes from.',
        at: 'leach', underground: true, view: { dist: 1300, tilt: 1.05 } }
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
        text: 'The roof and much of the frame are mass timber: Douglas fir glulam beams and cross-laminated timber panels from FSC-certified forests. The wood holds on to carbon the trees drew from the air while they grew.',
        at: [200, 100, 30], roof: false, view: { dist: 650, tilt: 0.9 } },
      { id: 'embodied', title: 'Less carbon in the build',
        text: 'Compared with a typical steel-framed building, the Library’s materials cut embodied carbon by about 26%, and by about 52% when the carbon stored in the wood is counted.',
        at: [380, 90, 26], roof: false, view: { dist: 750, tilt: 0.95 } },
      { id: 'earth', title: 'Walls from the Badlands',
        text: 'Rammed-earth walls are built by compressing soil, sand and gravel in layers. Their colors were matched to soil and rock samples gathered around Medora.',
        at: [100, -20, 12], view: { dist: 330, tilt: 0.65 } },
      { id: 'reused', title: 'Saved and used again',
        text: 'Reclaimed heart pine floors in the galleries. End-grain oak in the auditorium and museum store. Crushed Hebron brick on the paths. Timber mats from construction, reborn as benches and lobby seating.',
        at: [310, 60, 8], roof: false, view: { dist: 650, tilt: 1.0 } },
      { id: 'prairie', title: '400,000 prairie plants',
        text: 'About 130,000 native plants cover the roof, and another 270,000 grow across the grounds, grown from seed collected on and near the site. Prairie roots run deep, carrying carbon underground and storing it in the soil.',
        at: 'lawn', underground: true, view: { dist: 850, tilt: 1.05 } },
      { id: 'soil', title: 'Measuring the soil',
        text: 'Ecologists pulled 60 soil cores to set a baseline for soil carbon, so future measurements can show how much the restored prairie stores over time.',
        at: 'soil', underground: true, view: { dist: 700, tilt: 1.25 } },
      { id: 'grazing', title: 'Grazing like bison',
        text: 'The land plan calls for cattle to graze in short bursts followed by long rests, the way bison herds once moved across the plains, with prescribed fire every five to ten years. Both keep the prairie and its roots healthy.',
        at: 'pasture', view: { dist: 1100, tilt: 1.0 } }
    ]
  }
};

export const PLACES = [
  { name: 'Theodore Roosevelt Presidential Library', at: [210, 100, 52], main: true },
  { name: 'The Boardwalk', at: 'loopW' },
  { name: 'Overlook', at: 'overlook' },
  { name: 'Prairie basins', at: 'basin' },
  { name: 'Solar canopies', at: 'pv' },
  { name: 'Trailhead', at: 'trailhead' },
  { name: 'Medora Musical', at: 'musical' }
];

export const NOTE = 'Figures come from the Library’s design, engineering and certification documents. Underground systems and interior spaces are shown in approximate locations. The Library has earned SITES and LEED Platinum precertification and is pursuing Living Building Challenge certification.';
