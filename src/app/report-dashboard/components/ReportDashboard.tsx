'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Users, LayoutGrid, Percent, AlertCircle, VenusAndMars, HardHat, Building2, TrendingUp, TrendingDown, UserPlus, UserMinus, ArrowRightLeft, Calendar, Clock, RefreshCw, Filter, X,  } from 'lucide-react';
import { useWorkers } from '@/context/WorkerContext';
import { Worker, ROOM_CAPACITY, getUniqueBuildings, getUniqueRooms, countUniqueBuildings } from '@/data/workers';
import { createClient } from '@/lib/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line, ReferenceLine,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type GenderFilter = 'all' | 'male' | 'female';
type UnitFilter = 'all' | 'xd' | 'me' | 'vinalpha' | 'other';
type KtxFilter = 'all' | 'KTX 1' | 'KTX 2';
type ActiveTab = 'tong-quan' | 'bien-dong';
type FluctuationType = 'all' | 'tang' | 'giam' | 'rong';
type CutoffMode = 'realtime' | '14h';

interface FilterState {
  gender: GenderFilter;
  unit: UnitFilter;
  ktx: KtxFilter;
  building: string;
  room: string;
}

interface FluctuationFilter {
  dateFrom: string;
  dateTo: string;
  ktx: string;
  day: string;
  type: FluctuationType;
  cutoffMode: CutoffMode;
}

interface DailyFluctuation {
  ngay: string;
  so_tang: number;
  so_giam: number;
  bien_dong_rong: number;
}

interface FluctuationSummary {
  tong_tang: number;
  tong_giam: number;
  bien_dong_rong: number;
  so_ngay_co_bien_dong: number;
}

const DEFAULT_FILTERS: FilterState = {
  gender: 'all', unit: 'all', ktx: 'all', building: '', room: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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
    return !dv.includes('xd') && !dv.includes('xây') && !dv.includes('xay') &&
      !dv.includes('me') && !dv.includes('cơ') && !dv.includes('co') &&
      !dv.includes('vinalpha') && !dv.includes('alpha');
  }
  return true;
}

function matchesKtx(w: Worker, k: KtxFilter): boolean {
  if (k === 'all') return true;
  return w.ktx === k;
}

function getDefaultDateRange(): { from: string; to: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return { from, to };
}

function formatDateVN(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs">
      <p className="font-bold text-gray-700 mb-2">{formatDateVN(label)}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center gap-2 mb-1">
          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.fill || p.stroke }} />
          <span className="text-gray-600">{p.name}:</span>
          <span className="font-bold" style={{ color: p.fill || p.stroke }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportDashboard() {
  const { workers, loading: workersLoading } = useWorkers();
  const [activeTab, setActiveTab] = useState<ActiveTab>('tong-quan');

  // ── Tổng quan filters ──
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const set = (key: keyof FilterState, val: string) =>
    setFilters(prev => ({ ...prev, [key]: val }));

  // ── Biến động filters ──
  const defaultRange = getDefaultDateRange();
  const [flFilter, setFlFilter] = useState<FluctuationFilter>({
    dateFrom: defaultRange.from,
    dateTo: defaultRange.to,
    ktx: '',
    day: '',
    type: 'all',
    cutoffMode: '14h',
  });

  // ── Biến động data ──
  const [dailyData, setDailyData] = useState<DailyFluctuation[]>([]);
  const [summary, setSummary] = useState<FluctuationSummary | null>(null);
  const [flLoading, setFlLoading] = useState(false);
  const [flError, setFlError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<string>('');

  // ── Unique buildings from workers for filter ──
  const allBuildings = useMemo(() => getUniqueBuildings(workers), [workers]);
  const flBuildings = useMemo(() => {
    if (!flFilter.ktx) return allBuildings;
    return getUniqueBuildings(workers.filter(w => w.ktx === flFilter.ktx));
  }, [workers, flFilter.ktx, allBuildings]);

  // ── Fetch fluctuation data ──
  const fetchFluctuation = useCallback(async () => {
    setFlLoading(true);
    setFlError(null);
    const supabase = createClient();
    const cutoffHour = flFilter.cutoffMode === 'realtime' ? -1 : 14;

    try {
      const [dailyRes, summaryRes] = await Promise.all([
        supabase.rpc('get_worker_fluctuation', {
          p_date_from: flFilter.dateFrom || null,
          p_date_to: flFilter.dateTo || null,
          p_ktx: flFilter.ktx || null,
          p_day: flFilter.day || null,
          p_cutoff_hour: cutoffHour,
        }),
        supabase.rpc('get_worker_fluctuation_summary', {
          p_date_from: flFilter.dateFrom || null,
          p_date_to: flFilter.dateTo || null,
          p_ktx: flFilter.ktx || null,
          p_day: flFilter.day || null,
          p_cutoff_hour: cutoffHour,
        }),
      ]);

      if (dailyRes.error) throw new Error(dailyRes.error.message);
      if (summaryRes.error) throw new Error(summaryRes.error.message);

      const rawDaily: DailyFluctuation[] = (dailyRes.data || []).map((r: any) => ({
        ngay: r.ngay,
        so_tang: Number(r.so_tang) || 0,
        so_giam: Number(r.so_giam) || 0,
        bien_dong_rong: Number(r.bien_dong_rong) || 0,
      }));

      setDailyData(rawDaily);

      const s = summaryRes.data?.[0];
      setSummary(s ? {
        tong_tang: Number(s.tong_tang) || 0,
        tong_giam: Number(s.tong_giam) || 0,
        bien_dong_rong: Number(s.bien_dong_rong) || 0,
        so_ngay_co_bien_dong: Number(s.so_ngay_co_bien_dong) || 0,
      } : { tong_tang: 0, tong_giam: 0, bien_dong_rong: 0, so_ngay_co_bien_dong: 0 });

      const now = new Date();
      setLastFetched(now.toLocaleTimeString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }));
    } catch (err: any) {
      setFlError(err.message || 'Lỗi tải dữ liệu biến động');
    } finally {
      setFlLoading(false);
    }
  }, [flFilter]);

  useEffect(() => {
    if (activeTab === 'bien-dong') {
      fetchFluctuation();
    }
  }, [activeTab, fetchFluctuation]);

  // ── Filtered chart data by type ──
  const chartData = useMemo(() => {
    return dailyData.map(d => ({
      date: formatDateVN(d.ngay),
      rawDate: d.ngay,
      'Tăng thực tế': d.so_tang,
      'Giảm thực tế': d.so_giam,
      'Biến động ròng': d.bien_dong_rong,
    }));
  }, [dailyData]);

  const filteredDailyData = useMemo(() => {
    if (flFilter.type === 'all') return dailyData;
    if (flFilter.type === 'tang') return dailyData.filter(d => d.so_tang > 0);
    if (flFilter.type === 'giam') return dailyData.filter(d => d.so_giam > 0);
    if (flFilter.type === 'rong') return dailyData.filter(d => d.bien_dong_rong !== 0);
    return dailyData;
  }, [dailyData, flFilter.type]);

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

  const hasFlFilter = flFilter.ktx || flFilter.day || flFilter.type !== 'all';

  if (workersLoading) {
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
          🔄 Biến động nhân sự
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
                    <X size={14} /> Xóa bộ lọc
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
                <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.buildingCount} / {stats.roomCount}</h3>
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
        <div className="space-y-5">

          {/* ── Filter Bar ── */}
          <div className="bg-white rounded-xl border shadow-sm p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={15} className="text-blue-500" />
              <span className="text-sm font-bold text-gray-700">Bộ lọc biến động</span>
              {hasFlFilter && (
                <button
                  onClick={() => setFlFilter(prev => ({ ...prev, ktx: '', day: '', type: 'all' }))}
                  className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X size={12} /> Xóa lọc
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3 items-end">
              {/* Date From */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Từ ngày</label>
                <input
                  type="date"
                  value={flFilter.dateFrom}
                  onChange={e => setFlFilter(prev => ({ ...prev, dateFrom: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[140px]"
                />
              </div>
              {/* Date To */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Đến ngày</label>
                <input
                  type="date"
                  value={flFilter.dateTo}
                  onChange={e => setFlFilter(prev => ({ ...prev, dateTo: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[140px]"
                />
              </div>
              {/* KTX */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Khu vực / KTX</label>
                <select
                  value={flFilter.ktx}
                  onChange={e => setFlFilter(prev => ({ ...prev, ktx: e.target.value, day: '' }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[130px]"
                >
                  <option value="">Tất cả KTX</option>
                  <option value="KTX 1">KTX 1</option>
                  <option value="KTX 2">KTX 2</option>
                </select>
              </div>
              {/* Dãy nhà */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Dãy nhà</label>
                <select
                  value={flFilter.day}
                  onChange={e => setFlFilter(prev => ({ ...prev, day: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[130px]"
                >
                  <option value="">Tất cả dãy</option>
                  {flBuildings.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              {/* Loại biến động */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Loại biến động</label>
                <select
                  value={flFilter.type}
                  onChange={e => setFlFilter(prev => ({ ...prev, type: e.target.value as FluctuationType }))}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[160px]"
                >
                  <option value="all">Tất cả loại</option>
                  <option value="tang">Thực tế tăng</option>
                  <option value="giam">Thực tế giảm</option>
                  <option value="rong">Tổng biến động ròng</option>
                </select>
              </div>
              {/* Cutoff mode */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Mốc chốt số liệu</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
                  <button
                    onClick={() => setFlFilter(prev => ({ ...prev, cutoffMode: '14h' }))}
                    className={`flex items-center gap-1.5 px-3 py-2 transition-colors ${
                      flFilter.cutoffMode === '14h' ?'bg-blue-600 text-white font-semibold' :'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Clock size={13} /> Chốt 14:00
                  </button>
                  <button
                    onClick={() => setFlFilter(prev => ({ ...prev, cutoffMode: 'realtime' }))}
                    className={`flex items-center gap-1.5 px-3 py-2 border-l border-gray-200 transition-colors ${
                      flFilter.cutoffMode === 'realtime' ?'bg-emerald-600 text-white font-semibold' :'bg-white text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <RefreshCw size={13} /> Thời gian thực
                  </button>
                </div>
              </div>
              {/* Apply button */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide opacity-0">x</label>
                <button
                  onClick={fetchFluctuation}
                  disabled={flLoading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
                >
                  <RefreshCw size={14} className={flLoading ? 'animate-spin' : ''} />
                  {flLoading ? 'Đang tải...' : 'Cập nhật'}
                </button>
              </div>
            </div>
            {/* Mode indicator */}
            <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
              {flFilter.cutoffMode === '14h' ? (
                <><Clock size={12} className="text-blue-500" /> <span>Chốt số liệu lúc <strong>14:00</strong> hàng ngày — phản ánh tình trạng nhân sự buổi chiều</span></>
              ) : (
                <><RefreshCw size={12} className="text-emerald-500" /> <span>Xem <strong>thời gian thực</strong> — bao gồm mọi thay đổi đến thời điểm hiện tại</span></>
              )}
              {lastFetched && <span className="ml-auto text-gray-400">Cập nhật lúc {lastFetched}</span>}
            </div>
          </div>

          {/* ── Error Banner ── */}
          {flError && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-700">
              <AlertCircle size={16} className="flex-shrink-0" />
              <span>{flError}</span>
              <button onClick={fetchFluctuation} className="ml-auto text-xs underline hover:no-underline">Thử lại</button>
            </div>
          )}

          {/* ── KPI Summary Cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-emerald-50 rounded-lg"><UserPlus size={16} className="text-emerald-600" /></div>
                <p className="text-xs font-bold text-emerald-600 uppercase tracking-wide">Tổng tăng thực tế</p>
              </div>
              <p className="text-3xl font-extrabold text-emerald-700">
                {flLoading ? '—' : (summary?.tong_tang ?? 0).toLocaleString('vi-VN')}
              </p>
              <p className="text-xs text-gray-400 mt-1">công nhân được thêm vào</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-rose-50 rounded-lg"><UserMinus size={16} className="text-rose-600" /></div>
                <p className="text-xs font-bold text-rose-600 uppercase tracking-wide">Tổng giảm thực tế</p>
              </div>
              <p className="text-3xl font-extrabold text-rose-700">
                {flLoading ? '—' : (summary?.tong_giam ?? 0).toLocaleString('vi-VN')}
              </p>
              <p className="text-xs text-gray-400 mt-1">công nhân đã rời đi</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className={`p-2 rounded-lg ${(summary?.bien_dong_rong ?? 0) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                  {(summary?.bien_dong_rong ?? 0) >= 0
                    ? <TrendingUp size={16} className="text-blue-600" />
                    : <TrendingDown size={16} className="text-orange-600" />}
                </div>
                <p className={`text-xs font-bold uppercase tracking-wide ${(summary?.bien_dong_rong ?? 0) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  Biến động ròng
                </p>
              </div>
              <p className={`text-3xl font-extrabold ${(summary?.bien_dong_rong ?? 0) >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                {flLoading ? '—' : (
                  (summary?.bien_dong_rong ?? 0) > 0
                    ? `+${(summary?.bien_dong_rong ?? 0).toLocaleString('vi-VN')}`
                    : (summary?.bien_dong_rong ?? 0).toLocaleString('vi-VN')
                )}
              </p>
              <p className="text-xs text-gray-400 mt-1">tăng - giảm trong kỳ</p>
            </div>
            <div className="bg-white rounded-xl border p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-2 bg-gray-100 rounded-lg"><Calendar size={16} className="text-gray-600" /></div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ngày có biến động</p>
              </div>
              <p className="text-3xl font-extrabold text-gray-800">
                {flLoading ? '—' : (summary?.so_ngay_co_bien_dong ?? 0).toLocaleString('vi-VN')}
              </p>
              <p className="text-xs text-gray-400 mt-1">ngày trong khoảng đã chọn</p>
            </div>
          </div>

          {/* ── Charts ── */}
          {flLoading ? (
            <div className="bg-white rounded-xl border p-10 text-center text-gray-400 animate-pulse shadow-sm">
              Đang tải dữ liệu biến động từ Supabase...
            </div>
          ) : chartData.length === 0 ? (
            <div className="bg-white rounded-xl border p-10 text-center shadow-sm">
              <ArrowRightLeft size={36} className="mx-auto mb-3 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">Không có dữ liệu biến động trong khoảng thời gian đã chọn</p>
              <p className="text-xs text-gray-400 mt-1">Thử mở rộng khoảng thời gian hoặc bỏ bộ lọc</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Bar chart: Tăng / Giảm */}
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                  <UserPlus size={16} className="text-emerald-500" />
                  Tăng / Giảm thực tế theo ngày
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Tăng thực tế" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Giảm thực tế" fill="#f43f5e" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line chart: Biến động ròng */}
              <div className="bg-white rounded-xl border p-5 shadow-sm">
                <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2 text-sm">
                  <TrendingUp size={16} className="text-blue-500" />
                  Xu hướng biến động ròng theo ngày
                </h4>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -10, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip content={<CustomBarTooltip />} />
                    <ReferenceLine y={0} stroke="#d1d5db" strokeDasharray="4 4" />
                    <Line
                      type="monotone"
                      dataKey="Biến động ròng"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#3b82f6' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* ── Daily Detail Table ── */}
          {!flLoading && filteredDailyData.length > 0 && (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b flex items-center justify-between">
                <h4 className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  <Calendar size={15} className="text-blue-500" />
                  Chi tiết biến động theo ngày
                </h4>
                <span className="text-xs text-gray-400 font-medium">{filteredDailyData.length} ngày có dữ liệu</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b">
                      <th className="text-left px-5 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Ngày</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-emerald-600 uppercase tracking-wider">Tăng thực tế</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-rose-600 uppercase tracking-wider">Giảm thực tế</th>
                      <th className="text-center px-4 py-3 text-xs font-bold text-blue-600 uppercase tracking-wider">Biến động ròng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredDailyData.map((row, idx) => (
                      <tr key={row.ngay} className={`hover:bg-gray-50 transition-colors ${idx % 2 === 0 ? '' : 'bg-gray-50/30'}`}>
                        <td className="px-5 py-3 font-medium text-gray-700">{formatDateVN(row.ngay)}</td>
                        <td className="px-4 py-3 text-center">
                          {row.so_tang > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700">
                              <UserPlus size={11} /> +{row.so_tang}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {row.so_giam > 0 ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700">
                              <UserMinus size={11} /> -{row.so_giam}
                            </span>
                          ) : (
                            <span className="text-gray-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                            row.bien_dong_rong > 0
                              ? 'bg-blue-100 text-blue-700'
                              : row.bien_dong_rong < 0
                              ? 'bg-orange-100 text-orange-700' :'bg-gray-100 text-gray-500'
                          }`}>
                            {row.bien_dong_rong > 0 ? <TrendingUp size={11} /> : row.bien_dong_rong < 0 ? <TrendingDown size={11} /> : null}
                            {row.bien_dong_rong > 0 ? `+${row.bien_dong_rong}` : row.bien_dong_rong}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {/* Summary row */}
                  <tfoot>
                    <tr className="bg-gray-50 border-t-2 border-gray-200">
                      <td className="px-5 py-3 text-xs font-bold text-gray-600 uppercase">Tổng cộng</td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-extrabold text-emerald-700">
                          +{filteredDailyData.reduce((s, r) => s + r.so_tang, 0).toLocaleString('vi-VN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-extrabold text-rose-700">
                          -{filteredDailyData.reduce((s, r) => s + r.so_giam, 0).toLocaleString('vi-VN')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(() => {
                          const net = filteredDailyData.reduce((s, r) => s + r.bien_dong_rong, 0);
                          return (
                            <span className={`text-sm font-extrabold ${net >= 0 ? 'text-blue-700' : 'text-orange-700'}`}>
                              {net > 0 ? `+${net.toLocaleString('vi-VN')}` : net.toLocaleString('vi-VN')}
                            </span>
                          );
                        })()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* ── Info note about data source ── */}
          <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
            <TrendingUp size={14} className="flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Nguồn dữ liệu:</span> Số liệu biến động được tính toán trực tiếp từ bảng{' '}
              <code className="bg-blue-100 px-1 rounded font-mono">workers</code> — đếm công nhân được thêm vào theo{' '}
              <code className="bg-blue-100 px-1 rounded font-mono">created_at</code> và công nhân rời đi theo{' '}
              <code className="bg-blue-100 px-1 rounded font-mono">deleted_at</code>. Không sử dụng nhật ký thao tác (audit logs).
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
