'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AppLogo from '@/components/ui/AppLogo';
import { LayoutDashboard, Users, ChevronLeft, ChevronRight, LogOut, BarChart2, ClipboardList, UserCog, RefreshCw, Building2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useWorkers } from '@/context/WorkerContext';
import Icon from '@/components/ui/AppIcon';


interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  adminOnly?: boolean;
  dynamicBadge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'nav-dashboard', label: 'Tổng Quan', href: '/', icon: LayoutDashboard },
  { id: 'nav-report', label: 'Báo Cáo Biến Động', href: '/report-dashboard', icon: BarChart2 },
  { id: 'nav-workers', label: 'Quản Lý Công Nhân', href: '/worker-management', icon: Users, dynamicBadge: true },
  { id: 'nav-facilities', label: 'Quản lý Cơ sở vật chất', href: '/facilities', icon: Building2 },
  { id: 'nav-user-mgmt', label: 'Quản Lý Tài Khoản', href: '/user-management', icon: UserCog, adminOnly: true },
  { id: 'nav-audit', label: 'Nhật Ký Hệ Thống', href: '/audit-log', icon: ClipboardList, adminOnly: true },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isAdmin, signOut } = useAuth();
  const { workerCount, refreshWorkers, refreshing } = useWorkers();

  // Filter nav items: adminOnly items hidden for staff
  const visibleNavItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch {}
    router.replace('/sign-up-login');
  };

  if (!currentUser) return null;

  const displayName = currentUser.name || currentUser.email || 'Người dùng';
  const roleLabel = currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
  const avatarColor = currentUser.role === 'admin' ? 'bg-red-500' : 'bg-blue-500';

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-card border-r border-border h-screen sticky top-0 sidebar-transition overflow-hidden ${collapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Logo */}
        <div className={`flex items-center border-b border-border px-3 py-4 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <AppLogo size={32} />
          {!collapsed && (
            <span className="font-bold text-sm text-foreground tracking-tight truncate leading-tight">KÝ TÚC XÁ<br />HÓC MÔN</span>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-1 overflow-y-auto scrollbar-thin">
          {!collapsed && (
            <p className="px-3 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
              Chính
            </p>
          )}
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            const badge = item.dynamicBadge ? workerCount : undefined;
            return (
              <Link
                key={item.id}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`nav-item relative ${isActive ? 'nav-item-active' : ''}`}
              >
                <Icon size={18} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && badge !== undefined && badge > 0 && (
                  <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-tabular font-semibold">
                    {badge}
                  </span>
                )}
                {collapsed && badge !== undefined && badge > 0 && (
                  <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}

          {/* Reload button */}
          <div className={`mt-2 ${collapsed ? 'px-1' : 'px-1'}`}>
            {!collapsed && (
              <p className="px-2 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">
                Công cụ
              </p>
            )}
            <button
              onClick={refreshWorkers}
              disabled={refreshing}
              title="Tải lại dữ liệu"
              className={`w-full nav-item gap-2 ${refreshing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted'}`}
            >
              <RefreshCw
                size={18}
                className={`text-muted-foreground flex-shrink-0 ${refreshing ? 'animate-spin' : ''}`}
              />
              {!collapsed && (
                <span className="truncate text-sm text-muted-foreground">
                  {refreshing ? 'Đang tải...' : 'Tải lại dữ liệu'}
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* User + collapse */}
        <div className="border-t border-border">
          {!collapsed && (
            <div className="w-full px-3 py-3 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
              </div>
              <button
                className="btn-ghost p-1.5 rounded-lg hover:text-red-500 transition-colors"
                title="Đăng xuất"
                onClick={handleLogout}
              >
                <LogOut size={14} />
              </button>
            </div>
          )}
          {collapsed && (
            <div className="flex flex-col items-center py-2 gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor}`}>
                {displayName.charAt(0).toUpperCase()}
              </div>
              <button
                onClick={handleLogout}
                className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-red-500"
                title="Đăng xuất"
              >
                <LogOut size={13} />
              </button>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border-t border-border"
          >
            {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Thu gọn</span></>}
          </button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border flex items-center px-4 h-14 gap-3">
        <AppLogo size={28} />
        <span className="font-bold text-sm text-foreground">KÝ TÚC XÁ HÓC MÔN</span>
        <div className="flex-1" />
        <nav className="flex items-center gap-1">
          {visibleNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={`mobile-${item.id}`}
                href={item.href}
                className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-secondary text-primary' : 'text-muted-foreground hover:bg-muted'}`}
              >
                <Icon size={18} />
              </Link>
            );
          })}
          {/* Mobile reload button */}
          <button
            onClick={refreshWorkers}
            disabled={refreshing}
            title="Tải lại dữ liệu"
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-red-500 transition-colors"
            title="Đăng xuất"
          >
            <LogOut size={18} />
          </button>
        </nav>
      </div>
    </>
  );
}