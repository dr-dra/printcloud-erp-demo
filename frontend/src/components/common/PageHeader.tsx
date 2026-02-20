import React from 'react';
import { Button } from 'flowbite-react';

interface PageHeaderProps {
  title: string;
  actionButton?: {
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger';
  };
  additionalButtons?: {
    label: string;
    icon?: React.ReactNode;
    onClick?: () => void;
    variant?: 'primary' | 'secondary' | 'success' | 'danger';
  }[];
}

export default function PageHeader({ title, actionButton, additionalButtons }: PageHeaderProps) {
  return (
    <div className="flex justify-between items-center mb-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h1>

      <div className="flex items-center gap-3">
        {additionalButtons?.map((button, index) => (
          <Button key={index} color={button.variant || 'primary'} onClick={button.onClick}>
            {button.icon && <span className="mr-2">{button.icon}</span>}
            {button.label}
          </Button>
        ))}

        {actionButton && (
          <Button color={actionButton.variant || 'primary'} onClick={actionButton.onClick}>
            {actionButton.icon && <span className="mr-2">{actionButton.icon}</span>}
            {actionButton.label}
          </Button>
        )}
      </div>
    </div>
  );
}
