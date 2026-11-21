// 植遇 · 部署配置
// 本地开发：接口和网页同源（server.py），这里留空。
// 发布到 GitHub Pages 后：拍照识别和 AI 查询走阿里云函数计算的地址。
window.ZHIYU_API = /github\.io$/.test(location.hostname) ? 'https://zhiyu-api-wtxjagquea.cn-shanghai.fcapp.run' : '';
