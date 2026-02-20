'use client';

import { ReactNode } from 'react';
import { Card, Button } from 'flowbite-react';
import { HiPlus } from 'react-icons/hi';
import DashboardLayout from './DashboardLayout';

interface PageTemplateProps {
  title: string;
  description: string;
  buttonText?: string;
  onButtonClick?: () => void;
  children: ReactNode;
}

export default function PageTemplate({
  title,
  description,
  buttonText = 'Create New',
  onButtonClick,
  children,
}: PageTemplateProps) {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">{description}</p>
          </div>
          {onButtonClick && (
            <Button onClick={onButtonClick}>
              <HiPlus className="mr-2 h-4 w-4" />
              {buttonText}
            </Button>
          )}
        </div>

        {/* Page Content */}
        {children}

        {/* Coming Soon Placeholder if no children */}
        {!children && (
          <Card className="text-center py-12">
            <div className="space-y-4">
              <div className="text-4xl">🚧</div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Coming Soon</h3>
              <p className="text-gray-600 dark:text-gray-400">
                This {title.toLowerCase()} management feature is under development.
              </p>
            </div>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
