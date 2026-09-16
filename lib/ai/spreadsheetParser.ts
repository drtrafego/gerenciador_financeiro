export interface ExtractedTransactionItem {
  id: string;
  date: string;
  merchant: string;
  description?: string;
  amount: number;
  currency: 'ARS' | 'BRL' | 'USD';
  type: 'expense' | 'income';
  category: string;
  subcategory?: string;
  childTag?: string;
}

const FOOD_KEYWORDS = [
  'COTO', 'CARREFOUR', 'DISCO', 'JUMBO', 'SUPERMERCADO', 'DIA %', 'VEA', 
  'PEDIDOSYA', 'IFOOD', 'RESTAURANT', 'PANADERIA', 'PIZZA', 'BURGER', 
  'VERDULERIA', 'CARNICERIA', 'ROTISERIA', 'CAFE', 'COFFEE', 'BAKERY',
  'OPEN25', 'HELADERIA', 'RAPIPAGO'
];

const TRANSPORT_KEYWORDS = [
  'UBER', 'EMOVA', 'SUBTE', 'SUBE', 'CABIFY', 'ESTACIONAMIENTO', 'YPF', 'SHELL', 'AXION'
];

export function autoCategorizeMerchant(merchantName: string, desc: string = ''): { category: string; subcategory: string } {
  const text = `${merchantName} ${desc}`.toUpperCase();

  if (text.includes('MISERICORD') || text.includes('HIJAS DE') || text.includes('COLEGIO')) {
    return { category: 'Filhos & Família', subcategory: 'Escola / Colegiatura' };
  }

  if (TRANSPORT_KEYWORDS.some(k => text.includes(k))) {
    if (text.includes('UBER') || text.includes('CABIFY')) {
      return { category: 'Transporte & Veículo', subcategory: 'Uber / Cabify' };
    }
    return { category: 'Transporte & Veículo', subcategory: 'Transporte Público (SUBE/Subte)' };
  }

  if (FOOD_KEYWORDS.some(k => text.includes(k))) {
    if (text.includes('PEDIDOSYA') || text.includes('IFOOD')) {
      return { category: 'Alimentação & Supermercado', subcategory: 'Restaurantes & Delivery (iFood/PedidosYa)' };
    }
    return { category: 'Alimentação & Supermercado', subcategory: 'Supermercado (Coto / Carrefour)' };
  }

  if (text.includes('MERCADO LIBRE') || text.includes('MERCADOLIBRE')) {
    return { category: 'Compras & Vestuário', subcategory: 'Compras Gerais (Mercado Livre)' };
  }

  if (text.includes('FARMACITY') || text.includes('FARMACIA') || text.includes('PREPAGA') || text.includes('OSDE')) {
    return { category: 'Saúde & Bem-Estar', subcategory: 'Farmácia (Farmacity)' };
  }

  if (text.includes('NETFLIX') || text.includes('SPOTIFY') || text.includes('CINEMA') || text.includes('SHOW')) {
    return { category: 'Lazer & Entretenimento', subcategory: 'Assinaturas (Netflix/Spotify)' };
  }

  return { category: 'Geral & Diversos', subcategory: 'Lançamentos Históricos' };
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim().replace(/^"|"$/g, ''));
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim().replace(/^"|"$/g, ''));
  return result;
}

function normalizeDate(rawDate: string): string {
  if (!rawDate) return new Date().toISOString().split('T')[0];
  const cleaned = rawDate.replace(/[^\d/.-]/g, '').trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    return cleaned;
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const parts = cleaned.split(/[/.-]/);
  if (parts.length === 3) {
    let day = parts[0].padStart(2, '0');
    let month = parts[1].padStart(2, '0');
    let year = parts[2];

    if (year.length === 2) {
      year = `20${year}`;
    }

    if (parseInt(month) > 12 && parseInt(day) <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }

    if (year.length === 4 && parseInt(month) <= 12 && parseInt(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  return new Date().toISOString().split('T')[0];
}

function parseAmount(rawAmount: string): { amount: number; isIncome: boolean } {
  if (!rawAmount) return { amount: 0, isIncome: false };
  let str = rawAmount.trim();

  const isNegative = str.includes('-') || str.startsWith('(') || str.toLowerCase().includes('débito') || str.toLowerCase().includes('debito');

  // Clean non-numeric characters except comma and dot
  str = str.replace(/[^\d.,]/g, '');

  if (str.includes(',') && str.includes('.')) {
    if (str.indexOf('.') < str.indexOf(',')) {
      // 1.234,56
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 1,234.56
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // 1234,56
    str = str.replace(',', '.');
  }

  const parsed = Math.abs(parseFloat(str) || 0);
  return { amount: parsed, isIncome: !isNegative && rawAmount.toLowerCase().includes('crédito') };
}

export async function parseSpreadsheetFile(file: File, defaultCurrency: 'ARS' | 'BRL' | 'USD' = 'ARS'): Promise<ExtractedTransactionItem[]> {
  const text = await file.text();
  const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);

  if (lines.length === 0) return [];

  // Determine delimiter (;, ,, \t, |)
  const sampleLine = lines[0];
  let delimiter = ',';
  if ((sampleLine.match(/;/g) || []).length > (sampleLine.match(/,/g) || []).length) {
    delimiter = ';';
  } else if (sampleLine.includes('\t')) {
    delimiter = '\t';
  } else if (sampleLine.includes('|')) {
    delimiter = '|';
  }

  let dateIdx = -1;
  let merchantIdx = -1;
  let amountIdx = -1;
  let currencyIdx = -1;
  let categoryIdx = -1;
  let startRow = 0;

  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const columns = parseCSVLine(lines[i], delimiter).map(c => c.toLowerCase());
    
    for (let c = 0; c < columns.length; c++) {
      const col = columns[c];
      if (['date', 'data', 'fecha', 'dia'].some(k => col.includes(k)) && dateIdx === -1) {
        dateIdx = c;
      }
      if (['merchant', 'description', 'descrição', 'descricao', 'estabelecimento', 'historico', 'histórico', 'concepto', 'detalhes'].some(k => col.includes(k)) && merchantIdx === -1) {
        merchantIdx = c;
      }
      if (['amount', 'valor', 'monto', 'importe', 'saldo'].some(k => col.includes(k)) && amountIdx === -1) {
        amountIdx = c;
      }
      if (['currency', 'moeda', 'moneda'].some(k => col.includes(k)) && currencyIdx === -1) {
        currencyIdx = c;
      }
      if (['category', 'categoria', 'rubro'].some(k => col.includes(k)) && categoryIdx === -1) {
        categoryIdx = c;
      }
    }

    if (dateIdx !== -1 || merchantIdx !== -1 || amountIdx !== -1) {
      startRow = i + 1;
      break;
    }
  }

  // Fallback index positioning if header wasn't found
  if (dateIdx === -1) dateIdx = 0;
  if (merchantIdx === -1) merchantIdx = 1;
  if (amountIdx === -1) amountIdx = 2;

  const results: ExtractedTransactionItem[] = [];

  for (let i = startRow; i < lines.length; i++) {
    const columns = parseCSVLine(lines[i], delimiter);
    if (columns.length <= Math.max(dateIdx, merchantIdx, amountIdx)) continue;

    const rawDate = columns[dateIdx] || '';
    const rawMerchant = columns[merchantIdx] || 'Lançamento Planilha';
    const rawAmount = columns[amountIdx] || '0';
    const rawCurrency = currencyIdx !== -1 ? (columns[currencyIdx] || '').toUpperCase() : defaultCurrency;
    const rawCategory = categoryIdx !== -1 ? columns[categoryIdx] : '';

    const formattedDate = normalizeDate(rawDate);
    const { amount, isIncome } = parseAmount(rawAmount);

    if (amount === 0 && !rawMerchant) continue;

    let currency: 'ARS' | 'BRL' | 'USD' = defaultCurrency;
    if (rawCurrency.includes('USD') || rawCurrency.includes('DOL') || rawCurrency.includes('$')) {
      currency = 'USD';
    } else if (rawCurrency.includes('BRL') || rawCurrency.includes('R$') || rawCurrency.includes('REAL')) {
      currency = 'BRL';
    } else if (rawCurrency.includes('ARS') || rawCurrency.includes('PESO')) {
      currency = 'ARS';
    }

    const catInfo = rawCategory 
      ? { category: rawCategory, subcategory: 'Planilha Importada' } 
      : autoCategorizeMerchant(rawMerchant);

    results.push({
      id: `tx-sheet-${Date.now()}-${i}`,
      date: formattedDate,
      merchant: rawMerchant,
      description: `Planilha Importada - Linha ${i + 1}`,
      amount,
      currency,
      type: isIncome ? 'income' : 'expense',
      category: catInfo.category,
      subcategory: catInfo.subcategory
    });
  }

  return results;
}
