import React from 'react';

interface TableRowProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  isSelected?: boolean;
}

export default function TableRow({
  children,
  onClick,
  className = '',
  isSelected = false,
}: TableRowProps) {
  const baseClasses = 'border-b dark:border-gray-700';
  const interactiveClasses = onClick
    ? 'hover:bg-gray-50 dark:hover:bg-gray-600 cursor-pointer'
    : '';
  const selectedClasses = isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : '';

  return (
    <tr
      className={`${baseClasses} ${interactiveClasses} ${selectedClasses} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
}
