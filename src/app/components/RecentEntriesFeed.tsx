'use client';
import React from 'react';
import { calcSoNgay } from '@/data/workers';
import { useWorkers } from '@/context/WorkerContext';
import { UserPlus, MapPin } from 'lucide-react';

export default function RecentEntriesFeed() {
  const { workers } = useWorkers();
  const recent = [...workers]?.filter(w => {
      const d = calcSoNgay(w?.ngayVaoKTX, w?.ngayRaKTX);
      return w?.ngayVaoKTX && d !== null && d <= 10;
    })?.sort((a, b) => {
      const da = calcSoNgay(a?.ngayVaoKTX, a?.ngayRaKTX) ?? 999;
      const db = calcSoNgay(b?.ngayVaoKTX, b?.ngayRaKTX) ?? 999;
      return da - db;
    })?.slice(0, 8);

  return (
    <div className="card p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">Mới Vào Gần Đây</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Trong 10 ngày qua</p>
        </div>
        <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-full">{recent?.length} người</span>
      </div>

      {recent?.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <UserPlus size={32} className="text-muted-foreground mb-2" />
          <p className="text-sm font-medium text-muted-foreground">Không có công nhân mới</p>
          <p className="text-xs text-muted-foreground mt-1">Chưa có ai vào KTX trong 10 ngày qua</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-2 scrollbar-thin">
          {recent?.map(w => (
            <div key={w?.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <UserPlus size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{w?.hoVaTen}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <MapPin size={10} className="text-muted-foreground flex-shrink-0" />
                  <p className="text-xs text-muted-foreground truncate">{w?.day} · Phòng {w?.phongSo}</p>
                </div>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-tabular text-muted-foreground">{calcSoNgay(w?.ngayVaoKTX, w?.ngayRaKTX)} ngày</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}