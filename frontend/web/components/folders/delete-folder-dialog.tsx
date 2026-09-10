'use client';

import type { Folder } from '../../lib/folders';

type DeleteFolderDialogProps = {
  folder: Folder | null;
  isDeleting: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (folder: Folder) => void;
};

export function DeleteFolderDialog({ folder, isDeleting, error, onCancel, onConfirm }: DeleteFolderDialogProps) {
  if (!folder) return null;

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-[#01070d]/80 p-4 backdrop-blur-sm">
      <div aria-labelledby="delete-folder-title" aria-modal="true" className="w-full max-w-md rounded-2xl border border-dashboard-danger/30 bg-[#07141e] p-7 shadow-panel" role="alertdialog">
        <h2 className="text-xl font-semibold" id="delete-folder-title">Delete “{folder.name}”?</h2>
        <p className="mt-3 text-sm leading-6 text-dashboard-muted">The folder will be removed. Its tasks should move back to Inbox when the backend supports this rule.</p>
        {error ? <p className="mt-4 text-sm text-dashboard-danger">{error}</p> : null}
        <div className="mt-7 flex justify-end gap-3"><button className="h-11 rounded-lg border border-dashboard-border-strong px-5" disabled={isDeleting} onClick={onCancel} type="button">Cancel</button><button className="h-11 rounded-lg bg-dashboard-danger px-5 font-semibold text-white disabled:opacity-50" disabled={isDeleting} onClick={() => onConfirm(folder)} type="button">{isDeleting ? 'Deleting…' : 'Delete Folder'}</button></div>
      </div>
    </div>
  );
}
