'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { QrCode, Calendar, Play, Square, Users, UserCheck, UserX, Download, RefreshCw, Loader2, CheckCircle2, Clock, Edit3, Save, X, AlertCircle, Search, Trash2, Filter, MapPin, Bell, BellRing } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useAuth } from '@/context/AuthContext';

interface AttendanceSession {
  id: string;
  session_date: string;
  opened_by: string | null;
  opened_at: string;
  is_active: boolean;
  zone_ktx: string;
  zone_day: string;
  zone_phong: string;
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

interface AbsenceAlert {
  ma_nv: string;
  ho_va_ten: string;
  ktx: string;
  day: string;
  phong_so: string;
  absent_days: number;
  last_seen_date: string | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  present:  { label: 'Có mặt',        color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  absent:   { label: 'Vắng không phép', color: 'bg-red-100 text-red-700 border-red-200' },
  excused:  { label: 'Có phép',        color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

function getZoneLabel(s: AttendanceSession): string {
  if (!s.zone_ktx && !s.zone_day && !s.zone_phong) return 'Toàn KTX';
  const parts: string[] = [];
  if (s.zone_ktx) parts.push(s.zone_ktx);
  if (s.zone_day) parts.push(`Dãy ${s.zone_day}`);
  if (s.zone_phong) parts.push(`Phòng ${s.zone_phong}`);
  return parts.join(' — ');
}

function QRCodeDisplay({ url, sessionDate, zoneLabel }: { url: string; sessionDate: string; zoneLabel: string }) {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}&margin=10&color=1a1a2e&bgcolor=ffffff`;
  const qrLargeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}&margin=20&color=1a1a2e&bgcolor=ffffff`;

  const handleDownload = async () => {
    try {
      const response = await fetch(qrLargeUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = `qr-diemdanh-${sessionDate}-${zoneLabel.replace(/\s/g, '_')}.png`;
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
            <img src={qrApiUrl} alt={`QR điểm danh ngày ${sessionDate} - ${zoneLabel}`} width={200} height={200} className="w-48 h-48 rounded-lg" />
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
              Phiên đang mở — Hợp lệ cả ngày
            </div>
            <h3 className="font-bold text-foreground text-lg">QR Điểm Danh</h3>
            <p className="text-sm text-muted-foreground mt-1">Ngày: <strong>{sessionDate}</strong></p>
            <p className="text-sm text-muted-foreground">Khu vực: <strong className="text-emerald-700">{zoneLabel}</strong></p>
          </div>
          <div className="bg-white/80 rounded-xl border border-border p-3 space-y-1.5">
            <p className="text-xs text-muted-foreground">Đường dẫn quét:</p>
            <code className="text-xs bg-muted px-2 py-1 rounded font-mono text-foreground break-all block">{url}</code>
          </div>
          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1 bg-white text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">✓ Không hết hạn trong ngày</span>
            <span className="flex items-center gap-1 bg-white text-blue-700 px-2 py-1 rounded-full border border-blue-200">✓ Xác nhận tức thì</span>
            <span className="flex items-center gap-1 bg-white text-purple-700 px-2 py-1 rounded-full border border-purple-200">✓ Hiển thị phòng/dãy</span>
          </div>
        </div>
      </div>
    </div>
  );
}

async function fetchAllWorkers(supabase: ReturnType<typeof createClient>): Promise<WorkerInfo[]> {
  const PAGE = 1000;
  let all: WorkerInfo[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('workers')
      .select('id, ho_va_ten, ma_nv, ktx, day, phong_so')
      .order('ho_va_ten')
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export default function AttendancePortalClient() {
  const [activeTab, setActiveTab] = useState<'session' | 'records' | 'alerts'>('session');

  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [activeSession, setActiveSession] = useState<AttendanceSession | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [openingSession, setOpeningSession] = useState(false);
  const [closingSession, setClosingSession] = useState(false);
  const [deletingSession, setDeletingSession] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [zoneKtx, setZoneKtx] = useState('');
  const [zoneDay, setZoneDay] = useState('');
  const [zonePhong, setZonePhong] = useState('');

  const [ktxList, setKtxList] = useState<string[]>([]);
  const [dayListByKtx, setDayListByKtx] = useState<Record<string, string[]>>({});
  const [phongListByKtxDay, setPhongListByKtxDay] = useState<Record<string, string[]>>({});

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [allWorkers, setAllWorkers] = useState<WorkerInfo[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Realtime
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [newCheckInFlash, setNewCheckInFlash] = useState(false);
  const realtimeChannelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null);

  // Absence alerts
  const [absenceAlerts, setAbsenceAlerts] = useState<AbsenceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);
  const [absenceThreshold, setAbsenceThreshold] = useState(3);
  const [alertKtxFilter, setAlertKtxFilter] = useState('');

  const [filterStatus, setFilterStatus] = useState<'all' | 'present' | 'absent' | 'excused'>('all');
  const [filterKtx, setFilterKtx] = useState<string>('all');
  const [filterDay, setFilterDay] = useState<string>('all');
  const [filterPhong, setFilterPhong] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editNote, setEditNote] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const [attendanceUrl, setAttendanceUrl] = useState('');
  const { currentUser } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAttendanceUrl(`${window.location.origin}/attendance`);
    }
  }, []);

  // ─── Load all workers once ────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const workers = await fetchAllWorkers(supabase);
      setAllWorkers(workers);
      const ktxSet = new Set<string>();
      const dayMap: Record<string, Set<string>> = {};
      const phongMap: Record<string, Set<string>> = {};
      workers.forEach(w => {
        if (w.ktx) {
          ktxSet.add(w.ktx);
          if (!dayMap[w.ktx]) dayMap[w.ktx] = new Set();
          if (w.day) {
            dayMap[w.ktx].add(w.day);
            const key = `${w.ktx}__${w.day}`;
            if (!phongMap[key]) phongMap[key] = new Set();
            if (w.phong_so) phongMap[key].add(w.phong_so);
          }
        }
      });
      const sortedKtx = Array.from(ktxSet).sort();
      setKtxList(sortedKtx);
      const dayResult: Record<string, string[]> = {};
      sortedKtx.forEach(k => { dayResult[k] = Array.from(dayMap[k] || []).sort(); });
      setDayListByKtx(dayResult);
      const phongResult: Record<string, string[]> = {};
      Object.entries(phongMap).forEach(([k, v]) => { phongResult[k] = Array.from(v).sort(); });
      setPhongListByKtxDay(phongResult);
    };
    load();
  }, []);

  // ─── Load sessions ────────────────────────────────────────────────────────
  const fetchSessions = useCallback(async (date: string, silent = false) => {
    if (!silent) setSessionLoading(true);
    try {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('session_date', date)
        .order('opened_at', { ascending: true });
      if (!error) {
        const list = (data || []) as AttendanceSession[];
        setSessions(list);
        setActiveSession(prev => {
          if (!prev) return list.find(s => s.is_active) || list[0] || null;
          const updated = list.find(s => s.id === prev.id);
          return updated || list.find(s => s.is_active) || list[0] || null;
        });
      }
    } catch (e: any) {
      console.error('fetchSessions error:', e.message);
    } finally {
      setSessionLoading(false);
    }
  }, []);

  useEffect(() => { fetchSessions(selectedDate); }, [selectedDate, fetchSessions]);

  // ─── Load records ─────────────────────────────────────────────────────────
  const fetchRecords = useCallback(async (silent = false) => {
    if (!activeSession) return;
    if (!silent) setRecordsLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('*')
        .eq('session_id', activeSession.id)
        .order('checked_in_at', { ascending: false });
      if (!error) setRecords(data || []);
    } catch (e: any) {
      console.error('fetchRecords error:', e.message);
    } finally {
      setRecordsLoading(false);
      setRefreshing(false);
    }
  }, [activeSession?.id]);

  useEffect(() => {
    if (activeSession) fetchRecords();
  }, [activeSession?.id, fetchRecords]);

  // ─── Realtime subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!activeSession?.id) return;

    // Cleanup previous channel
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const channel = supabase
      .channel(`attendance_records_${activeSession.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${activeSession.id}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newRec = payload.new as AttendanceRecord;
            setRecords(prev => {
              const exists = prev.some(r => r.id === newRec.id);
              if (exists) return prev;
              // Flash notification
              setNewCheckInFlash(true);
              setTimeout(() => setNewCheckInFlash(false), 3000);
              return [newRec, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as AttendanceRecord;
            setRecords(prev => prev.map(r => r.id === updated.id ? updated : r));
          } else if (payload.eventType === 'DELETE') {
            const deleted = payload.old as { id: string };
            setRecords(prev => prev.filter(r => r.id !== deleted.id));
          }
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    realtimeChannelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      realtimeChannelRef.current = null;
      setRealtimeConnected(false);
    };
  }, [activeSession?.id]);

  // ─── Compute consecutive absence alerts ──────────────────────────────────
  const computeAbsenceAlerts = useCallback(async () => {
    if (allWorkers.length === 0) return;
    setAlertsLoading(true);
    try {
      // Get last N days of attendance sessions
      const today = new Date();
      const dates: string[] = [];
      for (let i = 0; i < 14; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        dates.push(d.toISOString().slice(0, 10));
      }

      // Fetch all sessions in last 14 days
      const { data: sessionsData } = await supabase
        .from('attendance_sessions')
        .select('id, session_date, zone_ktx')
        .in('session_date', dates)
        .order('session_date', { ascending: false });

      if (!sessionsData || sessionsData.length === 0) {
        setAbsenceAlerts([]);
        setAlertsLoading(false);
        return;
      }

      const sessionIds = sessionsData.map((s: any) => s.id);

      // Fetch all records for those sessions
      const { data: recordsData } = await supabase
        .from('attendance_records')
        .select('ma_nv, session_id, status')
        .in('session_id', sessionIds)
        .eq('status', 'present');

      const presentSet = new Set<string>(
        (recordsData || []).map((r: any) => `${r.ma_nv}__${r.session_id}`)
      );

      // Build session date map
      const sessionDateMap: Record<string, string> = {};
      sessionsData.forEach((s: any) => { sessionDateMap[s.id] = s.session_date; });

      // For each worker, count consecutive absent days from today backwards
      const alerts: AbsenceAlert[] = [];
      const targetWorkers = alertKtxFilter
        ? allWorkers.filter(w => w.ktx === alertKtxFilter)
        : allWorkers;

      for (const worker of targetWorkers) {
        if (!worker.ma_nv) continue;

        // Find sessions relevant to this worker's zone
        const relevantSessions = sessionsData.filter((s: any) =>
          !s.zone_ktx || s.zone_ktx === worker.ktx
        );

        if (relevantSessions.length === 0) continue;

        // Count consecutive absences from most recent session backwards
        let consecutiveAbsent = 0;
        let lastSeenDate: string | null = null;

        for (const sess of relevantSessions) {
          const key = `${worker.ma_nv}__${sess.id}`;
          if (presentSet.has(key)) {
            lastSeenDate = sessionDateMap[sess.id];
            break;
          }
          consecutiveAbsent++;
        }

        if (consecutiveAbsent >= absenceThreshold) {
          alerts.push({
            ma_nv: worker.ma_nv,
            ho_va_ten: worker.ho_va_ten,
            ktx: worker.ktx || '',
            day: worker.day || '',
            phong_so: worker.phong_so || '',
            absent_days: consecutiveAbsent,
            last_seen_date: lastSeenDate,
          });
        }
      }

      // Sort by most absent days first
      alerts.sort((a, b) => b.absent_days - a.absent_days);
      setAbsenceAlerts(alerts);
    } catch (e: any) {
      console.error('computeAbsenceAlerts error:', e.message);
    } finally {
      setAlertsLoading(false);
    }
  }, [allWorkers, absenceThreshold, alertKtxFilter]);

  useEffect(() => {
    if (activeTab === 'alerts' && allWorkers.length > 0) {
      computeAbsenceAlerts();
    }
  }, [activeTab, computeAbsenceAlerts]);

  // ─── Derive filter options ────────────────────────────────────────────────
  const filterKtxOptions = Array.from(new Set([
    ...records.map(r => r.ktx).filter(Boolean),
    ...allWorkers.map(w => w.ktx).filter(Boolean),
  ])).sort();

  const filterDayOptions = Array.from(new Set([
    ...records.filter(r => filterKtx === 'all' || r.ktx === filterKtx).map(r => r.day).filter(Boolean),
    ...allWorkers.filter(w => filterKtx === 'all' || w.ktx === filterKtx).map(w => w.day).filter(Boolean),
  ])).sort();

  const filterPhongOptions = Array.from(new Set([
    ...records.filter(r => (filterKtx === 'all' || r.ktx === filterKtx) && (filterDay === 'all' || r.day === filterDay)).map(r => r.phong_so).filter(Boolean),
    ...allWorkers.filter(w => (filterKtx === 'all' || w.ktx === filterKtx) && (filterDay === 'all' || w.day === filterDay)).map(w => w.phong_so).filter(Boolean),
  ])).sort();

  useEffect(() => { setFilterDay('all'); setFilterPhong('all'); }, [filterKtx]);
  useEffect(() => { setFilterPhong('all'); }, [filterDay]);

  const availableDays = zoneKtx ? (dayListByKtx[zoneKtx] || []) : [];
  const availablePhongs = (zoneKtx && zoneDay) ? (phongListByKtxDay[`${zoneKtx}__${zoneDay}`] || []) : [];

  useEffect(() => { setZoneDay(''); setZonePhong(''); }, [zoneKtx]);
  useEffect(() => { setZonePhong(''); }, [zoneDay]);

  // ─── Open session ─────────────────────────────────────────────────────────
  const handleOpenSession = async () => {
    setOpeningSession(true);
    try {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .upsert(
          {
            session_date: selectedDate,
            opened_by: currentUser?.id ?? null,
            is_active: true,
            opened_at: new Date().toISOString(),
            zone_ktx: zoneKtx,
            zone_day: zoneDay,
            zone_phong: zonePhong,
          },
          { onConflict: 'session_date,zone_ktx,zone_day,zone_phong' }
        )
        .select()
        .single();
      if (!error && data) {
        await fetchSessions(selectedDate);
        setActiveSession(data as AttendanceSession);
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
    if (!activeSession) return;
    setClosingSession(true);
    try {
      const { error } = await supabase
        .from('attendance_sessions')
        .update({ is_active: false })
        .eq('id', activeSession.id);
      if (!error) {
        setActiveSession(prev => prev ? { ...prev, is_active: false } : prev);
        await fetchSessions(selectedDate, true);
      }
    } catch (e: any) {
      console.error('closeSession error:', e.message);
    } finally {
      setClosingSession(false);
    }
  };

  // ─── Delete session ───────────────────────────────────────────────────────
  const handleDeleteSession = async () => {
    if (!activeSession) return;
    setDeletingSession(true);
    try {
      await supabase.from('attendance_records').delete().eq('session_id', activeSession.id);
      const { error } = await supabase.from('attendance_sessions').delete().eq('id', activeSession.id);
      if (!error) {
        setRecords([]);
        setShowDeleteConfirm(false);
        await fetchSessions(selectedDate);
        setActiveTab('session');
      }
    } catch (e: any) {
      console.error('deleteSession error:', e.message);
    } finally {
      setDeletingSession(false);
    }
  };

  // ─── Edit record ──────────────────────────────────────────────────────────
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

  // ─── Derived data ─────────────────────────────────────────────────────────
  const checkedInMaNvSet = new Set(records.map(r => r.ma_nv));
  const zoneWorkers: WorkerInfo[] = activeSession
    ? allWorkers.filter(w => {
        if (activeSession.zone_ktx && w.ktx !== activeSession.zone_ktx) return false;
        if (activeSession.zone_day && w.day !== activeSession.zone_day) return false;
        if (activeSession.zone_phong && w.phong_so !== activeSession.zone_phong) return false;
        return true;
      })
    : allWorkers;

  const absentWorkers: WorkerInfo[] = zoneWorkers.filter(w => w.ma_nv && !checkedInMaNvSet.has(w.ma_nv));

  const filteredRecords = records.filter(r => {
    if (filterStatus !== 'all' && r.status !== filterStatus) return false;
    if (filterKtx !== 'all' && r.ktx !== filterKtx) return false;
    if (filterDay !== 'all' && r.day !== filterDay) return false;
    if (filterPhong !== 'all' && r.phong_so !== filterPhong) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return r.ho_va_ten.toLowerCase().includes(q) || r.ma_nv.toLowerCase().includes(q);
    }
    return true;
  });

  const filteredAbsent = absentWorkers.filter(w => {
    if (filterKtx !== 'all' && w.ktx !== filterKtx) return false;
    if (filterDay !== 'all' && w.day !== filterDay) return false;
    if (filterPhong !== 'all' && w.phong_so !== filterPhong) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return w.ho_va_ten.toLowerCase().includes(q) || (w.ma_nv || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handleExportAbsent = () => {
    const data = filteredAbsent.map((w, i) => ({
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

  const handleExportAlerts = () => {
    const data = absenceAlerts.map((a, i) => ({
      'STT': i + 1,
      'Họ và tên': a.ho_va_ten,
      'Mã NV': a.ma_nv,
      'KTX': a.ktx,
      'Dãy': a.day,
      'Phòng': a.phong_so,
      'Số ngày vắng liên tiếp': a.absent_days,
      'Lần cuối có mặt': a.last_seen_date || 'Không rõ',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cảnh báo vắng');
    XLSX.writeFile(wb, `CanhBaoVang_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const presentCount = records.filter(r => r.status === 'present').length;
  const excusedCount = records.filter(r => r.status === 'excused').length;
  const absentCount = absentWorkers.length;
  const totalZoneWorkers = zoneWorkers.length;
  const activeSessionZoneLabel = activeSession ? getZoneLabel(activeSession) : '';

  const buildQrUrl = (s: AttendanceSession) => {
    if (!attendanceUrl) return '';
    const params = new URLSearchParams({ date: s.session_date });
    if (s.zone_ktx) params.set('ktx', s.zone_ktx);
    if (s.zone_day) params.set('day', s.zone_day);
    if (s.zone_phong) params.set('phong', s.zone_phong);
    return `${attendanceUrl}?${params.toString()}`;
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">QR Điểm Danh & Kiểm Soát Quân Số</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Quản lý điểm danh hàng ngày qua mã QR — tổng {allWorkers.length.toLocaleString('vi-VN')} công nhân</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Realtime status indicator */}
          {activeSession && (
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${realtimeConnected ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
              <div className={`w-2 h-2 rounded-full ${realtimeConnected ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
              {realtimeConnected ? 'Realtime' : 'Đang kết nối...'}
            </div>
          )}
          {activeSession && (
            <button onClick={() => { fetchSessions(selectedDate, true); fetchRecords(true); }} disabled={refreshing}
              className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Làm mới
            </button>
          )}
        </div>
      </div>

      {/* New check-in flash notification */}
      {newCheckInFlash && (
        <div className="flex items-center gap-3 px-4 py-3 bg-emerald-600 text-white rounded-xl shadow-lg animate-pulse">
          <BellRing size={18} className="flex-shrink-0" />
          <span className="text-sm font-semibold">✓ Có công nhân vừa điểm danh thành công!</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit flex-wrap">
        {[
          { key: 'session', label: 'Mở phiên điểm danh', icon: <QrCode size={14} /> },
          { key: 'records', label: 'Bảng điểm danh', icon: <Users size={14} /> },
          { key: 'alerts', label: `Cảnh báo vắng${absenceAlerts.length > 0 ? ` (${absenceAlerts.length})` : ''}`, icon: <Bell size={14} /> },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-semibold transition-all ${activeTab === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'} ${t.key === 'alerts' && absenceAlerts.length > 0 ? 'text-amber-600' : ''}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: Session Management ─── */}
      {activeTab === 'session' && (
        <div className="space-y-5">
          <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
            <h2 className="font-semibold text-foreground flex items-center gap-2"><Calendar size={18} className="text-primary" /> Chọn ngày & khu vực điểm danh</h2>
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end flex-wrap">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ngày điểm danh</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>
            <div className="bg-muted/50 border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <MapPin size={15} className="text-primary" /> Khu vực QR (để trống = Toàn KTX)
              </div>
              <div className="flex flex-wrap gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Khu KTX</label>
                  <select value={zoneKtx} onChange={e => setZoneKtx(e.target.value)}
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]">
                    <option value="">Toàn KTX</option>
                    {ktxList.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                {zoneKtx && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Dãy nhà</label>
                    <select value={zoneDay} onChange={e => setZoneDay(e.target.value)}
                      className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]">
                      <option value="">Toàn dãy</option>
                      {availableDays.map(d => <option key={d} value={d}>Dãy {d}</option>)}
                    </select>
                  </div>
                )}
                {zoneKtx && zoneDay && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Phòng cụ thể</label>
                    <select value={zonePhong} onChange={e => setZonePhong(e.target.value)}
                      className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-w-[120px]">
                      <option value="">Toàn phòng</option>
                      {availablePhongs.map(p => <option key={p} value={p}>Phòng {p}</option>)}
                    </select>
                  </div>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                Phạm vi QR: <strong className="text-foreground">
                  {[zoneKtx || 'Toàn KTX', zoneDay ? `Dãy ${zoneDay}` : '', zonePhong ? `Phòng ${zonePhong}` : ''].filter(Boolean).join(' — ')}
                </strong>
              </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center">
              {sessionLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 size={16} className="animate-spin" /> Đang kiểm tra...
                </div>
              ) : (
                <button onClick={handleOpenSession} disabled={openingSession || !selectedDate}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                  {openingSession ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
                  Mở phiên điểm danh
                </button>
              )}
            </div>
          </div>

          {!sessionLoading && sessions.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <QrCode size={15} className="text-primary" />
                Phiên điểm danh ngày {selectedDate} ({sessions.length} phiên)
              </h3>
              {sessions.map(s => (
                <div key={s.id} className={`bg-card border rounded-2xl p-4 space-y-3 cursor-pointer transition-all ${activeSession?.id === s.id ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-primary/50'}`}
                  onClick={() => setActiveSession(s)}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin size={15} className="text-primary flex-shrink-0" />
                      <span className="font-semibold text-foreground text-sm">{getZoneLabel(s)}</span>
                      {activeSession?.id === s.id && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">Đang xem</span>}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${s.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${s.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-gray-400'}`} />
                        {s.is_active ? 'Đang mở' : 'Đã đóng'}
                      </span>
                      {s.is_active ? (
                        <button onClick={e => { e.stopPropagation(); setActiveSession(s); handleCloseSession(); }} disabled={closingSession}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-60 transition-colors">
                          {closingSession && activeSession?.id === s.id ? <Loader2 size={12} className="animate-spin" /> : <Square size={12} />}
                          Đóng phiên
                        </button>
                      ) : null}
                      <button onClick={e => { e.stopPropagation(); setActiveSession(s); setShowDeleteConfirm(true); }}
                        className="flex items-center gap-1.5 px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50 transition-colors">
                        <Trash2 size={12} /> Xóa
                      </button>
                    </div>
                  </div>
                  {s.is_active && attendanceUrl && (
                    <QRCodeDisplay url={buildQrUrl(s)} sessionDate={s.session_date} zoneLabel={getZoneLabel(s)} />
                  )}
                </div>
              ))}
            </div>
          )}

          {!sessionLoading && sessions.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm border bg-amber-50 border-amber-200 text-amber-800">
              <AlertCircle size={14} /> Chưa có phiên điểm danh cho ngày này. Chọn khu vực và bấm &quot;Mở phiên điểm danh&quot; để bắt đầu.
            </div>
          )}

          {activeSession && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: `Tổng (${activeSessionZoneLabel})`, value: totalZoneWorkers.toLocaleString('vi-VN'), color: 'text-foreground bg-card border-border', icon: <Users size={18} /> },
                { label: 'Đã điểm danh', value: presentCount + excusedCount, color: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: <UserCheck size={18} /> },
                { label: 'Vắng mặt', value: absentCount, color: 'text-red-700 bg-red-50 border-red-200', icon: <UserX size={18} /> },
                { label: 'Tỷ lệ có mặt', value: totalZoneWorkers > 0 ? `${Math.round(((presentCount + excusedCount) / totalZoneWorkers) * 100)}%` : '—', color: 'text-blue-700 bg-blue-50 border-blue-200', icon: <CheckCircle2 size={18} /> },
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
          {sessions.length > 1 && (
            <div className="bg-card border border-border rounded-xl p-3 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-muted-foreground font-medium">Xem phiên:</span>
              {sessions.map(s => (
                <button key={s.id} onClick={() => setActiveSession(s)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${activeSession?.id === s.id ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                  <MapPin size={11} /> {getZoneLabel(s)}
                  {s.is_active && <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />}
                </button>
              ))}
            </div>
          )}

          {!activeSession ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <QrCode size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Chưa có phiên điểm danh. Chuyển sang tab &quot;Mở phiên điểm danh&quot; để bắt đầu.</p>
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: `Tổng (${activeSessionZoneLabel})`, value: totalZoneWorkers.toLocaleString('vi-VN'), color: 'text-foreground bg-card border-border' },
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

              {/* Filters */}
              <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                  <Filter size={15} className="text-primary" /> Bộ lọc
                </div>
                <div className="flex flex-wrap gap-3 items-center">
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
                  {filterKtxOptions.length > 0 && (
                    <select value={filterKtx} onChange={e => setFilterKtx(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="all">Tất cả KTX</option>
                      {filterKtxOptions.map(k => <option key={k} value={k}>{k}</option>)}
                    </select>
                  )}
                  {filterDayOptions.length > 0 && (
                    <select value={filterDay} onChange={e => setFilterDay(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="all">Tất cả Dãy</option>
                      {filterDayOptions.map(d => <option key={d} value={d}>Dãy {d}</option>)}
                    </select>
                  )}
                  {filterPhongOptions.length > 0 && (
                    <select value={filterPhong} onChange={e => setFilterPhong(e.target.value)}
                      className="px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                      <option value="all">Tất cả Phòng</option>
                      {filterPhongOptions.map(p => <option key={p} value={p}>Phòng {p}</option>)}
                    </select>
                  )}
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input type="text" placeholder="Tìm tên / mã NV..." value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 w-44" />
                  </div>
                  <button onClick={handleExportAbsent} disabled={filteredAbsent.length === 0}
                    className="flex items-center gap-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-medium hover:bg-amber-700 disabled:opacity-50 transition-colors ml-auto">
                    <Download size={13} /> Xuất vắng ({filteredAbsent.length})
                  </button>
                </div>
              </div>

              {/* Checked-in records */}
              {(filterStatus === 'all' || filterStatus === 'present' || filterStatus === 'excused') && (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <UserCheck size={16} className="text-emerald-600" />
                    <span className="text-sm font-semibold text-foreground">Đã điểm danh ({filteredRecords.length})</span>
                    {realtimeConnected && activeSession?.is_active && (
                      <span className="ml-auto flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        Tự động cập nhật
                      </span>
                    )}
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
                                <div className="mt-1 flex flex-col gap-0.5">
                                  {(rec.ktx || rec.day || rec.phong_so) && (
                                    <p className="text-xs font-medium text-emerald-700">
                                      {[rec.ktx, rec.day ? `Dãy ${rec.day}` : null, rec.phong_so ? `Phòng ${rec.phong_so}` : null].filter(Boolean).join(' - ')}
                                    </p>
                                  )}
                                  <p className="text-xs text-muted-foreground">
                                    Điểm danh lúc: <span className="font-medium text-foreground">{new Date(rec.checked_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                                  </p>
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

      {/* ─── TAB: Absence Alerts ─── */}
      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {/* Info banner */}
          <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
            <BellRing size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">Cảnh báo vắng mặt liên tiếp</p>
              <p className="text-xs mt-0.5 text-amber-700">Hệ thống tự động quét dữ liệu điểm danh 14 ngày gần nhất và cảnh báo những công nhân vắng liên tiếp từ {absenceThreshold} ngày trở lên. Dữ liệu được liên kết trực tiếp từ module Điểm danh QR.</p>
            </div>
          </div>

          {/* Controls */}
          <div className="bg-card border border-border rounded-xl p-4 flex flex-wrap gap-3 items-end">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ngưỡng cảnh báo (số ngày vắng liên tiếp)</label>
              <select value={absenceThreshold} onChange={e => setAbsenceThreshold(Number(e.target.value))}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                {[2, 3, 4, 5, 7, 10].map(n => <option key={n} value={n}>≥ {n} ngày</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Lọc theo KTX</label>
              <select value={alertKtxFilter} onChange={e => setAlertKtxFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option value="">Tất cả KTX</option>
                {ktxList.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <button onClick={computeAbsenceAlerts} disabled={alertsLoading}
              className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-60 transition-colors">
              {alertsLoading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Quét lại
            </button>
            {absenceAlerts.length > 0 && (
              <button onClick={handleExportAlerts}
                className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors ml-auto">
                <Download size={15} /> Xuất Excel ({absenceAlerts.length})
              </button>
            )}
          </div>

          {/* Alert list */}
          {alertsLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 size={28} className="animate-spin text-amber-600" />
                <p className="text-sm text-muted-foreground">Đang phân tích dữ liệu điểm danh...</p>
              </div>
            </div>
          ) : absenceAlerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <CheckCircle2 size={40} className="mb-3 opacity-30 text-emerald-500" />
              <p className="text-base font-medium">Không có cảnh báo vắng mặt</p>
              <p className="text-sm mt-1">Không có công nhân nào vắng liên tiếp ≥ {absenceThreshold} ngày trong 14 ngày qua.</p>
            </div>
          ) : (
            <div className="bg-card border border-amber-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
                <AlertCircle size={16} className="text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">
                  {absenceAlerts.length} công nhân vắng liên tiếp ≥ {absenceThreshold} ngày
                </span>
              </div>
              <div className="divide-y divide-border">
                {absenceAlerts.map((alert, idx) => (
                  <div key={alert.ma_nv} className={`px-4 py-3 hover:bg-amber-50/30 transition-colors ${alert.absent_days >= 7 ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm ${alert.absent_days >= 7 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground text-sm">{alert.ho_va_ten}</span>
                          {alert.ma_nv && <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{alert.ma_nv}</span>}
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${alert.absent_days >= 7 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
                            <AlertCircle size={10} />
                            Vắng {alert.absent_days} ngày liên tiếp
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                          {alert.ktx && <span>{alert.ktx}</span>}
                          {alert.day && <span>Dãy {alert.day}</span>}
                          {alert.phong_so && <span>Phòng {alert.phong_so}</span>}
                          {alert.last_seen_date && (
                            <span className="text-emerald-600">Lần cuối có mặt: {alert.last_seen_date}</span>
                          )}
                          {!alert.last_seen_date && (
                            <span className="text-red-500">Chưa từng điểm danh trong 14 ngày qua</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Delete Confirm Modal ─── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl p-6 max-w-sm w-full space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Trash2 size={20} className="text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Xóa / Reset phiên điểm danh?</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Ngày {selectedDate} — {activeSession ? getZoneLabel(activeSession) : ''}</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Toàn bộ dữ liệu điểm danh của phiên này sẽ bị xóa vĩnh viễn. Hành động này không thể hoàn tác.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deletingSession}
                className="flex-1 py-2.5 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                Hủy
              </button>
              <button onClick={handleDeleteSession} disabled={deletingSession}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2">
                {deletingSession ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                Xóa toàn bộ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
