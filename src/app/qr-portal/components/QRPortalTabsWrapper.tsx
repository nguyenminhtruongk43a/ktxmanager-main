'use client';
import React, { useState } from 'react';
import QRPortalClient from './QRPortalClient';
import AttendancePortalClient from './AttendancePortalClient';
import { QrCode, ClipboardList } from 'lucide-react';

export default function QRPortalTabsWrapper() {
  const [activeTab, setActiveTab] = useState<'registration' | 'attendance'>('attendance');

  return (
    <div>
      {/* Top-level tab switcher */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit mx-4 md:mx-6 mt-4 md:mt-6">
        {[
          { key: 'attendance', label: 'QR Điểm Danh', icon: <ClipboardList size={15} /> },
          { key: 'registration', label: 'Đăng ký cư trú', icon: <QrCode size={15} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'attendance' && <AttendancePortalClient />}
      {activeTab === 'registration' && <QRPortalClient />}
    </div>
  );
}
