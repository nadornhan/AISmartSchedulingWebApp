import { PagePlaceholder } from '../_components/page-placeholder';

export default function FoldersPage() {
  return (
    <PagePlaceholder
      eyebrow="Projects and folders"
      items={['Folder cards', 'Unassigned inbox', 'Project counts']}
      summary="Folder page content can focus on projects, while the sidebar owns folder navigation and New Folder entry."
    />
  );
}
