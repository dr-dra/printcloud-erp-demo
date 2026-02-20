import { LucideIcon } from 'lucide-react';
import type { IconType } from 'react-icons';

export interface NavItem {
  name: string;
  href: string;
  icon: IconType; // SimpleLineIcons from react-icons/sl
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export interface ModuleConfig {
  name: string;
  icon: LucideIcon;
  sections: NavSection[];
}

export interface IconRailProps {
  modules: ModuleConfig[];
  activeModule: string | null;
  expandedModule: string | null;
  onModuleClick: (moduleName: string) => void;
  pathname: string;
  onReportIssue?: () => void;
}

export interface ExpandablePanelProps {
  module: ModuleConfig | null;
  isVisible: boolean;
  isPinned: boolean;
  onClose: () => void;
  onPin: () => void;
  pathname: string;
  sidebarBehavior: 'overlay' | 'push';
}

export type SidebarBehavior = 'overlay' | 'push';
