import { PagePlaceholder } from '../_components/page-placeholder';

export default function TasksPage() {
  return (
    <PagePlaceholder
      eyebrow="Task management"
      items={['Task list', 'Status filters', 'Bulk actions']}
      summary="All task-specific UI stays in this page content area and reuses the shared navigation shell."
    />
  );
}
