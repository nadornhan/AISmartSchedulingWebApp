'use client';

import { useEffect, useState, type FormEvent } from 'react';
import type { Folder } from '../../lib/folders';

const colors = [
  '#35E3B5',
  '#4E8EFF',
  '#9767F4',
  '#F04C55',
  '#FFC229',
  '#F5A019',
];

type EditFolderModalProps = {
  folder: Folder | null;
  isSaving: boolean;
  error?: string | null;
  onClose: () => void;
  onSave: (folder: Folder, values: { name: string; color: string }) => void;
};

export function EditFolderModal({
  folder,
  isSaving,
  error,
  onClose,
  onSave,
}: EditFolderModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(colors[0]);

  useEffect(() => {
    if (folder) {
      setName(folder.name);
      setColor(folder.color);
    }
  }, [folder]);

  if (!folder) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim()) onSave(folder!, { name: name.trim(), color });
  }

  return (
    <div className="fixed inset-0 z-[300] grid place-items-center bg-[#01070d]/80 p-4 backdrop-blur-sm" role="presentation">
      <form className="w-full max-w-lg rounded-2xl border border-dashboard-accent/25 bg-[#07141e] p-7 shadow-panel" onSubmit={submit}>
        <div className="flex items-start">
          <div className="flex-1"><h2 className="text-2xl font-semibold">Edit Folder</h2><p className="mt-1 text-sm text-dashboard-muted">Update the folder name and color.</p></div>
          <button aria-label="Close edit folder" className="text-2xl text-dashboard-muted" disabled={isSaving} onClick={onClose} type="button">×</button>
        </div>
        <label className="mt-7 block text-sm font-medium" htmlFor="edit-folder-name">Folder Name</label>
        <input className="mt-3 h-12 w-full rounded-lg border border-dashboard-border-strong bg-dashboard-bg/35 px-4 outline-none focus:border-dashboard-accent" disabled={isSaving} id="edit-folder-name" maxLength={100} onChange={(event) => setName(event.target.value)} value={name} />
        <fieldset className="mt-6"><legend className="text-sm font-medium">Folder Color</legend><div className="mt-4 flex gap-4">{colors.map((option) => <button aria-label={`Select ${option}`} aria-pressed={option === color} className={`h-9 w-9 rounded-full ${option === color ? 'ring-2 ring-dashboard-accent ring-offset-4 ring-offset-[#07141e]' : ''}`} key={option} onClick={() => setColor(option)} style={{ backgroundColor: option }} type="button" />)}</div></fieldset>
        {error ? <p className="mt-5 text-sm text-dashboard-danger">{error}</p> : null}
        <div className="mt-7 flex justify-end gap-3 border-t border-dashboard-border pt-6"><button className="h-11 rounded-lg border border-dashboard-border-strong px-5" disabled={isSaving} onClick={onClose} type="button">Cancel</button><button className="h-11 rounded-lg bg-dashboard-accent px-5 font-semibold text-dashboard-bg disabled:opacity-50" disabled={!name.trim() || isSaving} type="submit">{isSaving ? 'Saving…' : 'Save Changes'}</button></div>
      </form>
    </div>
  );
}
