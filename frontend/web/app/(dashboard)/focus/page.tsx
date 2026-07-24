import { PagePlaceholder } from '../_components/page-placeholder';

export default function FocusPage() {
  return (
    <PagePlaceholder
      eyebrow="Deep work"
      items={['Focus timer', 'Session queue', 'Distraction guard']}
      summary="Focus Mode content stays isolated from the reusable sidebar and header."
    />
  );
}
