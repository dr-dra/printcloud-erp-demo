'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'flowbite-react';
import { HiChevronLeft, HiChevronRight } from 'react-icons/hi';
import { DataTableProps } from '@/types/datatable';
import { loadFromStorage } from '@/utils/storage';
import { SortIcon } from './SortIcon';

export default function DataTable<T = Record<string, unknown>>({
  title,
  data,
  columns,
  actions,
  onRowClick,
  uniqueId,
  pagination,
  loading = false,
  onSort,
  sortField: propSortField,
  sortDirection: propSortDirection,
  isServerPaginated: propIsServerPaginated = false,
  highlightedRowId,
  idColumn = 'id',
}: DataTableProps<T> & {
  backendSearchTerm?: string;
  onBackendSearchChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
}) {
  const storageId =
    uniqueId ||
    (typeof title === 'string' ? title.toLowerCase().replace(/\s+/g, '_') : 'datatable');

  // State with localStorage persistence - use default values during SSR
  const [sortField, setSortField] = useState<string>('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [perPage, setPerPage] = useState<number>(10);

  // Non-persistent state
  const [clientPage, setClientPage] = useState(1);

  // Initialize client-side state after hydration
  useEffect(() => {
    // Load persisted values only on client side
    setSortField(loadFromStorage(storageId, 'sortField', ''));
    setSortDirection(loadFromStorage(storageId, 'sortDirection', 'asc'));

    // Check if user has manually set perPage, if not, let auto-calculation handle it
    const storedPerPage = loadFromStorage(storageId, 'perPage', null);

    if (storedPerPage !== null) {
      setPerPage(storedPerPage);
    }
  }, [storageId]);

  // Server-side pagination support
  const isServerPaginated = !!pagination;
  const currentPage = isServerPaginated ? pagination!.currentPage : clientPage;
  const pageSize = isServerPaginated ? pagination!.perPage : perPage;
  const totalCount = isServerPaginated ? pagination!.totalCount : data.length;
  const totalPages = isServerPaginated ? pagination!.totalPages : Math.ceil(data.length / pageSize);
  const paginatedData = isServerPaginated
    ? data
    : data.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const onPageChange = isServerPaginated ? pagination!.onPageChange : setClientPage;
  const onPerPageChange = isServerPaginated ? pagination!.onPerPageChange : setPerPage;
  const autoPerPage = isServerPaginated ? pagination?.autoPerPage : undefined;
  const userRowsPerPage = isServerPaginated ? pagination?.userRowsPerPage : undefined;

  // Use server-side sort props if provided, otherwise use local state
  const displaySortField =
    propIsServerPaginated && propSortField !== undefined ? propSortField : sortField;
  const displaySortDirection =
    propIsServerPaginated && propSortDirection !== undefined ? propSortDirection : sortDirection;

  // Handlers
  const handleSort = (field: string) => {
    if (!columns.find((col) => col.key === field)?.sortable) return;

    // If server-side sorting is enabled, call the parent's onSort handler
    if (propIsServerPaginated && onSort) {
      onSort(field);
    } else {
      // Client-side sorting
      if (sortField === field) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortField(field);
        setSortDirection('asc');
      }
    }
  };

  // Add SkeletonRow component
  function SkeletonRow({ columns = 4 }) {
    return (
      <tr>
        {Array.from({ length: columns }).map((_, idx) => (
          <td key={idx} className="px-3 py-4 text-sm">
            <div
              className="h-5 bg-gray-200 rounded animate-pulse dark:bg-gray-700"
              style={{ minHeight: '20px' }}
            ></div>
          </td>
        ))}
      </tr>
    );
  }

  return (
    <Card>
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-gray-500 dark:text-gray-400">
          <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800 dark:text-white rounded-t-lg">
            <tr>
              {columns.map((column) => (
                // Apply header alignment based on column.align
                <th
                  key={column.key}
                  scope="col"
                  className={`px-3 py-1 ${column.align === 'right' ? 'text-right' : column.align === 'center' ? 'text-center' : 'text-left'}`}
                >
                  {column.sortable ? (
                    <button
                      onClick={() => handleSort(column.key)}
                      className={`flex items-center hover:text-gray-900 dark:hover:text-white ${column.align === 'right' ? 'justify-end w-full' : column.align === 'center' ? 'justify-center w-full' : 'justify-start'}`}
                    >
                      {column.label}
                      <SortIcon
                        field={column.key}
                        sortField={displaySortField}
                        sortDirection={displaySortDirection}
                      />
                    </button>
                  ) : (
                    <span
                      className={`flex items-center ${column.align === 'right' ? 'justify-end w-full' : column.align === 'center' ? 'justify-center w-full' : 'justify-start'}`}
                    >
                      {column.label}
                    </span>
                  )}
                </th>
              ))}
              {actions && (
                <th scope="col" className="px-3 py-1">
                  <span className="flex items-center">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {/* Skeleton Loader */}
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <SkeletonRow key={idx} columns={columns.length + (actions ? 1 : 0)} />
              ))
            ) : paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className="px-1 py-1 text-center text-gray-500 dark:text-gray-400"
                >
                  No {typeof title === 'string' ? title.toLowerCase() : 'data'} found
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => {
                const rowId = row[idColumn];
                const isHighlighted = highlightedRowId !== null && rowId === highlightedRowId;

                return (
                  <tr
                    key={row.id || index}
                    className={`${
                      isHighlighted
                        ? 'animate-fade-out-bg'
                        : index % 2 === 0
                          ? 'bg-white dark:bg-gray-800'
                          : 'bg-slate-50 dark:bg-gray-700/50'
                    } border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 ${
                      onRowClick ? 'cursor-pointer' : ''
                    }`}
                    onClick={() => onRowClick?.(row)}
                  >
                    {columns.map((column) => {
                      const cellValue = column.render
                        ? column.render(row)
                        : (row as Record<string, React.ReactNode>)[column.key];
                      return (
                        <td
                          key={column.key}
                          // Adjusted padding to set ROW HEIGHT
                          className={`px-3 py-1.5 text-xs leading-none ${
                            column.align === 'center'
                              ? 'text-center'
                              : column.align === 'right'
                                ? 'text-right'
                                : ''
                          } ${
                            column.key === 'id'
                              ? 'font-medium text-gray-900 whitespace-nowrap dark:text-white'
                              : ''
                          }`}
                        >
                          {cellValue}
                        </td>
                      );
                    })}
                    {actions && (
                      <td className="px-3 py-1" onClick={(e) => e.stopPropagation()}>
                        {actions(row)}
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center space-y-3 md:space-y-0 pt-4">
        <div className="flex items-center space-x-3">
          {onPerPageChange && (
            <>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Rows per page:
              </label>
              <select
                value={userRowsPerPage === 'auto' ? -1 : pageSize}
                onChange={(e) => onPerPageChange(Number(e.target.value))}
                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-primary-500 focus:border-primary-500 block p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-primary-500 dark:focus:border-primary-500"
              >
                <option value="-1">Auto{autoPerPage ? ` (${autoPerPage})` : ''}</option>
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </>
          )}
          <span className="text-sm text-gray-700 dark:text-gray-400">
            Showing {totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalCount)} of {totalCount} entries
          </span>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <nav>
            <ul className="inline-flex -space-x-px rtl:space-x-reverse text-sm h-8">
              <li>
                <button
                  onClick={() => onPageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center justify-center px-3 h-8 ms-0 leading-tight text-gray-500 bg-white border border-gray-300 rounded-s-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <HiChevronLeft className="w-2.5 h-2.5" />
                </button>
              </li>

              {/* Ellipsis pagination logic */}
              {(() => {
                const pages = [];
                const maxVisible = 5;
                if (totalPages <= maxVisible + 2) {
                  for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                  }
                } else {
                  const left = Math.max(2, currentPage - 1);
                  const right = Math.min(totalPages - 1, currentPage + 1);
                  pages.push(1);
                  if (left > 2) pages.push('ellipsis-left');
                  for (let i = left; i <= right; i++) pages.push(i);
                  if (right < totalPages - 1) pages.push('ellipsis-right');
                  pages.push(totalPages);
                }
                return pages.map((item, idx) =>
                  item === 'ellipsis-left' || item === 'ellipsis-right' ? (
                    <li key={item + idx}>
                      <span className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400">
                        ...
                      </span>
                    </li>
                  ) : (
                    <li key={item}>
                      <button
                        onClick={() => onPageChange(Number(item))}
                        className={`flex items-center justify-center px-3 h-8 leading-tight border border-gray-300 hover:bg-gray-100 hover:text-gray-700 dark:border-gray-700 dark:hover:bg-gray-700 dark:hover:text-white ${
                          currentPage === item
                            ? 'text-primary-600 bg-primary-50 hover:bg-primary-100 dark:bg-gray-700 dark:text-white'
                            : 'text-gray-500 bg-white dark:bg-gray-800 dark:text-gray-400'
                        }`}
                      >
                        {item}
                      </button>
                    </li>
                  ),
                );
              })()}

              <li>
                <button
                  onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="flex items-center justify-center px-3 h-8 leading-tight text-gray-500 bg-white border border-gray-300 rounded-e-lg hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <HiChevronRight className="w-2.5 h-2.5" />
                </button>
              </li>
            </ul>
          </nav>
        )}
      </div>
    </Card>
  );
}
