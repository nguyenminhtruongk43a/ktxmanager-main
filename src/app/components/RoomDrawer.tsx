'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Worker, calcSoNgay, getProfileStatus } from '@/data/workers';
import { X, Users, Phone, CreditCard, MapPin, Calendar, Building2, Pencil, Check, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface Props {
  ktx: string;
  building: string;
  buildingRaw: string;
  room: string;
  workers: Worker[];
  adminAssignedUnit?: string;
  onClose: () => void;
  onUnitUpdated?: (newUnit: string | null) => void;
}

function StatusDot({ worker }: { worker: Worker }) {
  const s = getProfileStatus(worker);
  if (s === 'full') return <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" title="Đủ hồ sơ" />;
  if (s === 'missing_cccd_sdt') return <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" title="Thiếu CCCD/SĐT" />;
  return <span className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" title="Chưa phân phòng" />;
}

export default function RoomDrawer({ ktx, building, buildingRaw, room, workers, adminAssignedUnit, onClose, onUnitUpdated }: Props) {
  const { isAdmin } = useAuth();
  const [isEditingUnit, setIsEditingUnit] = useState(false);
  const [unitInput, setUnitInput] = useState(adminAssignedUnit ?? '');
  // Local display value — updated optimistically after save
  const [localUnit, setLocalUnit] = useState<string | null>(adminAssignedUnit ?? null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setUnitInput(adminAssignedUnit ?? '');
    setLocalUnit(adminAssignedUnit ?? null);
  }, [adminAssignedUnit]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSaveUnit = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const trimmed = unitInput.trim();
      if (trimmed === '') {
        // Delete assignment if empty
        const { error } = await supabase
          .from('room_unit_assignments')
          .delete()
          .eq('ktx', ktx)
          .eq('day', buildingRaw)
          .eq('phong_so', room);
        if (error) throw error;
        setLocalUnit(null);
        onUnitUpdated?.(null);
      } else {
        // Upsert assignment
        const { error } = await supabase
          .from('room_unit_assignments')
          .upsert(
            { ktx, day: buildingRaw, phong_so: room, don_vi: trimmed, updated_at: new Date().toISOString() },
            { onConflict: 'ktx,day,phong_so' }
          );
        if (error) throw error;
        setLocalUnit(trimmed);
        onUnitUpdated?.(trimmed);
      }
      setIsEditingUnit(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Lỗi lưu đơn vị');
    } finally {
      setSaving(false);
    }
  }, [ktx, buildingRaw, room, unitInput, onUnitUpdated]);

  const handleRemoveUnit = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('room_unit_assignments')
        .delete()
        .eq('ktx', ktx)
        .eq('day', buildingRaw)
        .eq('phong_so', room);
      if (error) throw error;
      setUnitInput('');
      setLocalUnit(null);
      setIsEditingUnit(false);
      onUnitUpdated?.(null);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Lỗi xóa đơn vị');
    } finally {
      setSaving(false);
    }
  }, [ktx, buildingRaw, room, onUnitUpdated]);

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/30" onClick={onClose} />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-md bg-card shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-primary/5">
          <div>
            <h2 className="text-base font-bold text-foreground">{building} — Phòng {room}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{workers.length} công nhân</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Unit assignment section */}
        <div className="px-5 py-3 border-b border-border bg-indigo-50/50">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Building2 size={14} className="text-indigo-500 flex-shrink-0" />
              <span className="text-xs font-semibold text-indigo-700 flex-shrink-0">Đơn vị:</span>
              {isEditingUnit ? (
                <input
                  type="text"
                  value={unitInput}
                  onChange={e => setUnitInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveUnit(); if (e.key === 'Escape') setIsEditingUnit(false); }}
                  placeholder="Nhập tên đơn vị..."
                  className="flex-1 min-w-0 text-xs border border-indigo-300 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  autoFocus
                  disabled={saving}
                />
              ) : (
                <span className={`text-xs truncate ${localUnit ? 'font-semibold text-indigo-700' : 'text-muted-foreground italic'}`}>
                  {localUnit || 'Chưa gán đơn vị cố định'}
                </span>
              )}
            </div>
            {isAdmin && (
              <div className="flex items-center gap-1 flex-shrink-0">
                {isEditingUnit ? (
                  <>
                    <button
                      onClick={handleSaveUnit}
                      disabled={saving}
                      className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600 transition-colors disabled:opacity-50"
                      title="Lưu"
                    >
                      <Check size={14} />
                    </button>
                    {localUnit && (
                      <button
                        onClick={handleRemoveUnit}
                        disabled={saving}
                        className="p-1.5 rounded hover:bg-red-100 text-red-500 transition-colors disabled:opacity-50"
                        title="Xóa gán đơn vị"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => { setIsEditingUnit(false); setUnitInput(localUnit ?? ''); setSaveError(null); }}
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground transition-colors"
                      title="Hủy"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setIsEditingUnit(true)}
                    className="p-1.5 rounded hover:bg-indigo-100 text-indigo-500 transition-colors"
                    title="Chỉnh sửa đơn vị"
                  >
                    <Pencil size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
          {saveError && <p className="text-xs text-red-500 mt-1">{saveError}</p>}
          {isAdmin && !isEditingUnit && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {localUnit
                ? 'Đơn vị do Admin gán cố định. Nhấn bút chì để chỉnh sửa.'
                : 'Nhấn bút chì để gán đơn vị cố định cho phòng này.'}
            </p>
          )}
        </div>

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
