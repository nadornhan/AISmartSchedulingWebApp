'use client';

import { useEffect, useRef, useState } from 'react';

import { renameForest } from '../../lib/gamification';

type EditableForestNameProps = {
  name: string;
  onRenamed?: (nextName: string) => void;
  className?: string;
};

const MAX_LENGTH = 48;
const DEFAULT_NAME = 'Your Personal Forest';

export function EditableForestName({
  name,
  onRenamed,
  className,
}: EditableForestNameProps) {
  const displayName = name?.trim() || DEFAULT_NAME;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(displayName);
  }, [displayName]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const cleaned = draft.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setError('Forest name cannot be empty');
      setDraft(displayName);
      setEditing(false);
      return;
    }
    if (cleaned === displayName) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await renameForest(cleaned.slice(0, MAX_LENGTH));
      const next = updated.forest_name || cleaned;
      onRenamed?.(next);
      setDraft(next);
      setEditing(false);
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : 'Unable to rename forest',
      );
      setDraft(displayName);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(displayName);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={className}>
        <input
          aria-label="Forest name"
          className="w-full max-w-xl rounded-lg border border-dashboard-accent/50 bg-dashboard-bg/70 px-3 py-2 text-3xl font-semibold text-dashboard-text outline-none ring-dashboard-accent/30 focus:ring-2"
          disabled={saving}
          maxLength={MAX_LENGTH}
          onBlur={() => {
            void save();
          }}
          onChange={(event) => setDraft(event.target.value.slice(0, MAX_LENGTH))}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              void save();
            }
            if (event.key === 'Escape') {
              event.preventDefault();
              cancel();
            }
          }}
          ref={inputRef}
          value={draft}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-3xl font-semibold text-dashboard-text">{displayName}</h1>
        <button
          className="rounded-lg border border-dashboard-border bg-dashboard-bg/50 px-2.5 py-1 text-xs font-medium text-dashboard-text transition hover:border-dashboard-accent/50"
          onClick={() => setEditing(true)}
          type="button"
        >
          Rename
        </button>
      </div>
      {error ? <p className="mt-1 text-xs text-[var(--red-light)]">{error}</p> : null}
    </div>
  );
}
