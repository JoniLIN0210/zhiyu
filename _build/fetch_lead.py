"""快速版：用维基百科条目主图（走 en.wikipedia.org 接口，避开 Commons 搜索限流）。
用法: python3 fetch_lead.py id1 id2 …   （读 data_*.json 里的 wiki_en）"""
import io, json, os, re, subprocess, sys, time, urllib.parse
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'photos')
CREDITS = os.path.join(HERE, 'photos.json')
UA = 'ZhiyuPlantPrototype/0.2 (educational prototype)'

def curl(url, raw=False):
    for i in range(4):
        r = subprocess.run(['curl', '-sS', '-L', '-m', '40', '-A', UA, '-w', '\n%{http_code}', url], capture_output=True)
        body, _, code = r.stdout.rpartition(b'\n')
        if code == b'200': return body if raw else json.loads(body)
        time.sleep(8 * (i + 1) if code == b'429' else 2)
    raise RuntimeError(f'http {code.decode()}')

def strip(s): return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', s or '')).strip()

plants = {}
for f in os.listdir(HERE):
    if f.startswith('data_') and f.endswith('.json'):
        for p in json.load(open(os.path.join(HERE, f))): plants[p['id']] = p
credits = json.load(open(CREDITS))
for pid in sys.argv[1:]:
    p = plants.get(pid)
    if not p: print('NODATA', pid); continue
    titles = [t for t in [p.get('wiki_en'), p['latin'], re.sub(r'\s+(subsp\.|var\.).*$', '', p['latin'])] if t]
    done = False
    for t in dict.fromkeys(titles):
        try:
            q = urllib.parse.urlencode({'action': 'query', 'titles': t, 'redirects': 1, 'prop': 'pageimages', 'piprop': 'name', 'format': 'json', 'formatversion': 2})
            pg = curl('https://en.wikipedia.org/w/api.php?' + q)['query']['pages'][0]
            name = pg.get('pageimage')
            if not name: continue
            q = urllib.parse.urlencode({'action': 'query', 'titles': 'File:' + name, 'prop': 'imageinfo', 'iiprop': 'url|mime|extmetadata', 'iiurlwidth': 960, 'format': 'json', 'formatversion': 2})
            ii = curl('https://en.wikipedia.org/w/api.php?' + q)['query']['pages'][0]['imageinfo'][0]
            if ii['mime'] not in ('image/jpeg', 'image/png'): continue
            m = ii.get('extmetadata', {})
            img = Image.open(io.BytesIO(curl(ii['thumburl'], raw=True))).convert('RGB')
            img.thumbnail((960, 960), Image.LANCZOS)
            img.save(os.path.join(OUT, pid + '.jpg'), 'JPEG', quality=80, optimize=True, progressive=True)
            credits[pid] = {'file': 'File:' + name, 'w': img.width, 'h': img.height, 'page': ii.get('descriptionurl'),
                            'author': strip(m.get('Artist', {}).get('value'))[:120], 'license': strip(m.get('LicenseShortName', {}).get('value'))}
            json.dump(credits, open(CREDITS, 'w'), ensure_ascii=False, indent=1)
            print('ok  ', pid, p['cn'], name, flush=True); done = True; break
        except Exception as e:
            print('  ..', pid, t, e, flush=True)
        time.sleep(.5)
    if not done: print('MISS', pid, p['cn'], flush=True)
    time.sleep(.6)
