'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { HiChevronUp, HiChevronDown, HiPlus } from 'react-icons/hi';
import { TextInput } from 'flowbite-react';

interface AutocompleteOption {
  id: number | string;
  name: string;
  secondary?: string; // Secondary text like email or contact
}

interface AutocompleteInputProps {
  value: AutocompleteOption | null;
  onChange: (value: AutocompleteOption | null) => void;
  placeholder: string;
  searchFunction: (query: string) => Promise<AutocompleteOption[]>;
  label?: string;
  disabled?: boolean;
  className?: string;
  onAddNew?: () => void;
  addNewLabel?: string;
  sizing?: 'sm' | 'md' | 'lg';
  tabIndex?: number;
}

export default function AutocompleteInput({
  value,
  onChange,
  placeholder,
  searchFunction,
  label,
  disabled = false,
  className = '',
  onAddNew,
  addNewLabel = 'Add New',
  sizing = 'md',
  tabIndex,
}: AutocompleteInputProps) {
  const DEBOUNCE_MS = 200;
  const ROW_HEIGHT = 52;
  const MAX_DROPDOWN_HEIGHT = 240;
  const MOBILE_BREAKPOINT = 640;
  const MOBILE_PADDING = 12;

  const [inputValue, setInputValue] = useState(value?.name || '');
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 });
  const [hasSearched, setHasSearched] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position
  const calculateDropdownPosition = useCallback(() => {
    if (inputRef.current) {
      const rect = inputRef.current.getBoundingClientRect();
      const isSmallScreen = window.innerWidth < MOBILE_BREAKPOINT;
      const left = isSmallScreen ? MOBILE_PADDING : rect.left;
      const width = isSmallScreen ? window.innerWidth - MOBILE_PADDING * 2 : rect.width;

      setIsMobile(isSmallScreen);
      setDropdownPosition({
        top: rect.bottom + 4,
        left,
        width,
      });
    }
  }, [MOBILE_BREAKPOINT, MOBILE_PADDING]);

  // Update input value when prop value changes
  useEffect(() => {
    setInputValue(value?.name || '');
  }, [value]);

  // Debounced search function
  const debouncedSearch = useCallback(
    async (query: string) => {
      if (query.trim().length < 2) {
        setOptions([]);
        setIsOpen(false);
        setHasSearched(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      setHasSearched(true);
      try {
        const results = await searchFunction(query.trim());
        setOptions(results);
        calculateDropdownPosition();
        setIsOpen(true);
        setSelectedIndex(-1);
      } catch {
        setError('Failed to search. Please try again.');
        setOptions([]);
        setIsOpen(true);
      } finally {
        setIsLoading(false);
      }
    },
    [searchFunction, calculateDropdownPosition],
  );

  // Debounce search with useEffect
  useEffect(() => {
    const timer = setTimeout(() => {
      if (inputValue && inputValue !== value?.name) {
        debouncedSearch(inputValue);
      } else if (!inputValue) {
        setOptions([]);
        setIsOpen(false);
        setHasSearched(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [inputValue, debouncedSearch, value?.name, DEBOUNCE_MS]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Clear selection if input doesn't match current value
    if (value && newValue !== value.name) {
      onChange(null);
    }
  };

  // Handle option selection
  const handleOptionSelect = (option: AutocompleteOption) => {
    setInputValue(option.name);
    onChange(option);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Tab':
        // Close dropdown immediately when user tabs away
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
      case 'ArrowDown':
        if (isOpen) {
          e.preventDefault();
          const totalOptions = options.length;
          setSelectedIndex((prev) => (prev + 1) % totalOptions);
        }
        break;
      case 'ArrowUp':
        if (isOpen) {
          e.preventDefault();
          const totalOptions = options.length;
          setSelectedIndex((prev) => (prev - 1 + totalOptions) % totalOptions);
        }
        break;
      case 'Enter':
        if (isOpen) {
          e.preventDefault();
          if (selectedIndex >= 0 && selectedIndex < options.length) {
            handleOptionSelect(options[selectedIndex]);
          }
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (inputValue.length >= 2) {
      calculateDropdownPosition();
      setIsOpen(true);
      debouncedSearch(inputValue);
    }
  };

  // Handle input blur (when user tabs away or loses focus)
  const handleInputBlur = () => {
    // Use setTimeout to allow click on dropdown options to work
    setTimeout(() => {
      // Check if the new focus target is within the dropdown
      const activeElement = document.activeElement;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(activeElement) &&
        !inputRef.current?.contains(activeElement)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    }, 200);
  };

  // Scroll selected option into view
  useEffect(() => {
    if (!listRef.current || selectedIndex < 0) return;

    const listEl = listRef.current;
    const itemTop = selectedIndex * ROW_HEIGHT;
    const itemBottom = itemTop + ROW_HEIGHT;

    if (itemTop < listEl.scrollTop) {
      listEl.scrollTop = itemTop;
    } else if (itemBottom > listEl.scrollTop + listEl.clientHeight) {
      listEl.scrollTop = itemBottom - listEl.clientHeight;
    }
  }, [selectedIndex, ROW_HEIGHT]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        !inputRef.current?.contains(event.target as Node)
      ) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Keep dropdown anchored to input on scroll/resize
  useEffect(() => {
    if (!isOpen) return;

    const handleReposition = () => calculateDropdownPosition();
    handleReposition();

    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, calculateDropdownPosition]);

  const totalHeight = options.length * ROW_HEIGHT;
  const listHeight = Math.min(MAX_DROPDOWN_HEIGHT, totalHeight || ROW_HEIGHT);
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 2);
  const visibleCount = Math.ceil(listHeight / ROW_HEIGHT) + 4;
  const endIndex = Math.min(options.length, startIndex + visibleCount);
  const visibleOptions = options.slice(startIndex, endIndex);

  const handleListScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const handleListWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    const listEl = event.currentTarget;
    const atTop = listEl.scrollTop === 0;
    const atBottom = listEl.scrollTop + listEl.clientHeight >= listEl.scrollHeight;

    if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
      event.preventDefault();
    }
  };

  const handleCloseDropdown = () => {
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.blur();
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          {label}
        </label>
      )}

      <div className="relative">
        <TextInput
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholder={placeholder}
          disabled={disabled}
          color={error ? 'failure' : undefined}
          helperText={error}
          sizing={sizing}
          className="w-full"
          tabIndex={tabIndex}
        />

        {/* Add New Button */}
        {onAddNew && (
          <button
            type="button"
            onClick={onAddNew}
            disabled={disabled}
            className="absolute right-7 top-1/2 transform -translate-y-1/2 z-10 p-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed"
            title={addNewLabel}
          >
            <HiPlus className="h-4 w-4" />
          </button>
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute right-2 top-1/2 transform -translate-y-1/2 z-10">
            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
        )}

        {/* Dropdown indicator */}
        {!isLoading && (
          <div
            className={`absolute ${onAddNew ? 'right-1' : 'right-3'} top-1/2 transform -translate-y-1/2 text-gray-400 z-10 pointer-events-none`}
          >
            {isOpen ? <HiChevronUp className="h-4 w-4" /> : <HiChevronDown className="h-4 w-4" />}
          </div>
        )}
      </div>

      {/* Dropdown */}
      {isOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={dropdownRef}
            className="typeahead-dropdown fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg"
            style={{
              top: `${dropdownPosition.top}px`,
              left: `${dropdownPosition.left}px`,
              width: `${dropdownPosition.width}px`,
            }}
          >
            {isMobile && (
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  Suggestions
                </span>
                <button
                  type="button"
                  onClick={handleCloseDropdown}
                  className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  Close
                </button>
              </div>
            )}

            <div
              ref={listRef}
              onScroll={handleListScroll}
              onWheel={handleListWheel}
              className="thin-scrollbar overflow-y-auto"
              style={{ maxHeight: `${MAX_DROPDOWN_HEIGHT}px`, height: `${listHeight}px` }}
            >
              {isLoading && (
                <div className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                  Searching...
                </div>
              )}

              {!isLoading && hasSearched && options.length === 0 && (
                <div className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400">
                  No results found
                </div>
              )}

              {options.length > 0 && (
                <div style={{ height: `${totalHeight}px`, position: 'relative' }}>
                  <div
                    style={{
                      position: 'absolute',
                      top: `${startIndex * ROW_HEIGHT}px`,
                      left: 0,
                      right: 0,
                    }}
                  >
                    {visibleOptions.map((option, index) => {
                      const optionIndex = startIndex + index;
                      return (
                        <div
                          key={option.id ? `option-${option.id}` : `option-index-${optionIndex}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleOptionSelect(option);
                          }}
                          onMouseEnter={() => setSelectedIndex(optionIndex)}
                          className={`px-3 cursor-pointer text-sm h-[52px] flex flex-col justify-center ${
                            selectedIndex === optionIndex
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                              : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                          } border-b border-gray-200/70 dark:border-gray-700/70`}
                        >
                          <div className="font-medium">{option.name}</div>
                          {option.secondary && (
                            <div className="typeahead-secondary text-[10px] leading-4 text-gray-500 dark:text-gray-400">
                              {option.secondary}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
