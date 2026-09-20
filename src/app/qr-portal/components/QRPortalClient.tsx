'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, XCircle, Clock, Loader2, Phone, CreditCard, Building2, Eye, X, AlertCircle, RefreshCw, ExternalLink, Download, Printer, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

interface WorkerRegistration {
  id: string;
  ho_va_ten: string;
  ma_nv: string;
  so_cccd: string;
  so_dien_thoai: string;
  ngay_sinh: string;
  que_quan: string;
  gioi_tinh: string;
  don_vi: string;
  tieu_doan: string;
  to_truong: string;
  sdt_to_truong: string;
  ho_khau_tinh: string;
  ktx: string;
  day: string;
  phong_so: string;
  giuong: string;
  ngay_vao_ktx: string;
  cccd_image_url: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  ghi_chu: string;
  created_at: string;
}

const STATUS_CONFIG = {
  pending: { label: 'Chờ duyệt', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock size={13} /> },
  approved: { label: 'Đã duyệt', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: <CheckCircle2 size={13} /> },
  rejected: { label: 'Từ chối', color: 'bg-red-100 text-red-700 border-red-200', icon: <XCircle size={13} /> },
};

function DetailModal({ reg, onClose, onApprove, onReject, processing }: {
  reg: WorkerRegistration;
  onClose: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  processing: string | null;
}) {
  const isProcessing = processing === reg.id;
  const cfg = STATUS_CONFIG[reg.status];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="font-semibold text-foreground">Chi tiết hồ sơ đăng ký</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
            {cfg.icon} {cfg.label}
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground">Họ và tên</span>
              <p className="font-semibold text-foreground mt-0.5">{reg.ho_va_ten}</p>
            </div>
            {reg.ma_nv && <div>
              <span className="text-xs text-muted-foreground">Mã nhân viên</span>
              <p className="font-medium mt-0.5">{reg.ma_nv}</p>
            </div>}
            <div>
              <span className="text-xs text-muted-foreground">Số CCCD</span>
              <p className="font-medium mt-0.5">{reg.so_cccd}</p>
            </div>
            <div>
              <span className="text-xs text-muted-foreground">Số điện thoại</span>
              <p className="font-medium mt-0.5">{reg.so_dien_thoai}</p>
            </div>
            {reg.gioi_tinh && <div>
              <span className="text-xs text-muted-foreground">Giới tính</span>
              <p className="font-medium mt-0.5">{reg.gioi_tinh}</p>
            </div>}
            {reg.ngay_sinh && <div>
              <span className="text-xs text-muted-foreground">Ngày sinh</span>
              <p className="font-medium mt-0.5">{reg.ngay_sinh}</p>
            </div>}
            {reg.ho_khau_tinh && <div className="col-span-2">
              <span className="text-xs text-muted-foreground">Hộ khẩu Tỉnh/TP</span>
              <p className="font-medium mt-0.5">{reg.ho_khau_tinh}</p>
            </div>}
            {reg.don_vi && <div>
              <span className="text-xs text-muted-foreground">Đơn vị</span>
              <p className="font-medium mt-0.5">{reg.don_vi}</p>
            </div>}
            {reg.tieu_doan && <div>
              <span className="text-xs text-muted-foreground">Tiểu đoàn / Trung đoàn</span>
              <p className="font-medium mt-0.5">{reg.tieu_doan}</p>
            </div>}
            {reg.to_truong && <div>
              <span className="text-xs text-muted-foreground">Tổ trưởng</span>
              <p className="font-medium mt-0.5">{reg.to_truong}</p>
            </div>}
            {reg.sdt_to_truong && <div>
              <span className="text-xs text-muted-foreground">SĐT tổ trưởng</span>
              <p className="font-medium mt-0.5">{reg.sdt_to_truong}</p>
            </div>}
            {reg.ktx && <div>
              <span className="text-xs text-muted-foreground">Khu KTX</span>
              <p className="font-medium mt-0.5">{reg.ktx}</p>
            </div>}
            {reg.day && <div>
              <span className="text-xs text-muted-foreground">Dãy nhà</span>
              <p className="font-medium mt-0.5">{reg.day}</p>
            </div>}
            {reg.phong_so && <div>
              <span className="text-xs text-muted-foreground">Phòng số</span>
              <p className="font-medium mt-0.5">{reg.phong_so}</p>
            </div>}
            {reg.giuong && <div>
              <span className="text-xs text-muted-foreground">Số giường</span>
              <p className="font-medium mt-0.5">{reg.giuong}</p>
            </div>}
            {reg.ngay_vao_ktx && <div>
              <span className="text-xs text-muted-foreground">Ngày vào KTX</span>
              <p className="font-medium mt-0.5">{reg.ngay_vao_ktx}</p>
            </div>}
            {reg.ghi_chu && <div className="col-span-2">
              <span className="text-xs text-muted-foreground">Ghi chú</span>
              <p className="font-medium mt-0.5">{reg.ghi_chu}</p>
            </div>}
            <div className="col-span-2">
              <span className="text-xs text-muted-foreground">Thời gian đăng ký</span>
              <p className="font-medium mt-0.5">{new Date(reg.created_at).toLocaleString('vi-VN')}</p>
            </div>
          </div>
          {reg.cccd_image_url && (
            <div>
              <span className="text-xs text-muted-foreground block mb-2">Ảnh CCCD</span>
              <img src={reg.cccd_image_url} alt={`Ảnh CCCD của ${reg.ho_va_ten}`} className="w-full rounded-xl border border-border object-cover max-h-48" />
            </div>
          )}
          {reg.status === 'pending' && (
            <div className="flex gap-3 pt-2 border-t border-border">
              <button onClick={() => onReject(reg.id)} disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-red-200 text-red-600 rounded-xl text-sm font-medium hover:bg-red-50 disabled:opacity-50 transition-colors">
                {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                Từ chối
              </button>
              <button onClick={() => onApprove(reg.id)} disabled={isProcessing}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                Duyệt hồ sơ
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DeleteConfirmModal({ name, onConfirm, onCancel, deleting }: {
  name: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Xóa hồ sơ</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Hành động này không thể hoàn tác.</p>
          </div>
        </div>
        <p className="text-sm text-foreground">
          Bạn có chắc muốn xóa hồ sơ của <strong>{name}</strong> khỏi danh sách?
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} disabled={deleting}
            className="flex-1 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50">
            Hủy
          </button>
          <button onClick={onConfirm} disabled={deleting}
            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-colors">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            Xóa
          </button>
        </div>
      </div>
    </div>
  );
}

function QRCodeDisplay({ url }: { url: string }) {
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&margin=10&color=1a1a2e&bgcolor=ffffff`;
  const qrLargeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(url)}&margin=20&color=1a1a2e&bgcolor=ffffff`;
  const [showPrintView, setShowPrintView] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(qrLargeUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = 'qr-dang-ky-cu-tru.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(qrLargeUrl, '_blank');
    }
  };

  const handlePrint = () => {
    setShowPrintView(true);
    setTimeout(() => {
      window.print();
      setShowPrintView(false);
    }, 300);
  };

  return (
    <>
      {showPrintView && (
        <div className="fixed inset-0 z-[9999] bg-white flex flex-col items-center justify-center p-8 print:block" id="print-area">
          <div className="text-center space-y-4">
            <h2 className="text-2xl font-bold text-gray-900">Đăng Ký Cư Trú KTX Hóc Môn</h2>
            <p className="text-gray-600">Quét mã QR để đăng ký</p>
            <img src={qrLargeUrl} alt="QR Code đăng ký cư trú" className="w-64 h-64 mx-auto border-4 border-gray-200 rounded-xl" />
            <p className="text-sm text-gray-500 font-mono break-all max-w-xs mx-auto">{url}</p>
          </div>
        </div>
      )}
      <div className="bg-gradient-to-br from-primary/5 to-blue-50 border border-primary/20 rounded-2xl p-5">
        <div className="flex flex-col lg:flex-row items-center gap-6">
          <div className="flex-shrink-0 flex flex-col items-center gap-3">
            <div className="bg-white rounded-2xl border-2 border-primary/20 p-3 shadow-lg">
              <img src={qrApiUrl} alt="QR Code đăng ký cư trú KTX Hóc Môn" width={200} height={200} className="w-48 h-48 rounded-lg" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90 transition-opacity shadow-sm">
                <Download size={13} />Tải xuống
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-border bg-card text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors">
                <Printer size={13} />In ấn
              </button>
            </div>
          </div>
          <div className="flex-1 text-center lg:text-left space-y-3">
            <div>
              <h3 className="font-bold text-foreground text-lg">Mã QR Đăng Ký Cư Trú</h3>
              <p className="text-sm text-muted-foreground mt-1">Dán mã QR này tại các khu vực KTX để công nhân quét và điền thông tin đăng ký trực tuyến.</p>
            </div>
            <div className="bg-white/80 rounded-xl border border-border p-3 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">Đường dẫn:</span>
                <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono text-foreground break-all">{url}</code>
              </div>
              <a href="/register" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                <ExternalLink size={12} /> Mở trang đăng ký để kiểm tra
              </a>
            </div>
            <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1 bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full border border-emerald-200">✓ Hỗ trợ mọi điện thoại</span>
              <span className="flex items-center gap-1 bg-blue-50 text-blue-700 px-2 py-1 rounded-full border border-blue-200">✓ Không cần cài app</span>
              <span className="flex items-center gap-1 bg-purple-50 text-purple-700 px-2 py-1 rounded-full border border-purple-200">✓ Tự động lưu hồ sơ</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default function QRPortalClient() {
  const [registrations, setRegistrations] = useState<WorkerRegistration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [processing, setProcessing] = useState<string | null>(null);
  const [detailReg, setDetailReg] = useState<WorkerRegistration | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [registerUrl, setRegisterUrl] = useState('/register');
  const [deleteTarget, setDeleteTarget] = useState<WorkerRegistration | null>(null);
  const [deleting, setDeleting] = useState(false);
  const { currentUser } = useAuth();
  const supabase = createClient();

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRegisterUrl(`${window.location.origin}/register`);
    }
  }, []);

  const fetchRegistrations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('worker_registrations')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error) setRegistrations(data || []);
    } catch (e: any) {
      console.error('Fetch registrations error:', e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchRegistrations(); }, [fetchRegistrations]);

  const handleApprove = async (id: string) => {
    setProcessing(id);
    try {
      const reg = registrations.find(r => r.id === id);
      if (!reg) return;

      // 1. Update status in worker_registrations
      const { error: updateErr } = await supabase
        .from('worker_registrations')
        .update({ status: 'approved', reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);

      if (updateErr) throw new Error(updateErr.message);

      // 2. Insert into workers table with ALL fields
      const workerId = `reg-${id}`;
      const { error: insertErr } = await supabase.from('workers').upsert({
        id: workerId,
        stt: 0,
        ho_va_ten: reg.ho_va_ten || '',
        ma_nv: reg.ma_nv || '',
        tieu_doan: reg.tieu_doan || '',
        ktx: reg.ktx || '',
        don_vi: reg.don_vi || '',
        gioi_tinh: reg.gioi_tinh || '',
        ngay_sinh: reg.ngay_sinh || '',
        so_dien_thoai: reg.so_dien_thoai || '',
        day: reg.day || '',
        phong_so: reg.phong_so || '',
        giuong: reg.giuong || '',
        cccd: reg.so_cccd || '',
        ho_khau_tinh: reg.ho_khau_tinh || reg.que_quan || '',
        to_truong: reg.to_truong || '',
        sdt_to_truong: reg.sdt_to_truong || '',
        ngay_vao_ktx: reg.ngay_vao_ktx || '',
        ngay_ra_ktx: '',
        ghi_chu: reg.ghi_chu || '',
        khoa_tra_cuu: `${reg.day || ''}|${reg.phong_so || ''}|${reg.giuong || ''}`,
        avatar: reg.cccd_image_url || '',
        tam_tru_status: 'registered',
      }, { onConflict: 'id' });

      if (insertErr) {
        console.warn('Insert to workers failed:', insertErr.message);
      }

      setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' } : r));
      if (detailReg?.id === id) setDetailReg(prev => prev ? { ...prev, status: 'approved' } : prev);
    } catch (e: any) {
      console.error('Approve error:', e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessing(id);
    try {
      const { error } = await supabase
        .from('worker_registrations')
        .update({ status: 'rejected', reviewed_by: currentUser?.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (!error) {
        setRegistrations(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' } : r));
        if (detailReg?.id === id) setDetailReg(prev => prev ? { ...prev, status: 'rejected' } : prev);
      }
    } catch (e: any) {
      console.error('Reject error:', e.message);
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from('worker_registrations')
        .delete()
        .eq('id', deleteTarget.id);
      if (!error) {
        setRegistrations(prev => prev.filter(r => r.id !== deleteTarget.id));
        if (detailReg?.id === deleteTarget.id) setDetailReg(null);
      }
    } catch (e: any) {
      console.error('Delete error:', e.message);
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const filtered = registrations.filter(r => filterStatus === 'all' || r.status === filterStatus);
  const counts = {
    pending: registrations.filter(r => r.status === 'pending').length,
    approved: registrations.filter(r => r.status === 'approved').length,
    rejected: registrations.filter(r => r.status === 'rejected').length,
  };

  return (
    <div className="p-4 md:p-6 space-y-5">
      {detailReg && (
        <DetailModal reg={detailReg} onClose={() => setDetailReg(null)} onApprove={handleApprove} onReject={handleReject} processing={processing} />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          name={deleteTarget.ho_va_ten}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Cổng QR & Phê Duyệt Hồ Sơ</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Quản lý đăng ký cư trú qua QR code</p>
        </div>
        <button onClick={() => fetchRegistrations(true)} disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60">
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Làm mới
        </button>
      </div>

      {/* QR Code Display */}
      <QRCodeDisplay url={registerUrl} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { key: 'pending', label: 'Chờ duyệt', count: counts.pending, color: 'text-amber-600 bg-amber-50 border-amber-200' },
          { key: 'approved', label: 'Đã duyệt', count: counts.approved, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
          { key: 'rejected', label: 'Từ chối', count: counts.rejected, color: 'text-red-600 bg-red-50 border-red-200' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilterStatus(s.key as any)}
            className={`p-4 rounded-xl border text-center transition-all ${filterStatus === s.key ? s.color + ' ring-2 ring-offset-1 ring-current/30' : 'bg-card border-border hover:bg-muted/50'}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-xs mt-0.5 font-medium">{s.label}</p>
          </button>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {[
          { key: 'all', label: `Tất cả (${registrations.length})` },
          { key: 'pending', label: `Chờ duyệt (${counts.pending})` },
          { key: 'approved', label: `Đã duyệt (${counts.approved})` },
          { key: 'rejected', label: `Từ chối (${counts.rejected})` },
        ].map(t => (
          <button key={t.key} onClick={() => setFilterStatus(t.key as any)}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${filterStatus === t.key ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 size={24} className="animate-spin text-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <AlertCircle size={36} className="mb-3 opacity-30" />
            <p className="text-sm">Không có hồ sơ nào</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(reg => {
              const cfg = STATUS_CONFIG[reg.status];
              const isProcessing = processing === reg.id;
              const isDone = reg.status === 'approved' || reg.status === 'rejected';
              return (
                <div key={reg.id} className="p-4 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-sm">
                      {reg.ho_va_ten.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground text-sm">{reg.ho_va_ten}</span>
                        {reg.ma_nv && <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">{reg.ma_nv}</span>}
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
                          {cfg.icon} {cfg.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><CreditCard size={11} /> {reg.so_cccd}</span>
                        <span className="flex items-center gap-1"><Phone size={11} /> {reg.so_dien_thoai}</span>
                        {reg.don_vi && <span className="flex items-center gap-1"><Building2 size={11} /> {reg.don_vi}</span>}
                        {reg.ktx && <span className="flex items-center gap-1"><Building2 size={11} /> {reg.ktx}{reg.day ? ` — ${reg.day}` : ''}{reg.phong_so ? ` P.${reg.phong_so}` : ''}{reg.giuong ? ` G.${reg.giuong}` : ''}</span>}
                        <span>{new Date(reg.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => setDetailReg(reg)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" title="Xem chi tiết">
                        <Eye size={15} />
                      </button>
                      {reg.status === 'pending' && (
                        <>
                          <button onClick={() => handleReject(reg.id)} disabled={isProcessing}
                            className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50" title="Từ chối">
                            {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <XCircle size={15} />}
                          </button>
                          <button onClick={() => handleApprove(reg.id)} disabled={isProcessing}
                            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50" title="Duyệt">
                            {isProcessing ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                          </button>
                        </>
                      )}
                      {isDone && (
                        <button onClick={() => setDeleteTarget(reg)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-50 hover:text-red-600 transition-colors" title="Xóa hồ sơ">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
