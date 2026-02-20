'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Dropdown, ToggleSwitch } from 'flowbite-react';
import { HiMenu, HiLogout, HiCog, HiOutlineRefresh } from 'react-icons/hi';
import { SlPrinter } from 'react-icons/sl';
import NotificationDropdown from '@/components/notifications/NotificationDropdown';
import type { User } from '@/context/AuthContext';
import type { PrintCloudPrinter } from '@/hooks/usePrintCloudClient';

interface PrinterDefaults {
  a4: string;
  a5: string;
  pos: string;
}

type PrinterStatus = 'online' | 'offline' | 'busy' | 'error' | 'unknown' | 'not_set';
type FetchPrintersOptions = { forceRefresh?: boolean };

interface TopNavBarProps {
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
  logoSrc: string;
  user: User | null;
  getDisplayName: () => string;
  avatarUrl: string;
  handleImageError: () => void;
  theme: string | undefined;
  toggleTheme: () => void;
  handleLogout: () => void;
  rawPrinters: PrintCloudPrinter[];
  printersLoading: boolean;
  printersError: string | null;
  clientsOnline: number;
  fetchPrinters: (options?: FetchPrintersOptions) => Promise<PrintCloudPrinter[]>;
  printerDefaults: PrinterDefaults;
  getPrinterStatus: (name: string, type: 'standard' | 'pos') => PrinterStatus;
  getStatusTone: (status: PrinterStatus) => string;
  getStatusLabel: (status: PrinterStatus) => string;
  overallPrinterStatus: PrinterStatus;
}

export const TopNavBar: React.FC<TopNavBarProps> = ({
  sidebarOpen: _sidebarOpen,
  onToggleSidebar,
  logoSrc,
  user,
  getDisplayName,
  avatarUrl,
  handleImageError,
  theme,
  toggleTheme,
  handleLogout,
  rawPrinters: _rawPrinters,
  printersLoading,
  printersError,
  clientsOnline,
  fetchPrinters,
  printerDefaults,
  getPrinterStatus,
  getStatusTone,
  getStatusLabel,
  overallPrinterStatus,
}) => {
  const printerStatusItems = [
    {
      label: 'A4 Printer',
      name: printerDefaults.a4,
      type: 'standard' as const,
    },
    {
      label: 'A5 Printer',
      name: printerDefaults.a5,
      type: 'standard' as const,
    },
    {
      label: 'POS Printer',
      name: printerDefaults.pos,
      type: 'pos' as const,
    },
  ];

  return (
    <nav className="fixed top-0 z-50 w-full bg-white border-b border-gray-200 dark:bg-gray-800 dark:border-gray-700">
      <div className="px-3 py-3 lg:px-5 lg:pl-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center justify-start">
            {/* Mobile menu button */}
            <button
              onClick={onToggleSidebar}
              className="inline-flex items-center p-2 text-sm text-gray-500 rounded-lg lg:hidden hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-200 dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600"
            >
              <HiMenu className="w-6 h-6" />
            </button>

            {/* Logo */}
            <Link href="/dashboard" className="flex ml-2 md:mr-24">
              <Image
                src={logoSrc}
                alt="KandyOffset Logo"
                width={120}
                height={32}
                priority
                className="h-6 w-auto"
              />
            </Link>
          </div>

          {/* Right side items */}
          <div className="flex items-center">
            {/* Notification Bell */}
            <NotificationDropdown />

            {/* Printer Status */}
            <div className="ml-[15px]">
              <Dropdown
                label={
                  <div className="relative flex items-center text-gray-600 dark:text-gray-300">
                    <SlPrinter className="h-5 w-5" />
                    <span
                      className={`absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${getStatusTone(
                        overallPrinterStatus,
                      )}`}
                    />
                  </div>
                }
                arrowIcon={false}
                inline
              >
                <Dropdown.Header>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span className="block text-sm">Printer Status</span>
                      <span className="block text-xs text-gray-500">
                        {printersLoading
                          ? 'Refreshing...'
                          : printersError
                            ? 'Status unavailable'
                            : clientsOnline === 0
                              ? 'No client online'
                              : 'Live from PrintCloudClient'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => fetchPrinters({ forceRefresh: true })}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700"
                      aria-label="Refresh printers"
                    >
                      <HiOutlineRefresh
                        className={`h-4 w-4 ${printersLoading ? 'animate-spin' : ''}`}
                      />
                    </button>
                  </div>
                </Dropdown.Header>
                <div className="px-4 py-2 space-y-2">
                  {printerStatusItems.map((item) => {
                    const status = getPrinterStatus(item.name, item.type);
                    return (
                      <div key={item.label} className="flex items-center justify-between text-sm">
                        <div className="flex items-start gap-2">
                          <span
                            className={`mt-1 h-2.5 w-2.5 rounded-full ${getStatusTone(status)}`}
                          />
                          <div className="flex flex-col">
                            <span className="text-gray-700 dark:text-gray-200">{item.label}</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {item.name || 'Not configured'}
                            </span>
                          </div>
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {getStatusLabel(status)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <Dropdown.Divider />
                <Dropdown.Item href="/dashboard/profile">Manage print settings</Dropdown.Item>
              </Dropdown>
            </div>

            {/* User Avatar with Dropdown */}
            <div className="ml-[30px]">
              <Dropdown
                label={
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={avatarUrl}
                      alt="User avatar"
                      className="w-8 h-8 rounded-full object-cover border-2 border-white dark:border-gray-600"
                      onError={handleImageError}
                    />
                  </>
                }
                arrowIcon={false}
                inline
              >
                <Dropdown.Header>
                  <span className="block text-sm">{getDisplayName()}</span>
                  <span className="block truncate text-sm font-medium">{user?.email}</span>
                </Dropdown.Header>
                <Dropdown.Item href="/dashboard/profile">
                  <HiCog className="mr-2 h-4 w-4" />
                  Settings
                </Dropdown.Item>
                <div className="px-4 py-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
                    </span>
                    <ToggleSwitch checked={theme === 'dark'} onChange={toggleTheme} />
                  </div>
                </div>
                <Dropdown.Divider />
                <Dropdown.Item onClick={handleLogout}>
                  <HiLogout className="mr-2 h-4 w-4" />
                  Sign out
                </Dropdown.Item>
              </Dropdown>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};
