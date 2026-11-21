"""把 photos/ 拼成小样图，方便检查。用法: python3 contact.py [cat ...] → /tmp/zy_contact_<n>.jpg"""
import os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, 'master.tsv')) if l.strip()]
cats = sys.argv[1:]
if cats[:1] == ['new']:   # python3 contact.py new → 只看 master_add.tsv 里的新增植物
    rows = [l.rstrip('\n').split('\t') for l in open(os.path.join(HERE, 'master_add.tsv')) if l.strip()]
    cats = []
ids = [r[1] for r in rows if not cats or r[0] in cats]
W, H, COLS = 220, 260, 8
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 15)
pages = [ids[i:i + 40] for i in range(0, len(ids), 40)]
for n, page in enumerate(pages):
    sheet = Image.new('RGB', (W * COLS, H * ((len(page) + COLS - 1) // COLS)), 'white')
    d = ImageDraw.Draw(sheet)
    for i, pid in enumerate(page):
        x, y = (i % COLS) * W, (i // COLS) * H
        f = os.path.join(HERE, '..', 'photos', pid + '.jpg')
        if os.path.exists(f):
            im = Image.open(f); im.thumbnail((W - 10, H - 34)); sheet.paste(im, (x + 5, y + 5))
        else:
            d.rectangle([x + 5, y + 5, x + W - 5, y + H - 30], fill='#eee')
        d.text((x + 6, y + H - 26), pid, fill='black', font=font)
    out = f'/tmp/zy_contact_{"_".join(cats) or "all"}_{n}.jpg'
    sheet.save(out, quality=80); print(out)
