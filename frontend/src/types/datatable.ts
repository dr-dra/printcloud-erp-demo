import React from 'react';

export interface DataTableColumn<T = Record<string, unknown>> {
  key: string;
  label: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

export interface DataTablePagination {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalCount: number;
  perPage: number;
  onPerPageChange?: (perPage: number) => void;
  autoPerPage?: number;
  userRowsPerPage?: number | 'auto';
}

export interface DataTableProps<T = Record<string, unknown>> {
  title: string;
  data: T[];
  columns: DataTableColumn<T>[];
  searchFields?: string[];
  actions?: (row: T) => React.ReactNode;
  enableDateRangeFilter?: boolean;
  dateField?: string;
  onRowClick?: (row: T) => void;
  uniqueId?: string;
  customHeader?: React.ReactNode;
  loading?: boolean;
  pagination?: DataTablePagination;
  onSort?: (field: string) => void;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
  isServerPaginated?: boolean;
  highlightedRowId?: number | string | null;
  idColumn?: string;
}
