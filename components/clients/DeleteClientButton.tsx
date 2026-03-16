'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export default function DeleteClientButton({
  action,
}: {
  action: (formData: FormData) => Promise<{ error: string } | void>;
}) {
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    const result = await action(formData);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={handleSubmit}>
        <button
          type="submit"
          onClick={(e) => {
            if (!confirm('Excluir este cliente? Esta ação não pode ser desfeita.'))
              e.preventDefault();
          }}
          className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
          Excluir
        </button>
      </form>
      {error && (
        <p className="text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2 max-w-xs text-right">
          ⚠️ {error}
        </p>
      )}
    </div>
  );
}
