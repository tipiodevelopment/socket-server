import { AppLayout } from '@/components/AppLayout';
import { ComponentLibraryTab } from '@/components/ComponentLibraryTab';

export default function ComponentsPage() {
  return (
    <AppLayout
      breadcrumbs={[{ label: 'Components' }]}
      title="Component Library"
      subtitle="Reusable UI components for your iOS app"
    >
      <ComponentLibraryTab />
    </AppLayout>
  );
}
