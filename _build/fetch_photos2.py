"""按学名从 Wikimedia Commons 挑选高质量照片（优先「精选图片 / 优质图片」），保存备选。
用法: python3 fetch_photos2.py [--redo] [id ...]
      python3 fetch_photos2.py --file id "File:Xxx.jpg"     # 手动指定
输出: ../photos/{id}.jpg, photos.json（署名）, candidates.json（每种的备选）
"""
import io, json, os, re, subprocess, sys, time, urllib.parse
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'photos')
CREDITS = os.path.join(HERE, 'photos.json')
CANDS = os.path.join(HERE, 'candidates.json')
UA = 'ZhiyuPlantPrototype/0.2 (educational prototype)'
BAD = re.compile(r'herbari|illustrat|drawing|k[öo]hler|curtis|blackwell|plate|botanical_magazine|map|distribution|range|\.svg|\.tif|specimen|stamp|logo|diagram|chart|seedling_in_vitro|microscop|\bsem\b|pollen|x-ray', re.I)
os.makedirs(OUT, exist_ok=True)

def curl(url, raw=False):
    for i in range(5):
        r = subprocess.run(['curl', '-sS', '-L', '-m', '40', '-A', UA, '-w', '\n%{http_code}', url], capture_output=True)
        body, _, code = r.stdout.rpartition(b'\n')
        if code == b'200':
            return body if raw else json.loads(body)
        wait = 15 * (i + 1) if code == b'429' else 2 * (i + 1)
        time.sleep(wait)
    raise RuntimeError(f'http {code.decode()} {url[:80]}')

def api(params):
    params.update(format='json', formatversion='2')
    return curl('https://commons.wikimedia.org/w/api.php?' + urllib.parse.urlencode(params))

def search(q, n=12):
    d = api({'action': 'query', 'list': 'search', 'srnamespace': 6, 'srsearch': q, 'srlimit': n})
    return [h['title'] for h in d.get('query', {}).get('search', [])]

def infos(titles):
    if not titles: return []
    d = api({'action': 'query', 'titles': '|'.join(titles[:20]), 'prop': 'imageinfo', 'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': 960})
    out = []
    for p in d['query']['pages']:
        if 'imageinfo' not in p: continue
        ii = p['imageinfo'][0]; m = ii.get('extmetadata', {})
        lic = re.sub(r'<[^>]+>', '', m.get('LicenseShortName', {}).get('value', ''))
        out.append({'file': p['title'], 'w': ii['width'], 'h': ii['height'], 'mime': ii['mime'], 'thumb': ii.get('thumburl'), 'page': ii.get('descriptionurl'),
                    'author': re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', '', m.get('Artist', {}).get('value', ''))).strip(), 'license': lic})
    order = {t: i for i, t in enumerate(titles)}
    return sorted(out, key=lambda x: order.get(x['file'], 99))

def good(x):
    if x['mime'] != 'image/jpeg' or BAD.search(x['file']): return False
    if min(x['w'], x['h']) < 900: return False
    r = x['w'] / x['h']
    if r > 1.9 or r < 0.5: return False
    lic = x['license'].lower()
    return any(k in lic for k in ('cc by', 'cc0', 'public domain', 'pd', 'cc-by'))

def lead_file(title):
    d = curl('https://en.wikipedia.org/api/rest_v1/page/summary/' + urllib.parse.quote(title.replace(' ', '_')))
    src = (d.get('originalimage') or {}).get('source')
    return 'File:' + urllib.parse.unquote(src.split('?')[0].split('/')[-1]) if src else None

KW = {'叶色': 'autumn', '花期': 'flower', '果期': 'fruit'}

def find(p):
    latin = p['latin']; names = [latin]
    if p.get('wiki_en') and p['wiki_en'] != latin and ' ' in p['wiki_en']: names.append(p['wiki_en'])
    kw = KW.get((p.get('season') or {}).get('type', ''), '')
    seen, pool = set(), []
    def add(titles):
        for x in infos([t for t in titles if t not in seen]):
            seen.add(x['file'])
            if good(x): pool.append(x)
    for nm in names:
        q = f'"{nm}"'
        add(search(f'{q} {kw} incategory:Quality_images'.replace('  ', ' ')))
        if len(pool) >= 3: break
        add(search(f'{q} incategory:Quality_images'))
        add(search(f'{q} incategory:Featured_pictures_on_Wikimedia_Commons'))
        if len(pool) >= 3: break
    try:
        lf = lead_file(p.get('wiki_en') or latin)
        if lf: add([lf])
    except Exception:
        pass
    if len(pool) < 3:
        for nm in names: add(search(f'"{nm}" {kw}'.strip(), 15))
    return pool

def save(pid, x, credits):
    img = Image.open(io.BytesIO(curl(x['thumb'], raw=True))).convert('RGB')
    img.thumbnail((960, 960), Image.LANCZOS)
    img.save(os.path.join(OUT, pid + '.jpg'), 'JPEG', quality=80, optimize=True, progressive=True)
    credits[pid] = {'file': x['file'], 'w': img.width, 'h': img.height, 'page': x['page'], 'author': x['author'][:120], 'license': x['license']}

def load_plants():
    plants = {}
    rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, 'master.tsv')) if l.strip()]
    for cat, pid, cn, latin in rows: plants[pid] = {'id': pid, 'cn': cn, 'latin': latin, 'cat': cat}
    for f in os.listdir(HERE):
        if f.startswith('data_') and f.endswith('.json'):
            for p in json.load(open(os.path.join(HERE, f))): plants[p['id']].update({k: p.get(k) for k in ('latin', 'wiki_en', 'season')})
    return plants

def main():
    credits = json.load(open(CREDITS)) if os.path.exists(CREDITS) else {}
    cands = json.load(open(CANDS)) if os.path.exists(CANDS) else {}
    args = sys.argv[1:]
    if args[:1] == ['--q']:   # --q id "搜索词"：用自定义搜索词重新生成备选（不替换当前照片）
        pid, q = args[1], args[2]
        pool = [x for x in infos(search(q, 20)) if good(x)]
        cands[pid] = [{k: x[k] for k in ('file', 'w', 'h', 'thumb', 'page', 'author', 'license')} for x in pool[:6]]
        json.dump(cands, open(CANDS, 'w'), ensure_ascii=False, indent=1); print(pid, len(pool), [x['file'][5:60] for x in pool[:6]]); return
    if args[:2] and args[0] == '--pick':   # --pick id n：用第 n 个备选
        pid, n = args[1], int(args[2])
        x = cands[pid][n]; save(pid, x, credits); json.dump(credits, open(CREDITS, 'w'), ensure_ascii=False, indent=1); print('ok', pid, x['file']); return
    if args[:1] == ['--file']:
        pid, ft = args[1], args[2]
        save(pid, infos([ft])[0], credits); json.dump(credits, open(CREDITS, 'w'), ensure_ascii=False, indent=1); print('ok', pid, ft); return
    redo = '--redo' in args; only = [a for a in args if not a.startswith('--')]
    plants = load_plants()
    for pid, p in plants.items():
        if only and pid not in only: continue
        if not redo and not only and pid in cands: continue
        try:
            pool = find(p)
        except Exception as e:
            print('ERR ', pid, e, flush=True); continue
        cands[pid] = [{k: x[k] for k in ('file', 'w', 'h', 'thumb', 'page', 'author', 'license')} for x in pool[:6]]
        if pool:
            try: save(pid, pool[0], credits); print('ok  ', pid, p['cn'], pool[0]['file'], f'({len(pool)} cands)', flush=True)
            except Exception as e: print('ERR ', pid, e, flush=True)
        else:
            print('MISS', pid, p['cn'], p['latin'], flush=True)
        json.dump(credits, open(CREDITS, 'w'), ensure_ascii=False, indent=1)
        json.dump(cands, open(CANDS, 'w'), ensure_ascii=False, indent=1)
        time.sleep(1.2)

main()
