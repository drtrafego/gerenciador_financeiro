import { TrendingUp, TrendingDown, CheckCircle, AlertCircle, DollarSign, BarChart2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { formatCurrency, convertAmount, type Currency, type RatesMap } from "@/lib/currency/format";

const ICONS: Record<string, any> = {
  "trending-up":   TrendingUp,
  "trending-down": TrendingDown,
  "check":         CheckCircle,
  "alert":         AlertCircle,
  "dollar":        DollarSign,
  "bar-chart":     BarChart2,
};

const COLORS: Record<string, string> = {
  indigo: "text-indigo-400 bg-indigo-500/10",
  green:  "text-green-400 bg-green-500/10",
  red:    "text-red-400 bg-red-500/10",
  yellow: "text-yellow-400 bg-yellow-500/10",
};

const GLOW: Record<string, string> = {
  indigo: "bg-indigo-500/10",
  green:  "bg-green-500/10",
  red:    "bg-red-500/10",
  yellow: "bg-yellow-500/10",
};

interface MetricCardProps {
  label: string;
  value: number;
  currency?: Currency;
  sourceCurrency?: Currency;
  raw?: boolean;
  sub?: string;
  icon: string;
  color?: string;
  trend?: number;
  rate?: RatesMap;
  hidden?: boolean;
  delayMs?: number;
}

export default function MetricCard({
  label,
  value,
  currency = "BRL",
  sourceCurrency = "BRL",
  raw = false,
  sub,
  icon,
  color = "indigo",
  trend,
  rate,
  hidden = false,
  delayMs = 0,
}: MetricCardProps) {
  const Icon = ICONS[icon] ?? DollarSign;
  const converted =
    !raw && rate && currency !== sourceCurrency
      ? convertAmount(value, sourceCurrency, currency, rate)
      : value;
  const displayValue = hidden ? "••••••" : raw ? String(value) : formatCurrency(converted, currency);

  return (
    <div
      className="group relative overflow-hidden bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3 transition-all duration-200 hover:border-zinc-700 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/30 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <div className={`pointer-events-none absolute -right-3 -top-3 w-16 h-16 rounded-full blur-2xl transition-opacity duration-200 opacity-70 group-hover:opacity-100 ${GLOW[color] ?? GLOW.indigo}`} />
      <div className="relative flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide leading-tight">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${COLORS[color] ?? COLORS.indigo}`}>
          <Icon size={15} />
        </div>
      </div>
      <div className="relative">
        <p className="text-xl sm:text-2xl font-bold text-zinc-100 truncate tabular-nums">{displayValue}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1 truncate">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`relative inline-flex w-fit items-center gap-1 text-xs rounded-full px-2 py-0.5 ${trend >= 0 ? "text-green-400 bg-green-500/10" : "text-red-400 bg-red-500/10"}`}>
          {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />} {Math.abs(trend)}% vs mês anterior
        </div>
      )}
    </div>
  );
}

export { MetricCard };
