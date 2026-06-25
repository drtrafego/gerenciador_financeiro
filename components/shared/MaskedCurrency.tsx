"use client";

import { formatCurrency } from "@/lib/currency/format";
import type { Currency } from "@/lib/currency/format";
import { useValuesVisibility } from "@/lib/contexts/ValuesVisibilityContext";

interface Props {
  amount: number;
  currency?: Currency;
  className?: string;
}

// Valor monetário que respeita o botão global de esconder valores.
export default function MaskedCurrency({ amount, currency = "BRL", className }: Props) {
  const { hidden } = useValuesVisibility();
  return <span className={className}>{hidden ? "••••••" : formatCurrency(amount, currency)}</span>;
}
