import React from 'react';
import AppLayout from '@/components/AppLayout';
import BedManagementClient from './components/BedManagementClient';

export default function BedManagementPage() {
  return (
    <AppLayout>
      <div className="p-4 md:p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-foreground">Quản lý Giường & Mã QR</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Đồng bộ hai chiều giữa sơ đồ giường và hồ sơ nhân sự · Quét QR để gán / điểm danh
          </p>
        </div>
        <BedManagementClient />
      </div>
    </AppLayout>
  );
}
