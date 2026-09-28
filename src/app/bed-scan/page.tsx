'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, AlertCircle, Loader2, BedDouble, User, Hash, UserCheck, ArrowLeftRight } from 'lucide-react';

interface BedInfo {
  id: string;
  ktx: string;
  day: string;
  phong_so: string;
  giuong: string;
  bed_qr_id: string;
  ma_nv: string | null;
  ho_va_ten: string | null;
  status: 'empty' | 'occupied';
}

interface SessionInfo {
  id: string;
  session_date: string;
  is_active: boolean;
  zone_ktx: string;
  zone_day: string;
  zone_phong: string;
}

type PageMode = 'loading' | 'not_found' | 'assign' | 'attendance' | 'submitting' | 'success_assign' | 'success_attendance' | 'already_checked_in' | 'error';

export default function BedScanPage() {
  const [bedId, setBedId] = useState('');
  const [bed, setBed] = useState<BedInfo | null>(null);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [mode, setMode] = useState<PageMode>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  // Assign mode fields
  const [maNv, setMaNv] = useState('');
  const [hoVaTen, setHoVaTen] = useState('');
  const [assignResult, setAssignResult] = useState<{ name: string; ma_nv: string } | null>(null);

  // Attendance result
  const [checkedInTime, setCheckedInTime] = useState('');
  const [alreadyTime, setAlreadyTime] = useState('');

  const supabase = createClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('bed_id') || '';
    setBedId(id);
    if (!id) { setMode('not_found'); return; }
    loadBedAndSession(id);
  }, []);

  const loadBedAndSession = async (id: string) => {
    setMode('loading');
    try {
      // Load bed info
      const { data: bedData, error: bedErr } = await supabase
        .from('beds')
        .select('*')
        .eq('bed_qr_id', id)
        .maybeSingle();

      if (bedErr || !bedData) { setMode('not_found'); return; }
      const bedInfo = bedData as BedInfo;
      setBed(bedInfo);

      // Check for active attendance session matching this bed's location
      const today = new Date().toISOString().slice(0, 10);
      const { data: sessionData } = await supabase
        .from('attendance_sessions')
        .select('id, session_date, is_active, zone_ktx, zone_day, zone_phong')
        .eq('session_date', today)
        .eq('is_active', true)
        .or(`zone_ktx.eq.${bedInfo.ktx},zone_ktx.eq.`)
        .maybeSingle();

      if (sessionData) {
        setSession(sessionData as SessionInfo);
        // If bed is occupied and session is active → attendance mode
        if (bedInfo.status === 'occupied' && bedInfo.ma_nv) {
          setMode('attendance');
        } else {
          // Bed is empty → assign mode
          setMode('assign');
        }
      } else {
        // No active session → assign mode only
        setMode('assign');
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra');
      setMode('error');
    }
  };

  // ─── Handle attendance check-in via bed QR ────────────────────────────────
  const handleAttendance = async () => {
    if (!bed?.ma_nv || !session) return;
    setMode('submitting');
    try {
      // Check duplicate
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id, checked_in_at')
        .eq('session_id', session.id)
        .eq('ma_nv', bed.ma_nv)
        .in('status', ['present', 'excused'])
        .maybeSingle();

      if (existing) {
        setAlreadyTime(new Date(existing.checked_in_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
        setMode('already_checked_in');
        return;
      }

      const now = new Date().toISOString();
      const { error } = await supabase
        .from('attendance_records')
        .upsert({
          session_id: session.id,
          session_date: session.session_date,
          ma_nv: bed.ma_nv,
          ho_va_ten: bed.ho_va_ten || '',
          ktx: bed.ktx,
          day: bed.day,
          phong_so: bed.phong_so,
          status: 'present',
          checked_in_at: now,
          ghi_chu: `Điểm danh qua QR giường ${bed.giuong}`,
        }, { onConflict: 'session_id,ma_nv' });

      if (error) { setErrorMsg(error.message); setMode('error'); return; }
      setCheckedInTime(new Date(now).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
      setMode('success_attendance');
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra');
      setMode('error');
    }
  };

  // ─── Handle assign worker via bed QR ─────────────────────────────────────
  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maNv.trim() || !bed) return;
    setMode('submitting');
    try {
      // Look up worker by Mã NV
      const { data: worker } = await supabase
        .from('workers')
        .select('id, ho_va_ten, ma_nv')
        .eq('ma_nv', maNv.trim())
        .maybeSingle();

      const workerName = worker?.ho_va_ten || hoVaTen.trim() || maNv.trim();
      const now = new Date().toISOString();

      // If bed was previously occupied, clear old worker
      if (bed.status === 'occupied' && bed.ma_nv) {
        await supabase.from('workers').update({
          ktx: '', day: '', phong_so: '', giuong: '',
        }).eq('ma_nv', bed.ma_nv);

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
          performed_by: 'QR Scan',
          note: `Đổi sang ${workerName} (${maNv.trim()})`,
          event_at: now,
        }]);
      }

      // Assign new worker to bed
      await supabase.from('beds').update({
        ma_nv: maNv.trim(),
        ho_va_ten: workerName,
        status: 'occupied',
        assigned_at: now,
      }).eq('id', bed.id);

      // Update worker profile with bed location (two-way sync)
      if (worker) {
        await supabase.from('workers').update({
          ktx: bed.ktx,
          day: bed.day,
          phong_so: bed.phong_so,
          giuong: bed.giuong,
          worker_status: 'active',
        }).eq('ma_nv', maNv.trim());
      }

      // Log history
      await supabase.from('bed_history').insert([{
        bed_id: bed.id,
        bed_qr_id: bed.bed_qr_id,
        ktx: bed.ktx,
        day: bed.day,
        phong_so: bed.phong_so,
        giuong: bed.giuong,
        event_type: 'assigned',
        ma_nv: maNv.trim(),
        ho_va_ten: workerName,
        performed_by: 'QR Scan',
        note: 'Gán qua quét QR giường',
        event_at: now,
      }]);

      setAssignResult({ name: workerName, ma_nv: maNv.trim() });
      setMode('success_assign');
    } catch (e: any) {
      setErrorMsg(e.message || 'Có lỗi xảy ra');
      setMode('error');
    }
  };

  // ─── Render states ────────────────────────────────────────────────────────
  const bgClass = 'min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4';

  if (mode === 'loading') {
    return (
      <div className={bgClass}>
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-600">Đang tải thông tin giường...</p>
        </div>
      </div>
    );
  }

  if (mode === 'not_found') {
    return (
      <div className={bgClass}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Không tìm thấy giường</h2>
          <p className="text-sm text-gray-500">Mã QR này không hợp lệ hoặc giường chưa được đăng ký trong hệ thống.</p>
          <p className="text-xs text-gray-400 font-mono break-all">{bedId}</p>
        </div>
      </div>
    );
  }

  if (mode === 'error') {
    return (
      <div className={bgClass}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Có lỗi xảy ra</h2>
          <p className="text-sm text-gray-500">{errorMsg}</p>
        </div>
      </div>
    );
  }

  if (mode === 'success_attendance') {
    return (
      <div className={bgClass}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Điểm danh thành công!</h2>
          <div className="bg-emerald-50 rounded-xl p-4 space-y-1 text-left">
            <p className="text-sm font-semibold text-emerald-800">{bed?.ho_va_ten}</p>
            <p className="text-xs text-emerald-600">Mã NV: {bed?.ma_nv}</p>
            <p className="text-xs text-emerald-600">
              {bed?.ktx} · {bed?.day} · Phòng {bed?.phong_so} · Giường {bed?.giuong}
            </p>
            <p className="text-xs text-emerald-600 font-semibold mt-1">⏰ {checkedInTime}</p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'already_checked_in') {
    return (
      <div className={bgClass}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
            <UserCheck size={28} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Đã điểm danh rồi!</h2>
          <div className="bg-amber-50 rounded-xl p-4 space-y-1 text-left">
            <p className="text-sm font-semibold text-amber-800">{bed?.ho_va_ten}</p>
            <p className="text-xs text-amber-600">Mã NV: {bed?.ma_nv}</p>
            <p className="text-xs text-amber-600 font-semibold">Đã điểm danh lúc {alreadyTime}</p>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'success_assign') {
    return (
      <div className={bgClass}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
            <CheckCircle2 size={28} className="text-blue-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Gán giường thành công!</h2>
          <div className="bg-blue-50 rounded-xl p-4 space-y-1 text-left">
            <p className="text-sm font-semibold text-blue-800">{assignResult?.name}</p>
            <p className="text-xs text-blue-600">Mã NV: {assignResult?.ma_nv}</p>
            <p className="text-xs text-blue-600">
              {bed?.ktx} · {bed?.day} · Phòng {bed?.phong_so} · Giường {bed?.giuong}
            </p>
          </div>
          <p className="text-xs text-gray-500">Hồ sơ nhân sự đã được cập nhật vị trí giường.</p>
        </div>
      </div>
    );
  }

  if (mode === 'submitting') {
    return (
      <div className={bgClass}>
        <div className="text-center space-y-3">
          <Loader2 size={32} className="animate-spin text-blue-600 mx-auto" />
          <p className="text-sm text-gray-600">Đang xử lý...</p>
        </div>
      </div>
    );
  }

  // ─── Attendance mode (bed occupied + active session) ──────────────────────
  if (mode === 'attendance' && bed) {
    return (
      <div className={bgClass}>
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <BedDouble size={24} className="text-emerald-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Điểm danh qua QR Giường</h2>
            <p className="text-xs text-gray-500 mt-1">
              {bed.ktx} · {bed.day} · Phòng {bed.phong_so} · Giường {bed.giuong}
            </p>
          </div>

          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
            <div className="flex items-center gap-2">
              <UserCheck size={16} className="text-emerald-600" />
              <p className="text-sm font-bold text-emerald-800">{bed.ho_va_ten}</p>
            </div>
            <p className="text-xs text-emerald-600 ml-6">Mã NV: <span className="font-mono font-semibold">{bed.ma_nv}</span></p>
          </div>

          {session && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <p className="text-xs text-blue-700 font-semibold">
                📋 Phiên điểm danh ngày {new Date(session.session_date).toLocaleDateString('vi-VN')} đang mở
              </p>
            </div>
          )}

          <button
            onClick={handleAttendance}
            className="w-full py-3 bg-emerald-600 text-white rounded-xl font-semibold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle2 size={18} />
            Xác nhận điểm danh
          </button>
        </div>
      </div>
    );
  }

  // ─── Assign mode (bed empty or no active session) ─────────────────────────
  if (mode === 'assign' && bed) {
    return (
      <div className={bgClass}>
        <div className="bg-white rounded-2xl shadow-xl p-6 max-w-sm w-full space-y-5">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mx-auto mb-3">
              <BedDouble size={24} className="text-blue-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">
              {bed.status === 'occupied' ? 'Đổi nhân sự giường' : 'Gán nhân sự vào giường'}
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              {bed.ktx} · {bed.day} · Phòng {bed.phong_so} · Giường {bed.giuong}
            </p>
          </div>

          {bed.status === 'occupied' && bed.ho_va_ten && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-2">
              <ArrowLeftRight size={14} className="text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-xs font-semibold text-amber-800">Hiện tại: {bed.ho_va_ten}</p>
                <p className="text-xs text-amber-600">Mã NV: {bed.ma_nv}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleAssign} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Mã nhân viên (Mã NV) *
              </label>
              <div className="relative">
                <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Nhập Mã NV..."
                  value={maNv}
                  onChange={e => setMaNv(e.target.value)}
                  required
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 block mb-1">
                Họ và tên (nếu chưa có trong hệ thống)
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Họ và tên..."
                  value={hoVaTen}
                  onChange={e => setHoVaTen(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            </div>
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
            >
              <BedDouble size={16} />
              {bed.status === 'occupied' ? 'Đổi nhân sự' : 'Gán vào giường này'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return null;
}
