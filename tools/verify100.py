# -*- coding: utf-8 -*-
"""Re-measure 100 headline routes against Transitous with eight departure
times spread across a whole Tuesday, instead of the four the main harvest
uses, and report where the denser sampling moves the answer.

The point is to check the targets, not the model. Brussels to Vienna was
once carried at 9.5 h because a hand-written figure was trusted over the
router; the real fastest is 11.2 h over four trains. This is the check that
the other targets are not wrong in the same way: if a fastest journey exists
that four departures missed, eight are much more likely to find it.

Writes data/verify100.json.
"""
import json, os, sys, time, urllib.parse, urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import CITIES

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

API = 'https://api.transitous.org/api/v1/plan'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'verify100.json')
UA = 'isochrone-globe calibration (research; github maltehanneswolski-arch/isochronemap)'
TIMES = ['2026-09-22T%02d:00:00Z' % h for h in (4, 5, 6, 7, 8, 9, 11, 14)]

ROUTES = [
    ('Brussels', 'Vienna'), ('Brussels', 'Frankfurt'), ('Brussels', 'Munich'), ('Brussels', 'Berlin'),
    ('Brussels', 'Amsterdam'), ('Brussels', 'Cologne'), ('Brussels', 'Prague'), ('Brussels', 'Antwerp'),
    ('Paris', 'Lyon'), ('Paris', 'Marseille'), ('Paris', 'Bordeaux'), ('Paris', 'Strasbourg'),
    ('Paris', 'Brussels'), ('Paris', 'London'), ('Paris', 'Amsterdam'), ('Paris', 'Frankfurt'),
    ('Paris', 'Nice'), ('Paris', 'Toulouse'), ('Paris', 'Rennes'), ('Paris', 'Lille'),
    ('Paris', 'Geneva'), ('Paris', 'Milan'), ('Paris', 'Barcelona'),
    ('London', 'Edinburgh'), ('London', 'Manchester'), ('London', 'Birmingham'), ('London', 'Glasgow'),
    ('London', 'Leeds'), ('London', 'Liverpool'), ('London', 'Bristol'), ('London', 'Cardiff'),
    ('London', 'Newcastle'), ('London', 'York'), ('London', 'Amsterdam'),
    ('Berlin', 'Munich'), ('Berlin', 'Hamburg'), ('Berlin', 'Frankfurt'), ('Berlin', 'Cologne'),
    ('Berlin', 'Leipzig'), ('Berlin', 'Dresden'), ('Berlin', 'Hanover'), ('Berlin', 'Prague'),
    ('Berlin', 'Warsaw'), ('Berlin', 'Vienna'), ('Berlin', 'Stuttgart'), ('Berlin', 'Nuremberg'),
    ('Frankfurt', 'Cologne'), ('Frankfurt', 'Munich'), ('Frankfurt', 'Stuttgart'), ('Frankfurt', 'Hamburg'),
    ('Frankfurt', 'Nuremberg'), ('Frankfurt', 'Basel'), ('Frankfurt', 'Vienna'), ('Frankfurt', 'Amsterdam'),
    ('Munich', 'Vienna'), ('Munich', 'Salzburg'), ('Munich', 'Innsbruck'), ('Munich', 'Nuremberg'),
    ('Munich', 'Stuttgart'), ('Munich', 'Zurich'),
    ('Vienna', 'Budapest'), ('Vienna', 'Prague'), ('Vienna', 'Salzburg'), ('Vienna', 'Graz'),
    ('Vienna', 'Linz'), ('Vienna', 'Bratislava'), ('Vienna', 'Venice'),
    ('Zurich', 'Bern'), ('Zurich', 'Geneva'), ('Zurich', 'Basel'), ('Zurich', 'Milan'), ('Zurich', 'Lugano'),
    ('Milan', 'Rome'), ('Milan', 'Venice'), ('Milan', 'Turin'), ('Milan', 'Florence'), ('Milan', 'Naples'),
    ('Rome', 'Naples'), ('Rome', 'Florence'), ('Rome', 'Venice'), ('Rome', 'Bologna'),
    ('Madrid', 'Barcelona'), ('Madrid', 'Seville'), ('Madrid', 'Valencia'), ('Madrid', 'Malaga'),
    ('Madrid', 'Bilbao'), ('Barcelona', 'Valencia'), ('Lisbon', 'Porto'),
    ('Copenhagen', 'Stockholm'), ('Copenhagen', 'Hamburg'), ('Copenhagen', 'Aarhus'),
    ('Stockholm', 'Gothenburg'), ('Oslo', 'Bergen'), ('Helsinki', 'Tampere'),
    ('Warsaw', 'Krakow'), ('Warsaw', 'Gdansk'), ('Prague', 'Brno'), ('Budapest', 'Bratislava'),
    ('Tokyo', 'Osaka'), ('Tokyo', 'Kyoto'), ('Tokyo', 'Nagoya'), ('Seoul', 'Busan'),
    ('Toronto', 'Montreal'), ('New York', 'Washington'), ('New York', 'Boston'),
]


def plan(a, b, t):
    q = urllib.parse.urlencode({'fromPlace': '%f,%f' % a, 'toPlace': '%f,%f' % b,
                                'time': t, 'arriveBy': 'false', 'maxItineraries': 8})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': UA})
    with urllib.request.urlopen(req, timeout=90) as r:
        return json.load(r)


def main():
    old = {}
    p = os.path.join(ROOT, 'calibration.json')
    if os.path.exists(p):
        for r in json.load(open(p, encoding='utf-8'))['pairs']:
            old[(r['from'], r['to'])] = r

    out = []
    if os.path.exists(OUT):
        out = json.load(open(OUT, encoding='utf-8'))['routes']
    done = {(r['from'], r['to']) for r in out}

    for i, (fa, tb) in enumerate(ROUTES):
        if (fa, tb) in done:
            continue
        a, b = CITIES[fa], CITIES[tb]
        best, seen = None, 0
        for t in TIMES:
            try:
                d = plan(a, b, t)
            except Exception as ex:
                print('   ! %s %s->%s %s' % (t[11:16], fa, tb, str(ex)[:40]), file=sys.stderr)
                time.sleep(2)
                continue
            for it in d.get('itineraries', []):
                legs = [l for l in it['legs'] if l.get('mode') != 'WALK']
                if not legs:
                    continue
                # Some national feeds carry domestic flights: Oslo to Bergen
                # came back as FLY2 in 2.2 h. This set is surface transport
                if any((l.get('mode') or '').upper() == 'AIRPLANE' for l in legs):
                    continue
                seen += 1
                h = it['duration'] / 3600.0
                if best is None or h < best['hours']:
                    best = {'hours': round(h, 2), 'changes': it.get('transfers'),
                            'via': ' > '.join(str(l.get('routeShortName') or l.get('mode')) for l in legs)[:60],
                            'depart': t[11:16]}
            time.sleep(0.35)
        o = old.get((fa, tb))
        rec = {'from': fa, 'to': tb, 'fromLL': list(a), 'toLL': list(b),
               'itineraries': seen, 'previous': o['hours'] if o else None,
               'prevSrc': o['src'] if o else None, **(best or {'hours': None})}
        out.append(rec)
        mark = ''
        if best and o and o['hours']:
            dd = best['hours'] - o['hours']
            mark = ' (%+.2f h vs the 4-departure figure)' % dd if abs(dd) > 0.05 else ' (unchanged)'
        print('%3d/%d %-11s -> %-12s %s%s' % (i + 1, len(ROUTES), fa, tb,
              ('%.2f h, %s changes, %s' % (best['hours'], best['changes'], best['via'][:38]))
              if best else 'none', mark), flush=True)
        json.dump({'note': 'Transitous, eight departures across one Tuesday, fastest surface '
                           'itinerary. "previous" is the four-departure figure in calibration.json.',
                   'routes': out}, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('done: %d routes' % len(out))


if __name__ == '__main__':
    main()
