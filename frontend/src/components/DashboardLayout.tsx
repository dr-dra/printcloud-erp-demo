'use client';

import { useState, useEffect, useMemo, ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import {
  SlSpeedometer,
  SlCalculator,
  SlNote,
  SlBasket,
  SlDocs,
  SlPeople,
  SlCreditCard,
  SlNotebook,
  SlPicture,
  SlLayers,
  SlPrinter,
  SlWrench,
  SlPuzzle,
  SlGrid,
  SlBag,
  SlArrowDown,
  SlShuffle,
  SlChart,
  SlWallet,
  SlBookOpen,
  SlCalender,
  SlGraph,
} from 'react-icons/sl';
import { LayoutDashboard, ShoppingCart, Calculator, Factory, Package } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useProfilePicture } from '@/hooks/useProfilePicture';
import { usePrintCloudClient } from '@/hooks/usePrintCloudClient';
import { useTheme } from 'next-themes';
import { Toaster } from 'sonner';
import { api } from '@/lib/api';
import { BugReportModal } from '@/components/bug-report/BugReportModal';
import { captureBugReportScreenshot } from '@/utils/bugReportCapture';
import {
  IconRail,
  ExpandablePanel,
  TopNavBar,
  MobileSidebar,
  ModuleConfig,
  NavSection,
  SidebarBehavior,
} from './layout';

interface DashboardLayoutProps {
  children: ReactNode;
}

interface PrinterDefaults {
  a4: string;
  a5: string;
  pos: string;
}

const buildNavigationSections = (posHref: string): NavSection[] => [
  {
    title: 'Overview',
    items: [
      {
        name: 'Dashboard',
        href: '/dashboard',
        icon: SlSpeedometer,
      },
    ],
  },
  {
    title: 'Sales',
    items: [
      {
        name: 'Costing Sheets',
        href: '/dashboard/sales/costing',
        icon: SlCalculator,
      },
      {
        name: 'Quotations',
        href: '/dashboard/sales/quotations',
        icon: SlNote,
      },
      {
        name: 'Orders',
        href: '/dashboard/sales/orders',
        icon: SlBasket,
      },
      {
        name: 'Invoices',
        href: '/dashboard/sales/invoices',
        icon: SlDocs,
      },
      {
        name: 'Finish Goods',
        href: '/dashboard/inventory/stock-items',
        icon: SlPuzzle,
      },
      {
        name: 'Customers',
        href: '/dashboard/sales/customers',
        icon: SlPeople,
      },
      { name: 'POS', href: posHref, icon: SlCreditCard },
    ],
  },
  {
    title: 'Accounting',
    items: [
      {
        name: 'Chart of Accounts',
        href: '/dashboard/accounting/chart-of-accounts',
        icon: SlBookOpen,
      },
      {
        name: 'Journal Entries',
        href: '/dashboard/accounting/journal-entries',
        icon: SlNote,
      },
      {
        name: 'Credit Notes',
        href: '/dashboard/accounting/credit-notes',
        icon: SlDocs,
      },
      {
        name: 'Cash',
        href: '/dashboard/accounting/cash',
        icon: SlWallet,
      },
      {
        name: 'Fiscal Periods',
        href: '/dashboard/accounting/fiscal-periods',
        icon: SlCalender,
      },
      {
        name: 'Suppliers',
        href: '/dashboard/suppliers',
        icon: SlPeople,
      },
      {
        name: 'Supplier Bills',
        href: '/dashboard/purchases/bills',
        icon: SlNotebook,
      },
      {
        name: 'Reports',
        href: '/dashboard/accounting/reports',
        icon: SlGraph,
      },
    ],
  },
  {
    title: 'Production',
    items: [
      {
        name: 'Job Cards',
        href: '/dashboard/production/job-cards',
        icon: SlNotebook,
      },
      {
        name: 'Pre-Press',
        href: '/dashboard/production/pre-press',
        icon: SlPicture,
      },
      { name: 'CTP', href: '/dashboard/production/ctp', icon: SlLayers },
      { name: 'Press', href: '/dashboard/production/press', icon: SlPrinter },
      {
        name: 'Post-Press',
        href: '/dashboard/production/post-press',
        icon: SlWrench,
      },
    ],
  },
  {
    title: 'Inventory',
    items: [
      {
        name: 'Main Stock',
        href: '/dashboard/inventory/main-stock',
        icon: SlGrid,
      },
      {
        name: 'Stock Position',
        href: '/dashboard/inventory/stock-position',
        icon: SlLayers,
      },
      {
        name: 'PRNs',
        href: '/dashboard/inventory/prns',
        icon: SlNote,
      },
      {
        name: 'Purchase Orders',
        href: '/dashboard/inventory/purchase-orders',
        icon: SlBag,
      },
      {
        name: 'Goods Issue',
        href: '/dashboard/inventory/gins',
        icon: SlBasket,
      },
      {
        name: 'Goods Received',
        href: '/dashboard/inventory/grns',
        icon: SlArrowDown,
      },
      {
        name: 'Usage Reports',
        href: '/dashboard/inventory/usage-reports',
        icon: SlNotebook,
      },
      {
        name: 'Stock Adjustments',
        href: '/dashboard/inventory/adjustments',
        icon: SlWallet,
      },
      {
        name: 'Dispatch Notes',
        href: '/dashboard/inventory/dispatch-notes',
        icon: SlDocs,
      },
      {
        name: 'Stock Movements',
        href: '/dashboard/inventory/stock-movements',
        icon: SlShuffle,
      },
      {
        name: 'Suppliers',
        href: '/dashboard/inventory/suppliers',
        icon: SlPeople,
      },
      {
        name: 'Reports',
        href: '/dashboard/inventory/reports',
        icon: SlChart,
      },
    ],
  },
];

const buildModuleConfigs = (sections: NavSection[]): ModuleConfig[] => [
  {
    name: 'Overview',
    icon: LayoutDashboard,
    sections: [sections[0]],
  },
  {
    name: 'Sales',
    icon: ShoppingCart,
    sections: [sections[1]],
  },
  {
    name: 'Accounting',
    icon: Calculator,
    sections: [sections[2]],
  },
  {
    name: 'Production',
    icon: Factory,
    sections: [sections[3]],
  },
  {
    name: 'Inventory',
    icon: Package,
    sections: [sections[4]],
  },
];

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bugReportOpen, setBugReportOpen] = useState(false);
  const [bugReportScreenshot, setBugReportScreenshot] = useState<File | null>(null);
  const [bugReportCapturing, setBugReportCapturing] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  const [sidebarBehavior, setSidebarBehavior] = useState<SidebarBehavior>('overlay');
  const [isPinned, setIsPinned] = useState(false);
  const [pinnedModule, setPinnedModule] = useState<string | null>(null);

  const { user, logout, refreshUserData } = useAuth();
  const { handleImageError, getProfilePictureUrlWithFallback } = useProfilePicture();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const {
    rawPrinters,
    loading: printersLoading,
    error: printersError,
    fetchPrinters,
    clientsOnline,
  } = usePrintCloudClient();
  const [printerDefaults, setPrinterDefaults] = useState<PrinterDefaults>({
    a4: '',
    a5: '',
    pos: '',
  });
  const posHref = useMemo(() => {
    if (!user?.role) return '/dashboard/sales/pos';
    return ['admin', 'accounting', 'cashier'].includes(user.role)
      ? '/dashboard/sales/pos/accounting'
      : '/dashboard/sales/pos';
  }, [user?.role]);
  const navigationSections = useMemo(() => buildNavigationSections(posHref), [posHref]);
  const moduleConfigs = useMemo(() => buildModuleConfigs(navigationSections), [navigationSections]);
  const handleReportIssue = async () => {
    if (bugReportCapturing) return;
    setBugReportCapturing(true);
    const { file } = await captureBugReportScreenshot();
    setBugReportScreenshot(file);
    setBugReportOpen(true);
    setBugReportCapturing(false);
  };

  // Fix hydration mismatch by ensuring component is mounted
  useEffect(() => {
    setMounted(true);

    // Load pinned state from localStorage
    try {
      const savedPinnedModule = localStorage.getItem('sidebar_pinned_module');
      if (savedPinnedModule) {
        setPinnedModule(savedPinnedModule);
        setExpandedModule(savedPinnedModule);
        setIsPinned(true);
      }
    } catch (error) {
      console.error('Failed to load pinned state:', error);
    }
  }, []);

  // Ensure user data (including profile_picture and sidebar_behavior) is fresh on mount and on route changes
  useEffect(() => {
    refreshUserData().catch(() => {});
  }, [pathname]);

  // Restore pinned module state after navigation
  useEffect(() => {
    if (pinnedModule && isPinned) {
      setExpandedModule(pinnedModule);
    }
  }, [pathname, pinnedModule, isPinned]);

  // Global keyboard shortcuts for sidebar
  useEffect(() => {
    const handleGlobalKeyboard = (e: KeyboardEvent) => {
      // Only trigger if Ctrl+Shift is pressed (or Cmd+Shift on Mac)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
        // Prevent default browser behavior
        const key = e.key.toLowerCase();
        let targetModule: string | null = null;

        switch (key) {
          case 'o': // Ctrl+Shift+O for Overview
            targetModule = 'Overview';
            break;
          case 's': // Ctrl+Shift+S for Sales
            targetModule = 'Sales';
            break;
          case 'a': // Ctrl+Shift+A for Accounting
            targetModule = 'Accounting';
            break;
          case 'p': // Ctrl+Shift+P for Production
            targetModule = 'Production';
            break;
          case 'i': // Ctrl+Shift+I for Inventory
            targetModule = 'Inventory';
            break;
        }

        if (targetModule) {
          e.preventDefault();
          // If clicking the same module and not pinned, toggle it off
          if (expandedModule === targetModule && !isPinned) {
            setExpandedModule(null);
          } else {
            setExpandedModule(targetModule);
          }
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyboard);
    return () => document.removeEventListener('keydown', handleGlobalKeyboard);
  }, [expandedModule, isPinned]);

  // Load sidebar behavior preference from user
  useEffect(() => {
    if (user?.sidebar_behavior) {
      setSidebarBehavior(user.sidebar_behavior as SidebarBehavior);
    }
  }, [user]);

  useEffect(() => {
    const hasDefaultsFromAuth =
      user?.default_a4_printer !== undefined ||
      user?.default_a5_printer !== undefined ||
      user?.default_pos_printer !== undefined;

    if (hasDefaultsFromAuth) {
      setPrinterDefaults({
        a4: user?.default_a4_printer ?? '',
        a5: user?.default_a5_printer ?? '',
        pos: user?.default_pos_printer ?? '',
      });
      return;
    }

    const fetchPrinterDefaults = async () => {
      try {
        const response = await api.get('/users/profile/');
        const settings = response.data?.printer_settings ?? {};
        setPrinterDefaults({
          a4: settings.default_a4_printer ?? '',
          a5: settings.default_a5_printer ?? '',
          pos: settings.default_pos_printer ?? '',
        });
      } catch {
        setPrinterDefaults({
          a4: '',
          a5: '',
          pos: '',
        });
      }
    };

    if (user) {
      fetchPrinterDefaults();
    }
  }, [user, pathname]);

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  // Determine logo source with fallback for SSR
  const logoSrc =
    mounted && theme === 'dark'
      ? '/images/layout/kandyoffset-logo-dark.svg'
      : '/images/layout/kandyoffset-logo-light.svg';

  // Generate display name from username or email
  const getDisplayName = () => {
    if (user?.display_name) {
      return user.display_name;
    }
    if (user?.username) {
      return user.username;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'User';
  };

  // Get avatar URL from useProfilePicture hook with fallback
  const avatarUrl = getProfilePictureUrlWithFallback();

  type PrinterStatus = 'online' | 'offline' | 'busy' | 'error' | 'unknown' | 'not_set';

  const getPrinterStatus = (
    printerName: string,
    printerType: 'standard' | 'pos',
  ): PrinterStatus => {
    if (!printerName) {
      return 'not_set';
    }

    const normalizedName = printerName.toLowerCase();
    const exactMatch = rawPrinters.find(
      (printer) =>
        printer.printer_type === printerType && printer.name.toLowerCase() === normalizedName,
    );

    if (exactMatch) {
      return exactMatch.status;
    }

    const fallbackMatch = rawPrinters.find(
      (printer) => printer.name.toLowerCase() === normalizedName,
    );

    if (fallbackMatch) {
      return fallbackMatch.status;
    }

    return 'unknown';
  };

  const getStatusTone = (status: PrinterStatus) => {
    switch (status) {
      case 'online':
        return 'bg-emerald-500';
      case 'busy':
        return 'bg-amber-500';
      case 'error':
        return 'bg-rose-500';
      case 'offline':
        return 'bg-slate-400';
      case 'unknown':
        return 'bg-slate-300';
      case 'not_set':
        return 'bg-slate-200';
      default:
        return 'bg-slate-300';
    }
  };

  const getStatusLabel = (status: PrinterStatus) => {
    switch (status) {
      case 'online':
        return 'Online';
      case 'busy':
        return 'Busy';
      case 'error':
        return 'Error';
      case 'offline':
        return 'Offline';
      case 'unknown':
        return 'Not detected';
      case 'not_set':
        return 'Not set';
      default:
        return 'Unknown';
    }
  };

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

  const printerStatuses = printerStatusItems.map((item) => getPrinterStatus(item.name, item.type));
  const hasConfiguredPrinters = printerStatuses.some((status) => status !== 'not_set');
  const overallPrinterStatus: PrinterStatus = printersError
    ? 'unknown'
    : clientsOnline === 0
      ? 'offline'
      : printersLoading && rawPrinters.length === 0
        ? 'busy'
        : !hasConfiguredPrinters
          ? 'not_set'
          : printerStatuses.reduce<PrinterStatus>((currentWorst, status) => {
              const order: PrinterStatus[] = [
                'error',
                'offline',
                'unknown',
                'busy',
                'online',
                'not_set',
              ];
              return order.indexOf(status) < order.indexOf(currentWorst) ? status : currentWorst;
            }, 'online');

  // Icon rail interaction handlers
  const handleModuleClick = (moduleName: string) => {
    if (expandedModule === moduleName && !isPinned) {
      // Click same module again - collapse (only if not pinned)
      setExpandedModule(null);
    } else {
      // Click different module - expand
      setExpandedModule(moduleName);

      // If pinned, update the pinned module in localStorage
      if (isPinned) {
        try {
          localStorage.setItem('sidebar_pinned_module', moduleName);
          setPinnedModule(moduleName);
        } catch (error) {
          console.error('Failed to update pinned module:', error);
        }
      }
    }
  };

  const handlePanelClose = () => {
    if (!isPinned) {
      setExpandedModule(null);
    }
  };

  const handlePin = () => {
    const newPinnedState = !isPinned;
    setIsPinned(newPinnedState);

    try {
      if (newPinnedState && expandedModule) {
        // Save pinned module to localStorage
        localStorage.setItem('sidebar_pinned_module', expandedModule);
        setPinnedModule(expandedModule);
      } else {
        // Clear pinned state
        localStorage.removeItem('sidebar_pinned_module');
        setPinnedModule(null);
      }
    } catch (error) {
      console.error('Failed to save pinned state:', error);
    }
  };

  // Find the expanded module config
  const expandedModuleConfig = moduleConfigs.find((m) => m.name === expandedModule) || null;

  // Determine which module is active based on current pathname
  const getActiveModule = (): string | null => {
    for (const moduleConfig of moduleConfigs) {
      for (const section of moduleConfig.sections) {
        if (section.items.some((item) => pathname === item.href)) {
          return moduleConfig.name;
        }
      }
    }
    return null;
  };

  const activeModule = getActiveModule();

  // Calculate main content margin
  // When pinned, always push content. When not pinned, use user preference.
  const shouldPushContent = isPinned || (sidebarBehavior === 'push' && expandedModule);
  const mainContentClass =
    shouldPushContent && expandedModule
      ? 'p-2 lg:ml-65 transition-all duration-150 motion-reduce:transition-none'
      : 'p-2 lg:ml-12 transition-all duration-150 motion-reduce:transition-none';

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Top Navigation Bar */}
      <TopNavBar
        sidebarOpen={sidebarOpen}
        onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
        logoSrc={logoSrc}
        user={user}
        getDisplayName={getDisplayName}
        avatarUrl={avatarUrl}
        handleImageError={handleImageError}
        theme={theme}
        toggleTheme={toggleTheme}
        handleLogout={handleLogout}
        rawPrinters={rawPrinters}
        printersLoading={printersLoading}
        printersError={printersError}
        clientsOnline={clientsOnline}
        fetchPrinters={fetchPrinters}
        printerDefaults={printerDefaults}
        getPrinterStatus={getPrinterStatus}
        getStatusTone={getStatusTone}
        getStatusLabel={getStatusLabel}
        overallPrinterStatus={overallPrinterStatus}
      />

      {/* Icon Rail (desktop only) */}
      <IconRail
        modules={moduleConfigs}
        activeModule={activeModule}
        expandedModule={expandedModule}
        onModuleClick={handleModuleClick}
        pathname={pathname}
        onReportIssue={handleReportIssue}
      />

      {/* Expandable Panel (desktop only) */}
      <ExpandablePanel
        module={expandedModuleConfig}
        isVisible={expandedModule !== null}
        isPinned={isPinned}
        onClose={handlePanelClose}
        onPin={handlePin}
        pathname={pathname}
        sidebarBehavior={sidebarBehavior}
      />

      {/* Mobile Sidebar */}
      <MobileSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        navigationSections={navigationSections}
        pathname={pathname}
        user={user}
      />

      {/* Main Content */}
      <div className={mainContentClass}>
        <div className="p-2 mt-14">{children}</div>
      </div>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        expand={false}
        richColors
        closeButton
        toastOptions={{
          duration: 4000,
        }}
      />

      <BugReportModal
        isOpen={bugReportOpen}
        screenshotFile={bugReportScreenshot}
        onClose={() => {
          setBugReportOpen(false);
          setBugReportScreenshot(null);
        }}
      />
    </div>
  );
}
