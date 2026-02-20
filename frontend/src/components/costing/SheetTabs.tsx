'use client';

import React, { useState } from 'react';
import { CostingVariant, SheetAction } from '@/types/costing';
import { Copy, Trash2, Plus, Lock } from 'lucide-react';

interface SheetTabsProps {
  variants: CostingVariant[];
  activeSheetIndex: number;
  onSheetSelect: (index: number) => void;
  onSheetAction: (action: SheetAction, index?: number) => void;
  onSheetRename: (index: number, newName: string) => void;
}

export default function SheetTabs({
  variants,
  activeSheetIndex,
  onSheetSelect,
  onSheetAction,
  onSheetRename,
}: SheetTabsProps) {
  const [editingTab, setEditingTab] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleTabDoubleClick = (index: number) => {
    if (variants[index].is_locked) return;
    setEditingTab(index);
    setEditValue(variants[index].name);
  };

  const handleEditSubmit = (index: number) => {
    if (editValue.trim()) {
      onSheetRename(index, editValue.trim());
    }
    setEditingTab(null);
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter') {
      handleEditSubmit(index);
    } else if (e.key === 'Escape') {
      setEditingTab(null);
    }
  };

  return (
    <div className="flex items-center bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-2 text-gray-900 dark:text-gray-100">
      {/* Sheet Counter */}
      <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-4">
        {variants.length} Sheet{variants.length !== 1 ? 's' : ''}
      </div>

      {/* Sheet Tabs */}
      <div className="flex items-center space-x-1 flex-1">
        {variants.map((variant, index) => (
          <div
            key={variant.id || index}
            className={`
              relative flex items-center group px-3 py-2 border transition-all
              ${
                activeSheetIndex === index
                  ? 'bg-gray-200 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-900 dark:text-gray-100'
                  : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
              }
              min-w-0 max-w-[200px]
            `}
          >
            {/* Tab Content - All in one line */}
            <div
              className="flex items-center cursor-pointer min-w-0 flex-1"
              onClick={() => onSheetSelect(index)}
              onDoubleClick={() => handleTabDoubleClick(index)}
            >
              {/* Lock Icon */}
              {variant.is_locked && <Lock className="w-3 h-3 text-current mr-1 flex-shrink-0" />}

              {/* Tab Name */}
              {editingTab === index ? (
                <input
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleEditSubmit(index)}
                  onKeyDown={(e) => handleEditKeyDown(e, index)}
                  className="bg-transparent border-none outline-none text-sm font-medium min-w-0 flex-1"
                  autoFocus
                />
              ) : (
                <span className="text-sm font-medium truncate min-w-0 flex-1">{variant.name}</span>
              )}
            </div>

            {/* Action Icons */}
            <div className="flex items-center space-x-1 ml-2">
              {/* Clone Icon */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onSheetAction('clone', index);
                }}
                className="p-1 hover:bg-white/50 dark:hover:bg-gray-600/50 text-current hover:text-gray-700 dark:hover:text-gray-300"
                title="Clone Sheet"
              >
                <Copy className="w-3 h-3" />
              </button>

              {/* Delete Icon (only show if not locked and more than 1 sheet) */}
              {!variant.is_locked && variants.length > 1 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSheetAction('delete', index);
                  }}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-gray-600 text-current hover:text-gray-700 dark:hover:text-gray-300"
                  title="Delete Sheet"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add New Sheet Button */}
      <div className="flex-shrink-0">
        <button
          onClick={() => onSheetAction('add')}
          className="flex items-center px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          title="Add New Sheet"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
