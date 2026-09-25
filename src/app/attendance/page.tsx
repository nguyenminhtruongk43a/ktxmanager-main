'use client';
import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, AlertCircle, Loader2, QrCode, User, Hash } from 'lucide-react';

interface SessionInfo {
  id: string;
  session_date: string;
  is_active: boolean;
}

interface WorkerInfo {
  ho_va_ten: string;
  ktx: string;
  day: string;
  phong_so: string;
}

type PageState = 'form' | 'submitting' | 'success' | 'error' | 'duplicate' | 'session_closed';

export default function AttendancePage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sessionDate, setSessionDate] = useState<string>('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);

  const [hoVaTen, setHoVaTen] = useState('');
  const [maNv, setMaNv] = useState('');
  const [pageState, setPageState] = useState<PageState>('form');
  const [errorMsg, setErrorMsg] = useState('');
  const [workerInfo, setWorkerInfo] = useState<WorkerInfo | null>(null);

  const supabase = createClient();

  // Parse query params
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setSessionId(params.get('session'));
      setSessionDate(params.get('date') || '');
    }
  }, []);

  // Load session
  useEffect(() => {
    if (!sessionId) { setSessionLoading(false); return; }
    const load = async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_sessions')
          .select('id, session_date, is_active')
          .eq('id', sessionId)
          .maybeSingle();
        if (!error && data) setSession(data);
        else setSession(null);
      } catch {
        setSession(null);
      } finally {
        setSessionLoading(false);
      }
    };
    load();
  }, [sessionId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hoVaTen.trim() || !maNv.trim()) return;
    if (!session?.is_active) { setPageState('session_closed'); return; }

    setPageState('submitting');

    try {
      // 1. Check for duplicate check-in
      const { data: existing } = await supabase
        .from('attendance_records')
        .select('id')
        .eq('session_id', session.id)
        .eq('ma_nv', maNv.trim())
        .maybeSingle();

      if (existing) { setPageState('duplicate'); return; }

      // 2. Look up worker info from DB
      let wInfo: WorkerInfo = { ho_va_ten: hoVaTen.trim(), ktx: '', day: '', phong_so: '' };
      const { data: worker } = await supabase
        .from('workers')
        .select('ho_va_ten, ktx, day, phong_so')
        .eq('ma_nv', maNv.trim())
        .maybeSingle();

      if (worker) {
        wInfo = {
          ho_va_ten: worker.ho_va_ten || hoVaTen.trim(),
          ktx: worker.ktx || '',
          day: worker.day || '',
          phong_so: worker.phong_so || '',
        };
      }

      // 3. Insert attendance record
      const { error: insertErr } = await supabase
        .from('attendance_records')
        .insert({
          session_id: session.id,
          session_date: session.session_date,
          ma_nv: maNv.trim(),
          ho_va_ten: wInfo.ho_va_ten,
          ktx: wInfo.ktx,
          day: wInfo.day,
          phong_so: wInfo.phong_so,
          status: 'present',
        });

      if (insertErr) {
        // Unique constraint violation = duplicate
        if (insertErr.code === '23505') { setPageState('duplicate'); return; }
        setErrorMsg(insertErr.message);
        setPageState('error');
        return;
      }

      setWorkerInfo(wInfo);
      setPageState('success');
    } catch (err: any) {
      setErrorMsg(err.message || 'Có lỗi xảy ra');
      setPageState('error');
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────────────
  if (sessionLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-emerald-600" />
          <p className="text-sm text-gray-600">Đang tải...</p>
        </div>
      </div>
    );
  }

  // ─── No session / invalid ─────────────────────────────────────────────────
  if (!sessionId || !session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-amber-600" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Mã QR không hợp lệ</h2>
          <p className="text-sm text-gray-500">Mã QR này không còn hiệu lực hoặc đã hết hạn. Vui lòng quét lại mã QR mới nhất từ ban quản lý.</p>
        </div>
      </div>
    );
  }

  // ─── Session closed ───────────────────────────────────────────────────────
  if (!session.is_active || pageState === 'session_closed') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
            <QrCode size={32} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Phiên điểm danh đã đóng</h2>
          <p className="text-sm text-gray-500">Phiên điểm danh ngày <strong>{session.session_date}</strong> đã kết thúc. Liên hệ ban quản lý nếu cần hỗ trợ.</p>
        </div>
      </div>
    );
  }

  // ─── Duplicate ────────────────────────────────────────────────────────────
  if (pageState === 'duplicate') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-amber-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Đã điểm danh rồi!</h2>
          <p className="text-sm text-gray-600">Mã nhân viên <strong>{maNv}</strong> đã điểm danh trong ngày hôm nay. Mỗi người chỉ được điểm danh 1 lần.</p>
          <button onClick={() => { setPageState('form'); setMaNv(''); setHoVaTen(''); }}
            className="w-full py-2.5 bg-amber-600 text-white rounded-xl text-sm font-medium hover:bg-amber-700 transition-colors">
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────────────
  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-rose-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <AlertCircle size={32} className="text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Có lỗi xảy ra</h2>
          <p className="text-sm text-gray-600">{errorMsg || 'Vui lòng thử lại.'}</p>
          <button onClick={() => setPageState('form')}
            className="w-full py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 transition-colors">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  // ─── Success ──────────────────────────────────────────────────────────────
  if (pageState === 'success' && workerInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full text-center space-y-5">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto animate-bounce">
            <CheckCircle2 size={44} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Điểm danh thành công!</h2>
            <p className="text-sm text-gray-500 mt-1">Ngày {session.session_date}</p>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-left space-y-2">
            <div className="flex items-center gap-2">
              <User size={15} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Họ và tên</p>
                <p className="font-bold text-gray-900">{workerInfo.ho_va_ten}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Hash size={15} className="text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-xs text-gray-500">Mã nhân viên</p>
                <p className="font-semibold text-gray-800 font-mono">{maNv}</p>
              </div>
            </div>
            {(workerInfo.ktx || workerInfo.day || workerInfo.phong_so) && (
              <div className="pt-2 border-t border-emerald-200">
                <p className="text-xs text-gray-500 mb-1">Thông tin phòng</p>
                <p className="font-semibold text-gray-800 text-sm">
                  {[workerInfo.ktx, workerInfo.day ? `Dãy ${workerInfo.day}` : '', workerInfo.phong_so ? `Phòng ${workerInfo.phong_so}` : ''].filter(Boolean).join(' — ')}
                </p>
              </div>
            )}
          </div>
          <div className="bg-emerald-600 text-white rounded-2xl px-4 py-3">
            <p className="text-sm font-semibold">✓ Đã ghi nhận lúc {new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Form ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto">
            <QrCode size={32} className="text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Điểm Danh KTX</h1>
          <p className="text-sm text-gray-500">Ngày <strong>{session.session_date}</strong></p>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Phiên đang mở
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Họ và tên <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={hoVaTen}
                onChange={e => setHoVaTen(e.target.value)}
                placeholder="Nhập họ và tên đầy đủ"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5 block">
              Mã nhân viên <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={maNv}
                onChange={e => setMaNv(e.target.value)}
                placeholder="Nhập mã nhân viên"
                required
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={pageState === 'submitting' || !hoVaTen.trim() || !maNv.trim()}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-lg shadow-emerald-200"
          >
            {pageState === 'submitting' ? (
              <><Loader2 size={18} className="animate-spin" /> Đang xử lý...</>
            ) : (
              <><CheckCircle2 size={18} /> Xác nhận điểm danh</>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">Hệ thống quản lý KTX Hóc Môn</p>
      </div>
    </div>
  );
}
