import type { IncomingMessage, ServerResponse } from 'node:http'

interface CtripConfig { token?: string; endpoint?: string }
interface ToolDefinition {
  name: string
  inputSchema?: { properties?: Record<string, { type?: string }>; required?: string[] }
}
interface RpcResponse {
  result?: { tools?: ToolDefinition[]; content?: Array<{ type?: string; text?: string }> }
  error?: { message?: string }
}

let requestId = 1
let toolsCache: { expiresAt: number; tools: ToolDefinition[] } | null = null

function sendJson(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(value))
}

function parseRpc(raw: string): RpcResponse {
  const candidates = raw.split(/\r?\n/).filter((line) => line.startsWith('data:')).map((line) => line.slice(5).trim())
  const serialized = candidates.at(-1) || raw.trim()
  try { return JSON.parse(serialized) as RpcResponse } catch { throw new Error('携程 MCP 返回了无法解析的响应') }
}

async function rpc(config: CtripConfig, method: string, params: Record<string, unknown>) {
  const response = await fetch(config.endpoint || 'https://u.ctrip.com/faas/mcp', {
    method: 'POST',
    headers: { Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json', Authorization: `Bearer ${config.token}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: requestId++, method, params }),
    signal: AbortSignal.timeout(20000),
  })
  const result = parseRpc(await response.text())
  if (!response.ok || result.error) throw new Error(result.error?.message || `携程 MCP 请求失败（HTTP ${response.status}）`)
  return result.result || {}
}

async function listTools(config: CtripConfig) {
  if (toolsCache && toolsCache.expiresAt > Date.now()) return toolsCache.tools
  const result = await rpc(config, 'tools/list', {})
  const tools = result.tools || []
  toolsCache = { tools, expiresAt: Date.now() + 15 * 60 * 1000 }
  return tools
}

function argumentsFor(tool: ToolDefinition, city: string, place: string) {
  const properties = tool.inputSchema?.properties || {}
  const required = new Set(tool.inputSchema?.required || [])
  const args: Record<string, unknown> = {}
  const normalized = (name: string) => name.replace(/[_-]/g, '').toLowerCase()
  for (const [name, definition] of Object.entries(properties)) {
    const key = normalized(name)
    if (/^(city|cityname|destinationcity|destination)$/.test(key)) args[name] = city
    else if (/^(keyword|query|placename|poiname|scenicname|scenicspotname|restaurantname|name)$/.test(key)) args[name] = place
    else if (/^(pagesize|size|limit|count)$/.test(key)) args[name] = 5
    else if (/^(page|pagenum|pageindex)$/.test(key)) args[name] = 1
    else if (required.has(name)) {
      if (definition.type === 'string') args[name] = place
      else if (definition.type === 'number' || definition.type === 'integer') args[name] = 1
      else if (definition.type === 'boolean') args[name] = false
    }
  }
  return args
}

async function callTool(config: CtripConfig, tools: ToolDefinition[], name: string, city: string, place: string) {
  const tool = tools.find((item) => item.name === name)
  if (!tool) throw new Error(`携程 MCP 未提供 ${name}`)
  const result = await rpc(config, 'tools/call', { name, arguments: argumentsFor(tool, city.replace(/市$/, ''), place) })
  const content = (result.content || []).filter((item) => item.type === 'text' && item.text).map((item) => item.text).join('\n').trim()
  if (!content || /^(身份不合法|未授权|鉴权失败)$/i.test(content)) throw new Error(`${name}：${content || '没有返回数据'}`)
  try {
    const data = JSON.parse(content) as unknown
    if (name === 'query_restaurant' && Array.isArray(data)) {
      return JSON.stringify(data.slice(0, 5).map((item) => {
        const restaurant = item && typeof item === 'object' ? item as Record<string, unknown> : {}
        return {
          name: restaurant.name,
          address: restaurant.address,
          cuisineNames: restaurant.cuisineNames,
          averagePrice: restaurant.averagePrice,
          openTime: restaurant.openTime,
          link: (restaurant.linkUrls as Record<string, unknown> | undefined)?.cripH5,
        }
      }))
    }
    return JSON.stringify(data)
  } catch {
    return content.slice(0, 12000)
  }
}

async function queryRank(config: CtripConfig, tools: ToolDefinition[], city: string) {
  if (!tools.some((item) => item.name === 'query_rank')) throw new Error('携程 MCP 未提供 query_rank')
  const result = await rpc(config, 'tools/call', { name: 'query_rank', arguments: { city: city.replace(/市$/, ''), chartType: '景点', size: 10 } })
  const content = (result.content || []).find((item) => item.type === 'text')?.text || ''
  if (!content || content === '身份不合法') throw new Error(content || '携程景点榜单没有返回数据')
  const rankings = JSON.parse(content) as unknown
  if (!Array.isArray(rankings)) return []
  const seen = new Set<string>()
  return rankings.flatMap((ranking) => {
    const chart = ranking && typeof ranking === 'object' ? ranking as Record<string, unknown> : {}
    const details = chart.rankingItemInfo && typeof chart.rankingItemInfo === 'object' ? chart.rankingItemInfo as Record<string, unknown> : {}
    const items = Array.isArray(details.itemList) ? details.itemList : []
    return items.flatMap((entry) => {
      const value = entry && typeof entry === 'object' ? entry as Record<string, unknown> : {}
      const item = value.itemBasicInfo && typeof value.itemBasicInfo === 'object' ? value.itemBasicInfo as Record<string, unknown> : {}
      const name = typeof item.businessName === 'string' ? item.businessName.trim() : ''
      if (!name || seen.has(name)) return []
      seen.add(name)
      return [{ name, rank: Number(item.rank) || 0, reason: typeof item.recommendReason === 'string' ? item.recommendReason : '' }]
    })
  }).slice(0, 12)
}

export function createCtripMcpMiddleware(config: CtripConfig) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url || '/', 'http://localhost')
    if (url.pathname !== '/api/ctrip/guide' && url.pathname !== '/api/ctrip/rank') { next(); return }
    if (req.method !== 'GET') { sendJson(res, 405, { error: '仅支持 GET 请求' }); return }
    if (!config.token) {
      sendJson(res, 200, url.pathname === '/api/ctrip/rank' ? { configured: false, places: [] } : { configured: false, ticket: '', restaurant: '', errors: [] })
      return
    }
    const city = url.searchParams.get('city')?.trim() || ''
    const place = url.searchParams.get('place')?.trim() || ''
    if (!city || city.length > 40 || (url.pathname === '/api/ctrip/guide' && (!place || place.length > 80))) { sendJson(res, 400, { error: '城市或地点名称无效' }); return }
    try {
      const tools = await listTools(config)
      if (url.pathname === '/api/ctrip/rank') {
        sendJson(res, 200, { configured: true, places: await queryRank(config, tools, city) })
        return
      }
      const [ticket, restaurant] = await Promise.allSettled([
        callTool(config, tools, 'query_ticket', city, place),
        callTool(config, tools, 'query_restaurant', city, place),
      ])
      sendJson(res, 200, {
        configured: true,
        ticket: ticket.status === 'fulfilled' ? ticket.value : '',
        restaurant: restaurant.status === 'fulfilled' ? restaurant.value : '',
        errors: [ticket, restaurant].flatMap((item) => item.status === 'rejected' ? [item.reason instanceof Error ? item.reason.message : '携程查询失败'] : []),
      })
    } catch (error) {
      sendJson(res, 502, { error: error instanceof Error ? error.message : '携程 MCP 暂时不可用' })
    }
  }
}
