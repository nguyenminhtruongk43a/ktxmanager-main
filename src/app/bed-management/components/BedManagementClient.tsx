'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BedDouble, QrCode, Search, Plus, Trash2, X, Loader2, RefreshCw, Download, History, UserCheck, LogOut, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import * as XLSX from 'xlsx';

interface Bed {
  id: string;
  ktx: string;
  day: string;
  phong_so: string;
  giuong: string;
  bed_qr_id: string;
  ma_nv: string | null;
  ho_va_ten: string | null;
  status: 'empty' | 'occupied';
  assigned_at: string | null;
  created_at: string;
  updated_at: string;
}

interface BedHistoryEntry {
  id: string;
  bed_id: string;
  bed_qr_id: string;
  ktx: string;
  day: string;
  phong_so: string;
  giuong: string;
  event_type: string;
  ma_nv: string | null;
  ho_va_ten: string | null;
  performed_by: string | null;
  note: string;
  event_at: string;
}

interface WorkerOption {
  id: string;
  ho_va_ten: string;
  ma_nv: string;
  ktx: string;
  day: string;
  phong_so: string;
  giuong: string;
  worker_status?: string;
}

// ─── Assign Worker Modal ──────────────────────────────────────────────────────
function AssignWorkerModal({
  bed,
  onClose,
  onAssign,
}: {
  bed: Bed;
  onClose: () => void;
  onAssign: (bed: Bed, worker: WorkerOption) => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('workers')
        .select('id, ho_va_ten, ma_nv, ktx, day, phong_so, giuong, worker_status')
        .or('worker_status.eq.active,worker_status.is.null')
        .order('ho_va_ten');
      setWorkers((data || []) as WorkerOption[]);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = workers.filter(w => {
    const q = search.toLowerCase();
    return (
      w.ho_va_ten?.toLowerCase().includes(q) ||
      w.ma_nv?.toLowerCase().includes(q)
    );
  });

  const handleAssign = async (w: WorkerOption) => {
    setAssigning(true);
    try {
      await onAssign(bed, w);
      onClose();
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Gán nhân sự vào giường</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bed.ktx} — {bed.day} — Phòng {bed.phong_so} — Giường {bed.giuong}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc Mã NV..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Không tìm thấy nhân sự</p>
          ) : (
            filtered.slice(0, 100).map(w => (
              <button
                key={w.id}
                onClick={() => handleAssign(w)}
                disabled={assigning}
                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/60 transition-colors text-left group"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">{w.ho_va_ten}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Mã NV: <span className="font-mono font-medium">{w.ma_nv || '—'}</span>
                    {w.ktx && <span className="ml-2 text-blue-600">· {w.ktx}</span>}
                    {w.day && <span className="ml-1 text-blue-600">{w.day}</span>}
                    {w.phong_so && <span className="ml-1 text-blue-600">P.{w.phong_so}</span>}
                    {w.giuong && <span className="ml-1 text-blue-600">G.{w.giuong}</span>}
                  </p>
                </div>
                <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">
                  Chọn →
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Bed History Modal ────────────────────────────────────────────────────────
function BedHistoryModal({ bed, onClose }: { bed: Bed; onClose: () => void }) {
  const [history, setHistory] = useState<BedHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('bed_history')
        .select('*')
        .eq('bed_id', bed.id)
        .order('event_at', { ascending: false });
      setHistory((data || []) as BedHistoryEntry[]);
      setLoading(false);
    };
    load();
  }, [bed.id]);

  const EVENT_LABELS: Record<string, { label: string; color: string }> = {
    assigned:   { label: 'Gán giường',    color: 'bg-emerald-100 text-emerald-700' },
    checked_out:{ label: 'Trả giường',    color: 'bg-red-100 text-red-700' },
    reassigned: { label: 'Đổi nhân sự',   color: 'bg-blue-100 text-blue-700' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Lịch sử giường</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bed.ktx} — {bed.day} — Phòng {bed.phong_so} — Giường {bed.giuong}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 size={20} className="animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có lịch sử</p>
          ) : (
            history.map(h => {
              const cfg = EVENT_LABELS[h.event_type] || { label: h.event_type, color: 'bg-gray-100 text-gray-700' };
              return (
                <div key={h.id} className="flex gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {h.ma_nv && (
                        <span className="text-xs font-mono text-foreground">{h.ma_nv}</span>
                      )}
                    </div>
                    {h.ho_va_ten && (
                      <p className="text-sm font-medium text-foreground mt-1">{h.ho_va_ten}</p>
                    )}
                    {h.note && (
                      <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      <span>{new Date(h.event_at).toLocaleString('vi-VN')}</span>
                      {h.performed_by && <span>· {h.performed_by}</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Add Bed Modal ────────────────────────────────────────────────────────────
function AddBedModal({
  onClose,
  onAdd,
  ktxList,
}: {
  onClose: () => void;
  onAdd: (bed: Partial<Bed>) => Promise<void>;
  ktxList: string[];
}) {
  const [ktx, setKtx] = useState(ktxList[0] || '');
  const [day, setDay] = useState('');
  const [phong, setPhong] = useState('');
  const [giuong, setGiuong] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!ktx || !day || !phong || !giuong) {
      setError('Vui lòng điền đầy đủ thông tin.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const bedQrId = `BED-${ktx.replace(/\s/g, '')}-${day.replace(/\s/g, '')}-P${phong}-G${giuong}-${Date.now()}`;
      await onAdd({ ktx, day, phong_so: phong, giuong, bed_qr_id: bedQrId, status: 'empty' });
      onClose();
    } catch (e: any) {
      setError(e.message || 'Lỗi khi thêm giường');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Thêm giường mới</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Khu KTX *</label>
            <select value={ktx} onChange={e => setKtx(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              {ktxList.map(k => <option key={k} value={k}>{k}</option>)}
              <option value="">Khác (nhập tay)</option>
            </select>
            {ktx === '' && (
              <input type="text" placeholder="Nhập tên KTX..." onChange={e => setKtx(e.target.value)}
                className="mt-1 w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            )}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Dãy *</label>
            <input type="text" placeholder="VD: Dãy 1" value={day} onChange={e => setDay(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Phòng số *</label>
            <input type="text" placeholder="VD: 101" value={phong} onChange={e => setPhong(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Số giường *</label>
            <input type="text" placeholder="VD: 1" value={giuong} onChange={e => setGiuong(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
        <div className="flex gap-3 pt-2">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            Hủy
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Thêm giường
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── QR Display Modal ─────────────────────────────────────────────────────────
function BedQRModal({ bed, baseUrl, onClose }: { bed: Bed; baseUrl: string; onClose: () => void }) {
  const url = `${baseUrl}/bed-scan?bed_id=${encodeURIComponent(bed.bed_qr_id)}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&margin=10&color=1a1a2e&bgcolor=ffffff`;
  const qrLargeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}&margin=20&color=1a1a2e&bgcolor=ffffff`;

  const handleDownload = async () => {
    try {
      const response = await fetch(qrLargeUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qr-giuong-${bed.bed_qr_id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(qrLargeUrl, '_blank');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Mã QR Giường</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bed.ktx} — {bed.day} — Phòng {bed.phong_so} — Giường {bed.giuong}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="bg-white rounded-2xl border-2 border-primary/20 p-3 shadow-lg">
            <img src={qrApiUrl} alt={`QR giường ${bed.giuong}`} width={200} height={200} className="w-48 h-48 rounded-lg" />
          </div>
          <div className="w-full bg-muted/50 rounded-xl p-3 space-y-1">
            <p className="text-xs text-muted-foreground">ID giường:</p>
            <code className="text-xs font-mono text-foreground break-all">{bed.bed_qr_id}</code>
          </div>
          {bed.status === 'occupied' && bed.ho_va_ten && (
            <div className="w-full flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl">
              <UserCheck size={16} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-emerald-700">{bed.ho_va_ten}</p>
                <p className="text-xs text-emerald-600">Mã NV: {bed.ma_nv}</p>
              </div>
            </div>
          )}
        </div>
        <button onClick={handleDownload}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 transition-opacity">
          <Download size={14} /> Tải QR xuống
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function BedManagementClient() {
  const [beds, setBeds] = useState<Bed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [filterKtx, setFilterKtx] = useState('all');
  const [filterDay, setFilterDay] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'empty' | 'occupied'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [assigningBed, setAssigningBed] = useState<Bed | null>(null);
  const [historyBed, setHistoryBed] = useState<Bed | null>(null);
  const [qrBed, setQrBed] = useState<Bed | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [deletingBed, setDeletingBed] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const { currentUser } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined') setBaseUrl(window.location.origin);
  }, []);

  const fetchBeds = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('beds')
        .select('*')
        .order('ktx')
        .order('day')
        .order('phong_so')
        .order('giuong');
      if (!error) setBeds((data || []) as Bed[]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBeds(); }, [fetchBeds]);

  // ─── Derived filter options ───────────────────────────────────────────────
  const ktxList = Array.from(new Set(beds.map(b => b.ktx).filter(Boolean))).sort();
  const dayList = Array.from(new Set(beds.filter(b => filterKtx === 'all' || b.ktx === filterKtx).map(b => b.day).filter(Boolean))).sort();

  const filteredBeds = beds.filter(b => {
    if (filterKtx !== 'all' && b.ktx !== filterKtx) return false;
    if (filterDay !== 'all' && b.day !== filterDay) return false;
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.ho_va_ten?.toLowerCase().includes(q) ||
        b.ma_nv?.toLowerCase().includes(q) ||
        b.phong_so?.toLowerCase().includes(q) ||
        b.giuong?.toLowerCase().includes(q) ||
        b.bed_qr_id?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalBeds = beds.length;
  const occupiedBeds = beds.filter(b => b.status === 'occupied').length;
  const emptyBeds = beds.filter(b => b.status === 'empty').length;

  // ─── Add bed ──────────────────────────────────────────────────────────────
  const handleAddBed = async (bedData: Partial<Bed>) => {
    const { error } = await supabase.from('beds').insert([bedData]);
    if (error) throw new Error(error.message);
    await fetchBeds(true);
  };

  // ─── Assign worker to bed (two-way sync) ─────────────────────────────────
  const handleAssignWorker = async (bed: Bed, worker: WorkerOption) => {
    const now = new Date().toISOString();
    const performedBy = currentUser?.email || 'admin';

    // 1. If bed was previously occupied, log checkout for old occupant
    if (bed.status === 'occupied' && bed.ma_nv) {
      await supabase.from('bed_history').insert([{
        bed_id: bed.id,
        bed_qr_id: bed.bed_qr_id,
        ktx: bed.ktx,
        day: bed.day,
        phong_so: bed.phong_so,
        giuong: bed.giuong,
        event_type: 'reassigned',
        ma_nv: bed.ma_nv,
        ho_va_ten: bed.ho_va_ten,
        performed_by: performedBy,
        note: `Đổi sang ${worker.ho_va_ten} (${worker.ma_nv})`,
        event_at: now,
      }]);
      // Clear old worker's bed info
      await supabase.from('workers').update({
        ktx: '', day: '', phong_so: '', giuong: '',
      }).eq('ma_nv', bed.ma_nv);
    }

    // 2. Update bed: assign new worker
    await supabase.from('beds').update({
      ma_nv: worker.ma_nv,
      ho_va_ten: worker.ho_va_ten,
      status: 'occupied',
      assigned_at: now,
    }).eq('id', bed.id);

    // 3. Update worker profile with bed location (two-way sync)
    await supabase.from('workers').update({
      ktx: bed.ktx,
      day: bed.day,
      phong_so: bed.phong_so,
      giuong: bed.giuong,
      worker_status: 'active',
    }).eq('ma_nv', worker.ma_nv);

    // 4. Log assignment history
    await supabase.from('bed_history').insert([{
      bed_id: bed.id,
      bed_qr_id: bed.bed_qr_id,
      ktx: bed.ktx,
      day: bed.day,
      phong_so: bed.phong_so,
      giuong: bed.giuong,
      event_type: 'assigned',
      ma_nv: worker.ma_nv,
      ho_va_ten: worker.ho_va_ten,
      performed_by: performedBy,
      note: `Gán từ danh sách quản lý`,
      event_at: now,
    }]);

    // 5. Log to audit_logs
    await supabase.from('audit_logs').insert([{
      account: performedBy,
      action: 'BED_ASSIGN',
      detail: `Gán ${worker.ho_va_ten} (${worker.ma_nv}) vào giường ${bed.giuong} — Phòng ${bed.phong_so} — ${bed.day} — ${bed.ktx}`,
    }]);

    await fetchBeds(true);
  };

  // ─── Check-out (release bed) ──────────────────────────────────────────────
  const handleCheckOut = async (bed: Bed) => {
    if (!bed.ma_nv) return;
    setCheckingOut(bed.id);
    const now = new Date().toISOString();
    const performedBy = currentUser?.email || 'admin';

    try {
      // 1. Release bed
      await supabase.from('beds').update({
        ma_nv: null,
        ho_va_ten: null,
        status: 'empty',
        assigned_at: null,
      }).eq('id', bed.id);

      // 2. Update worker: mark as "Đã rời KTX", clear bed location
      await supabase.from('workers').update({
        ktx: '',
        day: '',
        phong_so: '',
        giuong: '',
        worker_status: 'left',
        ngay_ra_ktx: new Date().toLocaleDateString('vi-VN'),
      }).eq('ma_nv', bed.ma_nv);

      // 3. Log bed history
      await supabase.from('bed_history').insert([{
        bed_id: bed.id,
        bed_qr_id: bed.bed_qr_id,
        ktx: bed.ktx,
        day: bed.day,
        phong_so: bed.phong_so,
        giuong: bed.giuong,
        event_type: 'checked_out',
        ma_nv: bed.ma_nv,
        ho_va_ten: bed.ho_va_ten,
        performed_by: performedBy,
        note: 'Trả giường — Đã rời KTX',
        event_at: now,
      }]);

      // 4. Audit log
      await supabase.from('audit_logs').insert([{
        account: performedBy,
        action: 'BED_CHECKOUT',
        detail: `Trả giường: ${bed.ho_va_ten} (${bed.ma_nv}) — Giường ${bed.giuong} — Phòng ${bed.phong_so} — ${bed.day} — ${bed.ktx} → Đã rời KTX`,
      }]);

      setBeds(prev => prev.map(b => b.id === bed.id
        ? { ...b, ma_nv: null, ho_va_ten: null, status: 'empty', assigned_at: null }
        : b
      ));
    } finally {
      setCheckingOut(null);
    }
  };

  // ─── Delete bed ───────────────────────────────────────────────────────────
  const handleDeleteBed = async (bedId: string) => {
    setDeletingBed(bedId);
    try {
      await supabase.from('bed_history').delete().eq('bed_id', bedId);
      await supabase.from('beds').delete().eq('id', bedId);
      setBeds(prev => prev.filter(b => b.id !== bedId));
    } finally {
      setDeletingBed(null);
    }
  };

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filteredBeds.map((b, i) => ({
      'STT': i + 1,
      'KTX': b.ktx,
      'Dãy': b.day,
      'Phòng': b.phong_so,
      'Giường': b.giuong,
      'Trạng thái': b.status === 'occupied' ? 'Đang có người ở' : 'Giường trống',
      'Mã NV': b.ma_nv || '',
      'Họ và tên': b.ho_va_ten || '',
      'Ngày gán': b.assigned_at ? new Date(b.assigned_at).toLocaleDateString('vi-VN') : '',
      'Mã QR': b.bed_qr_id,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Danh sách giường');
    XLSX.writeFile(wb, `danh-sach-giuong-${new Date().toLocaleDateString('vi-VN').replace(/\//g, '-')}.xlsx`);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
              <BedDouble size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalBeds}</p>
              <p className="text-xs text-muted-foreground">Tổng số giường</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <UserCheck size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{occupiedBeds}</p>
              <p className="text-xs text-muted-foreground">Đang có người ở</p>
            </div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
              <BedDouble size={18} className="text-gray-500" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{emptyBeds}</p>
              <p className="text-xs text-muted-foreground">Giường trống</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tên, Mã NV, phòng, giường..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <select value={filterKtx} onChange={e => { setFilterKtx(e.target.value); setFilterDay('all'); }}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none">
          <option value="all">Tất cả KTX</option>
          {ktxList.map(k => <option key={k} value={k}>{k}</option>)}
        </select>
        <select value={filterDay} onChange={e => setFilterDay(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none">
          <option value="all">Tất cả dãy</option>
          {dayList.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none">
          <option value="all">Tất cả trạng thái</option>
          <option value="occupied">Đang có người ở</option>
          <option value="empty">Giường trống</option>
        </select>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => fetchBeds(true)} disabled={refreshing}
            className="p-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground">
            <Download size={14} /> Xuất Excel
          </button>
          <button onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            <Plus size={14} /> Thêm giường
          </button>
        </div>
      </div>

      {/* Beds Table */}
      {filteredBeds.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <BedDouble size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Chưa có giường nào</p>
          <p className="text-xs mt-1">Thêm giường để bắt đầu quản lý</p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Vị trí</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Trạng thái</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Nhân sự</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Ngày gán</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredBeds.map(bed => (
                  <tr key={bed.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <BedDouble size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">
                            {bed.ktx} · {bed.day}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Phòng {bed.phong_so} · Giường {bed.giuong}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                        bed.status === 'occupied' ?'bg-emerald-100 text-emerald-700 border-emerald-200' :'bg-gray-100 text-gray-600 border-gray-200'
                      }`}>
                        {bed.status === 'occupied' ? <UserCheck size={11} /> : <BedDouble size={11} />}
                        {bed.status === 'occupied' ? 'Đang có người ở' : 'Giường trống'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {bed.status === 'occupied' && bed.ho_va_ten ? (
                        <div>
                          <p className="font-medium text-foreground text-xs">{bed.ho_va_ten}</p>
                          <p className="text-xs text-muted-foreground font-mono">{bed.ma_nv}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Chưa có người</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-muted-foreground">
                        {bed.assigned_at ? new Date(bed.assigned_at).toLocaleDateString('vi-VN') : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {/* QR Code */}
                        <button
                          onClick={() => setQrBed(bed)}
                          title="Xem mã QR"
                          className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
                        >
                          <QrCode size={14} />
                        </button>
                        {/* Assign / Reassign */}
                        <button
                          onClick={() => setAssigningBed(bed)}
                          title={bed.status === 'occupied' ? 'Đổi nhân sự' : 'Gán nhân sự'}
                          className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
                        >
                          <ArrowLeftRight size={14} />
                        </button>
                        {/* Check-out */}
                        {bed.status === 'occupied' && (
                          <button
                            onClick={() => handleCheckOut(bed)}
                            disabled={checkingOut === bed.id}
                            title="Trả giường (Check-out)"
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50"
                          >
                            {checkingOut === bed.id
                              ? <Loader2 size={14} className="animate-spin" />
                              : <LogOut size={14} />
                            }
                          </button>
                        )}
                        {/* History */}
                        <button
                          onClick={() => setHistoryBed(bed)}
                          title="Lịch sử"
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                        >
                          <History size={14} />
                        </button>
                        {/* Delete */}
                        <button
                          onClick={() => handleDeleteBed(bed.id)}
                          disabled={deletingBed === bed.id}
                          title="Xóa giường"
                          className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50"
                        >
                          {deletingBed === bed.id
                            ? <Loader2 size={14} className="animate-spin" />
                            : <Trash2 size={14} />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">
              Hiển thị <strong>{filteredBeds.length}</strong> / {totalBeds} giường
            </p>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && (
        <AddBedModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAddBed}
          ktxList={ktxList.length > 0 ? ktxList : ['KTX 1', 'KTX 2']}
        />
      )}
      {assigningBed && (
        <AssignWorkerModal
          bed={assigningBed}
          onClose={() => setAssigningBed(null)}
          onAssign={handleAssignWorker}
        />
      )}
      {historyBed && (
        <BedHistoryModal
          bed={historyBed}
          onClose={() => setHistoryBed(null)}
        />
      )}
      {qrBed && baseUrl && (
        <BedQRModal
          bed={qrBed}
          baseUrl={baseUrl}
          onClose={() => setQrBed(null)}
        />
      )}
    </div>
  );
}
