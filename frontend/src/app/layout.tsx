import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Montserrat, Source_Sans_3, Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ThemeProvider } from 'next-themes';
import { Providers } from './providers';

// Load only essential font weights to reduce preload warnings
const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['400', '500', '600', '700'], // Reduced weight range
  display: 'swap',
  preload: false, // Only preload if actually used on critical path
  fallback: ['system-ui', 'arial'],
});

const sourceSans3 = Source_Sans_3({
  subsets: ['latin'],
  variable: '--font-source-sans-3',
  weight: ['400', '500', '600', '700'], // Reduced weight range
  display: 'swap',
  preload: false, // Only preload if actually used on critical path
  fallback: ['system-ui', 'arial'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
  fallback: ['system-ui', 'arial'],
});

export const metadata: Metadata = {
  title: 'PrintCloud.io - Print Management System',
  description: 'Comprehensive print production management system',
  icons: {
    icon: '/printcloud.ico',
    shortcut: '/printcloud.ico',
    apple: '/printcloud.ico',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${montserrat.variable} ${sourceSans3.variable} ${inter.variable} font-sans antialiased`}
      >
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
            <AuthProvider>
              {children}
              <div id="toast-root" />
            </AuthProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
