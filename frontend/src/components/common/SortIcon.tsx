interface SortIconProps {
  field: string;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

export const SortIcon = ({ field, sortField, sortDirection }: SortIconProps) => {
  if (sortField !== field) return null;

  return (
    <svg
      className={`w-4 h-4 ms-1 transition-transform duration-200 ${
        sortField === field
          ? `text-blue-600 ${sortDirection === 'desc' ? 'rotate-180' : ''}`
          : 'text-gray-400'
      }`}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="m8 15 4 4 4-4m0-6-4-4-4 4"
      />
    </svg>
  );
};
