# -*- coding: utf-8 -*-
"""Real scheduled-transport journey times from Transitous (api.transitous.org),
an open routing service built on open GTFS feeds. For each city pair the
fastest itinerary over three departure times on a Tuesday is kept. Output is
data/calibration_transitous.json; the model is checked against it."""
import json, sys, time, urllib.parse, urllib.request, os
try: sys.stdout.reconfigure(encoding='utf-8')
except Exception: pass

CITIES = {
 'Brussels':(50.8466,4.3528),'Vienna':(48.2082,16.3738),'Paris':(48.8566,2.3522),'London':(51.5074,-0.1278),
 'Amsterdam':(52.3676,4.9041),'Frankfurt':(50.1109,8.6821),'Munich':(48.1351,11.5820),'Berlin':(52.5200,13.4050),
 'Zurich':(47.3769,8.5417),'Prague':(50.0755,14.4378),'Warsaw':(52.2297,21.0122),'Milan':(45.4642,9.1900),
 'Rome':(41.9028,12.4964),'Madrid':(40.4168,-3.7038),'Barcelona':(41.3874,2.1686),'Copenhagen':(55.6761,12.5683),
 'Stockholm':(59.3293,18.0686),'Hamburg':(53.5511,9.9937),'Lyon':(45.7640,4.8357),'Marseille':(43.2965,5.3698),
 'Bordeaux':(44.8378,-0.5792),'Strasbourg':(48.5734,7.7521),'Cologne':(50.9375,6.9603),'Budapest':(47.4979,19.0402),
 'Naples':(40.8518,14.2681),'Florence':(43.7696,11.2558),'Turin':(45.0703,7.6869),'Venice':(45.4408,12.3155),
 'Seville':(37.3891,-5.9845),'Valencia':(39.4699,-0.3763),'Lisbon':(38.7223,-9.1393),'Porto':(41.1579,-8.6291),
 'Edinburgh':(55.9533,-3.1883),'Manchester':(53.4808,-2.2426),'Birmingham':(52.4862,-1.8904),'Glasgow':(55.8642,-4.2518),
 'Oslo':(59.9139,10.7522),'Gothenburg':(57.7089,11.9746),'Salzburg':(47.8095,13.0550),'Graz':(47.0707,15.4395),
 'Bern':(46.9480,7.4474),'Geneva':(46.2044,6.1432),'Krakow':(50.0647,19.9450),'Gdansk':(54.3520,18.6466),
 'Athens':(37.9838,23.7275),'Thessaloniki':(40.6401,22.9444),'Bucharest':(44.4268,26.1025),'Zagreb':(45.8150,15.9819),
 'Ljubljana':(46.0569,14.5058),'Bratislava':(48.1486,17.1077),'Helsinki':(60.1699,24.9384),'Tampere':(61.4978,23.7610),
 'Lille':(50.6292,3.0573),'Nantes':(47.2184,-1.5536),'Rennes':(48.1173,-1.6778),'Toulouse':(43.6047,1.4442),
 'Nice':(43.7102,7.2620),'Rotterdam':(51.9244,4.4777),'Luxembourg':(49.6116,6.1319),'Stuttgart':(48.7758,9.1829),
 'Nuremberg':(49.4521,11.0767),'Leipzig':(51.3397,12.3731),'Dresden':(51.0504,13.7373),'Hanover':(52.3759,9.7320),
 'Basel':(47.5596,7.5886),'Innsbruck':(47.2692,11.4041),'Bologna':(44.4949,11.3426),'Malaga':(36.7213,-4.4214),
 'Bilbao':(43.2630,-2.9350),'Aarhus':(56.1629,10.2039),'Malmo':(55.6050,13.0038),'Bergen':(60.3913,5.3221),
 'Cardiff':(51.4816,-3.1791),'Dublin':(53.3498,-6.2603),'Cork':(51.8985,-8.4756),'Belfast':(54.5973,-5.9301),
 'Istanbul':(41.0082,28.9784),'Ankara':(39.9334,32.8597),'Kyiv':(50.4501,30.5234),'Lviv':(49.8397,24.0297),
 # a few outside Europe, to learn where the feeds reach
 'New York':(40.7128,-74.0060),'Washington':(38.9072,-77.0369),'Boston':(42.3601,-71.0589),'Chicago':(41.8781,-87.6298),
 'Toronto':(43.6532,-79.3832),'Montreal':(45.5017,-73.5673),'Tokyo':(35.6762,139.6503),'Osaka':(34.6937,135.5023),
 'Seoul':(37.5665,126.9780),'Busan':(35.1796,129.0756),'Sydney':(-33.8688,151.2093),'Melbourne':(-37.8136,144.9631),
 'Delhi':(28.6139,77.2090),'Mumbai':(19.0760,72.8777),
}
PAIRS = [
 ('Brussels','Vienna'),('Brussels','Frankfurt'),('Brussels','Munich'),('Brussels','Amsterdam'),('Brussels','London'),
 ('Brussels','Berlin'),('Brussels','Zurich'),('Brussels','Prague'),('Brussels','Cologne'),('Brussels','Luxembourg'),
 ('Paris','Lyon'),('Paris','Marseille'),('Paris','Bordeaux'),('Paris','Strasbourg'),('Paris','Brussels'),('Paris','London'),
 ('Paris','Amsterdam'),('Paris','Frankfurt'),('Paris','Munich'),('Paris','Barcelona'),('Paris','Milan'),('Paris','Zurich'),
 ('Paris','Nantes'),('Paris','Rennes'),('Paris','Lille'),('Paris','Toulouse'),('Paris','Nice'),('Paris','Geneva'),
 ('London','Edinburgh'),('London','Manchester'),('London','Birmingham'),('London','Glasgow'),('London','Cardiff'),('London','Amsterdam'),
 ('Berlin','Munich'),('Berlin','Hamburg'),('Berlin','Warsaw'),('Berlin','Prague'),('Berlin','Vienna'),('Berlin','Frankfurt'),
 ('Berlin','Cologne'),('Berlin','Leipzig'),('Berlin','Dresden'),('Berlin','Hanover'),('Berlin','Copenhagen'),
 ('Frankfurt','Cologne'),('Frankfurt','Munich'),('Frankfurt','Hamburg'),('Frankfurt','Vienna'),('Frankfurt','Zurich'),
 ('Frankfurt','Stuttgart'),('Frankfurt','Basel'),('Frankfurt','Nuremberg'),('Frankfurt','Amsterdam'),
 ('Munich','Vienna'),('Munich','Zurich'),('Munich','Salzburg'),('Munich','Innsbruck'),('Munich','Stuttgart'),('Munich','Nuremberg'),
 ('Vienna','Budapest'),('Vienna','Prague'),('Vienna','Zurich'),('Vienna','Salzburg'),('Vienna','Graz'),('Vienna','Bratislava'),
 ('Vienna','Venice'),('Vienna','Zagreb'),('Vienna','Ljubljana'),('Vienna','Krakow'),('Vienna','Warsaw'),
 ('Zurich','Milan'),('Zurich','Bern'),('Zurich','Geneva'),('Zurich','Basel'),('Zurich','Innsbruck'),
 ('Milan','Rome'),('Milan','Venice'),('Milan','Turin'),('Milan','Bologna'),('Milan','Florence'),('Milan','Naples'),
 ('Rome','Naples'),('Rome','Florence'),('Rome','Venice'),('Rome','Bologna'),
 ('Madrid','Barcelona'),('Madrid','Seville'),('Madrid','Valencia'),('Madrid','Malaga'),('Madrid','Bilbao'),('Madrid','Lisbon'),
 ('Barcelona','Valencia'),('Lisbon','Porto'),
 ('Copenhagen','Stockholm'),('Copenhagen','Hamburg'),('Copenhagen','Aarhus'),('Copenhagen','Malmo'),('Copenhagen','Oslo'),
 ('Stockholm','Gothenburg'),('Stockholm','Malmo'),('Stockholm','Oslo'),('Oslo','Bergen'),
 ('Warsaw','Krakow'),('Warsaw','Gdansk'),('Warsaw','Prague'),('Prague','Budapest'),('Budapest','Bucharest'),('Budapest','Zagreb'),
 ('Helsinki','Tampere'),('Athens','Thessaloniki'),('Istanbul','Ankara'),('Kyiv','Lviv'),
 ('Edinburgh','Glasgow'),('Dublin','Cork'),('Dublin','Belfast'),('Manchester','Edinburgh'),
 ('New York','Washington'),('New York','Boston'),('New York','Chicago'),('Toronto','Montreal'),
 ('Tokyo','Osaka'),('Seoul','Busan'),('Sydney','Melbourne'),('Delhi','Mumbai'),
]
TIMES = ['2026-09-22T05:00:00Z', '2026-09-22T08:00:00Z', '2026-09-22T12:00:00Z']
API = 'https://api.transitous.org/api/v1/plan'

def plan(a, b, t):
    q = urllib.parse.urlencode({'fromPlace': '%f,%f' % a, 'toPlace': '%f,%f' % b, 'time': t,
                                'arriveBy': 'false', 'maxItineraries': 8})
    req = urllib.request.Request(API + '?' + q, headers={'User-Agent': 'isochrone-globe calibration (research)'})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)

out_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'calibration_transitous.json')
results = []
if os.path.exists(out_path):                       # resume: keep what an earlier run fetched
    results = json.load(open(out_path, encoding='utf-8'))['pairs']
done = {(r['from'], r['to']) for r in results}
for i, (fa, tb) in enumerate(PAIRS):
    if (fa, tb) in done: continue
    a, b = CITIES[fa], CITIES[tb]
    best = None
    for t in TIMES:
        try:
            d = plan(a, b, t)
        except Exception as ex:
            print('  !', fa, tb, t, ex, file=sys.stderr); continue
        for it in d.get('itineraries', []):
            h = it['duration'] / 3600.0
            if best is None or h < best['hours']:
                legs = [l for l in it['legs'] if l.get('mode') != 'WALK']
                best = {'hours': round(h, 2), 'transfers': it.get('transfers'),
                        'legs': [str(l.get('routeShortName') or l.get('mode')) for l in legs]}
        time.sleep(0.6)
    rec = {'from': fa, 'to': tb, 'fromLL': a, 'toLL': b, **(best or {'hours': None})}
    results.append(rec)
    print('%3d/%d %-11s -> %-12s %s' % (i + 1, len(PAIRS), fa, tb,
          ('%.2f h, %s changes, %s' % (best['hours'], best['transfers'], ' > '.join(best['legs'])[:60])) if best else 'no itinerary'))
    with open(out_path, 'w', encoding='utf-8') as f:
        json.dump({'source': 'Transitous (api.transitous.org), open GTFS; fastest of three Tuesday departures',
                   'date': '2026-09-22', 'pairs': results}, f, ensure_ascii=False, indent=1)
print('wrote', out_path, len(results), 'pairs')
