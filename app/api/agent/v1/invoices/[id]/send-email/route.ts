import { withAgentAuth } from '@/lib/agent/route';
import { sendInvoiceEmailService } from '@/lib/agent/services/invoices';

// Body opcional: {} ou { "to": "email@cliente.com" }. Corpo vazio é válido
// (usa o e-mail cadastrado do cliente); JSON malformado cai no catch central
// de withAgentAuth e vira 400 VALIDATION_ERROR.
// Mesmo padrão de POST /reminders/:id/send-now: falha de envio não vira erro
// HTTP, a resposta é 200 com sent:false e error preenchido.
export const POST = withAgentAuth<{ id: string }>(async ({ request, params }) => {
  const raw = await request.text();
  const input = raw ? JSON.parse(raw) : {};

  const { before, after, sent, error, to } = await sendInvoiceEmailService(params.id, input);
  return {
    status: 200,
    body: { invoice: after, sent, error, to },
    resourceType: 'invoice',
    resourceId: params.id,
    requestBody: { to },
    beforeData: before,
    afterData: after,
  };
});
