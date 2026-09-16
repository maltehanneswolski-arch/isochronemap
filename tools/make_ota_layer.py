# -*- coding: utf-8 -*-
"""Turn the real timetable isochrones into a correction layer.

MOTIS's one-to-all gives, from one origin, the real journey time to every
stop it can reach. Nineteen origins give 6 993 measurements of the fastest
real arrival in a 0.25 degree cell, against which the model runs 19% quick:
the median of model over real is 0.814. City-pair checks had missed this,
because those run hub to hub, while the map draws reachability to everywhere
including places served twice a day.

77% of the variance in that residual is explained by the destination cell
rather than by the pair, so it is a property of the place and can be learnt.
Held out one origin at a time, a factor learnt from the other eighteen moves
that origin's cells from 28% inside a tenth to 35%, so it transfers rather
than merely fitting itself.

The factor is smoothed only lightly and faded out quickly where there is no
measurement: a city centre is a hub and its own correction is near one, so
blurring it into the countryside around it made city-to-city journeys read
ten per cent slow. Written as a byte layer: 100 = no change.
"""
import json, os

RES, GW, GH = 0.25, 1440, 720
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'out', 'ota_factors.json')
DST = os.path.join(ROOT, 'data', 'ota_factor.bin')
LO, HI = 70, 220                  # clamp: never more than a third quick, never over twice slow
SMOOTH = 1                        # cells of neighbourhood to average over
FADE = 2                          # cells over which the correction fades to none


def main():
    d = json.load(open(SRC, encoding='utf-8'))
    raw = {int(k): min(HI, max(LO, int(v))) for k, v in d['cells'].items()}
    print('measured cells: %d (from %d measurements)' % (len(raw), d['n']))

    out = bytearray(b'\x64') * 0                     # built below
    out = bytearray([100]) * 1
    out = bytearray(GW * GH)
    for i in range(GW * GH):
        out[i] = 100

    # a neighbourhood median, so one odd cell does not carry a whole region
    sm = {}
    for c in raw:
        r, col = divmod(c, GW)
        vals = []
        for dr in range(-SMOOTH, SMOOTH + 1):
            rr = r + dr
            if rr < 0 or rr >= GH:
                continue
            for dc in range(-SMOOTH, SMOOTH + 1):
                cc = rr * GW + (col + dc) % GW
                if cc in raw:
                    vals.append(raw[cc])
        vals.sort()
        sm[c] = vals[len(vals) // 2]

    # spread outward, fading back to 100 so there is no wall at the edge
    field = dict(sm)
    frontier = {c: sm[c] for c in sm}          # carry the source value outward
    for step in range(1, FADE + 1):
        nxt = {}
        w = 1.0 - step / (FADE + 1.0)
        for c, src in frontier.items():
            r, col = divmod(c, GW)
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                rr = r + dr
                if rr < 0 or rr >= GH:
                    continue
                cc = rr * GW + (col + dc) % GW
                if cc in field or cc in nxt:
                    continue
                nxt[cc] = src
                field[cc] = int(100 + (src - 100) * w)
        frontier = nxt

    for c, v in field.items():
        out[c] = min(HI, max(LO, v))
    open(DST, 'wb').write(bytes(out))
    vals = sorted(field.values())
    print('layer cells: %d  (median %d, p10 %d, p90 %d)'
          % (len(field), vals[len(vals) // 2], vals[len(vals) // 10], vals[len(vals) * 9 // 10]))
    print('wrote', DST, os.path.getsize(DST), 'bytes')


if __name__ == '__main__':
    main()
