import { PagePlaceholder } from './_components/page-placeholder';

export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Overview"
      items={['Today timeline', 'Priority queue', 'Weekly progress']}
      summary="Dashboard content lives here while the shared navigation shell handles the sidebar and header."
    />
  );
}
