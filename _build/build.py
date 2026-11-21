"""合并 _build/data_<cat>.json、data_<cat>_2.json、quiz_*.json + photos.json → ../data.js，并做基本校验。"""
import glob, json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = os.path.join(HERE, '..', 'photos')
CATS = ['foliage', 'succulent', 'flower', 'tree', 'herb', 'wild', 'water', 'odd']
credits = json.load(open(os.path.join(HERE, 'photos.json')))
master = [l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, 'master.tsv')) if l.strip()]
ids = {r[1] for r in master}
order = {r[1]: i for i, r in enumerate(master)}
COLOR_CACHE = os.path.join(HERE, 'colors.json')
colors = json.load(open(COLOR_CACHE)) if os.path.exists(COLOR_CACHE) else {}

def tone(pid):
    """照片的主色（缩到 1×1 再稍微压暗、降饱和），用作加载前的底色。"""
    f = os.path.join(PHOTOS, pid + '.jpg')
    key = f'{pid}:{os.path.getmtime(f):.0f}'
    if key not in colors:
        r, g, b = Image.open(f).convert('RGB').resize((1, 1), Image.LANCZOS).getpixel((0, 0))
        m = (r + g + b) / 3
        r, g, b = [int(m + (v - m) * .7) for v in (r, g, b)]
        colors[key] = '#%02x%02x%02x' % (r, g, b)
    return colors[key]

plants, problems = [], []
for c in CATS:
    files = [os.path.join(HERE, f'data_{c}.json'), os.path.join(HERE, f'data_{c}_2.json')]
    for f in files:
        if not os.path.exists(f):
            problems.append(f'缺少 {os.path.basename(f)}'); continue
        for p in json.load(open(f)):
            if p['id'] not in ids: problems.append(f"{p['id']} 不在总名单里"); continue
            if '（' in p['cn']:
                main, extra = p['cn'].rstrip('）').split('（', 1)
                p['cn'] = main; p['alias'] = [extra] + [a for a in (p.get('alias') or []) if a != extra]
            if len(p.get('facts', [])) != 3: problems.append(f"{p['id']} facts 数量 {len(p.get('facts', []))}")
            if p.get('season') and p['season'].get('type') not in ('花期', '叶色', '果期', '观赏期'):
                problems.append(f"{p['id']} season.type={p['season'].get('type')}")
            p['kin'] = p.get('kin') or {'text': '', 'ids': []}
            p['kin']['ids'] = [k for k in p['kin'].get('ids', []) if k in ids and k != p['id']]
            if p.get('home') and not p.get('care'): problems.append(f"{p['id']} home 但缺 care")
            cr = credits.get(p['id'])
            if cr and os.path.exists(os.path.join(PHOTOS, p['id'] + '.jpg')):
                p['photo'] = {'src': f"photos/{p['id']}.jpg", 'w': cr['w'], 'h': cr['h'], 'c': tone(p['id']),
                              'author': cr['author'][:80], 'license': cr['license'], 'page': cr['page']}
            else:
                problems.append(f"{p['id']} 没有照片")
            plants.append(p)
plants.sort(key=lambda p: order[p['id']])

missing = ids - {p['id'] for p in plants}
if missing: problems.append(f'未完成 {len(missing)} 种: ' + ', '.join(sorted(missing))[:300])

quiz = []
for f in sorted(glob.glob(os.path.join(HERE, 'quiz_*.json'))):
    for q in json.load(open(f)):
        ok = q.get('q') and q.get('format') in ('tf', 'choice') and q.get('explain')
        if q.get('format') == 'choice': ok = ok and len(q.get('options', [])) == 3 and q.get('answer') in (0, 1, 2)
        if q.get('format') == 'tf': ok = ok and isinstance(q.get('answer'), bool)
        if not ok: problems.append(f"题目格式有误 {q.get('id')}"); continue
        if q.get('plant') not in ids: q['plant'] = None
        quiz.append(q)

with open(os.path.join(HERE, '..', 'data.js'), 'w', encoding='utf-8') as f:
    f.write('// 由 _build/build.py 生成，请勿手改。照片来自 Wikimedia Commons，作者与授权见每条的 photo 字段。\n')
    f.write('window.PLANTS = '); json.dump(plants, f, ensure_ascii=False, indent=0); f.write(';\n')
    f.write('window.QUIZ = '); json.dump(quiz, f, ensure_ascii=False, indent=0); f.write(';\n')
json.dump(colors, open(COLOR_CACHE, 'w'))
print(len(plants), 'plants,', len(quiz), 'quiz items written')
print('\n'.join(problems) or 'no problems')
