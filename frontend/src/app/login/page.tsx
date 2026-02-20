'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Button, Card, Label, Alert, Spinner } from 'flowbite-react';
import { StandardTextInput } from '@/components/common/inputs';
import { HiMail, HiLockClosed, HiEye, HiEyeOff, HiShieldCheck } from 'react-icons/hi';
import { useAuth } from '@/context/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import { api } from '@/lib/api';

// Form validation schema with enhanced security
const loginSchema = yup.object({
  email: yup
    .string()
    .email('Please enter a valid email address')
    .required('Email is required')
    .max(254, 'Email is too long'), // RFC 5321 limit
  password: yup
    .string()
    .min(6, 'Password must be at least 6 characters')
    .required('Password is required'),
});

type LoginFormData = yup.InferType<typeof loginSchema>;

// Security constants
const RATE_LIMIT_DELAY = 1000; // 1 second between attempts

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const [lastAttemptTime, setLastAttemptTime] = useState<number>(0);
  const router = useRouter();
  const magicAttemptedRef = useRef(false);
  const { login, loading } = useAuth();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: yupResolver(loginSchema),
  });

  // Check for rate limiting
  const isRateLimited = () => {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptTime;
    return timeSinceLastAttempt < RATE_LIMIT_DELAY;
  };

  const onSubmit = async (data: LoginFormData) => {
    setError('');

    // Check for rate limiting (very light - just 1 second)
    if (isRateLimited()) {
      setError('Please wait a moment before trying again.');
      return;
    }

    setIsSubmitting(true);
    setLastAttemptTime(Date.now());

    try {
      const success = await login(data.email, data.password);

      if (success) {
        router.push('/dashboard');
      }
      // Error message is handled by the AuthContext and shown as toast
    } catch (err) {
      console.error('[Login] Unexpected error:', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const token = new URLSearchParams(window.location.search).get('magic');
    if (!token || magicAttemptedRef.current) return;

    magicAttemptedRef.current = true;

    const runMagicLogin = async () => {
      setError('');
      setIsMagicLoading(true);
      try {
        const response = await api.post('/users/demo/magic-link/', { token });
        const access = response.data?.access;
        const refresh = response.data?.refresh;

        if (!access || !refresh) {
          throw new Error('Missing tokens in magic link response');
        }

        localStorage.setItem('accessToken', access);
        localStorage.setItem('refreshToken', refresh);
        router.replace('/dashboard');
      } catch (err) {
        console.error('[Login] Magic link login failed:', err);
        setError('This magic link is invalid or expired. Please sign in manually.');
      } finally {
        setIsMagicLoading(false);
      }
    };

    runMagicLogin();
  }, [router]);

  return (
    <div className="login-ambient min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 relative overflow-hidden isolate">
      <div className="login-ambient__layer login-ambient__base" aria-hidden />
      <div className="login-ambient__layer login-ambient__blob login-ambient__blob--a" aria-hidden />
      <div className="login-ambient__layer login-ambient__blob login-ambient__blob--b" aria-hidden />
      <div className="login-ambient__layer login-ambient__grain" aria-hidden />

      <div
        className="absolute top-4 right-4 sm:top-6 sm:right-6 lg:top-8 lg:right-8 p-1 -translate-x-[30px]"
        style={{ zIndex: 20 }}
      >
        <ThemeToggle />
      </div>

      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">PrintCloud.io</h1>
          <h2 className="text-xl text-gray-600 dark:text-gray-400">Sign in to your account</h2>

          {/* Security indicator */}
          <div className="mt-2 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            <HiShieldCheck className="w-4 h-4 mr-1" />
            Secure authentication enabled
          </div>
        </div>

        {/* Login Form */}
        <Card className="shadow-lg bg-white/90 dark:bg-gray-800/90 backdrop-blur-[2px]">
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
                placeholder="Enter your email"
                color={errors.email ? 'failure' : undefined}
                helperText={errors.email?.message}
                disabled={isSubmitting || isMagicLoading}
                {...register('email')}
              />
            </div>

            {/* Password Field */}
            <div>
              <div className="mb-2 block">
                <Label htmlFor="password" value="Password" />
              </div>
              <div className="relative">
                <StandardTextInput
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  icon={HiLockClosed}
                  placeholder="Enter your password"
                  color={errors.password ? 'failure' : undefined}
                  helperText={errors.password?.message}
                  disabled={isSubmitting || isMagicLoading}
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                  disabled={isSubmitting || isMagicLoading}
                >
                  {showPassword ? (
                    <HiEyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <HiEye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting || isMagicLoading || loading || isRateLimited()}
            >
              {isMagicLoading ? (
                <div className="flex items-center">
                  <Spinner size="sm" className="mr-2" />
                  Opening demo...
                </div>
              ) : isSubmitting || loading ? (
                <div className="flex items-center">
                  <Spinner size="sm" className="mr-2" />
                  Signing in...
                </div>
              ) : (
                'Sign in'
              )}
            </Button>

            {/* Links */}
            <div className="text-center space-y-2">
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              >
                Forgot your password?
              </Link>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
