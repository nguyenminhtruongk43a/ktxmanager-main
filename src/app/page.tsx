'use client';
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import AppLayout from '@/components/AppLayout';
import { useWorkers } from '@/context/WorkerContext';
import { getUniqueKTX, getUniqueBuildings, getUniqueRooms, countUniqueBuildings, ROOM_CAPACITY } from '@/data/workers';
import { Users, LayoutGrid, Percent, AlertCircle, FileSpreadsheet, Wifi, ChevronDown, Search, X, Download, UserPlus, AlertTriangle, TrendingUp, TrendingDown, XCircle, GitBranch, HardHat, VenusAndMars } from 'lucide-react';
import dynamic from 'next/dynamic';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';



const RoomDrawer = dynamic(() => import('./components/RoomDrawer'), { ssr: false });
const DashboardCharts = dynamic(() => import('./components/DashboardCharts'), { ssr: false });
const RecentEntriesFeed = dynamic(() => import('./components/RecentEntriesFeed'), { ssr: false });

// ─── Room heatmap color helpers ────────────────────────────────────────────
function getRoomHeatColor(count: number, capacity: number): { bg: string; border: string; label: string; dot: string } {
  if (count === 0) return { bg: 'bg-gray-100', border: 'border-gray-300', label: 'Trống', dot: 'bg-gray-400' };
  const pct = count / capacity;
  if (pct > 1) return { bg: 'bg-red-100', border: 'border-red-400', label: 'Quá tải', dot: 'bg-red-500' };
  if (pct >= 1) return { bg: 'bg-yellow-100', border: 'border-yellow-400', label: 'Đầy 100%', dot: 'bg-yellow-500' };
  return { bg: 'bg-green-100', border: 'border-green-400', label: 'Còn trống', dot: 'bg-green-500' };
}

// ─── KPI Card ─────────────────────────────────────────────────────────────
function KPICard({
  label, value, sub, icon: Icon, color, alert, onClick, badge
}: {
  label: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string; alert?: boolean; onClick?: () => void; badge?: string;
}) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-3 shadow-sm transition-all ${alert ? 'border-red-200 bg-red-50' : 'bg-white border-border'} ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${color}`}>
          <Icon size={18} className="text-white" />
        </div>
      </div>
      <div>
        <p className={`text-3xl font-bold font-tabular ${alert ? 'text-red-700' : 'text-foreground'}`}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
        {badge && (
          <span className="inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Alert Card ────────────────────────────────────────────────────────────
function AlertCard({ icon: Icon, label, value, color, onClick }: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string; value: string | number; color: string; onClick?: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 bg-white shadow-sm ${onClick ? 'cursor-pointer hover:shadow-md transition-all' : ''}`}
      onClick={onClick}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon size={16} className="text-white" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
        <p className="text-base font-bold text-foreground font-tabular">{value}</p>
      </div>
    </div>
  );
}

// ─── Global Search Bar ─────────────────────────────────────────────────────
function GlobalSearchBar({ onSelectWorker }: { onSelectWorker: (id: string) => void }) {
  const { workers } = useWorkers();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    if (!query.trim() || query.length < 2) return [];
    const q = query.toLowerCase();
    return workers.filter(w =>
      w.hoVaTen?.toLowerCase().includes(q) ||
      w.maNV?.toLowerCase().includes(q) ||
      w.cccd?.toLowerCase().includes(q) ||
      w.phongSo?.toLowerCase().includes(q) ||
      w.soDienThoai?.toLowerCase().includes(q)
    ).slice(0, 8);
  }, [query, workers]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          placeholder="Tìm theo tên, mã NV, CCCD, phòng..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X size={14} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 overflow-hidden">
          {results.map(w => (
            <button
              key={w.id}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted text-left transition-colors"
              onClick={() => { onSelectWorker(w.id); setQuery(''); setOpen(false); }}
            >
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">{w.hoVaTen?.charAt(0) || '?'}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{w.hoVaTen}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[w.maNV, w.ktx, w.day && w.phongSo ? `Phòng ${w.phongSo}` : null].filter(Boolean).join(' · ')}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {open && query.length >= 2 && results.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-border rounded-xl shadow-lg z-50 px-4 py-3 text-sm text-muted-foreground">
          Không tìm thấy kết quả
        </div>
      )}
    </div>
  );
}

// ─── Room Tooltip ──────────────────────────────────────────────────────────
function RoomTooltip({ workers, room, onClose }: {
  workers: { hoVaTen: string; maNV: string }[];
  room: string;
  onClose: () => void;
}) {
  return (
    <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-52 bg-gray-900 text-white rounded-xl shadow-xl p-3 text-xs">
      <div className="flex items-center justify-between mb-2">
        <span className="font-bold">Phòng {room}</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={12} /></button>
      </div>
      {workers.length === 0 ? (
        <p className="text-gray-400">Phòng trống</p>
      ) : (
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {workers.map((w, i) => (
            <li key={i} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              <span className="truncate">{w.hoVaTen}</span>
              {w.maNV && <span className="text-gray-400 flex-shrink-0">#{w.maNV}</span>}
            </li>
          ))}
        </ul>
      )}
      <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
    </div>
  );
}

// ─── Heatmap Room Cell ─────────────────────────────────────────────────────
// Workers prop is already scoped to ktx+building by parent — no extra filtering needed
function HeatmapRoomCell({
  room, count, capacity, ktx, building, workers, onClickRoom
}: {
  room: string; count: number; capacity: number;
  ktx: string; building: string;
  workers: { hoVaTen: string; maNV: string }[];
  onClickRoom: (ktx: string, building: string, room: string) => void;
}) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { bg, border, label, dot } = getRoomHeatColor(count, capacity);

  return (
    <div className="relative">
      <div
        className={`border rounded-lg p-2.5 cursor-pointer transition-all hover:shadow-md hover:scale-105 ${bg} ${border}`}
        onClick={() => onClickRoom(ktx, building, room)}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-bold text-foreground">P.{room}</span>
          <span className={`w-2 h-2 rounded-full ${dot}`} />
        </div>
        <p className="text-xs font-tabular font-semibold text-foreground">{count}/{capacity}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
      {showTooltip && (
        <RoomTooltip workers={workers} room={room} onClose={() => setShowTooltip(false)} />
      )}
    </div>
  );
}

// ─── Block title with assigned staff name ─────────────────────────────────
interface BlockAssignment {
  blockKey: string; // e.g. "KTX 1 - Dãy 3"
  staffName: string;
}

function BlockTitle({
  ktx, building, assignments, buildingWorkerCount, totalCap, occupancyPct, barColor
}: {
  ktx: string; building: string;
  assignments: BlockAssignment[];
  buildingWorkerCount: number; totalCap: number; occupancyPct: number; barColor: string;
}) {
  const blockKey = `${ktx} - ${building}`;
  const assigned = assignments.find(a => a.blockKey.toLowerCase() === blockKey.toLowerCase());
  const staffLabel = assigned ? `Phụ trách: ${assigned.staffName}` : 'Chưa gán';

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{building}</span>
          <span className={`text-[10px] font-medium flex items-center gap-1 ${assigned ? 'text-blue-600' : 'text-muted-foreground'}`}>
            <GitBranch size={9} />
            {staffLabel}
          </span>
        </div>
        <span className="text-xs text-muted-foreground font-tabular">
          {buildingWorkerCount}/{totalCap} · {Math.round(occupancyPct * 100)}% đầy
        </span>
      </div>
      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(occupancyPct * 100, 100)}%` }} />
      </div>
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function OccupancyDashboardPage() {
  const { workers, loading } = useWorkers();
  const router = useRouter();
  const [selectedKTX, setSelectedKTX] = useState<string>('all');
  const [drawerRoom, setDrawerRoom] = useState<{ ktx: string; building: string; room: string } | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [todayStats, setTodayStats] = useState<{ entered: number; left: number }>({ entered: 0, left: 0 });
  const [genderStats, setGenderStats] = useState({ male: 0, female: 0 });
  const [contractorStats, setContractorStats] = useState<[string, number][]>([]);
  const [ktxStats, setKtxStats] = useState({ ktx1: 0, ktx2: 0 });
  const [dashboardTotal, setDashboardTotal] = useState(0);
  const [statsLoading, setStatsLoading] = useState(true);
  const [genderByKtx, setGenderByKtx] = useState<Record<string, { male: number; female: number }>>({});
  const [contractorByKtx, setContractorByKtx] = useState<Record<string, [string, number][]>>({});
  // Block assignments: map of "KTX X - Dãy Y" -> staffName
  const [blockAssignments, setBlockAssignments] = useState<BlockAssignment[]>([]);

  const isEmpty = !loading && workers.length === 0;

  // KTX list from real data
  const allKTX = useMemo(() => getUniqueKTX(workers), [workers]);

  // Filtered workers by selected KTX
  const filteredWorkers = useMemo(() =>
    selectedKTX === 'all' ? workers : workers.filter(w => w.ktx === selectedKTX),
    [workers, selectedKTX]
  );

  const allBuildings = useMemo(() => getUniqueBuildings(filteredWorkers), [filteredWorkers]);

  // ── Load block assignments from profiles ──────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('profiles')
      .select('full_name, assigned_blocks')
      .then(({ data }) => {
        if (!data) return;
        const assignments: BlockAssignment[] = [];
        data.forEach(profile => {
          const blocks: string[] = Array.isArray(profile.assigned_blocks) ? profile.assigned_blocks : [];
          blocks.forEach(block => {
            if (block && profile.full_name) {
              assignments.push({ blockKey: block, staffName: profile.full_name });
            }
          });
        });
        setBlockAssignments(assignments);
      });
  }, []);

  useEffect(() => {
    let active = true;
    const fetchStats = async () => {
      setStatsLoading(true);
      const supabase = createClient();

      try {
        // 1. Total count
        const { count: total } = await supabase
          .from('workers')
          .select('*', { count: 'exact', head: true });

        // 2+4. Paginated fetch for all workers' ktx, gioi_tinh, don_vi (bypasses 1000-row Supabase limit)
        let allWorkersData: { ktx: string; gioi_tinh: string; don_vi: string }[] = [];
        let fetchFrom = 0;
        const FETCH_SIZE = 1000;
        let fetchHasMore = true;
        while (fetchHasMore) {
          const { data: batch } = await supabase
            .from('workers')
            .select('ktx, gioi_tinh, don_vi')
            .range(fetchFrom, fetchFrom + FETCH_SIZE - 1);
          if (!batch || batch.length === 0) { fetchHasMore = false; break; }
          allWorkersData = allWorkersData.concat(batch as { ktx: string; gioi_tinh: string; don_vi: string }[]);
          if (batch.length < FETCH_SIZE) { fetchHasMore = false; } else { fetchFrom += FETCH_SIZE; }
        }

        // Count gender totals and per-KTX from paginated data
        let maleCount = 0;
        let femaleCount = 0;
        const donViMap: Record<string, number> = {};
        const donViDisplayMap: Record<string, string> = {}; // uppercase key → first-seen display name
        const donViPerKtx: Record<string, Record<string, number>> = {};
        const genderPerKtx: Record<string, { male: number; female: number }> = {};

        allWorkersData.forEach(row => {
          const ktxKey = (row.ktx ?? '').trim();
          const g = (row.gioi_tinh ?? '').trim();
          // Normalize to ASCII lowercase for reliable comparison across all Vietnamese input variants
          const gNorm = g
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // strip diacritics
            .trim();

          // "Nam", "NAM", "nam" → "nam"; "Nữ", "NỮ", "nu", "nư", "nữ" → "nu"
          const isMale = gNorm === 'nam';
          const isFemale = gNorm === 'nu' || gNorm === 'nu' || (!isMale && (gNorm.startsWith('n') && gNorm.length <= 3));

          if (isMale) maleCount++;
          else if (isFemale) femaleCount++;

          // Gender per KTX
          if (ktxKey) {
            if (!genderPerKtx[ktxKey]) genderPerKtx[ktxKey] = { male: 0, female: 0 };
            if (isMale) genderPerKtx[ktxKey].male++;
            else if (isFemale) genderPerKtx[ktxKey].female++;
          }

          // Contractor overall and per KTX — group case-insensitively (merge "ME", "me", "Me")
          const dvRaw = (row.don_vi ?? '').trim();
          if (dvRaw) {
            const dvKey = dvRaw.toUpperCase();
            if (!donViDisplayMap[dvKey]) donViDisplayMap[dvKey] = dvRaw; // keep first-seen casing for display
            donViMap[dvKey] = (donViMap[dvKey] || 0) + 1;
            if (ktxKey) {
              if (!donViPerKtx[ktxKey]) donViPerKtx[ktxKey] = {};
              donViPerKtx[ktxKey][dvKey] = (donViPerKtx[ktxKey][dvKey] || 0) + 1;
            }
          }
        });

        // 3. KTX stats — use exact match (count queries are always accurate)
        const [ktx1Result, ktx2Result] = await Promise.all([
          supabase.from('workers').select('*', { count: 'exact', head: true }).eq('ktx', 'KTX 1'),
          supabase.from('workers').select('*', { count: 'exact', head: true }).eq('ktx', 'KTX 2'),
        ]);
        const ktx1 = ktx1Result.count;
        const ktx2 = ktx2Result.count;

        // Sort by count descending, take top entries — restore display names
        const sortedDonVi: [string, number][] = Object.entries(donViMap)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 6)
          .map(([key, count]) => [donViDisplayMap[key] ?? key, count]);

        const contractorPerKtx: Record<string, [string, number][]> = {};
        Object.entries(donViPerKtx).forEach(([ktxKey, map]) => {
          contractorPerKtx[ktxKey] = Object.entries(map)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([key, count]) => [donViDisplayMap[key] ?? key, count]);
        });

        if (!active) return;

        setDashboardTotal(total ?? 0);
        setGenderStats({ male: maleCount, female: femaleCount });
        setKtxStats({ ktx1: ktx1 ?? 0, ktx2: ktx2 ?? 0 });
        setContractorStats(sortedDonVi);
        setGenderByKtx(genderPerKtx);
        setContractorByKtx(contractorPerKtx);
      } catch (err) {
        console.error('fetchStats error:', err);
      } finally {
        if (active) setStatsLoading(false);
      }
    };
    fetchStats();
    return () => { active = false; };
  }, []);

  // ── KPI calculations scoped to selected KTX ───────────────────────────────
  // All-KTX metrics
  const totalCapacityAll = useMemo(() => {
    const roomSet = new Set(workers.map(w => `${w.ktx}||${w.day}||${w.phongSo}`).filter(k => !k.startsWith('||')));
    return roomSet.size * ROOM_CAPACITY;
  }, [workers]);

  const totalRoomsAll = useMemo(() => {
    return new Set(workers.map(w => `${w.ktx}||${w.day}||${w.phongSo}`).filter(k => !k.startsWith('||'))).size;
  }, [workers]);

  const totalBuildingsAll = useMemo(() => countUniqueBuildings(workers), [workers]);
  const totalKTXAll = useMemo(() => allKTX.length, [allKTX]);

  const workersWithRoom = useMemo(() => workers.filter(w => w.day && w.phongSo), [workers]);
  const fillRateAll = totalCapacityAll > 0 ? Math.round((workersWithRoom.length / totalCapacityAll) * 100) : 0;

  // Per-KTX metrics (when a specific KTX is selected)
  const filteredRoomsSet = useMemo(() => {
    return new Set(filteredWorkers.map(w => `${w.ktx}||${w.day}||${w.phongSo}`).filter(k => !k.startsWith('||')));
  }, [filteredWorkers]);
  const filteredRoomCount = filteredRoomsSet.size;
  const filteredBuildingCount = useMemo(() => countUniqueBuildings(filteredWorkers), [filteredWorkers]);
  const filteredCapacity = filteredRoomCount * ROOM_CAPACITY;
  const filteredWithRoom = filteredWorkers.filter(w => w.day && w.phongSo).length;
  const filteredFillRate = filteredCapacity > 0 ? Math.round((filteredWithRoom / filteredCapacity) * 100) : 0;
  const filteredTotal = filteredWorkers.length;

  // Missing data: workers without day OR phongSo (scoped to selected KTX)
  const missingData = useMemo(() => filteredWorkers.filter(w => !w.day || !w.phongSo).length, [filteredWorkers]);

  // ── Operational Alerts ────────────────────────────────────────────────────
  const roomWorkerMap = useMemo(() => {
    const map = new Map<string, number>();
    filteredWorkers.forEach(w => {
      if (w.day && w.phongSo) {
        const key = `${w.ktx}||${w.day}||${w.phongSo}`;
        map.set(key, (map.get(key) || 0) + 1);
      }
    });
    return map;
  }, [filteredWorkers]);

  const overloadedRooms = useMemo(() => {
    let count = 0;
    roomWorkerMap.forEach(v => { if (v > ROOM_CAPACITY) count++; });
    return count;
  }, [roomWorkerMap]);

  // Today's changes
  useEffect(() => {
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    let entered = 0;
    let left = 0;
    workers.forEach(w => {
      if (w.ngayVaoKTX) {
        const d = new Date(w.ngayVaoKTX);
        if (!isNaN(d.getTime())) {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (ds === todayStr) entered++;
        }
      }
      if (w.ngayRaKTX) {
        const d = new Date(w.ngayRaKTX);
        if (!isNaN(d.getTime())) {
          const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          if (ds === todayStr) left++;
        }
      }
    });
    setTodayStats({ entered, left });
  }, [workers]);

  // KTX list for room grid
  const ktxListForGrid = useMemo(() => {
    if (selectedKTX !== 'all') return [selectedKTX];
    return allKTX;
  }, [selectedKTX, allKTX]);

  // Drawer workers: scoped to exact ktx + building + room
  const drawerWorkers = useMemo(() => {
    if (!drawerRoom) return [];
    return workers.filter(w =>
      w.ktx === drawerRoom.ktx &&
      w.day === drawerRoom.building &&
      w.phongSo === drawerRoom.room
    );
  }, [drawerRoom, workers]);

  // ── Export daily report ───────────────────────────────────────────────────
  const handleExportReport = useCallback(() => {
    const today = new Date();
    const dateStr = `${today.getDate().toString().padStart(2, '0')}-${(today.getMonth() + 1).toString().padStart(2, '0')}-${today.getFullYear()}`;
    const rows = filteredWorkers.map(w => ({
      'STT': w.stt,
      'Họ và Tên': w.hoVaTen,
      'Mã NV': w.maNV,
      'KTX': w.ktx,
      'Dãy': w.day,
      'Phòng': w.phongSo,
      'Giường': w.giuong || '',
      'CCCD': w.cccd,
      'SĐT': w.soDienThoai,
      'Ngày vào KTX': w.ngayVaoKTX,
      'Ngày ra KTX': w.ngayRaKTX || '',
      'Ghi chú': w.ghiChu,
    }));
    import('xlsx').then(XLSX => {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo');
      XLSX.writeFile(wb, `BaoCao_${selectedKTX === 'all' ? 'TatCa' : selectedKTX.replace(' ', '')}_${dateStr}.xlsx`);
    });
  }, [filteredWorkers, selectedKTX]);

  const handleMissingDataClick = useCallback(() => {
    const params = new URLSearchParams({ filter: 'missing_room' });
    if (selectedKTX !== 'all') params.set('ktx', selectedKTX);
    router.push(`/worker-management?${params.toString()}`);
  }, [router, selectedKTX]);

  const handleEmptyRoomsClick = useCallback(() => {
    const params = new URLSearchParams({ filter: 'no_room' });
    if (selectedKTX !== 'all') params.set('ktx', selectedKTX);
    router.push(`/worker-management?${params.toString()}`);
  }, [router, selectedKTX]);

  const handleRoomClick = useCallback((ktx: string, building: string, room: string) => {
    setDrawerRoom({ ktx, building, room });
  }, []);

  // ── KPI display values (auto-calculated per selected KTX) ─────────────────
  const kpiWorkers = selectedKTX === 'all'
    ? dashboardTotal
    : filteredTotal;
  const kpiBuildings = selectedKTX === 'all' ? totalBuildingsAll : filteredBuildingCount;
  const kpiRooms = selectedKTX === 'all' ? totalRoomsAll : filteredRoomCount;
  const kpiCapacity = selectedKTX === 'all' ? totalCapacityAll : filteredCapacity;
  const kpiFillRate = selectedKTX === 'all' ? fillRateAll : filteredFillRate;
  const kpiWithRoom = selectedKTX === 'all' ? workersWithRoom.length : filteredWithRoom;

  return (
    <AppLayout>
      <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">

        {/* ── Page Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">KÝ TÚC XÁ HÓC MÔN</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Trung Tâm Điều Hành · Tổng Quan Hệ Thống</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <GlobalSearchBar onSelectWorker={(id) => {
              const w = workers.find(x => x.id === id);
              if (w?.ktx && w?.day && w?.phongSo) setDrawerRoom({ ktx: w.ktx, building: w.day, room: w.phongSo });
            }} />
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold border border-green-200">
              <Wifi size={12} className="animate-pulse" />
              Realtime
            </span>
            {loading && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold border border-blue-200">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                Đang tải...
              </span>
            )}
          </div>
        </div>

        {/* ── Quick Action Buttons ── */}
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={handleMissingDataClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-semibold hover:bg-orange-600 transition-colors shadow-sm"
          >
            <UserPlus size={15} />
            Xếp phòng nhanh
            {missingData > 0 && (
              <span className="bg-white text-orange-600 text-xs font-bold rounded-full px-1.5 py-0.5 leading-none">{missingData}</span>
            )}
          </button>
          <button
            onClick={() => router.push('/worker-management')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600 transition-colors shadow-sm"
          >
            <FileSpreadsheet size={15} />
            Import Excel
          </button>
          <button
            onClick={handleExportReport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 text-white text-sm font-semibold hover:bg-emerald-600 transition-colors shadow-sm"
          >
            <Download size={15} />
            Xuất Báo Cáo Ngày
          </button>
        </div>

        {/* ── KTX Dropdown Filter ── */}
        {!isEmpty && allKTX.length > 0 && (
          <div className="flex items-center gap-3 mb-5">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Chọn KTX:</span>
            <div className="relative">
              <select
                value={selectedKTX}
                onChange={e => { setSelectedKTX(e.target.value); setSelectedBuilding(null); }}
                className="appearance-none bg-white border border-border rounded-lg pl-3 pr-8 py-2 text-sm font-semibold text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary cursor-pointer min-w-[160px]"
              >
                <option value="all">Tất cả KTX</option>
                {allKTX.map(ktx => (
                  <option key={ktx} value={ktx}>{ktx}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}

        {/* ── KPI Grid — auto-calculated per selected KTX ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <KPICard
            label="Công Nhân"
            value={kpiWorkers.toLocaleString('vi-VN')}
            sub={selectedKTX !== 'all'
              ? `${selectedKTX} · ${kpiBuildings} dãy`
              : `${totalKTXAll} ký túc xá · ${kpiBuildings} dãy`}
            icon={Users}
            color="bg-primary"
          />
          <KPICard
            label="Số Dãy / Số Phòng"
            value={`${kpiBuildings} dãy / ${kpiRooms} phòng`}
            sub={`Sức chứa: ${kpiCapacity} chỗ`}
            icon={LayoutGrid}
            color="bg-blue-500"
          />
          <KPICard
            label="Tỷ Lệ Lấp Đầy"
            value={`${kpiFillRate}%`}
            sub={`${kpiWithRoom}/${kpiCapacity} chỗ đã dùng`}
            icon={Percent}
            color="bg-emerald-500"
          />
          <KPICard
            label="Thiếu Dữ Liệu"
            value={missingData}
            sub="Click để gán phòng ngay"
            icon={AlertCircle}
            color="bg-red-500"
            alert={missingData > 0}
            onClick={handleMissingDataClick}
            badge={missingData > 0 ? 'Nhấn để xem' : undefined}
          />
        </div>

        {/* ── Detailed statistics ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
          {/* Gender Stats */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <VenusAndMars size={17} className="text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Thống kê giới tính</h2>
            </div>
            {/* Overall totals */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                <p className="text-xs text-blue-600 font-medium">Nam (Toàn KTX)</p>
                <p className="text-2xl font-bold text-blue-700 font-tabular">{genderStats.male}</p>
              </div>
              <div className="rounded-lg bg-pink-50 border border-pink-100 p-3">
                <p className="text-xs text-pink-600 font-medium">Nữ (Toàn KTX)</p>
                <p className="text-2xl font-bold text-pink-700 font-tabular">{genderStats.female}</p>
              </div>
            </div>
            {/* Per-KTX breakdown */}
            {Object.keys(genderByKtx).sort().length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chi tiết theo KTX</p>
                {Object.keys(genderByKtx).sort().map(ktxKey => (
                  <div key={ktxKey} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground mb-1.5">{ktxKey}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between rounded bg-blue-50 px-2 py-1">
                        <span className="text-xs text-blue-600 font-medium">Nam</span>
                        <span className="text-sm font-bold text-blue-700 font-tabular">{genderByKtx[ktxKey].male}</span>
                      </div>
                      <div className="flex items-center justify-between rounded bg-pink-50 px-2 py-1">
                        <span className="text-xs text-pink-600 font-medium">Nữ</span>
                        <span className="text-sm font-bold text-pink-700 font-tabular">{genderByKtx[ktxKey].female}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contractor/Unit Stats */}
          <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <HardHat size={17} className="text-orange-500" />
              <h2 className="text-sm font-semibold text-foreground">Đơn vị / Nhà thầu</h2>
            </div>
            {/* Overall totals */}
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Tổng chung</p>
              <div className="grid grid-cols-2 gap-2">
                {contractorStats.length > 0 ? contractorStats.map(([name, count]) => (
                  <div key={name} className="flex items-center justify-between rounded-lg bg-orange-50 border border-orange-100 px-3 py-2">
                    <span className="text-xs text-orange-800 truncate mr-2">{name}</span>
                    <span className="text-sm font-bold text-orange-700 font-tabular">{count}</span>
                  </div>
                )) : <p className="text-xs text-muted-foreground col-span-2">Chưa có dữ liệu</p>}
              </div>
            </div>
            {/* Per-KTX breakdown */}
            {Object.keys(contractorByKtx).sort().length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Chi tiết theo KTX</p>
                {Object.keys(contractorByKtx).sort().map(ktxKey => (
                  <div key={ktxKey} className="rounded-lg border border-border bg-muted/30 px-3 py-2">
                    <p className="text-xs font-semibold text-foreground mb-1.5">{ktxKey}</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {contractorByKtx[ktxKey].map(([name, count]) => (
                        <div key={name} className="flex items-center justify-between rounded bg-orange-50 px-2 py-1">
                          <span className="text-xs text-orange-800 truncate mr-1">{name}</span>
                          <span className="text-xs font-bold text-orange-700 font-tabular">{count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Operational Alerts ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <AlertCard
            icon={XCircle}
            label="Phòng Trống (0 người)"
            value={`${Array.from(roomWorkerMap.values()).filter(v => v === 0).length} phòng`}
            color="bg-gray-500"
            onClick={handleEmptyRoomsClick}
          />
          <AlertCard
            icon={AlertTriangle}
            label="Phòng Quá Tải"
            value={`${overloadedRooms} phòng`}
            color={overloadedRooms > 0 ? 'bg-red-500' : 'bg-gray-400'}
          />
          <AlertCard
            icon={TrendingUp}
            label="Vào Hôm Nay"
            value={`+${todayStats.entered} người`}
            color="bg-green-500"
          />
          <AlertCard
            icon={TrendingDown}
            label="Ra Hôm Nay"
            value={`-${todayStats.left} người`}
            color="bg-amber-500"
          />
        </div>

        {/* ── Heatmap Room Grid ── */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-5 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">Sơ Đồ Phòng (Heatmap)</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedKTX !== 'all' ? selectedKTX : 'Tất cả KTX'} · Hover/Click ô phòng để xem danh sách công nhân
              </p>
            </div>
            {!isEmpty && allBuildings.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSelectedBuilding(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectedBuilding === null ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-secondary'}`}
                >
                  Tất cả dãy
                </button>
                {allBuildings.map(b => (
                  <button
                    key={b}
                    onClick={() => setSelectedBuilding(b)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${selectedBuilding === b ? 'bg-primary text-primary-foreground border-primary' : 'bg-muted text-muted-foreground border-border hover:bg-secondary'}`}
                  >
                    {b}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Heatmap Legend */}
          <div className="flex flex-wrap gap-4 mb-4">
            {[
              { label: 'Còn trống', bg: 'bg-green-200', border: 'border-green-400' },
              { label: 'Đầy 100%', bg: 'bg-yellow-200', border: 'border-yellow-400' },
              { label: 'Quá tải', bg: 'bg-red-200', border: 'border-red-400' },
              { label: 'Trống 0 người', bg: 'bg-gray-200', border: 'border-gray-400' },
            ].map(leg => (
              <div key={leg.label} className="flex items-center gap-1.5">
                <span className={`w-4 h-4 rounded border ${leg.bg} ${leg.border}`} />
                <span className="text-xs text-muted-foreground">{leg.label}</span>
              </div>
            ))}
          </div>

          {isEmpty && (
            <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-10 flex flex-col items-center justify-center text-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <FileSpreadsheet size={28} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground mb-1">Chưa có dữ liệu phòng</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Vui lòng bấm <span className="font-semibold text-primary">"Import Excel"</span> hoặc thêm công nhân mới.
                </p>
              </div>
              <button
                onClick={() => router.push('/worker-management')}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <FileSpreadsheet size={16} />
                Đến trang Quản Lý Công Nhân
              </button>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-muted-foreground">Đang tải dữ liệu từ Supabase...</p>
              </div>
            </div>
          )}

          {/* Heatmap Grid */}
          {!isEmpty && !loading && ktxListForGrid.length > 0 && (
            <>
              {ktxListForGrid.map(ktx => {
                // ktxWorkers: workers scoped to this KTX only
                const ktxWorkers = workers.filter(w => w.ktx === ktx);
                const ktxBuildings = getUniqueBuildings(ktxWorkers).filter(b => !selectedBuilding || b === selectedBuilding);
                if (ktxBuildings.length === 0) return null;
                return (
                  <div key={ktx} className="mb-6 last:mb-0">
                    {selectedKTX === 'all' && (
                      <div className="flex items-center gap-2 mb-3">
                        <span className={`text-sm font-bold px-3 py-1 rounded-full ${ktx === 'KTX 1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>{ktx}</span>
                        <span className="text-xs text-muted-foreground">{ktxWorkers.length} công nhân · {ktxBuildings.length} dãy</span>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-6">
                      {ktxBuildings.map(building => {
                        // buildingWorkers: scoped to ktx + building — used for BOTH tooltip and modal
                        const buildingWorkers = ktxWorkers.filter(w => w.day === building);
                        const rooms = getUniqueRooms(ktxWorkers, building);
                        const totalCap = rooms.length * ROOM_CAPACITY;
                        const occupancyPct = totalCap > 0 ? buildingWorkers.length / totalCap : 0;
                        const barColor = occupancyPct > 1 ? 'bg-red-400' : occupancyPct >= 1 ? 'bg-yellow-400' : occupancyPct >= 0.5 ? 'bg-green-400' : 'bg-blue-400';
                        return (
                          <div key={building} className="flex-1 min-w-[260px]">
                            <BlockTitle
                              ktx={ktx}
                              building={building}
                              assignments={blockAssignments}
                              buildingWorkerCount={buildingWorkers.length}
                              totalCap={totalCap}
                              occupancyPct={occupancyPct}
                              barColor={barColor}
                            />
                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                              {rooms.map(room => {
                                // roomWorkers: scoped to ktx + building + room — same list for tooltip and modal
                                const roomWorkers = buildingWorkers.filter(w => w.phongSo === room);
                                return (
                                  <HeatmapRoomCell
                                    key={`${ktx}-${building}-${room}`}
                                    room={room}
                                    count={roomWorkers.length}
                                    capacity={ROOM_CAPACITY}
                                    ktx={ktx}
                                    building={building}
                                    workers={roomWorkers.map(w => ({ hoVaTen: w.hoVaTen, maNV: w.maNV }))}
                                    onClickRoom={handleRoomClick}
                                  />
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {!isEmpty && !loading && ktxListForGrid.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center gap-2">
              <LayoutGrid size={32} className="text-muted-foreground" />
              <p className="text-sm font-semibold text-foreground">Không có dữ liệu cho KTX đã chọn</p>
              <p className="text-xs text-muted-foreground">Thử chọn "Tất cả KTX" hoặc KTX khác</p>
            </div>
          )}
        </div>

        {/* ── Charts + Recent ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <DashboardCharts />
          </div>
          <div className="xl:col-span-1">
            <RecentEntriesFeed />
          </div>
        </div>
      </div>

      {/* Room Drawer */}
      {drawerRoom && (
        <RoomDrawer
          building={`${drawerRoom.ktx ? drawerRoom.ktx + ' · ' : ''}${drawerRoom.building}`}
          room={drawerRoom.room}
          workers={drawerWorkers}
          onClose={() => setDrawerRoom(null)}
        />
      )}
    </AppLayout>
  );
}