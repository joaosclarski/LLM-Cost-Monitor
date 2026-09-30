"use client"

import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import { motion } from "framer-motion"
import { useTheme } from "next-themes"
import { Activity, Coins, Gauge, Moon, Pause, Play, Sun, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { BudgetAlerts } from "@/components/budget-alerts"
import { LatencyChart, ModelChart, SpendChart } from "@/components/charts"
import { LogsTable } from "@/components/logs-table"
import {
  PERIODS,
  type Log,
  type PeriodKey,
  byModel,
  generateLogs,
  inPeriod,
  makeLog,
  spendByProvider,
  summarize,
  timeSeries,
} from "@/lib/data"
import { cn, fmtCompact, fmtMs, fmtUsd } from "@/lib/utils"

const noop = () => () => {}

// Data is generated from Date.now(), so render client-only to avoid hydration mismatches.
export function Dashboard() {
  const isClient = useSyncExternalStore(noop, () => true, () => false)
  return (
    <div className="flex min-h-screen flex-col">
      {isClient ? <Live /> : <div className="m-auto text-sm text-muted-foreground">Carregando métricas…</div>}
    </div>
  )
}

function Live() {
  const [logs, setLogs] = useState<Log[]>(() => generateLogs(Date.now()))
  const [now, setNow] = useState(() => Date.now())
  const [period, setPeriod] = useState<PeriodKey>("7d")
  const [live, setLive] = useState(true)

  useEffect(() => {
    if (!live) return
    const id = setInterval(() => {
      const t = Date.now()
      const fresh = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => makeLog(Math.random, t))
      setLogs((l) => [...fresh, ...l])
      setNow(t)
    }, 2500)
    return () => clearInterval(id)
  }, [live])

  const scoped = useMemo(() => inPeriod(logs, period, now), [logs, period, now])
  const stats = useMemo(() => summarize(scoped), [scoped])
  const series = useMemo(() => timeSeries(scoped, period, now), [scoped, period, now])
  const models = useMemo(() => byModel(scoped), [scoped])
  const monthly = useMemo(() => {
    const month = inPeriod(logs, "30d", now)
    return { Total: summarize(month).cost, ...spendByProvider(month) }
  }, [logs, now])
  const lastMA = series.findLast((s) => s.latencyMA !== null)?.latencyMA ?? 0

  const kpis = [
    { label: "Gasto no período", value: fmtUsd(stats.cost), sub: `${fmtCompact(stats.tokens)} tokens`, icon: Coins },
    {
      label: "Requisições",
      value: stats.requests.toLocaleString("pt-BR"),
      sub: `${(stats.errorRate * 100).toFixed(1)}% com erro (429/500)`,
      icon: Activity,
    },
    { label: "Custo médio / 1k tokens", value: fmtUsd(stats.costPer1k), sub: "input + output", icon: Zap },
    { label: "Latência (média móvel)", value: fmtMs(lastMA), sub: `média geral ${fmtMs(stats.avgLatency)}`, icon: Gauge },
  ]

  return (
    <>
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6">
          <div className="flex size-6 items-center justify-center rounded-md bg-foreground text-background">
            <Zap className="size-3.5" />
          </div>
          <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
            <span className="hidden text-muted-foreground sm:inline">acme</span>
            <span className="hidden text-muted-foreground/50 sm:inline">/</span>
            <span className="truncate font-medium">llm-gateway</span>
            <span className="rounded-full border px-1.5 text-[10px] text-muted-foreground">prod</span>
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => setLive((v) => !v)} aria-pressed={live}>
              <span className="relative flex size-2">
                {live && <span className="absolute inset-0 animate-ping rounded-full bg-good opacity-75" />}
                <span className={cn("relative size-2 rounded-full", live ? "bg-good" : "bg-muted-foreground")} />
              </span>
              <span className="hidden sm:inline">{live ? "Ao vivo" : "Pausado"}</span>
              {live ? <Pause className="size-3" /> : <Play className="size-3" />}
            </Button>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Custos de LLM</h1>
            <p className="text-sm text-muted-foreground">Gasto, consumo e latência de todos os provedores.</p>
          </div>
          <div className="flex rounded-lg border bg-card p-0.5" role="group" aria-label="Período">
            {(Object.keys(PERIODS) as PeriodKey[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
                className={cn(
                  "relative rounded-md px-3 py-1 text-sm transition-colors",
                  period === p ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {period === p && (
                  <motion.span layoutId="period-pill" className="absolute inset-0 rounded-md bg-muted" transition={{ duration: 0.2 }} />
                )}
                <span className="relative">{PERIODS[p].label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kpis.map((k, i) => (
            <motion.div key={k.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Card className="gap-1 px-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  {k.label}
                  <k.icon className="size-3.5" />
                </div>
                <div className="text-2xl font-semibold tracking-tight">{k.value}</div>
                <div className="text-xs text-muted-foreground">{k.sub}</div>
              </Card>
            </motion.div>
          ))}
        </div>

        <motion.div
          className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <SpendChart data={series} period={period} />
          <ModelChart data={models} />
          <LatencyChart data={series} period={period} />
          <BudgetAlerts spend={monthly} />
        </motion.div>

        <LogsTable logs={scoped} />
      </main>
    </>
  )
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const dark = resolvedTheme === "dark"
  return (
    <Button variant="ghost" size="icon-sm" onClick={() => setTheme(dark ? "light" : "dark")} aria-label="Alternar tema">
      <motion.span key={String(dark)} initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }}>
        {dark ? <Moon /> : <Sun />}
      </motion.span>
    </Button>
  )
}
