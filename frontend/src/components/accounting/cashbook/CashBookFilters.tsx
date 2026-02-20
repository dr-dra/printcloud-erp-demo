'use client';

import { Datepicker, Label } from 'flowbite-react';
import { HiOutlineAdjustments, HiSearch } from 'react-icons/hi';

export type CashBookPreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

interface CashBookFiltersProps {
  preset: CashBookPreset;
  onPresetChange: (preset: CashBookPreset) => void;
  startDate: string;
  endDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
}

const presetOptions: { value: CashBookPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom' },
];

const dateToInputValue = (value?: Date | null) => {
  if (!value) {
    return '';
  }
  return value.toISOString().split('T')[0];
};

export default function CashBookFilters({
  preset,
  onPresetChange,
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  search,
  onSearchChange,
}: CashBookFiltersProps) {
  const handleDateChange = (handler: (value: string) => void) => (value: Date | null) => {
    handler(dateToInputValue(value));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            <HiOutlineAdjustments className="h-4 w-4" />
            Filters
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500">Cash Book</span>
        </div>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-700 rounded-lg">
              {presetOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => onPresetChange(option.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                    preset === option.value
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <div className="min-w-[180px]">
                  <Label value="Start Date" className="mb-2" />
                  <Datepicker
                    value={startDate}
                    onSelectedDateChanged={handleDateChange(onStartDateChange)}
                    maxDate={endDate ? new Date(endDate) : undefined}
                  />
                </div>
                <div className="min-w-[180px]">
                  <Label value="End Date" className="mb-2" />
                  <Datepicker
                    value={endDate}
                    onSelectedDateChanged={handleDateChange(onEndDateChange)}
                    minDate={startDate ? new Date(startDate) : undefined}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="relative w-full lg:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
              <HiSearch className="h-4 w-4" />
            </div>
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 dark:focus:border-primary-500 transition-all placeholder:text-gray-400 dark:placeholder:text-gray-500 text-gray-900 dark:text-white"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
