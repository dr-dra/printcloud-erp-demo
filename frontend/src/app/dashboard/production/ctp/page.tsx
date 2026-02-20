'use client';

import PageTemplate from '@/components/PageTemplate';

export default function CTPPage() {
  return (
    <PageTemplate
      title="CTP (Computer to Plate)"
      description="Manage plate making and preparation"
      buttonText="Create CTP Job"
      onButtonClick={() => console.log('Create CTP job clicked')}
    >
      {null}
    </PageTemplate>
  );
}
