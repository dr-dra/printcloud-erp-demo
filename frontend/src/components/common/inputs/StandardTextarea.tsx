import React from 'react';
import { Textarea, TextareaProps } from 'flowbite-react';

/**
 * StandardTextarea - A standardized textarea component with compact styling
 *
 * This component wraps Flowbite's Textarea with compact styling to match
 * StandardTextInput and StandardSelect. The compact styling is achieved through
 * custom className that matches the sizing="sm" appearance.
 *
 * @example
 * ```tsx
 * <StandardTextarea
 *   value={value}
 *   onChange={(e) => setValue(e.target.value)}
 *   placeholder="Enter description..."
 *   rows={4}
 * />
 * ```
 */
export const StandardTextarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  (props, ref) => {
    const { className = '', ...restProps } = props;

    // Apply compact styling similar to sizing="sm" for TextInput
    const compactClassName = `text-sm ${className}`;

    return <Textarea ref={ref} className={compactClassName} {...restProps} />;
  },
);

StandardTextarea.displayName = 'StandardTextarea';
