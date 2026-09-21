'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Worker, calcSoNgay } from '@/data/workers';
import { X, Loader2, Save, ScanLine, CheckCircle2 } from 'lucide-react';

interface Props {
  worker: Worker | null;
  onSave: (w: Worker) => void;
  onClose: () => void;
  allWorkers?: Worker[];
}

type FormData = Omit<Worker, 'id' | 'stt' | 'khoaTraCuu'>;

const PROVINCES = [
  'An Giang','Bạc Liêu','Bến Tre','Bình Dương','Bình Phước','Bình Thuận',
  'Cà Mau','Cần Thơ','Đà Nẵng','Đắk Lắk','Đồng Nai','Đồng Tháp',
  'Gia Lai','Hải Phòng','Hậu Giang','Khánh Hòa','Kiên Giang','Lâm Đồng',
  'Lạng Sơn','Long An','Nghệ An','Quảng Nam','Quảng Ngãi','Quảng Trị',
  'Sóc Trăng','Tây Ninh','Tiền Giang','TP Hồ Chí Minh','Trà Vinh',
  'Vĩnh Long','Thanh Hóa','Thừa Thiên Huế','Bình Định','Ninh Bình',
];

/** Parse Vietnamese CCCD chip QR code.
 * Format: CCCD|OldID|FullName|DOB(DDMMYYYY)|Gender|Address|Expiry
 * Returns null if not a valid CCCD QR.
 */
function parseCCCDQR(raw: string): { cccd: string; hoVaTen: string; ngaySinh: string; gioiTinh: string; hoKhauTinh: string } | null {
  const parts = raw.split('|');
  if (parts.length < 7) return null;
  const cccd = parts[0].trim();
  if (!/^\d{9,12}$/.test(cccd)) return null;
  const hoVaTen = parts[2].trim();
  const dobRaw = parts[3].trim(); // DDMMYYYY
  let ngaySinh = dobRaw;
  if (/^\d{8}$/.test(dobRaw)) {
    ngaySinh = `${dobRaw.slice(0, 2)}/${dobRaw.slice(2, 4)}/${dobRaw.slice(4)}`;
  }
  const genderRaw = parts[4].trim().toLowerCase();
  const gioiTinh = genderRaw === 'nam' || genderRaw === '0' || genderRaw === 'male' ? 'Nam' : 'Nữ';
  const address = parts[5].trim();
  // Extract province from address (last segment after last comma)
  const addrParts = address.split(',');
  const hoKhauTinh = addrParts[addrParts.length - 1].trim();
  return { cccd, hoVaTen, ngaySinh, gioiTinh, hoKhauTinh };
}

/** CCCDScanner: opens camera, uses BarcodeDetector or jsQR fallback to scan QR */
function CCCDScanner({ onScanned, onClose }: { onScanned: (data: ReturnType<typeof parseCCCDQR>) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<'starting' | 'scanning' | 'error'>('starting');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
        });
        if (!active) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setStatus('scanning');
          scanLoop();
        }
      } catch (e: any) {
        setStatus('error');
        setErrorMsg(e?.message || 'Không thể truy cập camera');
      }
    }

    async function scanLoop() {
      if (!active || !videoRef.current || !canvasRef.current) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          // Try BarcodeDetector API first (Chrome/Android)
          if ('BarcodeDetector' in window) {
            try {
              // @ts-ignore
              const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
              const codes = await detector.detect(canvas);
              if (codes.length > 0) {
                const raw = codes[0].rawValue as string;
                const parsed = parseCCCDQR(raw);
                onScanned(parsed);
                return;
              }
            } catch {}
          } else {
            // Fallback: try to read raw text from canvas via a simple approach
            // We'll use a hidden img + fetch jsQR dynamically
            try {
              const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              // @ts-ignore
              if (window.__jsQR) {
                // @ts-ignore
                const code = window.__jsQR(imageData.data, canvas.width, canvas.height);
                if (code) {
                  const parsed = parseCCCDQR(code.data);
                  onScanned(parsed);
                  return;
                }
              }
            } catch {}
          }
        }
      }
      rafRef.current = requestAnimationFrame(scanLoop);
    }

    start();
    return () => {
      active = false;
      cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [onScanned]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <ScanLine size={16} className="text-primary" />
            <span className="text-sm font-semibold">Quét CCCD gắn chip</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
        </div>
        <div className="relative bg-black aspect-video">
          <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
          <canvas ref={canvasRef} className="hidden" />
          {/* Scan overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-white/70 rounded-xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary rounded-br-lg" />
            </div>
          </div>
        </div>
        <div className="px-4 py-3 text-center">
          {status === 'starting' && <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5"><Loader2 size={12} className="animate-spin" />Đang khởi động camera...</p>}
          {status === 'scanning' && <p className="text-xs text-muted-foreground">Hướng camera vào mã QR trên mặt sau CCCD gắn chip</p>}
          {status === 'error' && <p className="text-xs text-red-500">{errorMsg || 'Không thể truy cập camera. Vui lòng nhập tay.'}</p>}
        </div>
      </div>
    </div>
  );
}

export default function WorkerFormModal({ worker, onSave, onClose, allWorkers = [] }: Props) {
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const isEdit = !!worker;

  // Dynamic options from existing data
  const ktxList = [...new Set(allWorkers.map(w => w.ktx).filter(Boolean))].sort();
  const dayList = [...new Set(allWorkers.map(w => w.day).filter(Boolean))].sort();
  const platoonList = [...new Set(allWorkers.map(w => w.tieuDoan).filter(Boolean))].sort();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    defaultValues: worker ? {
      hoVaTen: worker.hoVaTen, maNV: worker.maNV, tieuDoan: worker.tieuDoan,
      ktx: worker.ktx || 'KTX 2', donVi: worker.donVi || 'XD',
      gioiTinh: worker.gioiTinh || 'Nam', ngaySinh: worker.ngaySinh,
      soDienThoai: worker.soDienThoai, day: worker.day, phongSo: worker.phongSo,
      giuong: worker.giuong, cccd: worker.cccd, hoKhauTinh: worker.hoKhauTinh,
      toTruong: worker.toTruong, sdtToTruong: worker.sdtToTruong,
      ngayVaoKTX: worker.ngayVaoKTX, ngayRaKTX: worker.ngayRaKTX, ghiChu: worker.ghiChu,
      avatar: worker.avatar,
    } : { ktx: 'KTX 2', donVi: 'XD', gioiTinh: 'Nam', day: dayList[0] || 'Dãy 3', phongSo: '1' },
  });

  const watchedCheckIn = watch('ngayVaoKTX');
  const watchedCheckOut = watch('ngayRaKTX');
  const previewDays = calcSoNgay(watchedCheckIn || '', watchedCheckOut || '');

  const handleScanned = (parsed: ReturnType<typeof parseCCCDQR>) => {
    setShowScanner(false);
    if (parsed) {
      setValue('cccd', parsed.cccd);
      setValue('hoVaTen', parsed.hoVaTen);
      setValue('ngaySinh', parsed.ngaySinh);
      setValue('gioiTinh', parsed.gioiTinh as 'Nam' | 'Nữ');
      setValue('hoKhauTinh', parsed.hoKhauTinh);
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 3000);
    }
  };

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const saved: Worker = {
      ...data,
      id: worker?.id ?? `new-${Date.now()}`,
      stt: worker?.stt ?? 0,
      khoaTraCuu: `${data.day}|${data.phongSo}|${data.giuong}`,
      avatar: data.avatar || '',
    };
    onSave(saved);
    setSaving(false);
  };

  return (
    <>
      {showScanner && <CCCDScanner onScanned={handleScanned} onClose={() => setShowScanner(false)} />}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm fade-in">
        <div className="modal-enter bg-card rounded-xl shadow-modal w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h2 className="text-base font-bold text-foreground">
              {isEdit ? `Chỉnh sửa: ${worker.hoVaTen}` : 'Thêm Công Nhân Mới'}
            </h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors"><X size={16} /></button>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto scrollbar-thin">
            <div className="px-5 py-4 space-y-5">

              {/* Thông tin cá nhân */}
              <div>
                <div className="flex items-center justify-between mb-3 pb-1 border-b border-border">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thông tin cá nhân</p>
                  <button
                    type="button"
                    onClick={() => setShowScanner(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold transition-colors"
                  >
                    <ScanLine size={13} />
                    Quét CCCD
                  </button>
                </div>
                {scanSuccess && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
                    <CheckCircle2 size={13} />
                    Đã tự động điền thông tin từ CCCD
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2 form-group">
                    <label className="label-field">Họ và Tên <span className="text-red-500">*</span></label>
                    <input {...register('hoVaTen', { required: 'Vui lòng nhập họ và tên' })} className="input-field" placeholder="VD: Nguyễn Văn An" />
                    {errors.hoVaTen && <p className="text-xs text-red-500 mt-1">{errors.hoVaTen.message}</p>}
                  </div>
                  <div className="form-group">
                    <label className="label-field">Mã nhân viên</label>
                    <input {...register('maNV')} className="input-field font-tabular" placeholder="VD: 4218645 hoặc Chờ mã" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">Giới tính</label>
                    <select {...register('gioiTinh')} className="input-field">
                      <option value="Nam">Nam</option>
                      <option value="Nữ">Nữ</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="label-field">Ngày sinh</label>
                    <input {...register('ngaySinh')} className="input-field font-tabular" placeholder="VD: 15/06/1990" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">Số điện thoại</label>
                    <input {...register('soDienThoai')} type="tel" className="input-field font-tabular" placeholder="VD: 0912345678" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">CCCD</label>
                    <input {...register('cccd')} className="input-field font-tabular" placeholder="12 chữ số" maxLength={12} />
                  </div>
                  <div className="sm:col-span-2 form-group">
                    <label className="label-field">Hộ khẩu Tỉnh/TP</label>
                    <input {...register('hoKhauTinh')} className="input-field" placeholder="VD: An Giang" list="province-list" />
                    <datalist id="province-list">{PROVINCES.map(p => <option key={p} value={p} />)}</datalist>
                  </div>
                </div>
              </div>

              {/* Thông tin KTX */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">Thông tin KTX</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="form-group">
                    <label className="label-field">KTX</label>
                    <input {...register('ktx')} className="input-field" list="ktx-list" placeholder="VD: KTX 2" />
                    <datalist id="ktx-list">{ktxList.map(k => <option key={k} value={k} />)}</datalist>
                  </div>
                  <div className="form-group">
                    <label className="label-field">Tiểu đoàn / Trung đoàn</label>
                    <input {...register('tieuDoan')} className="input-field" list="platoon-list" placeholder="VD: 8, 111, 113..." />
                    <datalist id="platoon-list">
                      <option value="" />
                      {platoonList.map(p => <option key={p} value={p} />)}
                    </datalist>
                  </div>
                  <div className="form-group">
                    <label className="label-field">Dãy nhà <span className="text-red-500">*</span></label>
                    <input {...register('day', { required: true })} className="input-field" list="day-list" placeholder="VD: Dãy 3" />
                    <datalist id="day-list">{dayList.map(d => <option key={d} value={d} />)}</datalist>
                  </div>
                  <div className="form-group">
                    <label className="label-field">Phòng số <span className="text-red-500">*</span></label>
                    <input {...register('phongSo', { required: true })} className="input-field font-tabular" placeholder="VD: 1, 2, 3..." />
                  </div>
                  <div className="form-group">
                    <label className="label-field">Số giường</label>
                    <input {...register('giuong')} className="input-field font-tabular" placeholder="VD: 1–20" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">Đơn vị</label>
                    <input {...register('donVi')} className="input-field" placeholder="VD: XD" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">Ngày vào KTX</label>
                    <input {...register('ngayVaoKTX')} className="input-field font-tabular" placeholder="VD: 8/19/2026" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">Ngày ra KTX</label>
                    <input {...register('ngayRaKTX')} className="input-field font-tabular" placeholder="Để trống nếu còn ở" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">Số ngày lưu trú</label>
                    <div className="input-field bg-muted/50 text-muted-foreground text-xs flex items-center">
                      {previewDays !== null ? `${previewDays} ngày (tự tính)` : 'Tự động tính từ ngày vào'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Tổ trưởng */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">Thông tin tổ trưởng</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="label-field">Họ tên tổ trưởng</label>
                    <input {...register('toTruong')} className="input-field" placeholder="VD: Nguyễn Văn Bình" />
                  </div>
                  <div className="form-group">
                    <label className="label-field">SĐT tổ trưởng</label>
                    <input {...register('sdtToTruong')} type="tel" className="input-field font-tabular" placeholder="VD: 0912345678" />
                  </div>
                </div>
              </div>

              {/* Ghi chú */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">Ghi chú</p>
                <div className="form-group">
                  <textarea {...register('ghiChu')} rows={3} className="input-field resize-none" placeholder="Ghi chú thêm..." />
                </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-card border-t border-border px-5 py-3 flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground"><span className="text-red-500">*</span> Trường bắt buộc</p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="btn-secondary text-xs">Hủy bỏ</button>
                <button type="submit" disabled={saving} className="btn-primary text-xs min-w-[110px] justify-center">
                  {saving ? <><Loader2 size={13} className="animate-spin" />Đang lưu...</> : <><Save size={13} />{isEdit ? 'Lưu thay đổi' : 'Thêm công nhân'}</>}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}