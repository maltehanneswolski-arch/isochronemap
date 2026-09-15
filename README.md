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
- Six ways to travel: fastest route, on foot, by bicycle, by road, scheduled
  transport, by air. Modes that did not exist yet are disabled, with the reason
  (no bicycle before the 1860s, no powered flight before 1903).
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
| Place labels (1,100) | Natural Earth 10m populated places |
| Road speed by country | [IMF Mean Speed score](https://www.imf.org/en/Publications/WP/Issues/2022/05/13/Road-Quality-and-Mean-Speed-Score-517801) (Moszoro & Soto 2022), 161 countries |
| Road class speeds | [Van Etten 2020, WACV](https://openaccess.thecvf.com/content_WACV_2020/papers/Van_Etten_City-Scale_Road_Extraction_from_Satellite_Imagery_v2_Road_Speeds_and_WACV_2020_paper.pdf) |
| Walking speed | [Tobler's hiking function](https://en.wikipedia.org/wiki/Tobler%27s_hiking_function) |
| 18th-c. sailing times | [Royal Museums Greenwich](https://www.rmg.co.uk/stories/maritime-history/library-archive/18th-century-sailing-times-between-english-channel-coast) |

Railways, canals and fixed links open on their real dates: Suez 1869, Panama
1914, the Channel Tunnel 1994. Before 1869 every ship rounds the Cape, which is
most of what the early maps look like.

## Calibration

Scheduled transport in 2026 is checked against 166 real city-centre to
city-centre journeys: Transitous (an open routing service over open GTFS
feeds, fastest of three Tuesday departures) where its feeds reach, operator
timetables plus 0.4 h of station access elsewhere. Result: 90% of pairs within
a quarter of the real time, 99% within 40%, median ratio 0.93. Brussels to
Vienna reads 8.0 h against 9.5-10 by ICE and Railjet; Paris to Marseille 3.5
against 3.5; Tokyo to Osaka 2.5 against 2.75; Beijing to Guangzhou 8.1 against 8.2;
Beijing to Xi'an 4.7 against 4.7. The widest misses are Alpine passes, where the railway and the road wind
far beyond the straight line the grid measures, and Indian trunk lines.

```bash
python tools/harvest_transitous.py     # fetch real journeys (resumes)
python tools/make_calibration.py       # write calibration.json
```

Then on a local server, in the console: `await __iso.calibrate()` returns
model against real for every pair.

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
| `tools/` | the harvesters for Transitous and Overpass, and the calibration assembler |

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
