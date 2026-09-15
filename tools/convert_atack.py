# -*- coding: utf-8 -*-
"""Jeremy Atack's historical transportation GIS, reduced to the 0.25 degree
grid: for every cell, the year a railway first reached it, and the year a
steamboat could first work the river through it.

The model had no dated American network at all. It took the country's single
railway opening year, 1830, and let branches follow 25 years later, so by
1850 the whole United States was on rail. The real figure is 8 570 track
miles in 1850 against 180 557 in 1900, and where those miles were matters
more than how many: in 1850 the network is east of the Appalachians.

Source: https://my.vanderbilt.edu/jeremyatack/data-downloads/ - railroads
1826-1911 (76 849 segments, each with the year it was in operation by) and
steamboat-navigated rivers (226 rivers, each with the year navigation began).
Both are in USA Contiguous Albers Equal Area Conic, undone here.

Writes data/atack_years.json: {rail: {cell: year}, river: {cell: year}}.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from shapelib import Albers, dbf, shp

RES, GW, GH = 0.25, 1440, 720
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'atack')
RR = 'RR1826-1911Modified103123'
RIV = 'SteamboatNavigatedRiverContigUSAprojection'


def cell_of(lon, lat):
    c = int((lon + 180) / RES) % GW
    r = min(GH - 1, max(0, int((90 - lat) / RES)))
    return r * GW + c


def stamp(pts, year, out):
    """Walk the polyline, dropping a year into every cell it crosses. Points
    are dense enough in these files that a step of a third of a cell along
    each segment leaves no gaps."""
    prev = None
    for lon, lat in pts:
        if prev is not None:
            dx, dy = lon - prev[0], lat - prev[1]
            n = max(1, int(max(abs(dx), abs(dy)) / (RES * 0.33)) + 1)
            for k in range(n + 1):
                c = cell_of(prev[0] + dx * k / n, prev[1] + dy * k / n)
                if year < out.get(c, 9999):
                    out[c] = year
        prev = (lon, lat)


def main():
    alb = Albers()
    rail, river = {}, {}

    recs = list(dbf(os.path.join(SRC, RR + '.dbf')))
    n = 0
    for rec, parts in zip(recs, shp(os.path.join(SRC, RR + '.shp'))):
        y = rec.get('InOpBy')
        if not y or not parts:
            continue
        y = int(y)
        if y < 1826 or y > 1916:
            continue
        for part in parts:
            stamp([alb.inverse(x, yy) for x, yy in part], y, rail)
        n += 1
    print('railway segments used: %d of %d -> %d cells' % (n, len(recs), len(rail)))

    recs = list(dbf(os.path.join(SRC, RIV + '.dbf')))
    n = 0
    for rec, parts in zip(recs, shp(os.path.join(SRC, RIV + '.shp'))):
        y = rec.get('START')
        if not y or not parts:
            continue
        y = int(y)
        if y < 1780 or y > 1920:
            continue
        for part in parts:
            stamp([alb.inverse(x, yy) for x, yy in part], y, river)
        n += 1
    print('rivers used: %d of %d -> %d cells' % (n, len(recs), len(river)))

    for label, d in (('rail', rail), ('river', river)):
        for era in (1850, 1860, 1875, 1890, 1900, 1911):
            print('  %s cells reached by %d: %d' % (label, era, sum(1 for v in d.values() if v <= era)))

    out = os.path.join(ROOT, 'data', 'atack_years.json')
    with open(out, 'w', encoding='utf-8') as f:
        json.dump({'note': 'Atack historical transportation GIS, 0.25 deg cell -> first year',
                   'rail': {str(k): v for k, v in sorted(rail.items())},
                   'river': {str(k): v for k, v in sorted(river.items())}}, f)
    print('wrote', out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
