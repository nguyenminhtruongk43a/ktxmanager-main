'use client';

import React, { useState, useMemo } from 'react';
import { Users, LayoutGrid, Percent, AlertCircle, VenusAndMars, HardHat, Building2, ArrowRightLeft, LogIn, LogOut, RefreshCw, Search, Filter, Calendar, TrendingUp,  } from 'lucide-react';
import { useWorkers } from '@/context/WorkerContext';
import { Worker, ROOM_CAPACITY, getUniqueBuildings, getUniqueRooms, countUniqueBuildings } from '@/data/workers';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type GenderFilter = 'all' | 'male' | 'female';
type UnitFilter = 'all' | 'xd' | 'me' | 'vinalpha' | 'other';
type KtxFilter = 'all' | 'KTX 1' | 'KTX 2';
type MovementType = 'all' | 'check-in' | 'check-out' | 'room-change' | 'register';
type ActiveTab = 'tong-quan' | 'bien-dong';

interface FilterState {
  gender: GenderFilter;
  unit: UnitFilter;
  ktx: KtxFilter;
  building: string;
  room: string;
}

interface MovementRecord {
  id: string;
  date: string;
  workerName: string;
  maNV: string;
  type: MovementType;
  fromRoom?: string;
  toRoom?: string;
  ktx: string;
  unit: string;
  note: string;
}

const DEFAULT_FILTERS: FilterState = {
  gender: 'all',
  unit: 'all',
  ktx: 'all',
  building: '',
  room: '',
};

// ─── Helper functions ─────────────────────────────────────────────────────────
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

// ─── Mock movement data (derived from workers list) ──────────────────────────
function generateMovementData(workers: Worker[]): MovementRecord[] {
  const types: MovementType[] = ['check-in', 'check-out', 'room-change', 'register'];
  const notes: Record<MovementType, string> = {
    'check-in': 'Nhận phòng mới',
    'check-out': 'Trả phòng / rời KTX',
    'room-change': 'Chuyển phòng theo yêu cầu',
    'register': 'Đăng ký lưu trú',
    'all': '',
  };

  const baseDate = new Date('2026-09-01');
  return workers.slice(0, Math.min(workers.length, 60)).map((w, i) => {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + (i % 20));
    const type = types[i % types.length];
    const fromRoom = type === 'room-change' ? `${w.ktx} - Dãy A - P.${100 + (i % 10)}` : undefined;
    const toRoom =
      type === 'check-in' || type === 'room-change'
        ? `${w.ktx} - ${w.day || 'Dãy 1'} - P.${w.phongSo || '101'}`
        : undefined;
    return {
      id: `mv-${w.id}`,
      date: d.toISOString().split('T')[0],
      workerName: w.hoVaTen,
      maNV: w.maNV,
      type,
      fromRoom,
      toRoom,
      ktx: w.ktx || 'KTX 1',
      unit: w.donVi || '',
      note: notes[type],
    };
  });
}

// ─── Movement type badge ──────────────────────────────────────────────────────
const TYPE_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  'check-in': {
    label: 'Nhận phòng',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <LogIn size={12} />,
  },
  'check-out': {
    label: 'Trả phòng',
    color: 'bg-rose-100 text-rose-700 border-rose-200',
    icon: <LogOut size={12} />,
  },
  'room-change': {
    label: 'Chuyển phòng',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <RefreshCw size={12} />,
  },
  'register': {
    label: 'Đăng ký',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: <ArrowRightLeft size={12} />,
  },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] || { label: type, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Chart data builder ───────────────────────────────────────────────────────
function buildChartData(records: MovementRecord[]) {
  const byDate: Record<string, { date: string; 'Nhận phòng': number; 'Trả phòng': number; 'Chuyển phòng': number; 'Đăng ký': number }> = {};
  records.forEach(r => {
    if (!byDate[r.date]) {
      byDate[r.date] = { date: r.date, 'Nhận phòng': 0, 'Trả phòng': 0, 'Chuyển phòng': 0, 'Đăng ký': 0 };
    }
    if (r.type === 'check-in') byDate[r.date]['Nhận phòng']++;
    if (r.type === 'check-out') byDate[r.date]['Trả phòng']++;
    if (r.type === 'room-change') byDate[r.date]['Chuyển phòng']++;
    if (r.type === 'register') byDate[r.date]['Đăng ký']++;
  });
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportDashboard() {
  const { workers, loading } = useWorkers();
  const [activeTab, setActiveTab] = useState<ActiveTab>('tong-quan');

  // ── Tổng quan filters ──
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const set = (key: keyof FilterState, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  // ── Biến động filters ──
  const [mvSearch, setMvSearch] = useState('');
  const [mvType, setMvType] = useState<MovementType>('all');
  const [mvKtx, setMvKtx] = useState<KtxFilter>('all');
  const [mvDateFrom, setMvDateFrom] = useState('');
  const [mvDateTo, setMvDateTo] = useState('');

  // ── Tổng quan computed ──
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

  const stats = useMemo(() => {
    const total = filtered.length;
    const male = filtered.filter(w => (w.gioiTinh || '').toLowerCase().includes('nam')).length;
    const female = filtered.filter(w => {
      const g = (w.gioiTinh || '').toLowerCase();
      return g.includes('nữ') || g.includes('nu');
    }).length;
    const xd = filtered.filter(w => { const dv = (w.donVi || '').toLowerCase(); return dv.includes('xd') || dv.includes('xây') || dv.includes('xay'); }).length;
    const me = filtered.filter(w => { const dv = (w.donVi || '').toLowerCase(); return dv.includes('me') || dv.includes('cơ') || dv.includes('co'); }).length;
    const vinalpha = filtered.filter(w => { const dv = (w.donVi || '').toLowerCase(); return dv.includes('vinalpha') || dv.includes('alpha'); }).length;
    const otherUnit = Math.max(0, total - xd - me - vinalpha);
    const ktx1 = filtered.filter(w => (w.ktx || '').includes('1')).length;
    const ktx2 = filtered.filter(w => (w.ktx || '').includes('2')).length;
    const buildingCount = countUniqueBuildings(filtered);
    const roomSet = new Set<string>();
    filtered.forEach(w => { if (w.day && w.phongSo) roomSet.add(`${w.ktx}||${w.day}||${w.phongSo}`); });
    const roomCount = roomSet.size;
    const capacity = roomCount * ROOM_CAPACITY;
    const workersWithRoom = filtered.filter(w => w.day && w.phongSo).length;
    const fillRate = capacity > 0 ? Math.round((workersWithRoom / capacity) * 100) : 0;
    const missingData = filtered.filter(w => !w.day || !w.phongSo).length;
    return { total, male, female, xd, me, vinalpha, otherUnit, ktx1, ktx2, buildingCount, roomCount, capacity, fillRate, workersWithRoom, missingData };
  }, [filtered]);

  const buildingList = useMemo(() => getUniqueBuildings(workers), [workers]);
  const roomList = useMemo(() => {
    const base = filters.building ? workers.filter(w => w.day === filters.building) : workers;
    return getUniqueRooms(base, filters.building || undefined);
  }, [workers, filters.building]);

  const hasActiveFilter =
    filters.gender !== 'all' || filters.unit !== 'all' || filters.ktx !== 'all' ||
    filters.building !== '' || filters.room !== '';

  // ── Biến động computed ──
  const allMovements = useMemo(() => generateMovementData(workers), [workers]);

  const filteredMovements = useMemo(() => {
    return allMovements.filter(r => {
      if (mvType !== 'all' && r.type !== mvType) return false;
      if (mvKtx !== 'all' && r.ktx !== mvKtx) return false;
      if (mvDateFrom && r.date < mvDateFrom) return false;
      if (mvDateTo && r.date > mvDateTo) return false;
      if (mvSearch) {
        const q = mvSearch.toLowerCase();
        if (!r.workerName.toLowerCase().includes(q) && !r.maNV.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allMovements, mvType, mvKtx, mvDateFrom, mvDateTo, mvSearch]);

  const mvStats = useMemo(() => ({
    total: filteredMovements.length,
    checkIn: filteredMovements.filter(r => r.type === 'check-in').length,
    checkOut: filteredMovements.filter(r => r.type === 'check-out').length,
    roomChange: filteredMovements.filter(r => r.type === 'room-change').length,
    register: filteredMovements.filter(r => r.type === 'register').length,
  }), [filteredMovements]);

  const chartData = useMemo(() => buildChartData(filteredMovements), [filteredMovements]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-medium animate-pulse">
        Đang đồng bộ dữ liệu thực tế từ Supabase Database...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* ── Tab Header ── */}
      <div className="flex items-center gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('tong-quan')}
          className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all ${
            activeTab === 'tong-quan' ?'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px' :'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          📊 Tổng quan
        </button>
        <button
          onClick={() => setActiveTab('bien-dong')}
          className={`px-5 py-3 text-sm font-semibold rounded-t-lg transition-all ${
            activeTab === 'bien-dong'
              ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px' :'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
          }`}
        >
          🔄 Biến động
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: TỔNG QUAN                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tong-quan' && (
        <div className="space-y-6">
          {/* Filter Bar */}
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex flex-col gap-1 min-w-[130px]">
                <label className="text-sm font-medium text-foreground mb-1">Giới tính</label>
                <select value={filters.gender} onChange={e => set('gender', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors">
                  <option value="all">Tất cả</option>
                  <option value="male">Nam</option>
                  <option value="female">Nữ</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[130px]">
                <label className="text-sm font-medium text-foreground mb-1">Đơn vị / Nhà thầu</label>
                <select value={filters.unit} onChange={e => set('unit', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors">
                  <option value="all">Tất cả</option>
                  <option value="xd">XD</option>
                  <option value="me">ME</option>
                  <option value="vinalpha">Vinalpha</option>
                  <option value="other">Khác</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[130px]">
                <label className="text-sm font-medium text-foreground mb-1">KTX</label>
                <select value={filters.ktx} onChange={e => { setFilters(prev => ({ ...prev, ktx: e.target.value as KtxFilter, building: '', room: '' })); }}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors">
                  <option value="all">Tất cả KTX</option>
                  <option value="KTX 1">KTX 1</option>
                  <option value="KTX 2">KTX 2</option>
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[130px]">
                <label className="text-sm font-medium text-foreground mb-1">Dãy nhà</label>
                <select value={filters.building} onChange={e => { setFilters(prev => ({ ...prev, building: e.target.value, room: '' })); }}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors">
                  <option value="">Tất cả dãy</option>
                  {buildingList.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="flex flex-col gap-1 min-w-[110px]">
                <label className="text-sm font-medium text-foreground mb-1">Phòng</label>
                <select value={filters.room} onChange={e => set('room', e.target.value)}
                  className="w-full bg-input border border-border rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-primary transition-colors">
                  <option value="">Tất cả phòng</option>
                  {roomList.map(r => <option key={r} value={r}>Phòng {r}</option>)}
                </select>
              </div>
              {hasActiveFilter && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-foreground mb-1 opacity-0">x</label>
                  <button onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="flex items-center gap-1 px-3 py-2 rounded-lg bg-transparent text-muted-foreground text-sm font-medium hover:bg-muted hover:text-foreground transition-all">
                    ✕ Xóa bộ lọc
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CÔNG NHÂN</p>
                <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.total.toLocaleString('vi-VN')}</h3>
                <p className="text-xs text-gray-500 mt-1">{stats.buildingCount} dãy</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><Users className="w-6 h-6" /></div>
            </div>
            <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">SỐ DÃY / SỐ PHÒNG</p>
                <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.buildingCount} dãy / {stats.roomCount} phòng</h3>
                <p className="text-xs text-gray-500 mt-1">Sức chứa: {stats.capacity} chỗ</p>
              </div>
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><LayoutGrid className="w-6 h-6" /></div>
            </div>
            <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">TỶ LỆ LẤP ĐẦY</p>
                <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.fillRate}%</h3>
                <p className="text-xs text-gray-500 mt-1">{stats.workersWithRoom}/{stats.capacity} chỗ đã dùng</p>
              </div>
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><Percent className="w-6 h-6" /></div>
            </div>
            <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">THIẾU DỮ LIỆU</p>
                <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.missingData}</h3>
                <p className="text-xs text-gray-500 mt-1">Chưa phân phòng / dãy</p>
              </div>
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl"><AlertCircle className="w-6 h-6" /></div>
            </div>
          </div>

          {/* Detail Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
      )}

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* TAB: BIẾN ĐỘNG                                                        */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bien-dong' && (
        <div className="space-y-6">
          {/* ── KPI Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-gray-100 rounded-lg"><ArrowRightLeft size={18} className="text-gray-600" /></div>
              <div>
                <p className="text-xs text-gray-400 font-semibold uppercase">Tổng biến động</p>
                <p className="text-2xl font-extrabold text-gray-900">{mvStats.total}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-emerald-50 rounded-lg"><LogIn size={18} className="text-emerald-600" /></div>
              <div>
                <p className="text-xs text-emerald-600 font-semibold uppercase">Nhận phòng</p>
                <p className="text-2xl font-extrabold text-emerald-700">{mvStats.checkIn}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-rose-50 rounded-lg"><LogOut size={18} className="text-rose-600" /></div>
              <div>
                <p className="text-xs text-rose-600 font-semibold uppercase">Trả phòng</p>
                <p className="text-2xl font-extrabold text-rose-700">{mvStats.checkOut}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-amber-50 rounded-lg"><RefreshCw size={18} className="text-amber-600" /></div>
              <div>
                <p className="text-xs text-amber-600 font-semibold uppercase">Chuyển phòng</p>
                <p className="text-2xl font-extrabold text-amber-700">{mvStats.roomChange}</p>
              </div>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm flex items-center gap-3">
              <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp size={18} className="text-blue-600" /></div>
              <div>
                <p className="text-xs text-blue-600 font-semibold uppercase">Đăng ký</p>
                <p className="text-2xl font-extrabold text-blue-700">{mvStats.register}</p>
              </div>
            </div>
          </div>

          {/* ── Bar Chart ── */}
          {chartData.length > 0 && (
            <div className="bg-white rounded-xl border p-5 shadow-sm">
              <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-500" />
                Biểu đồ biến động theo ngày
              </h4>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Nhận phòng" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Trả phòng" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Chuyển phòng" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Đăng ký" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Filters ── */}
          <div className="bg-white rounded-xl border p-4 shadow-sm">
            <div className="flex flex-wrap gap-3 items-end">
              {/* Search */}
              <div className="flex flex-col gap-1 min-w-[200px] flex-1">
                <label className="text-sm font-medium text-gray-700 mb-1">Tìm kiếm công nhân</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Tên hoặc mã nhân viên..."
                    value={mvSearch}
                    onChange={e => setMvSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                  />
                </div>
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1 min-w-[150px]">
                <label className="text-sm font-medium text-gray-700 mb-1">Loại biến động</label>
                <select value={mvType} onChange={e => setMvType(e.target.value as MovementType)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="all">Tất cả loại</option>
                  <option value="check-in">Nhận phòng</option>
                  <option value="check-out">Trả phòng</option>
                  <option value="room-change">Chuyển phòng</option>
                  <option value="register">Đăng ký</option>
                </select>
              </div>

              {/* KTX */}
              <div className="flex flex-col gap-1 min-w-[120px]">
                <label className="text-sm font-medium text-gray-700 mb-1">KTX</label>
                <select value={mvKtx} onChange={e => setMvKtx(e.target.value as KtxFilter)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300">
                  <option value="all">Tất cả KTX</option>
                  <option value="KTX 1">KTX 1</option>
                  <option value="KTX 2">KTX 2</option>
                </select>
              </div>

              {/* Date From */}
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-sm font-medium text-gray-700 mb-1">Từ ngày</label>
                <input type="date" value={mvDateFrom} onChange={e => setMvDateFrom(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {/* Date To */}
              <div className="flex flex-col gap-1 min-w-[140px]">
                <label className="text-sm font-medium text-gray-700 mb-1">Đến ngày</label>
                <input type="date" value={mvDateTo} onChange={e => setMvDateTo(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300" />
              </div>

              {/* Clear */}
              {(mvSearch || mvType !== 'all' || mvKtx !== 'all' || mvDateFrom || mvDateTo) && (
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700 mb-1 opacity-0">x</label>
                  <button
                    onClick={() => { setMvSearch(''); setMvType('all'); setMvKtx('all'); setMvDateFrom(''); setMvDateTo(''); }}
                    className="px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-all">
                    ✕ Xóa lọc
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ── History Table ── */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b flex items-center justify-between">
              <h4 className="font-bold text-gray-800 flex items-center gap-2">
                <Calendar size={16} className="text-blue-500" />
                Lịch sử biến động nhân sự
              </h4>
              <span className="text-xs text-gray-400 font-medium">{filteredMovements.length} bản ghi</span>
            </div>

            {filteredMovements.length === 0 ? (
              <div className="py-16 text-center text-gray-400">
                <ArrowRightLeft size={36} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Không có dữ liệu biến động phù hợp</p>
                <p className="text-xs mt-1">Thử thay đổi bộ lọc hoặc khoảng thời gian</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ngày</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Họ và tên</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Mã NV</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Loại biến động</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">KTX</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Phòng đi</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Phòng đến</th>
                      <th className="text-left px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider whitespace-nowrap">Ghi chú</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredMovements.map((r, idx) => (
                      <tr key={r.id} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap font-mono text-xs">{r.date}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900 whitespace-nowrap">{r.workerName}</td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap font-mono text-xs">{r.maNV}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><TypeBadge type={r.type} /></td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{r.ktx}</td>
                        <td className="px-4 py-3 text-gray-400 whitespace-nowrap text-xs">{r.fromRoom || '—'}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">{r.toRoom || '—'}</td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{r.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
