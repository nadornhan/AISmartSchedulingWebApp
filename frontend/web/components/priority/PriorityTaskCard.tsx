'use client';

import { useRef } from 'react';

import type { PriorityTask } from './priority.types';

type PriorityTaskCardProps = {
  task: PriorityTask;
  accent: string;
  dragging: boolean;
  moving: boolean;
  onDragEnd: () => void;
  onDragStart: (id: string) => void;
  onPreview: (task: PriorityTask) => void;
  onToggle: (id: string) => void;
};

export function PriorityTaskCard({
  task,
  accent,
  dragging,
  moving,
  onDragEnd,
  onDragStart,
  onPreview,
  onToggle,
}: PriorityTaskCardProps) {
  const wasDragged = useRef(false);

  function openPreview() {
    if (!wasDragged.current && !moving) onPreview(task);
  }

  return (
    <article
      aria-grabbed={dragging}
      aria-label={`Preview ${task.title}`}
      className={`min-h-[92px] cursor-grab rounded-xl border border-dashboard-border bg-dashboard-raised/90 px-4 py-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-dashboard-border-strong active:cursor-grabbing ${
        dragging ? 'scale-[.98] opacity-45 shadow-none' : 'opacity-100'
      } ${moving ? 'pointer-events-none animate-pulse' : ''}`}
      draggable={!moving}
      onClick={openPreview}
      onDragEnd={() => {
        onDragEnd();
        window.setTimeout(() => {
          wasDragged.current = false;
        }, 0);
      }}
      onDragStart={(event) => {
        wasDragged.current = true;
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', task.id);
        onDragStart(task.id);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openPreview();
        }
      }}
      role="button"
      tabIndex={0}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label={`Complete ${task.title}`}
          aria-pressed={task.completed}
          onClick={(event) => {
            event.stopPropagation();
            onToggle(task.id);
          }}
          className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border border-dashboard-muted transition"
          style={task.completed ? { borderColor: accent, backgroundColor: accent } : undefined}
        >
          {task.completed ? (
            <span className="text-[10px] font-bold text-dashboard-bg">✓</span>
          ) : null}
        </button>

        <div className="min-w-0 flex-1">
          <h3
            className={`truncate text-[15px] font-medium leading-5 text-dashboard-text ${task.completed ? 'line-through opacity-50' : ''}`}
          >
            {task.title}
          </h3>

          {task.dueDate ? (
            <p
              className={
                task.overdue
                  ? 'mt-1 text-[13px] font-medium leading-4 text-dashboard-danger'
                  : 'mt-1 text-[13px] font-medium leading-4'
              }
              style={!task.overdue ? { color: accent } : undefined}
            >
              {task.dueDate}
            </p>
          ) : null}

          <div className="mt-2.5 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.folderColor }} />

            <span className="text-[13px] leading-4 text-dashboard-muted">{task.folder}</span>
          </div>
        </div>
      </div>
    </article>
  );
}
