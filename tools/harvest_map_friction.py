# -*- coding: utf-8 -*-
"""The Malaria Atlas Project's global friction surface, fetched through its
WCS and reduced to the 0.25 degree grid.

Weiss et al. 2018 (Nature) and 2020 (Nature Medicine) publish a 30 arc-second
raster of minutes-per-metre for land travel, built from OSM roads, railways,
navigable rivers, land cover, slope and borders. That is the measured version
of what this project approximates with road class times country mean speed
times terrain, so it is worth carrying directly.

The server refuses scalesize and returns a truncated file for Deflate, so the
raster comes down at native resolution in 10-degree tiles, each reduced as it
arrives and thrown away. Only tiles holding land are asked for. Two statistics
are kept per cell: the fastest pixel in it, which matches how this model reads
a road class from a cell, and the median, which is what crossing the cell off
the road would cost. Output: data/map_friction.bin, two bytes a cell, km/h.
"""
import base64, io, os, re, sys, time, urllib.request

import numpy as np
from PIL import Image
Image.MAX_IMAGE_PIXELS = None

RES, GW, GH = 0.25, 1440, 720
STEP = 10                                    # tile side in degrees
NAT = 120                                    # native pixels per degree
BLOCK = int(RES * NAT)                       # 30 native pixels per cell
LAT_HI, LAT_LO = 85, -60                     # coverage of the product
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, 'data')
BASE = ('https://data.malariaatlas.org/geoserver/Accessibility/ows?service=WCS&version=2.0.1'
        '&request=GetCoverage&coverageId=Accessibility__202001_Global_Motorized_Friction_Surface'
        '&format=image/geotiff')
UA = 'isochrone-globe/1.0 (research; github maltehanneswolski-arch/isochronemap)'
WATER = 0.00316                              # MAP's value for open water


def land_mask():
    """The project's own land layer, out of grid.js."""
    src = open(os.path.join(ROOT, 'grid.js'), encoding='utf-8').read()
    b64 = re.search(r'"land":"([^"]*)"', src).group(1)
    raw = base64.b64decode(b64)
    out = np.zeros(GW * GH, np.uint8)
    p = o = 0
    while p < len(raw):
        v = raw[p]; p += 1
        n = raw[p]; p += 1
        if n == 254:
            n = raw[p] | (raw[p + 1] << 8); p += 2
        elif n == 255:
            n = raw[p] | (raw[p + 1] << 8) | (raw[p + 2] << 16); p += 3
        out[o:o + n] = v; o += n
    return out.reshape(GH, GW)


def fetch(lon0, lat0, tries=4):
    url = '%s&subset=Long(%d,%d)&subset=Lat(%d,%d)' % (BASE, lon0, lon0 + STEP, lat0, lat0 + STEP)
    for k in range(tries):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=300) as r:
                body = r.read()
            a = np.array(Image.open(io.BytesIO(body)))
            if a.shape != (STEP * NAT, STEP * NAT):
                raise ValueError('shape %s' % (a.shape,))
            return a
        except Exception as ex:
            print('    retry %d: %s' % (k + 1, str(ex)[:70]), flush=True)
            time.sleep(4 * (k + 1))
    return None


def main():
    land = land_mask()
    fast = np.zeros((GH, GW), np.uint8)       # km/h from the fastest pixel in the cell
    typ = np.zeros((GH, GW), np.uint8)        # km/h from the median pixel
    todo = []
    for lat0 in range(LAT_LO, LAT_HI, STEP):
        for lon0 in range(-180, 180, STEP):
            r0 = int((90 - (lat0 + STEP)) / RES)
            c0 = int((lon0 + 180) / RES)
            if land[r0:r0 + int(STEP / RES), c0:c0 + int(STEP / RES)].any():
                todo.append((lon0, lat0, r0, c0))
    print('tiles holding land: %d of %d' % (todo and len(todo) or 0,
          (360 // STEP) * ((LAT_HI - LAT_LO) // STEP)), flush=True)

    done = 0
    for lon0, lat0, r0, c0 in todo:
        a = fetch(lon0, lat0)
        done += 1
        if a is None:
            print('%3d/%d  (%4d,%4d) FAILED' % (done, len(todo), lon0, lat0), flush=True)
            continue
        n = int(STEP / RES)                       # 40 cells a side
        blk = a.reshape(n, BLOCK, n, BLOCK)
        mn = blk.min(axis=(1, 3))
        md = np.median(blk, axis=(1, 3))
        with np.errstate(divide='ignore', invalid='ignore'):
            sf = np.where(mn > 0, 0.06 / mn, 0)   # min/m -> km/h
            st = np.where(md > 0, 0.06 / md, 0)
        # anything at the open-water value carries no land speed
        st = np.where(np.isclose(md, WATER, rtol=1e-3), 0, st)
        fast[r0:r0 + n, c0:c0 + n] = np.clip(np.nan_to_num(sf), 0, 255).astype(np.uint8)
        typ[r0:r0 + n, c0:c0 + n] = np.clip(np.nan_to_num(st), 0, 255).astype(np.uint8)
        if done % 10 == 0 or done == len(todo):
            print('%3d/%d  (%4d,%4d) ok' % (done, len(todo), lon0, lat0), flush=True)
        time.sleep(0.3)

    out = os.path.join(DATA, 'map_friction.bin')
    with open(out, 'wb') as f:
        f.write(fast.tobytes()); f.write(typ.tobytes())
    onland = land.astype(bool)
    print('wrote', out, os.path.getsize(out), 'bytes')
    print('land cells with a speed: %d of %d' % (int((fast[onland] > 0).sum()), int(onland.sum())))
    for name, arr in (('fastest', fast), ('median', typ)):
        v = arr[onland & (arr > 0)]
        if v.size:
            print('  %s km/h: p10 %d  median %d  p90 %d  max %d'
                  % (name, np.percentile(v, 10), np.median(v), np.percentile(v, 90), v.max()))


if __name__ == '__main__':
    main()
