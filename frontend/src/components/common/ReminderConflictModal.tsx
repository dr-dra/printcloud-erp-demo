'use client';

import React from 'react';
import { Alert, Button } from 'flowbite-react';
import { HiInformationCircle, HiClock, HiUser } from 'react-icons/hi';

interface ExistingReminder {
  id: number;
  due_at: string;
  note: string;
  assignee_user: {
    id: number;
    full_name: string;
  };
  status: string;
}

interface ReminderConflictModalProps {
  show: boolean;
  existingReminder: ExistingReminder | null;
  newReminderData: {
    reminderDate: Date;
    reminderTime: string;
    notes: string;
    assigneeUserId: number;
    assigneeUserName?: string;
  };
  loading: boolean;
  onUpdate: () => void;
  onCreateAdditional: () => void;
  onCancel: () => void;
}

export default function ReminderConflictModal({
  show,
  existingReminder,
  newReminderData,
  loading,
  onUpdate,
  onCreateAdditional,
  onCancel,
}: ReminderConflictModalProps) {
  if (!show || !existingReminder) return null;

  const formatDateTime = (dateTimeString: string) => {
    const date = new Date(dateTimeString);
    return {
      date: date.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: date.toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
  };

  const formatNewDateTime = () => {
    return {
      date: newReminderData.reminderDate.toLocaleDateString('en-GB', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }),
      time: newReminderData.reminderTime,
    };
  };

  const existing = formatDateTime(existingReminder.due_at);
  const newReminder = formatNewDateTime();
  const isSameAssignee = existingReminder.assignee_user.id === newReminderData.assigneeUserId;

  return (
    <div className="fixed inset-0 bg-gray-900/50 flex items-center justify-center z-50 p-4">
      <div className="max-w-2xl w-full">
        <Alert
          color="gray"
          icon={HiInformationCircle}
          additionalContent={
            <div className="mt-4 space-y-4">
              <div className="text-sm text-gray-700 dark:text-gray-300">
                A reminder already exists for this quotation. Choose how you'd like to proceed:
              </div>

              {/* Existing Reminder Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-full flex-shrink-0">
                    <HiClock className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      Existing Reminder
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <strong>{existing.date}</strong> at <strong>{existing.time}</strong>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                      <HiUser className="w-4 h-4" />
                      Assigned to:{' '}
                      <span className="font-medium">
                        {existingReminder.assignee_user.full_name}
                      </span>
                    </div>
                    {existingReminder.note && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-2 py-1 border">
                        {existingReminder.note}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* New Reminder Details */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border-2 border-dashed border-gray-300 dark:border-gray-500">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-gray-100 dark:bg-gray-600 rounded-full flex-shrink-0">
                    <HiClock className="w-4 h-4 text-gray-600 dark:text-gray-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">
                      New Reminder
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <strong>{newReminder.date}</strong> at <strong>{newReminder.time}</strong>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-2">
                      <HiUser className="w-4 h-4" />
                      Assigned to:{' '}
                      <span className="font-medium">
                        {newReminderData.assigneeUserName || 'Current User'}
                      </span>
                    </div>
                    {newReminderData.notes && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 rounded px-2 py-1 border">
                        {newReminderData.notes}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-2">
                <Button color="light" onClick={onCancel} disabled={loading} size="sm">
                  Cancel
                </Button>

                {isSameAssignee && (
                  <Button color="dark" onClick={onUpdate} disabled={loading} size="sm">
                    <HiClock className="h-4 w-4 mr-2" />
                    {loading ? 'Updating...' : 'Update Existing'}
                  </Button>
                )}

                {!isSameAssignee && (
                  <Button color="dark" onClick={onCreateAdditional} disabled={loading} size="sm">
                    <HiClock className="h-4 w-4 mr-2" />
                    {loading ? 'Creating...' : 'Create Additional Reminder'}
                  </Button>
                )}
              </div>
            </div>
          }
        >
          <h3 className="text-lg font-medium">Reminder Already Exists</h3>
        </Alert>
      </div>
    </div>
  );
}
