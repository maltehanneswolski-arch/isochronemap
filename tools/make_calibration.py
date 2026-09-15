# -*- coding: utf-8 -*-
"""Assemble calibration.json: real scheduled-transport journey times, city
centre to city centre, that the model is checked against.

Europe (and wherever else the feeds reach): Transitous, fastest of three
Tuesday departures, door to door including the local legs.
Elsewhere: operator timetables, fastest station-to-station service, plus
0.4 h for getting to and from the stations so the figure is comparable."""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ACCESS = 0.4

# name: (lat, lon)
C = {
 'Tokyo':(35.6762,139.6503),'Osaka':(34.6937,135.5023),'Fukuoka':(33.5902,130.4017),'Sendai':(38.2682,140.8694),
 'Aomori':(40.8246,140.7406),'Kanazawa':(36.5613,136.6562),'Nagoya':(35.1815,136.9066),
 'Beijing':(39.9042,116.4074),'Shanghai':(31.2304,121.4737),'Guangzhou':(23.1291,113.2644),'Nanjing':(32.0603,118.7969),
 'Hangzhou':(30.2741,120.1551),"Xi'an":(34.3416,108.9398),'Shenzhen':(22.5431,114.0579),'Harbin':(45.8038,126.5350),
 'Chengdu':(30.5728,104.0668),'Chongqing':(29.5630,106.5516),'Wuhan':(30.5928,114.3055),
 'Seoul':(37.5665,126.9780),'Busan':(35.1796,129.0756),'Daejeon':(36.3504,127.3845),'Taipei':(25.0330,121.5654),'Kaohsiung':(22.6273,120.3014),
 'Delhi':(28.6139,77.2090),'Mumbai':(19.0760,72.8777),'Kolkata':(22.5726,88.3639),'Ahmedabad':(23.0225,72.5714),'Chennai':(13.0827,80.2707),
 'New York':(40.7128,-74.0060),'Washington':(38.9072,-77.0369),'Boston':(42.3601,-71.0589),'Chicago':(41.8781,-87.6298),
 'Los Angeles':(34.0522,-118.2437),'San Francisco':(37.7749,-122.4194),'Miami':(25.7617,-80.1918),'Orlando':(28.5383,-81.3792),
 'Toronto':(43.6532,-79.3832),'Montreal':(45.5017,-73.5673),
 'Casablanca':(33.5731,-7.5898),'Tangier':(35.7595,-5.8340),'Cairo':(30.0444,31.2357),'Alexandria':(31.2001,29.9187),
 'Nairobi':(-1.2921,36.8219),'Mombasa':(-4.0435,39.6682),'Johannesburg':(-26.2041,28.0473),'Cape Town':(-33.9249,18.4241),
 'Sydney':(-33.8688,151.2093),'Melbourne':(-37.8136,144.9631),'Brisbane':(-27.4698,153.0251),
 'Moscow':(55.7558,37.6173),'St Petersburg':(59.9311,30.3609),'Vladivostok':(43.1155,131.8855),
 'Mecca':(21.3891,39.8579),'Medina':(24.5247,39.5692),'Riyadh':(24.7136,46.6753),'Dammam':(26.4207,50.0888),
 'Istanbul':(41.0082,28.9784),'Ankara':(39.9334,32.8597),'Tehran':(35.6892,51.3890),'Mashhad':(36.2605,59.6168),
 'Tashkent':(41.2995,69.2401),'Samarkand':(39.6542,66.9597),'Jakarta':(-6.2088,106.8456),'Bandung':(-6.9175,107.6191),
 'Surabaya':(-7.2575,112.7521),'Bangkok':(13.7563,100.5018),'Chiang Mai':(18.7883,98.9853),
 'Sao Paulo':(-23.5505,-46.6333),'Rio de Janeiro':(-22.9068,-43.1729),'Mexico City':(19.4326,-99.1332),'Guadalajara':(20.6597,-103.3496),
 'Buenos Aires':(-34.6037,-58.3816),'Rosario':(-32.9442,-60.6505),'Bogota':(4.7110,-74.0721),'Medellin':(6.2442,-75.5812),
 'Lima':(-12.0464,-77.0428),'Cusco':(-13.5320,-71.9675),
}
# (from, to, station-to-station hours of the fastest scheduled service, what it is)
CURATED = [
 ('Tokyo','Osaka',2.35,'Nozomi'),('Tokyo','Fukuoka',4.87,'Nozomi'),('Tokyo','Sendai',1.5,'Hayabusa'),
 ('Tokyo','Aomori',2.98,'Hayabusa'),('Tokyo','Kanazawa',2.47,'Kagayaki'),('Tokyo','Nagoya',1.58,'Nozomi'),
 ('Beijing','Shanghai',4.3,'G fuxing 350'),('Beijing','Guangzhou',7.83,'G'),('Shanghai','Nanjing',0.98,'G'),
 ('Shanghai','Hangzhou',0.75,'G'),('Beijing',"Xi'an",4.33,'G'),('Guangzhou','Shenzhen',0.48,'G'),
 ('Beijing','Harbin',4.83,'G'),('Chengdu','Chongqing',0.95,'G'),('Wuhan','Guangzhou',3.67,'G'),
 ('Seoul','Busan',2.25,'KTX'),('Seoul','Daejeon',0.95,'KTX'),('Taipei','Kaohsiung',1.57,'THSR'),
 ('Delhi','Mumbai',15.5,'Rajdhani'),('Delhi','Kolkata',17.0,'Rajdhani'),('Mumbai','Ahmedabad',5.42,'Vande Bharat'),
 ('Delhi','Chennai',28.0,'Rajdhani'),
 ('New York','Washington',2.83,'Acela'),('New York','Boston',3.67,'Acela'),('New York','Chicago',19.0,'Lake Shore Ltd'),
 ('Chicago','Los Angeles',43.0,'Southwest Chief'),('Los Angeles','San Francisco',7.5,'coach'),
 ('Miami','Orlando',3.5,'Brightline'),('Toronto','Montreal',4.87,'VIA'),
 ('Casablanca','Tangier',2.17,'Al Boraq'),('Cairo','Alexandria',2.58,'Talgo'),('Nairobi','Mombasa',4.75,'Madaraka'),
 ('Johannesburg','Cape Town',26.0,'Shosholoza Meyl'),
 ('Sydney','Melbourne',11.0,'XPT'),('Sydney','Brisbane',14.0,'XPT'),
 ('Moscow','St Petersburg',3.5,'Sapsan'),('Moscow','Vladivostok',146.0,'Rossiya'),
 ('Mecca','Medina',2.33,'Haramain'),('Riyadh','Dammam',4.17,'SAR'),('Istanbul','Ankara',4.17,'YHT'),
 ('Tehran','Mashhad',12.0,'Pardis/Fadak'),('Tashkent','Samarkand',2.13,'Afrosiyob'),
 ('Jakarta','Bandung',0.75,'Whoosh'),('Jakarta','Surabaya',8.5,'Argo Bromo'),('Bangkok','Chiang Mai',11.0,'Special Express'),
 ('Sao Paulo','Rio de Janeiro',6.0,'coach'),('Mexico City','Guadalajara',7.0,'coach ETN'),
 ('Buenos Aires','Rosario',4.0,'coach'),('Bogota','Medellin',9.0,'coach'),('Lima','Cusco',21.0,'coach'),
]

# Station-to-station timings from the operators' timetables, used ONLY where
# Transitous has no coverage, and as a floor where its answer is impossibly
# quick.
#
# An earlier version took the lower of the two on the grounds that the router
# sometimes misses the direct train. That was wrong, and it quietly biased the
# whole truth set: it pulled 61 of 166 targets below the measured journey, by
# up to 2.75 h, and the model was then tuned to match them. Brussels to Vienna
# was set to 9.5 h from "ICE and Railjet" when there is no such through
# working - the real fastest is 11.2 h over four trains and three changes, one
# of them a regional service. The router was right and the hand figure was a
# guess. Transitous now wins wherever it returns an itinerary.
SCHED = {
 ('Brussels','Vienna'):9.5,('Brussels','Frankfurt'):3.0,('Brussels','Munich'):6.0,('Brussels','Amsterdam'):1.9,('Brussels','London'):2.5,
 ('Brussels','Berlin'):6.6,('Brussels','Zurich'):6.2,('Brussels','Prague'):9.5,('Brussels','Cologne'):1.8,('Brussels','Luxembourg'):3.0,
 ('Paris','Lyon'):1.95,('Paris','Marseille'):3.1,('Paris','Bordeaux'):2.1,('Paris','Strasbourg'):1.8,('Paris','Brussels'):1.4,('Paris','London'):2.8,
 ('Paris','Amsterdam'):3.3,('Paris','Frankfurt'):3.7,('Paris','Munich'):5.7,('Paris','Barcelona'):6.7,('Paris','Milan'):7.2,('Paris','Zurich'):4.1,
 ('Paris','Nantes'):2.0,('Paris','Rennes'):1.45,('Paris','Lille'):1.05,('Paris','Toulouse'):4.3,('Paris','Nice'):5.7,('Paris','Geneva'):3.1,
 ('London','Edinburgh'):4.3,('London','Manchester'):2.1,('London','Birmingham'):1.3,('London','Glasgow'):4.5,('London','Cardiff'):1.85,('London','Amsterdam'):4.5,
 ('Berlin','Munich'):3.9,('Berlin','Hamburg'):1.75,('Berlin','Warsaw'):5.3,('Berlin','Prague'):4.1,('Berlin','Vienna'):8.0,('Berlin','Frankfurt'):3.9,
 ('Berlin','Cologne'):4.3,('Berlin','Leipzig'):1.2,('Berlin','Dresden'):1.9,('Berlin','Hanover'):1.6,('Berlin','Copenhagen'):7.0,
 ('Frankfurt','Cologne'):1.1,('Frankfurt','Munich'):3.2,('Frankfurt','Hamburg'):3.6,('Frankfurt','Vienna'):6.5,('Frankfurt','Zurich'):3.9,
 ('Frankfurt','Stuttgart'):1.3,('Frankfurt','Basel'):2.9,('Frankfurt','Nuremberg'):2.1,('Frankfurt','Amsterdam'):3.9,
 ('Munich','Vienna'):4.0,('Munich','Zurich'):3.5,('Munich','Salzburg'):1.5,('Munich','Innsbruck'):1.75,('Munich','Stuttgart'):2.0,('Munich','Nuremberg'):1.0,
 ('Vienna','Budapest'):2.6,('Vienna','Prague'):4.0,('Vienna','Zurich'):7.9,('Vienna','Salzburg'):2.4,('Vienna','Graz'):2.5,('Vienna','Bratislava'):1.0,
 ('Vienna','Venice'):7.5,('Vienna','Zagreb'):6.5,('Vienna','Ljubljana'):6.0,('Vienna','Krakow'):6.9,('Vienna','Warsaw'):7.5,
 ('Zurich','Milan'):3.3,('Zurich','Bern'):0.95,('Zurich','Geneva'):2.7,('Zurich','Basel'):0.9,('Zurich','Innsbruck'):3.5,
 ('Milan','Rome'):3.0,('Milan','Venice'):2.2,('Milan','Turin'):0.9,('Milan','Bologna'):1.05,('Milan','Florence'):1.75,('Milan','Naples'):4.25,
 ('Rome','Naples'):1.15,('Rome','Florence'):1.5,('Rome','Venice'):3.7,('Rome','Bologna'):2.0,
 ('Madrid','Barcelona'):2.5,('Madrid','Seville'):2.35,('Madrid','Valencia'):1.7,('Madrid','Malaga'):2.4,('Madrid','Bilbao'):4.9,('Madrid','Lisbon'):9.5,
 ('Barcelona','Valencia'):2.7,('Lisbon','Porto'):2.8,
 ('Copenhagen','Stockholm'):5.2,('Copenhagen','Hamburg'):4.7,('Copenhagen','Aarhus'):2.7,('Copenhagen','Malmo'):0.6,('Copenhagen','Oslo'):7.8,
 ('Stockholm','Gothenburg'):3.0,('Stockholm','Malmo'):4.4,('Stockholm','Oslo'):5.5,('Oslo','Bergen'):6.75,
 ('Warsaw','Krakow'):2.3,('Warsaw','Gdansk'):2.7,('Warsaw','Prague'):7.5,('Prague','Budapest'):6.5,('Budapest','Bucharest'):15.0,('Budapest','Zagreb'):6.0,
 ('Helsinki','Tampere'):1.5,('Athens','Thessaloniki'):4.0,('Istanbul','Ankara'):4.2,('Kyiv','Lviv'):5.0,
 ('Edinburgh','Glasgow'):0.8,('Dublin','Cork'):2.5,('Dublin','Belfast'):2.1,('Manchester','Edinburgh'):3.3,
 ('New York','Washington'):2.85,('New York','Boston'):3.7,('New York','Chicago'):19.0,('Toronto','Montreal'):4.9,
 ('Tokyo','Osaka'):2.35,('Seoul','Busan'):2.25,('Sydney','Melbourne'):11.0,('Delhi','Mumbai'):15.5,
}

tr = json.load(open(os.path.join(ROOT, 'data', 'calibration_transitous.json'), encoding='utf-8'))
pairs = []
seen = set()
for p in tr['pairs']:
    if p.get('hours') is None: continue
    sched = SCHED.get((p['from'], p['to']))
    # below 60% of the timetable the router has found something that is not a
    # surface journey (Oslo-Bergen came back at 2.2 h); otherwise it stands
    if sched is not None and p['hours'] < 0.6 * sched: target = round(sched + ACCESS, 2)
    else: target = p['hours']
    pairs.append({'from': p['from'], 'to': p['to'], 'fromLL': p['fromLL'], 'toLL': p['toLL'],
                  'hours': target, 'transitous': p['hours'], 'sched': sched,
                  'src': 'transitous' if target == p['hours'] else 'timetable',
                  'via': ' > '.join(p.get('legs', []))[:80]})
    seen.add((p['from'], p['to']))
# pairs the Transitous run never reached, from the timetable alone
import importlib.util
spec = importlib.util.spec_from_file_location('ht', os.path.join(HERE, 'harvest_transitous.py'))
src = open(os.path.join(HERE, 'harvest_transitous.py'), encoding='utf-8').read()
ns = {}
exec(src.split('TIMES =')[0], ns)          # CITIES and PAIRS only, no requests
for a, b in ns['PAIRS']:
    if (a, b) in seen or (a, b) not in SCHED: continue
    pairs.append({'from': a, 'to': b, 'fromLL': list(ns['CITIES'][a]), 'toLL': list(ns['CITIES'][b]),
                  'hours': round(SCHED[(a, b)] + ACCESS, 2), 'sched': SCHED[(a, b)], 'src': 'timetable', 'via': 'timetable only'})
    seen.add((a, b))
for a, b, h, what in CURATED:
    if (a, b) in seen: continue
    pairs.append({'from': a, 'to': b, 'fromLL': list(C[a]), 'toLL': list(C[b]),
                  'hours': round(h + ACCESS, 2), 'src': 'timetable', 'via': what + ' %.2f h + %.1f access' % (h, ACCESS)})
out = {'note': 'Real fastest scheduled surface journeys, city centre to city centre, 2026. '
               'transitous = api.transitous.org over open GTFS, best of three Tuesday departures; '
               'timetable = operator timetable station-to-station + 0.4 h access.',
       'pairs': pairs}
with open(os.path.join(ROOT, 'calibration.json'), 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=1)
print('calibration.json:', len(pairs), 'pairs;', sum(1 for p in pairs if p['src'] == 'transitous'), 'from Transitous')
