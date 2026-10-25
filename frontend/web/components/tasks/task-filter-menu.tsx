'use client';

import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Filter } from 'lucide-react';
import type { Project } from '../../lib/projects';
import {
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  FolderIcon,
  PriorityIcon,
  ResetIcon,
  TasksIcon,
} from '../layout/icons';
import {
  filterOrder,
  priorityClass,
  priorityFilters,
  statusClass,
  type PriorityFilter,
  type TaskFilter,
} from './task-page-model';

export type TaskDueDateRange = { from: string; to: string };
export type TaskListFilters = {
  projectId: string;
  status: TaskFilter;
  priority: PriorityFilter;
  dueDate: TaskDueDateRange;
};

const emptyFilters: TaskListFilters = {
  projectId: '',
  status: 'All',
  priority: 'All',
  dueDate: { from: '', to: '' },
};
const fieldClass = 'h-11 w-full min-w-0 rounded-[var(--radius-sm)] border border-dashboard-border bg-[var(--bg-input)] px-3 text-sm font-medium text-dashboard-text outline-none transition hover:border-dashboard-border-strong focus:border-dashboard-accent focus:ring-2 focus:ring-dashboard-accent/15';

export function TaskFilterMenu({
  projects,
  value,
  onApply,
}: {
  projects: Project[];
  value: TaskListFilters;
  onApply: (filters: TaskListFilters) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const activeCount = [
    Boolean(value.projectId), value.status !== 'All', value.priority !== 'All',
    Boolean(value.dueDate.from || value.dueDate.to),
  ].filter(Boolean).length;
  const active = activeCount > 0;

  function close() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!isOpen) return;
    menuRef.current?.querySelector<HTMLElement>('[data-filter-select-trigger], input')?.focus({ preventScroll: true });
    function dismissOutside(event: PointerEvent | FocusEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setIsOpen(false);
      }
    }
    function dismissOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }
    function dismissOnResize() {
      setIsOpen(false);
    }
    function dismissOnScroll(event: Event) {
      const target = event.target;
      if (!(target instanceof Node) || !menuRef.current?.contains(target)) setIsOpen(false);
    }
    document.addEventListener('pointerdown', dismissOutside);
    document.addEventListener('focusin', dismissOutside);
    document.addEventListener('keydown', dismissOnEscape);
    window.addEventListener('resize', dismissOnResize);
    window.addEventListener('scroll', dismissOnScroll, true);
    return () => {
      document.removeEventListener('pointerdown', dismissOutside);
      document.removeEventListener('focusin', dismissOutside);
      document.removeEventListener('keydown', dismissOnEscape);
      window.removeEventListener('resize', dismissOnResize);
      window.removeEventListener('scroll', dismissOnScroll, true);
    };
  }, [isOpen]);

  return (
    <>
      <button
        aria-controls={isOpen ? id : undefined}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        aria-label={active ? 'Filter tasks (active)' : 'Filter tasks'}
        className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-[var(--radius-sm)] border bg-dashboard-surface transition hover:text-dashboard-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-accent ${active ? 'border-dashboard-accent/60 text-dashboard-accent' : 'border-dashboard-border text-dashboard-muted'}`}
        onClick={() => {
          if (isOpen) {
            close();
            return;
          }
          const rect = triggerRef.current?.getBoundingClientRect();
          if (!rect) return;
          const width = Math.min(384, window.innerWidth - 24);
          const top = rect.bottom + 8;
          setPosition({
            top,
            left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
            width,
            maxHeight: Math.max(120, window.innerHeight - top - 12),
          });
          setIsOpen(true);
        }}
        ref={triggerRef}
        title="Filter tasks"
        type="button"
      >
        <Filter aria-hidden="true" className="h-4 w-4" />
        {active ? (
          <span aria-hidden="true" className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-dashboard-accent" />
        ) : null}
      </button>
      {isOpen && position ? createPortal(
        <div
          aria-label="Task filters"
          className="accent-scrollbar fixed z-[220] overflow-y-auto rounded-[var(--radius-lg)] border border-dashboard-border-strong bg-dashboard-raised p-5 text-dashboard-text shadow-popover"
          id={id}
          ref={menuRef}
          role="dialog"
          style={position}
        >
          <header className="mb-5 flex items-center justify-between gap-3 border-b border-dashboard-border pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-dashboard-accent-soft text-dashboard-accent">
                <Filter aria-hidden="true" className="h-[18px] w-[18px]" />
              </span>
              <h2 className="font-poppins text-lg font-semibold">Filters</h2>
              {activeCount > 0 ? (
                <span className="rounded-full bg-dashboard-accent-soft px-2 py-0.5 text-xs font-medium text-dashboard-accent">
                  {activeCount} active
                </span>
              ) : null}
            </div>
            <button
              aria-label="Close task filters"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-dashboard-muted transition hover:bg-dashboard-surface-hover hover:text-dashboard-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-accent"
              onClick={close}
              type="button"
            >
              <CloseIcon aria-hidden="true" className="h-4 w-4" />
            </button>
          </header>
          <TaskFilterFields
            projects={projects}
            value={value}
            onApply={(filters) => {
              onApply(filters);
              close();
            }}
          />
        </div>,
        document.body,
      ) : null}
    </>
  );
}

type FilterSelectOption = {
  value: string;
  label: string;
  color?: string;
  badgeClass?: string;
};

function FilterSelect({
  label,
  icon,
  value,
  options,
  isOpen,
  onOpenChange,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  value: string;
  options: FilterSelectOption[];
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (value: string) => void;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!isOpen) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>('[aria-selected="true"]')
      ?? listRef.current?.querySelector<HTMLButtonElement>('[role="option"]');
    first?.focus({ preventScroll: true });
    function dismissOutside(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) onOpenChange(false);
    }
    document.addEventListener('pointerdown', dismissOutside);
    return () => document.removeEventListener('pointerdown', dismissOutside);
  }, [isOpen, onOpenChange]);

  return (
    <div
      className="min-w-0 space-y-2"
      onBlur={(event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
          onOpenChange(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && isOpen) {
          event.preventDefault();
          event.stopPropagation();
          onOpenChange(false);
          triggerRef.current?.focus({ preventScroll: true });
        }
      }}
      ref={rootRef}
    >
      <span className="block text-xs font-medium text-dashboard-muted" id={`${id}-label`}>{label}</span>
      <button
        aria-controls={isOpen ? `${id}-options` : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={`${label}: ${selected?.label ?? ''}`}
        className={`${fieldClass} flex items-center gap-3 text-left aria-expanded:border-dashboard-accent/60 aria-expanded:ring-2 aria-expanded:ring-dashboard-accent/10`}
        data-filter-select-trigger=""
        onClick={() => onOpenChange(!isOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            onOpenChange(true);
          }
        }}
        ref={triggerRef}
        type="button"
      >
        <span className="shrink-0 text-dashboard-muted">{icon}</span>
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selected?.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: selected.color }} /> : null}
          <span className={selected?.badgeClass ? `truncate rounded-full border px-2.5 py-0.5 text-xs font-medium ${selected.badgeClass}` : 'truncate'}>
            {selected?.label}
          </span>
        </span>
        <ChevronDownIcon aria-hidden="true" className={`h-4 w-4 shrink-0 text-dashboard-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      {isOpen ? (
        <div
          aria-labelledby={`${id}-label`}
          className="accent-scrollbar max-h-44 space-y-1 overflow-y-auto rounded-xl border border-dashboard-border-strong bg-dashboard-surface p-1.5 shadow-panel"
          id={`${id}-options`}
          onKeyDown={(event) => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]'));
            if (!items.length) return;
            const index = items.indexOf(event.target as HTMLButtonElement);
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1
              : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
            items[next]?.focus();
          }}
          ref={listRef}
          role="listbox"
        >
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={`flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition ${option.value === value ? 'bg-dashboard-accent-soft text-dashboard-accent' : 'text-dashboard-muted hover:bg-dashboard-surface-hover hover:text-dashboard-text'}`}
              key={option.value}
              onClick={() => {
                onChange(option.value);
                onOpenChange(false);
                triggerRef.current?.focus({ preventScroll: true });
              }}
              role="option"
              tabIndex={option.value === value ? 0 : -1}
              type="button"
            >
              {option.color ? <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: option.color }} /> : null}
              <span className="min-w-0 flex-1">
                <span className={option.badgeClass ? `inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${option.badgeClass}` : 'block truncate'}>{option.label}</span>
              </span>
              {option.value === value ? <CheckIcon aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TaskFilterFields({
  projects,
  value,
  onApply,
}: {
  projects: Project[];
  value: TaskListFilters;
  onApply: (filters: TaskListFilters) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [openField, setOpenField] = useState<'project' | 'status' | 'priority' | null>(null);
  const { from, to } = draft.dueDate;
  const invalidRange = Boolean(from && to && from > to);
  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!invalidRange) onApply(draft);
      }}
    >
      <FilterSelect
        icon={<FolderIcon aria-hidden="true" className="h-4 w-4" />}
        label="Project"
        value={draft.projectId}
        options={[
          { value: '', label: 'All projects' },
          ...projects.map((project) => ({ value: project.id, label: project.name, color: project.color })),
        ]}
        isOpen={openField === 'project'}
        onOpenChange={(open) => setOpenField(open ? 'project' : null)}
        onChange={(projectId) => setDraft({ ...draft, projectId })}
      />
      <fieldset className="rounded-xl border border-dashboard-border bg-dashboard-surface/40 px-3 pb-3 pt-2">
        <legend className="flex items-center gap-2 px-1 text-xs font-medium text-dashboard-muted">
          <CalendarIcon aria-hidden="true" className="h-3.5 w-3.5" />
          Due date
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid min-w-0 gap-1.5 text-xs text-dashboard-muted">
            From
            <span className="relative block">
              <input
                className={`${fieldClass} task-filter-date relative pr-9`}
                type="date"
                value={from}
                max={to || undefined}
                onChange={(event) => setDraft({ ...draft, dueDate: { ...draft.dueDate, from: event.target.value } })}
              />
              <CalendarIcon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dashboard-muted" />
            </span>
          </label>
          <label className="grid min-w-0 gap-1.5 text-xs text-dashboard-muted">
            To
            <span className="relative block">
              <input
                className={`${fieldClass} task-filter-date relative pr-9`}
                type="date"
                value={to}
                min={from || undefined}
                onChange={(event) => setDraft({ ...draft, dueDate: { ...draft.dueDate, to: event.target.value } })}
              />
              <CalendarIcon aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-dashboard-muted" />
            </span>
          </label>
        </div>
      </fieldset>
      <FilterSelect
        icon={<TasksIcon aria-hidden="true" className="h-4 w-4" />}
        label="Status"
        value={draft.status}
        options={filterOrder.map((status) => ({
          value: status,
          label: status === 'All' ? 'All statuses' : status,
          badgeClass: status === 'All' ? undefined : statusClass(status),
        }))}
        isOpen={openField === 'status'}
        onOpenChange={(open) => setOpenField(open ? 'status' : null)}
        onChange={(status) => setDraft({ ...draft, status: status as TaskFilter })}
      />
      <FilterSelect
        icon={<PriorityIcon aria-hidden="true" className="h-4 w-4" />}
        label="Priority"
        value={draft.priority}
        options={priorityFilters.map((priority) => ({
          value: priority,
          label: priority === 'All' ? 'All priorities' : priority,
          badgeClass: priority === 'All' ? undefined : priorityClass(priority),
        }))}
        isOpen={openField === 'priority'}
        onOpenChange={(open) => setOpenField(open ? 'priority' : null)}
        onChange={(priority) => setDraft({ ...draft, priority: priority as PriorityFilter })}
      />
      {invalidRange ? (
        <p className="text-xs text-dashboard-danger" role="alert">
          End date must be on or after start date.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 border-t border-dashboard-border pt-4">
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashboard-border bg-dashboard-surface text-sm font-medium text-dashboard-muted transition hover:border-dashboard-border-strong hover:text-dashboard-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-dashboard-accent"
          onClick={() => onApply(emptyFilters)}
          type="button"
        >
          <ResetIcon aria-hidden="true" className="h-4 w-4" />
          <span>Reset all</span>
        </button>
        <button
          className="flex h-11 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-dashboard-accent px-3 text-sm font-semibold text-dashboard-on-accent shadow-sm transition hover:bg-dashboard-accent-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dashboard-accent disabled:cursor-not-allowed disabled:opacity-50"
          disabled={invalidRange}
          type="submit"
        >
          <CheckIcon aria-hidden="true" className="h-4 w-4" />
          <span>Apply filters</span>
        </button>
      </div>
    </form>
  );
}
