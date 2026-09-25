import { Currency, Language } from "../i18n/dict";

export interface ExtractedTransactionItem {
  id: string;
  date: string;
  merchant: string;
  description?: string;
  amount: number;
  currency: Currency;
  type?: 'expense' | 'income';
  category: string;
  subcategory?: string;
  childTag?: string;
  language?: string;
  selected?: boolean;
  isInternalTransfer?: boolean;
}

export interface ScannedReceiptResult {
  date: string;
  merchant: string;
  amount: number;
  currency: Currency;
  category: string;
  categoryEs: string;
  childTag?: string;
  languageDetected: Language;
  rawText: string;
  confidenceScore: number;
  isMultiTransaction?: boolean;
  transactions?: ExtractedTransactionItem[];
  items?: { name: string; price: number }[];
}

// Re-export dos dados reais do arquivo separado
import { PERSONAL_TRANSACTIONS } from "../transactionData";
export { PERSONAL_TRANSACTIONS };
export const DEMO_PERSONAL_TRANSACTIONS = PERSONAL_TRANSACTIONS;

export const SAMPLE_RECEIPTS = [
  {
    id: "sample-extrato",
    title: "📄 Extrato Bancário Exemplo (Demonstração)",
    lang: "es" as Language,
    previewUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "Extrato Bancário Modelo",
      amount: 299150.0,
      currency: "ARS" as Currency,
      category: "Extrato / Múltiplos Gastos",
      categoryEs: "Extracto / Múltiples Gastos",
      languageDetected: "es" as Language,
      rawText: "EXTRATO BANCARIO DE DEMONSTRACAO - LANCAMENTOS EXEMPLARES PROCESSADOS COM SUCESSO.",
      confidenceScore: 0.99,
      isMultiTransaction: true,
      transactions: PERSONAL_TRANSACTIONS
    }
  },
  {
    id: "sample-supermercado",
    title: "🛒 Cupom Fiscal de Supermercado (Demonstração)",
    lang: "es" as Language,
    previewUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "Supermercado Modelo",
      amount: 48500,
      currency: "ARS" as Currency,
      category: "Alimentação & Supermercado",
      categoryEs: "Alimentación y Supermercado",
      languageDetected: "es" as Language,
      rawText: "SUPERMERCADO MODELO. Factura B. Leche, Frutas, Pañales, Carne. TOTAL: $ 48.500,00 ARS.",
      confidenceScore: 0.98,
      items: [
        { name: "Leite Integral 1L x3", price: 3600 },
        { name: "Frutas e Vegetais", price: 12400 },
        { name: "Carnes e Aves", price: 18500 },
        { name: "Itens de Higiene", price: 14000 }
      ]
    }
  },
  {
    id: "sample-escola",
    title: "🏫 Mensalidade Escolar (Demonstração)",
    lang: "es" as Language,
    previewUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "Colégio Modelo",
      amount: 185000,
      currency: "ARS" as Currency,
      category: "Filhos & Família",
      categoryEs: "Hijos y Familia",
      childTag: undefined,
      languageDetected: "es" as Language,
      rawText: "Comprovante de Pagamento de Mensalidade Escolar. TOTAL: $ 185.000,00 ARS.",
      confidenceScore: 0.99,
      items: [
        { name: "Mensalidade Escolar", price: 155000 },
        { name: "Material Didático e Atividades", price: 30000 }
      ]
    }
  },
  {
    id: "sample-delivery",
    title: "🍔 Comprovante de Restaurante / Delivery (BRL)",
    lang: "pt" as Language,
    previewUrl: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "Restaurante & Hamburgueria Exemplo",
      amount: 142.50,
      currency: "BRL" as Currency,
      category: "Alimentação & Supermercado",
      categoryEs: "Alimentación y Supermercado",
      languageDetected: "pt" as Language,
      rawText: "Pedido Realizado com Sucesso no Aplicativo de Delivery. 2x Prato Especial + Bebidas. TOTAL: R$ 142,50.",
      confidenceScore: 0.96,
      items: [
        { name: "Combo Especial", price: 110.00 },
        { name: "Taxa de Entrega", price: 32.50 }
      ]
    }
  }
];

export async function processReceiptImage(
  fileOrBase64: File | string
): Promise<ScannedReceiptResult> {
  await new Promise(resolve => setTimeout(resolve, 800));

  let filename = "";
  if (typeof fileOrBase64 !== "string") {
    filename = fileOrBase64.name.toLowerCase();

    if (fileOrBase64.type.includes("text") || filename.endsWith(".csv") || filename.endsWith(".txt") || filename.endsWith(".tsv") || filename.endsWith(".ofx")) {
      try {
        const text = await fileOrBase64.text();
        const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
        const parsedTxs: ExtractedTransactionItem[] = [];

        lines.forEach((line, index) => {
          const numbers = line.match(/\d+[\.,]?\d*/g);
          if (numbers && numbers.length > 0) {
            const val = parseFloat(numbers[numbers.length - 1].replace(',', '.'));
            if (!isNaN(val) && val > 0) {
              const dateMatch = line.match(/\d{1,2}[\/\.-]\d{1,2}([\/\.-]\d{2,4})?/);
              const dateStr = dateMatch ? dateMatch[0] : new Date().toISOString().split('T')[0];
              const merchantClean = line.replace(/[\d\$\.,\/-]/g, ' ').trim() || `Lançamento ${index + 1}`;

              parsedTxs.push({
                id: `tx-parsed-file-${index}-${Date.now()}`,
                date: dateStr.length === 10 ? dateStr : new Date().toISOString().split('T')[0],
                merchant: merchantClean.length > 3 ? merchantClean : `Lançamento ${index + 1}`,
                amount: val,
                currency: line.includes("R$") || line.includes("BRL") ? "BRL" : "ARS",
                category: "Alimentação & Supermercado",
                selected: true
              });
            }
          }
        });

        if (parsedTxs.length > 0) {
          return {
            date: new Date().toISOString().split('T')[0],
            merchant: "Extrato Importado via Arquivo",
            amount: parsedTxs.reduce((sum, t) => sum + t.amount, 0),
            currency: parsedTxs[0].currency,
            category: "Extrato / Múltiplos Gastos",
            categoryEs: "Extracto / Múltiples Gastos",
            languageDetected: "es",
            rawText: `Arquivo lido (${filename}): ${parsedTxs.length} transações identificadas.`,
            confidenceScore: 0.99,
            isMultiTransaction: true,
            transactions: parsedTxs
          };
        }
      } catch (e) {
        console.error("Erro ao ler arquivo de texto:", e);
      }
    }
  }

  // Por padrão retorna o exemplo de demonstração
  return SAMPLE_RECEIPTS[0].mockResult;
}
