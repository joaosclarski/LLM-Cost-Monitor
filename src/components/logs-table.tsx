"use client"

import { useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { PROVIDER_COLOR } from "@/components/charts"
import {
  LATENCY_RANGES,
  MODEL_IDS,
  MODELS,
  STATUSES,
  type LatencyKey,
  type Log,
  type LogFilter,
  type Status,
  filterLogs,
} from "@/lib/data"
import { cn, fmtMs, fmtTime, fmtUsd } from "@/lib/utils"

const PAGE_SIZE = 12

const STATUS_UI: Record<Status, { label: string; cls: string }> = {
  200: { label: "200 OK", cls: "text-good border-good/30 bg-good/10" },
  429: { label: "429 Rate Limit", cls: "text-amber-700 dark:text-warning border-warning/40 bg-warning/10" },
  500: { label: "500 Erro", cls: "text-critical border-critical/30 bg-critical/10" },
}

const modelItems = [{ value: "all", label: "Todos os modelos" }, ...MODEL_IDS.map((m) => ({ value: m, label: m }))]
const latencyItems = (Object.keys(LATENCY_RANGES) as LatencyKey[]).map((k) => ({ value: k, label: LATENCY_RANGES[k].label }))

export function LogsTable({ logs }: { logs: Log[] }) {
  const [filter, setFilter] = useState<LogFilter>({ status: "all", model: "all", latency: "all" })
  const [page, setPage] = useState(0)
  const set = (patch: Partial<LogFilter>) => {
    setFilter((f) => ({ ...f, ...patch }))
    setPage(0)
  }

  const rows = useMemo(() => filterLogs(logs, filter), [logs, filter])
  // Counts per status honour the other active filters (cross-filtering).
  const counts = useMemo(() => {
    const base = filterLogs(logs, { ...filter, status: "all" })
    const c: Record<string, number> = { all: base.length }
    for (const l of base) c[l.status] = (c[l.status] ?? 0) + 1
    return c
  }, [logs, filter])

  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const current = Math.min(page, pages - 1)
  const visible = rows.slice(current * PAGE_SIZE, (current + 1) * PAGE_SIZE)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs de requisições</CardTitle>
        <CardDescription>Tráfego simulado do gateway · atualiza em tempo real</CardDescription>
        <CardAction className="font-mono text-xs text-muted-foreground tabular-nums">{rows.length} resultados</CardAction>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border p-0.5" role="group" aria-label="Filtrar por status">
            {(["all", ...STATUSES] as const).map((s) => (
              <button
                key={s}
                onClick={() => set({ status: s })}
                aria-pressed={filter.status === s}
                className={cn(
                  "relative rounded-md px-2.5 py-1 text-xs transition-colors",
                  filter.status === s ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {filter.status === s && (
                  <motion.span layoutId="status-pill" className="absolute inset-0 rounded-md bg-muted" transition={{ duration: 0.2 }} />
                )}
                <span className="relative">
                  {s === "all" ? "Todos" : s} <span className="font-mono opacity-60">{counts[s] ?? 0}</span>
                </span>
              </button>
            ))}
          </div>
          <Select items={modelItems} value={filter.model} onValueChange={(v) => set({ model: v as LogFilter["model"] })}>
            <SelectTrigger size="sm" className="min-w-44" aria-label="Filtrar por modelo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {modelItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select items={latencyItems} value={filter.latency} onValueChange={(v) => set({ latency: v as LatencyKey })}>
            <SelectTrigger size="sm" className="min-w-40" aria-label="Filtrar por latência">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {latencyItems.map((i) => (
                <SelectItem key={i.value} value={i.value}>
                  {i.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>Horário</TableHead>
                <TableHead>ID</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Latência</TableHead>
                <TableHead className="text-right">Tokens (in / out)</TableHead>
                <TableHead className="text-right">Custo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs tabular-nums">
              {visible.map((l) => (
                <motion.tr
                  key={l.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="border-b transition-colors hover:bg-muted/50"
                >
                  <TableCell className="text-muted-foreground">{fmtTime(l.ts, true)}</TableCell>
                  <TableCell className="text-muted-foreground">{l.id}</TableCell>
                  <TableCell>
                    <span className="flex items-center gap-2 font-sans">
                      <span className="size-2 rounded-full" style={{ background: PROVIDER_COLOR[MODELS[l.model].provider] }} />
                      {l.model}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={cn("rounded-md border px-1.5 py-0.5 text-[11px]", STATUS_UI[l.status].cls)}>
                      {STATUS_UI[l.status].label}
                    </span>
                  </TableCell>
                  <TableCell className={cn("text-right", l.latency > 2000 && "text-critical")}>{fmtMs(l.latency)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {l.inputTokens.toLocaleString("pt-BR")} / {l.outputTokens.toLocaleString("pt-BR")}
                  </TableCell>
                  <TableCell className="text-right">{fmtUsd(l.cost)}</TableCell>
                </motion.tr>
              ))}
              {!visible.length && (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center font-sans text-muted-foreground">
                    Nenhuma requisição corresponde aos filtros.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="tabular-nums">
            {rows.length ? `${current * PAGE_SIZE + 1}–${current * PAGE_SIZE + visible.length} de ${rows.length}` : "0 resultados"}
          </span>
          <div className="flex items-center gap-2">
            <span className="tabular-nums">
              Página {current + 1} de {pages}
            </span>
            <Button variant="outline" size="icon-sm" disabled={current === 0} onClick={() => setPage(current - 1)} aria-label="Página anterior">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" disabled={current >= pages - 1} onClick={() => setPage(current + 1)} aria-label="Próxima página">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
