import { TrendingUp, TrendingDown, CheckCircle, AlertCircle, DollarSign, BarChart2 } from "lucide-react";
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
}: MetricCardProps) {
  const Icon = ICONS[icon] ?? DollarSign;
  const converted =
    !raw && rate && currency !== sourceCurrency
      ? convertAmount(value, sourceCurrency, currency, rate)
      : value;
  const displayValue = raw ? String(value) : formatCurrency(converted, currency);

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium uppercase tracking-wide leading-tight">
          {label}
        </span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${COLORS[color] ?? COLORS.indigo}`}>
          <Icon size={15} />
        </div>
      </div>
      <div>
        <p className="text-xl sm:text-2xl font-bold text-zinc-100 truncate">{displayValue}</p>
        {sub && <p className="text-xs text-zinc-500 mt-1 truncate">{sub}</p>}
      </div>
      {trend !== undefined && (
        <div className={`flex items-center gap-1 text-xs ${trend >= 0 ? "text-green-400" : "text-red-400"}`}>
          {trend >= 0 ? "↑" : "↓"} {Math.abs(trend)}% vs mês anterior
        </div>
      )}
    </div>
  );
}

export { MetricCard };
