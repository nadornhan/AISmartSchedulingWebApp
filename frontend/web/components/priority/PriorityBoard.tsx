'use client';

import { useState } from 'react';
import { priorityColumns as initialColumns } from './priority.data';
import { PriorityColumn } from './PriorityColumn';
import { PrioritySummaryGrid } from './PrioritySummaryGrid';
import { PriorityTipBar } from './PriorityTipBar';
 
export function PriorityBoard() {
  const [columns, setColumns] = useState(initialColumns);

  function toggleTask(id: string) {
    setColumns((current) => current.map((column) => ({
      ...column,
      tasks: column.tasks.map((task) => task.id === id ? { ...task, completed: !task.completed } : task),
    })));
  }

    return (
      <div className="mx-auto max-w-[1500px] space-y-4">
        <PrioritySummaryGrid columns={columns} />
        <section aria-label="Priority task board" className="grid items-stretch gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => <PriorityColumn column={column} key={column.id} onToggle={toggleTask} />)}
        </section>
        <PriorityTipBar />
      </div>
    );
}
