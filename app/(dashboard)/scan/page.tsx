'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DICTIONARY } from '@/lib/i18n/dict';
import { SAMPLE_RECEIPTS, processReceiptImage, ScannedReceiptResult, ExtractedTransactionItem } from '@/lib/ai/receiptScanner';
import { parseSpreadsheetFile } from '@/lib/ai/spreadsheetParser';
import { useProfile } from '@/lib/contexts/ProfileContext';
import { 
  Sparkles, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  Baby, 
  User,
  Building2, 
  Calendar, 
  DollarSign, 
  Tag,
  ArrowRight,
  Languages,
  ListChecks,
  Plus,
  Trash2,
  ArrowLeft,
  FileSpreadsheet
} from 'lucide-react';

const STANDARD_CATEGORIES = [
  "Alimentação & Supermercado",
  "Filhos & Família",
  "Saúde & Bem-Estar",
  "Transporte & Veículo",
  "Moradia & Serviços",
  "Lazer & Entretenimento",
  "Educação & Cursos",
  "Cartão de Crédito",
  "Compras & Vestuário",
  "Serviços & Assinaturas",
  "Outros / Diversos"
];

export default function ScanPage() {
  const router = useRouter();
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScannedReceiptResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  const [isDragging, setIsDragging] = useState(false);

  const [childrenList, setChildrenList] = useState<string[]>([]);
  const [parentsList, setParentsList] = useState<string[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>(STANDARD_CATEGORIES);

  // Single Form State
  const [date, setDate] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [scanCurrency, setScanCurrency] = useState<'ARS' | 'BRL' | 'USD'>('ARS');
  const [category, setCategory] = useState('');
  const [childTag, setChildTag] = useState('');
  const [languageDetected, setLanguageDetected] = useState<'pt' | 'es'>('pt');

  // Multi-Transaction Statement State
  const [extractedTransactions, setExtractedTransactions] = useState<ExtractedTransactionItem[]>([]);

  useEffect(() => {
    const loadChildrenAndCategories = () => {
      const storedParents = localStorage.getItem("user_personal_parents");
      if (storedParents) {
        try {
          const parsed = JSON.parse(storedParents);
          if (Array.isArray(parsed)) {
            setParentsList(parsed);
          }
        } catch (e) {}
      }

      const storedChildren = localStorage.getItem("user_personal_children");
      if (storedChildren) {
        try {
          setChildrenList(JSON.parse(storedChildren));
        } catch (e) {}
      }

      const storedCats = localStorage.getItem("user_personal_categories");
      if (storedCats) {
        try {
          const parsed = JSON.parse(storedCats);
          if (Array.isArray(parsed)) {
            const names = parsed.map((c: any) => c.namePt || c.name || c).filter(Boolean);
            const combined = Array.from(new Set([...STANDARD_CATEGORIES, ...names]));
            setAvailableCategories(combined);
          }
        } catch (e) {}
      }
    };
    loadChildrenAndCategories();
  }, []);

  // Suporte a colar arquivos do Clipboard (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1 || items[i].type.indexOf('pdf') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            await processFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, []);

  const processFile = async (file: File) => {
    setAnalyzing(true);
    setResult(null);
    setSavedSuccess(false);

    const fileNameLower = file.name.toLowerCase();
    const isSpreadsheet = 
      fileNameLower.endsWith('.csv') || 
      fileNameLower.endsWith('.xlsx') || 
      fileNameLower.endsWith('.xls') || 
      fileNameLower.endsWith('.tsv') || 
      fileNameLower.endsWith('.txt') ||
      file.type.includes('csv') || 
      file.type.includes('sheet') || 
      file.type.includes('excel');

    if (isSpreadsheet) {
      try {
        const sheetTransactions = await parseSpreadsheetFile(file);
        if (sheetTransactions.length === 0) {
          alert("Nenhuma transação encontrada no arquivo de planilha. Verifique as colunas (Data, Descrição, Valor).");
          setAnalyzing(false);
          return;
        }

        const totalAmt = sheetTransactions.reduce((acc, t) => acc + t.amount, 0);
        const res: ScannedReceiptResult = {
          date: new Date().toISOString().split('T')[0],
          merchant: `Planilha: ${file.name}`,
          amount: totalAmt,
          currency: sheetTransactions[0]?.currency || 'ARS',
          category: 'Geral & Diversos',
          categoryEs: 'General y Diversos',
          confidenceScore: 0.99,
          languageDetected: 'pt',
          rawText: `Planilha processada: ${file.name} com ${sheetTransactions.length} linhas de lançamentos.`,
          isMultiTransaction: true,
          transactions: sheetTransactions.map(t => ({ ...t, selected: true }))
        };
        applyResultData(res);
      } catch (e) {
        alert("Erro ao ler o arquivo de planilha CSV/Excel. Verifique a formatação do arquivo.");
      }
    } else {
      const res = await processReceiptImage(file);
      applyResultData(res);
    }

    setAnalyzing(false);
  };

  const handleSelectSample = async (sample: typeof SAMPLE_RECEIPTS[0]) => {
    setAnalyzing(true);
    setResult(null);
    setSavedSuccess(false);

    setTimeout(() => {
      const res = sample.mockResult;
      applyResultData(res);
      setAnalyzing(false);
    }, 1000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    await processFile(files[0]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const applyResultData = (res: ScannedReceiptResult) => {
    const today = new Date().toISOString().split('T')[0];
    const validDate = res.date && res.date.length === 10 ? res.date : today;

    setResult(res);
    setDate(validDate);
    setMerchant(res.merchant || 'Lançamento Escaneado');
    setAmount(res.amount || 0);
    setScanCurrency(res.currency || 'ARS');
    setCategory(lang === 'pt' ? res.category : (res.categoryEs || res.category));
    setChildTag(res.childTag || '');
    setLanguageDetected(res.languageDetected || 'pt');

    if (res.isMultiTransaction && res.transactions) {
      setExtractedTransactions(res.transactions.map(t => ({
        ...t,
        date: t.date && t.date.length === 10 ? t.date : today,
        selected: true
      })));
    } else {
      setExtractedTransactions([]);
    }
  };

  // Atualiza um item individual na lista de extrato
  const handleUpdateExtractedItem = (id: string, field: keyof ExtractedTransactionItem, value: any) => {
    setExtractedTransactions(prev =>
      prev.map(item => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleToggleSelectItem = (id: string) => {
    setExtractedTransactions(prev =>
      prev.map(item => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleAddExtractedTransaction = () => {
    const today = new Date().toISOString().split('T')[0];
    const newTx: ExtractedTransactionItem = {
      id: `tx-custom-add-${Date.now()}`,
      date: today,
      merchant: 'Novo Gasto no Extrato',
      amount: 0,
      currency: 'ARS',
      category: availableCategories[0] || 'Alimentação & Supermercado',
      childTag: '',
      selected: true
    };
    setExtractedTransactions(prev => [...prev, newTx]);
  };

  const handleDeleteExtractedTransaction = (id: string) => {
    setExtractedTransactions(prev => prev.filter(t => t.id !== id));
  };

  // Salva transação única no localStorage e sincroniza
  const handleSaveSingleTransaction = () => {
    const today = new Date().toISOString().split('T')[0];
    const newTx = {
      id: `tx-pf-scan-${Date.now()}`,
      date: date || today,
      merchant: merchant || 'Lançamento via Scanner',
      description: 'Lançamento importado via Scanner IA',
      amount: Number(amount) || 0,
      currency: scanCurrency || 'ARS',
      type: 'expense' as const,
      category: category || 'Alimentação & Supermercado',
      childTag: childTag || undefined,
      language: lang
    };

    const stored = localStorage.getItem('user_personal_transactions');
    let txs = [];
    if (stored) {
      try { txs = JSON.parse(stored); } catch (e) {}
    }

    const deduplicateTransactions = (list: any[]) => {
      const seen = new Set<string>();
      const clean: any[] = [];
      for (const tx of list) {
        const normMerchant = (tx.merchant || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const key = `${tx.date}_${normMerchant}_${Number(tx.amount).toFixed(2)}_${tx.type || 'expense'}`;
        if (!seen.has(key)) {
          seen.add(key);
          clean.push(tx);
        }
      }
      return clean;
    };

    const updated = deduplicateTransactions([newTx, ...txs]);
    localStorage.setItem('user_personal_transactions', JSON.stringify(updated));
    
    // Dispara eventos globais para atualização instantânea
    window.dispatchEvent(new Event('user_pf_data_changed'));
    window.dispatchEvent(new Event('storage'));

    setSavedCount(1);
    setSavedSuccess(true);

    // Redireciona automaticamente após 1.5s
    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  };

  // Salva MÚLTIPLAS transações de um extrato mensal no localStorage e sincroniza
  const handleSaveMultiTransactions = () => {
    const selectedItems = extractedTransactions.filter(t => t.selected);
    if (selectedItems.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const newTxs = selectedItems.map((item, index) => ({
      id: `tx-pf-extrato-${Date.now()}-${index}`,
      date: item.date || today,
      merchant: item.merchant || 'Lançamento Extrato Bancário',
      description: 'Gasto importado via Extrato Bancário Mensal IA',
      amount: Number(item.amount) || 0,
      currency: item.currency || 'ARS',
      type: 'expense' as const,
      category: item.category || 'Alimentação & Supermercado',
      childTag: item.childTag || undefined,
      language: lang
    }));

    const stored = localStorage.getItem('user_personal_transactions');
    let txs = [];
    if (stored) {
      try { txs = JSON.parse(stored); } catch (e) {}
    }

    const deduplicateTransactions = (list: any[]) => {
      const seen = new Set<string>();
      const clean: any[] = [];
      for (const tx of list) {
        const normMerchant = (tx.merchant || '').toLowerCase().trim().replace(/[^a-z0-9]/g, '');
        const key = `${tx.date}_${normMerchant}_${Number(tx.amount).toFixed(2)}_${tx.type || 'expense'}`;
        if (!seen.has(key)) {
          seen.add(key);
          clean.push(tx);
        }
      }
      return clean;
    };

    const updated = deduplicateTransactions([...newTxs, ...txs]);
    localStorage.setItem('user_personal_transactions', JSON.stringify(updated));

    // Dispara eventos globais para atualização instantânea
    window.dispatchEvent(new Event('user_pf_data_changed'));
    window.dispatchEvent(new Event('storage'));

    setSavedCount(selectedItems.length);
    setSavedSuccess(true);

    // Redireciona automaticamente após 1.5s
    setTimeout(() => {
      router.push('/dashboard');
    }, 1500);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
            {dict.scan.title}
          </h2>
          <p className="text-xs text-zinc-400">
            Envie fotos de comprovantes, prints, cole (Ctrl+V), <strong className="text-purple-400 font-semibold">Planilhas Excel/CSV</strong> ou <strong className="text-purple-400 font-semibold">Extratos Bancários Mensais em PDF</strong>. A IA e o leitor automático organizam todos os gastos!
          </p>
        </div>

        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold transition-all self-start sm:self-auto"
        >
          <ArrowLeft size={14} />
          <span>Voltar à Visão Geral</span>
        </Link>
      </div>

      {/* Upload Zone Interativa com Drag & Drop e Paste */}
      <div 
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`p-8 rounded-2xl border-2 border-dashed transition-all text-center space-y-4 relative ${
          isDragging 
            ? 'border-purple-500 bg-purple-500/15 scale-[1.01] shadow-2xl shadow-purple-500/20' 
            : 'border-zinc-800 hover:border-purple-500/50 bg-zinc-900/50'
        }`}
      >
        <input
          type="file"
          accept="image/*,application/pdf,.csv,.xlsx,.xls,.tsv,.txt"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto transition-all ${
          isDragging 
            ? 'bg-purple-500/30 border-purple-400 text-purple-300 scale-110 animate-bounce' 
            : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
        }`}>
          <UploadCloud className="w-8 h-8" />
        </div>
        <div>
          <p className="text-base font-bold text-white">
            {isDragging ? 'Solte o arquivo da planilha ou comprovante aqui!' : dict.scan.dragDropTitle}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {isDragging 
              ? 'O sistema irá processar e extrair todas as linhas de lançamentos instantaneamente' 
              : 'Arraste e solte seu arquivo aqui, clique para selecionar ou cole com Ctrl+V (Fotos, PDFs, e Planilhas CSV / Excel)'}
          </p>
        </div>
      </div>

      {/* Preset Samples */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Ou testar com comprovantes & extratos de exemplo:
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SAMPLE_RECEIPTS.map((sample) => (
            <button
              key={sample.id}
              onClick={() => handleSelectSample(sample)}
              className="p-4 rounded-xl border border-zinc-800 hover:border-indigo-500/40 text-left flex items-center gap-3 transition-all bg-zinc-900/80 hover:bg-zinc-800/80"
            >
              <div className="w-10 h-10 rounded-lg bg-zinc-800 overflow-hidden flex-shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sample.previewUrl} alt={sample.title} className="w-full h-full object-cover" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-white truncate">{sample.title}</p>
                <p className="text-[11px] text-zinc-400 truncate">
                  {sample.mockResult.merchant}
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-zinc-500" />
            </button>
          ))}
        </div>
      </div>

      {/* Loader */}
      {analyzing && (
        <div className="p-8 rounded-2xl border border-indigo-500/30 text-center space-y-3 bg-indigo-950/20">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
          <p className="text-sm font-semibold text-indigo-300">Lendo e analisando extrato / comprovante com IA...</p>
          <p className="text-xs text-zinc-400">Extraindo estabelecimentos, valores, moedas, datas e categorias.</p>
        </div>
      )}

      {/* Resultado da Análise */}
      {result && !analyzing && (
        <div className="p-6 rounded-2xl border border-indigo-500/30 space-y-6 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>
                {result.isMultiTransaction 
                  ? `Extrato Mensal Lido com Sucesso! (${extractedTransactions.length} gastos encontrados)`
                  : dict.scan.successTitle}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-400 flex items-center gap-1">
                <Languages className="w-3.5 h-3.5 text-indigo-400" />
                Comprovante: <strong className="text-white uppercase">{languageDetected}</strong>
              </span>
              <span className="text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 px-2 py-0.5 rounded-full font-mono">
                {(result.confidenceScore * 100).toFixed(0)}% de precisão IA
              </span>
            </div>
          </div>

          {/* CASO 1: EXTRATO MENSAL / MULTI-TRANSAÇÕES */}
          {result.isMultiTransaction && extractedTransactions.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ListChecks className="w-5 h-5 text-purple-400" />
                  <h3 className="text-sm font-bold text-white">
                    Gastos Extraídos do Extrato Bancário ({extractedTransactions.filter(t => t.selected).length} selecionados)
                  </h3>
                </div>
                <span className="text-xs text-zinc-400 font-mono">
                  Revise e atribua os familiares antes de salvar
                </span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900 text-zinc-400 uppercase font-semibold text-[10px]">
                    <tr>
                      <th className="p-3 text-center">Importar</th>
                      <th className="p-3">Data</th>
                      <th className="p-3">Estabelecimento / Local</th>
                      <th className="p-3">Valor & Moeda</th>
                      <th className="p-3">Categoria</th>
                      <th className="p-3">Vincular Familiar</th>
                      <th className="p-3 text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60">
                    {extractedTransactions.map((tx) => (
                      <tr key={tx.id} className={`hover:bg-zinc-900/40 transition-colors ${!tx.selected ? 'opacity-40' : ''}`}>
                        <td className="p-3 text-center">
                          <input
                            type="checkbox"
                            checked={tx.selected}
                            onChange={() => handleToggleSelectItem(tx.id)}
                            className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="date"
                            value={tx.date}
                            onChange={(e) => handleUpdateExtractedItem(tx.id, 'date', e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:border-purple-500 outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <input
                            type="text"
                            value={tx.merchant}
                            onChange={(e) => handleUpdateExtractedItem(tx.id, 'merchant', e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white font-semibold focus:border-purple-500 outline-none"
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex gap-1 items-center">
                            <input
                              type="number"
                              step="0.01"
                              value={tx.amount}
                              onChange={(e) => handleUpdateExtractedItem(tx.id, 'amount', Number(e.target.value))}
                              className="w-24 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white focus:border-purple-500 outline-none"
                            />
                            <select
                              value={tx.currency}
                              onChange={(e) => handleUpdateExtractedItem(tx.id, 'currency', e.target.value)}
                              className="bg-zinc-900 border border-zinc-800 rounded-lg px-1.5 py-1 text-xs font-bold text-white focus:border-purple-500 outline-none cursor-pointer"
                            >
                              <option value="ARS">$ ARS</option>
                              <option value="BRL">R$ BRL</option>
                              <option value="USD">$ USD</option>
                            </select>
                          </div>
                        </td>
                        <td className="p-3">
                          <select
                            value={tx.category}
                            onChange={(e) => handleUpdateExtractedItem(tx.id, 'category', e.target.value)}
                            className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-white focus:border-purple-500 outline-none cursor-pointer"
                          >
                            {!availableCategories.includes(tx.category) && tx.category && (
                              <option value={tx.category}>{tx.category}</option>
                            )}
                            {availableCategories.map(cat => (
                              <option key={cat} value={cat}>{cat}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            value={tx.childTag || ''}
                            onChange={(e) => handleUpdateExtractedItem(tx.id, 'childTag', e.target.value)}
                            className="bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-xs text-purple-300 font-bold focus:border-purple-500 outline-none cursor-pointer"
                          >
                            <option value="">Geral (Nenhum)</option>
                            {parentsList.map(p => (
                              <option key={p} value={p}>👤 {p}</option>
                            ))}
                            {childrenList.map(c => (
                              <option key={c} value={c}>👶 {c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleDeleteExtractedTransaction(tx.id)}
                            className="p-1 rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Remover este lançamento"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={handleAddExtractedTransaction}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-purple-300 font-bold text-xs transition-colors border border-purple-500/20 cursor-pointer"
                >
                  <Plus size={14} />
                  <span>Adicionar Outro Gasto ao Extrato</span>
                </button>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {extractedTransactions.length} lançamentos no extrato
                </span>
              </div>

              <div className="flex items-center justify-between pt-2">
                {savedSuccess ? (
                  <div className="w-full p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-center text-sm space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Sucesso! Todos os {savedCount} gastos do extrato foram gravados no sistema!</span>
                    </div>
                    <p className="text-xs text-zinc-300">Redirecionando para o Dashboard Pessoal...</p>
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all mt-1"
                    >
                      <span>Ver no Dashboard Pessoal Agora →</span>
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveMultiTransactions}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={18} />
                    <span>Confirmar e Importar {extractedTransactions.filter(t => t.selected).length} Gastos do Extrato ao Mesmo Tempo</span>
                  </button>
                )}
              </div>
            </div>
          ) : (
            /* CASO 2: COMPROVANTE ÚNICO */
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                    {dict.scan.merchant}
                  </label>
                  <input
                    type="text"
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    {dict.scan.date}
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-indigo-400" />
                    {dict.scan.amount} & {dict.scan.currency}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(Number(e.target.value))}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-mono text-white focus:border-indigo-500 outline-none"
                    />
                    <select
                      value={scanCurrency}
                      onChange={(e) => setScanCurrency(e.target.value as any)}
                      className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm font-bold text-white focus:border-indigo-500 outline-none"
                    >
                      <option value="ARS">$ ARS (Argentina)</option>
                      <option value="BRL">R$ BRL (Brasil)</option>
                      <option value="USD">$ USD (Dólar)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-zinc-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" />
                    {dict.scan.category}
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none cursor-pointer"
                  >
                    {!availableCategories.includes(category) && category && (
                      <option value={category}>{category}</option>
                    )}
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <label className="text-xs font-semibold text-purple-400 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-purple-400" />
                    Vincular a Pessoa / Familiar?
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setChildTag('')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        !childTag
                          ? 'bg-purple-500/20 border-purple-500/40 text-purple-300 font-bold'
                          : 'border-zinc-800 text-zinc-400 hover:text-white'
                      }`}
                    >
                      Não vincular
                    </button>

                    {/* Pais */}
                    {parentsList.map((parent) => (
                      <button
                        key={parent}
                        type="button"
                        onClick={() => setChildTag(parent)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          childTag === parent
                            ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300 font-bold'
                            : 'border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        👤 {parent}
                      </button>
                    ))}

                    {/* Filhos */}
                    {childrenList.map((child) => (
                      <button
                        key={child}
                        type="button"
                        onClick={() => setChildTag(child)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          childTag === child
                            ? 'bg-pink-500/20 border-pink-500/40 text-pink-300 font-bold'
                            : 'border-zinc-800 text-zinc-400 hover:text-white'
                        }`}
                      >
                        👶 {child}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 border border-zinc-800 space-y-1">
                <p className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">Texto Lido pela IA:</p>
                <p className="text-xs font-mono text-zinc-300 leading-relaxed">{result.rawText}</p>
              </div>

              <div className="flex items-center justify-between pt-2">
                {savedSuccess ? (
                  <div className="w-full p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-center text-sm space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      <span>Transação salva com sucesso no modo Pessoal (PF)!</span>
                    </div>
                    <p className="text-xs text-zinc-300">Redirecionando para o Dashboard Pessoal...</p>
                    <Link
                      href="/dashboard"
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow transition-all mt-1"
                    >
                      <span>Ver no Dashboard Pessoal Agora →</span>
                    </Link>
                  </div>
                ) : (
                  <button
                    onClick={handleSaveSingleTransaction}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
                  >
                    <span>{dict.scan.saveTransaction}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
