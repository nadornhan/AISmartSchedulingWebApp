import { TaskBoard } from '../../../components/tasks/task-board';
import type { TaskPriority, TaskStatus } from '../../../lib/tasks';

type TasksPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

export default async function TasksPage({ searchParams }: TasksPageProps) {
  const params = await searchParams;

  return (
    <TaskBoard
      initialPriority={firstValue(params.priority) as TaskPriority | ''}
      initialProjectId={firstValue(params.project_id)}
      initialStatus={firstValue(params.status) as TaskStatus | ''}
      search={firstValue(params.search)}
    />
  );
}
