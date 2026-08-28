"use client";

import { useState, useTransition } from "react";
import { Check, Undo2, Loader2 } from "lucide-react";
import {
  markContractPaidAction,
  undoContractPaymentAction,
} from "@/app/(dashboard)/cash-flow/actions";

// Marcar um honorário como pago sem sair do fluxo de caixa.
//
// Confirmar aqui faz três coisas de uma vez: registra o pagamento (o que
// interrompe a cobrança automática da Juliana), emite a fatura já quitada e
// manda o recibo por e-mail ao cliente. Por isso a ação pede uma confirmação
// antes: e-mail enviado não volta atrás.

type Props = {
  contractId: string;
  dueDate: string;
  confirmed: boolean;
  clientName: string;
};

export default function PaymentButton({ contractId, dueDate, confirmed, clientName }: Props) {
  const [pending, startTransition] = useTransition();
  const [mensagem, setMensagem] = useState<string | null>(null);
  const [erro, setErro] = useState(false);

  const dataBr = new Date(dueDate + "T12:00:00").toLocaleDateString("pt-BR");

  const confirmar = () => {
    const ok = window.confirm(
      `Marcar como pago o vencimento de ${dataBr} de ${clientName}?\n\n` +
        `A fatura será emitida como quitada e o recibo vai por e-mail para o cliente.`
    );
    if (!ok) return;

    startTransition(async () => {
      const r = await markContractPaidAction(contractId, dueDate);
      setErro(!r.ok);
      setMensagem(r.message);
    });
  };

  const desfazer = () => {
    const ok = window.confirm(
      `Desfazer a confirmação de pagamento de ${dataBr} de ${clientName}?\n\n` +
        `A fatura já emitida continua valendo, e a cobrança automática volta a valer para este vencimento.`
    );
    if (!ok) return;

    startTransition(async () => {
      const r = await undoContractPaymentAction(contractId, dueDate);
      setErro(!r.ok);
      setMensagem(r.message);
    });
  };

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {/* 40px de altura no celular, onde o botão vive sozinho no card. A partir de
          sm o h-auto devolve os 32px de hoje, senão ele passaria a ditar a altura
          da linha da tabela do fluxo de caixa. */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          confirmed ? desfazer() : confirmar();
        }}
        disabled={pending}
        className={`inline-flex items-center gap-1.5 px-2.5 py-2 h-10 sm:h-auto rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
          confirmed
            ? "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
            : "bg-green-500/10 text-green-400 hover:bg-green-500/20"
        }`}
        title={confirmed ? "Desfazer a confirmação" : "Marcar como pago e enviar o recibo"}
      >
        {pending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : confirmed ? (
          <Undo2 size={12} />
        ) : (
          <Check size={12} />
        )}
        {/* Rótulo sempre visível, inclusive no celular. Um ícone de 12px sozinho não
            avisa que o clique emite fatura e dispara e-mail ao cliente. */}
        <span>{confirmed ? "Desfazer" : "Marcar pago"}</span>
      </button>
      {mensagem && (
        <span className={`text-xs max-w-[260px] text-right ${erro ? "text-red-400" : "text-zinc-500"}`}>
          {mensagem}
        </span>
      )}
    </div>
  );
}
