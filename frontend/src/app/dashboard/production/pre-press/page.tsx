'use client';

import PageTemplate from '@/components/PageTemplate';

export default function PrePressPage() {
  return (
    <PageTemplate
      title="Pre-Press"
      description="Manage design approval and file preparation"
      buttonText="Add Pre-Press Job"
      onButtonClick={() => console.log('Add pre-press job clicked')}
    >
      {null}
    </PageTemplate>
  );
}
