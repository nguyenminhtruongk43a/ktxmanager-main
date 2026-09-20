'use client';
import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import { useAuth } from '@/context/AuthContext';

const PUBLIC_PATHS = ['/sign-up-login', '/register'];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = PUBLIC_PATHS.some(p => pathname?.startsWith(p));

  useEffect(() => {
    if (!loading && !currentUser && !isPublicPath) {
      router.replace('/sign-up-login');
    }
  }, [loading, currentUser, isPublicPath, router]);

  // Show loading spinner while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Đang kiểm tra đăng nhập...</p>
        </div>
      </div>
    );
  }

  // Public pages (login) — no sidebar
  if (isPublicPath) {
    return <>{children}</>;
  }

  // Not authenticated — redirect happening, show nothing
  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-muted-foreground">Đang chuyển hướng...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 min-w-0 lg:pt-0 pt-14 overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}