'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import {
  LayoutDashboard, Users, ChevronLeft, ChevronRight, LogOut, BarChart2,
  ClipboardList, UserCog, RefreshCw, Building2, QrCode, Menu, X
} from 'lucide-react';
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
  group?: 'main' | 'tools' | 'admin';
}

const NAV_ITEMS: NavItem[] = [
  { id: 'nav-dashboard', label: 'Tổng Quan', href: '/', icon: LayoutDashboard, group: 'main' },
  { id: 'nav-report', label: 'Báo Cáo Biến Động', href: '/report-dashboard', icon: BarChart2, group: 'main' },
  { id: 'nav-workers', label: 'Quản Lý Công Nhân', href: '/worker-management', icon: Users, dynamicBadge: true, group: 'main' },
  { id: 'nav-facilities', label: 'Cơ Sở Vật Chất', href: '/facilities', icon: Building2, group: 'main' },
  { id: 'nav-qr', label: 'QR Portal', href: '/qr-portal', icon: QrCode, group: 'main' },
  { id: 'nav-user-mgmt', label: 'Quản Lý Tài Khoản', href: '/user-management', icon: UserCog, adminOnly: true, group: 'admin' },
  { id: 'nav-audit', label: 'Nhật Ký Hệ Thống', href: '/audit-log', icon: ClipboardList, adminOnly: true, group: 'admin' },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, isAdmin, signOut } = useAuth();
  const { workerCount, refreshWorkers, refreshing } = useWorkers();

  const visibleNavItems = NAV_ITEMS.filter(item => !item.adminOnly || isAdmin);
  const mainItems = visibleNavItems.filter(i => i.group === 'main');
  const adminItems = visibleNavItems.filter(i => i.group === 'admin');

  const handleLogout = async () => {
    try { await signOut(); } catch {}
    router.replace('/sign-up-login');
    setMobileOpen(false);
  };

  if (!currentUser) return null;

  const displayName = currentUser.name || currentUser.email || 'Người dùng';
  const roleLabel = currentUser.role === 'admin' ? 'Quản trị viên' : 'Nhân viên';
  const avatarColor = currentUser.role === 'admin' ? 'bg-red-500' : 'bg-blue-500';
  const avatarInitial = displayName.charAt(0).toUpperCase();

  const NavLink = ({ item, isMobile = false }: { item: NavItem; isMobile?: boolean }) => {
    const Icon = item.icon;
    const isActive = pathname === item.href;
    const badge = item.dynamicBadge ? workerCount : undefined;

    if (isMobile) {
      return (
        <Link
          href={item.href}
          onClick={() => setMobileOpen(false)}
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-primary/10 text-primary font-semibold' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          <Icon size={18} className={isActive ? 'text-primary' : ''} />
          <span className="text-sm">{item.label}</span>
          {badge !== undefined && badge > 0 && (
            <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-2 py-0.5 font-semibold">{badge}</span>
          )}
        </Link>
      );
    }

    return (
      <Link
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`nav-item relative ${isActive ? 'nav-item-active' : ''}`}
      >
        <Icon size={18} className={isActive ? 'text-primary' : 'text-muted-foreground'} />
        {!collapsed && <span className="truncate">{item.label}</span>}
        {!collapsed && badge !== undefined && badge > 0 && (
          <span className="ml-auto text-xs bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-tabular font-semibold">{badge}</span>
        )}
        {collapsed && badge !== undefined && badge > 0 && (
          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-primary" />
        )}
      </Link>
    );
  };

  return (
    <>
      {/* ── Desktop Sidebar ── */}
      <aside className={`hidden lg:flex flex-col bg-card border-r border-border h-screen sticky top-0 sidebar-transition overflow-hidden ${collapsed ? 'w-16' : 'w-64'}`}>
        {/* Logo */}
        <div className={`flex items-center border-b border-border px-3 py-4 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0 shadow-sm">
            <Building2 size={16} className="text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-bold text-sm text-foreground tracking-tight block leading-tight">KÝ TÚC XÁ</span>
              <span className="text-xs text-muted-foreground font-medium tracking-wider">HÓC MÔN</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 flex flex-col gap-0.5 overflow-y-auto scrollbar-thin">
          {!collapsed && (
            <p className="px-3 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Chính</p>
          )}
          {mainItems.map(item => <NavLink key={item.id} item={item} />)}

          {adminItems.length > 0 && (
            <>
              {!collapsed && (
                <p className="px-3 mt-4 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Quản trị</p>
              )}
              {collapsed && <div className="my-2 border-t border-border mx-2" />}
              {adminItems.map(item => <NavLink key={item.id} item={item} />)}
            </>
          )}

          {/* Reload */}
          <div className={`mt-3 ${collapsed ? 'px-1' : 'px-1'}`}>
            {!collapsed && <p className="px-2 mb-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Công cụ</p>}
            <button
              onClick={refreshWorkers}
              disabled={refreshing}
              title="Tải lại dữ liệu"
              className={`w-full nav-item gap-2 ${refreshing ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted'}`}
            >
              <RefreshCw size={18} className={`text-muted-foreground flex-shrink-0 ${refreshing ? 'animate-spin' : ''}`} />
              {!collapsed && <span className="truncate text-sm text-muted-foreground">{refreshing ? 'Đang tải...' : 'Tải lại dữ liệu'}</span>}
            </button>
          </div>
        </nav>

        {/* User + collapse */}
        <div className="border-t border-border">
          {!collapsed && (
            <div className="w-full px-3 py-3 flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${avatarColor}`}>
                {avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
                <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
              </div>
              <button className="btn-ghost p-1.5 rounded-lg hover:text-red-500 transition-colors" title="Đăng xuất" onClick={handleLogout}>
                <LogOut size={14} />
              </button>
            </div>
          )}
          {collapsed && (
            <div className="flex flex-col items-center py-2 gap-1">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarColor}`}>{avatarInitial}</div>
              <button onClick={handleLogout} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-red-500" title="Đăng xuất">
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

      {/* ── Mobile Top Bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-sm border-b border-border flex items-center px-4 h-14 gap-3 shadow-sm">
        <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
          <Building2 size={14} className="text-primary-foreground" />
        </div>
        <span className="font-bold text-sm text-foreground flex-1">KÝ TÚC XÁ HÓC MÔN</span>
        <button
          onClick={() => setMobileOpen(v => !v)}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
          aria-label="Mở menu"
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* ── Mobile Drawer ── */}
      {mobileOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/40" onClick={() => setMobileOpen(false)} />
          <div className="lg:hidden fixed top-14 left-0 right-0 z-50 bg-card border-b border-border shadow-xl p-4 space-y-1 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
            <p className="px-4 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Điều hướng</p>
            {mainItems.map(item => <NavLink key={`m-${item.id}`} item={item} isMobile />)}
            {adminItems.length > 0 && (
              <>
                <p className="px-4 pt-3 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-widest">Quản trị</p>
                {adminItems.map(item => <NavLink key={`m-${item.id}`} item={item} isMobile />)}
              </>
            )}
            <div className="pt-3 border-t border-border space-y-1">
              <button
                onClick={() => { refreshWorkers(); setMobileOpen(false); }}
                disabled={refreshing}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
              >
                <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
                <span className="text-sm">{refreshing ? 'Đang tải...' : 'Tải lại dữ liệu'}</span>
              </button>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 transition-colors"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">Đăng xuất</span>
              </button>
            </div>
            <div className="px-4 py-3 flex items-center gap-3 bg-muted/50 rounded-xl mt-2">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold ${avatarColor}`}>{avatarInitial}</div>
              <div>
                <p className="text-sm font-semibold text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}