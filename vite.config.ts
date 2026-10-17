import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { amapProxy } from './server/amap-proxy'
import { createDoubaoApiMiddleware } from './server/doubao-api'
import { createWechatDraftMiddleware } from './server/wechat-draft'
import { createCtripMcpMiddleware } from './server/ctrip-mcp'
import { createCommunityMiddleware } from './server/community'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const normalizedEnv = Object.fromEntries(Object.entries(env).map(([name, value]) => [name.replace(/^\uFEFF/, ''), value]))
  const doubaoApi = createDoubaoApiMiddleware({
    apiKey: normalizedEnv.DOUBAO_API_KEY || process.env.DOUBAO_API_KEY,
    model: normalizedEnv.DOUBAO_MODEL || process.env.DOUBAO_MODEL,
    baseUrl: normalizedEnv.DOUBAO_BASE_URL || process.env.DOUBAO_BASE_URL,
  })
  const wechatDraft = createWechatDraftMiddleware({
    appId: normalizedEnv.WECHAT_APP_ID || process.env.WECHAT_APP_ID,
    appSecret: normalizedEnv.WECHAT_APP_SECRET || process.env.WECHAT_APP_SECRET,
  })
  const ctripMcp = createCtripMcpMiddleware({
    token: normalizedEnv.CTRIP_MCP_TOKEN || process.env.CTRIP_MCP_TOKEN,
    endpoint: normalizedEnv.CTRIP_MCP_URL || process.env.CTRIP_MCP_URL,
  })
  const community = createCommunityMiddleware()
  return {
    plugins: [
      vue(),
      amapProxy(normalizedEnv.AMAP_WEB_KEY || ''),
      {
        name: 'nextstop-doubao-api',
        configureServer(server) { server.middlewares.use(doubaoApi) },
        configurePreviewServer(server) { server.middlewares.use(doubaoApi) },
      },
      {
        name: 'nextstop-wechat-draft',
        configureServer(server) { server.middlewares.use(wechatDraft) },
        configurePreviewServer(server) { server.middlewares.use(wechatDraft) },
      },
      {
        name: 'nextstop-ctrip-mcp',
        configureServer(server) { server.middlewares.use(ctripMcp) },
        configurePreviewServer(server) { server.middlewares.use(ctripMcp) },
      },
      {
        name: 'nextstop-community',
        configureServer(server) { server.middlewares.use(community) },
        configurePreviewServer(server) { server.middlewares.use(community) },
      },
    ],
    server: { host: '127.0.0.1', port: 5173 },
  }
})
