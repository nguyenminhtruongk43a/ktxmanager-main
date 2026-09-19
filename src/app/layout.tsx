import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import '../styles/tailwind.css';
import '@/styles/index.css';
import { AuthProvider } from '@/context/AuthContext';
import { AuditProvider } from '@/context/AuditContext';
import { WorkerProvider } from '@/context/WorkerContext';

const inter = Inter({
  subsets: ['latin'],
  weight: ['100', '200', '300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-sans',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'KTXManager — Quản Lý Ký Túc Xá Công Nhân',
  description: 'Hệ thống quản lý ký túc xá nội bộ cho công nhân xây dựng — theo dõi phòng, công nhân và tổ trưởng tại KTX 2.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={inter.variable}>
      <body className={inter.className}>
        <AuthProvider>
          <AuditProvider>
            <WorkerProvider>
              {children}
            </WorkerProvider>
          </AuditProvider>
        </AuthProvider>
        <Toaster position="bottom-right" richColors closeButton />

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fktxmanager7789back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.20" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></body>
    </html>
  );
}