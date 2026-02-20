'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect } from 'react';
import { Modal, Button, Datepicker, Select, Label } from 'flowbite-react';
import { HiClock, HiCalendar, HiUser } from 'react-icons/hi';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { User } from '@/components/notifications/types';
import { toast } from 'sonner';

interface ReminderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSetReminder: (reminderData: {
    reminderDate: Date;
    reminderTime: string;
    notes: string;
    assigneeUserId: number;
    autoCancelStates: string[];
  }) => void;
  title?: string;
  context?: string; // e.g., "Quotation #12345"
  quotationData?: {
    id?: number;
    quot_number: string;
    customer?: {
      name: string;
    };
    items?: Array<{
      item?: string;
    }>;
  };
}

interface QuickAction {
  label: string;
  days: number;
  color: 'gray' | 'blue' | 'green' | 'yellow' | 'red';
}

const quickActions: QuickAction[] = [
  { label: '1 Day', days: 1, color: 'blue' },
  { label: '3 Days', days: 3, color: 'green' },
  { label: '7 Days', days: 7, color: 'yellow' },
  { label: '2 Weeks', days: 14, color: 'gray' },
];

export const ReminderModal: React.FC<ReminderModalProps> = ({
  isOpen,
  onClose,
  onSetReminder,
  title = 'Set Reminder',
  context,
  quotationData,
}) => {
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [selectedQuickAction, setSelectedQuickAction] = useState<number | null>(null);
  const [notes, setNotes] = useState<string>('');
  const [assigneeUserId, setAssigneeUserId] = useState<number | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [isSettingReminder, setIsSettingReminder] = useState(false);

  // Fetch available users for assignment
  const fetchAvailableUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await api.get('/reminders/assignable_users/');
      setAvailableUsers(response.data);
    } catch (err) {
      console.error('Error fetching available users:', getErrorMessage(err as any));
      setAvailableUsers([]);
      toast.error('Failed to load users', {
        description: 'Unable to fetch available users for assignment',
        duration: 4000,
      });
    } finally {
      setLoadingUsers(false);
    }
  };

  // Fetch current user info
  const fetchCurrentUser = async () => {
    try {
      const response = await api.get('/reminders/current_user/');
      const user = response.data;
      setAssigneeUserId(user.id); // Set as default assignee
    } catch (err) {
      console.error('Error fetching current user:', getErrorMessage(err as any));
      toast.error('Failed to load user info', {
        description: 'Unable to fetch current user information',
        duration: 4000,
      });
    }
  };

  // Auto-generate note when modal opens with quotation data
  useEffect(() => {
    if (isOpen && quotationData) {
      const generatedNote = generateFollowUpNote(quotationData);
      setNotes(generatedNote);
    }
  }, [isOpen, quotationData]);

  // Fetch users and current user when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchAvailableUsers();
      fetchCurrentUser();
    }
  }, [isOpen]);

  // Reset state when modal opens/closes (but don't reset assignee as it will be set by fetchCurrentUser)
  useEffect(() => {
    if (isOpen) {
      setSelectedDate(null);
      setSelectedTime('09:00');
      setSelectedQuickAction(null);
      // Don't reset assigneeUserId here as fetchCurrentUser will set it
      // Don't reset notes here as we want to keep the auto-generated note
    }
  }, [isOpen]);

  // Handle quick action button click
  const handleQuickAction = (days: number, index: number) => {
    const reminderDate = new Date();
    reminderDate.setDate(reminderDate.getDate() + days);

    setSelectedDate(reminderDate);
    setSelectedQuickAction(index);
  };

  // Handle custom date selection
  const handleCustomDateChange = (date: Date | null) => {
    if (date && date instanceof Date && !isNaN(date.getTime())) {
      setSelectedDate(date);
    } else if (date && typeof date === 'string') {
      const parsedDate = new Date(date);
      if (!isNaN(parsedDate.getTime())) {
        setSelectedDate(parsedDate);
      } else {
        setSelectedDate(null);
      }
    } else {
      setSelectedDate(null);
    }

    setSelectedQuickAction(null);
  };

  // Handle time change
  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedTime(e.target.value);
  };

  // Handle set reminder
  const handleSetReminder = async () => {
    if (!selectedDate || !assigneeUserId || !quotationData?.id) {
      toast.error('Missing Information', {
        description: 'Please select a date and assignee.',
        duration: 4000,
      });
      return;
    }

    try {
      setIsSettingReminder(true);

      onSetReminder({
        reminderDate: selectedDate,
        reminderTime: selectedTime,
        notes: notes,
        assigneeUserId: assigneeUserId,
        autoCancelStates: ['completed', 'cancelled', 'expired'],
      });

      onClose();
    } catch (error: any) {
      console.error('Error setting reminder:', error);
      toast.error('Failed to set reminder', {
        description: 'Please try again.',
        duration: 4000,
      });
    } finally {
      setIsSettingReminder(false);
    }
  };

  // Generate follow-up note based on quotation data
  const generateFollowUpNote = (quotation: ReminderModalProps['quotationData']) => {
    if (!quotation) return '';

    const customerName = quotation.customer?.name || '';

    // Generate project name from items (similar to formatProjectDescription logic)
    let projectName = 'Project';
    if (quotation.items && quotation.items.length > 0) {
      const itemNames = quotation.items
        .slice(0, 3)
        .map((item) => item.item)
        .filter(
          (name): name is string => name !== undefined && name !== null && name.trim() !== '',
        );

      if (itemNames.length > 0) {
        // Remove duplicates while preserving order
        const uniqueNames: string[] = [];
        for (const name of itemNames) {
          if (!uniqueNames.includes(name)) {
            uniqueNames.push(name);
          }
        }

        if (uniqueNames.length <= 2) {
          projectName = uniqueNames.join(' & ');
        } else {
          projectName = uniqueNames.slice(0, 2).join(', ') + ' & ' + uniqueNames[2];
        }
      }
    }

    return `${projectName} for ${customerName}`;
  };

  // Format date for display
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-GB', {
      weekday: 'short',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  // Format date for input (timezone-safe)
  const formatDateForInput = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Check if reminder can be set
  const canSetReminder =
    selectedDate !== null && assigneeUserId !== null && quotationData?.id !== null;

  return (
    <Modal show={isOpen} onClose={onClose} size="2xl" className="bg-gray-900/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center gap-2">
            <HiClock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-lg font-medium">{title}</span>
            {context && (
              <span className="text-sm text-gray-500 dark:text-gray-400">for {context}</span>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="space-y-4">
            {/* Date and Time Labels */}
            <div className="grid grid-cols-2 gap-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Date
              </label>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Time
              </label>
            </div>

            {/* Date and Time Controls */}
            <div className="grid grid-cols-2 gap-4 -mt-2">
              <div className="relative">
                <Datepicker
                  value={selectedDate ? formatDateForInput(selectedDate) : ''}
                  onSelectedDateChanged={handleCustomDateChange}
                  placeholder="Select reminder date"
                  autoHide={true}
                  minDate={new Date()}
                  sizing="sm"
                  icon={HiCalendar}
                />
              </div>
              <input
                type="time"
                value={selectedTime}
                onChange={handleTimeChange}
                className="text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 h-9 px-3 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              />
            </div>

            {/* Quick Actions */}
            <div className="pt-2">
              <div className="grid grid-cols-4 gap-2">
                {quickActions.map((action, index) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.days, index)}
                    className={`px-2 py-1 text-xs font-medium rounded-full border transition-all ${
                      selectedQuickAction === index
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                        : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Assignee Selection */}
            <div className="pt-4">
              <Label htmlFor="assignee" className="mb-2">
                <HiUser className="w-4 h-4 inline mr-1" />
                Assign to
              </Label>
              <Select
                id="assignee"
                value={assigneeUserId || ''}
                onChange={(e) => setAssigneeUserId(Number(e.target.value) || null)}
                disabled={loadingUsers}
              >
                {availableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.full_name}
                  </option>
                ))}
              </Select>
            </div>

            {/* Notes Section */}
            <div className="pt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional notes for this reminder..."
                rows={3}
                className="w-full text-sm bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Reminder Summary - Cleaner Design */}
          {selectedDate && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full">
                    <HiClock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-blue-800 dark:text-blue-200">
                      <span className="text-sm font-semibold">
                        {formatDate(selectedDate)} at {selectedTime}
                      </span>
                      {selectedQuickAction !== null && (
                        <span className="text-xs bg-blue-200 dark:text-blue-700 text-blue-700 dark:text-blue-200 px-2 py-1 rounded-full">
                          {quickActions[selectedQuickAction].label}
                        </span>
                      )}
                    </div>
                    {notes && (
                      <div className="text-xs text-blue-600 dark:text-blue-300 mt-1 max-w-xs truncate">
                        {notes}
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={handleSetReminder}
                  disabled={!canSetReminder || isSettingReminder}
                  className="px-6 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSettingReminder ? 'Setting Reminder...' : 'Set Reminder'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 dark:border-gray-800 px-6 py-4 bg-white dark:bg-gray-800">
          <div className="flex justify-end gap-3 w-full">
            <Button color="gray" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
