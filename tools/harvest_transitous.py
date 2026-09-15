# -*- coding: utf-8 -*-
"""Real 2026 journey times from Transitous (api.transitous.org), an open
routing service over open GTFS feeds.

For each pair in tools/pairs.py the fastest surface itinerary is kept, taken
over four departure times on an ordinary Tuesday. Only itineraries that
actually use a vehicle count: the router will happily return a three-day walk
where it has no service, and that is not a journey. Resumes, so a run that
stops part way can be started again.

Output: data/calibration_transitous.json.
"""
import json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import CITIES, PAIRS

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

TIMES = ['2026-09-22T05:00:00Z', '2026-09-22T07:00:00Z',
         '2026-09-22T09:00:00Z', '2026-09-22T13:00:00Z']
API = 'https://api.transitous.org/api/v1/plan'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'calibration_transitous.json')
UA = 'isochrone-globe calibration (research; github maltehanneswolski-arch/isochronemap)'


def plan(a, b, t):
    # maxItineraries must not be below the router's own numItineraries (5)
    q = urllib.parse.urlencode({'fromPlace': '%f,%f' % a, 'toPlace': '%f,%f' % b,
                                'time': t, 'arriveBy': 'false', 'maxItineraries': 8})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def best_of(a, b):
    best = None
    for t in TIMES:
        try:
            d = plan(a, b, t)
        except Exception as ex:
            print('    ! %s' % str(ex)[:60], file=sys.stderr)
            time.sleep(2)
            continue
        for it in d.get('itineraries', []):
            legs = [l for l in it['legs'] if l.get('mode') != 'WALK']
            if not legs:                       # a walk is not a journey
                continue
            h = it['duration'] / 3600.0
            if best is None or h < best['hours']:
                best = {'hours': round(h, 2), 'transfers': it.get('transfers'),
                        'legs': [str(l.get('routeShortName') or l.get('mode')) for l in legs],
                        'modes': sorted({str(l.get('mode')) for l in legs})}
        time.sleep(0.4)
    return best


def main():
    results, done = [], set()
    if os.path.exists(OUT):
        old = json.load(open(OUT, encoding='utf-8'))['pairs']
        results = [r for r in old if r.get('hours')]
        done = {(r['from'], r['to']) for r in results}
        print('resuming: %d pairs already measured' % len(results))

    todo = [p for p in PAIRS if p not in done]
    print('%d pairs to fetch' % len(todo))
    for i, (fa, tb) in enumerate(todo):
        a, b = CITIES[fa], CITIES[tb]
        best = best_of(a, b)
        rec = {'from': fa, 'to': tb, 'fromLL': list(a), 'toLL': list(b), **(best or {'hours': None})}
        results.append(rec)
        print('%3d/%d %-12s -> %-14s %s' % (
            i + 1, len(todo), fa, tb,
            ('%.2f h, %s changes, %s' % (best['hours'], best['transfers'], ' > '.join(best['legs'])[:46]))
            if best else 'no surface itinerary'), flush=True)
        json.dump({'source': 'Transitous (api.transitous.org), open GTFS; fastest surface itinerary '
                             'over four Tuesday departures', 'date': '2026-09-22', 'pairs': results},
                  open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    got = sum(1 for r in results if r.get('hours'))
    print('measured %d of %d pairs -> %s' % (got, len(PAIRS), OUT))


if __name__ == '__main__':
    main()
