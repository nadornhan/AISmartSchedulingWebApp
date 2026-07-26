import { PagePlaceholder } from '../_components/page-placeholder';

export default function AnalyticsPage() {
  return (
    <PagePlaceholder
      eyebrow="Insights"
      items={['Completion trends', 'Focus analytics', 'Workload balance']}
      summary="Insight widgets can be added here while the shared header supplies the page title."
    />
  );
}
