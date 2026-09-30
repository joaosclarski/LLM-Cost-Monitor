"use client"

import { useEffect, useRef, useState } from "react"
import { motion } from "framer-motion"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, Siren } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { type BudgetState, type Provider, budgetState } from "@/lib/data"
import { cn, fmtUsd } from "@/lib/utils"

type Scope = "Total" | Provider
interface Alert {
  scope: Scope
  limit: number
  webhook: boolean
}

const STATE_UI: Record<BudgetState, { label: string; icon: typeof CheckCircle2; text: string; bar: string }> = {
  ok: { label: "Saudável", icon: CheckCircle2, text: "text-good", bar: "bg-good" },
  warn: { label: "Atenção", icon: AlertTriangle, text: "text-amber-700 dark:text-warning", bar: "bg-warning" },
  crit: { label: "Crítico", icon: Siren, text: "text-critical", bar: "bg-critical animate-pulse" },
}
const RANK: Record<BudgetState, number> = { ok: 0, warn: 1, crit: 2 }

export function BudgetAlerts({ spend }: { spend: Record<Scope, number> }) {
  // Demo defaults land one alert in each state, relative to the simulated spend.
  const [alerts, setAlerts] = useState<Alert[]>(() => [
    { scope: "Total", limit: Math.ceil(spend.Total / 0.62), webhook: true },
    { scope: "OpenAI", limit: Math.ceil(spend.OpenAI / 0.9), webhook: true },
    { scope: "Anthropic", limit: Math.floor(spend.Anthropic / 1.05), webhook: true },
    { scope: "Google", limit: Math.ceil(spend.Google / 0.4), webhook: false },
  ])
  const rows = alerts.map((a) => {
    const pct = a.limit > 0 ? (spend[a.scope] / a.limit) * 100 : 0
    return { ...a, pct, state: budgetState(pct) }
  })

  // Simulated webhook: fire a toast whenever an alert escalates (ok→warn, warn→crit).
  const prev = useRef<Partial<Record<Scope, BudgetState>>>({})
  const signature = rows.map((r) => `${r.scope}:${r.state}:${r.webhook}`).join("|")
  useEffect(() => {
    for (const r of rows) {
      const before = prev.current[r.scope] ?? "ok"
      prev.current[r.scope] = r.state
      if (!r.webhook || RANK[r.state] <= RANK[before]) continue
      const msg = `Webhook disparado · orçamento ${r.scope} em ${r.pct.toFixed(0)}%`
      const description = `POST https://hooks.acme.dev/budget → 200 OK (${r.state === "crit" ? "critical" : "warning"})`
      if (r.state === "crit") toast.error(msg, { description })
      else toast.warning(msg, { description })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rows change every tick; only react to state transitions
  }, [signature])

  const update = (scope: Scope, patch: Partial<Alert>) =>
    setAlerts((all) => all.map((a) => (a.scope === scope ? { ...a, ...patch } : a)))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Alertas de orçamento</CardTitle>
        <CardDescription>Consumo mensal (30 dias) vs. limite · 80% atenção, 100% crítico</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {rows.map((r) => {
          const ui = STATE_UI[r.state]
          return (
            <div
              key={r.scope}
              className={cn(
                "rounded-lg border p-3 transition-colors",
                r.state === "crit" && "border-critical/50 bg-critical/5",
                r.state === "warn" && "border-warning/40 bg-warning/5",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{r.scope}</span>
                <span className={cn("flex items-center gap-1 text-xs font-medium", ui.text)}>
                  <ui.icon className={cn("size-3.5", r.state === "crit" && "animate-pulse")} />
                  {ui.label}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(r.pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`Orçamento ${r.scope}`}>
                <motion.div
                  className={cn("h-full rounded-full", ui.bar)}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(r.pct, 100)}%` }}
                  transition={{ type: "spring", stiffness: 120, damping: 20 }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span className="font-mono tabular-nums">
                  {fmtUsd(spend[r.scope])} · {r.pct.toFixed(0)}%
                </span>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1">
                    limite $
                    <Input
                      type="number"
                      min={1}
                      value={r.limit}
                      onChange={(e) => update(r.scope, { limit: Math.max(0, Number(e.target.value)) })}
                      className="h-6 w-20 px-1.5 font-mono text-xs"
                      aria-label={`Limite ${r.scope}`}
                    />
                  </label>
                  <label className="flex items-center gap-1" title="Disparar webhook">
                    <Switch size="sm" checked={r.webhook} onCheckedChange={(v) => update(r.scope, { webhook: v })} />
                    webhook
                  </label>
                </div>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
