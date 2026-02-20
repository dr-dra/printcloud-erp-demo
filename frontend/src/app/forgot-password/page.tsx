'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Card, Label, Alert, Spinner, Toast } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiMail, HiArrowLeft } from 'react-icons/hi';
import { authAPI } from '@/lib/api';
import ThemeToggle from '@/components/ThemeToggle';

// Form validation schema
const forgotPasswordSchema = yup.object({
  email: yup.string().email('Please enter a valid email address').required('Email is required'),
});

type ForgotPasswordFormData = yup.InferType<typeof forgotPasswordSchema>;

export default function ForgotPasswordPage() {
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(null), 4000);
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    getValues,
  } = useForm<ForgotPasswordFormData>({
    resolver: yupResolver(forgotPasswordSchema),
  });

  const onSubmit = async (data: ForgotPasswordFormData) => {
    setError('');
    try {
      await authAPI.forgotPassword(data.email);
      setIsSubmitted(true);
      showToast('Password reset email sent successfully!', 'success');
    } catch (error: unknown) {
      console.error('Forgot password error:', error);
      const message =
        (error as any).response?.data?.detail ||
        (error as any).response?.data?.message ||
        'Failed to send reset email. Please try again.';
      setError(message);
      showToast(message, 'error');
    }
  };

  if (isSubmitted) {
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
            <h2 className="text-xl text-gray-600 dark:text-gray-400">Check your email</h2>
          </div>

          {/* Success Card */}
          <Card className="shadow-lg">
            <div className="text-center space-y-4">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <HiMail className="h-6 w-6 text-green-600" />
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Reset link sent!
                </h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  We&apos;ve sent a password reset link to{' '}
                  <span className="font-medium">{getValues('email')}</span>
                </p>
              </div>

              <div className="text-sm text-gray-600 dark:text-gray-400">
                <p>
                  Didn&apos;t receive the email? Check your spam folder or{' '}
                  <button
                    onClick={() => setIsSubmitted(false)}
                    className="font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400"
                  >
                    try again
                  </button>
                </p>
              </div>

              <div className="pt-4">
                <Link href="/login">
                  <Button color="gray" className="w-full">
                    <HiArrowLeft className="mr-2 h-4 w-4" />
                    Back to login
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
          <h2 className="text-xl text-gray-600 dark:text-gray-400">Forgot your password?</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            No worries! Enter your email and we&apos;ll send you reset instructions.
          </p>
        </div>

        {/* Forgot Password Form */}
        <Card className="shadow-lg">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Error Alert */}
            {error && (
              <Alert color="failure" onDismiss={() => setError('')}>
                {error}
              </Alert>
            )}

            {/* Email Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="email" value="Email address" />
              </div>
              <StandardTextInput
                id="email"
                type="email"
                icon={HiMail}
                placeholder="Enter your email address"
                color={errors.email ? 'failure' : undefined}
                helperText={errors.email?.message}
                {...register('email')}
              />
            </div>

            {/* Submit Button */}
            <Button type="submit" className="w-full" disabled={isSubmitting} size="lg">
              {isSubmitting ? (
                <>
                  <Spinner size="sm" light className="mr-2" />
                  Sending...
                </>
              ) : (
                'Send reset instructions'
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
