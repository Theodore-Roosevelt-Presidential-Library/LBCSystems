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
    intro: 'Power from the sun and from the rock below. Water that’s cleaned and used again. A roof of native prairie. All of it is aimed at one of the hardest goals a building can take on: the Living Building Challenge. Pick a system to cut into the ground and the building and see the parts that make it work.',
    stats: [
      ['20 of 20', 'rules a Living Building must meet'],
      ['12 months', 'of real performance before it counts'],
      ['35+', 'certified Living Buildings in the world']
    ],
    stops: []
  },

  energy: {
    label: 'Energy',
    color: '#FC924E',
    title: 'Energy',
    intro: 'The Library doesn’t burn gas or oil. It runs on electricity. Its heat and cooling come from deep underground, and solar panels make some of its power.',
    stats: [
      ['216', 'geothermal wells'],
      ['792', 'solar panels'],
      ['105%', 'clean-energy goal']
    ],
    stops: [
      { id: 'solar', title: 'Solar canopies', lbc: ["energy", "The challenge asks for 105% of the Library’s energy to come from clean sources over a year. These panels are the first big piece."],
        text: 'Solar panels sit on wooden roofs over the parking lot. When sunlight hits a panel, the panel turns it into electricity. Wires under the ground carry that power to the Library. The roofs also give parked cars some shade.',
        tech: 'Timber canopies over the parking lots carry 792 solar panels, with more on the roof of the maintenance and land stewardship building. Together they are rated at about 352 kilowatts and are expected to make roughly 419,000 kilowatt-hours a year, while shading the cars below. Sheets PV100–PV400 (Bid Package 5): 792 modules at 445 W, about 352 kW DC.',
        at: 'pv', trench: ['solarFeed'], view: { dist: 600, tilt: 0.7, az: 215 }, show: ['pv'],
        photo: ['117', 'Timber solar canopies over the parking lot'] },
      { id: 'wells', title: '216 wells, 300 feet down', lbc: ["energy", "The challenge doesn’t allow burning fuel in the building. Warmth from the rock means no gas furnace at all."],
        text: 'Under the parking lot are 216 holes, each about 300 feet deep. That’s as long as a football field! A plastic pipe goes down each hole and comes back up. Deep underground, the rock stays about the same temperature all year. The pipes are filled with water mixed with antifreeze, a lot like the coolant in a car, so it never freezes in a North Dakota winter. This water mix picks up warmth from the rock in winter and drops off extra heat in summer.',
        tech: 'Under the parking lot, 216 boreholes drop 300 feet through the banded sandstone, siltstone, clay and lignite of the badlands, set at least 20 feet apart. Each holds a loop of plastic pipe sealed in grout. A mix of water and antifreeze runs down one side and back up the other, trading heat with rock that holds a steady temperature all year. Per M001 (Mechanical Site Plan – Geothermal): 216 boreholes in eight circuits at a minimum 20-ft spacing, plus two GPS-located thermal-conductivity test bores, one reused as a production well. Design documents call for 1-inch HDPE U-bend loops and roughly 30% propylene glycol.',
        at: 'field', cut: { c0: [985, -255], ang: -90, l: 900, w: 600 },
        view: { dist: 1500, tilt: 0.5, az: 312 }, show: ['depth', 'sb', 'clk', 'bc', 'loop'] },
      { id: 'circuits', title: 'Eight circuits, one vault',
        text: 'The pipes from all 216 holes join together in eight groups. All eight groups meet in a box buried in the ground, called a vault. From there, two big pipes carry the water mix to the building and back.',
        tech: 'The wells are linked in eight circuits. Their pipes run in trenches beneath the pavement to a buried valve vault at the north end of the field, where they join two 6-inch mains: one carrying fluid out to the wells, one bringing it back.',
        at: 'vault', xray: true, view: { dist: 620, tilt: 1.05, az: 215 }, show: ['vault'] },
      { id: 'header', title: 'Down the hill to the plant',
        text: 'Two pipes run about 750 feet under the driveway to the Library. One carries the water mix in. The other carries it back out to the wells. Pumps keep it moving all the time.',
        tech: 'From the vault, the pair of mains runs about 750 feet beneath the drive and the drop-off loop to the mechanical room in the east building. Two pumps, each able to move 600 gallons a minute, keep the loop flowing. Per M001 and M802: two 6-inch HDPE mains (heat-pump loop supply and return) from the valve vault to MEP room E148. Loop pumps HPLP-1 and HPLP-2 (Taco) are each scheduled for 600 gpm at 130 ft of head on 30% propylene glycol.',
        at: 'headerMid', trench: ['header'], view: { dist: 230, tilt: 0.85, az: 215 }, show: ['mains'] },
      { id: 'plant', title: 'Inside the mechanical room', lbc: ["energy", "No furnace, no boiler fire, no gas line. Everything here runs on electricity, so clean power can run all of it."],
        text: 'This room is the Library’s heating and cooling center. Heat pumps work like a refrigerator running backward. They pull warmth out of the water mix from the ground and send it into the building. In summer, a machine called a chiller does the opposite and sends extra heat back down into the ground. Even the hot water for the sinks is made with a heat pump.',
        tech: 'Three water-to-water heat pumps pull warmth out of the loop in winter. In summer a 200-ton chiller with a frictionless magnetic-bearing compressor cools the building and sends its heat back down the wells. Even the hot water for sinks comes from a heat pump, one that uses carbon dioxide as its refrigerant. The boiler is electric, too. Per M301 and M802: WWHP-1, -2 and -3; CH-1, a Daikin water-cooled centrifugal chiller with a variable-speed magnetic-bearing compressor (200 tons, R-513A, 0.573 kW/ton at full load); DWH-1, a water-source heat-pump water heater on R-744 (CO₂); B-1, an electric boiler with 15 elements in 8 steps; and AHU-1 for the auditorium. A diesel generator serves life-safety loads only.',
        at: 'mech', bcut: { c: 'mech', ang: -101.3, l: 110, w: 70, z: 13 },
        view: { dist: 230, tilt: 1.0, az: 140 }, show: ['WWHP-2', 'CH-1', 'HPLP-1', 'DWH-1', 'B-1', 'AHU-1'] },
      { id: 'radiant', title: 'Warm floors, cool beams',
        text: 'Instead of blowing hot or cold air around, the Library moves water. Warm water flows through tubes inside the concrete floors to heat the rooms. Cool water flows through long boxes on the ceiling, called chilled beams, which quietly cool the air. A tunnel under the ground carries the pipes to the west building.',
        tech: 'Instead of blasting hot or cold air, the Library moves water. Tubing buried in the concrete floors warms or cools the slab, and 125 chilled beams overhead cool the rooms quietly. Five air handlers bring in fresh outdoor air, and a utility tunnel carries the pipes across to the west building. Equipment counts from the LBC indoor-environment plan: 125 active chilled beams and 2 fan-powered beams; five air handlers totaling about 42,750 cfm. Radiant cooling runs on 57°F high-temperature chilled water. The tunnel (A200, M100.C) carries the heat-pump loop, chilled-water and domestic lines.',
        at: 'specSlab', bcut: { c: [150, 30], ang: 0, l: 330, w: 150, z: 0.5 }, specimen: 'slab',
        view: { dist: 120, tilt: 0.36, az: 245 }, show: ['slab', 'beam', 'air'] },
      { id: 'envelope', title: 'Built to hold heat', lbc: ["energy", "Using less energy comes first. A building that holds its heat makes the 105% goal much easier to reach."],
        text: 'A building holds in heat the way a good winter coat keeps you warm. The roof has thick insulation, and the windows have three layers of glass. The concrete floors and thick earth walls soak up warmth and give it back slowly. That matters here, where it can be 40 below zero in winter and over 100 degrees in summer.',
        tech: 'The roof is insulated to R-70 and the windows are triple-paned, which matters on a butte where temperatures have ranged from −40°F to 116°F. Concrete floors and two-foot-thick rammed-earth walls soak up warmth and give it back slowly. DD energy report: roof R-70, walls R-24, triple glazing at U-0.27 to U-0.43, 22% window-to-wall ratio.',
        at: 'specRoof', bcut: { c: [150, 30], ang: 0, l: 330, w: 150, z: 0.5 }, specimen: 'roof',
        view: { dist: 95, tilt: 0.28, az: 245 }, show: ['roofLayers', 'clt', 'insul', 'glulam'] },
      { id: 'goal', title: 'The grid and the goal', lbc: ["energy", "Energy goal: make 105% of what the Library uses, from clean sources, over a full year."],
        text: 'The Library is still hooked up to the power lines. Its solar panels make about a fifth of the electricity the building uses. The Library is working toward a goal called the Living Building Challenge. It asks a building to get all of its energy, and a little more, from clean sources like the sun over a whole year.',
        tech: 'Roughrider Electric Cooperative connects the Library to the regional grid. On-site solar is expected to cover about a fifth of what the building uses. The Library is pursuing Living Building Challenge certification, which asks for 105% of a building’s energy to come from renewable sources over a full year, so closing the gap will take off-site renewable power.',
        at: 'grid', view: { dist: 1500, tilt: 0.85, az: 215 } }
    ]
  },

  water: {
    label: 'Water',
    color: '#2FB5DA',
    title: 'Water',
    intro: 'In the Badlands, water is precious. The Library gets a small, steady trickle of water, cleans all of its own wastewater and uses it again, and lets rain soak back into the land.',
    stats: [
      ['7 gal/min', 'supply line'],
      ['100%', 'of wastewater treated on site'],
      ['8', 'prairie basins']
    ],
    stops: [
      { id: 'loop', title: 'Follow the water', lbc: ["water", "The challenge asks a building to live within the water of its own place. Here, all wastewater is cleaned and used again."],
        text: 'Here you can see all of the Library’s water at once. Clean water comes in through a pipe. After people use it, the dirty water is cleaned right here. Then it either flushes toilets again or soaks back into the ground. Rain soaks into the roof and into shallow, grassy dips in the land. Each color in the key is a different kind of water.',
        tech: 'Here is the whole system at once, with the ground made see-through. Drinking water arrives by pipeline and waits in a tank in the berm. Every drop that goes down a drain is cleaned on site, then either flushes a toilet again or soaks back into the ground. Rain soaks into the prairie roof and the basins. Each color in the key is one kind of water. Water that soaks in here drains toward the Little Missouri River, which flows into Lake Sakakawea, the same lake the Library’s water comes from.',
        at: [540, -90, 0], xray: true, roof: false, view: { dist: 780, tilt: 1.12, az: 230 }, show: ['potable', 'np', 'lSupply', 'lRecycled', 'lLeach', 'lWaste'] },
      { id: 'pipeline', title: 'A pipeline from Lake Sakakawea', lbc: ["water", "Lake Sakakawea is fed by the same rivers the Library’s water flows back to. The challenge accepted this as one closed loop."],
        text: 'The Library’s drinking water starts in Lake Sakakawea. It is cleaned in Dickinson and travels about 86 miles through a pipe. Only about 7 gallons a minute can come in, a little more than a garden hose. So the Library keeps extra water in a tank for busy days.',
        tech: 'Drinking water comes through the Southwest Water Authority pipeline. It is drawn from Lake Sakakawea, treated in Dickinson and piped about 86 miles. The Library’s connection is limited to 7 gallons a minute, so water is stored on site rather than drawn in big bursts. The Southwest Water Authority allowed a temporary 12 gpm from June 2025 to June 2026. A 1-inch HDPE service feeds the makeup connection on the drinking-water tank, and a 3-inch line runs from the tank to the booster pumps in E148 (M001A notes M106, M107).',
        at: 'road', trench: ['supply'], view: { dist: 420, tilt: 0.85, az: 205 } },
      { id: 'tanks', title: 'Tanks in the berm',
        text: 'Inside the hill of earth next to the building are two big tanks. The blue one holds 15,000 gallons of drinking water. The purple one holds 40,000 gallons. Most of that is saved for fighting fires. The rest is cleaned, recycled water for flushing toilets.',
        tech: 'Per M001A (East Berm Piping Plan): DWT-1 is a fiberglass domestic-water storage tank (NSF/ANSI 61) and NPT-1 a fiberglass non-potable tank holding a 30,000-gallon fire reserve plus 10,000 gallons of recycled water. Top of tank is elevation 2530.0, about 14 feet above the 2516.0 main floor. NPT-1 feeds an 8-inch main to the site dry hydrants (NFPA 24) and a 6-inch main to the building. The three wastewater process tanks are separate (see the next stop).',
        at: 'tanks', bcut: { c: [498.4, 38.6], ang: -91.3, l: 128, w: 46, z: 8.6, bare: true },
        view: { dist: 230, tilt: 0.75, az: 200 }, show: ['potable', 'np'] },
      { id: 'process', title: 'From flush to reuse', lbc: ["water", "The challenge doesn’t allow chlorine bleach for cleaning water. This system uses living microbes and fine filters instead."],
        text: 'When water goes down a drain, it comes here to be cleaned, step by step. First, solid stuff settles to the bottom. Next, tiny living things called microbes eat the waste. Some of them need air, so air is bubbled in. Then the water goes through filters with holes far smaller than a hair. Last, ultraviolet light kills any germs. No chlorine is needed.',
        tech: 'All of the Library’s wastewater is cleaned on site, up to 12,800 gallons a day. It drops into a lift station and is pumped to a trash trap, where solids settle out. Equalization tanks even out the flow over the day. In a membrane bioreactor in the mechanical room, microbes in an oxygen-poor zone and then an oxygen-rich zone, fed with bubbled air, break down the waste. Membranes filter the water, ultraviolet light disinfects it with no chlorine, and it waits in a holding tank until it’s needed. Leftover sludge is hauled off site. Per C510 and C516: three 20,000-gallon fiberglass tanks. Tank 1 holds the anoxic, aerobic and sludge-holding compartments; Tank 2 the trash trap and equalization; Tank 3 more equalization. A lift station (invert 2504.0) feeds them, and an Innovatreat miniMBR skid with a membrane circulation tank and break tank sits in room E148. Design flows: 7,900–14,700 gpd summer average, 800–1,500 gpd winter.',
        at: 'process', specimen: 'process', cut: { c: [539, 166], ang: 30, l: 80, w: 62, depth: 26 }, view: { dist: 310, tilt: 0.14, az: 'perp' }, show: ['pf', 'proc', 'lift'],
        photo: ['102', 'The membrane bioreactor in the Library’s mechanical room'] },
      { id: 'reuse', title: 'Used again', lbc: ["water", "Flushing with cleaned water cuts the Library’s drinking-water use by about 60%."],
        text: 'The cleaned water goes back into the building to flush toilets. That, plus faucets and toilets that use less water, cuts the drinking water the Library uses by more than half.',
        tech: 'Cleaned water is piped back into the building to flush toilets and urinals. Efficient fixtures plus recycled water cut the Library’s drinking-water use by about 60% compared with a typical building.',
        at: [480, 105, 4], trench: ['recycled'], roof: false, view: { dist: 260, tilt: 0.9, az: 200 } },
      { id: 'leach', title: 'Back into the ground', lbc: ["water", "No sewer. Extra cleaned water soaks back into the ground and heads toward the Little Missouri River."],
        text: 'Water the building doesn’t need goes to fields of long, shallow ditches filled with rocks. A pipe with small holes lets the water drip out slowly, and it soaks into the soil.',
        tech: 'Water the building doesn’t reuse is pumped to leach fields inside the Boardwalk loop. Each field is a set of trenches 100 feet long, 2 feet wide and 4 feet deep, filled with drain rock around a perforated pipe, so the water seeps slowly into the soil. Together the fields can take 14,700 gallons a day. Two pressurized fields: southern (C511) and northern (C512), with notes on C515 and details on C704. The maintenance and land stewardship building has its own 1,000-gallon septic tank and gravity leach field.',
        at: 'leach', trench: ['leachFeed'], cut: { c: [612, -470], ang: -22, l: 120, w: 110, depth: 4.1 },
        view: { dist: 190, tilt: 0.5, az: 230 }, show: ['trench'] },
      { id: 'roof', title: 'Rain on a prairie roof', lbc: ["water", "Rain that lands on the Library stays on the site, as the challenge requires."],
        text: 'The roof is covered with prairie plants growing in more than a foot of soil. Rain soaks into the soil, and the plants drink it. When the soil is full, extra water drains out at the bottom of the building and flows to grassy dips nearby.',
        tech: 'Rain soaks into the 15 inches of growing soil on the prairie roof, where the plants’ roots take it up. When the soil is full, extra water drains through pipes that let it out at the foot of the building, and it flows across the ground into the prairie basins. Growing media is 15 inches deep, about three times a typical green roof. Green-roof drainage daylights within 5 feet of the building through 6-inch HDPE (C310.L note); outlet positions in the model are schematic.',
        at: 'roofdrain', view: { dist: 170, tilt: 0.32, az: 'drain' }, show: ['roofdrain'],
        photo: ['049', 'Visitors walking on the prairie roof'] },
      { id: 'basins', title: 'Eight prairie basins', lbc: ["water", "These basins hold more than twice the rainwater the challenge asks for."],
        text: 'Eight shallow, grassy dips in the land catch rain that runs off the roof, paths and parking lots. They hold the water so it can soak in slowly instead of rushing away. Once the new plants have grown in, no sprinklers are used. The prairie lives on rain and snow, about 15 inches a year.',
        tech: 'Eight shallow basins planted with native grasses catch runoff from the roof, walkways and parking. Together they hold about 31,800 cubic feet of water, just over twice what the Living Building Challenge requires, and they cut peak runoff from a 100-year storm by more than half. Once new plants are established, irrigation is shut off for good, kept only for emergencies. After that the prairie lives on what falls from the sky, about 15 inches a year. Mesic prairie basins A–H provide 31,799 cubic feet of retention against 15,746 required (LBC IO5-3).',
        at: 'basin', view: { dist: 700, tilt: 1.0, az: 215 },
        photo: ['024', 'Restored prairie in front of the Library'] },
      { id: 'detention', title: 'Storm storage under the east lot', lbc: ["water", "Storms are handled on site, so water leaves the land the way it did before the Library was built."],
        text: 'Under the east parking lot is a row of big buried chambers. When it storms, rain runs off the parking lot, through grates, and into the chambers. The water then drains out slowly, so it doesn’t rush down the hillsides and wash them away.',
        tech: 'Rain that runs off the east parking lot drops through grates into an underground detention system, a bed of large chambers more than 200 feet long. It holds a storm’s runoff and lets it out slowly through a pipe, so the water doesn’t rush down the draws all at once. It stores stormwater; it isn’t a tank for reusing rain indoors. Contech underground detention system on C310.B, with details on C707 and C708; dome-grate risers G3.1 and G3.2 and a 12-inch outlet. The model shows it at about 225 × 30 ft. Project narratives say no rainwater is reused indoors.',
        at: 'detention', cut: { c: [1940.7, 485.5], ang: 115.4, l: 150, w: 70, depth: 16 },
        view: { dist: 260, tilt: 0.6, az: 210 }, show: ['detention'] }
    ]
  },

  carbon: {
    label: 'Carbon',
    color: '#7FB069',
    title: 'Carbon',
    intro: 'Carbon dioxide is a gas that traps heat around our planet. Making a building and running it both add some to the air. The Library adds less, and its prairie pulls carbon back down into the soil.',
    stats: [
      ['~52%', 'less embodied carbon*'],
      ['400,000', 'native plants'],
      ['0', 'gas lines']
    ],
    statNote: '*Compared with a typical steel-framed design, counting carbon stored in the wood. About 26% without it.',
    stops: [
      { id: 'timber', title: 'A roof of wood', lbc: ["carbon", "The challenge counts the carbon in building materials, not just in the power bill. Wood stores carbon instead of releasing it."],
        text: 'Trees pull carbon out of the air as they grow and store it in their wood. The Library’s roof is held up by big beams made of layers of wood glued together. Over the open breezeway, the beams cross in triangles. All that wood keeps holding on to its carbon.',
        tech: 'Nearly 1,800 cubic meters of glulam beams and cross-laminated timber hold up the Library’s roof. Over the open breezeway, the beams cross in triangles that follow the curve of the roof, and where long spans needed steel, the steel is wrapped in wood. All of it is FSC-certified, and it holds on to the carbon the trees drew from the air while they grew. Supplier: Mercer Mass Timber of Spokane, Washington (ENR, Panel World). Glulam is Douglas fir; the roof slab is 7-layer CLT. Structural engineer of record MKA; connections by ISG and Timber Engineering Inc.; installed by Seagate (WoodWorks).',
        at: [311, 112, 28], specimen: 'diagrid', bcut: { c: [311, 112], ang: 90, l: 176, w: 48, z: 28.6, bare: true }, view: { dist: 150, tilt: 0.95, az: 235 }, show: ['diagrid'],
        photo: ['004', 'The breezeway’s timber roof, looking out to the Badlands'] },
      { id: 'layers', title: 'Eight feet of roof',
        text: 'The roof is about 8 feet thick, like a giant layer cake. On top are prairie plants in more than a foot of soil. Under that are a waterproof layer, thick insulation, a thin layer of concrete and wooden panels. Big wooden beams hold it all up.',
        tech: 'Peel the roof apart and it is about eight feet thick. From the top: native plants in 15 inches of growing soil, a waterproof membrane, R-70 insulation, a thin concrete topping, seven-layer cross-laminated timber panels, and glulam beams about four feet deep. Build-up from Metropolis and the DD energy report: planting and 15 in of growing media, membrane, R-70 insulation, 3-in composite concrete topping, 7-layer CLT, glulam beams about 4 ft deep.',
        at: 'specRoof', bcut: { c: [150, 30], ang: 0, l: 330, w: 150, z: 0.5 }, specimen: 'roof',
        view: { dist: 110, tilt: 0.25, az: 245 }, show: ['roofLayers', 'soil', 'insul', 'topping', 'clt', 'glulam'],
        photo: ['092', 'Timber beams and a skylight in the roof'] },
      { id: 'embodied', title: 'Less carbon in the build', lbc: ["carbon", "The challenge asks for at least 20% less carbon in materials. The Library’s design cuts about 52%, counting the carbon stored in wood."],
        text: 'Making steel, cement and glass puts carbon into the air before a building even opens. The Library chose materials that put in less. Its materials carry about one-quarter less carbon than a typical steel building. Count the carbon stored in the wood, and it’s about half.',
        tech: 'Making steel, cement and glass releases carbon long before a building opens. A whole-building life-cycle study found the Library’s materials carry about 26% less of that “embodied” carbon than a typical steel-framed building, and about 52% less when the carbon stored in the wood is counted. Atelier Ten whole-building life-cycle assessment (April 2026): 930 kgCO₂e/m² baseline vs. 682 for the design, and 444 net after a 238 kg/m² biogenic credit for stored wood carbon.',
        at: 'ledger', specimen: 'ledger', view: { dist: 150, tilt: 0.3, az: 250 }, show: ['ledger0', 'ledger1', 'ledger2'] },
      { id: 'concrete', title: 'Cleaner concrete', lbc: ["carbon", "Concrete is one of the biggest carbon sources in any building. Cleaner mixes help the Library meet the challenge’s carbon goal."],
        text: 'Concrete is made with cement, and making cement puts a lot of carbon into the air. The Library’s concrete swaps out more than half of its cement for leftovers: ash from power plants and slag from steel mills. That cut the carbon in the concrete nearly in half.',
        tech: 'Cement is the carbon-heavy part of concrete. The Library’s concrete, mixed at a ready-mix plant in Dickinson, replaces 50 to 70 percent of the cement with fly ash and slag, leftovers from power plants and steel mills. That cut the concrete’s carbon footprint nearly in half. Seven ternary mixes of Type IL cement, Class F fly ash and Grade 100 slag, from Dickinson Ready Mix with Winn Construction and Beton Consulting Engineers (ForConstructionPros). Some mixes reached about 6,500 psi at 28 days.',
        at: 'concrete', specimen: 'concrete', view: { dist: 110, tilt: 0.3, az: 250 }, show: ['mixTypical', 'mixLibrary', 'flyash'] },
      { id: 'earth', title: 'Walls from the Badlands', lbc: ["materials", "The challenge favors materials made close to home. These walls are made from earth of this region."],
        text: 'The big striped wall in the main hall is made of packed earth. Workers poured damp dirt and gravel into a mold, then pounded it down hard, one layer at a time. Each layer has slightly different colored soil, so the wall looks like the striped buttes outside.',
        tech: 'The rammed-earth wall in the main hall runs about 240 feet and is two feet thick. Crews from Winn Construction in Dickinson packed damp earth and gravel from the region, with a little cement, into forms a layer at a time, tamping each lift down to about eight inches. Its colors were matched to soil and rock samples gathered around Medora, so the wall echoes the banded buttes outside. Spec 13 3513: cement-stabilized rammed earth (about 10% cement per the Grand Forks Herald), 24 inches thick, about 240 feet long, built in roughly 12-inch loose lifts compacted to about 8 inches. Winn Construction with EarthWall Builders. The wall is not structural.',
        at: 'earth', specimen: 'earth', view: { dist: 80, tilt: 0.22, az: 250 }, show: ['earthLifts', 'earthThick'],
        photo: ['093', 'The rammed-earth wall in the main hall'] },
      { id: 'reused', title: 'Saved and used again', lbc: ["materials", "The challenge asks every Living Building to put salvaged materials back to work."],
        text: 'Some materials got a second life. The wood floors came from an old factory in Georgia. A big tree from Sagamore Hill, Theodore Roosevelt’s home, became tables and other pieces at the entrance. Broken bricks became gravel for paths, and wooden mats from the construction site became benches.',
        tech: 'Heart pine floors in the galleries were milled from beams salvaged out of an old factory in Lavonia, Georgia. A copper beech that grew at Sagamore Hill, Roosevelt’s home on Long Island, became slabs for the entrance and tables. Rejected bricks from the Hebron Brick plant in North Dakota were crushed for paths, and timber mats used during construction became benches. Heart pine milled by Pioneer Millworks in 5-, 7- and 9-inch widths. The Sagamore Hill copper beech was removed in 2019; slabs were made into pieces by Grain Designs (JLG, BD+C).',
        at: 'reuse', specimen: 'reuse', view: { dist: 95, tilt: 0.42, az: 262 }, show: ['pine', 'beech', 'brick', 'mats'],
        photo: ['094', 'A live-edge counter in front of the rammed-earth wall'] },
      { id: 'prairie', title: '400,000 prairie plants', lbc: ["place", "The challenge asks a building to leave its land healthier than it found it. Native prairie is coming back here."],
        text: 'About 400,000 native prairie plants grow on the roof and the land around the Library. Many grew from seeds gathered nearby. Prairie roots grow deep. As the plants grow, they pull carbon from the air down into the soil and keep it there.',
        tech: 'Seed collecting began in the summer of 2022, a year before construction, on the site and at places like the Maltese Cross and Elkhorn Ranch. The seed was grown out in greenhouses, including at NDSU’s Hettinger Research Extension Center. About 130,000 of the plants cover the roof and another 270,000 grow across the grounds. Prairie roots run deep, carrying carbon underground and storing it in the soil. Seed of local genetic origin from more than 200 species was collected (Snøhetta); partners Resource Environmental Solutions and NDSU. Site-wide plug area: 137,466 sq ft.',
        at: 'roots', cut: { c: [60, -470], ang: 0, l: 70, w: 50, depth: 20 },
        view: { dist: 150, tilt: 0.4, az: 215 }, show: ['roots'],
        photo: ['028', 'Restored prairie on the Library grounds'] },
      { id: 'soil', title: 'Measuring the soil', lbc: ["place", "Measuring the soil over time shows whether the land is really getting healthier, which the challenge asks the Library to prove."],
        text: 'Scientists pulled 60 thin tubes of soil out of the ground to measure how much carbon it holds today. Later, they can check again to see how much more carbon the prairie has stored.',
        tech: 'Ecologists pulled 60 soil cores to set a baseline for soil carbon, so future measurements can show how much the restored prairie stores over time.',
        at: 'roots', cut: { c: [60, -470], ang: 0, l: 70, w: 50, depth: 20 },
        view: { dist: 120, tilt: 0.45, az: 160 }, show: ['cores'] },
      { id: 'grazing', title: 'Grazing like bison', lbc: ["place", "Grazing and fire are how this prairie stayed healthy for thousands of years. Bringing them back helps restore the land."],
        text: 'Long ago, bison herds grazed one spot, then moved on and let the grass rest. The land plan calls for cattle to do the same thing, along with small, careful fires every 5 to 10 years. Both help keep the prairie healthy. The fenced areas drawn here are just an example.',
        tech: 'The land plan calls for cattle to graze in short bursts followed by long rests, the way bison herds once moved across the plains, with prescribed fire every five to ten years. Both keep the prairie and its roots healthy. The paddocks drawn here are illustrative.',
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
  proc: ['Three process tanks', '20,000 gallons each, buried'],
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

export const PETALS = { place: 'Place', water: 'Water', energy: 'Energy', carbon: 'Energy + carbon', materials: 'Materials' };

export const LBC = {
  zeros: [
    { k: 'energy', title: 'Zero energy', text: 'Make more clean energy than the Library uses in a year: 105%. Solar here covers about a fifth today, and more clean power is planned to close the gap.' },
    { k: 'water', title: 'Zero water', text: 'Clean all of its own wastewater and use it again. Drinking water arrives at just 7 gallons a minute, and rain soaks back into the land.' },
    { k: 'carbon', title: 'Zero carbon', text: 'No gas lines. About half the carbon of a typical building in its construction, and a prairie that pulls carbon into the soil.' },
    { k: null, title: 'Zero waste', text: 'Keep trash out of the landfill: sort and recycle, compost food scraps on site in a biodigester, and build with materials made to last.' }
  ],
  text: 'The Living Building Challenge is the toughest green building test in the world. Most green ratings work like a report card: a building earns points and can skip the hardest parts. This one is pass or fail. A building has to meet all 20 rules, covering energy, water, materials, health, fairness and beauty. And nothing counts until the building has run for a full year and proven it with real numbers. More than 100,000 projects have earned LEED. Only a few dozen buildings in the world have earned full Living Building certification. The Library is working to join them.',
  tech: 'The Living Building Challenge (LBC) is run by the International Living Future Institute (ILFI). Version 4.0 groups 20 imperatives into seven petals: Place, Water, Energy, Health + Happiness, Materials, Equity and Beauty. Full Living Certification requires every imperative, with no points or trade-offs, and is awarded only after at least 12 consecutive months of measured, occupied performance. Among the requirements: 105% of annual energy from renewables with no on-site combustion, all water needs met within the water balance of the place and treated without chlorine, avoidance of the Red List of hazardous chemicals, and reduced embodied carbon. ILFI reported its 35th certified Living Building in 2024. The Library is pursuing full Living Certification as a new building under LBC 4.0. Its water strategy uses an ILFI-approved pathway that recognizes Lake Sakakawea, its drinking-water source, and the site as one watershed. It also holds SITES and LEED Platinum precertification.',
  compare: [
    ['', 'LEED', 'Living Building Challenge'],
    ['How it works', 'Points. Platinum takes 80 of 110.', 'Pass or fail. All 20 rules.'],
    ['When it’s judged', 'Mostly on design and construction', 'After 12 months of real use'],
    ['How many', '100,000+ projects', '35+ full Living Buildings']
  ]
};

export const NOTE = 'Built from the Library’s construction drawings and design documents, with the building from the Library’s campus model and the land from USGS 3D Elevation Program lidar. Pipes, tanks and equipment are drawn in their planned locations, a little larger than life so they’re easy to see. Rock layers follow the badlands around Medora and are drawn to illustrate, not from site borings. The Library has earned SITES and LEED Platinum precertification and is pursuing Living Building Challenge certification.';

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
