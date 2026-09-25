'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { QrCode, Calendar, Play, Square, Users, UserCheck, UserX, Download, RefreshCw, Loader2, CheckCircle2, Clock, Edit3, Save, X, AlertCircle, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/context/AuthContext';

interface AttendanceSession {
  id: string;
  session_date: string;
  opened_by: string | null;
  opened_at: string;
  is_active: boolean;
}

interface AttendanceRecord {
  id: string;
  session_id: string;
  session_date: string;
  ma_nv: string;
  ho_va_ten: string;
  ktx: string;
  day: string;
  phong_so: string;
  checked_in_at: string;
  status: string;
  ghi_chu: string;
}

interface WorkerInfo {
  id: string;
  ho_va_ten: string;
  ma_nv: string;
  ktx: string;
  day: string;
  phong_so: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  present:  { label: 'Có mặt',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  absent:   { label: 'Vắng không phép', color: 'bg-red-100 text-red-700 border-red-200' },
  excused:  { label: 'Có phép',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

function QRCodeDisplay({ url, sessionDate }: { url: string; sessionDate: string }) {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}&margin=10&color=1a1a2e&bgcolor=ffffff`;
  const qrLargeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}&margin=20&color=1a1a2e&bgcolor=ffffff`;

  const handleDownload = async () => {
    try {
      const response = await fetch(qrLargeUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qr-diemdanh-${sessionDate}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(qrLargeUrl, '_blank');
    }
  };

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-5">
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <div className="flex-shrink-0 flex flex-col items-center gap-3">
          <div className="bg-white rounded-2xl border-2 border-emerald-200 p-3 shadow-lg">
            <img src={qrApiUrl} alt={`QR điểm danh ngày ${sessionDate}`} width={200} height={200} className="w-48 h-48 rounded-lg" />
          </div>
          <button onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors shadow-sm">
            <Download size={13} /> Tải QR xuống
          </button>
        </div>
        <div className="flex-1 text-center sm:text-left space-y-3">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold mb-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Phiên đang mở
            </div>
            <h3 className="font-bold text-foreground text-lg">QR Điểm Danh</h3>
            <p className="text-sm text-muted-foreground mt-1">Ngày: <strong>{sessionDate}</strong></p>
          </div>
          <div className="bg-white/80 rounded-xl border border-border p-3 space-y-1.5">
            <p className="text-xs text-muted-foreground">Đường dẫn quét:</p>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-foreground break-all block">{url}</code>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 bg-white text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">✓ Chống quét trùng</span>
            <span className="flex items-center gap-1 bg-white text-blue-700 px-2 py-1 rounded-full border border-blue-200">✓ Xác nhận tức thì</span>
            <span className="flex items-center gap-1 bg-white text-purple-700 px-2 py-1 rounded-full border border-purple-200">✓ Hiển thị phòng/dãy</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function AttendancePortalClient() {
  const [activeTab, setActiveTab] = useState<'session' | 'records'>('session');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openingSession, setOpeningSession] = useState(false);
  const [closingSession, setClosingSession] = useState(false);

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allWorkers, setAllWorkers] = useState<WorkerInfo[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'excused'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [attendanceUrl, setAttendanceUrl] = useState('');
  const { currentUser } = useAuth();
  const supabase = createClient();
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAttendanceUrl(`${window.location.origin}/attendance`);
    }
  }, []);

  // ─── Load session for selected date ──────────────────────────────────────
  const fetchSession = useCallback(async (date: string, silent = false) => {
    if (!silent) setSessionLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('session_date', date)
        .maybeSingle();
      if (!error) setSession(data);
    } catch (e: any) {
      console.error('fetchSession error:', e.message);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => { fetchSession(selectedDate); }, [selectedDate, fetchSession]);

  // ─── Load attendance records + all workers ────────────────────────────────
  const fetchRecordsAndWorkers = useCallback(async (silent = false) => {
    if (!session) return;
    if (!silent) setRecordsLoading(true);
    else setRefreshing(true);
    try {
      const [recRes, wkRes] = await Promise.all([
        supabase.from('attendance_records').select('*').eq('session_id', session.id).order('checked_in_at', { ascending: false }),
        supabase.from('workers').select('id, ho_va_ten, ma_nv, ktx, day, phong_so').order('ho_va_ten'),
      ]);
      if (!recRes.error) setRecords(recRes.data || []);
      if (!wkRes.error) setAllWorkers(wkRes.data || []);
    } catch (e: any) {
      console.error('fetchRecords error:', e.message);
    } finally {
      setRecordsLoading(false);
      setRefreshing(false);
    }
  }, [session?.id]);

  useEffect(() => {
    if (session) fetchRecordsAndWorkers();
  }, [session?.id, fetchRecordsAndWorkers]);

  // ─── Auto-poll every 15s when session is active ───────────────────────────
  useEffect(() => {
    if (session?.is_active) {
      pollRef.current = setInterval(() => {
        fetchSession(selectedDate, true);
        fetchRecordsAndWorkers(true);
      }, 15000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [session?.is_active, selectedDate]);

  // ─── Open session ─────────────────────────────────────────────────────────
  const handleOpenSession = async () => {
    setOpeningSession(true);
    try {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .upsert({ session_date: selectedDate, opened_by: currentUser?.id ?? null, is_active: true, opened_at: new Date().toISOString() }, { onConflict: 'session_date' })
        .select()
        .single();
      if (!error && data) {
        setSession(data);
        setActiveTab('records');
      }
    } catch (e: any) {
      console.error('openSession error:', e.message);
    } finally {
      setOpeningSession(false);
    }
  };

  // ─── Close session ────────────────────────────────────────────────────────
  const handleCloseSession = async () => {
    if (!session) return;
    setClosingSession(true);
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ is_active: false })
        .eq('id', session.id);
      if (!error) setSession(prev => prev ? { ...prev, is_active: false } : prev);
    } catch (e: any) {
      console.error('closeSession error:', e.message);
    } finally {
      setClosingSession(false);
    }
  };

  // ─── Update record status manually ───────────────────────────────────────
  const startEdit = (rec: AttendanceRecord) => {
    setEditingId(rec.id);
    setEditStatus(rec.status);
    setEditNote(rec.ghi_chu || '');
  };

  const saveEdit = async (recId: string) => {
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('attendance_records')
        .update({ status: editStatus, ghi_chu: editNote })
        .eq('id', recId);
      if (!error) {
        setRecords(prev => prev.map(r => r.id === recId ? { ...r, status: editStatus, ghi_chu: editNote } : r));
        setEditingId(null);
      }
    } catch (e: any) {
      console.error('saveEdit error:', e.message);
    } finally {
      setSavingEdit(false);
    }
  };

  // ─── Compute absent workers ───────────────────────────────────────────────
  const checkedInMaNvSet = new Set(records.map(r => r.ma_nv));
  const absentWorkers: WorkerInfo[] = allWorkers.filter(w => w.ma_nv && !checkedInMaNvSet.has(w.ma_nv));

  // ─── Filtered records ─────────────────────────────────────────────────────
  const filteredRecords = records.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.ho_va_ten.toLowerCase().includes(q) || r.ma_nv.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredAbsent = absentWorkers.filter(w => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return w.ho_va_ten.toLowerCase().includes(q) || (w.ma_nv || '').toLowerCase().includes(q);
    }
    return true;
  });

  // ─── Export absent list to Excel ──────────────────────────────────────────
  const handleExportAbsent = () => {
    const data = absentWorkers.map((w, i) => ({
      'STT': i + 1,
      'Họ và tên': w.ho_va_ten,
      'Mã NV': w.ma_nv || '',
      'KTX': w.ktx || '',
      'Dãy': w.day || '',
      'Phòng': w.phong_so || '',
      'Trạng thái': 'Vắng mặt',
      'Ngày': selectedDate,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Vắng mặt');
    XLSX.writeFile(wb, `VangMat_${selectedDate}.xlsx`);
  };

  const presentCount = records.filter(r => r.status === 'present').length;
  const excusedCount = records.filter(r => r.status === 'excused').length;
  const absentCount = absentWorkers.length;
  const totalWorkers = allWorkers.length;

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">QR Điểm Danh & Kiểm Soát Quân Số</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Quản lý điểm danh hàng ngày qua mã QR</p>
        </div>
        {session && (
          <button onClick={() => { fetchSession(selectedDate, true); fetchRecordsAndWorkers(true); }} disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Làm mới
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {[
          { key: 'session', label: 'Mở phiên điểm danh', icon: <QrCode size={14} /> },
          { key: 'records', label: 'Bảng điểm danh', icon: <Users size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Session Management ─── */}
      {activeTab === 'session' && (
        <div className="space-y-5">
          {/* Date picker + open/close */}
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Calendar size={18} className="text-primary" /> Chọn ngày điểm danh</h2>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ngày điểm danh</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              {sessionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" /> Đang kiểm tra...
                </div>
              ) : session?.is_active ? (
                <button onClick={handleCloseSession} disabled={closingSession}
                  className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors">
                  {closingSession ? <Loader2 size={15} className="animate-spin" /> : <Square size={15} />}
                  Đóng phiên điểm danh
                </button>
              ) : (
                <button onClick={handleOpenSession} disabled={openingSession || !selectedDate}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                  {openingSession ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                  Mở phiên điểm danh
                </button>
              )}
            </div>

            {/* Session status */}
            {!sessionLoading && session && (
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border ${session.is_active ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-muted border-border text-muted-foreground'}`}>
                {session.is_active
                  ? <><div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" /> Phiên đang mở — Công nhân có thể quét QR</>
                  : <><div className="w-2 h-2 bg-gray-400 rounded-full" /> Phiên đã đóng — Không nhận điểm danh mới</>
                }
              </div>
            )}
            {!sessionLoading && !session && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border bg-amber-50 border-amber-200 text-amber-800">
                <AlertCircle size={14} /> Chưa có phiên điểm danh cho ngày này. Bấm &quot;Mở phiên điểm danh&quot; để bắt đầu.
              </div>
            )}
          </div>

          {/* QR Code display */}
          {session?.is_active && attendanceUrl && (
            <QRCodeDisplay url={`${attendanceUrl}?session=${session.id}&date=${selectedDate}`} sessionDate={selectedDate} />
          )}

          {/* Quick stats */}
          {session && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Tổng công nhân', value: totalWorkers, color: 'text-foreground bg-card border-border', icon: <Users size={18} /> },
                { label: 'Đã điểm danh', value: presentCount + excusedCount, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <UserCheck size={18} /> },
                { label: 'Vắng mặt', value: absentCount, color: 'text-red-700 bg-red-50 border-red-200', icon: <UserX size={18} /> },
                { label: 'Tỷ lệ có mặt', value: totalWorkers > 0 ? `${Math.round(((presentCount + excusedCount) / totalWorkers) * 100)}%` : '—', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: <CheckCircle2 size={18} /> },
              ].map(s => (
                <div key={s.label} className={`p-4 rounded-xl border flex items-center gap-3 ${s.color}`}>
                  <div className="opacity-70">{s.icon}</div>
                  <div>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs mt-0.5 font-medium opacity-80">{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB: Records ─── */}
      {activeTab === 'records' && (
        <div className="space-y-4">
          {!session ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <QrCode size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Chưa có phiên điểm danh. Chuyển sang tab &quot;Mở phiên điểm danh&quot; để bắt đầu.</p>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Tổng công nhân', value: totalWorkers, color: 'text-foreground bg-card border-border' },
                  { label: 'Đã điểm danh', value: presentCount + excusedCount, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                  { label: 'Vắng mặt', value: absentCount, color: 'text-red-700 bg-red-50 border-red-200' },
                  { label: 'Có phép', value: excusedCount, color: 'text-blue-700 bg-blue-50 border-blue-200' },
                ].map(s => (
                  <div key={s.label} className={`p-3 rounded-xl border text-center ${s.color}`}>
                    <p className="text-2xl font-bold">{s.value}</p>
                    <p className="text-xs mt-0.5 font-medium opacity-80">{s.label}</p>
                  </div>
                ))}
              </div>

              {/* Filters + export */}
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex gap-1 bg-muted rounded-lg p-1">
                    {[
                      { key: 'all', label: `Tất cả (${records.length})` },
                      { key: 'present', label: `Có mặt (${presentCount})` },
                      { key: 'excused', label: `Có phép (${excusedCount})` },
                      { key: 'absent', label: `Vắng (${absentCount})` },
                    ].map(t => (
                      <button key={t.key} onClick={() => setFilterStatus(t.key as any)}
                        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filterStatus === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
                        {t.label}
                      </button>
                    ))}
                  </div>
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Tìm tên / mã NV..." value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-44" />
                  </div>
                </div>
                <button onClick={handleExportAbsent} disabled={absentWorkers.length === 0}
                  className="flex items-center gap-2 px-3 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors">
                  <Download size={14} /> Xuất danh sách vắng ({absentCount})
                </button>
              </div>

              {/* Checked-in records */}
              {(filterStatus === 'all' || filterStatus === 'present' || filterStatus === 'excused') && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <UserCheck size={16} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-foreground">Đã điểm danh ({filteredRecords.length})</span>
                  </div>
                  {recordsLoading ? (
                    <div className="flex items-center justify-center py-10"><Loader2 size={22} className="animate-spin text-primary" /></div>
                  ) : filteredRecords.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <Clock size={32} className="mb-2 opacity-30" />
                      <p className="text-sm">Chưa có ai điểm danh</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredRecords.map((rec, idx) => {
                        const cfg = STATUS_LABELS[rec.status] || STATUS_LABELS['present'];
                        const isEditing = editingId === rec.id;
                        return (
                          <div key={rec.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 text-emerald-700 font-bold text-sm">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-semibold text-foreground text-sm">{rec.ho_va_ten}</span>
                                  {rec.ma_nv && <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{rec.ma_nv}</span>}
                                  {!isEditing && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>{cfg.label}</span>
                                  )}
                                </div>
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                  {rec.ktx && <span>{rec.ktx}</span>}
                                  {rec.day && <span>Dãy {rec.day}</span>}
                                  {rec.phong_so && <span>Phòng {rec.phong_so}</span>}
                                  <span>{new Date(rec.checked_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                {isEditing && (
                                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                                    <select value={editStatus} onChange={e => setEditStatus(e.target.value)}
                                      className="px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                                      <option value="present">Có mặt</option>
                                      <option value="excused">Có phép</option>
                                      <option value="absent">Vắng không phép</option>
                                    </select>
                                    <input type="text" placeholder="Ghi chú..." value={editNote}
                                      onChange={e => setEditNote(e.target.value)}
                                      className="px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary w-40" />
                                    <button onClick={() => saveEdit(rec.id)} disabled={savingEdit}
                                      className="flex items-center gap-1 px-2 py-1 bg-primary text-primary-foreground rounded text-xs font-medium hover:opacity-90 disabled:opacity-50">
                                      {savingEdit ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Lưu
                                    </button>
                                    <button onClick={() => setEditingId(null)}
                                      className="flex items-center gap-1 px-2 py-1 border border-border rounded text-xs text-muted-foreground hover:bg-muted">
                                      <X size={11} /> Hủy
                                    </button>
                                  </div>
                                )}
                                {rec.ghi_chu && !isEditing && <p className="text-xs text-muted-foreground mt-0.5 italic">{rec.ghi_chu}</p>}
                              </div>
                              {!isEditing && (
                                <button onClick={() => startEdit(rec)}
                                  className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors flex-shrink-0" title="Cập nhật trạng thái">
                                  <Edit3 size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Absent workers */}
              {(filterStatus === 'all' || filterStatus === 'absent') && (
                <div className="bg-card border border-red-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-200 bg-red-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <UserX size={16} className="text-red-600" />
                      <span className="text-sm font-semibold text-red-800">Chưa điểm danh / Vắng mặt ({filteredAbsent.length})</span>
                    </div>
                  </div>
                  {recordsLoading ? (
                    <div className="flex items-center justify-center py-10"><Loader2 size={22} className="animate-spin text-primary" /></div>
                  ) : filteredAbsent.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                      <CheckCircle2 size={32} className="mb-2 opacity-30 text-emerald-500" />
                      <p className="text-sm">Tất cả đã điểm danh!</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border">
                      {filteredAbsent.map((w, idx) => (
                        <div key={w.id} className="px-4 py-3 hover:bg-red-50/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600 font-bold text-sm">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground text-sm">{w.ho_va_ten}</span>
                                {w.ma_nv && <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{w.ma_nv}</span>}
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-red-100 text-red-700 border-red-200">Chưa điểm danh</span>
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                                {w.ktx && <span>{w.ktx}</span>}
                                {w.day && <span>Dãy {w.day}</span>}
                                {w.phong_so && <span>Phòng {w.phong_so}</span>}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
