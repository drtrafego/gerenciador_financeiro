'use client';

import { useActionState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteContractAction, type DeleteContractState } from '../actions';

export function DeleteContractButton({ contractId }: { contractId: string }) {
  const deleteWithId = deleteContractAction.bind(null, contractId);
  const [state, formAction, isPending] = useActionState<DeleteContractState, FormData>(
    deleteWithId,
    {}
  );

  return (
    <form action={formAction} className="flex flex-col items-end gap-1.5">
      <button
        type="submit"
        disabled={isPending}
        className="flex items-center gap-1.5 rounded-lg border border-red-500/20 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Trash2 className="h-4 w-4" />
        {isPending ? 'Excluindo...' : 'Excluir'}
      </button>
      {state.error && <p className="text-xs text-red-400 max-w-xs text-right">{state.error}</p>}
    </form>
  );
}
