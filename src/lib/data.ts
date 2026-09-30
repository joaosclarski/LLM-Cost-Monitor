// Simulated LLM gateway data + pure metric helpers (no React; checked by scripts/check-data.ts).

export type Provider = "OpenAI" | "Anthropic" | "Google"
export type Status = 200 | 429 | 500
export type PeriodKey = "24h" | "7d" | "30d"
export type LatencyKey = "all" | "fast" | "mid" | "slow"
export type BudgetState = "ok" | "warn" | "crit"

export const PROVIDERS: Provider[] = ["OpenAI", "Anthropic", "Google"]
export const STATUSES: Status[] = [200, 429, 500]

// USD per 1M tokens. Simulated price table.
export const MODELS = {
  "gpt-4o": { provider: "OpenAI", input: 5, output: 15, weight: 26, latency: 900 },
  "gpt-4o-mini": { provider: "OpenAI", input: 0.15, output: 0.6, weight: 18, latency: 420 },
  "claude-3.5-sonnet": { provider: "Anthropic", input: 3, output: 15, weight: 24, latency: 1100 },
  "claude-3.5-haiku": { provider: "Anthropic", input: 0.8, output: 4, weight: 12, latency: 520 },
  "gemini-1.5-pro": { provider: "Google", input: 1.25, output: 5, weight: 10, latency: 1300 },
  "gemini-1.5-flash": { provider: "Google", input: 0.075, output: 0.3, weight: 10, latency: 320 },
} as const satisfies Record<
  string,
  { provider: Provider; input: number; output: number; weight: number; latency: number }
>
export type Model = keyof typeof MODELS
export const MODEL_IDS = Object.keys(MODELS) as Model[]

export const PERIODS: Record<PeriodKey, { label: string; ms: number; buckets: number }> = {
  "24h": { label: "Últimas 24h", ms: 24 * 36e5, buckets: 24 },
  "7d": { label: "7 dias", ms: 7 * 864e5, buckets: 28 },
  "30d": { label: "30 dias", ms: 30 * 864e5, buckets: 30 },
}

export const LATENCY_RANGES: Record<LatencyKey, { label: string; test: (ms: number) => boolean }> = {
  all: { label: "Qualquer latência", test: () => true },
  fast: { label: "< 500ms", test: (ms) => ms < 500 },
  mid: { label: "500ms – 2s", test: (ms) => ms >= 500 && ms <= 2000 },
  slow: { label: "> 2s", test: (ms) => ms > 2000 },
}

export interface Log {
  id: string
  ts: number
  model: Model
  provider: Provider
  status: Status
  latency: number
  inputTokens: number
  outputTokens: number
  cost: number
}

export function calcCost(model: Model, inputTokens: number, outputTokens: number) {
  const p = MODELS[model]
  return (inputTokens * p.input + outputTokens * p.output) / 1e6
}

export function budgetState(pct: number): BudgetState {
  return pct >= 100 ? "crit" : pct >= 80 ? "warn" : "ok"
}

// mulberry32: small seeded PRNG so the simulation is reproducible.
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const TOTAL_WEIGHT = MODEL_IDS.reduce((s, m) => s + MODELS[m].weight, 0)
let seq = 0

export function makeLog(r: () => number, ts: number): Log {
  let pick = r() * TOTAL_WEIGHT
  const model = MODEL_IDS.find((m) => (pick -= MODELS[m].weight) < 0) ?? MODEL_IDS[0]
  const roll = r()
  const status: Status = roll < 0.05 ? 429 : roll < 0.08 ? 500 : 200
  const inputTokens = Math.round(400 + r() ** 2 * 11600)
  const outputTokens = status === 200 ? Math.round(60 + r() * 1400) : 0
  const base = MODELS[model].latency
  const spike = r() < 0.06 ? 2.2 + r() * 2 : 1
  const latency =
    status === 429 ? Math.round(40 + r() * 80) : Math.round(base * (0.55 + r() * 0.9) * spike + (status === 500 ? 1500 : 0))
  return {
    id: `req_${(++seq).toString(36).padStart(5, "0")}${Math.floor(r() * 1e6).toString(36)}`,
    ts,
    model,
    provider: MODELS[model].provider,
    status,
    latency,
    inputTokens,
    outputTokens,
    // Failed requests are not billed.
    cost: status === 200 ? calcCost(model, inputTokens, outputTokens) : 0,
  }
}

export function generateLogs(now: number, count = 3200, seed = 42): Log[] {
  const r = rng(seed)
  const logs: Log[] = []
  for (let i = 0; i < count; i++) {
    // Denser traffic in recent days so the cumulative curve bends upward.
    const age = r() ** 1.25 * PERIODS["30d"].ms
    logs.push(makeLog(r, now - age))
  }
  return logs.sort((a, b) => b.ts - a.ts)
}

export function inPeriod(logs: Log[], period: PeriodKey, now: number) {
  const from = now - PERIODS[period].ms
  return logs.filter((l) => l.ts > from && l.ts <= now)
}

export function summarize(logs: Log[]) {
  let cost = 0, tokens = 0, latency = 0, errors = 0
  for (const l of logs) {
    cost += l.cost
    tokens += l.inputTokens + l.outputTokens
    latency += l.latency
    if (l.status !== 200) errors++
  }
  const n = logs.length
  return {
    cost,
    tokens,
    requests: n,
    avgLatency: n ? latency / n : 0,
    errorRate: n ? errors / n : 0,
    costPer1k: tokens ? cost / (tokens / 1000) : 0,
  }
}

export function spendByProvider(logs: Log[]) {
  const out = { OpenAI: 0, Anthropic: 0, Google: 0 } as Record<Provider, number>
  for (const l of logs) out[l.provider] += l.cost
  return out
}

export function byModel(logs: Log[]) {
  const rows = MODEL_IDS.map((model) => ({ model, provider: MODELS[model].provider, cost: 0, tokens: 0, requests: 0 }))
  for (const l of logs) {
    const row = rows[MODEL_IDS.indexOf(l.model)]
    row.cost += l.cost
    row.tokens += l.inputTokens + l.outputTokens
    row.requests++
  }
  return rows.sort((a, b) => b.cost - a.cost)
}

export const MA_WINDOW = 4

// Time buckets for the charts: cumulative spend per provider + avg latency and its moving average.
export function timeSeries(logs: Log[], period: PeriodKey, now: number) {
  const { ms, buckets } = PERIODS[period]
  const size = ms / buckets
  const start = now - ms
  const rows = Array.from({ length: buckets }, (_, i) => ({
    t: start + (i + 1) * size,
    OpenAI: 0,
    Anthropic: 0,
    Google: 0,
    latSum: 0,
    n: 0,
  }))
  for (const l of logs) {
    const i = Math.min(buckets - 1, Math.floor((l.ts - start) / size))
    if (i < 0) continue
    rows[i][l.provider] += l.cost
    rows[i].latSum += l.latency
    rows[i].n++
  }
  const acc = { OpenAI: 0, Anthropic: 0, Google: 0 }
  const lat: number[] = []
  return rows.map((r) => {
    for (const p of PROVIDERS) acc[p] += r[p]
    const latency = r.n ? r.latSum / r.n : null
    if (latency !== null) lat.push(latency)
    const win = lat.slice(-MA_WINDOW)
    return {
      t: r.t,
      ...acc,
      latency,
      latencyMA: win.length ? win.reduce((s, v) => s + v, 0) / win.length : null,
    }
  })
}

export interface LogFilter {
  status: Status | "all"
  model: Model | "all"
  latency: LatencyKey
}

export function filterLogs(logs: Log[], f: LogFilter) {
  const lat = LATENCY_RANGES[f.latency].test
  return logs.filter(
    (l) => (f.status === "all" || l.status === f.status) && (f.model === "all" || l.model === f.model) && lat(l.latency),
  )
}
