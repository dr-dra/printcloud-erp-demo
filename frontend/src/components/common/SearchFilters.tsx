import React from 'react';
import { Datepicker } from 'flowbite-react';

interface SearchFiltersProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  startDate: Date | null;
  endDate: Date | null;
  onStartDateChange: (date: Date | null) => void;
  onEndDateChange: (date: Date | null) => void;
  searchPlaceholder?: string;
  searchWidth?: string;
}

export default function SearchFilters({
  searchValue,
  onSearchChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  searchPlaceholder = 'Search...',
  searchWidth = 'w-[35%]',
}: SearchFiltersProps) {
  return (
    <div className="flex items-center gap-4">
      <div className={`${searchWidth} min-w-[200px]`}>
        <input
          type="text"
          value={searchValue}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
        />
      </div>
      <div className="flex items-center gap-2">
        <Datepicker
          value={startDate?.toISOString().split('T')[0] || ''}
          onSelectedDateChanged={onStartDateChange}
          placeholder="Start Date"
          className="w-40"
        />
        <span className="text-gray-500">to</span>
        <Datepicker
          value={endDate?.toISOString().split('T')[0] || ''}
          onSelectedDateChanged={onEndDateChange}
          placeholder="End Date"
          className="w-40"
        />
      </div>
    </div>
  );
}
