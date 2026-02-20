import React from 'react';
import { Dropdown } from 'flowbite-react';
import { HiDotsVertical } from 'react-icons/hi';

export interface ActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  divider?: boolean;
  variant?: 'danger' | 'default';
}

interface ActionDropdownProps {
  actions: ActionItem[];
  triggerClassName?: string;
}

export default function ActionDropdown({
  actions,
  triggerClassName = 'inline-flex items-center p-2 text-sm font-medium text-center text-gray-900 bg-white rounded-lg hover:bg-gray-100 focus:ring-4 focus:outline-none dark:text-white focus:ring-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-600',
}: ActionDropdownProps) {
  return (
    <Dropdown
      label=""
      dismissOnClick={false}
      renderTrigger={() => (
        <button type="button" className={triggerClassName}>
          <HiDotsVertical className="w-4 h-4" />
        </button>
      )}
    >
      {actions.map((action, index) => (
        <React.Fragment key={index}>
          {action.divider && <Dropdown.Divider />}
          <Dropdown.Item
            onClick={action.onClick}
            className={action.variant === 'danger' ? 'text-red-600 hover:text-red-700' : ''}
          >
            {action.icon && <span className="mr-2">{action.icon}</span>}
            {action.label}
          </Dropdown.Item>
        </React.Fragment>
      ))}
    </Dropdown>
  );
}
