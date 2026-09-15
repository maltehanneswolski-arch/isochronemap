# -*- coding: utf-8 -*-
"""Assemble calibration.json: the real 2026 journeys the model is checked
against, city centre to city centre, door to door.

Transitous (open GTFS, fastest surface itinerary over four Tuesday
departures) is the measurement, and it wins wherever it returns one. An
earlier version took the lower of the router and a hand-written timetable
figure, on the theory that a few sampled departures can miss the direct
train. That is true sometimes and it was applied always: it pulled 61 of 166
targets below the measured journey, by up to 2.75 h, and the model was then
tuned to match them. Brussels to Vienna had been set to 9.5 h from "ICE and
Railjet" when no such through working exists; the real fastest is 11.2 h over
four trains and three changes.

So the hand timings below do two narrow jobs only:
  - cover pairs Transitous has no feed for (China, India, Turkey, Latin
    America, Africa, the United States away from the Northeast Corridor);
  - floor an answer that is impossibly quick, which happens where the router
    stitches together a service that is not really running.
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pairs import CITIES

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ACCESS = 0.4                       # to the station and away from it, hours

# Places Transitous has no feed for. (lat, lon)
EXTRA = {
    'Beijing': (39.9042, 116.4074), 'Shanghai': (31.2304, 121.4737), 'Guangzhou': (23.1291, 113.2644),
    'Nanjing': (32.0603, 118.7969), 'Hangzhou': (30.2741, 120.1551), "Xi'an": (34.3416, 108.9398),
    'Shenzhen': (22.5431, 114.0579), 'Harbin': (45.8038, 126.5350), 'Chengdu': (30.5728, 104.0668),
    'Chongqing': (29.5630, 106.5516), 'Wuhan': (30.5928, 114.3055),
    'Taipei': (25.0330, 121.5654), 'Kaohsiung': (22.6273, 120.3014),
    'Delhi': (28.6139, 77.2090), 'Mumbai': (19.0760, 72.8777), 'Kolkata': (22.5726, 88.3639),
    'Ahmedabad': (23.0225, 72.5714), 'Chennai': (13.0827, 80.2707),
    'Los Angeles': (34.0522, -118.2437), 'San Francisco': (37.7749, -122.4194),
    'Miami': (25.7617, -80.1918), 'Orlando': (28.5383, -81.3792),
    'Casablanca': (33.5731, -7.5898), 'Tangier': (35.7595, -5.8340),
    'Cairo': (30.0444, 31.2357), 'Alexandria': (31.2001, 29.9187),
    'Nairobi': (-1.2921, 36.8219), 'Mombasa': (-4.0435, 39.6682),
    'Johannesburg': (-26.2041, 28.0473), 'Cape Town': (-33.9249, 18.4241),
    'Moscow': (55.7558, 37.6173), 'St Petersburg': (59.9311, 30.3609), 'Vladivostok': (43.1155, 131.8855),
    'Mecca': (21.3891, 39.8579), 'Medina': (24.5247, 39.5692), 'Riyadh': (24.7136, 46.6753),
    'Dammam': (26.4207, 50.0888), 'Istanbul': (41.0082, 28.9784), 'Ankara': (39.9334, 32.8597),
    'Tehran': (35.6892, 51.3890), 'Mashhad': (36.2605, 59.6168),
    'Tashkent': (41.2995, 69.2401), 'Samarkand': (39.6542, 66.9597),
    'Jakarta': (-6.2088, 106.8456), 'Bandung': (-6.9175, 107.6191), 'Surabaya': (-7.2575, 112.7521),
    'Bangkok': (13.7563, 100.5018), 'Chiang Mai': (18.7883, 98.9853),
    'Sao Paulo': (-23.5505, -46.6333), 'Rio de Janeiro': (-22.9068, -43.1729),
    'Mexico City': (19.4326, -99.1332), 'Guadalajara': (20.6597, -103.3496),
    'Buenos Aires': (-34.6037, -58.3816), 'Rosario': (-32.9442, -60.6505),
    'Bogota': (4.7110, -74.0721), 'Medellin': (6.2442, -75.5812),
    'Lima': (-12.0464, -77.0428), 'Cusco': (-13.5320, -71.9675),
}

# (from, to, station-to-station hours of the fastest scheduled service, what it is)
CURATED = [
    ('Beijing', 'Shanghai', 4.30, 'G Fuxing'), ('Beijing', 'Guangzhou', 7.83, 'G'),
    ('Shanghai', 'Nanjing', 0.98, 'G'), ('Shanghai', 'Hangzhou', 0.75, 'G'),
    ('Beijing', "Xi'an", 4.33, 'G'), ('Guangzhou', 'Shenzhen', 0.48, 'G'),
    ('Beijing', 'Harbin', 4.83, 'G'), ('Chengdu', 'Chongqing', 0.95, 'G'),
    ('Wuhan', 'Guangzhou', 3.67, 'G'), ('Shanghai', 'Wuhan', 4.20, 'G'),
    ('Taipei', 'Kaohsiung', 1.57, 'THSR'),
    ('Delhi', 'Mumbai', 15.50, 'Rajdhani'), ('Delhi', 'Kolkata', 17.00, 'Rajdhani'),
    ('Mumbai', 'Ahmedabad', 5.42, 'Vande Bharat'), ('Delhi', 'Chennai', 28.00, 'Rajdhani'),
    ('Los Angeles', 'San Francisco', 7.50, 'coach'), ('Miami', 'Orlando', 3.50, 'Brightline'),
    ('Casablanca', 'Tangier', 2.17, 'Al Boraq'), ('Cairo', 'Alexandria', 2.58, 'Talgo'),
    ('Nairobi', 'Mombasa', 4.75, 'Madaraka'), ('Johannesburg', 'Cape Town', 26.00, 'Shosholoza Meyl'),
    ('Moscow', 'St Petersburg', 3.50, 'Sapsan'), ('Moscow', 'Vladivostok', 146.00, 'Rossiya'),
    ('Mecca', 'Medina', 2.33, 'Haramain'), ('Riyadh', 'Dammam', 4.17, 'SAR'),
    ('Istanbul', 'Ankara', 4.17, 'YHT'), ('Tehran', 'Mashhad', 12.00, 'Pardis'),
    ('Tashkent', 'Samarkand', 2.13, 'Afrosiyob'),
    ('Jakarta', 'Bandung', 0.75, 'Whoosh'), ('Jakarta', 'Surabaya', 8.50, 'Argo Bromo'),
    ('Bangkok', 'Chiang Mai', 11.00, 'Special Express'),
    ('Sao Paulo', 'Rio de Janeiro', 6.00, 'coach'), ('Mexico City', 'Guadalajara', 7.00, 'coach ETN'),
    ('Buenos Aires', 'Rosario', 4.00, 'coach'), ('Bogota', 'Medellin', 9.00, 'coach'),
    ('Lima', 'Cusco', 21.00, 'coach'),
]

# A floor only: below 60% of this the router has stitched together something
# that is not a real surface journey (Oslo to Bergen once came back at 2.2 h).
FLOOR = {
    ('Oslo', 'Bergen'): 6.75, ('Oslo', 'Trondheim'): 6.60, ('Oslo', 'Stavanger'): 7.80,
    ('Stockholm', 'Oslo'): 5.50, ('Copenhagen', 'Oslo'): 7.80, ('Helsinki', 'Oulu'): 5.30,
    ('Madrid', 'Lisbon'): 9.50, ('Athens', 'Thessaloniki'): 4.00, ('Zagreb', 'Split'): 6.00,
    ('Budapest', 'Bucharest'): 15.00, ('Sofia', 'Belgrade'): 9.00, ('Bucharest', 'Cluj'): 8.50,
    ('New York', 'Chicago'): 19.00, ('Sydney', 'Brisbane'): 14.00, ('Melbourne', 'Adelaide'): 10.50,
    ('Tokyo', 'Fukuoka'): 4.87, ('Osaka', 'Fukuoka'): 2.40,
    ('Belgrade', 'Budapest'): 6.40, ('Bucharest', 'Budapest'): 15.00,
}


def main():
    tr = json.load(open(os.path.join(ROOT, 'data', 'calibration_transitous.json'), encoding='utf-8'))
    pairs, seen = [], set()
    floored = 0
    for p in tr['pairs']:
        if p.get('hours') is None:
            continue
        fl = FLOOR.get((p['from'], p['to']))
        hours, src = p['hours'], 'transitous'
        if fl is not None and hours < 0.6 * fl:
            hours, src = round(fl + ACCESS, 2), 'floored'
            floored += 1
        elif fl is not None and hours > 1.8 * fl:
            # and a ceiling: Sofia to Belgrade came back at 22.6 h for 327 km,
            # which is 14 km/h. That is the router failing to find the service,
            # not a journey anyone makes
            hours, src = round(fl + ACCESS, 2), 'ceilinged'
            floored += 1
        pairs.append({'from': p['from'], 'to': p['to'], 'fromLL': p['fromLL'], 'toLL': p['toLL'],
                      'hours': hours, 'src': src, 'transitous': p['hours'],
                      'changes': p.get('transfers'), 'via': ' > '.join(p.get('legs', []))[:70]})
        seen.add((p['from'], p['to']))

    where = dict(CITIES)
    where.update(EXTRA)
    for a, b, h, what in CURATED:
        if (a, b) in seen:
            continue
        pairs.append({'from': a, 'to': b, 'fromLL': list(where[a]), 'toLL': list(where[b]),
                      'hours': round(h + ACCESS, 2), 'src': 'timetable',
                      'via': '%s, %.2f h station to station + %.1f access' % (what, h, ACCESS)})
        seen.add((a, b))

    n_tr = sum(1 for p in pairs if p['src'] == 'transitous')
    json.dump({'note': 'Real fastest scheduled surface journeys, city centre to city centre, 2026. '
                       'transitous = api.transitous.org over open GTFS, fastest of four Tuesday '
                       'departures, door to door. timetable = operator timetable station-to-station '
                       '+ 0.4 h access, used only where Transitous has no feed. floored = the router '
                       'returned something impossibly quick and the timetable stands in.',
               'pairs': pairs},
              open(os.path.join(ROOT, 'calibration.json'), 'w', encoding='utf-8'),
              ensure_ascii=False, indent=1)
    print('calibration.json: %d pairs - %d measured by Transitous, %d floored, %d from timetables'
          % (len(pairs), n_tr, floored, len(pairs) - n_tr - floored))


if __name__ == '__main__':
    main()
