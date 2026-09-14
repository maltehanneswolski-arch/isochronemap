# -*- coding: utf-8 -*-
"""High-speed railway geometry from OpenStreetMap through Overpass: every way
tagged railway=rail + highspeed=yes, with its maxspeed and any start_date.
Pulled in small boxes, because the public mirrors refuse country-sized
requests with `out geom`, and rotated across mirrors with a back-off.
Writes data/osm_hsr_box_NN.json; build-grid.js reads whatever is there."""
import json, os, time, urllib.parse, urllib.request

MIRRORS = ['https://overpass.kumi.systems/api/interpreter', 'https://overpass-api.de/api/interpreter',
           'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter']
UA = 'isochrone-globe/1.0 (research; github maltehanneswolski-arch/isochronemap)'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')

def boxes(lon0, lon1, lat0, lat1, dl, da):
    out, lon = [], lon0
    while lon < lon1:
        lat = lat0
        while lat < lat1:
            out.append((lat, lon, min(lat + da, lat1), min(lon + dl, lon1))); lat += da
        lon += dl
    return out

# Europe, East Asia, the Middle East, then the single boxes that hold the rest
B = (boxes(-11, 46, 35, 63, 8, 7) + boxes(98, 146, 18, 46, 8, 7) + boxes(26, 60, 20, 42, 8, 7)
     + [(28, -10, 36, 0), (37, 58, 44, 74), (36, -80, 46, -68), (-8, 105, -5, 112), (18, 72, 24, 78), (-40, 140, -30, 152)])

def fetch(bx, i):
    q = '[out:json][timeout:120];way["railway"="rail"]["highspeed"="yes"](%s,%s,%s,%s);out geom;' % bx
    for m in MIRRORS:
        try:
            req = urllib.request.Request(m, data=urllib.parse.urlencode({'data': q}).encode(), headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=180) as r:
                body = r.read()
            d = json.loads(body)
            if 'elements' not in d: raise ValueError('no elements')
            with open(os.path.join(DATA, 'osm_hsr_box_%02d.json' % i), 'wb') as f: f.write(body)
            return len(d['elements'])
        except Exception as ex:
            print('   %s -> %s' % (m.split('/')[2], str(ex)[:60])); time.sleep(6)
    return None

if __name__ == '__main__':
    os.makedirs(DATA, exist_ok=True)
    print('boxes', len(B))
    failed = []
    for i, bx in enumerate(B):
        if os.path.exists(os.path.join(DATA, 'osm_hsr_box_%02d.json' % i)): continue   # resumes
        n = fetch(bx, i)
        print('%2d/%d box %s -> %s ways' % (i + 1, len(B), bx, n if n is not None else 'FAILED'))
        if n is None: failed.append((i, bx))
        time.sleep(1.5)
    if failed:
        print('retrying', len(failed)); time.sleep(30)
        for i, bx in failed:
            print('   retry box %s -> %s' % (bx, fetch(bx, i)))
    tot = sum(len(json.load(open(os.path.join(DATA, f), encoding='utf-8'))['elements'])
              for f in sorted(os.listdir(DATA)) if f.startswith('osm_hsr_box_'))
    print('TOTAL highspeed ways harvested:', tot)
