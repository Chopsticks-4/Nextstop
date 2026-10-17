# NextStop

NextStop 是一个旅行记录与故事生成 Web 项目，包含行程推荐、路线规划、旅行记录、图文故事、社区分享、成就与导出等功能。

## 技术栈

- Vue 3、TypeScript、Vite、Vue Router
- localforage 浏览器本地存储
- Node.js 中间件提供高德、豆包、携程 MCP、微信草稿和社区接口

## 环境要求

- Node.js `^20.19.0` 或 `>=22.12.0`
- npm

## 安装与启动

1. 安装依赖：

   ```bash
   npm install
   ```

2. 将 `.env.example` 复制为 `.env.local`，按需填写本地配置。`.env.local` 已被 Git 忽略，不要提交或分享其中的真实密钥。

3. 启动开发服务器：

   ```bash
   npm run dev
   ```

4. 打开 `http://127.0.0.1:5173`。

## 环境变量

只在需要对应在线功能时配置，未配置的在线功能不可用时会使用项目已有的本地降级逻辑或返回配置提示。

| 变量 | 用途 |
| --- | --- |
| `AMAP_WEB_KEY` | 高德 Web 服务密钥 |
| `DOUBAO_API_KEY` | 豆包接口密钥 |
| `DOUBAO_MODEL` | 可选的豆包模型 ID |
| `DOUBAO_BASE_URL` | 可选的豆包接口地址 |
| `CTRIP_MCP_TOKEN` | 携程 MCP Bearer Token |
| `CTRIP_MCP_URL` | 携程 MCP 公共接口地址 |
| `WECHAT_APP_ID` | 公众号 AppID |
| `WECHAT_APP_SECRET` | 公众号 AppSecret |

## 常用命令

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
node --test tests/*.test.mjs
```

## 本地数据与隐私

- 行程和草稿主要保存在浏览器本地存储中。
- 社区运行数据会生成到 `data/community.json`，该文件已被 Git 忽略；文件缺失时服务会自动初始化为空数据。
- `node_modules/`、`dist/`、构建缓存、日志和本地环境文件均已被 Git 忽略。
- 上传公开仓库前，请确认 `public/` 中的图片和视频拥有相应的使用与公开授权。

## 项目文档

- [网站操作指南](./NextStop-网站操作指南.md)
- [NextStop MVP 设计文档](./NextStop-MVP.md)
