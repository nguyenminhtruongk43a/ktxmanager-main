'use client';
import React from 'react';
import AppLayout from '@/components/AppLayout';
import ReportDashboard from './components/ReportDashboard';

type FluctuationPeriod = 'today' | '7days' | '30days';

type Worker = {
  created_at?: string | Date | null;
  updated_at?: string | Date | null;
  status_changed_at?: string | Date | null;
  status?: string | null;
  is_deleted?: boolean;
  deleted_at?: string | Date | null;
  [key: string]: unknown;
};

export function calculateFluctuations(
  workers: Worker[],
  period: FluctuationPeriod,
) {
  const now = new Date();
  const start = new Date(now);

  if (period === 'today') {
    start.setHours(0, 0, 0, 0);
  } else {
    start.setDate(start.getDate() - (period === '7days' ? 7 : 30));
  }

  const isInRange = (value?: string | Date | null) => {
    if (!value) return false;
    const workerDate = new Date(value).getTime();
    return (
      !Number.isNaN(workerDate) &&
      workerDate >= start.getTime() &&
      workerDate <= now.getTime()
    );
  };

  const newWorkers = workers.filter((worker) => isInRange(worker.created_at));
  const leftWorkers = workers.filter((worker) => {
    const status = String(worker.status ?? '').toLowerCase();
    const left = worker.is_deleted === true || status === 'inactive' || status === 'left';
    const leftDate = worker.deleted_at ?? worker.updated_at ?? worker.status_changed_at;
    return left && isInRange(leftDate);
  });

  return {
    newCount: newWorkers.length,
    leftCount: leftWorkers.length,
    netChange: newWorkers.length - leftWorkers.length,
    newWorkers,
    leftWorkers,
  };
}

export default function ReportDashboardPage() {
  return (
    <AppLayout>
      <button type="button" onClick={() => window.location.reload()}>
        Tải lại dữ liệu
      </button>
      <ReportDashboard />
    </AppLayout>
  );
}
