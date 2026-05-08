import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

export interface SendReceiptEmailParams {
  to: string;
  clientName: string;
  invoiceNumber: string;
  amount: string;
  dueDate: string;
  description: string;
  receiptUrl: string;
  isPaid: boolean;
  paidAt?: string | null;
}

export async function sendReceiptEmail(params: SendReceiptEmailParams) {
  const { to, clientName, invoiceNumber, amount, dueDate, description, receiptUrl, isPaid, paidAt } = params;

  const subject = isPaid
    ? `Recibo de Pagamento ${invoiceNumber} - Construa Seu Sucesso`
    : `Fatura ${invoiceNumber} - Construa Seu Sucesso`;

  const statusBadge = isPaid
    ? `<span style="background:#16a34a;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px;">QUITADO</span>`
    : `<span style="background:#1d4ed8;color:#fff;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;letter-spacing:1px;">AGUARDANDO PAGAMENTO</span>`;

  const paidRow = isPaid && paidAt
    ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:13px;">Pago em</td><td style="padding:6px 0;text-align:right;color:#16a34a;font-weight:600;font-size:13px;">${new Date(paidAt).toLocaleDateString('pt-BR')}</td></tr>`
    : '';

  const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Topo colorido -->
        <tr><td style="height:6px;background:linear-gradient(90deg,#16a34a,#4ade80);"></td></tr>

        <!-- Header -->
        <tr><td style="padding:32px 40px 24px;">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1.5px;">Emitido por</p>
          <h1 style="margin:4px 0 0;font-size:22px;font-weight:800;color:#111827;">Construa Seu Sucesso</h1>
          <p style="margin:20px 0 0;font-size:18px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:3px;border-top:1px dashed #e5e7eb;padding-top:20px;">Recibo de Pagamento</p>
        </td></tr>

        <!-- Número e status -->
        <tr><td style="padding:0 40px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Número</p>
                <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#111827;font-family:monospace;">${invoiceNumber}</p>
              </td>
              <td align="right">${statusBadge}</td>
            </tr>
          </table>
        </td></tr>

        <!-- Datas -->
        <tr><td style="padding:16px 40px;border-top:1px dashed #e5e7eb;border-bottom:1px dashed #e5e7eb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:4px 0;color:#6b7280;font-size:13px;">Vencimento</td>
              <td style="padding:4px 0;text-align:right;color:#111827;font-weight:600;font-size:13px;">${new Date(dueDate + 'T12:00:00').toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>
            </tr>
            ${paidRow}
          </table>
        </td></tr>

        <!-- Cliente -->
        <tr><td style="padding:24px 40px;border-bottom:1px dashed #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Recebemos de</p>
          <p style="margin:6px 0 0;font-size:18px;font-weight:700;color:#111827;">${clientName}</p>
        </td></tr>

        <!-- Serviço -->
        <tr><td style="padding:24px 40px;border-bottom:1px dashed #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px;">Referente a</p>
          <p style="margin:6px 0 0;font-size:14px;color:#374151;">${description}</p>
        </td></tr>

        <!-- Total -->
        <tr><td style="padding:24px 40px 32px;background:#f9fafb;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="color:#6b7280;font-size:14px;">Valor Total</td>
              <td style="text-align:right;font-size:28px;font-weight:900;color:#111827;">${amount}</td>
            </tr>
          </table>
        </td></tr>

        <!-- CTA -->
        <tr><td style="padding:24px 40px 32px;text-align:center;">
          <a href="${receiptUrl}" style="display:inline-block;background:#16a34a;color:#ffffff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;">Ver Recibo Completo</a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="padding:16px 40px;background:#f3f4f6;text-align:center;border-top:1px solid #e5e7eb;">
          <p style="margin:0;font-size:11px;color:#9ca3af;">Construa Seu Sucesso &middot; Este documento é válido como comprovante de pagamento</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  await transporter.sendMail({
    from: `"Construa Seu Sucesso" <${process.env.GMAIL_USER}>`,
    to,
    subject,
    html,
  });
}
