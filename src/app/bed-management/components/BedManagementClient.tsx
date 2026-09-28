'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { BedDouble, QrCode, Search, Plus, Trash2, X, Loader2, RefreshCw, Download, History, UserCheck, LogOut, ArrowLeftRight, Upload, Wand2, Clock, FileText, AlertCircle, ChevronLeft, ChevronRight, Link2 } from 'lucide-react';
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
  pending_status: string | null;
  temp_identifier: string | null;
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
  don_vi?: string;
}

// ─── Assign Worker Modal ──────────────────────────────────────────────────────
function AssignWorkerModal({
  bed, onClose, onAssign, onAssignPending,
}: {
  bed: Bed;
  onClose: () => void;
  onAssign: (bed: Bed, worker: WorkerOption) => Promise<void>;
  onAssignPending: (bed: Bed, tempId: string, name: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<'search' | 'pending'>('search');
  const [search, setSearch] = useState('');
  const [filterDonVi, setFilterDonVi] = useState('');
  const [filterToTruong, setFilterToTruong] = useState('');
  const [workers, setWorkers] = useState<WorkerOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [tempId, setTempId] = useState('');
  const [tempName, setTempName] = useState('');
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data } = await supabase
        .from('workers')
        .select('id, ho_va_ten, ma_nv, ktx, day, phong_so, giuong, worker_status, don_vi, to_truong')
        .or('worker_status.eq.active,worker_status.is.null')
        .order('ho_va_ten');
      setWorkers((data || []) as WorkerOption[]);
      setLoading(false);
    };
    load();
  }, []);

  // Unique lists for filter dropdowns
  const donViList = Array.from(new Set(workers.map(w => w.don_vi).filter(Boolean))).sort() as string[];
  const toTruongList = Array.from(new Set(workers.map((w: any) => w.to_truong).filter(Boolean))).sort() as string[];

  const filtered = workers.filter(w => {
    const q = search.toLowerCase();
    const matchSearch = !q || (
      w.ho_va_ten?.toLowerCase().includes(q) ||
      w.ma_nv?.toLowerCase().includes(q) ||
      w.don_vi?.toLowerCase().includes(q) ||
      (w as any).to_truong?.toLowerCase().includes(q)
    );
    const matchDonVi = !filterDonVi || w.don_vi === filterDonVi;
    const matchToTruong = !filterToTruong || (w as any).to_truong === filterToTruong;
    return matchSearch && matchDonVi && matchToTruong;
  });

  const handleAssign = async (w: WorkerOption) => {
    setAssigning(true);
    try { await onAssign(bed, w); onClose(); } finally { setAssigning(false); }
  };

  const handlePending = async () => {
    if (!tempName.trim()) return;
    setAssigning(true);
    try { await onAssignPending(bed, tempId.trim() || `CHO-${Date.now()}`, tempName.trim()); onClose(); }
    finally { setAssigning(false); }
  };

  const hasFilters = filterDonVi || filterToTruong || search;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Gán nhân sự vào giường</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {bed.ktx} — {bed.day} — Phòng {bed.phong_so} — Giường {bed.giuong}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>
        {/* Tabs */}
        <div className="flex border-b border-border flex-shrink-0">
          <button onClick={() => setTab('search')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === 'search' ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            Tìm từ danh sách
          </button>
          <button onClick={() => setTab('pending')}
            className={`flex-1 py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${tab === 'pending' ? 'text-amber-600 border-b-2 border-amber-500' : 'text-muted-foreground hover:text-foreground'}`}>
            <Clock size={13} /> Chờ mã
          </button>
        </div>

        {tab === 'search' ? (
          <>
            {/* Smart filters */}
            <div className="p-4 border-b border-border flex-shrink-0 space-y-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="text" placeholder="Tìm theo tên, Mã NV, đơn vị, tổ trưởng..."
                  value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" autoFocus />
              </div>
              <div className="flex gap-2">
                <select
                  value={filterDonVi}
                  onChange={e => setFilterDonVi(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Tất cả Đơn vị</option>
                  {donViList.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  value={filterToTruong}
                  onChange={e => setFilterToTruong(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Tất cả Tổ trưởng</option>
                  {toTruongList.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {hasFilters && (
                  <button
                    onClick={() => { setSearch(''); setFilterDonVi(''); setFilterToTruong(''); }}
                    className="px-2 py-1.5 text-xs border border-border rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                    title="Xóa bộ lọc"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {filtered.length} nhân sự {hasFilters ? '(đã lọc)' : 'trong danh sách'}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Không tìm thấy nhân sự</p>
              ) : (
                filtered.slice(0, 100).map(w => (
                  <button key={w.id} onClick={() => handleAssign(w)} disabled={assigning}
                    className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-muted/60 transition-colors text-left group">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{w.ho_va_ten}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Mã NV: <span className="font-mono font-medium">{w.ma_nv || '—'}</span>
                        {w.don_vi && <span className="ml-2 text-blue-600">· {w.don_vi}</span>}
                        {(w as any).to_truong && <span className="ml-2 text-purple-600">· TT: {(w as any).to_truong}</span>}
                        {w.ktx && <span className="ml-2 text-emerald-600">· {w.ktx}</span>}
                      </p>
                    </div>
                    <span className="text-xs text-primary opacity-0 group-hover:opacity-100 transition-opacity font-medium">Chọn →</span>
                  </button>
                ))
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 p-5 space-y-4">
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-2">
              <Clock size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-700">Dành cho nhân sự mới vào ở nhưng chưa có Mã NV chính thức. Có thể liên kết Mã NV sau mà không mất lịch sử điểm danh.</p>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Họ và tên *</label>
              <input type="text" placeholder="Nhập họ và tên..." value={tempName} onChange={e => setTempName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-300" autoFocus />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">Định danh tạm (tùy chọn)</label>
              <input type="text" placeholder="VD: CCCD, SĐT, tên gọi..." value={tempId} onChange={e => setTempId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-300" />
              <p className="text-xs text-muted-foreground mt-1">Nếu để trống, hệ thống tự tạo mã tạm.</p>
            </div>
            <button onClick={handlePending} disabled={!tempName.trim() || assigning}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors">
              {assigning ? <Loader2 size={14} className="animate-spin" /> : <Clock size={14} />}
              Gán trạng thái Chờ mã
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Link Mã NV Modal (for "Chờ mã" beds) ────────────────────────────────────
function LinkMaNvModal({ bed, onClose, onLink }: {
  bed: Bed;
  onClose: () => void;
  onLink: (bed: Bed, maNv: string) => Promise<void>;
}) {
  const [maNv, setMaNv] = useState('');
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');

  const handleLink = async () => {
    if (!maNv.trim()) return;
    setLinking(true); setError('');
    try { await onLink(bed, maNv.trim()); onClose(); }
    catch (e: any) { setError(e.message || 'Lỗi liên kết'); }
    finally { setLinking(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2"><Link2 size={16} className="text-primary" />Liên kết Mã NV</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{bed.ho_va_ten} · {bed.ktx} P.{bed.phong_so} G.{bed.giuong}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">Nhập Mã NV chính thức để liên kết với hồ sơ nhân sự. Lịch sử điểm danh sẽ được giữ nguyên.</p>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-1">Mã NV chính thức *</label>
          <input type="text" placeholder="Nhập Mã NV..." value={maNv} onChange={e => setMaNv(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" autoFocus
            onKeyDown={e => e.key === 'Enter' && handleLink()} />
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button onClick={onClose} disabled={linking} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">Hủy</button>
          <button onClick={handleLink} disabled={!maNv.trim() || linking}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
            {linking ? <Loader2 size={14} className="animate-spin" /> : <Link2 size={14} />}
            Liên kết
          </button>
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
      const { data } = await supabase.from('bed_history').select('*').eq('bed_id', bed.id).order('event_at', { ascending: false });
      setHistory((data || []) as BedHistoryEntry[]);
      setLoading(false);
    };
    load();
  }, [bed.id]);

  const EVENT_LABELS: Record<string, { label: string; color: string }> = {
    assigned:       { label: 'Gán giường',      color: 'bg-emerald-100 text-emerald-700' },
    checked_out:    { label: 'Trả giường',       color: 'bg-red-100 text-red-700' },
    reassigned:     { label: 'Đổi nhân sự',      color: 'bg-blue-100 text-blue-700' },
    pending_assign: { label: 'Gán Chờ mã',       color: 'bg-amber-100 text-amber-700' },
    pending_linked: { label: 'Liên kết Mã NV',   color: 'bg-purple-100 text-purple-700' },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h3 className="font-semibold text-foreground">Lịch sử giường</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{bed.ktx} — {bed.day} — Phòng {bed.phong_so} — Giường {bed.giuong}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 size={20} className="animate-spin text-muted-foreground" /></div>
          ) : history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">Chưa có lịch sử</p>
          ) : (
            history.map(h => {
              const cfg = EVENT_LABELS[h.event_type] || { label: h.event_type, color: 'bg-gray-100 text-gray-700' };
              return (
                <div key={h.id} className="flex gap-3 p-3 rounded-xl border border-border bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      {h.ma_nv && <span className="text-xs font-mono text-foreground">{h.ma_nv}</span>}
                    </div>
                    {h.ho_va_ten && <p className="text-sm font-medium text-foreground mt-1">{h.ho_va_ten}</p>}
                    {h.note && <p className="text-xs text-muted-foreground mt-0.5">{h.note}</p>}
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
function AddBedModal({ onClose, onAdd, ktxList }: {
  onClose: () => void;
  onAdd: (bed: Partial<Bed>) => Promise<void>;
  ktxList: string[];
}) {
  const [ktx, setKtx] = useState(ktxList[0] || '');
  const [ktxCustom, setKtxCustom] = useState('');
  const [day, setDay] = useState('');
  const [phong, setPhong] = useState('');
  const [giuong, setGiuong] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const effectiveKtx = ktx === '__custom__' ? ktxCustom : ktx;

  const handleSave = async () => {
    if (!effectiveKtx || !day || !phong || !giuong) { setError('Vui lòng điền đầy đủ thông tin.'); return; }
    setSaving(true); setError('');
    try {
      const bedQrId = `BED-${effectiveKtx.replace(/\s/g, '')}-${day.replace(/\s/g, '')}-P${phong}-G${giuong}-${Date.now()}`;
      await onAdd({ ktx: effectiveKtx, day, phong_so: phong, giuong, bed_qr_id: bedQrId, status: 'empty' });
      onClose();
    } catch (e: any) { setError(e.message || 'Lỗi khi thêm giường'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">Thêm giường mới</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">Khu KTX *</label>
            <select value={ktx} onChange={e => setKtx(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
              {ktxList.map(k => <option key={k} value={k}>{k}</option>)}
              <option value="__custom__">✏ Nhập tay...</option>
            </select>
            {ktx === '__custom__' && (
              <input type="text" placeholder="Nhập tên KTX..." value={ktxCustom} onChange={e => setKtxCustom(e.target.value)}
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
          <button onClick={onClose} disabled={saving} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">Hủy</button>
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
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch { window.open(qrLargeUrl, '_blank'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground">Mã QR Giường</h3>
            <p className="text-xs text-muted-foreground mt-0.5">{bed.ktx} — {bed.day} — Phòng {bed.phong_so} — Giường {bed.giuong}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
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
                <p className="text-xs text-emerald-600">
                  {bed.pending_status === 'cho_ma' ? `Chờ mã · ${bed.temp_identifier}` : `Mã NV: ${bed.ma_nv}`}
                </p>
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

// ─── Excel Import Modal ───────────────────────────────────────────────────────
interface ImportBedRow {
  ktx: string;
  day: string;
  phong_so: string;
  giuong: string;
  ma_nv?: string;
  ho_va_ten?: string;
}

function ExcelImportModal({ onClose, onImport }: {
  onClose: () => void;
  onImport: (rows: ImportBedRow[]) => Promise<void>;
}) {
  const [rows, setRows] = useState<ImportBedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const fileRef = useRef<HTMLInputElement>(null);

  const parseFile = (file: File) => {
    setFileName(file.name); setParseError(''); setRows([]); setPage(1);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target?.result, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' }) as unknown[][];
        if (!raw || raw.length < 2) { setParseError('File trống hoặc không đọc được.'); return; }

        // Normalize: uppercase + collapse spaces
        const normalize = (s: string) => String(s ?? '').trim().toUpperCase().replace(/\s+/g, ' ');

        // Strip Vietnamese diacritics for fuzzy matching
        const stripDiacritics = (s: string) =>
          s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').replace(/Đ/g, 'D');

        // Combined key: normalized + diacritic-stripped
        const key = (s: string) => stripDiacritics(normalize(s));

        const headerRow = (raw[0] as unknown[]).map(c => normalize(String(c)));
        const headerKeys = headerRow.map(h => key(h));

        // Find column index by checking if any alias matches (exact or contains)
        const find = (...names: string[]) => {
          for (const n of names) {
            const nKey = key(n);
            // Exact match first
            let idx = headerKeys.findIndex(h => h === nKey);
            if (idx >= 0) return idx;
            // Contains match
            idx = headerKeys.findIndex(h => h.includes(nKey) || nKey.includes(h));
            if (idx >= 0) return idx;
          }
          return -1;
        };

        const iKtx   = find('KTX', 'KÝ TÚC XÁ', 'KY TUC XA', 'KHU KTX', 'KHU');
        const iDay   = find('DÃY', 'DAY', 'DÃY NHÀ', 'DAY NHA', 'DÃY PHÒNG', 'DAY PHONG');
        const iPhong = find('PHÒNG', 'PHONG', 'PHÒNG SỐ', 'PHONG SO', 'SỐ PHÒNG', 'SO PHONG', 'PHÒNG Ở', 'PHONG O');
        const iGiuong = find('GIƯỜNG', 'GIUONG', 'SỐ GIƯỜNG', 'SO GIUONG', 'GIƯỜNG SỐ', 'GIUONG SO', 'BED', 'GIUONG_SO');
        const iMaNv  = find('MÃ NV', 'MA NV', 'MANV', 'MÃ NHÂN VIÊN', 'MA NHAN VIEN', 'MÃ NV.', 'MÃ CB', 'MA CB', 'EMPLOYEE ID', 'EMP ID', 'MSNV');
        const iHoTen = find('HỌ VÀ TÊN', 'HO VA TEN', 'HỌ TÊN', 'HO TEN', 'TÊN', 'TEN', 'FULL NAME', 'HỌ VÀ TÊN NV', 'HO VA TEN NV', 'HỌ & TÊN', 'HO & TEN');

        if (iKtx < 0 || iDay < 0 || iPhong < 0 || iGiuong < 0) {
          const missing: string[] = [];
          if (iKtx < 0) missing.push('KTX');
          if (iDay < 0) missing.push('Dãy');
          if (iPhong < 0) missing.push('Phòng');
          if (iGiuong < 0) missing.push('Giường / Số giường');
          setParseError(`Không tìm thấy cột bắt buộc: ${missing.join(', ')}. Tiêu đề cột hiện tại: [${headerRow.join(' | ')}]`);
          return;
        }

        const parsed: ImportBedRow[] = [];
        for (let i = 1; i < raw.length; i++) {
          const row = raw[i] as unknown[];
          const ktx    = String(row[iKtx]    ?? '').trim();
          const day    = String(row[iDay]    ?? '').trim();
          const phong  = String(row[iPhong]  ?? '').trim();
          const giuong = String(row[iGiuong] ?? '').trim();
          if (!ktx || !day || !phong || !giuong) continue;
          const maNv   = iMaNv  >= 0 ? String(row[iMaNv]  ?? '').trim() : undefined;
          const hoTen  = iHoTen >= 0 ? String(row[iHoTen] ?? '').trim() : undefined;
          parsed.push({
            ktx, day, phong_so: phong, giuong,
            ma_nv:    maNv   || undefined,
            ho_va_ten: hoTen || undefined,
          });
        }

        if (parsed.length === 0) { setParseError('Không tìm thấy dữ liệu hợp lệ. Hãy kiểm tra file có dữ liệu từ dòng 2 trở đi.'); return; }
        setRows(parsed);
      } catch (err) { setParseError(`Lỗi đọc file: ${err instanceof Error ? err.message : String(err)}`); }
    };
    reader.readAsArrayBuffer(file);
  };

  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleConfirm = async () => {
    setImporting(true);
    try { await onImport(rows); onClose(); }
    catch { setParseError('Lỗi khi nhập dữ liệu. Vui lòng thử lại.'); }
    finally { setImporting(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-foreground">Nhập giường từ Excel</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Cột bắt buộc: KTX · Dãy · Phòng · Giường. Tùy chọn: Mã NV · Họ và Tên</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted"><X size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-all">
            <Upload size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">Kéo thả hoặc click để chọn file</p>
            <p className="text-xs text-muted-foreground mt-1">Hỗ trợ .xlsx và .xls</p>
            {fileName && <p className="text-xs text-primary mt-2 font-semibold">📄 {fileName}</p>}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }} />
          </div>

          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200">
            <div className="flex items-start gap-2">
              <FileText size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-blue-700"><strong>Cột bắt buộc:</strong> KTX · Dãy · Phòng (hoặc Phòng số) · Giường (hoặc Số giường) · <strong>Tùy chọn:</strong> Mã NV · Họ và Tên</p>
            </div>
          </div>

          {parseError && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-red-700">{parseError}</p>
            </div>
          )}

          {rows.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-100 text-green-700 text-xs font-bold border border-green-200">
                  ✓ {rows.length} giường sẵn sàng nhập
                </span>
                {totalPages > 1 && <span className="text-xs text-muted-foreground">Trang {page}/{totalPages}</span>}
              </div>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr>
                      {['#', 'KTX', 'Dãy', 'Phòng', 'Giường', 'Mã NV', 'Họ và Tên'].map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((r, i) => (
                      <tr key={i} className="border-t border-border hover:bg-muted/20">
                        <td className="px-3 py-1.5 text-muted-foreground">{(page - 1) * PAGE_SIZE + i + 1}</td>
                        <td className="px-3 py-1.5 font-medium text-foreground">{r.ktx}</td>
                        <td className="px-3 py-1.5 text-foreground">{r.day}</td>
                        <td className="px-3 py-1.5 text-foreground">{r.phong_so}</td>
                        <td className="px-3 py-1.5 text-foreground">{r.giuong}</td>
                        <td className="px-3 py-1.5 text-foreground">{r.ma_nv || '—'}</td>
                        <td className="px-3 py-1.5 text-foreground">{r.ho_va_ten || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-muted disabled:opacity-40"><ChevronLeft size={14} /></button>
                  <span className="text-xs text-muted-foreground">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1 rounded hover:bg-muted disabled:opacity-40"><ChevronRight size={14} /></button>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-border flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-muted-foreground">
            {rows.length > 0 ? <span className="text-green-700 font-semibold">{rows.length} giường sẵn sàng nhập</span> : 'Chưa có file nào được chọn'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} disabled={importing} className="px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-muted disabled:opacity-50">Hủy</button>
            <button onClick={handleConfirm} disabled={rows.length === 0 || importing}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50">
              {importing ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {importing ? 'Đang nhập...' : `Nhập ${rows.length} giường`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Auto-Assign Modal ────────────────────────────────────────────────────────
function AutoAssignModal({ beds, onClose, onAutoAssign }: {
  beds: Bed[];
  onClose: () => void;
  onAutoAssign: (strategy: 'by_unit' | 'sequential', targetKtx: string) => Promise<void>;
}) {
  const [strategy, setStrategy] = useState<'by_unit' | 'sequential'>('by_unit');
  const [targetKtx, setTargetKtx] = useState('all');
  const [running, setRunning] = useState(false);
  const ktxList = Array.from(new Set(beds.map(b => b.ktx).filter(Boolean))).sort();
  const emptyCount = beds.filter(b => b.status === 'empty' && (targetKtx === 'all' || b.ktx === targetKtx)).length;

  const handleRun = async () => {
    setRunning(true);
    try { await onAutoAssign(strategy, targetKtx); onClose(); }
    finally { setRunning(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-foreground flex items-center gap-2"><Wand2 size={16} className="text-primary" />Tự động phân bổ giường</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Tự động xếp nhân sự chưa có giường vào các giường trống</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground"><X size={18} /></button>
        </div>

        <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
          <p className="text-xs text-blue-700">
            <strong>{emptyCount}</strong> giường trống sẵn sàng {targetKtx !== 'all' ? `tại ${targetKtx}` : 'trong toàn hệ thống'}.
          </p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">Khu KTX mục tiêu</label>
          <select value={targetKtx} onChange={e => setTargetKtx(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none">
            <option value="all">Tất cả KTX</option>
            {ktxList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground block mb-2">Chiến lược phân bổ</label>
          <div className="space-y-2">
            <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${strategy === 'by_unit' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <input type="radio" name="strategy" value="by_unit" checked={strategy === 'by_unit'} onChange={() => setStrategy('by_unit')} className="mt-0.5 accent-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Theo đơn vị / tổ</p>
                <p className="text-xs text-muted-foreground">Nhân sự cùng đơn vị được xếp vào cùng phòng/dãy</p>
              </div>
            </label>
            <label className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${strategy === 'sequential' ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
              <input type="radio" name="strategy" value="sequential" checked={strategy === 'sequential'} onChange={() => setStrategy('sequential')} className="mt-0.5 accent-primary" />
              <div>
                <p className="text-sm font-semibold text-foreground">Tuần tự</p>
                <p className="text-xs text-muted-foreground">Lần lượt điền vào các giường trống theo thứ tự KTX → Dãy → Phòng → Giường</p>
              </div>
            </label>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onClose} disabled={running} className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted disabled:opacity-50">Hủy</button>
          <button onClick={handleRun} disabled={running || emptyCount === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {running ? 'Đang phân bổ...' : 'Bắt đầu phân bổ'}
          </button>
        </div>
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'empty' | 'occupied' | 'cho_ma'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showAutoAssign, setShowAutoAssign] = useState(false);
  const [assigningBed, setAssigningBed] = useState<Bed | null>(null);
  const [linkingBed, setLinkingBed] = useState<Bed | null>(null);
  const [historyBed, setHistoryBed] = useState<Bed | null>(null);
  const [qrBed, setQrBed] = useState<Bed | null>(null);
  const [checkingOut, setCheckingOut] = useState<string | null>(null);
  const [deletingBed, setDeletingBed] = useState<string | null>(null);

  const [baseUrl, setBaseUrl] = useState('');
  const { currentUser } = useAuth();
  const supabase = createClient();

  useEffect(() => { if (typeof window !== 'undefined') setBaseUrl(window.location.origin); }, []);

  const fetchBeds = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const { data, error } = await supabase.from('beds').select('*').order('ktx').order('day').order('phong_so').order('giuong');
      if (!error) setBeds((data || []) as Bed[]);
    } finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchBeds(); }, [fetchBeds]);

  const ktxList = Array.from(new Set(beds.map(b => b.ktx).filter(Boolean))).sort();
  const dayList = Array.from(new Set(beds.filter(b => filterKtx === 'all' || b.ktx === filterKtx).map(b => b.day).filter(Boolean))).sort();

  const filteredBeds = beds.filter(b => {
    if (filterKtx !== 'all' && b.ktx !== filterKtx) return false;
    if (filterDay !== 'all' && b.day !== filterDay) return false;
    if (filterStatus === 'cho_ma') return b.pending_status === 'cho_ma';
    if (filterStatus !== 'all' && b.status !== filterStatus) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        b.ho_va_ten?.toLowerCase().includes(q) ||
        b.ma_nv?.toLowerCase().includes(q) ||
        b.temp_identifier?.toLowerCase().includes(q) ||
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
  const pendingBeds = beds.filter(b => b.pending_status === 'cho_ma').length;

  // ─── Add bed ──────────────────────────────────────────────────────────────
  const handleAddBed = async (bedData: Partial<Bed>) => {
    const { error } = await supabase.from('beds').insert([bedData]);
    if (error) throw new Error(error.message);
    await fetchBeds(true);
  };

  // ─── Bulk Excel import ────────────────────────────────────────────────────
  const handleBulkImport = async (rows: ImportBedRow[]) => {
    const now = new Date().toISOString();
    const performedBy = currentUser?.email || 'admin';
    const toInsert = rows.map(r => ({
      ktx: r.ktx,
      day: r.day,
      phong_so: r.phong_so,
      giuong: r.giuong,
      bed_qr_id: `BED-${r.ktx.replace(/\s/g, '')}-${r.day.replace(/\s/g, '')}-P${r.phong_so}-G${r.giuong}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      ma_nv: r.ma_nv || null,
      ho_va_ten: r.ho_va_ten || null,
      status: (r.ma_nv ? 'occupied' : 'empty') as 'empty' | 'occupied',
      assigned_at: r.ma_nv ? now : null,
    }));

    // Insert in batches of 100
    for (let i = 0; i < toInsert.length; i += 100) {
      const batch = toInsert.slice(i, i + 100);
      const { error } = await supabase.from('beds').insert(batch);
      if (error) throw new Error(error.message);
    }

    // Two-way sync: update worker profiles for beds with ma_nv
    const withWorker = rows.filter(r => r.ma_nv);
    for (const r of withWorker) {
      await supabase.from('workers').update({ ktx: r.ktx, day: r.day, phong_so: r.phong_so, giuong: r.giuong, worker_status: 'active' }).eq('ma_nv', r.ma_nv!);
    }

    await supabase.from('audit_logs').insert([{
      account: performedBy,
      action: 'BED_BULK_IMPORT',
      detail: `Nhập hàng loạt ${rows.length} giường từ Excel`,
    }]);

    await fetchBeds(true);
  };

  // ─── Auto-assign algorithm ────────────────────────────────────────────────
  const handleAutoAssign = async (strategy: 'by_unit' | 'sequential', targetKtx: string) => {
    const performedBy = currentUser?.email || 'admin';
    const now = new Date().toISOString();

    // Get workers without beds
    const { data: unassignedWorkers } = await supabase
      .from('workers')
      .select('id, ho_va_ten, ma_nv, don_vi, worker_status')
      .or('worker_status.eq.active,worker_status.is.null')
      .or('ktx.is.null,ktx.eq.')
      .order('don_vi').order('ho_va_ten');

    if (!unassignedWorkers || unassignedWorkers.length === 0) return;

    // Get empty beds
    const emptyBeds = beds.filter(b => b.status === 'empty' && (targetKtx === 'all' || b.ktx === targetKtx));
    if (emptyBeds.length === 0) return;

    let bedQueue = [...emptyBeds];
    let workerQueue = [...unassignedWorkers];

    if (strategy === 'by_unit') {
      // Group workers by don_vi, assign same unit to same room area
      const byUnit: Record<string, typeof unassignedWorkers> = {};
      for (const w of workerQueue) {
        const unit = (w as any).don_vi || 'Khác';
        if (!byUnit[unit]) byUnit[unit] = [];
        byUnit[unit].push(w);
      }
      workerQueue = Object.values(byUnit).flat();
    }

    const assignments: Array<{ bedId: string; worker: any }> = [];
    for (let i = 0; i < Math.min(workerQueue.length, bedQueue.length); i++) {
      assignments.push({ bedId: bedQueue[i].id, worker: workerQueue[i] });
    }

    // Apply assignments
    for (const { bedId, worker } of assignments) {
      const bed = beds.find(b => b.id === bedId);
      if (!bed) continue;

      await supabase.from('beds').update({
        ma_nv: worker.ma_nv, ho_va_ten: worker.ho_va_ten, status: 'occupied', assigned_at: now,
      }).eq('id', bedId);

      await supabase.from('workers').update({
        ktx: bed.ktx, day: bed.day, phong_so: bed.phong_so, giuong: bed.giuong, worker_status: 'active',
      }).eq('ma_nv', worker.ma_nv);

      await supabase.from('bed_history').insert([{
        bed_id: bedId, bed_qr_id: bed.bed_qr_id, ktx: bed.ktx, day: bed.day,
        phong_so: bed.phong_so, giuong: bed.giuong, event_type: 'assigned',
        ma_nv: worker.ma_nv, ho_va_ten: worker.ho_va_ten, performed_by: performedBy,
        note: `Tự động phân bổ (${strategy === 'by_unit' ? 'theo đơn vị' : 'tuần tự'})`, event_at: now,
      }]);
    }

    await supabase.from('audit_logs').insert([{
      account: performedBy,
      action: 'BED_AUTO_ASSIGN',
      detail: `Tự động phân bổ ${assignments.length} giường (${strategy})`,
    }]);

    await fetchBeds(true);
  };

  // ─── Assign worker to bed (two-way sync) ─────────────────────────────────
  const handleAssignWorker = async (bed: Bed, worker: WorkerOption) => {
    const now = new Date().toISOString();
    const performedBy = currentUser?.email || 'admin';

    if (bed.status === 'occupied' && bed.ma_nv) {
      await supabase.from('bed_history').insert([{
        bed_id: bed.id, bed_qr_id: bed.bed_qr_id, ktx: bed.ktx, day: bed.day,
        phong_so: bed.phong_so, giuong: bed.giuong, event_type: 'reassigned',
        ma_nv: bed.ma_nv, ho_va_ten: bed.ho_va_ten, performed_by: performedBy,
        note: `Đổi sang ${worker.ho_va_ten} (${worker.ma_nv})`, event_at: now,
      }]);
      await supabase.from('workers').update({ ktx: '', day: '', phong_so: '', giuong: '' }).eq('ma_nv', bed.ma_nv);
    }

    await supabase.from('beds').update({
      ma_nv: worker.ma_nv, ho_va_ten: worker.ho_va_ten, status: 'occupied',
      assigned_at: now, pending_status: null, temp_identifier: null,
    }).eq('id', bed.id);

    await supabase.from('workers').update({
      ktx: bed.ktx, day: bed.day, phong_so: bed.phong_so, giuong: bed.giuong, worker_status: 'active',
    }).eq('ma_nv', worker.ma_nv);

    await supabase.from('bed_history').insert([{
      bed_id: bed.id, bed_qr_id: bed.bed_qr_id, ktx: bed.ktx, day: bed.day,
      phong_so: bed.phong_so, giuong: bed.giuong, event_type: 'assigned',
      ma_nv: worker.ma_nv, ho_va_ten: worker.ho_va_ten, performed_by: performedBy,
      note: 'Gán từ danh sách quản lý', event_at: now,
    }]);

    await supabase.from('audit_logs').insert([{
      account: performedBy, action: 'BED_ASSIGN',
      detail: `Gán ${worker.ho_va_ten} (${worker.ma_nv}) vào giường ${bed.giuong} — Phòng ${bed.phong_so} — ${bed.day} — ${bed.ktx}`,
    }]);

    await fetchBeds(true);
  };

  // ─── Assign "Chờ mã" (pending) ────────────────────────────────────────────
  const handleAssignPending = async (bed: Bed, tempId: string, name: string) => {
    const now = new Date().toISOString();
    const performedBy = currentUser?.email || 'admin';

    await supabase.from('beds').update({
      ma_nv: tempId, ho_va_ten: name, status: 'occupied',
      pending_status: 'cho_ma', temp_identifier: tempId, assigned_at: now,
    }).eq('id', bed.id);

    await supabase.from('bed_history').insert([{
      bed_id: bed.id, bed_qr_id: bed.bed_qr_id, ktx: bed.ktx, day: bed.day,
      phong_so: bed.phong_so, giuong: bed.giuong, event_type: 'pending_assign',
      ma_nv: tempId, ho_va_ten: name, performed_by: performedBy,
      note: `Gán trạng thái Chờ mã — định danh tạm: ${tempId}`, event_at: now,
    }]);

    await fetchBeds(true);
  };

  // ─── Link official Mã NV to "Chờ mã" bed ─────────────────────────────────
  const handleLinkMaNv = async (bed: Bed, maNv: string) => {
    const now = new Date().toISOString();
    const performedBy = currentUser?.email || 'admin';

    // Look up worker
    const { data: worker } = await supabase.from('workers').select('id, ho_va_ten, ma_nv').eq('ma_nv', maNv).maybeSingle();
    const workerName = worker?.ho_va_ten || bed.ho_va_ten || maNv;

    // Update bed: replace temp with official ma_nv, clear pending_status
    await supabase.from('beds').update({
      ma_nv: maNv, ho_va_ten: workerName, pending_status: null, temp_identifier: null,
    }).eq('id', bed.id);

    // Update attendance records that used the temp ID
    if (bed.ma_nv && bed.ma_nv !== maNv) {
      await supabase.from('attendance_records').update({ ma_nv: maNv, ho_va_ten: workerName }).eq('ma_nv', bed.ma_nv);
    }

    // Update worker profile
    if (worker) {
      await supabase.from('workers').update({ ktx: bed.ktx, day: bed.day, phong_so: bed.phong_so, giuong: bed.giuong, worker_status: 'active' }).eq('ma_nv', maNv);
    }

    await supabase.from('bed_history').insert([{
      bed_id: bed.id, bed_qr_id: bed.bed_qr_id, ktx: bed.ktx, day: bed.day,
      phong_so: bed.phong_so, giuong: bed.giuong, event_type: 'pending_linked',
      ma_nv: maNv, ho_va_ten: workerName, performed_by: performedBy,
      note: `Liên kết Mã NV chính thức: ${maNv} (từ định danh tạm: ${bed.temp_identifier})`, event_at: now,
    }]);

    await fetchBeds(true);
  };

  // ─── Check-out (release bed) ──────────────────────────────────────────────
  const handleCheckOut = async (bed: Bed) => {
    if (!bed.ma_nv) return;
    setCheckingOut(bed.id);
    const now = new Date().toISOString();
    const performedBy = currentUser?.email || 'admin';
    const today = new Date().toLocaleDateString('vi-VN');

    try {
      await supabase.from('beds').update({ ma_nv: null, ho_va_ten: null, status: 'empty', assigned_at: null, pending_status: null, temp_identifier: null }).eq('id', bed.id);

      if (bed.pending_status !== 'cho_ma') {
        await supabase.from('workers').update({ ktx: '', day: '', phong_so: '', giuong: '', worker_status: 'left', ngay_ra_ktx: today }).eq('ma_nv', bed.ma_nv);
      }

      await supabase.from('bed_history').insert([{
        bed_id: bed.id, bed_qr_id: bed.bed_qr_id, ktx: bed.ktx, day: bed.day,
        phong_so: bed.phong_so, giuong: bed.giuong, event_type: 'checked_out',
        ma_nv: bed.ma_nv, ho_va_ten: bed.ho_va_ten, performed_by: performedBy,
        note: bed.pending_status === 'cho_ma' ? 'Trả giường — Chờ mã (không cập nhật hồ sơ)' : 'Trả giường — Đã rời KTX', event_at: now,
      }]);

      await supabase.from('audit_logs').insert([{
        account: performedBy, action: 'BED_CHECKOUT',
        detail: `Trả giường: ${bed.ho_va_ten} (${bed.ma_nv}) — Giường ${bed.giuong} — Phòng ${bed.phong_so} — ${bed.day} — ${bed.ktx}`,
      }]);

      setBeds(prev => prev.map(b => b.id === bed.id ? { ...b, ma_nv: null, ho_va_ten: null, status: 'empty', assigned_at: null, pending_status: null, temp_identifier: null } : b));
    } finally { setCheckingOut(null); }
  };

  // ─── Delete bed ───────────────────────────────────────────────────────────
  const handleDeleteBed = async (bedId: string) => {
    setDeletingBed(bedId);
    try {
      await supabase.from('bed_history').delete().eq('bed_id', bedId);
      await supabase.from('beds').delete().eq('id', bedId);
      setBeds(prev => prev.filter(b => b.id !== bedId));
    } finally { setDeletingBed(null); }
  };

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = filteredBeds.map((b, i) => ({
      'STT': i + 1,
      'KTX': b.ktx,
      'Dãy': b.day,
      'Phòng': b.phong_so,
      'Giường': b.giuong,
      'Trạng thái': b.pending_status === 'cho_ma' ? 'Chờ mã' : b.status === 'occupied' ? 'Đang có người ở' : 'Giường trống',
      'Mã NV': b.pending_status === 'cho_ma' ? `[Chờ mã] ${b.temp_identifier}` : (b.ma_nv || ''),
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
    return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center"><BedDouble size={18} className="text-blue-600" /></div>
            <div><p className="text-2xl font-bold text-foreground">{totalBeds}</p><p className="text-xs text-muted-foreground">Tổng số giường</p></div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center"><UserCheck size={18} className="text-emerald-600" /></div>
            <div><p className="text-2xl font-bold text-foreground">{occupiedBeds}</p><p className="text-xs text-muted-foreground">Đang có người ở</p></div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center"><BedDouble size={18} className="text-gray-500" /></div>
            <div><p className="text-2xl font-bold text-foreground">{emptyBeds}</p><p className="text-xs text-muted-foreground">Giường trống</p></div>
          </div>
        </div>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center"><Clock size={18} className="text-amber-600" /></div>
            <div><p className="text-2xl font-bold text-foreground">{pendingBeds}</p><p className="text-xs text-muted-foreground">Chờ mã</p></div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Tìm theo tên, Mã NV, phòng, giường..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
          <option value="cho_ma">Chờ mã</option>
        </select>
        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <button onClick={() => fetchBeds(true)} disabled={refreshing}
            className="p-2 border border-border rounded-lg hover:bg-muted transition-colors text-muted-foreground disabled:opacity-50">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground">
            <Download size={14} /> Xuất Excel
          </button>
          <button onClick={() => setShowImportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm hover:bg-muted transition-colors text-muted-foreground">
            <Upload size={14} /> Nhập Excel
          </button>
          <button onClick={() => setShowAutoAssign(true)}
            className="flex items-center gap-1.5 px-3 py-2 border border-amber-300 bg-amber-50 text-amber-700 rounded-lg text-sm hover:bg-amber-100 transition-colors">
            <Wand2 size={14} /> Tự động phân bổ
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
          <p className="text-xs mt-1">Thêm giường hoặc nhập từ Excel để bắt đầu</p>
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
                  <tr key={bed.id} className={`hover:bg-muted/20 transition-colors ${bed.pending_status === 'cho_ma' ? 'bg-amber-50/50' : ''}`}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <BedDouble size={14} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-xs">{bed.ktx} · {bed.day}</p>
                          <p className="text-xs text-muted-foreground">Phòng {bed.phong_so} · Giường {bed.giuong}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {bed.pending_status === 'cho_ma' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border bg-amber-100 text-amber-700 border-amber-200">
                          <Clock size={11} /> Chờ mã
                        </span>
                      ) : (
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${bed.status === 'occupied' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {bed.status === 'occupied' ? <UserCheck size={11} /> : <BedDouble size={11} />}
                          {bed.status === 'occupied' ? 'Đang có người ở' : 'Giường trống'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {bed.status === 'occupied' && bed.ho_va_ten ? (
                        <div>
                          <p className="font-medium text-foreground text-xs">{bed.ho_va_ten}</p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {bed.pending_status === 'cho_ma' ? <span className="text-amber-600">Chờ mã · {bed.temp_identifier}</span> : bed.ma_nv}
                          </p>
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
                        <button onClick={() => setQrBed(bed)} title="Xem mã QR" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"><QrCode size={14} /></button>
                        <button onClick={() => setAssigningBed(bed)} title={bed.status === 'occupied' ? 'Đổi nhân sự' : 'Gán nhân sự'} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"><ArrowLeftRight size={14} /></button>
                        {bed.pending_status === 'cho_ma' && (
                          <button onClick={() => setLinkingBed(bed)} title="Liên kết Mã NV chính thức" className="p-1.5 rounded-lg hover:bg-purple-50 text-purple-600 transition-colors"><Link2 size={14} /></button>
                        )}
                        {bed.status === 'occupied' && (
                          <button onClick={() => handleCheckOut(bed)} disabled={checkingOut === bed.id} title="Trả giường (Check-out)" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 transition-colors disabled:opacity-50">
                            {checkingOut === bed.id ? <Loader2 size={14} className="animate-spin" /> : <LogOut size={14} />}
                          </button>
                        )}
                        <button onClick={() => setHistoryBed(bed)} title="Lịch sử" className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"><History size={14} /></button>
                        <button onClick={() => handleDeleteBed(bed.id)} disabled={deletingBed === bed.id} title="Xóa giường" className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors disabled:opacity-50">
                          {deletingBed === bed.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">Hiển thị <strong>{filteredBeds.length}</strong> / {totalBeds} giường</p>
          </div>
        </div>
      )}

      {/* Modals */}
      {showAddModal && <AddBedModal onClose={() => setShowAddModal(false)} onAdd={handleAddBed} ktxList={ktxList.length > 0 ? ktxList : ['KTX 1', 'KTX 2']} />}
      {showImportModal && <ExcelImportModal onClose={() => setShowImportModal(false)} onImport={handleBulkImport} />}
      {showAutoAssign && <AutoAssignModal beds={beds} onClose={() => setShowAutoAssign(false)} onAutoAssign={handleAutoAssign} />}
      {assigningBed && <AssignWorkerModal bed={assigningBed} onClose={() => setAssigningBed(null)} onAssign={handleAssignWorker} onAssignPending={handleAssignPending} />}
      {linkingBed && <LinkMaNvModal bed={linkingBed} onClose={() => setLinkingBed(null)} onLink={handleLinkMaNv} />}
      {historyBed && <BedHistoryModal bed={historyBed} onClose={() => setHistoryBed(null)} />}
      {qrBed && baseUrl && <BedQRModal bed={qrBed} baseUrl={baseUrl} onClose={() => setQrBed(null)} />}
    </div>
  );
}
