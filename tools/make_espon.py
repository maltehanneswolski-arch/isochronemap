# -*- coding: utf-8 -*-
"""A second truth set, for the year 2000, out of ESPON's NUTS-3 travel time
matrices (indicator 1542, database.espon.eu). Where Transitous gives real
2026 itineraries, this gives modelled 2001 road and rail times between the
centroids of European NUTS-3 regions - the era the model had nothing to check
against at all.

The matrices are region centroid to region centroid, so the pairs are written
with the centroid coordinates GISCO publishes for the same regions. ESPON's
rail column is network time between regions and carries no access to the
station, which is the one systematic difference from the Transitous set.

Writes calibration_espon.json.
"""
import csv, json, math, os, random

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PTS = os.path.join(ROOT, 'data', 'src', 'nuts3_pts.geojson')
TTM = os.path.join(ROOT, 'data', 'src', 'espon', 'matrix', 'TTM_2001.dat')
OUT = os.path.join(ROOT, 'calibration_espon.json')
N_REGIONS = 90
MIN_KM = 120                     # below this the centroid is a poor proxy


def gc(a, b, c, d):
    p1, p2 = math.radians(b), math.radians(d)
    return 6371 * math.acos(max(-1.0, min(1.0, math.sin(p1) * math.sin(p2)
                                + math.cos(p1) * math.cos(p2) * math.cos(math.radians(c - a)))))


def main():
    geo = json.load(open(PTS, encoding='utf-8'))
    pt, name = {}, {}
    for f in geo['features']:
        p = f['properties']
        pt[p['NUTS_ID']] = (round(float(p['LON']), 4), round(float(p['LAT']), 4))
        name[p['NUTS_ID']] = p['NAME_LATN']

    # a spread rather than a clump: at most three regions per country, taken
    # far apart, so the pairs are not all short hops inside Germany
    bycc = {}
    for k in sorted(pt):
        bycc.setdefault(k[:2], []).append(k)
    random.seed(7)
    chosen = []
    for cc, ks in sorted(bycc.items()):
        ks = sorted(ks)
        take = ks[::max(1, len(ks) // 3)][:3]
        chosen.extend(take)
    random.shuffle(chosen)
    chosen = sorted(chosen[:N_REGIONS])
    want = set(chosen)
    print('regions sampled: %d across %d countries' % (len(chosen), len({c[:2] for c in chosen})))

    rows = []
    with open(TTM, encoding='latin-1') as f:
        next(f)
        for line in f:
            p = line.split()
            if len(p) < 6 or p[0] not in want or p[1] not in want or p[0] >= p[1]:
                continue
            a, b = pt.get(p[0]), pt.get(p[1])
            if not a or not b:
                continue
            km = gc(a[0], a[1], b[0], b[1])
            if km < MIN_KM:
                continue
            road, rail = int(p[2]), int(p[3])
            if road <= 0 or rail <= 0 or rail > 3000:
                continue
            rows.append({'from': p[0], 'to': p[1], 'fromName': name[p[0]], 'toName': name[p[1]],
                         'fromLL': [a[1], a[0]], 'toLL': [b[1], b[0]],
                         'km': round(km), 'road': round(road / 60, 2), 'rail': round(rail / 60, 2)})
    rows.sort(key=lambda r: r['km'])
    print('pairs: %d  | km %d-%d  | rail hours %.1f-%.1f'
          % (len(rows), rows[0]['km'], rows[-1]['km'],
             min(r['rail'] for r in rows), max(r['rail'] for r in rows)))
    json.dump({'note': 'ESPON indicator 1542, TTM_2001: road and rail travel time in hours between '
                       'NUTS-3 centroids, 2001. Centroids from Eurostat GISCO NUTS_LB_2013.',
               'era': 2000, 'pairs': rows},
              open(OUT, 'w', encoding='utf-8'), ensure_ascii=False)
    print('wrote', OUT, os.path.getsize(OUT), 'bytes')


if __name__ == '__main__':
    main()
