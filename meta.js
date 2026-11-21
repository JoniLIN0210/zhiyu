// 植遇 · 分类、亲戚卡、节气等静态配置（植物数据在 data.js，由 _build/build.py 生成）

window.CATS = [
  { id: 'foliage',   name: '室内观叶',   en: 'Foliage',     dot: '#2F8F5B' },
  { id: 'succulent', name: '多肉仙人掌', en: 'Succulents',  dot: '#8A7CD8' },
  { id: 'flower',    name: '花开四季',   en: 'Blooms',      dot: '#E2557A' },
  { id: 'tree',      name: '城市树木',   en: 'City Trees',  dot: '#D29A1E' },
  { id: 'herb',      name: '香草果蔬',   en: 'Edibles',     dot: '#7FA82A' },
  { id: 'wild',      name: '路边野花',   en: 'Wildflowers', dot: '#E07B39' },
  { id: 'water',     name: '水生植物',   en: 'Aquatics',    dot: '#2E8FB8' },
  { id: 'odd',       name: '奇奇怪怪',   en: 'Oddities',    dot: '#4C5BD4' },
];

window.RARITY = {
  common:   { name: '身边常见' },
  uncommon: { name: '值得留意' },
  rare:     { name: '远方来客' },
  legend:   { name: '传说级' },
};

// 意想不到的亲戚 / 撞名不撞种（same = 是一家，diff = 不是一家）
window.KIN_CARDS = [
  { rel: 'same', q: '石榴、紫薇和菱角有什么共同点？', a: '它们都属于千屈菜科，水边常见的千屈菜也是这一家。', id: 'pomegranate' },
  { rel: 'same', q: '荷花在植物家谱上离谁比较近？', a: '悬铃木。按 APG 分类，莲科和悬铃木科同在山龙眼目，比睡莲近得多。', id: 'lotus' },
  { rel: 'diff', q: '荷花和睡莲是一家吗？', a: '不是。睡莲属于睡莲科，在被子植物里分化得很早，和荷花关系很远。', id: 'waterlily' },
  { rel: 'same', q: '牛油果的亲戚是哪棵行道树？', a: '香樟。牛油果、肉桂和香樟都属于樟科。', id: 'avocado' },
  { rel: 'diff', q: '蜡梅是梅花的一种吗？', a: '不是。蜡梅属于蜡梅科，梅属于蔷薇科，只是名字像、都在冬天开。', id: 'wintersweet' },
  { rel: 'diff', q: '"法国梧桐"是梧桐吗？', a: '不是。它是悬铃木，梧桐属于锦葵科。', id: 'plane' },
  { rel: 'same', q: '咖啡和哪种香花是一家？', a: '栀子。咖啡和栀子都属于茜草科。', id: 'coffee' },
  { rel: 'same', q: '番茄、辣椒还和哪种主食是一家？', a: '土豆。它们都属于茄科，番茄和土豆甚至同属茄属。', id: 'tomato' },
  { rel: 'same', q: '菠萝和哪种"会挂在树上的胡子"是亲戚？', a: '松萝凤梨。菠萝和它都属于凤梨科。', id: 'pineapple' },
  { rel: 'diff', q: '菖蒲和黄菖蒲是一家吗？', a: '不是。菖蒲属于菖蒲科，黄菖蒲是鸢尾科的，只是叶子都像剑。', id: 'calamus' },
  { rel: 'same', q: '火龙果是哪类植物结的果？', a: '仙人掌。结火龙果的是一种会攀爬的仙人掌科植物。', id: 'pitaya' },
  { rel: 'same', q: '迷迭香、薰衣草、紫苏有什么共同点？', a: '都是唇形科。罗勒和薄荷也是，很多成员的茎是方的。', id: 'rosemary' },
  { rel: 'diff', q: '秋天的红叶都是枫叶吗？', a: '很多是槭树，比如鸡爪槭。槭叶对生、果实带翅，枫香叶互生、果实是带刺小球。', id: 'maple' },
  { rel: 'same', q: '山茶花和泡的茶有关系吗？', a: '有。山茶和茶树同属山茶属。', id: 'tea' },
];

// 二十四番花信风：小寒到谷雨，八个节气、每气三候，每候一种花（按江南物候）
// 名单与中国非物质文化遗产网、人民日报海外版的记载一致；id 为图鉴中能对应上的条目
window.HUAXIN = {
  '小寒': [['梅花', 'mume'], ['山茶', 'camellia'], ['水仙', 'narcissus']],
  '大寒': [['瑞香', 'daphne'], ['兰花', 'cymbidium'], ['山矾', 'symplocos']],
  '立春': [['迎春', 'winterjasmine'], ['樱桃', 'cherry'], ['望春']],
  '雨水': [['菜花', 'rapeseed'], ['杏花', 'apricot'], ['李花']],
  '惊蛰': [['桃花', 'peach'], ['棣棠', 'kerria'], ['蔷薇', 'multiflora']],
  '春分': [['海棠', 'crabapple'], ['梨花', 'pear'], ['木兰']],
  '清明': [['桐花', 'paulownia'], ['麦花', 'wheat'], ['柳花', 'willow']],
  '谷雨': [['牡丹', 'peony'], ['荼蘼'], ['楝花', 'chinaberry']],
};

window.SOLAR_TERMS = [
  [1, 5, '小寒'], [1, 20, '大寒'], [2, 4, '立春'], [2, 19, '雨水'], [3, 5, '惊蛰'], [3, 20, '春分'],
  [4, 4, '清明'], [4, 20, '谷雨'], [5, 5, '立夏'], [5, 21, '小满'], [6, 5, '芒种'], [6, 21, '夏至'],
  [7, 7, '小暑'], [7, 22, '大暑'], [8, 7, '立秋'], [8, 23, '处暑'], [9, 7, '白露'], [9, 23, '秋分'],
  [10, 8, '寒露'], [10, 23, '霜降'], [11, 7, '立冬'], [11, 22, '小雪'], [12, 7, '大雪'], [12, 21, '冬至'],
];
