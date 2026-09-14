import { withAgentAuth } from '@/lib/agent/route';
import { processReceiptImage } from '@/lib/ai/receiptScanner';
import { z } from 'zod';

const scanInputSchema = z.object({
  filename: z.string().optional(),
  imageBase64: z.string().optional(),
  sampleId: z.string().optional(),
});

export const POST = withAgentAuth(async ({ request }) => {
  const body = await request.json();
  const parsed = scanInputSchema.parse(body);

  const inputName = parsed.filename || parsed.sampleId || "comprovante.jpg";
  const result = await processReceiptImage(inputName);

  return {
    status: 200,
    body: {
      success: true,
      extractedData: result,
    },
    resourceType: 'personal_scan',
    requestBody: parsed,
  };
});
