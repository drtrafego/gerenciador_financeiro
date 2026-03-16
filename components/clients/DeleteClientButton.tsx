'use client';

import { Trash2 } from 'lucide-react';

export default function DeleteClientButton({
  action,
}: {
  action: (formData: FormData) => Promise<void>;
}) {
  return (
    <form action={action}>
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
  );
}
