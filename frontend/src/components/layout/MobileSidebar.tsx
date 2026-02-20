'use client';

import React from 'react';
import Link from 'next/link';
import { NavSection } from './types';
import type { User } from '@/context/AuthContext';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  navigationSections: NavSection[];
  pathname: string;
  user: User | null;
}

export const MobileSidebar: React.FC<MobileSidebarProps> = ({
  isOpen,
  onClose,
  navigationSections,
  pathname,
  user,
}) => {
  return (
    <>
      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 w-64 h-screen pt-20 transition-transform ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } bg-white border-r border-gray-200 lg:hidden dark:bg-gray-800 dark:border-gray-700`}
      >
        <div className="h-full px-3 pb-4 overflow-y-auto bg-white dark:bg-gray-800 thin-scrollbar">
          {/* Navigation */}
          <nav className="space-y-4 mt-6">
            {navigationSections.map((section) => (
              <div key={section.title}>
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 px-3">
                  {section.title}
                </h3>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const IconComponent = item.icon;

                    // Dynamic link for POS based on role
                    let href = item.href;
                    if (item.name === 'POS') {
                      if (
                        user?.role === 'admin' ||
                        user?.role === 'accounting' ||
                        user?.role === 'cashier'
                      ) {
                        href = '/dashboard/sales/pos/accounting';
                      } else {
                        href = '/dashboard/sales/pos';
                      }
                    }

                    const isActive = pathname === href;

                    return (
                      <li key={item.name}>
                        <Link
                          href={href}
                          className={`flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors duration-200 ${
                            isActive
                              ? 'bg-primary-100 text-primary-700 dark:bg-primary-800 dark:text-primary-200'
                              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                          }`}
                          onClick={onClose}
                        >
                          <IconComponent size={18} className="mr-3 flex-shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </aside>

      {/* Mobile sidebar backdrop */}
      {isOpen && <div className="fixed inset-0 z-30 bg-gray-900/50 lg:hidden" onClick={onClose} />}
    </>
  );
};
