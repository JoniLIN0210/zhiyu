"""植遇 · 后台服务（本地开发和阿里云函数计算共用这一份）
- /api/status    识别服务是否已配置、今天还剩几次
- /api/config    保存 DeepSeek API Key（仅本地模式；公开模式下关闭）
- /api/identify  把照片转发给 DeepSeek（deepseek-flash 看图）并返回 JSON
- /api/lookup    按植物名请 DeepSeek 查询

本地运行：python3 server.py [--port 8803]
公开模式（阿里云函数计算 Web 函数）：环境变量 ZHIYU_PUBLIC=1，监听 0.0.0.0:$FC_SERVER_PORT（默认 9000）
  DEEPSEEK_API_KEY   DeepSeek Key（只在云端后台填写）
  ALLOWED_ORIGINS    允许调用接口的网页地址，逗号分隔
  PER_IP_DAILY       每个访客每天可用次数（默认 5）
  GLOBAL_DAILY       全站每天可用次数（默认 200）
"""
import datetime, json, os, ssl, sys, threading, time, urllib.error, urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

ROOT = os.path.dirname(os.path.abspath(__file__))
CONF = os.path.join(ROOT, 'config.local.json')
API = 'https://api.deepseek.com/chat/completions'
MODEL = 'deepseek-flash'
CTX = ssl.create_default_context(cafile='/etc/ssl/cert.pem') if os.path.exists('/etc/ssl/cert.pem') else ssl.create_default_context()
PUBLIC = os.environ.get('ZHIYU_PUBLIC') == '1'
ALLOWED = [o.strip().rstrip('/') for o in os.environ.get('ALLOWED_ORIGINS', 'https://jonilin0210.github.io').split(',') if o.strip()]
PER_IP = int(os.environ.get('PER_IP_DAILY', '5'))
GLOBAL = int(os.environ.get('GLOBAL_DAILY', '200'))


class Quota:
    """按北京时间按天计数：每个访客 PER_IP 次，全站 GLOBAL 次。
    计数存在内存里：函数计算只开 1 个实例时有效；实例空闲回收后会清零，
    所以 DeepSeek 账户里只充少量余额，作为最终的硬上限。"""
    def __init__(self):
        self.lock = threading.Lock(); self.day = None; self.ips = {}; self.total = 0

    def _roll(self):
        d = (datetime.datetime.utcnow() + datetime.timedelta(hours=8)).date().isoformat()
        if d != self.day: self.day, self.ips, self.total = d, {}, 0

    def remaining(self, ip):
        with self.lock:
            self._roll()
            return max(0, min(PER_IP - self.ips.get(ip, 0), GLOBAL - self.total))

    def take(self, ip):
        with self.lock:
            self._roll()
            if self.total >= GLOBAL: return 'global'
            if self.ips.get(ip, 0) >= PER_IP: return 'ip'
            self.ips[ip] = self.ips.get(ip, 0) + 1; self.total += 1
            return None

    def refund(self, ip):
        with self.lock:
            if self.ips.get(ip): self.ips[ip] -= 1; self.total = max(0, self.total - 1)


QUOTA = Quota()


def load_conf():
    try:
        return json.load(open(CONF))
    except Exception:
        return {}


def api_key():
    return os.environ.get('DEEPSEEK_API_KEY') or load_conf().get('deepseek_api_key', '')


def library_lines():
    """从 data.js 里取出 id、中文名、学名，给模型做比对用。"""
    try:
        src = open(os.path.join(ROOT, 'data.js'), encoding='utf-8').read()
        arr = json.loads(src[src.index('['):src.rindex(']') + 1])
        return '\n'.join(f"{p['id']}：{p['cn']} {p['latin']}" for p in arr)
    except Exception:
        return ''


CATS = ['foliage', 'succulent', 'flower', 'tree', 'herb', 'wild', 'water', 'odd']
EXAMPLE = {
    'is_plant': True, 'library_id': 'ginkgo', 'name_cn': '银杏', 'name_latin': 'Ginkgo biloba', 'family_cn': '银杏科',
    'category': 'tree', 'confidence': 'high', 'clues': '扇形叶片、叶脉呈二叉状平行分布，叶片已经变黄。',
    'persona': '……', 'facts': ['……', '……', '……'], 'kin': '……', 'care_tip': '', 'look_alikes': ['鹅掌楸'],
}


_PROMPT = None


def system_prompt():
    global _PROMPT
    if _PROMPT is None: _PROMPT = _build_prompt()
    return _PROMPT


def _build_prompt():
    return f"""你是植物学家，也是会讲故事的科普作者，为植物图鉴 App「植遇」识别用户拍到的植物。请只输出一个 json 对象。

识别规则：
- 只依据照片里能看到的特征判断（叶形、叶序、叶脉、花的结构、树皮、果实等），把关键线索写进 clues。
- 看不清或有多种可能时，confidence 用 medium 或 low，并在 look_alikes 里列出候选（最多 3 个中文名）。
- 照片里没有植物时 is_plant 为 false，clues 写看到了什么，其他字符串字段留空、数组留空。
- 如果和下方图鉴库中的某一条是同一物种（或同属且外观一致），library_id 填它的 id，否则填空字符串。

写作规则：
- 全部用简体中文，语气轻松具体，不用感叹号，不写口号式总结。
- facts 正好 3 条，只写有可靠来源的事实；不确定的数字宁可不写，不编造诗句、研究或数据。
- persona 是植物第一人称的一两句自我介绍，内容要和它真实的习性对得上。
- kin 一句话说它和哪些常见植物同科或同属。care_tip：适合家养就给一句养护建议，否则留空。
- category 从 {CATS} 中选一个，confidence 从 high / medium / low 中选一个。

输出 json 的格式示例：
{json.dumps(EXAMPLE, ensure_ascii=False)}

图鉴库（id：中文名 学名）：
{library_lines()}"""


def identify(image_b64=None, name=None):
    key = api_key()
    if not key:
        return 400, {'error': 'no_key', 'message': '还没有配置 DeepSeek API Key'}
    if name:   # 按名字查询（没有照片）
        user = [{'type': 'text', 'text': f'图鉴里没有找到「{name}」。请根据这个名称介绍这种植物，按要求输出 json。'
                 '没有照片，所以 clues 写一两句它最容易辨认的特征；如果名称有歧义，选最常见的那种，confidence 用 medium，并在 look_alikes 里列出其他可能；'
                 '如果这不是植物，is_plant 为 false。'}]
    else:
        user = [{'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + image_b64}},
                {'type': 'text', 'text': '这是我刚拍到的植物，帮我认一认，按要求输出 json。'}]
    body = {
        'model': MODEL,
        'messages': [
            {'role': 'system', 'content': system_prompt()},
            {'role': 'user', 'content': user},
        ],
        'thinking': {'type': 'disabled'},
        'response_format': {'type': 'json_object'},
        'max_tokens': 2000,
    }
    req = urllib.request.Request(API, data=json.dumps(body).encode(), method='POST', headers={
        'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key})
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=90, context=CTX) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode('utf-8', 'ignore')[:300]
        msg = {401: 'API Key 无效，请在设置里检查。', 402: 'DeepSeek 账户余额不足。', 429: '请求太频繁，稍后再试。'}.get(
            e.code, f'DeepSeek 返回错误（{e.code}）')
        return 502, {'error': 'upstream', 'status': e.code, 'message': msg, 'detail': detail}
    except Exception as e:
        return 502, {'error': 'network', 'message': '连不上 DeepSeek 服务，检查一下网络。', 'detail': str(e)[:200]}
    choice = data['choices'][0]
    content = (choice['message'].get('content') or '').strip()
    if choice.get('finish_reason') == 'length' or not content:
        return 502, {'error': 'empty', 'message': '识别结果不完整，再试一次。'}
    try:
        result = json.loads(content)
    except Exception:
        return 502, {'error': 'bad_json', 'message': '识别结果格式异常，再试一次。'}
    result['_meta'] = {'model': MODEL, 'seconds': round(time.time() - t0, 1), 'usage': data.get('usage')}
    return 200, result


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if args and '/api/' in str(args[0]):
            super().log_message(fmt, *args)

    def client_ip(self):
        xf = self.headers.get('X-Forwarded-For') or self.headers.get('X-Real-IP') or ''
        return (xf.split(',')[0].strip() or self.client_address[0])

    def cors(self):
        origin = (self.headers.get('Origin') or '').rstrip('/')
        if not PUBLIC or origin in ALLOWED or origin.startswith(('http://localhost', 'http://127.0.0.1')):
            self.send_header('Access-Control-Allow-Origin', origin or '*')
            self.send_header('Vary', 'Origin')
            self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            self.send_header('Access-Control-Allow-Headers', 'Content-Type')
            self.send_header('Access-Control-Max-Age', '86400')

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        if self.path.startswith('/api/'): self.cors()
        super().end_headers()

    def send_json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_OPTIONS(self):
        self.send_response(204); self.end_headers()

    def do_GET(self):
        if self.path.startswith('/api/status'):
            return self.send_json(200, {'configured': bool(api_key()), 'model': MODEL, 'public': PUBLIC,
                                        'from_env': bool(os.environ.get('DEEPSEEK_API_KEY')),
                                        'remaining': QUOTA.remaining(self.client_ip()), 'per_ip': PER_IP})
        if PUBLIC or self.path.startswith('/config.local') or self.path.startswith('/_build') or self.path.endswith('.py'):
            return self.send_error(404)
        return super().do_GET()

    def do_POST(self):
        n = int(self.headers.get('Content-Length') or 0)
        if n > 8 * 1024 * 1024:
            return self.send_json(413, {'message': '图片太大了'})
        try:
            body = json.loads(self.rfile.read(n) or b'{}')
        except Exception:
            return self.send_json(400, {'message': '请求格式不对'})
        if self.path == '/api/config':
            if PUBLIC:
                return self.send_json(403, {'message': '公开版不能在网页上修改 Key'})
            conf = load_conf()
            conf['deepseek_api_key'] = (body.get('apiKey') or '').strip()
            with open(CONF, 'w') as f:
                json.dump(conf, f)
            os.chmod(CONF, 0o600)
            return self.send_json(200, {'configured': bool(api_key())})
        if self.path in ('/api/identify', '/api/lookup'):
            img = body.get('image') or '' if self.path == '/api/identify' else ''
            name = (body.get('name') or '').strip()[:40] if self.path == '/api/lookup' else ''
            if self.path == '/api/identify' and not img:
                return self.send_json(400, {'message': '没有收到图片'})
            if self.path == '/api/lookup' and not name:
                return self.send_json(400, {'message': '没有收到植物名'})
            ip = self.client_ip()
            over = QUOTA.take(ip)
            if over == 'ip':
                return self.send_json(429, {'error': 'quota_ip', 'message': f'今天的识别次数用完了（每人每天 {PER_IP} 次），明天再来。图鉴和花历可以照常看。'})
            if over == 'global':
                return self.send_json(429, {'error': 'quota_global', 'message': '今天全站的识别次数已经用完，明天再来。图鉴和花历可以照常看。'})
            code, obj = identify(image_b64=img) if img else identify(name=name)
            if code != 200: QUOTA.refund(ip)
            if code == 200: obj['_remaining'] = QUOTA.remaining(ip)
            return self.send_json(code, obj)
        self.send_error(404)


if __name__ == '__main__':
    if PUBLIC:
        port = int(os.environ.get('FC_SERVER_PORT', '9000')); host = '0.0.0.0'
    else:
        port = int(sys.argv[sys.argv.index('--port') + 1]) if '--port' in sys.argv else 8803; host = '127.0.0.1'
    print(f'植遇 running at http://{host}:{port}  public={PUBLIC}', flush=True)
    ThreadingHTTPServer((host, port), Handler).serve_forever()
