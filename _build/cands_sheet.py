"""把指定植物的备选照片拼成小样：python3 cands_sheet.py id1 id2 … → /tmp/zy_cands.jpg（每行一种，编号 0-5）"""
import io, json, os, subprocess, sys, time
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
c = json.load(open(os.path.join(HERE, 'candidates.json')))
ids = sys.argv[1:]
W, H = 200, 200
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 16)
sheet = Image.new('RGB', (W * 6 + 120, H * len(ids)), 'white')
d = ImageDraw.Draw(sheet)
for r, pid in enumerate(ids):
    d.text((6, r * H + 90), pid, fill='black', font=font)
    for i, x in enumerate(c.get(pid, [])[:6]):
        url = x['thumb'].replace('/960px-', '/330px-')
        for k in range(4):
            p = subprocess.run(['curl', '-sS', '-L', '--fail', '-m', '30', '-A', 'ZhiyuPlantPrototype/0.2 (educational prototype)', url], capture_output=True)
            if p.returncode == 0: break
            time.sleep(10 * (k + 1))
        try:
            im = Image.open(io.BytesIO(p.stdout)).convert('RGB'); im.thumbnail((W - 8, H - 8))
            sheet.paste(im, (120 + i * W + 4, r * H + 4))
        except Exception:
            pass
        d.text((120 + i * W + 8, r * H + 8), str(i), fill='yellow', font=font)
        time.sleep(0.6)
out = '/tmp/zy_cands.jpg'; sheet.save(out, quality=80); print(out)
