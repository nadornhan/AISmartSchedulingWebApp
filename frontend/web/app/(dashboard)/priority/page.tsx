import { PagePlaceholder } from '../_components/page-placeholder';

export default function PriorityPage() {
  return (
    <PagePlaceholder
      eyebrow="Prioritization"
      items={['High priority', 'Medium priority', 'Low priority']}
      summary="Priority View can now render ranking tools inside the shared dashboard layout."
    />
  );
}
