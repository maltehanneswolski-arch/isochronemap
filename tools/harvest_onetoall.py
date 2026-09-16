# -*- coding: utf-8 -*-
"""Real timetable isochrones from Transitous, rasterised to the 0.25 degree
grid.

MOTIS exposes one-to-all: from a single origin it returns every stop
reachable inside a time budget, with the real journey time and the number of
changes. One query over Brussels returns 75 597 stops. That is a far denser
truth than point-to-point pairs - tens of thousands of measurements per
origin instead of eight - and it is what the model should be fitted against.

Each origin is fetched, reduced to the fastest arrival per grid cell, and the
raw answer thrown away. Output: data/ota/<origin>.json, a sparse map of
cell -> {minutes, changes}.
"""
import json, os, sys, time, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from world_routes import WORLD

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

RES, GW, GH = 0.25, 1440, 720
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'ota')
UA = 'isochrone-globe research (github maltehanneswolski-arch/isochronemap)'
WHEN = '2026-09-22T07:00:00Z'
BUDGET = 600                                   # minutes

# origins where Transitous has feeds, spread over the covered world
ORIGINS = ['Brussels', 'London', 'Berlin', 'Vienna', 'Rome', 'Madrid', 'Prague',
           'Paris', 'Amsterdam', 'Copenhagen', 'Warsaw', 'Zagreb', 'Athens',
           'Stockholm', 'Milan', 'Barcelona', 'Munich', 'Lisbon',
           'Washington', 'New York', 'Los Angeles', 'Melbourne', 'Tokyo', 'Sao Paulo']


def cell_of(lon, lat):
    c = int((lon + 180) / RES) % GW
    r = min(GH - 1, max(0, int((90 - lat) / RES)))
    return r * GW + c


def fetch(name, budget=BUDGET):
    la, lo = WORLD[name]
    url = ('https://api.transitous.org/api/v1/one-to-all?one=%f,%f&time=%s'
           '&maxTravelTime=%d&transitModes=TRANSIT&arriveBy=false' % (la, lo, WHEN, budget))
    req = urllib.request.Request(url, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=600) as r:
        return json.loads(r.read())


def main():
    os.makedirs(OUT, exist_ok=True)
    only = sys.argv[1:] or ORIGINS
    for name in only:
        p = os.path.join(OUT, name.replace(' ', '_') + '.json')
        if os.path.exists(p):
            print('%-13s already done' % name, flush=True)
            continue
        budget = BUDGET
        d = None
        while budget >= 120:
            try:
                d = fetch(name, budget)
                break
            except Exception as ex:
                msg = str(ex)[:60]
                if 'too many results' in msg or '422' in msg:
                    budget = int(budget * 0.6)   # shrink until it fits the cap
                    print('%-13s budget -> %d min' % (name, budget), flush=True)
                    continue
                print('%-13s %s' % (name, msg), flush=True)
                time.sleep(5)
                budget = int(budget * 0.7)
        if not d:
            print('%-13s FAILED' % name, flush=True)
            continue
        best = {}
        for e in d.get('all', []):
            pl = e.get('place') or {}
            if pl.get('vertexType') != 'TRANSIT':
                continue
            c = cell_of(pl['lon'], pl['lat'])
            m = e.get('duration')
            if m is None:
                continue
            cur = best.get(c)
            if cur is None or m < cur[0]:
                best[c] = (m, e.get('k', 0))
        json.dump({'origin': name, 'originLL': list(WORLD[name]), 'when': WHEN,
                   'budgetMin': budget, 'stops': len(d.get('all', [])),
                   'cells': {str(k): {'m': v[0], 'k': v[1]} for k, v in sorted(best.items())}},
                  open(p, 'w', encoding='utf-8'))
        print('%-13s %6d stops -> %5d cells  (%d min budget)'
              % (name, len(d.get('all', [])), len(best), budget), flush=True)
        time.sleep(1)


if __name__ == '__main__':
    main()
