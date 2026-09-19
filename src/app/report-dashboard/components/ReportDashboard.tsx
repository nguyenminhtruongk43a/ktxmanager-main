'use client';

import React, { useState, useMemo } from 'react';
import { Users, LayoutGrid, Percent, AlertCircle, VenusAndMars, HardHat, Building2 } from 'lucide-react';
import { useWorkers } from '@/context/WorkerContext';
import { Worker, ROOM_CAPACITY, getUniqueBuildings, getUniqueRooms, countUniqueBuildings } from '@/data/workers';

type GenderFilter = 'all' | 'male' | 'female';
type UnitFilter = 'all' | 'xd' | 'me' | 'vinalpha' | 'other';
type KtxFilter = 'all' | 'KTX 1' | 'KTX 2';

interface FilterState {
  gender: GenderFilter;
  unit: UnitFilter;
  ktx: KtxFilter;
  building: string;
  room: string;
}

const DEFAULT_FILTERS: FilterState = {
  gender: 'all',
  unit: 'all',
  ktx: 'all',
  building: '',
  room: '',
};

function matchesGender(w: Worker, g: GenderFilter): boolean {
  if (g === 'all') return true;
  const gt = (w.gioiTinh || '').toLowerCase();
  if (g === 'male') return gt.includes('nam');
  if (g === 'female') return gt.includes('nữ') || gt.includes('nu');
  return true;
}

function matchesUnit(w: Worker, u: UnitFilter): boolean {
  if (u === 'all') return true;
  const dv = (w.donVi || '').toLowerCase();
  if (u === 'xd') return dv.includes('xd') || dv.includes('xây') || dv.includes('xay');
  if (u === 'me') return dv.includes('me') || dv.includes('cơ') || dv.includes('co');
  if (u === 'vinalpha') return dv.includes('vinalpha') || dv.includes('alpha');
  if (u === 'other') {
    const isXd = dv.includes('xd') || dv.includes('xây') || dv.includes('xay');
    const isMe = dv.includes('me') || dv.includes('cơ') || dv.includes('co');
    const isVa = dv.includes('vinalpha') || dv.includes('alpha');
    return !isXd && !isMe && !isVa;
  }
  return true;
}

function matchesKtx(w: Worker, k: KtxFilter): boolean {
  if (k === 'all') return true;
  return w.ktx === k;
}

export default function ReportDashboard() {
  const { workers, loading } = useWorkers();
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const set = (key: keyof FilterState, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  // Filtered workers based on all filter controls
  const filtered = useMemo(() => {
    return workers.filter(w => {
      if (!matchesGender(w, filters.gender)) return false;
      if (!matchesUnit(w, filters.unit)) return false;
      if (!matchesKtx(w, filters.ktx)) return false;
      if (filters.building && w.day !== filters.building) return false;
      if (filters.room && w.phongSo !== filters.room) return false;
      return true;
    });
  }, [workers, filters]);

  // Dynamic stats from filtered workers
  const stats = useMemo(() => {
    const total = filtered.length;
    const male = filtered.filter(w => (w.gioiTinh || '').toLowerCase().includes('nam')).length;
    const female = filtered.filter(w => {
      const g = (w.gioiTinh || '').toLowerCase();
      return g.includes('nữ') || g.includes('nu');
    }).length;

    const xd = filtered.filter(w => {
      const dv = (w.donVi || '').toLowerCase();
      return dv.includes('xd') || dv.includes('xây') || dv.includes('xay');
    }).length;
    const me = filtered.filter(w => {
      const dv = (w.donVi || '').toLowerCase();
      return dv.includes('me') || dv.includes('cơ') || dv.includes('co');
    }).length;
    const vinalpha = filtered.filter(w => {
      const dv = (w.donVi || '').toLowerCase();
      return dv.includes('vinalpha') || dv.includes('alpha');
    }).length;
    const otherUnit = Math.max(0, total - xd - me - vinalpha);

    const ktx1 = filtered.filter(w => (w.ktx || '').includes('1')).length;
    const ktx2 = filtered.filter(w => (w.ktx || '').includes('2')).length;

    // Buildings & rooms from filtered workers
    const buildingCount = countUniqueBuildings(filtered);
    const roomSet = new Set<string>();
    filtered.forEach(w => {
      if (w.day && w.phongSo) roomSet.add(`${w.ktx}||${w.day}||${w.phongSo}`);
    });
    const roomCount = roomSet.size;
    const capacity = roomCount * ROOM_CAPACITY;
    const workersWithRoom = filtered.filter(w => w.day && w.phongSo).length;
    const fillRate = capacity > 0 ? Math.round((workersWithRoom / capacity) * 100) : 0;
    const missingData = filtered.filter(w => !w.day || !w.phongSo).length;

    return {
      total,
      male,
      female,
      xd,
      me,
      vinalpha,
      otherUnit,
      ktx1,
      ktx2,
      buildingCount,
      roomCount,
      capacity,
      fillRate,
      workersWithRoom,
      missingData,
    };
  }, [filtered]);

  // Dropdown options (derived from all workers, not filtered, so options don't disappear)
  const buildingList = useMemo(() => getUniqueBuildings(workers), [workers]);
  const roomList = useMemo(() => {
    const base = filters.building ? workers.filter(w => w.day === filters.building) : workers;
    return getUniqueRooms(base, filters.building || undefined);
  }, [workers, filters.building]);

  const hasActiveFilter =
    filters.gender !== 'all' ||
    filters.unit !== 'all' ||
    filters.ktx !== 'all' ||
    filters.building !== '' ||
    filters.room !== '';

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-medium animate-pulse">
        Đang đồng bộ dữ liệu thực tế từ Supabase Database...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Filter Bar */}
      <div className="bg-white rounded-xl border p-4 shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Gender */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-sm font-medium text-foreground mb-1">Giới tính</label>
            <select
              value={filters.gender}
              onChange={e => set('gender', e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            >
              <option value="all">Tất cả</option>
              <option value="male">Nam</option>
              <option value="female">Nữ</option>
            </select>
          </div>

          {/* Unit */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-sm font-medium text-foreground mb-1">Đơn vị / Nhà thầu</label>
            <select
              value={filters.unit}
              onChange={e => set('unit', e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            >
              <option value="all">Tất cả</option>
              <option value="xd">XD</option>
              <option value="me">ME</option>
              <option value="vinalpha">Vinalpha</option>
              <option value="other">Khác</option>
            </select>
          </div>

          {/* KTX */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-sm font-medium text-foreground mb-1">KTX</label>
            <select
              value={filters.ktx}
              onChange={e => { setFilters(prev => ({ ...prev, ktx: e.target.value as KtxFilter, building: '', room: '' })); }}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            >
              <option value="all">Tất cả KTX</option>
              <option value="KTX 1">KTX 1</option>
              <option value="KTX 2">KTX 2</option>
            </select>
          </div>

          {/* Building */}
          <div className="flex flex-col gap-1 min-w-[130px]">
            <label className="text-sm font-medium text-foreground mb-1">Dãy nhà</label>
            <select
              value={filters.building}
              onChange={e => { setFilters(prev => ({ ...prev, building: e.target.value, room: '' })); }}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            >
              <option value="">Tất cả dãy</option>
              {buildingList.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>

          {/* Room */}
          <div className="flex flex-col gap-1 min-w-[110px]">
            <label className="text-sm font-medium text-foreground mb-1">Phòng</label>
            <select
              value={filters.room}
              onChange={e => set('room', e.target.value)}
              className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors"
            >
              <option value="">Tất cả phòng</option>
              {roomList.map(r => <option key={r} value={r}>Phòng {r}</option>)}
            </select>
          </div>

          {/* Clear */}
          {hasActiveFilter && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-foreground mb-1 opacity-0">x</label>
              <button
                onClick={() => setFilters(DEFAULT_FILTERS)}
                className="flex items-center gap-1 px-3 py-2 rounded-lg bg-transparent text-muted-foreground text-sm font-medium hover:bg-muted hover:text-foreground transition-all"
              >
                ✕ Xóa bộ lọc
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Khối KPI Tổng Quan */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CÔNG NHÂN</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.total.toLocaleString('vi-VN')}</h3>
            <p className="text-xs text-gray-500 mt-1">{stats.ktx1 + stats.ktx2 > 0 ? `${new Set(filtered.map(w => w.ktx).filter(Boolean)).size} ký túc xá` : ''} • {stats.buildingCount} dãy</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">SỐ DÃY / SỐ PHÒNG</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.buildingCount} dãy / {stats.roomCount} phòng</h3>
            <p className="text-xs text-gray-500 mt-1">Sức chứa: {stats.capacity} chỗ</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <LayoutGrid className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">TỶ LỆ LẤP ĐẦY</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.fillRate}%</h3>
            <p className="text-xs text-gray-500 mt-1">{stats.workersWithRoom}/{stats.capacity} chỗ đã dùng</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">THIẾU DỮ LIỆU</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.missingData}</h3>
            <p className="text-xs text-gray-500 mt-1">Chưa phân phòng / dãy</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Khối Báo Cáo Thống Kê Chi Tiết */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Thống kê giới tính */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <VenusAndMars size={18} className="text-blue-500" /> Thống kê giới tính
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-blue-600 block mb-1">Nam</span>
              <span className="text-2xl font-black text-blue-700">{stats.male}</span>
            </div>
            <div className="bg-pink-50/60 border border-pink-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-pink-600 block mb-1">Nữ</span>
              <span className="text-2xl font-black text-pink-700">{stats.female}</span>
            </div>
          </div>
        </div>

        {/* Thống kê Đơn vị / Nhà thầu */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <HardHat size={18} className="text-amber-500" /> Đơn vị / Nhà thầu
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">XD</span>
              <span className="text-lg font-black text-amber-700">{stats.xd}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">ME</span>
              <span className="text-lg font-black text-amber-700">{stats.me}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">Vinalpha</span>
              <span className="text-lg font-black text-amber-700">{stats.vinalpha}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">Khác</span>
              <span className="text-lg font-black text-amber-700">{stats.otherUnit}</span>
            </div>
          </div>
        </div>

        {/* Phân bổ Khu KTX */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Building2 size={18} className="text-indigo-500" /> Phân bổ theo Khu KTX
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-indigo-50/60 border border-indigo-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-indigo-600 block mb-1">KTX 1</span>
              <span className="text-2xl font-black text-indigo-700">{stats.ktx1}</span>
              <span className="text-[10px] text-gray-400 block mt-1">công nhân</span>
            </div>
            <div className="bg-violet-50/60 border border-violet-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-violet-600 block mb-1">KTX 2</span>
              <span className="text-2xl font-black text-violet-700">{stats.ktx2}</span>
              <span className="text-[10px] text-gray-400 block mt-1">công nhân</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
