import React, { useEffect } from 'react';
import { Datepicker } from 'flowbite-react';
import { DateRange } from '@/types/dateRange';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  size?: 'sm' | 'md' | 'lg';
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  size = 'md',
}) => {
  // Use useEffect to apply styles directly to DOM elements
  useEffect(() => {
    const applyCompactStyles = () => {
      // Only target the calendar popup, not the input fields
      // Look for elements that are likely to be the calendar popup
      const calendarPopups = document.querySelectorAll(
        'div[class*="absolute"][class*="z-"][class*="bg-white"] table, div[class*="absolute"][class*="shadow"] table',
      );

      calendarPopups.forEach((table) => {
        // Find the parent container (the popup)
        const popup = table.closest('div[class*="absolute"]') as HTMLElement;
        if (popup) {
          popup.style.fontSize = '0.75rem';
          popup.style.padding = '0.5rem';

          // Apply styles to all children of the popup
          const allChildren = popup.querySelectorAll('*');
          allChildren.forEach((child) => {
            const childElement = child as HTMLElement;

            // Skip input elements to avoid overlap issues
            if (child.tagName === 'INPUT') {
              return;
            }

            childElement.style.fontSize = '0.75rem';

            // Reduce padding for different types of elements
            if (child.tagName === 'TD' || child.tagName === 'TH') {
              childElement.style.padding = '0.25rem';
            } else if (child.tagName === 'BUTTON') {
              childElement.style.padding = '0.25rem 0.5rem';
              childElement.style.margin = '0.125rem';
            } else if (
              childElement.classList.contains('p-2') ||
              childElement.classList.contains('p-3') ||
              childElement.classList.contains('p-4')
            ) {
              childElement.style.padding = '0.5rem';
            } else if (
              childElement.classList.contains('m-2') ||
              childElement.classList.contains('m-3') ||
              childElement.classList.contains('m-4')
            ) {
              childElement.style.margin = '0.25rem';
            }
          });
        }
      });
    };

    // Apply styles immediately and also set up a mutation observer for dynamic content
    applyCompactStyles();

    const observer = new MutationObserver(applyCompactStyles);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);
  const handleStartDateChange = (date: Date | null) => {
    onChange({
      ...value,
      startDate: date,
    });
  };

  const handleEndDateChange = (date: Date | null) => {
    onChange({
      ...value,
      endDate: date,
    });
  };

  // Determine gap and clear button classes based on size
  const gapClass = size === 'sm' ? 'gap-1.5' : 'gap-2';
  const clearButtonClass =
    size === 'sm'
      ? 'px-2 py-1 text-xs font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white'
      : 'px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-600 dark:hover:text-white';

  return (
    <div className={`flex items-center ${gapClass} compact-datepicker`}>
      <div className="datepicker-wrapper">
        <Datepicker
          value={value.startDate?.toISOString().split('T')[0] || ''}
          onSelectedDateChanged={handleStartDateChange}
          placeholder="Start date"
          autoHide={true}
          maxDate={value.endDate || undefined}
          sizing={size}
        />
      </div>
      <span className={`text-gray-500 ${size === 'sm' ? 'text-xs' : 'text-sm'}`}>to</span>
      <div className="datepicker-wrapper">
        <Datepicker
          value={value.endDate?.toISOString().split('T')[0] || ''}
          onSelectedDateChanged={handleEndDateChange}
          placeholder="End date"
          autoHide={true}
          minDate={value.startDate || undefined}
          sizing={size}
        />
      </div>
      {(value.startDate || value.endDate) && (
        <button
          onClick={() => onChange({ startDate: null, endDate: null })}
          className={clearButtonClass}
        >
          Clear
        </button>
      )}
    </div>
  );
};
