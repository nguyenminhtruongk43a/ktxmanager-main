'use client';
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useWorkers } from '@/context/WorkerContext';
import { getUniquePlatoons, getUniqueBuildings } from '@/data/workers';

const COLORS = [
  'var(--primary)',
  'var(--accent)',
  '#06b6d4',
  '#8b5cf6',
  '#f59e0b',
  '#10b981',
];

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-card border border-border rounded-lg shadow-dropdown px-3 py-2 text-xs">
        <p className="font-semibold text-foreground mb-1">{label}</p>
        {payload.map((p, i) => (
          <p key={`tt-${i}`} className="text-muted-foreground">{p.name}: <span className="font-tabular font-semibold text-foreground">{p.value}</span></p>
        ))}
      </div>
    );
  }
  return null;
};

export default function PlatoonBarChart() {
  const { workers } = useWorkers();

  const platoons = useMemo(() => getUniquePlatoons(workers), [workers]);
  const buildings = useMemo(() => getUniqueBuildings(workers), [workers]);

  const data = useMemo(() => {
    const platoonList = platoons.length > 0 ? platoons : ['8', '111', '113'];
    return platoonList.map(td => {
      const entry: Record<string, string | number> = { name: `Tiểu Đoàn ${td}` };
      buildings.forEach(b => {
        entry[b] = workers.filter(w => w.tieuDoan === td && w.day === b).length;
      });
      return entry;
    });
  }, [workers, platoons, buildings]);

  const displayBuildings = buildings.length > 0 ? buildings : ['Dãy 3', 'Dãy 4'];

  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold text-foreground mb-1">Phân Bổ Theo Tiểu Đoàn</h2>
      <p className="text-xs text-muted-foreground mb-4">Số công nhân mỗi tiểu đoàn theo dãy nhà</p>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} barGap={4} barCategoryGap="30%">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} axisLine={false} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {displayBuildings.map((b, i) => (
            <Bar key={b} dataKey={b} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}