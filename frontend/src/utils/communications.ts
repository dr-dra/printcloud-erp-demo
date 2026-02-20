import { Mail, MessageCircle, Printer } from 'lucide-react';
import type { CommunicationMethod } from '@/types/communications';

/**
 * Format a date to relative time (e.g., "2 hours ago", "yesterday", "3 days ago")
 */
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  // Less than a minute
  if (diffInSeconds < 60) {
    return 'just now';
  }

  // Less than an hour
  if (diffInSeconds < 3600) {
    const minutes = Math.floor(diffInSeconds / 60);
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }

  // Less than 24 hours (today)
  if (diffInSeconds < 86400) {
    const hours = Math.floor(diffInSeconds / 3600);
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }

  // Yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  ) {
    return 'yesterday';
  }

  // Within the last week
  if (diffInSeconds < 604800) {
    const days = Math.floor(diffInSeconds / 86400);
    return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  }

  // More than a week - just show days
  const days = Math.floor(diffInSeconds / 86400);
  return `${days} days ago`;
}

/**
 * Format a date to display format (e.g., "20/12/25 02:05pm")
 */
export function formatDisplayDate(dateString: string): string {
  const date = new Date(dateString);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = String(date.getFullYear()).slice(-2);

  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'pm' : 'am';
  hours = hours % 12 || 12;

  return `${day}/${month}/${year} ${hours}:${minutes}${ampm}`;
}

/**
 * Get icon component for communication method
 */
export function getCommunicationIcon(method: CommunicationMethod) {
  switch (method) {
    case 'email':
      return Mail;
    case 'whatsapp':
      return MessageCircle;
    case 'print':
      return Printer;
    default:
      return Mail;
  }
}

/**
 * Get display label for communication method
 */
export function getCommunicationMethodLabel(method: CommunicationMethod): string {
  switch (method) {
    case 'email':
      return 'Email';
    case 'whatsapp':
      return 'WhatsApp';
    case 'print':
      return 'Print';
    default:
      return method;
  }
}

/**
 * Get color class for communication method
 */
export function getCommunicationMethodColor(method: CommunicationMethod): string {
  switch (method) {
    case 'email':
      return 'text-blue-600 dark:text-blue-400';
    case 'whatsapp':
      return 'text-green-600 dark:text-green-400';
    case 'print':
      return 'text-purple-600 dark:text-purple-400';
    default:
      return 'text-gray-600 dark:text-gray-400';
  }
}
