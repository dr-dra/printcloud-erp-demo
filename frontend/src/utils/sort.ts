export const getSortedData = <T extends Record<string, unknown>>(
  data: T[],
  sortField: string,
  sortDirection: 'asc' | 'desc',
): T[] => {
  if (!sortField) return data;

  return [...data].sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];

    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });
};

export const getFilteredData = <T extends Record<string, unknown>>(
  data: T[],
  searchTerm: string,
  searchFields: string[],
  startDate?: string,
  endDate?: string,
  dateField?: string,
): T[] => {
  let filtered = data;

  // Search filter
  if (searchTerm && searchFields.length > 0) {
    filtered = filtered.filter((item) =>
      searchFields.some((field) =>
        String(item[field]).toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    );
  }

  // Date range filter
  if (dateField && (startDate || endDate)) {
    filtered = filtered.filter((item) => {
      const itemDate = item[dateField];
      if (!itemDate) return true;

      const itemDateStr = new Date(itemDate).toISOString().split('T')[0];

      if (startDate && itemDateStr < startDate) return false;
      if (endDate && itemDateStr > endDate) return false;

      return true;
    });
  }

  return filtered;
};
