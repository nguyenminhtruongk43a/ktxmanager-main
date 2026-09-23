'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Worker, calcSoNgay, getProfileStatus } from '@/data/workers';
import { X, Users, Phone, CreditCard, MapPin, Calendar, Tag } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Props {
  ktx: string;
  building: string;
  buildingRaw: string;
  room: string;
  workers: Worker[];
  adminAssignedUnit?: string;
  roomLabel?: string | null;
  onClose: () => void;
  onUnitUpdated?: (newUnit: string | null) => void;
  onRoomLabelUpdated?: (newLabel: string | null) => void;
}

function StatusDot({ worker }: { worker: Worker }) {
  const s = getProfileStatus(worker);
  if (s === 'full') return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Đủ hồ sơ" />;
  if (s === 'missing_cccd_sdt') return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Thiếu CCCD/SĐT" />;
  return <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" title="Chưa phân phòng" />;
}

export default function RoomDrawer({ ktx, building, buildingRaw, room, workers, adminAssignedUnit, roomLabel, onClose, onUnitUpdated, onRoomLabelUpdated }: Props) {
  const { isAdmin } = useAuth();

  // --- Room Label state ---
  const [labelInput, setLabelInput] = useState(roomLabel ?? '');
  const [localLabel, setLocalLabel] = useState<string | null>(roomLabel ?? null);
  const [savingLabel, setSavingLabel] = useState(false);
  const [labelError, setLabelError] = useState<string | null>(null);
  const [labelSuccess, setLabelSuccess] = useState(false);

  useEffect(() => {
    setLabelInput(roomLabel ?? '');
    setLocalLabel(roomLabel ?? null);
  }, [roomLabel]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  /** Resolve the effective day_nha value for Supabase queries */
  const resolveEffectiveDayNha = useCallback((): string => {
    if (buildingRaw && buildingRaw.trim()) return buildingRaw.trim();
    if (building && building.trim()) {
      const afterDot = building.match(/·\s*(.+)$/);
      if (afterDot) return afterDot[1].trim();
      return building.trim();
    }
    const titleMatch = building.match(/^(Dãy\s*\S+)/i);
    if (titleMatch) return titleMatch[1].trim();
    return building || '';
  }, [buildingRaw, building]);

  /** Save room_label directly to room_units table */
  const handleSaveRoomLabel = useCallback(async () => {
    setSavingLabel(true);
    setLabelError(null);
    setLabelSuccess(false);
    try {
      const supabase = createClient();
      const trimmed = labelInput.trim();
      const effectiveDayNha = resolveEffectiveDayNha();

      const { error } = await supabase
        .from('room_units')
        .upsert(
          {
            ktx,
            day_nha: effectiveDayNha,
            phong_so: room,
            unit: adminAssignedUnit ?? '',
            room_label: trimmed || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'ktx,day_nha,phong_so' }
        );

      if (error) {
        throw new Error(`Lỗi lưu tên phòng: ${error.message}`);
      }

      const newLabel = trimmed || null;
      setLocalLabel(newLabel);
      onRoomLabelUpdated?.(newLabel);
      setLabelSuccess(true);
      setTimeout(() => setLabelSuccess(false), 2500);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLabelError(msg || 'Lỗi lưu tên phòng — vui lòng thử lại');
    } finally {
      setSavingLabel(false);
    }
  }, [ktx, room, labelInput, adminAssignedUnit, resolveEffectiveDayNha, onRoomLabelUpdated]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md bg-card shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-primary/5">
          <div>
            <h2 className="text-base font-bold text-foreground">
              {localLabel ? localLabel : `${building} — Phòng ${room}`}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {building} — Phòng {room} · {workers.length} công nhân
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Room Label section */}
        {isAdmin && (
          <div className="px-5 py-3 border-b border-border bg-violet-50/50">
            <div className="flex items-center gap-2 mb-2">
              <Tag size={13} className="text-violet-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-violet-700">Tên/Nhãn phòng tùy chỉnh</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={labelInput}
                onChange={e => setLabelInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSaveRoomLabel(); }}
                placeholder={`Ví dụ: Phòng Đại đội 5...`}
                className="flex-1 min-w-0 text-xs border border-violet-300 rounded px-2.5 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-violet-400 disabled:opacity-50"
                disabled={savingLabel}
              />
              <button
                onClick={handleSaveRoomLabel}
                disabled={savingLabel}
                className="flex-shrink-0 px-3 py-1.5 rounded bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold transition-colors disabled:opacity-50"
              >
                {savingLabel ? 'Đang lưu...' : 'Lưu tên phòng'}
              </button>
            </div>
            {labelError && <p className="text-xs text-red-500 mt-1">{labelError}</p>}
            {labelSuccess && <p className="text-xs text-green-600 mt-1">✓ Đã lưu tên phòng thành công!</p>}
            {localLabel && (
              <p className="text-[10px] text-violet-600 mt-1">Tên hiện tại: <span className="font-semibold">{localLabel}</span></p>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-5 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />Đủ hồ sơ</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Thiếu CCCD/SĐT</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Chưa phân phòng</span>
        </div>

        {/* Worker list */}
        <div className="flex-1 overflow-y-auto scrollbar-thin">
          {workers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <Users size={40} className="text-muted-foreground mb-3" />
              <p className="text-sm font-semibold text-foreground">Phòng trống</p>
              <p className="text-xs text-muted-foreground mt-1">Chưa có công nhân nào trong phòng này</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {workers.map((w, idx) => {
                const soNgay = calcSoNgay(w.ngayVaoKTX, w.ngayRaKTX);
                return (
                  <div key={w.id} className="px-5 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
                        <span className="text-xs text-muted-foreground w-5 text-right">{idx + 1}</span>
                        <StatusDot worker={w} />
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                          {w.hoVaTen.split(' ').pop()?.charAt(0) ?? '?'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-foreground truncate">{w.hoVaTen}</p>
                          {w.tieuDoan && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary/10 text-primary flex-shrink-0">TD {w.tieuDoan}</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{w.maNV || 'Chưa có mã'}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
                          {w.soDienThoai && (
                            <span className="flex items-center gap-1 text-xs text-foreground">
                              <Phone size={10} className="text-muted-foreground" />{w.soDienThoai}
                            </span>
                          )}
                          {w.cccd && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <CreditCard size={10} />{w.cccd.slice(0,3)}****{w.cccd.slice(-3)}
                            </span>
                          )}
                          {w.hoKhauTinh && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin size={10} />{w.hoKhauTinh}
                            </span>
                          )}
                          {soNgay !== null && (
                            <span className="flex items-center gap-1 text-xs text-foreground font-semibold">
                              <Calendar size={10} className="text-muted-foreground" />{soNgay} ngày
                            </span>
                          )}
                        </div>
                        {w.toTruong && (
                          <p className="text-xs text-muted-foreground mt-1">Tổ trưởng: {w.toTruong}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
