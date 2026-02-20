'use client';

import React, { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, Pin, PinOff } from 'lucide-react';
import { ExpandablePanelProps } from './types';

export const ExpandablePanel: React.FC<ExpandablePanelProps> = ({
  module,
  isVisible,
  isPinned,
  onClose,
  onPin,
  pathname,
  sidebarBehavior,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible && !isPinned) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isVisible, isPinned, onClose]);

  if (!isVisible || !module) return null;

  const positionClasses =
    sidebarBehavior === 'overlay' && !isPinned
      ? 'fixed left-12 top-0 bottom-0 z-30 pt-16'
      : 'fixed left-12 top-0 bottom-0 z-30 pt-16';

  return (
    <>
      {/* Backdrop for overlay mode (only when not pinned) */}
      {sidebarBehavior === 'overlay' && !isPinned && (
        <div
          className="hidden lg:block fixed inset-0 bg-black/10 dark:bg-black/30 z-20 transition-opacity duration-150"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        ref={panelRef}
        id="expandable-panel"
        className={`
          hidden lg:block w-53 bg-white dark:bg-gray-800
          border-r border-gray-200 dark:border-gray-700
          shadow-xl dark:shadow-2xl overflow-hidden thin-scrollbar flex flex-col
          transition-all duration-150 ease-out motion-reduce:transition-none
          font-inter
          ${positionClasses}
          ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'}
        `}
        role="navigation"
        aria-label={`${module.name} navigation`}
      >
        {/* Header with module name, pin, and close button */}
        <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-2.5 py-2.5 flex items-center justify-between z-10 backdrop-blur-sm bg-white/95 dark:bg-gray-800/95">
          <div className="flex items-center gap-2 min-w-0">
            {/* Module icon */}
            <div className="flex-shrink-0 flex items-center justify-center w-6 h-6 rounded-lg bg-blue-50 dark:bg-blue-900/20">
              <module.icon
                className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
                strokeWidth={2}
              />
            </div>
            {/* Module name */}
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {module.name}
            </h2>
          </div>
          {/* Action buttons */}
          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* Pin button */}
            <button
              onClick={onPin}
              className={`
                p-1 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500
                ${
                  isPinned
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
              aria-label={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
              title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
            >
              {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
            </button>
            {/* Close button (hidden when pinned) */}
            {!isPinned && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                aria-label="Close navigation panel"
              >
                <X className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation items */}
        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {module.sections.map((section) => (
            <nav key={section.title} className="space-y-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`
                      group flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium
                      transition-all duration-150
                      focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500
                      ${
                        isActive
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                      }
                    `}
                  >
                    {/* Item icon */}
                    {Icon && (
                      <Icon
                        className={`
                          h-4 w-4 flex-shrink-0 transition-transform duration-150
                          ${
                            isActive
                              ? 'text-blue-600 dark:text-blue-400'
                              : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                          }
                          ${isActive ? 'scale-110' : 'group-hover:scale-105'}
                        `}
                      />
                    )}
                    {/* Item name */}
                    <span className="flex-1 truncate">{item.name}</span>
                    {/* Active indicator dot */}
                    {isActive && (
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 flex-shrink-0" />
                    )}
                  </Link>
                );
              })}
            </nav>
          ))}
        </div>
        {(() => {
          const shortcuts: Record<string, string> = {
            Overview: 'O',
            Sales: 'S',
            Accounting: 'A',
            Production: 'P',
            Inventory: 'I',
          };
          const key = shortcuts[module.name];
          if (!key) return null;
          return (
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 px-2 py-3 text-[11px] text-gray-500/50 dark:text-gray-400/50">
              <div className="flex items-center gap-1.5">
                <span>Shortcut:</span>
                <div className="flex items-center gap-1 text-gray-600/70 dark:text-gray-300/70">
                  <span className="rounded border border-gray-300/70 bg-gray-50/70 px-1 py-0 text-[9px] font-semibold uppercase leading-4 shadow-sm dark:border-gray-600/70 dark:bg-gray-700/40">
                    Ctrl
                  </span>
                  <span className="text-[9px]">+</span>
                  <span className="rounded border border-gray-300/70 bg-gray-50/70 px-1 py-0 text-[9px] font-semibold uppercase leading-4 shadow-sm dark:border-gray-600/70 dark:bg-gray-700/40">
                    Shift
                  </span>
                  <span className="text-[9px]">+</span>
                  <span className="rounded border border-gray-300/70 bg-gray-50/70 px-1 py-0 text-[9px] font-semibold uppercase leading-4 shadow-sm dark:border-gray-600/70 dark:bg-gray-700/40">
                    {key}
                  </span>
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
};
