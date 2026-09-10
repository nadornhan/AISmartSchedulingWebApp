'use client';

import { useEffect, useRef, useState } from 'react';

import { renamePlant } from '../../lib/gamification';

type EditablePlantNameProps = {
  plantId: string;
  name: string;
  onRenamed?: (nextName: string) => void;
  className?: string;
};

const MAX_LENGTH = 48;

export function EditablePlantName({
  plantId,
  name,
  onRenamed,
  className,
}: EditablePlantNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setDraft(name);
  }, [name]);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  async function save() {
    const cleaned = draft.trim().replace(/\s+/g, ' ');
    if (!cleaned) {
      setError('Name cannot be empty');
      setDraft(name);
      setEditing(false);
      return;
    }
    if (cleaned === name) {
      setEditing(false);
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const updated = await renamePlant(plantId, cleaned.slice(0, MAX_LENGTH));
      onRenamed?.(updated.display_name);
      setDraft(updated.display_name);
      setEditing(false);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to rename plant');
      setDraft(name);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function cancel() {
    setDraft(name);
    setError(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className={className}>
        <input
          aria-label="Plant name"
          className="w-full rounded-lg border border-dashboard-accent/50 bg-dashboard-bg/70 px-3 py-2 text-lg font-semibold text-dashboard-text outline-none ring-dashboard-accent/30 focus:ring-2"
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
      <div className="flex max-w-full flex-wrap items-center gap-2">
        <button
          className="inline-flex min-w-0 max-w-full items-center rounded-lg px-1 py-0.5 text-left transition hover:bg-dashboard-bg/50"
          onClick={() => setEditing(true)}
          type="button"
        >
          <span className="truncate text-2xl font-semibold tracking-normal text-dashboard-text">
            {name}
          </span>
        </button>
        <button
          className="shrink-0 rounded-lg border border-dashboard-border bg-dashboard-bg/50 px-2.5 py-1 text-xs font-medium text-dashboard-text transition hover:border-dashboard-accent/50"
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
