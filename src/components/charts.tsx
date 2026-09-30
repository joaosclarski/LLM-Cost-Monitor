"use client"

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { MA_WINDOW, PROVIDERS, type PeriodKey, type Provider, byModel, timeSeries } from "@/lib/data"
import { fmtCompact, fmtMs, fmtTime, fmtUsd } from "@/lib/utils"

export const PROVIDER_COLOR: Record<Provider, string> = {
  OpenAI: "var(--series-1)",
  Anthropic: "var(--series-2)",
  Google: "var(--series-3)",
}

const axis = { stroke: "var(--border)", tick: { fill: "var(--muted-foreground)", fontSize: 11 }, tickLine: false }
const grid = <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0" />

type TipItem = { name?: string | number; value?: unknown; color?: string; payload?: Record<string, unknown> }

function Tip({
  active,
  payload,
  label,
  title,
  value,
  extra,
}: {
  active?: boolean
  payload?: readonly TipItem[]
  label?: string | number
  title: (label: string | number, row: Record<string, unknown>) => string
  value: (v: number) => string
  extra?: (row: Record<string, unknown>) => string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload ?? {}
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs text-popover-foreground shadow-lg">
      <div className="mb-1.5 font-medium">{title(label ?? "", row)}</div>
      {payload.map((p) =>
        typeof p.value === "number" ? (
          <div key={String(p.name)} className="flex items-center gap-2 py-0.5">
            <span className="size-2 rounded-full" style={{ background: p.color }} />
            <span className="text-muted-foreground">{p.name}</span>
            <span className="ml-auto font-mono tabular-nums">{value(p.value)}</span>
          </div>
        ) : null,
      )}
      {extra && <div className="mt-1.5 border-t pt-1.5 text-muted-foreground">{extra(row)}</div>}
    </div>
  )
}

type Series = ReturnType<typeof timeSeries>
const withDay = (p: PeriodKey) => p !== "24h"

export function SpendChart({ data, period }: { data: Series; period: PeriodKey }) {
  const last = data.at(-1)
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Gasto acumulado por provedor</CardTitle>
        <CardDescription>Custo somado ao longo do período (USD)</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {PROVIDERS.map((p) => (
            <div key={p} className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 rounded-full" style={{ background: PROVIDER_COLOR[p] }} />
              <span className="text-muted-foreground">{p}</span>
              <span className="font-mono tabular-nums">{fmtUsd(last?.[p] ?? 0)}</span>
            </div>
          ))}
        </div>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              {grid}
              <XAxis dataKey="t" {...axis} tickFormatter={(t) => fmtTime(t, withDay(period))} minTickGap={32} />
              <YAxis {...axis} axisLine={false} width={52} tickFormatter={(v) => `$${fmtCompact(v)}`} />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                content={<Tip title={(t) => fmtTime(Number(t), true)} value={fmtUsd} />}
              />
              {PROVIDERS.map((p) => (
                <Line
                  key={p}
                  dataKey={p}
                  type="monotone"
                  stroke={PROVIDER_COLOR[p]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function ModelChart({ data }: { data: ReturnType<typeof byModel> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Consumo por modelo</CardTitle>
        <CardDescription>Custo no período</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-72">
          <ResponsiveContainer>
            <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barCategoryGap={6}>
              <CartesianGrid horizontal={false} stroke="var(--border)" />
              <XAxis type="number" {...axis} tickFormatter={(v) => `$${fmtCompact(v)}`} />
              <YAxis type="category" dataKey="model" {...axis} axisLine={false} width={112} />
              <Tooltip
                cursor={{ fill: "var(--muted)" }}
                content={
                  <Tip
                    title={(m) => String(m)}
                    value={fmtUsd}
                    extra={(r) => `${fmtCompact(Number(r.tokens))} tokens · ${r.requests} req.`}
                  />
                }
              />
              <Bar dataKey="cost" name="Custo" fill="var(--series-1)" radius={[0, 4, 4, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

export function LatencyChart({ data, period }: { data: Series; period: PeriodKey }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader>
        <CardTitle>Latência média</CardTitle>
        <CardDescription>Média por intervalo e média móvel ({MA_WINDOW} intervalos)</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="mb-3 flex gap-5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-muted-foreground/60" /> Média do intervalo
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-3 rounded-full bg-series-1" /> Média móvel
          </span>
        </div>
        <div className="min-h-56 flex-1">
          <ResponsiveContainer>
            <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              {grid}
              <XAxis dataKey="t" {...axis} tickFormatter={(t) => fmtTime(t, withDay(period))} minTickGap={32} />
              <YAxis {...axis} axisLine={false} width={52} tickFormatter={fmtMs} />
              <Tooltip
                cursor={{ stroke: "var(--muted-foreground)", strokeDasharray: "3 3" }}
                content={<Tip title={(t) => fmtTime(Number(t), true)} value={fmtMs} />}
              />
              <Line
                dataKey="latency"
                name="Média"
                stroke="var(--muted-foreground)"
                strokeOpacity={0.6}
                strokeWidth={1.5}
                dot={false}
                connectNulls
                isAnimationActive={false}
              />
              <Line
                dataKey="latencyMA"
                name="Média móvel"
                type="monotone"
                stroke="var(--series-1)"
                strokeWidth={2}
                dot={false}
                connectNulls
                activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}
