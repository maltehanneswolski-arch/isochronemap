/* Isochronic Globe — model constants and hand-authored historical geography.
   Speeds are *effective* door-to-door averages in km per 24 h: they already
   include nights, rests, waits and changes. Era index: 0=1750 1=1850 2=1900
   3=1950 4=2026.

   Sources for the calibration are listed in the "How this is modelled" panel;
   the country road figures are the IMF Mean Speed score (Moszoro & Soto 2022). */

window.ISO = (function () {

  /* Eight plates. Evenly spaced on the axis rather than to scale, because the
     interesting century is the one in the middle; the axis carries a break
     mark where the jump in years is larger than the rest. */
  const ERAS = [
    { y: 1750, tag: 'Turnpike & packet' },
    { y: 1850, tag: 'Early steam' },
    { y: 1900, tag: 'Steel, steam & liner' },
    { y: 1925, tag: 'First airlines' },
    { y: 1950, tag: 'Propliner' },
    { y: 1975, tag: 'Jet age' },
    { y: 2000, tag: 'High-speed rail' },
    { y: 2026, tag: 'Today' }
  ];

  /* --- means of travel -------------------------------------------------
     land  = km covered per 24 h on par-quality roads
     duty  = hours of that day actually spent moving, so the real speed is
             land/duty km/h. A short hop runs at the full speed; only once
             you have been going longer than `duty` do nights and rests start
             to cost you. That is what keeps London-Edinburgh at seven hours
             and London-Peking at seven weeks in the same model.
     sea   = 'ship'  open-ocean passage available
             'ferry' scheduled ferry routes only                           */
  const MODES = [
    {
      id: 'best', name: 'Fastest route',
      vehicle: ['Coach, packet & river', 'Rail and steamship', 'Express rail & liner',
        'Air, rail, road and sea', 'Air, rail, road and sea', 'Air, rail, road and sea',
        'Air, rail, road and sea', 'Air, rail, road and sea'],
      icon: 'M4 19.5l4.6-8.2 3.4 3.1L20 4.5M20 4.5h-4.6M20 4.5v4.6M4.6 19.5h3',
      land: null, duty: [14, 16, 14, 14, 14, 14, 14, 14],
      since: 0, rail: true, sea: 'ship', air: true, best: true
    },
    {
      id: 'foot', name: 'On foot',
      vehicle: ['Turnpikes & towpaths', 'Turnpikes', 'Metalled roads', 'Metalled roads',
        'Sealed roads', 'Paved', 'Paved & mapped', 'Paved & mapped'],
      icon: 'M13 3.2a1.6 1.6 0 100.01 0M12.4 7l-3 2.2.9 4.1M10.3 13.3L8 20M10.3 13.3l3.4 2 1.3 4.7M12.4 7l3.3 1.1 2 3.4',
      land: [32, 34, 36, 37, 38, 39, 40, 40],
      duty: [8, 8, 8, 8, 8, 8, 8, 8], since: 0, sea: 'ferry'
    },
    {
      id: 'bike', name: 'By bicycle',
      vehicle: ['—', '—', 'Safety bicycle', 'Roadster', 'Roadster', 'Touring bicycle',
        'Touring bicycle', 'Touring bicycle'],
      icon: 'M6 16.5a3.2 3.2 0 100.01 0M18 16.5a3.2 3.2 0 100.01 0M6 16.5l3.6-6.2h5M14.2 6.8h2.3M18 16.5l-3.4-6.2M9.6 16.5h4.8',
      land: [0, 0, 80, 90, 105, 112, 118, 120],
      duty: [7, 7, 7, 7, 7, 7, 7, 7], since: 2, sea: 'ferry',
      why: ['The bicycle will not be invented for another century.',
        'The first pedal bicycles are still twenty years off.']
    },
    {
      id: 'road', name: 'By road',
      vehicle: ['Post-chaise & horse', 'Mail coach', 'Early motor car', 'Motor car',
        'Automobile', 'Car & trunk road', 'Car & motorway', 'Car & motorway'],
      icon: 'M4.5 14.5h15M6 14.5l1.6-4.2A1.6 1.6 0 019.1 9.2h5.8a1.6 1.6 0 011.5 1.1l1.6 4.2M7.5 17.6a1.5 1.5 0 100.01 0M16.5 17.6a1.5 1.5 0 100.01 0M4.5 14.5v2.2M19.5 14.5v2.2',
      land: [85, 240, 190, 300, 480, 700, 850, 900],
      duty: [12, 16, 12, 11, 11, 10, 10, 10], since: 0, sea: 'ferry'
    },
    {
      id: 'transit', name: 'Scheduled transport',
      vehicle: ['Stage coach, packet & river boat', 'Railway, steamer & coach',
        'Express train & ocean liner', 'Express train & liner', 'Rail, coach & ferry',
        'Rail, coach & ferry', 'High-speed rail & ferry', 'Rail, metro, coach & ferry'],
      icon: 'M7 4.5h10a1.6 1.6 0 011.6 1.6v8.3a1.6 1.6 0 01-1.6 1.6H7a1.6 1.6 0 01-1.6-1.6V6.1A1.6 1.6 0 017 4.5zM5.4 9.6h13.2M8.4 12.8h.01M15.6 12.8h.01M8 16v3.4M16 16v3.4',
      land: [60, 130, 200, 300, 450, 700, 950, 1000],   // the coach: 1000 km in a 14 h day is 71 km/h, a motorway express
      duty: [14, 16, 14, 14, 14, 14, 14, 14], since: 0, rail: true, sea: 'ship'
    },
    {
      id: 'air', name: 'By air',
      vehicle: ['—', '—', '—', 'Airliner', 'Propliner', 'Jet airliner', 'Jet airliner',
        'Jet airliner'],
      icon: 'M3.5 12.8l17-5.6-2.4 4.6 2.4 4.6-17-5.6zM8.6 11.1V6.4M8.6 14.5v4.7',
      land: [85, 240, 190, 300, 480, 700, 850, 900],
      duty: [12, 16, 12, 11, 11, 12, 12, 12], since: 3, air: true, rail: true, sea: 'ferry',
      why: ['Powered flight is a century and a half away.',
        'Balloons drift where the wind takes them; they cannot be steered.',
        'The Wright brothers will not leave the ground for three more years.']
    }
  ];

  /* --- era parameters ---------------------------------------------------
     Sea: 18th-c. Atlantic crossings ran 30-40 days eastbound and 50-70 west
     (Royal Museums Greenwich), so ~135 km/day made good — about 3 knots of
     net progress from a hull doing 5. Ships sail through the night, so their
     duty day is the full 24 h. Modern ships are barely faster than 1950:
     nobody crosses an ocean for speed any more. */
  /* Open-sea passage, km a day, along the track actually sailed. For the age
     of sail the figure is measured: 111 120 day-runs reconstructed from the
     CLIWOC logbook database (287 114 logbooks, Dutch, English, French and
     Spanish ships 1750-1855) give a median 205 km between one day's noon
     position and the next in the second half of the 18th century, rising to
     248 by the 1800s. Steam figures are from published passage times. */
  const WATER = [205, 360, 620, 660, 700, 700, 700, 700];
  /* A sailing ship does not go where it is pointed: it works the trades, and
     the Atlantic is crossed by going the long way round. Measured over 878
     CLIWOC passages of eight days or more, the track sailed is 1.56 times the
     straight line between where it started and where it ended. The grid
     routes near enough straight, so the day-run is divided by this. Steam
     holds a course, so it pays only the ordinary sea circuity. */
  const SAIL_CIRC = [1.56, 1.25, 1.06, 1.05, 1.05, 1.04, 1.04, 1.04];

  /* How much of today's measured road speed a given year gets. The friction
     surface says what each cell manages now; these carry it back, and they
     are the road mode's own km/h through the eras divided by its modern
     figure, so the shape of the series is unchanged and only its spatial
     detail comes from the measurement. MAP_W is how far to trust the
     measurement against the country-and-class estimate, cell by cell. */
  const MAP_ERA = [0.08, 0.17, 0.18, 0.30, 0.48, 0.78, 0.94, 1.0];
  const MAP_W = 0.75;
  /* Blending the friction surface in everywhere was tried and measured: it
     made both truth sets worse (2026 fell from 90% of pairs within a quarter
     to 85, ESPON's road matrix from 62% to 55), because the fastest pixel in
     a cell is an optimistic statistic and a least-cost path chains exactly
     those cells. Used only where nothing else maps a road it is neutral on
     both and fills 86 037 cells that had none. */
  const MAP_GAPS_ONLY = true;
  const WATER_SCHEDULED = [1.0, 1.25, 1.3, 1.3, 1.25, 1.1, 1.0, 1.0];
  const FERRY = [120, 250, 450, 540, 650, 800, 880, 900];
  const ICE_WATER = [6, 10, 26, 34, 60, 95, 120, 140];
  const RIVER = [110, 200, 260, 280, 300, 300, 300, 300];
  const PORT_H = [24, 14, 8, 7, 5, 4, 3, 3];      // hours lost boarding or landing
  /* Main-line rail, km a day. Trimmed 7% from the line-speed figures these
     started as: a service that calls at stations never makes the speed its
     track is signalled for, and the difference showed up as multi-leg
     journeys coming out a fifth too quick. */
  const RAIL = [0, 465, 885, 975, 1070, 1210, 1350, 1395];
  const HSR = [0, 0, 0, 0, 0, 2200, 2900, 3200];      // Shinkansen opens 1964
  const FERRY_PORT = 0.55;                      // a ferry berth costs less than an ocean sailing
  const SEA_DUTY = 24;

  /* Route circuity. The grid finds great-circle paths, but real roads wind, so
     land travel is divided by roughly how much further the real thing goes. */
  const ROAD_CIRC = 1.08, RAIL_CIRC = 1.04, RIVER_CIRC = 1.35;

  /* What is under you, from the Natural Earth road layer: 0 nothing mapped,
     1 track or minor road, 2 secondary, 3 major highway (the reference),
     4 motorway. NET_W dials the spread down in earlier eras, when a motorway
     alignment was at best a good post road. */
  const CLASS_MUL = [0.34, 0.55, 0.80, 1.00, 1.30];
  /* A cyclist cannot use a motorway and a walker gains nothing from one. */
  const BIKE_MUL = [0.35, 0.78, 1.00, 1.00, 0.92];
  const FOOT_MUL = [0.55, 0.90, 1.00, 1.00, 0.95];
  const RAIL_MAIN = 1.15, RAIL_BRANCH = 0.95;


  /* how strongly national road quality bites, by era: in 1750 the gap between
     the best and worst roads on Earth was real but narrower than it is today */
  const ROAD_EXP = [0.35, 0.6, 0.9, 1.05, 1.3, 1.45, 1.55, 1.6];
  const NET_W  = [0.45, 0.60, 0.75, 0.80, 0.90, 0.95, 0.98, 1.00];
  const ROAD_REF = 95;                          // mean-speed score treated as "par"

  const TERRAIN_MUL = [
    [1, 1, 1, 1, 1, 1, 1, 1],                                 // open country
    [.30, .34, .40, .46, .55, .63, .69, .72],                 // mountain
    [.42, .46, .55, .62, .72, .80, .85, .88],                 // desert
    [.30, .33, .38, .44, .52, .61, .67, .70],                 // rainforest & swamp
    [.45, .48, .55, .61, .70, .78, .83, .86],                 // taiga & tundra
    [.10, .11, .13, .16, .20, .25, .29, .32]                  // ice sheet
  ];

  /* Constellation cruise 489 km/h; the 1950 Kangaroo route ran London-Sydney
     in ~58 h over 7 stops, which these numbers reproduce. */
  /* Charter, not timetable. This answers "how fast could you physically get
     there if money were no object", so the limits are the aircraft's, not an
     airline's schedule: a Lockheed Constellation cruised 489 km/h with about
     6 400 km of range; a Bombardier Global 7500 does 7 700 nm (14 260 km) and
     a Gulfstream G650ER 7 500 nm at Mach 0.85. `stop` is a refuelling turn,
     not a scheduled connection. */
  const AIR = {
    3: { cruise: 200, range: 900,   board: 1.5,  land: 1.0,  stop: 2.0 },   // 1925 airliner: few formalities
    4: { cruise: 489, range: 6400,  board: 2.0,  land: 1.25, stop: 1.5 },   // Constellation
    5: { cruise: 860, range: 10500, board: 1.75, land: 1.0,  stop: 1.0 },   // 707 / 747
    6: { cruise: 880, range: 13000, board: 1.5,  land: 0.9,  stop: 0.85 },
    7: { cruise: 900, range: 14260, board: 1.25, land: 0.75, stop: 0.75 }   // Global 7500
  };
  const AIR_RANK = { 3: 4, 4: 5, 5: 6, 6: 8, 7: 9 };
  /* which airfields an era can use: Natural Earth scalerank, lower = bigger */

  /* Modern service quality (the third field of COUNTRY_RAW) is fitted to the
     measured journeys: each country's median residual over the pairs in the
     check set, applied as a speed multiplier. That is what the field is for,
     and a guess is no better than a fit when there are 269 real journeys.

     Railway service quality in the steam and early-diesel era, where it
     differed sharply from today. The United States ran the finest passenger
     network on Earth in 1900 — the transcontinental took four and a half days
     — and one of the thinnest in 2026. Argentina, Cuba and Myanmar tell the
     same story. Countries not listed here kept roughly their modern standing. */
  const RAIL_HIST = {
    'United States of America': .85, 'Canada': .60, 'United Kingdom': 1.0, 'Argentina': .70,
    'Mexico': .45, 'Cuba': .55, 'Brazil': .35, 'India': .75, 'Uruguay': .45, 'Chile': .50,
    'Peru': .30, 'Bolivia': .30, 'New Zealand': .55, 'Australia': .55, 'South Africa': .70,
    'Zimbabwe': .45, 'Kenya': .45, 'Nigeria': .40, 'Ghana': .30, 'Senegal': .30, 'Sudan': .35,
    'Myanmar': .45, 'Philippines': .35, 'Indonesia': .45, 'Vietnam': .45, 'Sri Lanka': .50,
    'Egypt': .65, 'Iraq': .35, 'Syria': .30, 'Lebanon': .30, 'Jordan': .25, 'Turkey': .55,
    'Greece': .55, 'Portugal': .75, 'Spain': .75, 'Italy': .80, 'France': .90, 'Germany': .95,
    'Poland': .85, 'Czechia': .90, 'Hungary': .85, 'Romania': .70, 'Bulgaria': .65,
    'Russia': .75, 'Ukraine': .75, 'Dem. Rep. Congo': .30, 'Angola': .45, 'Mozambique': .45,
    'Zambia': .40, 'Tanzania': .40, 'Algeria': .55, 'Tunisia': .55, 'Morocco': .55,
    'Namibia': .40, 'Botswana': .35, 'Malawi': .30, 'Madagascar': .25, 'Cameroon': .30,
    "Côte d'Ivoire": .30, 'Mali': .25, 'Burkina Faso': .25, 'Benin': .20, 'Togo': .20,
    'Guinea': .20, 'Eritrea': .30, 'Ethiopia': .25, 'Congo': .25, 'Latvia': .60, 'Estonia': .55
  };

  /* --- scheduled ferry routes -------------------------------------------
     The only water the land modes may touch. Ferries cross straits; they do
     not cross oceans, which is why an ocean is simply out of reach on foot,
     by bicycle or by car. Every route below is one that has actually run. */
  const FERRY_ROUTES = [
    [[1.35, 51.05], [1.85, 51.0]],                                   // Dover–Calais
    [[-4.6, 53.3], [-6.1, 53.34]],                                   // Holyhead–Dublin
    [[-5.1, 54.9], [-5.75, 54.7]],                                   // Stranraer–Belfast
    [[1.3, 51.95], [4.1, 52.0]],                                     // Harwich–Hook of Holland
    [[-1.4, 50.6], [-1.5, 49.7], [-1.6, 49.65]],                     // Portsmouth–Cherbourg
    [[-6.5, 62.0], [-10.0, 63.0], [-14.0, 64.4]],                    // Faroes–Iceland
    [[8.5, 57.5], [3.0, 61.0], [-6.5, 62.0]],                        // Denmark–Faroes
    [[-5.45, 36.05], [-5.6, 35.85]],                                 // Algeciras–Tangier
    [[12.45, 37.75], [11.5, 37.4], [10.9, 37.2]],                    // Sicily–Tunis
    [[15.55, 38.25], [15.65, 38.15]],                                // Messina
    [[9.85, 43.9], [9.5, 43.0], [9.4, 41.4], [9.2, 41.2]],           // Italy–Corsica–Sardinia
    [[16.9, 41.1], [19.4, 41.3]],                                    // Bari–Durrës
    [[23.7, 37.9], [25.5, 37.5], [27.1, 38.4]],                      // Piraeus–Aegean–Izmir
    [[23.7, 37.5], [24.5, 35.9]],                                    // Crete
    [[14.5, 36.85], [14.5, 35.95]],                                  // Malta
    [[33.5, 35.3], [33.9, 36.2]],                                    // Cyprus–Anatolia
    [[29.0, 41.2], [29.1, 41.0]], [[26.4, 40.3], [26.6, 40.2]],      // Bosphorus, Dardanelles
    [[12.6, 55.9], [12.9, 55.6]], [[10.8, 55.35], [11.3, 55.35]],    // Øresund, Great Belt
    [[11.15, 54.65], [11.4, 54.5]], [[13.1, 55.3], [12.1, 54.2]],    // Fehmarn, Trelleborg–Rostock
    [[18.6, 59.4], [20.5, 60.1], [22.2, 60.4]],                      // Stockholm–Åland–Turku
    [[24.75, 59.5], [24.95, 60.1]], [[10.6, 57.6], [10.7, 58.9]],    // Tallinn–Helsinki, Jutland–Norway
    [[43.4, 12.7], [43.2, 12.5]], [[56.4, 26.8], [56.2, 26.3]],      // Bab-el-Mandeb, Hormuz
    [[79.9, 9.3], [79.8, 9.6]],                                      // Palk Strait
    [[103.8, 1.2], [103.4, 1.0], [103.0, 1.1]],                      // Singapore–Sumatra
    [[105.9, -5.85], [105.7, -6.05]],                                // Sunda
    [[114.4, -8.2], [114.6, -8.4]], [[115.7, -8.7], [116.0, -8.7]],  // Bali, Lombok
    [[117.5, -8.5], [118.5, -8.5]], [[119.5, -8.6], [120.2, -8.6]],  // Sumbawa, Flores
    [[122.3, -8.5], [123.0, -8.5]], [[110.5, -5.5], [110.7, -3.6]],  // Alor, Java–Borneo
    [[117.8, -1.0], [119.4, -1.0]],                                  // Borneo–Sulawesi
    [[120.9, 14.0], [121.0, 13.4], [121.2, 12.5], [122.0, 11.5], [123.5, 10.5], [124.5, 9.5], [125.3, 8.5]],
    [[119.0, 24.6], [120.0, 24.4]],                                  // Taiwan Strait
    [[129.1, 35.0], [130.0, 34.0], [130.4, 33.7]],                   // Busan–Fukuoka
    [[140.5, 41.7], [140.7, 41.4]], [[130.9, 34.0], [131.0, 33.9]],  // Tsugaru, Kanmon
    [[141.8, 46.6], [142.0, 45.4]],                                  // Sakhalin
    [[146.4, -39.0], [146.5, -40.5]], [[174.8, -41.2], [174.4, -41.5]], // Bass, Cook
    [[142.6, -9.8], [142.4, -10.5]],                                 // Torres Strait
    [[-60.4, 46.1], [-59.2, 47.6]], [[-123.3, 49.0], [-123.9, 48.8]],// Newfoundland, Vancouver I.
    [[-61.5, 10.7], [-61.4, 11.3], [-61.2, 12.1], [-61.4, 13.2], [-61.0, 14.0], [-61.0, 15.0],
      [-61.3, 16.0], [-61.5, 17.0], [-62.5, 17.5], [-64.0, 18.2], [-65.5, 18.3]],
    [[-80.4, 24.8], [-81.5, 23.3]], [[-84.9, 21.9], [-86.8, 21.5]],  // Florida–Cuba, Cuba–Yucatán
    [[-70.4, -53.2], [-70.2, -53.7]],                                // Magellan
    [[39.3, -6.2], [39.5, -6.2]]                                     // Zanzibar
  ];

  /* --- per-country transport profile -----------------------------------
     [name, ms, rq, ry, hy]
       ms = IMF Mean Speed score, km/h (Moszoro & Soto 2022); estimated where
            the paper has no entry
       rq = railway service quality, 0 (no railway at all) to 1
       ry = year the first railway opened; 9999 = never
       hy = year high-speed rail opened; 9999 = none                        */
  const COUNTRY_RAW = [
    ['Afghanistan', 57, .05, 1982, 9999], ['Albania', 65, .15, 1947, 9999], ['Algeria', 88, .50, 1862, 9999],
    ['Angola', 78, .30, 1889, 9999], ['Antarctica', 20, 0, 9999, 9999], ['Argentina', 91, .40, 1857, 9999],
    ['Armenia', 57, .30, 1895, 9999], ['Australia', 96, 0.38, 1854, 9999], ['Austria', 96, 0.733, 1838, 2012],
    ['Azerbaijan', 80, .45, 1880, 9999], ['Bahamas', 70, 0, 9999, 9999], ['Bangladesh', 41, .45, 1862, 9999],
    ['Belarus', 85, .70, 1862, 9999], ['Belgium', 92, 0.801, 1835, 1997], ['Belize', 67, 0, 9999, 9999],
    ['Benin', 63, .10, 1900, 9999], ['Bhutan', 38, 0, 9999, 9999], ['Bolivia', 50, .20, 1892, 9999],
    ['Bosnia and Herz.', 57, .40, 1872, 9999], ['Botswana', 91, .30, 1897, 9999], ['Brazil', 72, .25, 1854, 9999],
    ['Brunei', 88, 0, 9999, 9999], ['Bulgaria', 88, 0.4, 1866, 9999], ['Burkina Faso', 63, .15, 1954, 9999],
    ['Burundi', 51, 0, 9999, 9999], ['Cambodia', 55, .10, 1932, 9999], ['Cameroon', 56, .25, 1911, 9999],
    ['Canada', 106, 0.283, 1836, 9999], ['Central African Rep.', 61, 0, 9999, 9999], ['Chad', 63, 0, 9999, 9999],
    ['Chile', 92, .35, 1851, 9999], ['China', 90, 1.03, 1876, 2008], ['Colombia', 57, .10, 1871, 9999],
    ['Congo', 63, .15, 1934, 9999], ['Costa Rica', 55, .15, 1890, 9999], ['Croatia', 98, 0.5, 1862, 9999],
    ['Cuba', 78, .40, 1837, 9999], ['Cyprus', 76, 0, 9999, 9999], ['Czechia', 98, 0.662, 1839, 9999],
    ["Côte d'Ivoire", 62, .20, 1904, 9999], ['Dem. Rep. Congo', 62, .10, 1898, 9999], ['Denmark', 78, 0.859, 1847, 9999],
    ['Djibouti', 69, .20, 1917, 9999], ['Dominican Rep.', 74, .05, 1887, 9999], ['Ecuador', 60, .05, 1873, 9999],
    ['Egypt', 83, .60, 1854, 9999], ['El Salvador', 56, .02, 1882, 9999], ['Eq. Guinea', 74, 0, 9999, 9999],
    ['Eritrea', 62, .05, 1887, 9999], ['Estonia', 81, .50, 1870, 9999], ['Ethiopia', 61, .20, 1917, 9999],
    ['Falkland Is.', 45, 0, 9999, 9999], ['Fiji', 60, 0, 9999, 9999], ['Finland', 83, .75, 1862, 9999],
    ['Fr. S. Antarctic Lands', 20, 0, 9999, 9999], ['France', 105, 0.935, 1837, 1981], ['Gabon', 60, .20, 1986, 9999],
    ['Gambia', 53, 0, 9999, 9999], ['Georgia', 64, .40, 1872, 9999], ['Germany', 97, 0.855, 1835, 1991],
    ['Ghana', 56, .15, 1898, 9999], ['Greece', 93, .50, 1869, 9999], ['Greenland', 35, 0, 9999, 9999],
    ['Guatemala', 53, .02, 1884, 9999], ['Guinea', 50, .10, 1904, 9999], ['Guinea-Bissau', 60, 0, 9999, 9999],
    ['Guyana', 59, .02, 1848, 9999], ['Haiti', 41, 0, 9999, 9999], ['Honduras', 56, .02, 1870, 9999],
    ['Hungary', 96, 0.7, 1846, 9999], ['Iceland', 77, 0, 9999, 9999], ['India', 58, 0.943, 1853, 9999],
    ['Indonesia', 55, 0.7, 1867, 2023], ['Iran', 94, .50, 1888, 9999], ['Iraq', 79, .20, 1914, 9999],
    ['Ireland', 88, .65, 1834, 9999], ['Israel', 84, .70, 1892, 9999], ['Italy', 95, 0.856, 1839, 1988],
    ['Jamaica', 61, .02, 1845, 9999], ['Japan', 81, 1.0, 1872, 1964], ['Jordan', 77, .10, 1904, 9999],
    ['Kazakhstan', 72, .55, 1901, 9999], ['Kenya', 57, 0.5, 1896, 9999], ['Kosovo', 65, .35, 1874, 9999],
    ['Kuwait', 85, 0, 9999, 9999], ['Kyrgyzstan', 61, .15, 1924, 9999], ['Laos', 60, .20, 2009, 9999],
    ['Latvia', 77, .55, 1861, 9999], ['Lebanon', 60, 0, 9999, 9999], ['Lesotho', 60, .05, 1905, 9999],
    ['Liberia', 66, .05, 1951, 9999], ['Libya', 90, 0, 9999, 9999], ['Lithuania', 89, .60, 1860, 9999],
    ['Luxembourg', 92, .90, 1859, 9999], ['Macedonia', 74, 0.32, 1873, 9999], ['Madagascar', 51, .10, 1909, 9999],
    ['Malawi', 75, .20, 1908, 9999], ['Malaysia', 92, .50, 1885, 9999], ['Mali', 72, .10, 1904, 9999],
    ['Mauritania', 77, .10, 1963, 9999], ['Mexico', 90, .20, 1850, 9999], ['Moldova', 67, .45, 1871, 9999],
    ['Mongolia', 56, .30, 1938, 9999], ['Montenegro', 59, .40, 1908, 9999], ['Morocco', 95, .65, 1911, 2018],
    ['Mozambique', 78, .30, 1895, 9999], ['Myanmar', 71, .30, 1877, 9999], ['N. Cyprus', 76, 0, 9999, 9999],
    ['Namibia', 99, .30, 1897, 9999], ['Nepal', 40, .02, 1927, 9999], ['Netherlands', 87, .95, 1839, 2009],
    ['New Caledonia', 65, 0, 9999, 9999], ['New Zealand', 83, .40, 1863, 9999], ['Nicaragua', 46, 0, 9999, 9999],
    ['Niger', 69, .02, 2014, 9999], ['Nigeria', 55, .25, 1898, 9999], ['North Korea', 55, .40, 1899, 9999],
    ['Norway', 73, .70, 1854, 9999], ['Oman', 102, .05, 9999, 9999], ['Pakistan', 86, .45, 1861, 9999],
    ['Palestine', 60, 0, 9999, 9999], ['Panama', 72, .10, 1855, 9999], ['Papua New Guinea', 59, 0, 9999, 9999],
    ['Paraguay', 67, .02, 1861, 9999], ['Peru', 62, .15, 1851, 9999], ['Philippines', 52, .05, 1892, 9999],
    ['Poland', 92, 0.704, 1842, 2014], ['Portugal', 106, 0.7, 1856, 9999], ['Puerto Rico', 78, .05, 1891, 9999],
    ['Qatar', 82, .20, 2019, 9999], ['Romania', 73, 0.4, 1854, 9999], ['Russia', 76, .70, 1837, 2009],
    ['Rwanda', 47, 0, 9999, 9999], ['S. Sudan', 59, .05, 1962, 9999], ['Saudi Arabia', 106, 0.6, 1951, 2018],
    ['Senegal', 71, .15, 1885, 9999], ['Serbia', 94, 0.32, 1884, 9999], ['Sierra Leone', 64, .02, 1896, 9999],
    ['Slovakia', 93, 0.65, 1840, 9999], ['Slovenia', 90, 0.55, 1846, 9999], ['Solomon Is.', 45, 0, 9999, 9999],
    ['Somalia', 58, 0, 9999, 9999], ['Somaliland', 58, 0, 9999, 9999], ['South Africa', 100, .60, 1860, 9999],
    ['South Korea', 93, 0.96, 1899, 2004], ['Spain', 103, 0.749, 1848, 1992], ['Sri Lanka', 50, .40, 1864, 9999],
    ['Sudan', 72, .15, 1875, 9999], ['Suriname', 65, .02, 1903, 9999], ['Sweden', 94, .80, 1856, 1990],
    ['Switzerland', 87, 0.85, 1847, 2007], ['Syria', 72, .10, 1895, 9999], ['Taiwan', 91, .85, 1891, 2007],
    ['Tajikistan', 52, .20, 1929, 9999], ['Tanzania', 57, .30, 1893, 9999], ['Thailand', 77, 0.65, 1893, 9999],
    ['Timor-Leste', 40, 0, 9999, 9999], ['Togo', 63, .10, 1905, 9999], ['Trinidad and Tobago', 51, 0, 9999, 9999],
    ['Tunisia', 78, .50, 1872, 9999], ['Turkey', 93, .60, 1860, 2009], ['Turkmenistan', 79, .40, 1888, 9999],
    ['Uganda', 64, .15, 1901, 9999], ['Ukraine', 75, 0.8, 1861, 9999], ['United Arab Emirates', 80, .30, 2016, 9999],
    ['United Kingdom', 87, 0.951, 1825, 2003], ['United States of America', 107, 0.316, 1830, 2000],
    ['Uruguay', 82, .25, 1869, 9999], ['Uzbekistan', 71, .55, 1888, 2011], ['Vanuatu', 45, 0, 9999, 9999],
    ['Venezuela', 83, .10, 1877, 9999], ['Vietnam', 51, .35, 1885, 9999], ['W. Sahara', 80, 0, 9999, 9999],
    ['Yemen', 55, 0, 9999, 9999], ['Zambia', 73, .30, 1905, 9999], ['Zimbabwe', 83, .35, 1897, 9999],
    ['eSwatini', 69, .20, 1964, 9999]
  ];

  /* --- rainforest & swamp -----------------------------------------------
     Mountain, desert and tundra now come from Natural Earth's 10m geography
     regions (222 named ranges, 58 deserts). Rainforest is not a class in that
     set, so the great forest basins stay hand-drawn: [lonC, latC, radLon, radLat] */
  const RAINFOREST = [
    [-62, -4, 14, 9], [22, 0, 12, 6], [-5, 6, 14, 3], [103, 10, 9, 9],
    [114, 0, 6, 5], [140, -5, 9, 4], [-85, 12, 6, 4]
  ];

  /* --- straits forced open (narrower than one grid cell) --------------- */
  const STRAITS = [
    [1.5, 50.9], [1.9, 51.1], [-5.4, 55.1], [-5.6, 35.95], [15.6, 38.2],
    [29.0, 41.15], [28.9, 40.9], [26.4, 40.2], [36.5, 45.3],
    [12.7, 55.9], [10.9, 55.6], [11.0, 56.5],
    [43.3, 12.6], [56.3, 26.6], [79.9, 9.5],
    [100.4, 2.0], [101.5, 2.8], [103.4, 1.2], [105.8, -6.0],
    [119.5, 24.5], [129.4, 34.3], [140.5, 41.6],
    [-169.0, 65.8], [174.4, -41.3], [146.0, -39.8], [142.5, -10.1],
    [-80.6, 24.5], [-86.0, 21.5], [-70.5, -53.5], [-61.5, 10.9]
  ];


  /* --- fixed links: water that becomes land when the bridge opens ------ */
  /* --- runways and skiways in Antarctica -------------------------------
     Natural Earth's airport set stops at 55 S, so the continent had nowhere
     to land and could only be reached by ship. These are the fields that
     actually take an aircraft, with the year each opened; before 1956 there
     is still nothing, which is right. Blue-ice and compacted-snow strips
     take wheeled aircraft, the skiways only ski-equipped ones. */
  const ANTARCTIC_AIR = [
    { n: 'Williams Field, McMurdo',   lon: 167.06, lat: -77.87, y: 1956 },
    { n: 'Amundsen-Scott South Pole', lon: 0,      lat: -89.99, y: 1956 },
    { n: 'Marambio',                  lon: -56.63, lat: -64.24, y: 1969 },
    { n: 'Teniente Marsh',            lon: -58.99, lat: -62.19, y: 1980 },
    { n: 'Rothera',                   lon: -68.13, lat: -67.57, y: 1991 },
    { n: 'Novolazarevskaya',          lon: 11.60,  lat: -70.83, y: 2001 },
    { n: 'Troll',                     lon: 2.53,   lat: -72.01, y: 2005 },
    { n: 'Wilkins, Casey',            lon: 111.48, lat: -66.69, y: 2008 },
    { n: 'Union Glacier',             lon: -83.32, lat: -79.78, y: 2010 },
    { n: 'Phoenix, McMurdo',          lon: 166.75, lat: -77.95, y: 2016 }
  ];

  /* Drawn portal to portal. The Channel Tunnel used to run from [1.5,50.9] to
     [1.9,51.1], which is a line parallel to the French coast in open water:
     it bridged one of the four sea cells between Folkestone and Coquelles and
     every train to London went by ferry. Links marked rail carry the trunk
     network across, so a train uses them at line speed. */
  const FIXED_LINKS = [
    { name: 'Channel Tunnel', year: 1994, rail: 1, wait: 0.6, pts: [[1.17, 51.10], [1.81, 50.92]] },   // check-in and passports
    { name: 'Great Belt', year: 1997, rail: 1, pts: [[10.75, 55.31], [11.15, 55.35]] },
    { name: 'Øresund', year: 2000, rail: 1, pts: [[12.62, 55.64], [13.00, 55.58]] },
    { name: 'Bosphorus bridges', year: 1973, pts: [[28.98, 41.05], [29.06, 41.05]] },
    { name: 'Kanmon Tunnel', year: 1942, rail: 1, pts: [[130.90, 33.94], [130.98, 33.96]] },
    { name: 'Seikan Tunnel', year: 1988, rail: 1, pts: [[140.35, 41.25], [140.35, 41.72]] },
    { name: 'King Fahd Causeway', year: 1986, pts: [[50.10, 26.20], [50.50, 26.22]] }
  ];

  /* Getting to the station, buying the ticket, waiting for the train: paid
     once, on boarding the first train of a journey, and a little again on
     alighting. Hours. */
  const RAIL_BOARD = [0, 1.0, 0.75, 0.6, 0.6, 0.5, 0.5, 0.5];
  const RAIL_ALIGHT = 0.15;
  /* What a scheduled journey costs before it has gone anywhere: getting to
     the stop and waiting for a departure, and leaving the station at the far
     end. Charged once at the origin for scheduled transport, whatever the
     first vehicle is. It used to be charged only on joining the railway,
     which let the solver put short hops on a coach and pay nothing at all to
     wait for it - Brussels to Antwerp came out at 0.67 h against a real 1.17.
     The fastest-route mode does not pay it, because a private car really
     does leave when you do. */
  const TRANSIT_ACCESS = [0, 2.0, 1.2, 0.95, 0.85, 0.7, 0.65, 0.6];
  /* crossing a frontier by rail: customs and a change of carriage in 1850,
     passports until the 1970s, today mostly a change of train or operator */
  const RAIL_BORDER = [0, 1.0, 0.75, 0.75, 0.75, 0.5, 0.4, 0.4];
  /* Changing trains. The model used to charge only for boarding the first one
     and for a frontier, so it happily invented a through working where none
     runs: Brussels to Vienna came out at 8 h against a real 11.2 over four
     trains and three changes, one of them a regional service. A journey
     breaks where the high-speed corridor does, so leaving one costs a wait
     for whatever comes next. */
  const RAIL_CHANGE = [0, 1.0, 0.8, 0.7, 0.6, 0.5, 0.45, 0.45];
  /* What a scheduled service makes of the track it runs on. The high-speed
     layer carries line speed from OSM's maxspeed; a train that calls at
     stations never makes that over a whole corridor. */
  /* The service discount now lives in build-grid.js, applied to OpenStreetMap
     line speeds only, so the hand corridors keep the end-to-end timings they
     were measured from. Left here as a global trim, normally 1. */
  const HSR_SERVICE = 1.0;

  /* --- water that the coarse grid would otherwise close up -------------
     The Bering Strait is 82 km wide and rasterises shut, land-bridging Asia
     to America. This cut runs between Cape Dezhnev and Cape Prince of Wales
     and carries no ferry, so no one drives from Moscow to Anchorage. */
  const WATER_CUTS = [
    [[-170.5, 67.2], [-169.2, 66.0], [-167.5, 64.5]]
  ];

  /* --- isthmuses: land until the canal opens --------------------------- */
  const CANALS = [
    { name: 'Suez Canal', year: 1869, pts: [[32.35, 31.2], [32.35, 30.6], [32.3, 30.0], [32.55, 29.5], [32.55, 29.0]] },
    { name: 'Panama Canal', year: 1914, pts: [[-79.9, 9.35], [-79.75, 9.1], [-79.6, 8.95], [-79.5, 8.9]] },
    { name: 'Kiel Canal', year: 1895, pts: [[9.1, 54.4], [9.8, 54.35], [10.15, 54.35]] },
    { name: 'Volga–Don Canal', year: 1952, pts: [[44.5, 48.5], [43.5, 48.6], [42.5, 48.3]] }
  ];

  /* --- navigable rivers ------------------------------------------------ */
  const RIVERS = [
    [[-90, 29.2], [-91, 31], [-91, 35], [-90.2, 38.6], [-90.5, 41.5], [-93, 44.9]],
    [[-89, 37], [-85, 38], [-81.6, 39.9]],
    [[-90.2, 38.6], [-95, 39], [-100, 42], [-104, 47]],
    [[-66, 49], [-71, 47], [-74, 45], [-76.5, 44.2], [-79.3, 43.3], [-82.4, 42.9], [-84.5, 45.8], [-87, 46.5], [-90, 46.8]],
    [[-50, -0.5], [-55, -2], [-60, -3.1], [-65, -4], [-70, -4.2], [-73, -6]],
    [[-58.4, -34.6], [-58.3, -32], [-59, -29], [-57.6, -25.6], [-55, -24]],
    [[31.2, 31.2], [31, 27], [32.9, 24], [32.5, 19], [32.5, 15.6], [31.5, 12], [30.5, 9]],
    [[12.4, -6], [15.3, -4.3], [18, -3], [21, -2], [25, -1], [25.2, 0.5]],
    [[6.8, 4.5], [6.5, 8], [4.2, 11], [0, 13], [-3, 16.8], [-5.3, 14.9], [-8, 13.5]],
    [[4.1, 52], [6.9, 51], [8.3, 50], [8.4, 49], [7.6, 47.6]],
    [[29.6, 45.2], [26, 44], [22, 44.6], [19, 45], [17, 45.5], [16.4, 48.2], [13.4, 48.5]],
    [[48, 46.3], [47.5, 49], [45.5, 51], [44.5, 54], [48.4, 56.3], [47.2, 58], [43, 58.7]],
    [[90.4, 23], [88.4, 24.5], [86, 25.4], [83, 25.3], [80, 26], [78, 26.8]],
    [[67.3, 24.3], [68.5, 26.5], [70, 28], [71.5, 30], [73, 32], [74, 34]],
    [[121.5, 31.4], [118, 32], [114.3, 30.6], [110, 30.8], [106.5, 29.6], [104, 28.8]],
    [[106.2, 10.3], [105.5, 12], [104.9, 14], [103, 17], [101, 19]],
    [[48, 30], [47, 31], [45, 32], [43, 34], [40, 35.5]],
    [[68.5, 66.5], [72, 62], [74, 58], [76.5, 55], [79, 54], [85, 52]],
    [[82, 71], [84, 68], [87, 65], [90, 62], [92, 58], [93, 56]],
    [[126, 72], [128, 68], [129, 64], [127, 60], [124, 57]],
    [[139, -35.5], [142, -34.2], [145, -35.5], [148, -36]]
  ];

  /* --- railway trunk corridors, with the year they were completed ------ */
  const RAIL_LINES = [
    // North America
    { y: 1855, p: [[-79.9, 9.35], [-79.5, 8.95]] },                                   // Panama Railroad
    { y: 1869, p: [[-87.6, 41.9], [-95.9, 41.3], [-104.8, 41.1], [-111.9, 41.2], [-119, 39.5], [-121.5, 38.6], [-122.4, 37.8]] },
    { y: 1883, p: [[-90.2, 38.6], [-97.3, 37.7], [-106.6, 35.1], [-112.1, 35.2], [-118.2, 34.1]] },
    { y: 1886, p: [[-79.4, 43.7], [-89.3, 48.4], [-97.1, 49.9], [-104.6, 50.4], [-114.1, 51.0], [-123.1, 49.3]] },
    { y: 1884, p: [[-99.1, 19.4], [-101.7, 21.1], [-104.7, 24.0], [-106.4, 28.6], [-106.5, 31.7]] },
    { y: 1923, p: [[-149.9, 61.2], [-149.1, 63.5], [-147.7, 64.8]] },
    // South America
    { y: 1877, p: [[-46.6, -23.5], [-44.3, -22.9], [-43.2, -22.9]] },
    { y: 1893, p: [[-77.0, -12.0], [-76.3, -11.8], [-75.5, -11.2]] },
    { y: 1910, p: [[-70.7, -33.5], [-68.9, -32.9], [-64.2, -31.4], [-60.7, -31.6], [-58.4, -34.6]] },
    { y: 1892, p: [[-68.1, -16.5], [-66.2, -17.4], [-65.8, -19.0], [-64.7, -21.5]] },
    // Europe & Russia
    { y: 1889, p: [[2.35, 48.9], [8.7, 47.8], [11.6, 48.1], [16.4, 48.2], [19.0, 47.5], [21, 45.8], [26.1, 44.4], [29.0, 41.0]] },
    { y: 1904, p: [[37.6, 55.8], [44, 56.3], [50.2, 53.2], [60.6, 56.8], [65.5, 55.2], [73.4, 55.0], [82.9, 55.0], [92.9, 56.0], [104.3, 52.3], [113.5, 52.0], [117.5, 50.4], [127.5, 50.3], [135.1, 48.5], [131.9, 43.1]] },
    { y: 1906, p: [[53, 39.9], [58.4, 37.9], [64.4, 39.8], [69.2, 41.3], [76.9, 43.3]] },
    { y: 1931, p: [[76.9, 43.3], [80.3, 50.4], [82.9, 55.0]] },                       // Turksib
    { y: 1916, p: [[30.3, 59.9], [33.1, 63.1], [34.3, 66.0], [33.1, 68.9]] },         // Murmansk
    // Africa
    { y: 1905, p: [[18.4, -33.9], [24, -30], [28.0, -26.2], [27.9, -20.2], [28.3, -15.4], [31.1, -17.8]] },
    { y: 1900, p: [[34.8, -19.8], [32.6, -19.0], [31.1, -17.8]] },                    // Beira corridor
    { y: 1931, p: [[13.5, -12.6], [16.9, -11.8], [21.3, -10.7], [25.5, -11.7], [27.5, -12.8]] }, // Benguela
    { y: 1975, p: [[39.3, -6.8], [35.8, -9.3], [32.6, -13.9]] },                      // Tazara
    { y: 1931, p: [[39.7, -4.0], [36.8, -1.3], [34.8, 0.3], [32.6, 0.3]] },           // Uganda Railway
    { y: 1917, p: [[43.1, 11.6], [41.9, 10.0], [38.8, 9.0]] },                        // Djibouti–Addis
    { y: 1912, p: [[3.4, 6.5], [4.5, 8.5], [6.0, 10.5], [8.5, 12.0]] },               // Lagos–Kano
    { y: 1923, p: [[-17.4, 14.7], [-14.0, 14.3], [-10.0, 13.9], [-8.0, 12.6]] },      // Dakar–Bamako
    { y: 1954, p: [[-4.0, 5.3], [-4.7, 8.0], [-3.5, 10.5], [-1.5, 12.4]] },           // Abidjan–Ouagadougou
    { y: 1875, p: [[32.5, 15.6], [32.7, 18.6], [33.9, 19.6], [37.2, 19.6]] },         // Sudan
    { y: 1911, p: [[-5.8, 35.8], [-6.8, 34.0], [-7.6, 33.6], [-7.9, 31.6]] },         // Morocco
    { y: 1986, p: [[9.4, -0.7], [11.5, -0.5], [13.2, 0.5]] },                         // Trans-Gabon
    // Asia
    { y: 1908, p: [[36.3, 33.5], [36.1, 32.5], [35.9, 31.2], [38.0, 26.4], [39.6, 24.5]] }, // Hejaz
    { y: 1940, p: [[29.0, 41.0], [32.9, 39.9], [37, 37.5], [41, 36.8], [44.4, 33.3]] },
    { y: 1903, p: [[116.4, 39.9], [121.6, 38.9], [123.4, 41.8], [125.3, 43.9], [126.6, 45.8], [130.9, 45.3]] },
    { y: 1936, p: [[116.4, 39.9], [114, 36], [113.7, 34.8], [112.5, 31], [113.3, 28.2], [113.3, 23.1]] },
    { y: 1950, p: [[104.07, 30.57], [108.9, 34.3], [112.5, 34.8], [116.4, 39.9]] },
    { y: 1923, p: [[100.5, 13.8], [100.3, 8.0], [100.9, 5.4], [101.7, 3.1], [103.8, 1.35]] },
    { y: 1885, p: [[105.8, 21.0], [106.0, 18.7], [107.6, 16.5], [109.2, 13.8], [106.6, 10.8]] },
    { y: 1877, p: [[96.2, 16.9], [95.9, 19.7], [96.1, 21.9]] },
    { y: 1901, p: [[76.9, 43.3], [71.4, 42.9], [69.2, 41.3], [64.4, 39.8]] },
    { y: 1938, p: [[106.9, 47.9], [110.0, 46.0], [111.9, 43.7], [116.4, 39.9]] },     // Trans-Mongolian
    // Oceania
    { y: 1917, p: [[115.9, -32.0], [121.5, -30.8], [129, -31.5], [135.9, -31.0], [138.6, -34.9], [144.9, -37.8], [151.2, -33.9]] },
    { y: 1929, p: [[151.2, -33.9], [153.0, -27.5], [146.8, -19.3]] },
    { y: 1908, p: [[174.8, -36.9], [175.3, -38.0], [175.6, -39.5], [174.8, -41.3]] }
  ];

  /* --- high-speed rail -------------------------------------------------- */

  /* --- cities: [name, lon, lat, rank, airEraIndex|0] -------------------
     rank 0 = always labelled, 1 = labelled when zoomed, 2 = dot only     */
  const CITY_RAW = [
    ['London', -0.13, 51.51, 0, 3], ['Paris', 2.35, 48.86, 0, 3], ['Berlin', 13.40, 52.52, 1, 3],
    ['Madrid', -3.70, 40.42, 1, 3], ['Rome', 12.50, 41.90, 1, 3], ['Lisbon', -9.14, 38.72, 1, 3],
    ['Amsterdam', 4.90, 52.37, 1, 3], ['Vienna', 16.37, 48.21, 1, 3], ['Stockholm', 18.07, 59.33, 1, 3],
    ['Oslo', 10.75, 59.91, 2, 3], ['Copenhagen', 12.57, 55.68, 2, 3], ['Helsinki', 24.94, 60.17, 2, 4],
    ['Dublin', -6.26, 53.35, 2, 3], ['Edinburgh', -3.19, 55.95, 2, 4], ['Reykjavík', -21.94, 64.15, 2, 3],
    ['Moscow', 37.62, 55.75, 0, 3], ['St Petersburg', 30.31, 59.94, 1, 4], ['Kyiv', 30.52, 50.45, 2, 4],
    ['Warsaw', 21.01, 52.23, 2, 3], ['Prague', 14.44, 50.08, 2, 4], ['Budapest', 19.04, 47.50, 2, 4],
    ['Athens', 23.73, 37.98, 1, 3], ['Istanbul', 28.98, 41.01, 0, 3], ['Zürich', 8.54, 47.38, 2, 4],
    ['Barcelona', 2.17, 41.39, 2, 4], ['Milan', 9.19, 45.46, 2, 4], ['Naples', 14.27, 40.85, 2, 0],
    ['Marseille', 5.37, 43.30, 2, 0], ['Hamburg', 10.00, 53.55, 2, 4], ['Munich', 11.58, 48.14, 2, 4],
    ['Bucharest', 26.10, 44.43, 2, 4], ['Belgrade', 20.46, 44.79, 2, 0], ['Archangel', 40.54, 64.54, 2, 0],

    ['Cairo', 31.24, 30.04, 0, 3], ['Alexandria', 29.92, 31.20, 2, 0], ['Casablanca', -7.59, 33.57, 1, 3],
    ['Algiers', 3.06, 36.75, 2, 4], ['Tunis', 10.18, 36.81, 2, 4], ['Tripoli', 13.19, 32.89, 2, 0],
    ['Khartoum', 32.53, 15.50, 2, 4], ['Addis Ababa', 38.75, 9.03, 1, 3], ['Nairobi', 36.82, -1.29, 1, 3],
    ['Dar es Salaam', 39.28, -6.79, 2, 4], ['Lagos', 3.38, 6.52, 1, 3], ['Accra', -0.19, 5.60, 2, 4],
    ['Dakar', -17.45, 14.69, 1, 3], ['Kinshasa', 15.31, -4.32, 1, 4], ['Luanda', 13.23, -8.84, 2, 4],
    ['Johannesburg', 28.05, -26.20, 1, 3], ['Cape Town', 18.42, -33.93, 0, 3], ['Zanzibar', 39.20, -6.16, 2, 0],
    ['Timbuktu', -3.01, 16.77, 2, 0], ['Antananarivo', 47.52, -18.88, 2, 4], ['Mombasa', 39.66, -4.05, 2, 0],
    ['Saint Helena', -5.72, -15.96, 2, 0], ['Bangui', 18.56, 4.36, 2, 4], ['Niamey', 2.11, 13.51, 2, 4],

    ['Jerusalem', 35.22, 31.78, 1, 0], ['Beirut', 35.50, 33.89, 2, 4], ['Baghdad', 44.36, 33.31, 1, 3],
    ['Tehran', 51.39, 35.69, 1, 3], ['Riyadh', 46.72, 24.63, 1, 4], ['Dubai', 55.27, 25.20, 1, 4],
    ['Mecca', 39.83, 21.42, 2, 0], ['Kabul', 69.21, 34.53, 2, 4], ['Tashkent', 69.24, 41.30, 2, 4],
    ['Samarkand', 66.96, 39.65, 2, 0], ['Karachi', 67.00, 24.86, 1, 3], ['Mumbai', 72.88, 19.08, 0, 3],
    ['Delhi', 77.21, 28.61, 0, 3], ['Kolkata', 88.36, 22.57, 1, 3], ['Chennai', 80.27, 13.08, 2, 4],
    ['Colombo', 79.86, 6.93, 2, 3], ['Kathmandu', 85.32, 27.70, 2, 4], ['Dhaka', 90.41, 23.81, 2, 4],
    ['Yangon', 96.16, 16.87, 2, 3], ['Bangkok', 100.50, 13.76, 0, 3], ['Singapore', 103.82, 1.35, 0, 3],
    ['Kuala Lumpur', 101.69, 3.14, 2, 4], ['Jakarta', 106.85, -6.21, 1, 3], ['Manila', 120.98, 14.60, 1, 3],
    ['Hanoi', 105.83, 21.03, 2, 4], ['Ho Chi Minh City', 106.63, 10.82, 2, 4], ['Hong Kong', 114.17, 22.32, 0, 3],
    ['Shanghai', 121.47, 31.23, 0, 3], ['Beijing', 116.41, 39.90, 0, 3], ['Guangzhou', 113.26, 23.13, 2, 4],
    ['Chengdu', 104.07, 30.57, 2, 4], ['Ürümqi', 87.62, 43.83, 2, 4], ['Lhasa', 91.14, 29.65, 2, 0],
    ['Seoul', 126.98, 37.57, 1, 3], ['Tokyo', 139.69, 35.69, 0, 3], ['Osaka', 135.50, 34.69, 2, 4],
    ['Vladivostok', 131.89, 43.12, 2, 0], ['Irkutsk', 104.28, 52.29, 2, 0], ['Novosibirsk', 82.92, 55.03, 2, 4],
    ['Yakutsk', 129.73, 62.03, 2, 0], ['Ulaanbaatar', 106.92, 47.89, 2, 4],

    ['New York', -74.01, 40.71, 0, 3], ['Boston', -71.06, 42.36, 2, 4], ['Washington', -77.04, 38.91, 2, 4],
    ['Chicago', -87.62, 41.88, 1, 3], ['New Orleans', -90.07, 29.95, 2, 4], ['Miami', -80.19, 25.76, 1, 3],
    ['Houston', -95.37, 29.76, 2, 4], ['Denver', -104.99, 39.74, 2, 0], ['Los Angeles', -118.24, 34.05, 0, 3],
    ['San Francisco', -122.42, 37.77, 1, 3], ['Seattle', -122.33, 47.61, 2, 4], ['Anchorage', -149.90, 61.22, 2, 3],
    ['Vancouver', -123.12, 49.28, 2, 4], ['Toronto', -79.38, 43.65, 1, 3], ['Montréal', -73.57, 45.50, 2, 3],
    ['Mexico City', -99.13, 19.43, 1, 3], ['Havana', -82.38, 23.11, 2, 3], ['Panama City', -79.52, 8.98, 2, 3],
    ['Bogotá', -74.07, 4.71, 2, 3], ['Lima', -77.03, -12.05, 1, 3], ['Quito', -78.47, -0.18, 2, 4],
    ['Santiago', -70.65, -33.46, 1, 3], ['Buenos Aires', -58.38, -34.60, 0, 3], ['Rio de Janeiro', -43.17, -22.91, 0, 3],
    ['São Paulo', -46.63, -23.55, 1, 3], ['Manaus', -60.02, -3.12, 2, 0], ['Salvador', -38.50, -12.97, 2, 3],
    ['Caracas', -66.90, 10.49, 2, 3], ['La Paz', -68.15, -16.50, 2, 0], ['Ushuaia', -68.30, -54.80, 2, 0],
    ['Nuuk', -51.72, 64.18, 2, 0], ['Honolulu', -157.86, 21.31, 2, 3], ['Valparaíso', -71.62, -33.05, 2, 0],

    ['Sydney', 151.21, -33.87, 0, 3], ['Melbourne', 144.96, -37.81, 1, 3], ['Perth', 115.86, -31.95, 2, 4],
    ['Brisbane', 153.03, -27.47, 2, 4], ['Darwin', 130.84, -12.46, 2, 3], ['Auckland', 174.76, -36.85, 1, 3],
    ['Wellington', 174.78, -41.29, 2, 0], ['Port Moresby', 147.15, -9.48, 2, 0], ['Suva', 178.44, -18.14, 2, 3],
    ['Alice Springs', 133.88, -23.70, 2, 0], ['McMurdo', 166.67, -77.85, 2, 0], ['Papeete', -149.57, -17.54, 2, 0]
  ];

  const CITIES = CITY_RAW.map(c => ({ n: c[0], lon: c[1], lat: c[2], rank: c[3], air: c[4] }));

  const LANDMARKS = ['New York', 'Rio de Janeiro', 'Cape Town', 'Moscow', 'Mumbai',
    'Beijing', 'Tokyo', 'Sydney', 'London', 'Lima', 'Cairo', 'San Francisco'];

  /* --- isochrone band ladders, in hours -------------------------------- */
  const LADDERS = { base: [6, 12, 24, 48, 96, 168, 336, 504, 720, 1080, 1440, 2160, 2880, 4320, 5760, 8760, 13140, 17520] };


  /* The sea carries the same travel time as the land but in a cooler hue, so
     ocean and continent never read as the same surface — the way the old
     passage charts tinted water apart from land. */
  const FIELD_ALPHA = 0.58;   // the wash carries the reading on its own now
  const SATURATE = 1.5;       // chroma pushed out so adjacent times separate
  const LINE_WIDTH = 1.1;     // isochrone line weight, in band-gradient units
  const LINE_STRENGTH = 0.34; // how far the line lifts toward white
  const BEYOND_ALPHA = 0.5;   // ground past the last threshold, dimmed not bare      // chroma pushed out so adjacent times separate
  const SEA_TINT = [72, 166, 196];

  const SEA_MIX = 0.62;

  /* Five plates, each with its own character rather than five shufflings of
     the same rainbow: a full spectrum, Galton's muted lithograph, a warm-only
     ramp, a cool-only ramp, and an earth ramp.
     All of them wash onto black with a screen blend, where a dark colour
     contributes almost nothing — so distance is carried by hue, never by
     going dark, or the far half of the map collapses into one flat shade. */
  const PALETTES = [
    { id: 'passage', name: 'Passage', ramp: [
      [255,247,210],[255,214,118],[255,176,70],[250,138,62],[242,102,78],
      [230,76,114],[212,66,154],[182,72,194],[148,92,216],[110,114,228],
      [74,142,226],[58,170,212],[62,192,184],[86,204,146],[126,210,112],
      [168,208,100],[190,198,150],[188,200,212] ] },
    { id: 'galton', name: 'Galton 1881', ramp: [
      [150,200,120],[178,212,124],[206,220,128],[230,224,126],[246,220,116],
      [250,206,112],[250,188,120],[248,168,132],[246,150,150],[244,138,168],
      [232,128,186],[210,126,204],[184,132,214],[154,142,216],[126,154,214],
      [142,152,192],[174,144,122],[190,164,124] ] },
    { id: 'ember', name: 'Ember', ramp: [
      [255,252,232],[255,240,186],[255,226,140],[255,208,96],[255,186,64],
      [252,162,48],[248,138,44],[242,114,46],[234,92,54],[224,72,66],
      [212,58,82],[198,50,100],[182,46,118],[164,46,134],[146,50,146],
      [128,56,152],[112,64,154],[100,74,152] ] },
    { id: 'fathom', name: 'Fathom', ramp: [
      [240,254,250],[206,248,242],[170,240,238],[132,228,234],[96,212,230],
      [64,192,226],[44,170,220],[36,148,214],[38,126,206],[48,104,196],
      [62,84,184],[80,66,170],[98,54,154],[116,48,138],[132,46,124],
      [146,50,116],[156,60,112],[164,74,112] ] },
    { id: 'ordnance', name: 'Ordnance', ramp: [
      [250,248,220],[236,242,190],[214,232,162],[186,220,140],[156,206,124],
      [126,190,114],[102,172,108],[88,152,104],[88,132,100],[100,120,92],
      [124,116,84],[148,116,78],[170,120,80],[188,130,92],[198,146,112],
      [200,164,140],[194,180,170],[186,192,198] ] }
  ];
  const RAMP = PALETTES[0].ramp;

  return {
    ERAS, MODES, SEA_TINT, SEA_MIX, PALETTES, FIELD_ALPHA, SATURATE, LINE_WIDTH, LINE_STRENGTH, BEYOND_ALPHA, WATER, WATER_SCHEDULED, FERRY, ICE_WATER, RIVER, PORT_H, RAIL, HSR,
    ROAD_CIRC, RAIL_CIRC, RIVER_CIRC, ROAD_EXP, ROAD_REF, TERRAIN_MUL, AIR, AIR_RANK, COUNTRY_RAW, RAIL_HIST, RAINFOREST,
    CLASS_MUL, NET_W, BIKE_MUL, FOOT_MUL, RAIL_MAIN, RAIL_BRANCH, ANTARCTIC_AIR, STRAITS, WATER_CUTS, FERRY_ROUTES, FERRY_PORT, SEA_DUTY, FIXED_LINKS, CANALS, RIVERS,
    RAIL_LINES, RAIL_BOARD, RAIL_ALIGHT, RAIL_BORDER, RAIL_CHANGE, TRANSIT_ACCESS, HSR_SERVICE, SAIL_CIRC, MAP_ERA, MAP_W, MAP_GAPS_ONLY, CITIES, LANDMARKS, LADDERS, RAMP
  };
})();
