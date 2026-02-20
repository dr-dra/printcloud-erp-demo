'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Card, Label, Alert, Spinner, Toast } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiLockClosed, HiEye, HiEyeOff, HiArrowLeft } from 'react-icons/hi';
import { authAPI } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';

// Form validation schema
const resetPasswordSchema = yup.object({
  new_password: yup
    .string()
    .min(8, 'Password must be at least 8 characters')
    .matches(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number',
    )
    .required('Password is required'),
  confirm_password: yup
    .string()
    .oneOf([yup.ref('new_password')], 'Passwords must match')
    .required('Please confirm your password'),
});

type ResetPasswordFormData = yup.InferType<typeof resetPasswordSchema>;

interface ResetPasswordPageProps {
  params: Promise<{
    uid: string;
    token: string;
  }>;
}

export default function ResetPasswordPage({ params }: ResetPasswordPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  // Use React.use() to unwrap the params Promise
  const { uid, token } = use(params);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
  } = useForm<ResetPasswordFormData>({
    resolver: yupResolver(resetPasswordSchema),
  });

  // Watch form values for password strength indicator
  const watchedPassword = watch('new_password');

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    if (!password) return { strength: 0, label: '', color: 'gray' };

    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    const strengthMap = [
      { strength: 0, label: 'Very Weak', color: 'red' },
      { strength: 1, label: 'Weak', color: 'orange' },
      { strength: 2, label: 'Fair', color: 'yellow' },
      { strength: 3, label: 'Good', color: 'blue' },
      { strength: 4, label: 'Strong', color: 'green' },
      { strength: 5, label: 'Very Strong', color: 'green' },
    ];

    return strengthMap[Math.min(score, 5)];
  };

  const passwordStrength = getPasswordStrength(watchedPassword || '');

  useEffect(() => {
    if (!uid || !token) {
      setError('Invalid reset link. Please request a new password reset.');
    }
  }, [uid, token]);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const onSubmit = async (data: ResetPasswordFormData) => {
    if (!uid || !token) {
      setError('Invalid reset link. Please request a new password reset.');
      return;
    }

    setError('');
    try {
      await authAPI.resetPassword({
        uid,
        token,
        new_password: data.new_password,
      });

      setIsSuccess(true);
      showToast('Password reset successfully!', 'success');
    } catch (error: unknown) {
      console.error('Reset password error:', error);
      const message =
        (error as any).response?.data?.detail ||
        (error as any).response?.data?.message ||
        (error as any).response?.data?.new_password?.[0] ||
        'Failed to reset password. Please try again.';
      setError(message);
      showToast(message, 'error');
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative">
        {/* Theme Toggle - Top Right */}
        <div className="absolute top-4 right-4">
          <ThemeToggle />
        </div>
        {toastMsg && (
          <div className="fixed top-4 right-4 z-50">
            <Toast>
              <div
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toastType === 'success' ? 'bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200' : 'bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200'}`}
              >
                {toastType === 'success' ? (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                )}
              </div>
              <div className="ml-3 text-sm font-normal">{toastMsg}</div>
              <Toast.Toggle onDismiss={() => setToastMsg(null)} />
            </Toast>
          </div>
        )}
        <div className="max-w-md w-full space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">PrintCloud.io</h1>
            <h2 className="text-xl text-gray-600 dark:text-gray-400">Password Reset Successful</h2>
          </div>

          {/* Success Card */}
          <Card className="shadow-lg">
            <div className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <HiLockClosed className="h-6 w-6 text-green-600" />
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Password Updated!
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Your password has been successfully reset. You can now sign in with your new
                  password.
                </p>
              </div>

              <div className="pt-4">
                <Link href="/login">
                  <Button className="w-full" size="lg">
                    Continue to login
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4 sm:px-6 lg:px-8 relative">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50">
          <Toast>
            <div
              className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${toastType === 'success' ? 'bg-green-100 text-green-500 dark:bg-green-800 dark:text-green-200' : 'bg-red-100 text-red-500 dark:bg-red-800 dark:text-red-200'}`}
            >
              {toastType === 'success' ? (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="ml-3 text-sm font-normal">{toastMsg}</div>
            <Toast.Toggle onDismiss={() => setToastMsg(null)} />
          </Toast>
        </div>
      )}
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">PrintCloud.io</h1>
          <h2 className="text-xl text-gray-600 dark:text-gray-400">Reset your password</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Enter your new password below.
          </p>
        </div>

        {/* Reset Password Form */}
        <Card className="shadow-lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert color="failure" onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            {/* New Password Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="new_password" value="New Password" />
              </div>
              <div className="relative">
                <StandardTextInput
                  id="new_password"
                  type={showPassword ? 'text' : 'password'}
                  icon={HiLockClosed}
                  placeholder="Enter your new password"
                  color={errors.new_password ? 'failure' : undefined}
                  helperText={errors.new_password?.message}
                  {...register('new_password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <HiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <HiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>

              {/* Password strength indicator */}
              {watchedPassword && (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Password strength:</span>
                    <span
                      className={`text-${passwordStrength.color}-600 dark:text-${passwordStrength.color}-400`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-1.5 dark:bg-gray-700">
                    <div
                      className={`bg-${passwordStrength.color}-600 h-1.5 rounded-full transition-all duration-300`}
                      style={{ width: `${(passwordStrength.strength / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="confirm_password" value="Confirm New Password" />
              </div>
              <div className="relative">
                <StandardTextInput
                  id="confirm_password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  icon={HiLockClosed}
                  placeholder="Confirm your new password"
                  color={errors.confirm_password ? 'failure' : undefined}
                  helperText={errors.confirm_password?.message}
                  {...register('confirm_password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 flex items-center pr-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <HiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <HiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="text-xs text-gray-600 dark:text-gray-400">
              <p className="font-medium mb-1">Password must contain:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>At least 8 characters</li>
                <li>One uppercase letter</li>
                <li>One lowercase letter</li>
                <li>One number</li>
              </ul>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || !uid || !token}
              size="lg"
            >
              {isSubmitting ? (
                <>
                  <Spinner size="sm" light className="mr-2" />
                  Resetting...
                </>
              ) : (
                'Reset Password'
              )}
            </Button>

            {/* Back to Login Link */}
            <div className="text-center">
              <Link
                href="/login"
                className="inline-flex items-center text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
              >
                <HiArrowLeft className="mr-1 h-4 w-4" />
                Back to login
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
