# -*- coding: utf-8 -*-
"""Measure the global check set against Transitous: 224 routes, eight from
each of 28 origins on every inhabited continent.

Six departures across a Tuesday, air legs rejected (some national feeds carry
domestic flights, which are not scheduled surface transport). If the first
departure finds nothing at all the rest are skipped, so a region with no feed
costs one request rather than six.

Writes data/world_measured.json. Routes with no feed are listed there with
hours null, to be filled from operator timetables separately.
"""
import json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from world_routes import WORLD, all_pairs

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

API = 'https://api.transitous.org/api/v1/plan'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'world_measured.json')
UA = 'isochrone-globe calibration (research; github maltehanneswolski-arch/isochronemap)'
TIMES = ['2026-09-22T%02d:00:00Z' % h for h in (4, 6, 7, 8, 10, 13)]


def plan(a, b, t):
    q = urllib.parse.urlencode({'fromPlace': '%f,%f' % a, 'toPlace': '%f,%f' % b,
                                'time': t, 'arriveBy': 'false', 'maxItineraries': 8})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def surface(d):
    """The fastest itinerary that uses a vehicle and does not fly."""
    best = None
    for it in d.get('itineraries', []):
        legs = [l for l in it['legs'] if l.get('mode') != 'WALK']
        if not legs:
            continue
        if any((l.get('mode') or '').upper() == 'AIRPLANE' for l in legs):
            continue
        h = it['duration'] / 3600.0
        if best is None or h < best['hours']:
            best = {'hours': round(h, 2), 'changes': it.get('transfers'),
                    'via': ' > '.join(str(l.get('routeShortName') or l.get('mode')) for l in legs)[:60],
                    'modes': sorted({str(l.get('mode')) for l in legs})}
    return best


def main():
    out, done = [], set()
    if os.path.exists(OUT):
        out = json.load(open(OUT, encoding='utf-8'))['routes']
        done = {(r['from'], r['to']) for r in out}
        print('resuming: %d already done' % len(out))

    pairs = [p for p in all_pairs() if p not in done]
    print('%d routes to measure' % len(pairs), flush=True)
    for i, (fa, tb) in enumerate(pairs):
        a, b = WORLD[fa], WORLD[tb]
        best = None
        for k, t in enumerate(TIMES):
            try:
                d = plan(a, b, t)
            except Exception as ex:
                print('   ! %s->%s %s' % (fa, tb, str(ex)[:50]), file=sys.stderr)
                time.sleep(2)
                continue
            s = surface(d)
            if s and (best is None or s['hours'] < best['hours']):
                best = s
            if k == 0 and s is None:
                break                      # no feed here; do not spend five more
            time.sleep(0.3)
        out.append({'from': fa, 'to': tb, 'fromLL': list(a), 'toLL': list(b), **(best or {'hours': None})})
        print('%3d/%d %-13s -> %-16s %s' % (i + 1, len(pairs), fa, tb,
              ('%6.2f h  %s chg  %s' % (best['hours'], best['changes'], best['via'][:40]))
              if best else 'no feed'), flush=True)
        json.dump({'note': 'Transitous, six Tuesday departures, fastest surface itinerary, '
                           'air legs excluded. hours null = no feed for that route.',
                   'routes': out}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    got = sum(1 for r in out if r.get('hours'))
    print('measured %d of %d; %d have no feed' % (got, len(out), len(out) - got))


if __name__ == '__main__':
    main()
