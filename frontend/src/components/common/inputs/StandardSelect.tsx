import React from 'react';
import { Select, SelectProps } from 'flowbite-react';

/**
 * StandardSelect - A standardized select dropdown component with compact sizing
 *
 * This component wraps Flowbite's Select with a default sizing="sm" to provide
 * consistent compact styling across the application. All props from Select are supported.
 *
 * @example
 * ```tsx
 * <StandardSelect
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 * >
 *   <option value="">Select option...</option>
 *   <option value="1">Option 1</option>
 *   <option value="2">Option 2</option>
 * </StandardSelect>
 * ```
 */
export const StandardSelect = React.forwardRef<HTMLSelectElement, SelectProps>((props, ref) => {
  const { sizing = 'sm', className = '', ...restProps } = props;

  return (
    <Select
      ref={ref}
      sizing={sizing}
      className={`focus:border-primary-500 focus:ring-primary-500 dark:focus:border-primary-400 dark:focus:ring-primary-400 ${className}`}
      {...restProps}
    />
  );
});

StandardSelect.displayName = 'StandardSelect';
