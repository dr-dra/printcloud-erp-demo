'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HiChevronDown, HiX } from 'react-icons/hi';
import { api } from '@/lib/api';
import { toast } from 'sonner';

interface EmailChip {
  id: string;
  email: string;
  isValid: boolean;
}

interface EmailTypeaheadProps {
  customerId: number | null;
  selectedEmails: EmailChip[];
  onEmailsChange: (emails: EmailChip[]) => void;
  placeholder?: string;
  className?: string;
}

export const EmailTypeahead: React.FC<EmailTypeaheadProps> = ({
  customerId,
  selectedEmails,
  onEmailsChange,
  placeholder = 'Add recipients...',
  className = '',
}) => {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isClickingSuggestion, setIsClickingSuggestion] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Validate email
  const isValidEmail = (email: string) => {
    return emailRegex.test(email.trim());
  };

  // Debounced search function
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(async () => {
        if (!customerId || !query || query.length < 1) {
          setSuggestions([]);
          return;
        }

        try {
          setLoading(true);
          const response = await api.get(
            `/customers/${customerId}/emails/typeahead/?q=${encodeURIComponent(query)}`,
          );
          setSuggestions(response.data.emails || []);
          setHighlightedIndex(-1); // Reset highlight when new suggestions arrive
        } catch (error) {
          console.error('Error fetching email suggestions:', error);
          setSuggestions([]);
          setHighlightedIndex(-1);
        } finally {
          setLoading(false);
        }
      }, 300);
    },
    [customerId],
  );

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    setIsOpen(true);
    setHighlightedIndex(-1); // Reset highlight when typing
    debouncedSearch(value);
  };

  // Add email chip
  const addEmailChip = (email: string) => {
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) return;

    // Check if email already exists
    if (selectedEmails.some((chip) => chip.email === trimmedEmail)) {
      toast.error('Email already added');
      return;
    }

    const newChip: EmailChip = {
      id: Date.now().toString() + Math.random(),
      email: trimmedEmail,
      isValid: isValidEmail(trimmedEmail),
    };

    onEmailsChange([...selectedEmails, newChip]);
    setInputValue('');
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);

    // Focus back to input for next entry
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  // Remove email chip
  const removeEmailChip = (id: string) => {
    onEmailsChange(selectedEmails.filter((chip) => chip.id !== id));
  };

  // Handle suggestion click
  const handleSuggestionClick = (email: string) => {
    setIsClickingSuggestion(true);
    addEmailChip(email);
    // Reset the flag after a short delay
    setTimeout(() => setIsClickingSuggestion(false), 100);
  };

  // Handle input key press with navigation
  const handleInputKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      // No dropdown open, handle normal keys
      if (e.key === 'Enter' || e.key === ',' || e.key === ' ') {
        e.preventDefault();
        if (inputValue.trim()) {
          addEmailChip(inputValue);
        }
      } else if (e.key === 'Backspace' && !inputValue && selectedEmails.length > 0) {
        // Remove last chip when backspace is pressed on empty input
        const lastChip = selectedEmails[selectedEmails.length - 1];
        removeEmailChip(lastChip.id);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
      }
      return;
    }

    // Handle navigation when dropdown is open
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
        break;

      case 'ArrowUp':
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
        break;

      case 'Enter':
      case 'Tab':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          addEmailChip(suggestions[highlightedIndex]);
        } else if (inputValue.trim()) {
          addEmailChip(inputValue);
        }
        break;

      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSuggestions([]);
        setHighlightedIndex(-1);
        break;

      case ',':
      case ' ':
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          addEmailChip(suggestions[highlightedIndex]);
        } else if (inputValue.trim()) {
          addEmailChip(inputValue);
        }
        break;

      case 'Backspace':
        if (!inputValue && selectedEmails.length > 0) {
          // Remove last chip when backspace is pressed on empty input
          const lastChip = selectedEmails[selectedEmails.length - 1];
          removeEmailChip(lastChip.id);
          setIsOpen(false);
          setSuggestions([]);
          setHighlightedIndex(-1);
        }
        break;
    }
  };

  // Handle input blur
  const handleInputBlur = () => {
    // Delay closing to allow suggestion clicks to register
    setTimeout(() => {
      // Only add typed email if not clicking on suggestion
      if (inputValue.trim() && !isClickingSuggestion) {
        addEmailChip(inputValue);
      }
      setIsOpen(false);
      setHighlightedIndex(-1);
    }, 200);
  };

  // Handle input focus
  const handleInputFocus = () => {
    if (inputValue) {
      debouncedSearch(inputValue);
      setIsOpen(true);
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Cleanup debounce timeout
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Render email chips
  const renderEmailChips = () => {
    return selectedEmails.map((chip) => (
      <span
        key={chip.id}
        className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium gap-1 ${
          chip.isValid
            ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            : 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
        }`}
      >
        {chip.email}
        <button
          type="button"
          onClick={() => removeEmailChip(chip.id)}
          className="inline-flex items-center p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full transition-colors"
        >
          <HiX className="w-3 h-3" />
        </button>
      </span>
    ));
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <div className="flex flex-wrap items-center gap-1 p-2 border border-gray-300 dark:border-gray-600 rounded-md min-h-[36px] bg-white dark:bg-gray-800 focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
        {renderEmailChips()}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onKeyDown={handleInputKeyPress}
          onBlur={handleInputBlur}
          onFocus={handleInputFocus}
          className="flex-1 min-w-[120px] border-none outline-none bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          placeholder={selectedEmails.length === 0 ? placeholder : ''}
        />
        {loading && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
        )}
        <HiChevronDown className="w-4 h-4 text-gray-400" />
      </div>

      {/* Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          {suggestions.map((email, index) => (
            <div
              key={index}
              onMouseDown={(e) => {
                // Prevent blur event from firing
                e.preventDefault();
              }}
              onClick={() => handleSuggestionClick(email)}
              className={`px-3 py-2 cursor-pointer text-sm transition-colors ${
                index === highlightedIndex
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                  : 'text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {email}
            </div>
          ))}
        </div>
      )}

      {/* No suggestions message */}
      {isOpen && inputValue && !loading && suggestions.length === 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg">
          <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
            No matching emails found
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTypeahead;
