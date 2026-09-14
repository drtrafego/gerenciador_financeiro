import { Currency, Language } from "../i18n/dict";

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
  items?: { name: string; price: number }[];
}

export const SAMPLE_RECEIPTS = [
  {
    id: "sample-coto",
    title: "🛒 Ticket Coto Supermercado (Argentina - ARS)",
    lang: "es" as Language,
    previewUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "Coto C.I.C.S.A. (Palermo - Buenos Aires)",
      amount: 48500,
      currency: "ARS" as Currency,
      category: "Alimentação & Supermercado",
      categoryEs: "Alimentación y Supermercado",
      languageDetected: "es" as Language,
      rawText: "COTO C.I.C.S.A. - Abasto / Palermo. Factura B. Leche, Frutas, Pañales, Carne. TOTAL: $ 48.500,00 ARS.",
      confidenceScore: 0.98,
      items: [
        { name: "Leche Entera 1L x3", price: 3600 },
        { name: "Frutas y Verduras Var.", price: 12400 },
        { name: "Carne Vacuna 1.5kg", price: 18500 },
        { name: "Pañales Pampers Comfort", price: 14000 }
      ]
    }
  },
  {
    id: "sample-colegio",
    title: "🏫 Cuota Colegio do Filho (Argentina - ARS)",
    lang: "es" as Language,
    previewUrl: "https://images.unsplash.com/photo-1580582932707-520aed937b7b?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "Colegio Belgrano Day School",
      amount: 285000,
      currency: "ARS" as Currency,
      category: "Filhos & Família",
      categoryEs: "Hijos y Familia",
      childTag: "Matheus",
      languageDetected: "es" as Language,
      rawText: "Comprobante de Pago Arancel Mensual. Alumno: Matheus. Nivel Primario. TOTAL ABONADO: $ 285.000,00 ARS.",
      confidenceScore: 0.99,
      items: [
        { name: "Arancel Colegiatura Mensual", price: 250000 },
        { name: "Materiales y Comedor", price: 35000 }
      ]
    }
  },
  {
    id: "sample-ifood",
    title: "🍔 Print iFood / PedidosYa (Brasil/Argentina - BRL)",
    lang: "pt" as Language,
    previewUrl: "https://images.unsplash.com/photo-1526367790999-0150786686a2?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "PedidosYa / Hamburgueria Gourmet",
      amount: 142.50,
      currency: "BRL" as Currency,
      category: "Alimentação & Supermercado",
      categoryEs: "Alimentación y Supermercado",
      languageDetected: "pt" as Language,
      rawText: "Pedido Realizado com Sucesso no iFood/PedidosYa. 2x Burger Artesanal + Batata + Refrigerante. TOTAL: R$ 142,50.",
      confidenceScore: 0.96,
      items: [
        { name: "Combo Burger duplo", price: 110.00 },
        { name: "Entrega Expressa", price: 32.50 }
      ]
    }
  },
  {
    id: "sample-ypf",
    title: "⛽ Nafta YPF / Shell (Argentina - ARS)",
    lang: "es" as Language,
    previewUrl: "https://images.unsplash.com/photo-1527018601619-a508a2be00d6?w=500&auto=format&fit=crop&q=60",
    mockResult: {
      date: new Date().toISOString().split('T')[0],
      merchant: "Estación de Servicio YPF Palermo",
      amount: 36800,
      currency: "ARS" as Currency,
      category: "Transporte & Veículo",
      categoryEs: "Transporte y Vehículo",
      languageDetected: "es" as Language,
      rawText: "YPF S.A. Nafta Infinia 32.5 Litros. Pago con App YPF. TOTAL: $ 36.800 ARS.",
      confidenceScore: 0.97,
      items: [
        { name: "Infinia Nafta 32.5L", price: 36800 }
      ]
    }
  }
];

export async function processReceiptImage(
  fileOrBase64: File | string
): Promise<ScannedReceiptResult> {
  await new Promise(resolve => setTimeout(resolve, 1200));

  let isSpanish = false;
  let filename = "";

  if (typeof fileOrBase64 !== "string") {
    filename = fileOrBase64.name.toLowerCase();
  } else {
    filename = fileOrBase64.toLowerCase();
  }

  if (filename.includes("factura") || filename.includes("coto") || filename.includes("pedidosya") || filename.includes("ypf") || filename.includes("ars")) {
    isSpanish = true;
  }

  if (filename.includes("coto")) return SAMPLE_RECEIPTS[0].mockResult;
  if (filename.includes("colegio") || filename.includes("escola")) return SAMPLE_RECEIPTS[1].mockResult;
  if (filename.includes("ypf") || filename.includes("postocombustivel")) return SAMPLE_RECEIPTS[3].mockResult;

  const isARS = isSpanish || Math.random() > 0.4;
  return {
    date: new Date().toISOString().split('T')[0],
    merchant: isSpanish ? "Carrefour Argentina / Mercado Pago" : "Farmácia Droga Raia / iFood",
    amount: isARS ? 24500 : 189.90,
    currency: isARS ? "ARS" : "BRL",
    category: isSpanish ? "Alimentação & Supermercado" : "Saúde & Bem-Estar",
    categoryEs: isSpanish ? "Alimentación y Supermercado" : "Salud y Bienestar",
    languageDetected: isSpanish ? "es" : "pt",
    rawText: `Comprovante analisado por IA. OCR detectou valor e itens no documento ${filename}.`,
    confidenceScore: 0.95,
    items: [
      { name: "Item principal detectado", price: isARS ? 24500 : 189.90 }
    ]
  };
}
