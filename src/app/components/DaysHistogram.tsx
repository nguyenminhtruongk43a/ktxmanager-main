'use client';
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { calcSoNgay } from '@/data/workers';
import { useWorkers } from '@/context/WorkerContext';

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-dropdown px-3 py-2 text-xs">
        <p className="font-semibold text-foreground">{label} ngày</p>
        <p className="text-muted-foreground">Số công nhân: <span className="font-tabular font-semibold text-foreground">{payload[0].value}</span></p>
      </div>
    );
  }
  return null;
};

export default function DaysHistogram() {
  const { workers } = useWorkers();
  const buckets = [
    { label: '1–7', min: 1, max: 7 },
    { label: '8–14', min: 8, max: 14 },
    { label: '15–21', min: 15, max: 21 },
    { label: '22–30', min: 22, max: 30 },
    { label: '31–40', min: 31, max: 40 },
    { label: '41+', min: 41, max: 999 },
  ];

  const data = buckets.map(b => ({
    name: b.label,
    count: workers.filter(w => {
      const d = calcSoNgay(w.ngayVaoKTX, w.ngayRaKTX);
      return d !== null && d >= b.min && d <= b.max;
    }).length,
  }));

  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold text-foreground mb-1">Số Ngày Lưu Trú</h2>
      <p className="text-xs text-muted-foreground mb-4">Phân bổ công nhân theo số ngày đã ở KTX</p>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" fill="var(--primary)" radius={[4, 4, 0, 0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}