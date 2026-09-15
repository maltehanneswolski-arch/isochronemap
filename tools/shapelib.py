# -*- coding: utf-8 -*-
"""A shapefile and dBase reader, and the inverse Albers Equal Area Conic, with
no dependencies. The machine has no GDAL, and the two things needed here are
small: polyline geometry out of a .shp, attributes out of its .dbf, and the
projection Atack's files are in undone back to longitude and latitude."""
import math, struct


def dbf(path):
    """Yield one dict per record. Enough of dBase III/IV for these files."""
    with open(path, 'rb') as f:
        head = f.read(32)
        nrec, hlen, rlen = struct.unpack('<IHH', head[4:12])
        fields = []
        while True:
            d = f.read(32)
            if d[0:1] in (b'\r', b''):
                break
            name = d[0:11].split(b'\x00')[0].decode('latin-1')
            fields.append((name, d[11:12].decode('latin-1'), d[16]))
        f.seek(hlen)
        for _ in range(nrec):
            rec = f.read(rlen)
            if not rec or rec[0:1] == b'*':          # deleted
                continue
            out, p = {}, 1
            for name, typ, size in fields:
                raw = rec[p:p + size].decode('latin-1').strip()
                p += size
                if typ in 'NF':
                    try: out[name] = float(raw) if ('.' in raw or typ == 'F') else int(raw)
                    except ValueError: out[name] = None
                elif typ == 'L':
                    out[name] = raw.upper() in ('Y', 'T')
                else:
                    out[name] = raw
            yield out


def dbf_fields(path):
    with open(path, 'rb') as f:
        f.read(32)
        out = []
        while True:
            d = f.read(32)
            if d[0:1] in (b'\r', b''):
                return out
            out.append((d[0:11].split(b'\x00')[0].decode('latin-1'), d[11:12].decode('latin-1'), d[16]))


def shp(path):
    """Yield one list-of-parts per record; each part is a list of (x, y).
    Handles shape types 3/13/23 (polyline) and 5/15/25 (polygon)."""
    with open(path, 'rb') as f:
        f.seek(100)
        while True:
            h = f.read(8)
            if len(h) < 8:
                return
            _, clen = struct.unpack('>II', h)
            body = f.read(clen * 2)
            st = struct.unpack('<I', body[0:4])[0]
            if st == 0:
                yield []
                continue
            if st not in (3, 5, 13, 15, 23, 25):
                yield []
                continue
            nparts, npts = struct.unpack('<II', body[36:44])
            parts = struct.unpack('<%dI' % nparts, body[44:44 + 4 * nparts])
            off = 44 + 4 * nparts
            xy = struct.unpack('<%dd' % (2 * npts), body[off:off + 16 * npts])
            out = []
            for k in range(nparts):
                a = parts[k]
                b = parts[k + 1] if k + 1 < nparts else npts
                out.append([(xy[2 * i], xy[2 * i + 1]) for i in range(a, b)])
            yield out


class Albers:
    """Inverse USA_Contiguous_Albers_Equal_Area_Conic on GRS 1980, which is
    what Atack's shapefiles carry: metres back to degrees. Snyder, Map
    Projections - A Working Manual, pp. 100-102."""

    def __init__(self, lat0=37.5, lon0=-96.0, sp1=29.5, sp2=45.5,
                 a=6378137.0, invf=298.257222101):
        self.a = a
        f = 1.0 / invf
        self.e2 = 2 * f - f * f
        self.e = math.sqrt(self.e2)
        self.lon0 = math.radians(lon0)
        q0, q1, q2 = (self._q(math.radians(v)) for v in (lat0, sp1, sp2))
        m1 = self._m(math.radians(sp1))
        m2 = self._m(math.radians(sp2))
        self.n = (m1 * m1 - m2 * m2) / (q2 - q1)
        self.C = m1 * m1 + self.n * q1
        self.rho0 = a * math.sqrt(self.C - self.n * q0) / self.n

    def _m(self, p):
        s = math.sin(p)
        return math.cos(p) / math.sqrt(1 - self.e2 * s * s)

    def _q(self, p):
        s = math.sin(p)
        es = self.e * s
        return (1 - self.e2) * (s / (1 - self.e2 * s * s)
                                - (1 / (2 * self.e)) * math.log((1 - es) / (1 + es)))

    def inverse(self, x, y):
        rho = math.hypot(x, self.rho0 - y)
        theta = math.atan2(x, self.rho0 - y) if self.n > 0 else math.atan2(-x, y - self.rho0)
        q = (self.C - (rho * self.n / self.a) ** 2) / self.n
        # authalic latitude, then Newton on q
        p = math.asin(max(-1.0, min(1.0, q / 2)))
        for _ in range(12):
            s, c = math.sin(p), math.cos(p)
            es = self.e * s
            d = (1 - self.e2 * s * s) ** 2 / (2 * c) * (
                q / (1 - self.e2) - s / (1 - self.e2 * s * s)
                + (1 / (2 * self.e)) * math.log((1 - es) / (1 + es)))
            p += d
            if abs(d) < 1e-12:
                break
        return math.degrees(self.lon0 + theta / self.n), math.degrees(p)
