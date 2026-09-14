'use client';

import React, { useState } from 'react';
import { DICTIONARY } from '@/lib/i18n/dict';
import { SAMPLE_RECEIPTS, processReceiptImage, ScannedReceiptResult } from '@/lib/ai/receiptScanner';
import { useProfile } from '@/lib/contexts/ProfileContext';
import { 
  Sparkles, 
  UploadCloud, 
  CheckCircle2, 
  Loader2, 
  Baby, 
  Building2, 
  Calendar, 
  DollarSign, 
  Tag,
  ArrowRight,
  Languages
} from 'lucide-react';

export default function ScanPage() {
  const { lang } = useProfile();
  const dict = DICTIONARY[lang];

  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ScannedReceiptResult | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Form State
  const [date, setDate] = useState('');
  const [merchant, setMerchant] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [scanCurrency, setScanCurrency] = useState<'ARS' | 'BRL' | 'USD'>('ARS');
  const [category, setCategory] = useState('');
  const [childTag, setChildTag] = useState('');
  const [languageDetected, setLanguageDetected] = useState<'pt' | 'es'>('es');

  const handleSelectSample = async (sample: typeof SAMPLE_RECEIPTS[0]) => {
    setAnalyzing(true);
    setResult(null);
    setSavedSuccess(false);

    setTimeout(() => {
      const res = sample.mockResult;
      setResult(res);
      setDate(res.date);
      setMerchant(res.merchant);
      setAmount(res.amount);
      setScanCurrency(res.currency);
      setCategory(lang === 'pt' ? res.category : res.categoryEs);
      setChildTag(res.childTag || '');
      setLanguageDetected(res.languageDetected);
      setAnalyzing(false);
    }, 1000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setAnalyzing(true);
    setResult(null);
    setSavedSuccess(false);

    const res = await processReceiptImage(files[0]);
    setResult(res);
    setDate(res.date);
    setMerchant(res.merchant);
    setAmount(res.amount);
    setScanCurrency(res.currency);
    setCategory(lang === 'pt' ? res.category : res.categoryEs);
    setChildTag(res.childTag || '');
    setLanguageDetected(res.languageDetected);
    setAnalyzing(false);
  };

  const handleSaveTransaction = () => {
    setSavedSuccess(true);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div className="space-y-1">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-indigo-400 animate-pulse" />
          {dict.scan.title}
        </h2>
        <p className="text-sm text-zinc-400">
          {dict.scan.subtitle}
        </p>
      </div>

      {/* Upload Zone */}
      <div className="p-8 rounded-2xl border-2 border-dashed border-zinc-800 hover:border-indigo-500/50 transition-all text-center space-y-4 relative bg-zinc-900/50">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
          <UploadCloud className="w-8 h-8" />
        </div>
        <div>
          <p className="text-base font-semibold text-white">
            {dict.scan.dragDropTitle}
          </p>
          <p className="text-xs text-zinc-400 mt-1">
            {dict.scan.supportedFormats}
          </p>
        </div>
      </div>

      {/* Preset Samples */}
      <div className="space-y-3">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          {dict.scan.sampleReceiptsTitle}
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
                  {sample.mockResult.merchant} — {sample.mockResult.currency} {sample.mockResult.amount.toLocaleString()}
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
          <p className="text-sm font-semibold text-indigo-300">{dict.scan.analyzing}</p>
          <p className="text-xs text-zinc-400">{dict.scan.detectingFields}</p>
        </div>
      )}

      {/* Extracted Form Result */}
      {result && !analyzing && (
        <div className="p-6 rounded-2xl border border-indigo-500/30 space-y-6 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <CheckCircle2 className="w-5 h-5" />
              <span>{dict.scan.successTitle}</span>
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
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-white focus:border-indigo-500 outline-none"
              />
            </div>

            <div className="space-y-1 sm:col-span-2">
              <label className="text-xs font-semibold text-pink-400 flex items-center gap-1.5">
                <Baby className="w-3.5 h-3.5 text-pink-400" />
                {dict.scan.childTag}
              </label>
              <div className="flex gap-3">
                {["", "Matheus", "Sofia"].map((child) => (
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
                    {child ? `👶 ${child}` : 'Não vincular'}
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
              <div className="w-full p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-bold text-center text-sm flex items-center justify-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Transação salva com sucesso no modo Pessoal (PF)!
              </div>
            ) : (
              <button
                onClick={handleSaveTransaction}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{dict.scan.saveTransaction}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
