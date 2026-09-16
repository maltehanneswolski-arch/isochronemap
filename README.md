# Isochronic Globe

An interactive isochrone map of the world, after Francis Galton's *Isochronic
Passage Chart for Travellers* (Proceedings of the Royal Geographical Society,
1881), drawn by H. Sharbau and lithographed by E. Weller, which showed days of
journey from London.

Click any point on Earth and the map shows how far you could get from it, by a
chosen means of travel, in a chosen year.

It is a static site with no build step, so Netlify can deploy this repository
as it stands.

## What it does

- Eight years: 1750, 1850, 1900, 1925, 1950, 1975, 2000, 2026.
- Five ways to travel: fastest route, on foot, by bicycle, by road, by air.
  Modes that did not exist yet are disabled, with the reason (no bicycle
  before the 1860s, no powered flight before 1903). Public transport is no
  longer offered on its own, but it is still what the fastest route puts you
  on where a train beats the alternatives; the `transit` entry in `data.js`
  remains as the engine's profile for it, marked `hidden`.
- Five colour schemes, one of them taken from Galton's own hand-tinted green,
  yellow, pink, blue and brown plate.

## On a phone

Below 820px the panel becomes a sheet at the foot of the screen, and the era
axis moves inside it, so only one thing ever covers the globe. It rests
showing the place, the means of travel and the years, and is dragged up for
the scale, the colours, the journey table and the method.

One finger turns the globe and two pinch it. A touch screen has no hover, so a
tap pins the time to that place with the choice of starting again from there,
and a double tap zooms in. A phone held on its side keeps the side panel
instead: a sheet would leave the globe no height.

## How it works

Earth is laid on a 0.25° grid of 1,036,800 cells. Every cell carries the road
class, railway, ferry route, terrain and country beneath it. The map then
solves for the quickest route through that grid with Dial's bucketed Dijkstra.
It is the least-cost path method
[Weiss et al. (2018, *Nature*)](https://www.nature.com/articles/nature25181)
use for their global friction surface.

The band field is drawn by a WebGL2 fragment shader. The solved grid is
uploaded once as a texture and the GPU does the sphere projection per pixel, so
the globe stays at full resolution while it turns. Isochrone lines use
screen-space derivatives (`fwidth`), which keeps them a constant width at any
zoom. A CPU renderer is kept as a fallback.

Speed and duty day are separate: 5 km/h walking for 8 hours, 90 km/h driving
for 10. A short hop runs at the full speed. Only a long haul starts paying for
nights and rests. That keeps London to Edinburgh at seven hours and London to
Peking at seven weeks in the same model.

### Data

| Layer | Source |
|---|---|
| Coastlines, countries | Natural Earth 50m (via `world-atlas`) |
| Roads (56,600 features, classified) | Natural Earth 10m roads |
| Railways (37,487 grid cells) | Natural Earth 10m railroads |
| Ferry routes (314) | Natural Earth 10m roads, ferry class |
| Terrain (222 ranges, 58 deserts) | Natural Earth 10m geography regions |
| Airfields (2,829) | [OurAirports](https://ourairports.com/data/) (public domain), large and medium with scheduled service, plus Natural Earth 10m |
| High-speed rail (4,899 cells) | [OpenStreetMap](https://wiki.openstreetmap.org/wiki/Key:highspeed) `highspeed=yes` track via Overpass (146,083 ways, all 82 boxes), with a hand list of corridors carrying speeds and opening years |
| Fixed links | Channel Tunnel, Great Belt, Øresund, Seikan, Kanmon, Bosphorus, King Fahd, portal to portal |
| Real journey times (166 pairs) | [Transitous](https://transitous.org) over open GTFS, and operator timetables |
| American rail 1826-1911 (8,703 cells, dated) | [Atack](https://my.vanderbilt.edu/jeremyatack/data-downloads/), 76,849 segments each with the year it was in operation by |
| American steamboat rivers (1,376 cells, dated) | [Atack](https://my.vanderbilt.edu/jeremyatack/data-downloads/), 226 rivers with the year navigation began |
| Sail speed (111,120 day-runs) | [CLIWOC](https://en.wikipedia.org/wiki/CLIWOC) logbooks 1662-1855, via [Open History Map](https://github.com/openhistorymap/cliwoc) |
| European road and rail times, 2001 (2,829 pairs) | [ESPON indicator 1542](https://database.espon.eu/indicator/1542/), NUTS-3 centroids from [GISCO](https://gisco-services.ec.europa.eu/distribution/v2/nuts/) |
| Land speed where no road is mapped (86,037 cells) | [MAP friction surface](https://malariaatlas.org/research-project/accessibility-to-healthcare/) 2020 ([Weiss et al.](https://www.nature.com/articles/s41591-020-1059-1)), 30 arc-second, via its WCS |
| Place labels (1,100) | Natural Earth 10m populated places |
| Road speed by country | [IMF Mean Speed score](https://www.imf.org/en/Publications/WP/Issues/2022/05/13/Road-Quality-and-Mean-Speed-Score-517801) (Moszoro & Soto 2022), 161 countries |
| Road class speeds | [Van Etten 2020, WACV](https://openaccess.thecvf.com/content_WACV_2020/papers/Van_Etten_City-Scale_Road_Extraction_from_Satellite_Imagery_v2_Road_Speeds_and_WACV_2020_paper.pdf) |
| Walking speed | [Tobler's hiking function](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function) |
| 18th-c. sailing times | [Royal Museums Greenwich](https://www.rmg.co.uk/stories/maritime-history/library-archive/18th-century-sailing-times-between-english-channel-coast) |

Railways, canals and fixed links open on their real dates: Suez 1869, Panama
1914, the Channel Tunnel 1994. In the United States every line opens on the
date Atack's survey gives it, so 1850 reaches the Appalachians and not the
Pacific. Before 1869 every ship rounds the Cape, which is
most of what the early maps look like.

### What the friction surface is and is not used for

The Malaria Atlas Project publishes a 30 arc-second raster of minutes per
metre for land travel, built from OSM roads, railways, rivers, land cover and
slope. It is the measured version of what this model assembles from road
class, country mean speed and terrain, so the obvious move is to swap it in.

That was tried and measured, and it is worse. Blending it across the whole
grid took the 2026 set from 90% of pairs within a quarter down to 85, and
ESPON's road matrix from 62% to 55. The reason is the aggregation: one cell
here is 900 of its pixels, the fastest of them is an optimistic statistic,
and a least-cost path chains exactly those cells together, so journeys come
out too quick. Using the median instead fails the other way, since most
pixels in a cell are off the road.

What does work is filling gaps. Where Natural Earth maps no road at all the
surface is used directly, which is neutral on both truth sets and adds a road
where there was none across 86,037 cells - most of them in Russia, Canada,
the American interior, Australia and Brazil, which is exactly where the
10m road layer is thin and where there is no truth set to check against.
`MAP_GAPS_ONLY` in `data.js` turns the full blend back on for anyone who
wants to revisit it.

## Calibration

Scheduled transport in 2026 is checked against 317 real city-centre to
city-centre journeys between 89 origin cities on five continents: Transitous (an open routing
service over open GTFS feeds, fastest surface itinerary over four Tuesday
departures) for 228 of them, operator timetables plus 0.4 h of station access
for the 36 it has no feed for, and 5 where its answer needed a floor or a
ceiling. Result: 84% of pairs within a quarter of the real time, 94% within
40%, median ratio 0.97. Inside a tenth it is 49%.

### Corrected against real timetable isochrones

MOTIS, which Transitous runs on, answers one-to-all: from a single point it
returns every stop reachable inside a time budget with the real journey time.
One query over Vienna comes back with 174 413 of them. Nineteen origins give
6 993 measurements of the fastest real arrival in a 0.25 degree cell, and
against those the model ran 19% quick - the median of model over real was
0.814.

The city-pair checks had missed that, and the reason is worth stating: they
run city centre to city centre, which are the best-connected points on the
network, while the map draws reachability to everywhere, including places
served twice a day. Both figures are real; they are answers to different
questions.

77% of the variance in that residual is explained by the destination cell
rather than by the origin-destination pair, so it is a property of the place
and can be learnt. Held out one origin at a time, a factor learnt from the
other eighteen moves that origin's cells from 28% inside a tenth to 35%, so
it transfers rather than fitting itself. The learnt factor is applied to the
finished field, not inside the search, because that is where it belongs.

The result, on the question this map actually asks: median 0.997, 57% of
cells inside a tenth where it was 23%, 85% inside a quarter where it was 61%.
Between city centres it now reads about 9% slow - median 1.09, 36% inside a
tenth - which is the price of the two truths disagreeing. `OTA_STRENGTH` in
`data.js` moves between them.

The correction covers Europe and the few other places with feeds. Adding
origins widens it; `tools/harvest_onetoall.py` takes a list of city names.

### Where open timetables run out

The global set asks for eight routes from each of 28 origins on every
inhabited continent. Thirteen of those origins returned nothing at all -
Moscow, Istanbul, Cairo, Casablanca, Tripoli, Lagos, Nairobi, Johannesburg,
Mexico City, La Paz, Delhi, Bangkok and Beijing. There is no open feed for
any of them, so a third of the world cannot be checked this way at all, and
what the model says there rests on the road and rail layers alone.

Three more had to be thrown out as not real: Sarajevo to Podgorica came back
as 173 km in 40.2 h, which is 4 km/h. Sampling every three hours over a whole
day gave the same answer, so it is not a sampling artefact - the Balkan
international coaches are simply not in open data, and the router stitched
together village buses instead. Anything implying under 20 km/h door to door
over 150 km is dropped for that reason.

What the Balkans did show, on the routes that survived, is a genuine error:
the model had Bosnia running twice as fast as it does. Its rail quality is
now fitted to the measurements like every other country's.

The median is near 1 at every distance: 1.02 under 150 km, 0.98 from 150 to
350, 0.96 from 350 to 700, 1.00 beyond. The scatter is worst on the short
hops, 73% within a quarter against 92% over 350 km, because one access
figure cannot fit both a Shinkansen pair whose stations are central (Osaka to
Kyoto is 25 minutes door to door) and a European journey that needs two
changes to cover the same ground.

Those targets are what the router returns. An earlier version took the lower
of the router and a hand-written timetable, on the theory that three sampled
departures can miss the direct train. That is true sometimes and it was
applied always, which is a mistake worth recording: it pulled 61 of the 166
targets below the measured journey, by up to 2.75 h, and the model was then
tuned to match them. Brussels to Vienna had been set to 9.5 h from "ICE and
Railjet" when no such through working exists - the real fastest is 11.2 h
over four trains and three changes, one of them a regional service. The hand
timings now only fill gaps in the router's coverage, or floor an answer that
is impossibly quick.

The residual that remains is connections. The model assumes you always catch
the best one, so a journey that is really four trains and three changes still
comes out about a fifth quick: Brussels to Vienna reads 9.0 h against 11.5.
Single-corridor journeys are close - Paris to Marseille 3.5 against 3.5, Milan
to Rome 3.3 against 3.4, Madrid to Barcelona 3.1 against 3.5. The other wide
misses are Alpine passes, where the railway and the road wind far beyond the
straight line the grid measures.

There is a second set for the year 2000, which nothing else could check:
ESPON's NUTS-3 travel time matrices for 2001, 1,419 pairs between region
centroids. Against their rail matrix the model's median ratio is 1.02 and 82%
of pairs fall within a quarter. Those are modelled times rather than
itineraries, so it is one model against another, but it is a peer-reviewed
one and it covers the era end to end.

```bash
python tools/harvest_transitous.py     # real 2026 journeys (resumes)
python tools/make_calibration.py       # write calibration.json
python tools/make_espon.py             # write calibration_espon.json (2001)
python tools/harvest_map_friction.py   # MAP friction surface, 318 tiles (~25 min)
```

Then on a local server, in the console: `await __iso.calibrate()` returns
model against real for every pair, and `await __iso.calibrateEspon(0,30,4)`
does the same for 2000.

## Files

| File | |
|---|---|
| `index.html` | page, styles, markup |
| `app.js` | grid, least-cost solver, renderer, UI |
| `data.js` | era constants, country profiles, hand-authored geography |
| `grid.js` | packed 0.25° layers (land, country, terrain, road, rail, ferry) + places + airfields |
| `geo.js` | coastline and border geometry for drawing |
| `build-grid.js` | regenerates `grid.js` and `geo.js` from Natural Earth, OurAirports and the OSM pull |
| `calibration.json` | the real journeys the model is checked against |
| `calibration_espon.json` | ESPON's 2001 NUTS-3 road and rail times, for the 2000 plate |
| `tools/` | the harvesters (Transitous, Overpass, MAP friction), the shapefile and PDF readers, and the calibration assemblers |

## Rebuilding the data

```bash
mkdir -p data && cd data
base=https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson
for f in ne_10m_railroads ne_10m_roads ne_10m_populated_places_simple \
         ne_10m_geography_regions_polys ne_10m_airports; do
  curl -sLO $base/$f.geojson
done
curl -sL -o countries-50m.json https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json
curl -sL -o ourairports.csv https://davidmegginson.github.io/ourairports-data/airports.csv
cd .. && python tools/harvest_osm_hsr.py   # high-speed track from Overpass, in small boxes
node --max-old-space-size=6144 build-grid.js
```

## Running locally

```bash
node serve.js   # http://localhost:5199
```

## Caveat

This is an illustrative model built from published average speeds and opening
dates, not routing data. It ignores winds, monsoons, timetables, borders, war
and weather, and it assumes you always catch the best connection.
