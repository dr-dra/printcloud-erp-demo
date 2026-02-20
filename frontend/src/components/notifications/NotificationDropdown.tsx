'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef } from 'react';
import type { MouseEvent } from 'react';
import { CheckCheck, Trash2, Loader2 } from 'lucide-react';
import { SlBell } from 'react-icons/sl';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/utils/errorHandling';
import { debugLog, debugWarn } from '@/utils/logger';
import NotificationItem from './NotificationItem';
import { Notification } from './types';

interface NotificationDropdownProps {
  className?: string;
}

export default function NotificationDropdown({ className = '' }: NotificationDropdownProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch notifications with auto-expiry filtering
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.get('/reminders/notifications/');
      debugLog(
        '🔔 Notifications fetched:',
        response.data.notifications?.length || 0,
        'total,',
        response.data.unread_count,
        'unread',
      );

      // Filter out notifications older than 24 hours
      const now = new Date();
      const filteredNotifications = response.data.notifications.filter(
        (notification: Notification) => {
          const createdAt = new Date(notification.created_at);
          const hoursOld = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
          return hoursOld < 24; // Keep notifications less than 24 hours old
        },
      );

      setNotifications(filteredNotifications);
      setUnreadCount(response.data.unread_count);
    } catch (err) {
      const axiosError = err as any;

      // Silently fail for network errors or authentication errors
      // These will be handled by the API interceptor (token refresh or redirect to login)
      if (axiosError.message === 'Network Error' || axiosError.response?.status === 401) {
        debugWarn('[Notifications] Silent error - will retry on next poll:', axiosError.message);
        // Don't set error state - just keep existing notifications
        // Don't spam console either - already logged by API interceptor
      } else {
        // For other errors, log but don't show to user
        const errorMessage = getErrorMessage(axiosError);
        debugWarn('Error fetching notifications:', errorMessage);
      }

      // Keep existing notifications instead of clearing them
      // Only clear if this is the first fetch and we have no data
      if (notifications.length === 0) {
        setNotifications([]);
        setUnreadCount(0);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load notifications on component mount
  useEffect(() => {
    fetchNotifications();

    // Set up periodic refresh every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle notification click - navigate to source and mark as read
  const handleNotificationClick = async (notification: Notification) => {
    try {
      // Mark as read if unread
      if (notification.is_unread) {
        await api.post('/reminders/mark_notification_read/', {
          notification_id: notification.id,
        });

        // Update local state
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id
              ? { ...n, is_unread: false, read_at: new Date().toISOString() }
              : n,
          ),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }

      // Navigate to the source entity if link_path is available
      if (notification.reminder.link_path) {
        router.push(notification.reminder.link_path);
      } else if (notification.reminder.entity_type === 'quotation') {
        router.push(`/dashboard/sales/quotations/${notification.reminder.entity_id}`);
      }

      // Keep dropdown open - don't close after navigation
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      console.error('Error marking notification as read:', errorMessage);
      // Don't set global error state for individual notification actions
      // Just log the error - the navigation will still work
    }
  };

  // Handle notification archive
  const handleArchiveNotification = async (notification: Notification, event: MouseEvent) => {
    event.stopPropagation(); // Prevent triggering the notification click

    try {
      // Call API to archive the notification (soft delete)
      await api.post('/reminders/archive_notification/', {
        notification_id: notification.id,
      });

      // Remove from local state (it's now archived)
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));

      // Update unread count if the archived notification was unread
      if (notification.is_unread) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      console.error('Error archiving notification:', errorMessage);
      // Silently fail for archive action - don't break the UI
      // User can try again or refresh notifications
    }
  };

  // Clear all done notifications
  const handleClearDone = async () => {
    try {
      // Call the proper backend endpoint
      const response = await api.post('/reminders/clear_done_notifications/');

      debugLog(`🧹 Archived ${response.data.archived_count} done notifications`);

      // Refresh notifications to reflect changes
      await fetchNotifications();
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      console.error('Error clearing done notifications:', errorMessage);
      // Don't break UI for clear action - user can try again
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await api.post('/reminders/mark_all_read/');

      // Update local state
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          is_unread: false,
          read_at: n.read_at || new Date().toISOString(),
        })),
      );
      setUnreadCount(0);
    } catch (err) {
      const errorMessage = getErrorMessage(err as any);
      console.error('Error marking all as read:', errorMessage);
      // Silently fail for mark all read - user can try again
    }
  };

  // Handle dropdown toggle
  const handleToggle = () => {
    if (!isOpen) {
      fetchNotifications(); // Refresh when opening
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Notification Button - Redesigned */}
      <button
        type="button"
        onClick={handleToggle}
        className="relative p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100/80 dark:text-gray-300 dark:hover:text-gray-100 dark:hover:bg-gray-700/50 focus:outline-none focus:ring-2 focus:ring-amber-500/20 transition-all duration-200"
        aria-label="Notifications"
      >
        <SlBell className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[16px] h-[16px] px-0.5 text-[9px] font-semibold text-white bg-amber-500 rounded-full ring-2 ring-white dark:ring-gray-800">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel - Redesigned */}
      {isOpen && (
        <>
          <div className="absolute right-0 top-full mt-2 w-[380px] sm:w-[400px] overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200/80 dark:border-gray-700/80 z-50 animate-[slideDown_0.2s_ease-out]">
            {/* Header - More Compact & Professional */}
            <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700/60 bg-gradient-to-b from-gray-50/50 to-transparent dark:from-gray-900/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white tracking-tight">
                    Notifications
                  </h3>
                  {unreadCount > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/30 rounded-full">
                      {unreadCount}
                    </span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck className="w-3.5 h-3.5" />
                    <span>Mark all</span>
                  </button>
                )}
              </div>
            </div>

            {/* Scrollable Content */}
            <div
              className="overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent"
              style={{ maxHeight: '480px' }}
            >
              {loading && notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 mx-auto text-gray-400 dark:text-gray-500 animate-spin" />
                  <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 font-medium">
                    Loading notifications...
                  </p>
                </div>
              ) : error ? (
                <div className="px-4 py-12 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                    <SlBell className="w-5 h-5 text-red-600 dark:text-red-400" />
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{error}</p>
                  <button
                    onClick={fetchNotifications}
                    className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    Try again
                  </button>
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 flex items-center justify-center">
                    <SlBell className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    All caught up!
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    No new notifications
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100 dark:divide-gray-700/50">
                  {notifications.map((notification) => (
                    <NotificationItem
                      key={notification.id}
                      notification={notification}
                      onClick={() => handleNotificationClick(notification)}
                      onArchive={(event) => handleArchiveNotification(notification, event)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Footer with clear done button */}
            {notifications.length > 0 &&
              notifications.some((n) => !n.is_unread && (n.reminder.is_overdue || n.read_at)) && (
                <div className="px-4 py-2.5 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-900/20">
                  <div className="flex justify-center">
                    <button
                      onClick={handleClearDone}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Clear completed
                    </button>
                  </div>
                </div>
              )}
          </div>

          {/* Backdrop for visual separation */}
          <div className="fixed inset-0 -z-10" onClick={() => setIsOpen(false)} />
        </>
      )}

      {/* eslint-disable react/no-unknown-property */}
      <style jsx global>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .scrollbar-thin::-webkit-scrollbar {
          width: 6px;
        }

        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #d1d5db;
          border-radius: 3px;
        }

        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background: #4b5563;
        }

        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #9ca3af;
        }

        .dark .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
      {/* eslint-enable react/no-unknown-property */}
    </div>
  );
}
