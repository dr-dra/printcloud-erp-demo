'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Bug } from 'lucide-react';
import { IconRailProps } from './types';

export const IconRail: React.FC<IconRailProps> = ({
  modules,
  activeModule,
  expandedModule,
  onModuleClick,
  pathname,
  onReportIssue,
}) => {
  const railRef = useRef<HTMLDivElement>(null);
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!railRef.current?.contains(document.activeElement)) return;

      const buttons = Array.from(railRef.current.querySelectorAll('button'));
      const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement);

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          buttons[(currentIndex + 1) % buttons.length]?.focus();
          break;
        case 'ArrowUp':
          e.preventDefault();
          buttons[(currentIndex - 1 + buttons.length) % buttons.length]?.focus();
          break;
        case 'Escape':
          e.preventDefault();
          if (expandedModule) {
            onModuleClick(expandedModule); // Toggle to close
          }
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [expandedModule, onModuleClick]);

  // Determine active module based on current pathname
  const getActiveModuleName = (): string | null => {
    for (const moduleConfig of modules) {
      for (const section of moduleConfig.sections) {
        if (section.items.some((item) => pathname === item.href)) {
          return moduleConfig.name;
        }
      }
    }
    return null;
  };

  const activeModuleName = activeModule ?? getActiveModuleName();

  const handleMouseEnter = (label: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setTooltipPosition({
      top: rect.top + rect.height / 2,
      left: rect.right + 8,
    });
    setHoveredIcon(label);
  };

  const handleMouseLeave = () => {
    setHoveredIcon(null);
  };

  return (
    <>
      <div
        ref={railRef}
        className="hidden lg:flex flex-col w-12 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 fixed left-0 top-0 bottom-0 z-40 pt-16 font-inter"
        role="navigation"
        aria-label="Main navigation"
      >
        {modules.map((moduleConfig) => {
          const Icon = moduleConfig.icon;
          const isActiveRoute = activeModuleName === moduleConfig.name;
          const isExpanded = expandedModule === moduleConfig.name;

          return (
            <button
              key={moduleConfig.name}
              onClick={() => onModuleClick(moduleConfig.name)}
              onMouseEnter={(e) => handleMouseEnter(moduleConfig.name, e)}
              onMouseLeave={handleMouseLeave}
              className={`
                relative flex items-center justify-center h-12 w-12
                transition-colors duration-150 ease-out
                hover:bg-blue-50 dark:hover:bg-gray-700/70
                focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-500
                ${isExpanded ? 'bg-blue-50 dark:bg-gray-700/50' : ''}
              `}
              aria-label={moduleConfig.name}
              aria-expanded={isExpanded}
              aria-controls={isExpanded ? 'expandable-panel' : undefined}
            >
              {/* Expanded indicator - left border (strong blue) */}
              {isExpanded && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 dark:bg-blue-500" />
              )}

              {/* Active route indicator - left border (subtle blue) - only show if NOT expanded */}
              {isActiveRoute && !isExpanded && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-400 dark:bg-blue-300 opacity-60" />
              )}

              {/* Top and bottom borders - only when expanded */}
              {isExpanded && (
                <>
                  <div className="absolute top-0 left-0 right-0 h-[1px] bg-gray-200 dark:bg-gray-700" />
                  <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gray-200 dark:bg-gray-700" />
                </>
              )}

              {/* Right border remover - creates seamless connection to panel when expanded */}
              {isExpanded && (
                <div className="absolute right-0 top-0 bottom-0 w-[1px] bg-white dark:bg-gray-800 z-10" />
              )}

              {/* Icon */}
              <Icon
                className={`
                  w-5 h-5 transition-all duration-150
                  ${
                    isExpanded
                      ? 'text-blue-600 dark:text-blue-400 scale-105'
                      : isActiveRoute
                        ? 'text-blue-500 dark:text-blue-300'
                        : 'text-gray-600 dark:text-gray-400'
                  }
                `}
                strokeWidth={isExpanded ? 2 : isActiveRoute ? 1.75 : 1.5}
              />
            </button>
          );
        })}

        {onReportIssue && (
          <div className="mt-auto pb-3">
            <button
              onClick={onReportIssue}
              onMouseEnter={(e) => handleMouseEnter('Report Issue', e)}
              onMouseLeave={handleMouseLeave}
              className={`
                relative flex items-center justify-center h-12 w-12
                transition-colors duration-150 ease-out
                hover:bg-amber-50 dark:hover:bg-gray-700/70
                focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500
              `}
              aria-label="Report issue"
              title="Report issue"
            >
              <Bug className="w-5 h-5 text-amber-600 dark:text-amber-400" strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>

      {/* Tooltip - shows on hover but doesn't trigger expansion */}
      {hoveredIcon && (
        <div
          className="hidden lg:block fixed z-50 pointer-events-none"
          style={{
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            transform: 'translateY(-50%)',
          }}
        >
          <div className="bg-gray-900 dark:bg-gray-700 text-white text-xs font-medium px-3 py-1.5 rounded-md shadow-lg whitespace-nowrap font-inter">
            {hoveredIcon}
            {/* Tooltip arrow */}
            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 dark:bg-gray-700 rotate-45" />
          </div>
        </div>
      )}
    </>
  );
};
