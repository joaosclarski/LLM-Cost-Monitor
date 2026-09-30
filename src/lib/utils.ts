export { cn } from "cn"

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
const usdSmall = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 4, maximumFractionDigits: 4 })
const compact = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 })

export const fmtUsd = (v: number) => (v !== 0 && Math.abs(v) < 0.1 ? usdSmall : usd).format(v)
export const fmtCompact = (v: number) => compact.format(v)
export const fmtMs = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${Math.round(v)}ms`)
export const fmtTime = (t: number, withDay = false) =>
  new Date(t).toLocaleString("pt-BR", {
    ...(withDay && { day: "2-digit", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  })
