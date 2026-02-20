'use client';

import React from 'react';
import { FileText, Clock, AlertCircle, Bell, X } from 'lucide-react';
import { Notification } from './types';

interface NotificationItemProps {
  notification: Notification;
  onClick: () => void;
  onArchive: (event: React.MouseEvent) => void;
}

export default function NotificationItem({
  notification,
  onClick,
  onArchive,
}: NotificationItemProps) {
  const { reminder, is_unread, time_since_created, read_at } = notification;

  // Helper to format project name more compactly
  const formatProjectName = (note: string) => {
    // Extract project name before " for " if it exists
    const forIndex = note.indexOf(' for ');
    if (forIndex === -1) return note;

    const projectPart = note.substring(0, forIndex);
    const customerPart = note.substring(forIndex + 5); // +5 for " for "

    // Make size specifications smaller
    const formattedProject = projectPart.replace(
      /\b(A4|A5|A3|B4|B5)\b.*?(\([^)]*\))/gi,
      (match, size, dimensions) => {
        return `<span class="text-xs text-gray-500 dark:text-gray-600">${size} ${dimensions}</span>`;
      },
    );

    return `${formattedProject} for ${customerPart}`;
  };

  // Check if notification was attended (clicked and marked as read)
  const isAttended = !is_unread && read_at;

  // Get icon based on entity type with modern styling
  const getEntityIcon = () => {
    const iconClasses = 'w-4 h-4';
    const containerClasses = 'p-1.5 rounded-lg';

    switch (reminder.entity_type) {
      case 'quotation':
        return (
          <div className={`${containerClasses} bg-blue-100 dark:bg-blue-900/30`}>
            <FileText
              className={`${iconClasses} text-blue-600 dark:text-blue-400`}
              strokeWidth={2}
            />
          </div>
        );
      case 'job_ticket':
        return (
          <div className={`${containerClasses} bg-emerald-100 dark:bg-emerald-900/30`}>
            <Clock
              className={`${iconClasses} text-emerald-600 dark:text-emerald-400`}
              strokeWidth={2}
            />
          </div>
        );
      case 'customer':
        return (
          <div className={`${containerClasses} bg-purple-100 dark:bg-purple-900/30`}>
            <AlertCircle
              className={`${iconClasses} text-purple-600 dark:text-purple-400`}
              strokeWidth={2}
            />
          </div>
        );
      default:
        return (
          <div className={`${containerClasses} bg-gray-100 dark:bg-gray-700/50`}>
            <Bell className={`${iconClasses} text-gray-600 dark:text-gray-400`} strokeWidth={2} />
          </div>
        );
    }
  };

  // Get status styling with attendance consideration
  const getStatusStyling = () => {
    if (isAttended && reminder.is_overdue) {
      return {
        bgColor: 'bg-green-50 dark:bg-green-900/20',
        borderColor: 'border-l-green-500',
        textColor: 'text-green-600 dark:text-green-400',
        statusText: 'Done',
      };
    } else if (reminder.is_overdue) {
      return {
        bgColor: 'bg-red-50 dark:bg-red-900/20',
        borderColor: 'border-l-red-500',
        textColor: 'text-red-600 dark:text-red-400',
        statusText: null,
      };
    } else if (reminder.is_due_today) {
      return {
        bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
        borderColor: 'border-l-yellow-500',
        textColor: 'text-yellow-600 dark:text-yellow-400',
        statusText: null,
      };
    } else {
      return {
        bgColor: 'bg-blue-50 dark:bg-blue-900/20',
        borderColor: 'border-l-blue-500',
        textColor: 'text-blue-600 dark:text-blue-400',
        statusText: null,
      };
    }
  };

  // Format due date with attendance consideration
  const formatDueDate = () => {
    const dueDate = new Date(reminder.due_at);
    const now = new Date();

    if (isAttended && reminder.is_overdue) {
      return 'Done';
    } else if (reminder.is_overdue) {
      const daysDiff = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff === 0 ? 'Overdue' : `Overdue • ${daysDiff}d`;
    } else if (reminder.is_due_today) {
      return `Due ${dueDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    } else {
      return `Due ${dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
  };

  const statusStyling = getStatusStyling();

  return (
    <div
      className={`px-3.5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/40 transition-all duration-200 group cursor-pointer relative ${
        is_unread
          ? 'bg-gradient-to-r from-amber-50/60 via-amber-50/30 to-transparent dark:from-amber-900/10 dark:via-amber-900/5 dark:to-transparent'
          : 'opacity-80'
      }`}
      onClick={onClick}
    >
      {/* Unread indicator bar */}
      {is_unread && (
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-amber-500 to-orange-500 rounded-r-full" />
      )}

      <div className="flex items-start gap-3">
        {/* Entity Icon */}
        <div className="flex-shrink-0">{getEntityIcon()}</div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Title Row with status */}
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="flex items-center gap-2 min-w-0">
              <p
                className={`text-[13px] font-semibold truncate ${
                  is_unread ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                }`}
              >
                {reminder.entity_ref}
              </p>
              {is_unread && <div className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />}
            </div>
            <span
              className={`inline-flex items-center px-2 py-0.5 text-[10px] font-bold rounded-full ${statusStyling.textColor} ${statusStyling.bgColor} whitespace-nowrap`}
            >
              {formatDueDate()}
            </span>
          </div>

          {/* Notes with formatted project name */}
          {reminder.note && (
            <div
              className={`text-[11px] leading-relaxed line-clamp-1 pr-6 ${
                is_unread ? 'text-gray-600 dark:text-gray-400' : 'text-gray-500 dark:text-gray-500'
              }`}
              dangerouslySetInnerHTML={{ __html: formatProjectName(reminder.note) }}
            />
          )}

          {/* Compact timestamp */}
          <div className="mt-1">
            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">
              {time_since_created}
            </span>
          </div>
        </div>

        {/* Archive button - appears on hover */}
        <div className="flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onArchive(e);
            }}
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 opacity-0 group-hover:opacity-100"
            title="Archive notification"
          >
            <X className="w-3.5 h-3.5" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
