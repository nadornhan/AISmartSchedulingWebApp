import { PagePlaceholder } from '../_components/page-placeholder';

export default function CalendarPage() {
  return (
    <PagePlaceholder
      eyebrow="Schedule"
      items={['Month view', 'Upcoming deadlines', 'Reminder blocks']}
      summary="Calendar-specific scheduling content belongs here without reimplementing the dashboard chrome."
    />
  );
}
