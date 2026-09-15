# -*- coding: utf-8 -*-
"""The city pairs the model is checked against, and where the cities are.

Coordinates are city centres, because the targets are door-to-door journeys
and the model measures cell to cell. Pairs are chosen for spread rather than
for being easy: short hops and long crossings, single corridors and journeys
that need three changes, in every region whose timetables Transitous can
reach (Europe, Japan, Korea, Canada, Australia, parts of the United States).
"""

CITIES = {
    # --- Britain and Ireland
    'London': (51.5074, -0.1278), 'Birmingham': (52.4862, -1.8904), 'Manchester': (53.4808, -2.2426),
    'Leeds': (53.8008, -1.5491), 'Liverpool': (53.4084, -2.9916), 'Newcastle': (54.9783, -1.6178),
    'Edinburgh': (55.9533, -3.1883), 'Glasgow': (55.8642, -4.2518), 'Cardiff': (51.4816, -3.1791),
    'Bristol': (51.4545, -2.5879), 'York': (53.9600, -1.0873), 'Sheffield': (53.3811, -1.4701),
    'Dublin': (53.3498, -6.2603), 'Cork': (51.8985, -8.4756), 'Belfast': (54.5973, -5.9301),
    'Galway': (53.2707, -9.0568),
    # --- France, Benelux
    'Paris': (48.8566, 2.3522), 'Lyon': (45.7640, 4.8357), 'Marseille': (43.2965, 5.3698),
    'Bordeaux': (44.8378, -0.5792), 'Toulouse': (43.6047, 1.4442), 'Nice': (43.7102, 7.2620),
    'Nantes': (47.2184, -1.5536), 'Rennes': (48.1173, -1.6778), 'Strasbourg': (48.5734, 7.7521),
    'Lille': (50.6292, 3.0573), 'Montpellier': (43.6108, 3.8767), 'Dijon': (47.3220, 5.0415),
    'Brussels': (50.8466, 4.3528), 'Antwerp': (51.2194, 4.4025), 'Liege': (50.6326, 5.5797),
    'Luxembourg': (49.6116, 6.1319), 'Amsterdam': (52.3676, 4.9041), 'Rotterdam': (51.9244, 4.4777),
    'Utrecht': (52.0907, 5.1214), 'Groningen': (53.2194, 6.5665), 'Eindhoven': (51.4416, 5.4697),
    # --- Germany, Austria, Switzerland
    'Berlin': (52.5200, 13.4050), 'Hamburg': (53.5511, 9.9937), 'Munich': (48.1351, 11.5820),
    'Cologne': (50.9375, 6.9603), 'Frankfurt': (50.1109, 8.6821), 'Stuttgart': (48.7758, 9.1829),
    'Dusseldorf': (51.2277, 6.7735), 'Leipzig': (51.3397, 12.3731), 'Dresden': (51.0504, 13.7373),
    'Hanover': (52.3759, 9.7320), 'Nuremberg': (49.4521, 11.0767), 'Bremen': (53.0793, 8.8017),
    'Freiburg': (47.9990, 7.8421), 'Kiel': (54.3233, 10.1228), 'Erfurt': (50.9787, 11.0328),
    'Vienna': (48.2082, 16.3738), 'Salzburg': (47.8095, 13.0550), 'Graz': (47.0707, 15.4395),
    'Innsbruck': (47.2692, 11.4041), 'Linz': (48.3069, 14.2858), 'Klagenfurt': (46.6247, 14.3050),
    'Zurich': (47.3769, 8.5417), 'Geneva': (46.2044, 6.1432), 'Basel': (47.5596, 7.5886),
    'Bern': (46.9480, 7.4474), 'Lausanne': (46.5197, 6.6323), 'Lugano': (46.0037, 8.9511),
    # --- Italy, Iberia
    'Milan': (45.4642, 9.1900), 'Rome': (41.9028, 12.4964), 'Naples': (40.8518, 14.2681),
    'Turin': (45.0703, 7.6869), 'Venice': (45.4408, 12.3155), 'Florence': (43.7696, 11.2558),
    'Bologna': (44.4949, 11.3426), 'Genoa': (44.4056, 8.9463), 'Verona': (45.4384, 10.9916),
    'Bari': (41.1171, 16.8719), 'Palermo': (38.1157, 13.3615), 'Pisa': (43.7228, 10.4017),
    'Madrid': (40.4168, -3.7038), 'Barcelona': (41.3874, 2.1686), 'Seville': (37.3891, -5.9845),
    'Valencia': (39.4699, -0.3763), 'Malaga': (36.7213, -4.4214), 'Bilbao': (43.2630, -2.9350),
    'Zaragoza': (41.6488, -0.8891), 'Alicante': (38.3452, -0.4810), 'Cordoba': (37.8882, -4.7794),
    'Lisbon': (38.7223, -9.1393), 'Porto': (41.1579, -8.6291), 'Coimbra': (40.2033, -8.4103),
    # --- Nordics and the Baltic
    'Copenhagen': (55.6761, 12.5683), 'Aarhus': (56.1629, 10.2039), 'Odense': (55.4038, 10.4024),
    'Stockholm': (59.3293, 18.0686), 'Gothenburg': (57.7089, 11.9746), 'Malmo': (55.6050, 13.0038),
    'Uppsala': (59.8586, 17.6389), 'Oslo': (59.9139, 10.7522), 'Bergen': (60.3913, 5.3221),
    'Trondheim': (63.4305, 10.3951), 'Stavanger': (58.9700, 5.7331),
    'Helsinki': (60.1699, 24.9384), 'Tampere': (61.4978, 23.7610), 'Turku': (60.4518, 22.2666),
    'Oulu': (65.0121, 25.4651), 'Tallinn': (59.4370, 24.7536), 'Riga': (56.9496, 24.1052),
    'Vilnius': (54.6872, 25.2797),
    # --- Central and Eastern Europe
    'Prague': (50.0755, 14.4378), 'Brno': (49.1951, 16.6068), 'Ostrava': (49.8209, 18.2625),
    'Warsaw': (52.2297, 21.0122), 'Krakow': (50.0647, 19.9450), 'Gdansk': (54.3520, 18.6466),
    'Wroclaw': (51.1079, 17.0385), 'Poznan': (52.4064, 16.9252), 'Katowice': (50.2649, 19.0238),
    'Budapest': (47.4979, 19.0402), 'Debrecen': (47.5316, 21.6273), 'Bratislava': (48.1486, 17.1077),
    'Ljubljana': (46.0569, 14.5058), 'Zagreb': (45.8150, 15.9819), 'Split': (43.5081, 16.4402),
    'Belgrade': (44.7866, 20.4489), 'Bucharest': (44.4268, 26.1025), 'Cluj': (46.7712, 23.6236),
    'Sofia': (42.6977, 23.3219), 'Thessaloniki': (40.6401, 22.9444), 'Athens': (37.9838, 23.7275),
    # --- beyond Europe, where the feeds reach
    'Tokyo': (35.6812, 139.7671), 'Osaka': (34.7024, 135.4959), 'Kyoto': (34.9858, 135.7588),
    'Nagoya': (35.1706, 136.8816), 'Sendai': (38.2601, 140.8819), 'Hiroshima': (34.3975, 132.4753),
    'Fukuoka': (33.5902, 130.4207), 'Kanazawa': (36.5780, 136.6486), 'Niigata': (37.9122, 139.0619),
    'Seoul': (37.5547, 126.9707), 'Busan': (35.1151, 129.0416), 'Daejeon': (36.3325, 127.4340),
    'Gwangju': (35.1595, 126.8526), 'Daegu': (35.8797, 128.6285),
    'Toronto': (43.6452, -79.3806), 'Montreal': (45.4999, -73.5665), 'Ottawa': (45.4166, -75.7013),
    'Quebec City': (46.8139, -71.2080), 'Vancouver': (49.2827, -123.1207),
    'Sydney': (-33.8830, 151.2060), 'Melbourne': (-37.8183, 144.9671), 'Brisbane': (-27.4653, 153.0235),
    'Canberra': (-35.2809, 149.1300), 'Adelaide': (-34.9285, 138.6007),
    'New York': (40.7506, -73.9935), 'Boston': (42.3519, -71.0552), 'Washington': (38.8977, -77.0065),
    'Philadelphia': (39.9556, -75.1820), 'Chicago': (41.8786, -87.6251),
}

PAIRS = [
    # --- Britain and Ireland (22)
    ('London', 'Birmingham'), ('London', 'Manchester'), ('London', 'Leeds'), ('London', 'Liverpool'),
    ('London', 'Newcastle'), ('London', 'Edinburgh'), ('London', 'Glasgow'), ('London', 'Cardiff'),
    ('London', 'Bristol'), ('London', 'York'), ('London', 'Sheffield'), ('Manchester', 'Edinburgh'),
    ('Manchester', 'Birmingham'), ('Manchester', 'Liverpool'), ('Manchester', 'Leeds'),
    ('Edinburgh', 'Glasgow'), ('Edinburgh', 'Newcastle'), ('Birmingham', 'Bristol'),
    ('Dublin', 'Cork'), ('Dublin', 'Belfast'), ('Dublin', 'Galway'), ('London', 'Amsterdam'),
    # --- France and Benelux (30)
    ('Paris', 'Lyon'), ('Paris', 'Marseille'), ('Paris', 'Bordeaux'), ('Paris', 'Toulouse'),
    ('Paris', 'Nice'), ('Paris', 'Nantes'), ('Paris', 'Rennes'), ('Paris', 'Strasbourg'),
    ('Paris', 'Lille'), ('Paris', 'Montpellier'), ('Paris', 'Dijon'), ('Paris', 'Brussels'),
    ('Paris', 'London'), ('Paris', 'Amsterdam'), ('Paris', 'Frankfurt'), ('Paris', 'Geneva'),
    ('Lyon', 'Marseille'), ('Lyon', 'Bordeaux'), ('Lyon', 'Strasbourg'), ('Marseille', 'Nice'),
    ('Bordeaux', 'Toulouse'), ('Lille', 'Brussels'), ('Brussels', 'Antwerp'), ('Brussels', 'Liege'),
    ('Brussels', 'Amsterdam'), ('Brussels', 'Luxembourg'), ('Brussels', 'Cologne'),
    ('Amsterdam', 'Rotterdam'), ('Amsterdam', 'Groningen'), ('Amsterdam', 'Eindhoven'),
    # --- Germany, Austria, Switzerland (44)
    ('Berlin', 'Hamburg'), ('Berlin', 'Munich'), ('Berlin', 'Cologne'), ('Berlin', 'Frankfurt'),
    ('Berlin', 'Leipzig'), ('Berlin', 'Dresden'), ('Berlin', 'Hanover'), ('Berlin', 'Nuremberg'),
    ('Berlin', 'Stuttgart'), ('Berlin', 'Bremen'), ('Berlin', 'Erfurt'),
    ('Hamburg', 'Munich'), ('Hamburg', 'Cologne'), ('Hamburg', 'Frankfurt'), ('Hamburg', 'Bremen'),
    ('Hamburg', 'Hanover'), ('Hamburg', 'Kiel'), ('Hamburg', 'Copenhagen'),
    ('Frankfurt', 'Cologne'), ('Frankfurt', 'Munich'), ('Frankfurt', 'Stuttgart'),
    ('Frankfurt', 'Nuremberg'), ('Frankfurt', 'Basel'), ('Frankfurt', 'Hanover'),
    ('Frankfurt', 'Dusseldorf'), ('Frankfurt', 'Freiburg'),
    ('Munich', 'Nuremberg'), ('Munich', 'Stuttgart'), ('Munich', 'Salzburg'), ('Munich', 'Innsbruck'),
    ('Munich', 'Vienna'), ('Munich', 'Zurich'), ('Cologne', 'Dusseldorf'), ('Leipzig', 'Dresden'),
    ('Vienna', 'Salzburg'), ('Vienna', 'Graz'), ('Vienna', 'Linz'), ('Vienna', 'Innsbruck'),
    ('Vienna', 'Klagenfurt'), ('Vienna', 'Budapest'), ('Vienna', 'Prague'), ('Vienna', 'Bratislava'),
    ('Zurich', 'Bern'), ('Zurich', 'Geneva'),
    # --- Switzerland and Italy (24)
    ('Zurich', 'Basel'), ('Zurich', 'Lugano'), ('Zurich', 'Milan'), ('Zurich', 'Innsbruck'),
    ('Geneva', 'Lausanne'), ('Bern', 'Lausanne'),
    ('Milan', 'Rome'), ('Milan', 'Turin'), ('Milan', 'Venice'), ('Milan', 'Florence'),
    ('Milan', 'Bologna'), ('Milan', 'Genoa'), ('Milan', 'Naples'), ('Milan', 'Verona'),
    ('Rome', 'Naples'), ('Rome', 'Florence'), ('Rome', 'Venice'), ('Rome', 'Bologna'),
    ('Rome', 'Bari'), ('Rome', 'Turin'), ('Rome', 'Pisa'), ('Florence', 'Venice'),
    ('Bologna', 'Venice'), ('Naples', 'Bari'),
    # --- Iberia (18)
    ('Madrid', 'Barcelona'), ('Madrid', 'Seville'), ('Madrid', 'Valencia'), ('Madrid', 'Malaga'),
    ('Madrid', 'Bilbao'), ('Madrid', 'Zaragoza'), ('Madrid', 'Alicante'), ('Madrid', 'Cordoba'),
    ('Madrid', 'Lisbon'), ('Barcelona', 'Valencia'), ('Barcelona', 'Zaragoza'),
    ('Barcelona', 'Seville'), ('Seville', 'Malaga'), ('Seville', 'Cordoba'),
    ('Valencia', 'Alicante'), ('Lisbon', 'Porto'), ('Lisbon', 'Coimbra'), ('Porto', 'Coimbra'),
    # --- Nordics and Baltic (20)
    ('Copenhagen', 'Aarhus'), ('Copenhagen', 'Odense'), ('Copenhagen', 'Malmo'),
    ('Copenhagen', 'Stockholm'), ('Copenhagen', 'Oslo'), ('Copenhagen', 'Gothenburg'),
    ('Stockholm', 'Gothenburg'), ('Stockholm', 'Malmo'), ('Stockholm', 'Uppsala'),
    ('Stockholm', 'Oslo'), ('Gothenburg', 'Malmo'), ('Oslo', 'Bergen'), ('Oslo', 'Trondheim'),
    ('Oslo', 'Stavanger'), ('Helsinki', 'Tampere'), ('Helsinki', 'Turku'), ('Helsinki', 'Oulu'),
    ('Tampere', 'Oulu'), ('Riga', 'Vilnius'), ('Tallinn', 'Riga'),
    # --- Central and Eastern Europe (26)
    ('Prague', 'Brno'), ('Prague', 'Ostrava'), ('Prague', 'Budapest'), ('Prague', 'Warsaw'),
    ('Prague', 'Krakow'), ('Prague', 'Berlin'), ('Prague', 'Dresden'),
    ('Warsaw', 'Krakow'), ('Warsaw', 'Gdansk'), ('Warsaw', 'Wroclaw'), ('Warsaw', 'Poznan'),
    ('Warsaw', 'Katowice'), ('Warsaw', 'Berlin'), ('Krakow', 'Katowice'), ('Krakow', 'Wroclaw'),
    ('Budapest', 'Debrecen'), ('Budapest', 'Bratislava'), ('Budapest', 'Zagreb'),
    ('Budapest', 'Bucharest'), ('Zagreb', 'Ljubljana'), ('Zagreb', 'Split'),
    ('Ljubljana', 'Venice'), ('Belgrade', 'Budapest'), ('Sofia', 'Belgrade'),
    ('Athens', 'Thessaloniki'), ('Bucharest', 'Cluj'),
    # --- Japan and Korea (18)
    ('Tokyo', 'Osaka'), ('Tokyo', 'Kyoto'), ('Tokyo', 'Nagoya'), ('Tokyo', 'Sendai'),
    ('Tokyo', 'Hiroshima'), ('Tokyo', 'Fukuoka'), ('Tokyo', 'Kanazawa'), ('Tokyo', 'Niigata'),
    ('Osaka', 'Kyoto'), ('Osaka', 'Hiroshima'), ('Osaka', 'Fukuoka'), ('Osaka', 'Nagoya'),
    ('Nagoya', 'Kyoto'), ('Seoul', 'Busan'), ('Seoul', 'Daejeon'), ('Seoul', 'Gwangju'),
    ('Seoul', 'Daegu'), ('Busan', 'Daegu'),
    # --- Canada, Australia, United States (16)
    ('Toronto', 'Montreal'), ('Toronto', 'Ottawa'), ('Montreal', 'Ottawa'),
    ('Montreal', 'Quebec City'), ('Toronto', 'Quebec City'),
    ('Sydney', 'Melbourne'), ('Sydney', 'Brisbane'), ('Sydney', 'Canberra'),
    ('Melbourne', 'Adelaide'), ('Melbourne', 'Canberra'),
    ('New York', 'Boston'), ('New York', 'Washington'), ('New York', 'Philadelphia'),
    ('Washington', 'Philadelphia'), ('Boston', 'Philadelphia'), ('New York', 'Chicago'),
]

if __name__ == '__main__':
    miss = {c for p in PAIRS for c in p} - set(CITIES)
    assert not miss, miss
    print('%d cities, %d pairs' % (len(CITIES), len(PAIRS)))
