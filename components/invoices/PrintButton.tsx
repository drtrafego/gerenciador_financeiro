'use client';

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-sm text-gray-400 hover:text-gray-600 underline underline-offset-2 transition-colors cursor-pointer"
    >
      Imprimir / Salvar como PDF
    </button>
  );
}
