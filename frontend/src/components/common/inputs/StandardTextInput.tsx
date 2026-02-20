import React from 'react';
import { TextInput, TextInputProps } from 'flowbite-react';

/**
 * StandardTextInput - A standardized text input component with compact sizing
 *
 * This component wraps Flowbite's TextInput with a default sizing="sm" to provide
 * consistent compact styling across the application. All props from TextInput are supported.
 *
 * @example
 * ```tsx
 * <StandardTextInput
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 *   placeholder="Enter text..."
 * />
 * ```
 */
export const StandardTextInput = React.forwardRef<HTMLInputElement, TextInputProps>(
  (props, ref) => {
    const { sizing = 'sm', className = '', ...restProps } = props;

    return (
      <TextInput
        ref={ref}
        sizing={sizing}
        className={`focus:border-primary-500 focus:ring-primary-500 dark:focus:border-primary-400 dark:focus:ring-primary-400 ${className}`}
        {...restProps}
      />
    );
  },
);

StandardTextInput.displayName = 'StandardTextInput';
