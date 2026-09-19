'use client';
import React from 'react';
import { Search, X } from 'lucide-react';
import { FilterState } from './WorkerManagementClient';
import { Worker, getUniqueKTX, getUniqueBuildings, getUniqueRooms, getUniquePlatoons } from '@/data/workers';

interface Props {
  filters: FilterState;
  onChange: (f: FilterState) => void;
  workers: Worker[];
}

export default function WorkerFilters({ filters, onChange, workers }: Props) {
  const set = (key: keyof FilterState, val: string | boolean) =>
    onChange({ ...filters, [key]: val });

  const ktxList = getUniqueKTX(workers);
  const buildingList = getUniqueBuildings(workers);
  const roomList = getUniqueRooms(workers, filters.building || undefined);
  const platoonList = getUniquePlatoons(workers);

  // Unique Tổ Trưởng list from workers
  const toTruongList = [...new Set(workers.map(w => w.toTruong).filter(Boolean))].sort();

  const hasActive = filters.search || filters.ktx || filters.building || filters.room ||
    filters.platoon || filters.profileStatus || filters.toTruong || filters.province || filters.tamTruStatus;

  return (
    <div className="card p-4 mb-4">
      <div className="flex flex-wrap gap-3 items-end">
        {/* Search */}
        <div className="flex-1 min-w-[200px] form-group">
          <label className="label-field">Tìm kiếm</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tên, mã NV, CCCD, SĐT..."
              value={filters.search}
              onChange={e => set('search', e.target.value)}
              className="input-field pl-8"
            />
          </div>
        </div>

        {/* KTX */}
        <div className="form-group min-w-[110px]">
          <label className="label-field">KTX</label>
          <select value={filters.ktx} onChange={e => set('ktx', e.target.value)} className="input-field">
            <option value="">Tất cả KTX</option>
            {ktxList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        {/* Building/Dãy */}
        <div className="form-group min-w-[130px]">
          <label className="label-field">Dãy nhà</label>
          <select value={filters.building} onChange={e => { set('building', e.target.value); onChange({ ...filters, building: e.target.value, room: '' }); }} className="input-field">
            <option value="">Tất cả dãy</option>
            {buildingList.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Room */}
        <div className="form-group min-w-[110px]">
          <label className="label-field">Phòng số</label>
          <select value={filters.room} onChange={e => set('room', e.target.value)} className="input-field">
            <option value="">Tất cả phòng</option>
            {roomList.map(r => <option key={r} value={r}>Phòng {r}</option>)}
          </select>
        </div>

        {/* Platoon */}
        <div className="form-group min-w-[130px]">
          <label className="label-field">Tiểu đoàn</label>
          <select value={filters.platoon} onChange={e => set('platoon', e.target.value)} className="input-field">
            <option value="">Tất cả TD</option>
            {platoonList.map(p => <option key={p} value={p}>TD {p}</option>)}
            <option value="__none__">Chưa phân</option>
          </select>
        </div>

        {/* Tổ Trưởng filter */}
        <div className="form-group min-w-[150px]">
          <label className="label-field">Tổ Trưởng</label>
          <select value={filters.toTruong} onChange={e => set('toTruong', e.target.value)} className="input-field">
            <option value="">Tất cả Tổ Trưởng</option>
            {toTruongList.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Profile status */}
        <div className="form-group min-w-[150px]">
          <label className="label-field">Trạng thái hồ sơ</label>
          <select value={filters.profileStatus} onChange={e => set('profileStatus', e.target.value)} className="input-field">
            <option value="">Tất cả</option>
            <option value="full">✅ Đủ hồ sơ</option>
            <option value="missing_cccd_sdt">🔴 Thiếu CCCD/SĐT</option>
            <option value="no_room">🟡 Chưa phân phòng</option>
          </select>
        </div>

        {/* Tạm trú status */}
        <div className="form-group min-w-[150px]">
          <label className="label-field">Tạm trú</label>
          <select value={filters.tamTruStatus} onChange={e => set('tamTruStatus', e.target.value)} className="input-field">
            <option value="">Tất cả</option>
            <option value="registered">🟢 Đã đăng ký</option>
            <option value="unregistered">🟠 Chưa đăng ký</option>
          </select>
        </div>

        {/* Province */}
        <div className="form-group min-w-[140px]">
          <label className="label-field">Tỉnh/TP</label>
          <input
            type="text"
            placeholder="Tỉnh/TP..."
            value={filters.province}
            onChange={e => set('province', e.target.value)}
            className="input-field"
          />
        </div>

        {/* Clear */}
        {hasActive && (
          <div className="form-group">
            <label className="label-field opacity-0">x</label>
            <button
              onClick={() => onChange({ search: '', ktx: '', building: '', room: '', platoon: '', profileStatus: '', toTruong: '', province: '', tamTruStatus: '' })}
              className="btn-ghost flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <X size={13} />Xóa bộ lọc
            </button>
          </div>
        )}
      </div>
    </div>
  );
}