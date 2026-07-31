'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createFolder, type Folder } from '../../lib/folders';
import { FolderIcon, PlusIcon } from '../layout/icons';

const folderColors = [
  '#35E3B5',
  '#4E8EFF',
  '#9767F4',
  '#F04C55',
  '#FFC229',
  '#F5A019',
];

type CreateFolderModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (folder: Folder) => void;
};

export function CreateFolderModal({
  isOpen,
  onClose,
  onCreated,
}: CreateFolderModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(folderColors[0]);
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) onClose();
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  function resetAndClose() {
    if (isSubmitting) return;
    setName('');
    setColor(folderColors[0]);
    setDescription('');
    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const folderName = name.trim();

    if (!folderName) {
      setError('Folder name is required.');
      return;
    }

    const accessToken = window.localStorage.getItem('access_token');
    if (!accessToken) {
      setError('Please sign in before creating a folder.');
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const folder = await createFolder(
        { name: folderName, color },
        { accessToken },
      );
      onCreated?.(folder);
      setName('');
      setColor(folderColors[0]);
      setDescription('');
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to create folder. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-labelledby="create-folder-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-[#01070d]/80 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) resetAndClose();
      }}
      role="dialog"
    >
      <form
        className="w-full max-w-[570px] rounded-2xl border border-dashboard-accent/25 bg-[#07141e] p-7 text-dashboard-text shadow-[0_30px_100px_rgba(0,0,0,0.65),0_0_50px_rgba(34,240,177,0.08)] sm:p-8"
        onSubmit={handleSubmit}
      >
        <header className="flex items-start gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-dashboard-accent-soft text-dashboard-accent">
            <FolderIcon className="h-8 w-8" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-semibold" id="create-folder-title">
              Create New Folder
            </h2>
            <p className="mt-1 text-sm text-dashboard-muted">
              Organize your tasks into a project folder.
            </p>
          </div>
          <button
            aria-label="Close create folder dialog"
            className="grid h-9 w-9 place-items-center rounded-lg text-2xl text-dashboard-muted transition hover:bg-dashboard-raised hover:text-dashboard-text"
            disabled={isSubmitting}
            onClick={resetAndClose}
            type="button"
          >
            ×
          </button>
        </header>

        <label className="mt-7 block text-sm font-medium" htmlFor="folder-name">
          Folder Name
        </label>
        <input
          autoFocus
          className="mt-3 h-12 w-full rounded-lg border border-dashboard-border-strong bg-dashboard-bg/35 px-4 outline-none transition placeholder:text-dashboard-subtle focus:border-dashboard-accent"
          disabled={isSubmitting}
          id="folder-name"
          maxLength={100}
          onChange={(event) => {
            setName(event.target.value);
            if (error) setError(null);
          }}
          placeholder="e.g. Design Sprint"
          value={name}
        />

        <fieldset className="mt-7">
          <legend className="text-sm font-medium">Folder Color</legend>
          <div className="mt-4 flex flex-wrap items-center gap-5">
            {folderColors.map((option) => {
              const selected = option === color;
              return (
                <button
                  aria-label={`Select folder color ${option}`}
                  aria-pressed={selected}
                  className={`grid h-10 w-10 place-items-center rounded-full text-white transition hover:scale-105 ${selected ? 'ring-2 ring-dashboard-accent ring-offset-4 ring-offset-[#07141e]' : ''}`}
                  disabled={isSubmitting}
                  key={option}
                  onClick={() => setColor(option)}
                  style={{ backgroundColor: option }}
                  type="button"
                >
                  {selected ? '✓' : null}
                </button>
              );
            })}
            <button
              aria-label="Add a custom folder color"
              className="grid h-10 w-10 place-items-center rounded-full border border-dashed border-dashboard-muted text-xl text-dashboard-muted transition hover:border-dashboard-accent hover:text-dashboard-accent"
              disabled
              title="Custom colors are not available yet"
              type="button"
            >
              +
            </button>
          </div>
        </fieldset>

        <label className="mt-7 block text-sm font-medium" htmlFor="folder-description">
          Description <span className="text-dashboard-muted">(optional)</span>
        </label>
        <textarea
          className="mt-3 min-h-28 w-full resize-none rounded-lg border border-dashboard-border-strong bg-dashboard-bg/35 p-4 outline-none transition placeholder:text-dashboard-subtle focus:border-dashboard-accent"
          disabled={isSubmitting}
          id="folder-description"
          maxLength={500}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Add a short description to help you understand what this folder is for..."
          value={description}
        />
        <p className="mt-3 text-xs text-dashboard-muted">
          <span className="mr-2 text-dashboard-accent">✧</span>
          Descriptions help you and your team stay aligned.
        </p>

        {error ? (
          <p className="mt-4 rounded-lg border border-dashboard-danger/30 bg-dashboard-danger/10 px-4 py-3 text-sm text-dashboard-danger">
            {error}
          </p>
        ) : null}

        <footer className="mt-6 flex justify-end gap-3 border-t border-dashboard-border pt-6">
          <button
            className="h-11 rounded-lg border border-dashboard-border-strong px-5 font-medium transition hover:bg-dashboard-raised"
            disabled={isSubmitting}
            onClick={resetAndClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className="flex h-11 items-center gap-2 rounded-lg bg-gradient-to-r from-dashboard-accent-strong to-dashboard-accent px-5 font-semibold text-white shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!name.trim() || isSubmitting}
            type="submit"
          >
            <PlusIcon className="h-5 w-5" />
            {isSubmitting ? 'Creating...' : 'Create Folder'}
          </button>
        </footer>
      </form>
    </div>
  );
}
