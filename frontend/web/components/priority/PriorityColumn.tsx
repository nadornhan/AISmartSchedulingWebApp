import type { PriorityColumnData } from './priority.types';
import type { PriorityTask } from './priority.types';
import { PriorityTaskCard } from './PriorityTaskCard';

type Props = {
  column: PriorityColumnData;
  draggedTaskId: string | null;
  isDropTarget: boolean;
  movingTaskId: string | null;
  onAddTask: (columnId: PriorityColumnData['id']) => void;
  onDragEnd: () => void;
  onDragEnter: (columnId: PriorityColumnData['id']) => void;
  onDragStart: (taskId: string) => void;
  onDropTask: (taskId: string) => void;
  onPreview: (task: PriorityTask) => void;
  onToggle: (id: string) => void;
};

export function PriorityColumn({
  column,
  draggedTaskId,
  isDropTarget,
  movingTaskId,
  onAddTask,
  onDragEnd,
  onDragEnter,
  onDragStart,
  onDropTask,
  onPreview,
  onToggle,
}: Props) {
  return (
    <section
      className={`flex min-h-[480px] flex-col overflow-hidden rounded-xl border bg-dashboard-surface/55 transition-all duration-200 ${
        isDropTarget ? 'scale-[1.01] shadow-glow' : ''
      }`}
      onDragEnter={() => onDragEnter(column.id)}
      onDragOver={(event) => {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        onDragEnter(column.id);
      }}
      onDrop={(event) => {
        event.preventDefault();
        const taskId = event.dataTransfer.getData('text/plain') || draggedTaskId;
        if (taskId) onDropTask(taskId);
      }}
      style={{
        borderColor: isDropTarget
          ? column.accent
          : `rgb(${column.accentRgb} / .32)`,
        backgroundColor: isDropTarget
          ? `rgb(${column.accentRgb} / .09)`
          : undefined,
      }}
    >
      <header className="flex h-16 items-center gap-2 border-b border-dashboard-border px-5" style={{ borderLeft: `3px solid ${column.accent}` }}>
        <h2 className="text-md font-semibold" style={{ color: column.accent }}>{column.title}</h2>
        <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold" style={{ color: column.accent, background: `rgb(${column.accentRgb} / .13)` }}>
          {column.tasks.length}
        </span>
      </header>

      <div className="flex flex-1 flex-col p-2.5">
        <div className="space-y-2.5">
          {column.tasks.map((task) => (
            <PriorityTaskCard
              accent={column.accent}
              dragging={draggedTaskId === task.id}
              key={task.id}
              moving={movingTaskId === task.id}
              onDragEnd={onDragEnd}
              onDragStart={onDragStart}
              onPreview={onPreview}
              onToggle={onToggle}
              task={task}
            />
          ))}
        </div>
        <button
          className="mx-auto mt-3 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition hover:bg-white/5"
          onClick={() => onAddTask(column.id)}
          style={{ color: column.accent }}
          type="button"
        >
          <span className="text-lg leading-none">+</span> Add task
        </button>
      </div>
    </section>
  );
}
