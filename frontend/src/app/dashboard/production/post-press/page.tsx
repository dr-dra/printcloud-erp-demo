'use client';

import PageTemplate from '@/components/PageTemplate';

export default function PostPressPage() {
  return (
    <PageTemplate
      title="Post-Press"
      description="Manage finishing operations like cutting, binding, and packaging"
      buttonText="Add Post-Press Job"
      onButtonClick={() => console.log('Add post-press job clicked')}
    >
      {null}
    </PageTemplate>
  );
}
