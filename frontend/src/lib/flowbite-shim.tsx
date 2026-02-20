'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { forwardRef } from 'react';
import {
  Button as HeroButton,
  Spinner as HeroSpinner,
  Switch,
  Dropdown as HeroDropdown,
  DropdownTrigger,
  DropdownMenu,
  DropdownItem,
  Chip,
  Checkbox as HeroCheckbox,
  Radio as HeroRadio,
  TextArea as HeroTextArea,
} from '@heroui/react';

const colorMap: Record<string, any> = {
  primary: 'primary',
  success: 'success',
  failure: 'danger',
  danger: 'danger',
  warning: 'warning',
  info: 'primary',
  light: 'default',
  dark: 'default',
};

// Button - Custom styled to match Flowbite design
export const Button = ({
  children,
  color = 'primary',
  size = 'md',
  onClick,
  onPress,
  className = '',
  disabled,
  ...props
}: any) => {
  const sizeClasses =
    size === 'sm'
      ? 'px-3 py-2 text-sm'
      : size === 'lg'
        ? 'px-5 py-3 text-base'
        : 'px-5 py-2.5 text-sm';
  const colorClasses =
    color === 'primary'
      ? 'bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-300 dark:bg-cyan-600 dark:hover:bg-cyan-700'
      : color === 'light'
        ? 'bg-gray-100 text-gray-900 hover:bg-gray-200 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600'
        : 'bg-primary hover:bg-primary-600 focus:ring-primary-300';

  return (
    <button
      onClick={onClick || onPress}
      disabled={disabled}
      className={`
        font-medium rounded-lg text-center inline-flex items-center justify-center
        focus:outline-none focus:ring-0 focus-visible:ring-0 focus-visible:outline-none
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-colors
        ${sizeClasses}
        ${colorClasses}
        text-white
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
};

// Card - Use custom styling to match Flowbite design
export const Card = ({ children, className = '', ...props }: any) => (
  <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 ${className}`} {...props}>
    {children}
  </div>
);
export const CardBody = ({ children, className = '', ...props }: any) => (
  <div className={`${className}`} {...props}>
    {children}
  </div>
);

// Label
export const Label = ({ htmlFor, children, value, className = '' }: any) => (
  <label
    htmlFor={htmlFor}
    className={`block text-sm font-medium text-gray-900 dark:text-white ${className}`}
  >
    {children || value}
  </label>
);

// TextInput - Use native input to avoid Hero UI v3 beta bugs with React 19
export const TextInput = forwardRef<HTMLInputElement, any>(
  (
    {
      helperText,
      color,
      sizing = 'md',
      rightIcon: RightIcon,
      icon: LeftIcon,
      className = '',
      ...props
    },
    ref,
  ) => {
    const isError = color === 'failure' || color === 'danger';

    return (
      <div className="w-full">
        <div className="relative">
          {LeftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <LeftIcon className="w-4 h-4 text-gray-400" />
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-lg border border-gray-300 dark:border-gray-600
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-white
              focus:outline-none focus:ring-0 focus:border-primary focus:shadow-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${LeftIcon ? 'pl-10' : 'px-3'}
              ${RightIcon ? 'pr-10' : 'px-3'}
              ${sizing === 'sm' ? 'py-2 text-sm' : sizing === 'lg' ? 'py-3 text-base' : 'py-2.5 text-sm'}
              ${isError ? 'border-red-500 dark:border-red-400 focus:ring-0 focus:border-red-500 focus:shadow-none' : ''}
              ${className}
            `}
            {...props}
          />
          {RightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none z-10">
              <RightIcon className="w-4 h-4 text-gray-400" />
            </div>
          )}
        </div>
        {helperText && (
          <p
            className={`mt-1 text-xs ${isError ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}`}
          >
            {helperText}
          </p>
        )}
      </div>
    );
  },
);
TextInput.displayName = 'TextInput';

// Alert
export const Alert = ({
  children,
  color = 'info',
  icon: Icon,
  additionalContent: _additionalContent,
  onDismiss,
  className = '',
}: any) => (
  <div
    className={`rounded-lg border p-4 flex items-start gap-2 ${
      color === 'warning'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-800 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
        : color === 'failure' || color === 'danger'
          ? 'border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300'
          : 'border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-300'
    } ${className}`}
  >
    {Icon && <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />}
    <div className="flex-1 text-sm">{children}</div>
    {onDismiss && (
      <button
        type="button"
        onClick={onDismiss}
        className="flex-shrink-0 ml-auto -mx-1.5 -my-1.5 rounded-lg p-1.5 inline-flex h-8 w-8 hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Close"
      >
        <span className="sr-only">Close</span>
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    )}
  </div>
);

// Spinner
export const Spinner = (props: any) => <HeroSpinner {...props} />;

// Dropdown
const DropdownComponent = ({
  children,
  label,
  renderTrigger,
  dismissOnClick = true,
  placement = 'bottom-end',
}: any) => (
  <HeroDropdown placement={placement}>
    <DropdownTrigger>
      {renderTrigger ? (
        renderTrigger()
      ) : (
        <HeroButton variant="flat" size="sm">
          {label} <span className="ml-1">▾</span>
        </HeroButton>
      )}
    </DropdownTrigger>
    <DropdownMenu closeOnSelect={dismissOnClick}>{children}</DropdownMenu>
  </HeroDropdown>
);

const DropdownItemComponent = ({ children, onClick, href, className, ...props }: any) => (
  <DropdownItem key={props.key} onPress={onClick} href={href} className={className} {...props}>
    {children}
  </DropdownItem>
);

const DropdownDivider = () => (
  <DropdownItem isReadOnly className="h-px my-1 bg-default-200 pointer-events-none" />
);

DropdownComponent.Item = DropdownItemComponent;
DropdownComponent.Divider = DropdownDivider;
export { DropdownComponent as Dropdown };

// Table
const TableWrapper = ({ children, className = '', hoverable: _hoverable }: any) => (
  <table className={`w-full text-sm text-left text-gray-500 dark:text-gray-400 ${className}`}>
    {children}
  </table>
);
const TableHead = ({ children }: any) => (
  <thead className="text-xs text-gray-700 uppercase bg-gray-100 dark:bg-gray-800 dark:text-white">
    {children}
  </thead>
);
const TableBody = ({ children }: any) => <tbody>{children}</tbody>;
const TableRow = ({ children, className = '' }: any) => (
  <tr
    className={`${className} ${className.includes('hover') ? '' : 'hover:bg-gray-50 dark:hover:bg-gray-700/60'}`}
  >
    {children}
  </tr>
);
const TableHeadCell = ({ children, className = '' }: any) => (
  <th className={`px-3 py-2 ${className}`} scope="col">
    {children}
  </th>
);
const TableCell = ({ children, className = '' }: any) => (
  <td className={`px-3 py-2 ${className}`}>{children}</td>
);

export const Table: any = Object.assign(TableWrapper, {
  Head: TableHead,
  Body: TableBody,
  Row: TableRow,
  HeadCell: TableHeadCell,
  Cell: TableCell,
});

// Badge
export const Badge = ({ children, color = 'primary', className = '' }: any) => (
  <Chip color={colorMap[color] || 'default'} variant="flat" className={className} size="sm">
    {children}
  </Chip>
);

// Progress (minimal)
export const Progress = ({ progress = 0, color = 'primary', className = '' }: any) => (
  <div className={`w-full h-2 rounded-full bg-default-200 dark:bg-default-100 ${className}`}>
    <div
      className={`h-full rounded-full ${color === 'primary' ? 'bg-primary-500' : 'bg-blue-500'}`}
      style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
    />
  </div>
);

// Select (simple native select fallback)
export const Select = ({ children, sizing = 'md', className = '', ...props }: any) => {
  const sizeClass =
    sizing === 'sm'
      ? 'text-sm py-2 px-3'
      : sizing === 'lg'
        ? 'text-base py-3 px-4'
        : 'text-sm py-2.5 px-3.5';
  return (
    <select
      className={`w-full rounded-lg border border-default-200 bg-white text-gray-900 dark:bg-gray-800 dark:text-gray-100 ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </select>
  );
};
Select.Option = (props: any) => <option {...props} />;
Select.Option.displayName = 'Select.Option';

// Checkbox
export const Checkbox = ({ children, id, ...props }: any) => (
  <HeroCheckbox {...props} id={id}>
    {children}
  </HeroCheckbox>
);

// Radio
export const Radio = ({ children, id, ...props }: any) => (
  <HeroRadio {...props} id={id}>
    {children}
  </HeroRadio>
);

// Modal (simple overlay)
const ModalComponent = ({ show, onClose, children }: any) => {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-lg bg-white dark:bg-gray-800 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};
ModalComponent.displayName = 'Modal';
ModalComponent.Header = ({ children }: any) => (
  <div className="px-4 pt-4 text-lg font-semibold text-gray-900 dark:text-white">{children}</div>
);
ModalComponent.Header.displayName = 'Modal.Header';
ModalComponent.Body = ({ children }: any) => (
  <div className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{children}</div>
);
ModalComponent.Body.displayName = 'Modal.Body';
ModalComponent.Footer = ({ children }: any) => (
  <div className="px-4 pb-4 pt-2 flex justify-end gap-2">{children}</div>
);
ModalComponent.Footer.displayName = 'Modal.Footer';
export { ModalComponent as Modal };

// Datepicker -> simple date input (native to avoid Hero UI v3 beta bugs)
export const Datepicker = ({ value, onSelectedDateChanged, className = '', ...props }: any) => (
  <input
    type="date"
    value={value}
    onChange={(e) => onSelectedDateChanged?.(e.target.value ? new Date(e.target.value) : null)}
    className={`
      w-full rounded-lg border border-gray-300 dark:border-gray-600
      bg-white dark:bg-gray-800
      text-gray-900 dark:text-white
      px-3 py-2.5 text-sm
      focus:ring-2 focus:ring-primary focus:border-primary
      disabled:opacity-50 disabled:cursor-not-allowed
      ${className}
    `}
    {...props}
  />
);

// Textarea
export const Textarea = (props: any) => <HeroTextArea {...props} />;

// Toast
const ToastRoot = ({ children, className = '' }: any) => (
  <div
    className={`flex items-center w-full max-w-xs p-4 text-gray-900 bg-white rounded-lg shadow dark:text-gray-300 dark:bg-gray-800 ${className}`}
  >
    {children}
  </div>
);
const ToastToggle = ({ onDismiss }: any) => (
  <button
    type="button"
    onClick={onDismiss}
    className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 dark:bg-gray-800 dark:text-gray-500 dark:hover:text-white"
    aria-label="Close"
  >
    ×
  </button>
);

export const Toast: any = Object.assign(ToastRoot, { Toggle: ToastToggle });

// ToggleSwitch
export const ToggleSwitch = ({ checked, onChange, label, ...props }: any) => (
  <Switch isSelected={checked} onValueChange={onChange} {...props}>
    {label}
  </Switch>
);
