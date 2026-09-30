// Run: node scripts/check-data.ts
import assert from "node:assert/strict"
import { budgetState, calcCost, filterLogs, generateLogs, inPeriod, summarize, timeSeries, PROVIDERS } from "../src/lib/data.ts"

assert.equal(calcCost("gpt-4o", 1e6, 1e6), 20)
assert.equal(calcCost("claude-3.5-sonnet", 1e6, 0), 3)
assert.deepEqual([79.9, 80, 99.9, 100, 140].map(budgetState), ["ok", "warn", "warn", "crit", "crit"])

const now = 1_760_000_000_000
const logs = generateLogs(now)
assert.ok(logs.every((l) => l.status === 200 || l.cost === 0), "failed requests are free")

for (const p of ["24h", "7d", "30d"] as const) {
  const slice = inPeriod(logs, p, now)
  const ts = timeSeries(slice, p, now)
  const last = ts.at(-1)!
  const total = PROVIDERS.reduce((s, k) => s + last[k], 0)
  assert.ok(Math.abs(total - summarize(slice).cost) < 1e-9, `cumulative == total (${p})`)
  for (let i = 1; i < ts.length; i++) assert.ok(ts[i].OpenAI >= ts[i - 1].OpenAI, "cumulative is monotonic")
}

const f = filterLogs(logs, { status: 429, model: "gpt-4o", latency: "fast" })
assert.ok(f.length > 0 && f.every((l) => l.status === 429 && l.model === "gpt-4o" && l.latency < 500))
assert.equal(filterLogs(logs, { status: "all", model: "all", latency: "all" }).length, logs.length)
console.log("data checks ok")
