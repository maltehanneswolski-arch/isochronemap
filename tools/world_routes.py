# -*- coding: utf-8 -*-
"""A global check set: eight destinations from each of twenty-four origins
spread across every inhabited continent, not only Europe.

Some of these are places with no passenger railway at all - Tripoli, La Paz,
Lagos - where the real scheduled journey is a long-distance coach. That is
still a scheduled journey and the model should get it right, so they are in.
"""

WORLD = {
    # ---------------------------------------------------------- Europe
    'Brussels': (50.8466, 4.3528), 'London': (51.5074, -0.1278), 'Berlin': (52.5200, 13.4050),
    'Vienna': (48.2082, 16.3738), 'Rome': (41.9028, 12.4964), 'Madrid': (40.4168, -3.7038),
    'Prague': (50.0755, 14.4378), 'Athens': (37.9838, 23.7275), 'Sarajevo': (43.8563, 18.4131),
    'Moscow': (55.7558, 37.6173), 'Istanbul': (41.0082, 28.9784), 'Stockholm': (59.3293, 18.0686),
    'Paris': (48.8566, 2.3522), 'Warsaw': (52.2297, 21.0122), 'Zagreb': (45.8150, 15.9819),
    'Belgrade': (44.7866, 20.4489), 'Sofia': (42.6977, 23.3219), 'Bucharest': (44.4268, 26.1025),
    'Budapest': (47.4979, 19.0402), 'Ljubljana': (46.0569, 14.5058), 'Skopje': (41.9981, 21.4254),
    'Podgorica': (42.4304, 19.2594), 'Tirana': (41.3275, 19.8187), 'Thessaloniki': (40.6401, 22.9444),
    'Split': (43.5081, 16.4402), 'Venice': (45.4408, 12.3155), 'Munich': (48.1351, 11.5820),
    'Milan': (45.4642, 9.1900), 'Naples': (40.8518, 14.2681), 'Florence': (43.7696, 11.2558),
    'Barcelona': (41.3874, 2.1686), 'Seville': (37.3891, -5.9845), 'Valencia': (39.4699, -0.3763),
    'Lisbon': (38.7223, -9.1393), 'Porto': (41.1579, -8.6291), 'Bilbao': (43.2630, -2.9350),
    'Amsterdam': (52.3676, 4.9041), 'Cologne': (50.9375, 6.9603), 'Frankfurt': (50.1109, 8.6821),
    'Hamburg': (53.5511, 9.9937), 'Copenhagen': (55.6761, 12.5683), 'Oslo': (59.9139, 10.7522),
    'Helsinki': (60.1699, 24.9384), 'Krakow': (50.0647, 19.9450), 'Brno': (49.1951, 16.6068),
    'Bratislava': (48.1486, 17.1077), 'Graz': (47.0707, 15.4395), 'Salzburg': (47.8095, 13.0550),
    'Edinburgh': (55.9533, -3.1883), 'Manchester': (53.4808, -2.2426), 'Birmingham': (52.4862, -1.8904),
    'Glasgow': (55.8642, -4.2518), 'Cardiff': (51.4816, -3.1791), 'Dublin': (53.3498, -6.2603),
    'Kyiv': (50.4501, 30.5234), 'Minsk': (53.9006, 27.5590), 'Riga': (56.9496, 24.1052),
    'St Petersburg': (59.9311, 30.3609), 'Nizhny Novgorod': (56.3269, 44.0059),
    'Kazan': (55.7963, 49.1088), 'Rostov': (47.2357, 39.7015), 'Samara': (53.2415, 50.2212),
    'Yekaterinburg': (56.8389, 60.6057), 'Volgograd': (48.7080, 44.5133), 'Sochi': (43.5855, 39.7231),
    'Ankara': (39.9334, 32.8597), 'Izmir': (38.4237, 27.1428), 'Bursa': (40.1885, 29.0610),
    # ---------------------------------------------------------- Africa
    'Tripoli': (32.8872, 13.1913), 'Benghazi': (32.1167, 20.0686), 'Misrata': (32.3754, 15.0925),
    'Sabha': (27.0377, 14.4283), 'Sirte': (31.2089, 16.5887), 'Tunis': (36.8065, 10.1815),
    'Cairo': (30.0444, 31.2357), 'Alexandria': (31.2001, 29.9187), 'Luxor': (25.6872, 32.6396),
    'Aswan': (24.0889, 32.8998), 'Port Said': (31.2653, 32.3019), 'Asyut': (27.1783, 31.1859),
    'Nairobi': (-1.2921, 36.8219), 'Mombasa': (-4.0435, 39.6682), 'Kisumu': (-0.0917, 34.7680),
    'Arusha': (-3.3869, 36.6830), 'Kampala': (0.3476, 32.5825), 'Dar es Salaam': (-6.7924, 39.2083),
    'Johannesburg': (-26.2041, 28.0473), 'Cape Town': (-33.9249, 18.4241), 'Durban': (-29.8587, 31.0218),
    'Pretoria': (-25.7479, 28.2293), 'Bloemfontein': (-29.0852, 26.1596), 'Gaborone': (-24.6282, 25.9231),
    'Lagos': (6.5244, 3.3792), 'Ibadan': (7.3776, 3.9470), 'Abuja': (9.0765, 7.3986),
    'Accra': (5.6037, -0.1870), 'Casablanca': (33.5731, -7.5898), 'Tangier': (35.7595, -5.8340),
    'Marrakesh': (31.6295, -7.9811), 'Rabat': (34.0209, -6.8416), 'Fes': (34.0331, -5.0003),
    'Algiers': (36.7538, 3.0588), 'Oran': (35.6969, -0.6331),
    # ---------------------------------------------------------- Americas
    'New York': (40.7506, -73.9935), 'Washington': (38.8977, -77.0065), 'Boston': (42.3519, -71.0552),
    'Philadelphia': (39.9556, -75.1820), 'Chicago': (41.8786, -87.6251), 'Pittsburgh': (40.4406, -79.9959),
    'Baltimore': (39.2904, -76.6122), 'Richmond': (37.5407, -77.4360), 'Albany': (42.6526, -73.7562),
    'Los Angeles': (34.0522, -118.2437), 'San Diego': (32.7157, -117.1611), 'San Francisco': (37.7749, -122.4194),
    'Las Vegas': (36.1699, -115.1398), 'Phoenix': (33.4484, -112.0740), 'Sacramento': (38.5816, -121.4944),
    'Santa Barbara': (34.4208, -119.6982), 'Bakersfield': (35.3733, -119.0187),
    'Toronto': (43.6452, -79.3806), 'Montreal': (45.4999, -73.5665),
    'Mexico City': (19.4326, -99.1332), 'Guadalajara': (20.6597, -103.3496), 'Monterrey': (25.6866, -100.3161),
    'Puebla': (19.0414, -98.2063), 'Queretaro': (20.5888, -100.3899), 'Oaxaca': (17.0732, -96.7266),
    'Veracruz': (19.1738, -96.1342), 'Merida': (20.9674, -89.5926), 'Acapulco': (16.8531, -99.8237),
    'La Paz': (-16.4897, -68.1193), 'Cochabamba': (-17.3895, -66.1568), 'Santa Cruz': (-17.7833, -63.1821),
    'Oruro': (-17.9833, -67.1500), 'Sucre': (-19.0196, -65.2619), 'Potosi': (-19.5836, -65.7531),
    'Arica': (-18.4783, -70.3126), 'Puno': (-15.8402, -70.0219), 'Lima': (-12.0464, -77.0428),
    'Sao Paulo': (-23.5505, -46.6333), 'Rio de Janeiro': (-22.9068, -43.1729),
    'Buenos Aires': (-34.6037, -58.3816), 'Bogota': (4.7110, -74.0721), 'Santiago': (-33.4489, -70.6693),
    # ---------------------------------------------------------- Asia
    'Tokyo': (35.6812, 139.7671), 'Osaka': (34.7024, 135.4959), 'Kyoto': (34.9858, 135.7588),
    'Seoul': (37.5547, 126.9707), 'Busan': (35.1151, 129.0416),
    'Beijing': (39.9042, 116.4074), 'Shanghai': (31.2304, 121.4737), 'Guangzhou': (23.1291, 113.2644),
    'Delhi': (28.6139, 77.2090), 'Mumbai': (19.0760, 72.8777), 'Kolkata': (22.5726, 88.3639),
    'Bangkok': (13.7563, 100.5018), 'Jakarta': (-6.2088, 106.8456), 'Singapore': (1.3521, 103.8198),
    'Kuala Lumpur': (3.1390, 101.6869), 'Tashkent': (41.2995, 69.2401), 'Riyadh': (24.7136, 46.6753),
    'Tehran': (35.6892, 51.3890),
    # ---------------------------------------------------------- Oceania
    'Melbourne': (-37.8183, 144.9671), 'Sydney': (-33.8830, 151.2060), 'Brisbane': (-27.4653, 153.0235),
    'Adelaide': (-34.9285, 138.6007), 'Canberra': (-35.2809, 149.1300), 'Geelong': (-38.1499, 144.3617),
    'Ballarat': (-37.5622, 143.8503), 'Bendigo': (-36.7570, 144.2794), 'Albury': (-36.0737, 146.9135),
    'Perth': (-31.9523, 115.8613), 'Auckland': (-36.8485, 174.7633), 'Wellington': (-41.2866, 174.7756),
    # ---------------------------------------------------------- the rest
    'Addis Ababa': (9.0320, 38.7469), 'Agadir': (30.4278, -9.5981), 'Agra': (27.1767, 78.0081),
    'Ahmedabad': (23.0225, 72.5714), 'Atlanta': (33.7490, -84.3880), 'Ayutthaya': (14.3532, 100.5689),
    'Belo Horizonte': (-19.9167, -43.9345), 'Brasilia': (-15.7939, -47.8828), 'Bulawayo': (-20.1325, 28.6265),
    'Campinas': (-22.9099, -47.0626), 'Chengdu': (30.5728, 104.0668), 'Chennai': (13.0827, 80.2707),
    'Chiang Mai': (18.7883, 98.9853), 'Cotonou': (6.3703, 2.3912), 'Curitiba': (-25.4284, -49.2733),
    'Dodoma': (-6.1630, 35.7516), 'Florianopolis': (-27.5954, -48.5480), 'Fukuoka': (33.5902, 130.4207),
    'Harbin': (45.8038, 126.5350), 'Hiroshima': (34.3975, 132.4753), 'Hua Hin': (12.5684, 99.9577),
    'Jaipur': (26.9124, 75.7873), 'Kaduna': (10.5222, 7.4383), 'Kanazawa': (36.5780, 136.6486),
    'Kano': (12.0022, 8.5920), 'Khartoum': (15.5007, 32.5599), 'Kigali': (-1.9441, 30.0619),
    'Lome': (6.1725, 1.2314), 'Lucknow': (26.8467, 80.9462), 'Maputo': (-25.9692, 32.5732),
    'Nagoya': (35.1706, 136.8816), 'Niigata': (37.9122, 139.0619), 'Nong Khai': (17.8783, 102.7412),
    'Oujda': (34.6867, -1.9114), 'Pattaya': (12.9236, 100.8825), 'Phnom Penh': (11.5564, 104.9282),
    'Port Harcourt': (4.8156, 7.0498), 'Porto Alegre': (-30.0346, -51.2177), 'Sendai': (38.2601, 140.8819),
    'Shenyang': (41.8057, 123.4315), 'Surat Thani': (9.1382, 99.3215), 'Tel Aviv': (32.0853, 34.7818),
    'Tianjin': (39.3434, 117.3616), 'Tijuana': (32.5149, -117.0382), 'Varanasi': (25.3176, 82.9739),
    'Vientiane': (17.9757, 102.6331), 'Windhoek': (-22.5609, 17.0658), 'Wuhan': (30.5928, 114.3055),
    "Xi'an": (34.3416, 108.9398),
}

# eight destinations from each origin: near, middling and far
ORIGINS = {
    'Brussels':   ['Amsterdam', 'Cologne', 'Paris', 'London', 'Frankfurt', 'Berlin', 'Vienna', 'Prague'],
    'London':     ['Birmingham', 'Manchester', 'Cardiff', 'Edinburgh', 'Glasgow', 'Paris', 'Brussels', 'Amsterdam'],
    'Berlin':     ['Hamburg', 'Prague', 'Munich', 'Cologne', 'Warsaw', 'Vienna', 'Copenhagen', 'Brussels'],
    'Vienna':     ['Bratislava', 'Graz', 'Salzburg', 'Budapest', 'Prague', 'Munich', 'Venice', 'Zagreb'],
    'Rome':       ['Naples', 'Florence', 'Venice', 'Milan', 'Munich', 'Vienna', 'Paris', 'Barcelona'],
    'Madrid':     ['Seville', 'Valencia', 'Barcelona', 'Bilbao', 'Lisbon', 'Porto', 'Paris', 'Milan'],
    'Prague':     ['Brno', 'Bratislava', 'Vienna', 'Berlin', 'Krakow', 'Budapest', 'Munich', 'Warsaw'],
    'Athens':     ['Thessaloniki', 'Sofia', 'Skopje', 'Tirana', 'Belgrade', 'Istanbul', 'Bucharest', 'Rome'],
    'Sarajevo':   ['Zagreb', 'Belgrade', 'Split', 'Podgorica', 'Skopje', 'Ljubljana', 'Budapest', 'Vienna'],
    'Moscow':     ['St Petersburg', 'Nizhny Novgorod', 'Kazan', 'Rostov', 'Samara', 'Yekaterinburg', 'Volgograd', 'Minsk'],
    'Istanbul':   ['Ankara', 'Izmir', 'Bursa', 'Sofia', 'Thessaloniki', 'Bucharest', 'Athens', 'Belgrade'],
    'Tripoli':    ['Misrata', 'Sirte', 'Benghazi', 'Sabha', 'Tunis', 'Cairo', 'Algiers', 'Alexandria'],
    'Cairo':      ['Alexandria', 'Port Said', 'Asyut', 'Luxor', 'Aswan', 'Tripoli', 'Khartoum', 'Tel Aviv'],
    'Nairobi':    ['Mombasa', 'Kisumu', 'Arusha', 'Kampala', 'Dar es Salaam', 'Addis Ababa', 'Kigali', 'Dodoma'],
    'Johannesburg': ['Pretoria', 'Durban', 'Bloemfontein', 'Cape Town', 'Gaborone', 'Maputo', 'Bulawayo', 'Windhoek'],
    'Lagos':      ['Ibadan', 'Abuja', 'Accra', 'Kano', 'Cotonou', 'Lome', 'Port Harcourt', 'Kaduna'],
    'Casablanca': ['Rabat', 'Tangier', 'Marrakesh', 'Fes', 'Oran', 'Algiers', 'Agadir', 'Oujda'],
    'Washington': ['Baltimore', 'Philadelphia', 'New York', 'Richmond', 'Pittsburgh', 'Boston', 'Chicago', 'Atlanta'],
    'New York':   ['Philadelphia', 'Boston', 'Washington', 'Albany', 'Baltimore', 'Pittsburgh', 'Toronto', 'Chicago'],
    'Los Angeles': ['San Diego', 'Santa Barbara', 'Bakersfield', 'Las Vegas', 'Phoenix', 'Sacramento', 'San Francisco', 'Tijuana'],
    'Mexico City': ['Puebla', 'Queretaro', 'Guadalajara', 'Veracruz', 'Oaxaca', 'Monterrey', 'Acapulco', 'Merida'],
    'La Paz':     ['Oruro', 'Cochabamba', 'Sucre', 'Potosi', 'Santa Cruz', 'Puno', 'Arica', 'Lima'],
    'Melbourne':  ['Geelong', 'Ballarat', 'Bendigo', 'Albury', 'Canberra', 'Sydney', 'Adelaide', 'Brisbane'],
    'Tokyo':      ['Kyoto', 'Osaka', 'Nagoya', 'Sendai', 'Hiroshima', 'Fukuoka', 'Kanazawa', 'Niigata'],
    'Delhi':      ['Agra', 'Jaipur', 'Lucknow', 'Varanasi', 'Mumbai', 'Kolkata', 'Ahmedabad', 'Chennai'],
    'Bangkok':    ['Ayutthaya', 'Pattaya', 'Chiang Mai', 'Hua Hin', 'Nong Khai', 'Surat Thani', 'Vientiane', 'Phnom Penh'],
    'Sao Paulo':  ['Rio de Janeiro', 'Campinas', 'Curitiba', 'Belo Horizonte', 'Brasilia', 'Florianopolis', 'Porto Alegre', 'Buenos Aires'],
    'Beijing':    ['Tianjin', 'Shanghai', "Xi'an", 'Guangzhou', 'Harbin', 'Wuhan', 'Chengdu', 'Shenyang'],
}


def all_pairs():
    out = []
    for o, ds in ORIGINS.items():
        for d in ds:
            out.append((o, d))
    return out


if __name__ == '__main__':
    p = all_pairs()
    missing = sorted({c for pr in p for c in pr} - set(WORLD))
    print('%d origins, %d routes' % (len(ORIGINS), len(p)))
    print('cities with no coordinates yet (%d): %s' % (len(missing), ', '.join(missing)))
