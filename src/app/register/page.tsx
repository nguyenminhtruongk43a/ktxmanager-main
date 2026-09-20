'use client';
import React, { useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Camera, Upload, CheckCircle2, AlertCircle, Loader2, User, CreditCard, Building2, X, QrCode } from 'lucide-react';

interface RegistrationForm {
  ho_va_ten: string;
  so_cccd: string;
  so_dien_thoai: string;
  ngay_sinh: string;
  que_quan: string;
  ktx: string;
  day: string;
  phong_so: string;
  ghi_chu: string;
}

const INITIAL_FORM: RegistrationForm = {
  ho_va_ten: '', so_cccd: '', so_dien_thoai: '', ngay_sinh: '',
  que_quan: '', ktx: '', day: '', phong_so: '', ghi_chu: '',
};

async function compressImage(file: File, maxKB = 300): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      const maxDim = 1200;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { resolve(file); return; }
          if (blob.size <= maxKB * 1024 || quality <= 0.1) {
            resolve(new File([blob], file.name, { type: 'image/jpeg' }));
          } else {
            quality -= 0.1;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      tryCompress();
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
    img.src = url;
  });
}

export default function RegisterPage() {
  const [form, setForm] = useState<RegistrationForm>(INITIAL_FORM);
  const [cccdFile, setCccdFile] = useState<File | null>(null);
  const [cccdPreview, setCccdPreview] = useState<string | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileSizeKB, setFileSizeKB] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const supabase = createClient();

  const handleField = (k: keyof RegistrationForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setForm(f => ({ ...f, [k]: e.target.value }));
  };

  const handleImageFile = useCallback(async (file: File) => {
    setCompressing(true);
    setError(null);
    try {
      const compressed = await compressImage(file, 300);
      const sizeKB = Math.round(compressed.size / 1024);
      setFileSizeKB(sizeKB);
      setCccdFile(compressed);
      const reader = new FileReader();
      reader.onload = (e) => setCccdPreview(e.target?.result as string);
      reader.readAsDataURL(compressed);
    } catch {
      setError('Không thể xử lý ảnh. Vui lòng thử lại.');
    } finally {
      setCompressing(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleImageFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.ho_va_ten.trim() || !form.so_cccd.trim() || !form.so_dien_thoai.trim()) {
      setError('Vui lòng điền đầy đủ họ tên, CCCD và số điện thoại.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      let cccd_image_url: string | null = null;

      if (cccdFile) {
        const fileName = `cccd_${Date.now()}_${form.so_cccd}.jpg`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('worker-avatars')
          .upload(`registrations/${fileName}`, cccdFile, { contentType: 'image/jpeg', upsert: true });
        if (uploadErr) {
          console.warn('Image upload failed, continuing without image:', uploadErr.message);
        } else if (uploadData) {
          const { data: { publicUrl } } = supabase.storage.from('worker-avatars').getPublicUrl(uploadData.path);
          cccd_image_url = publicUrl;
        }
      }

      const { error: insertErr } = await supabase.from('worker_registrations').insert({
        ho_va_ten: form.ho_va_ten.trim(),
        so_cccd: form.so_cccd.trim(),
        so_dien_thoai: form.so_dien_thoai.trim(),
        ngay_sinh: form.ngay_sinh.trim(),
        que_quan: form.que_quan.trim(),
        ktx: form.ktx.trim(),
        day: form.day.trim(),
        phong_so: form.phong_so.trim(),
        ghi_chu: form.ghi_chu.trim(),
        cccd_image_url,
        status: 'pending',
      });

      if (insertErr) throw new Error(insertErr.message);
      setSubmitted(true);
    } catch (err: any) {
      setError(`Lỗi gửi đăng ký: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl border border-border p-8 max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Đăng ký thành công!</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">
            Hồ sơ của bạn đã được gửi đến Ban quản lý KTX Hóc Môn. Vui lòng chờ xét duyệt trong vòng <strong>1–2 ngày làm việc</strong>.
          </p>
          <div className="bg-muted/50 rounded-xl p-4 text-left space-y-1.5 text-sm">
            <div className="flex gap-2"><span className="text-muted-foreground w-24">Họ tên:</span><span className="font-medium">{form.ho_va_ten}</span></div>
            <div className="flex gap-2"><span className="text-muted-foreground w-24">CCCD:</span><span className="font-medium">{form.so_cccd}</span></div>
            <div className="flex gap-2"><span className="text-muted-foreground w-24">SĐT:</span><span className="font-medium">{form.so_dien_thoai}</span></div>
            {form.ktx && <div className="flex gap-2"><span className="text-muted-foreground w-24">KTX:</span><span className="font-medium">{form.ktx}</span></div>}
          </div>
          <button onClick={() => { setSubmitted(false); setForm(INITIAL_FORM); setCccdFile(null); setCccdPreview(null); setFileSizeKB(null); }}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-medium hover:opacity-90 transition-opacity text-sm">
            Đăng ký thêm
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-emerald-50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center mx-auto shadow-lg">
            <QrCode size={28} className="text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Đăng Ký Cư Trú</h1>
          <p className="text-sm text-muted-foreground">Ký Túc Xá Hóc Môn — Điền đầy đủ thông tin để được xét duyệt</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-lg border border-border p-6 space-y-5">
          {/* Personal Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <User size={15} className="text-primary" /> Thông tin cá nhân
            </h3>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Họ và tên <span className="text-red-500">*</span></label>
              <input type="text" value={form.ho_va_ten} onChange={handleField('ho_va_ten')} required
                placeholder="Nguyễn Văn A"
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Số CCCD <span className="text-red-500">*</span></label>
                <input type="text" value={form.so_cccd} onChange={handleField('so_cccd')} required
                  placeholder="012345678901"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Số điện thoại <span className="text-red-500">*</span></label>
                <input type="tel" value={form.so_dien_thoai} onChange={handleField('so_dien_thoai')} required
                  placeholder="0901234567"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Ngày sinh</label>
                <input type="date" value={form.ngay_sinh} onChange={handleField('ngay_sinh')}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Quê quán</label>
                <input type="text" value={form.que_quan} onChange={handleField('que_quan')}
                  placeholder="Tỉnh/TP"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
          </div>

          {/* Room Info */}
          <div className="space-y-3 pt-1 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pt-1">
              <Building2 size={15} className="text-primary" /> Thông tin phòng ở
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">KTX</label>
                <select value={form.ktx} onChange={handleField('ktx')}
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30">
                  <option value="">Chọn</option>
                  <option value="KTX 1">KTX 1</option>
                  <option value="KTX 2">KTX 2</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Dãy</label>
                <input type="text" value={form.day} onChange={handleField('day')}
                  placeholder="Dãy A"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Phòng số</label>
                <input type="text" value={form.phong_so} onChange={handleField('phong_so')}
                  placeholder="101"
                  className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Ghi chú</label>
              <textarea value={form.ghi_chu} onChange={handleField('ghi_chu')} rows={2}
                placeholder="Thông tin thêm (nếu có)..."
                className="w-full px-3 py-2.5 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </div>
          </div>

          {/* CCCD Photo */}
          <div className="space-y-3 pt-1 border-t border-border">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 pt-1">
              <CreditCard size={15} className="text-primary" /> Ảnh CCCD
              <span className="text-xs font-normal text-muted-foreground">(tự động nén &lt;300KB)</span>
            </h3>
            {cccdPreview ? (
              <div className="relative">
                <img src={cccdPreview} alt="Ảnh CCCD đã chọn" className="w-full h-40 object-cover rounded-xl border border-border" />
                <button type="button" onClick={() => { setCccdFile(null); setCccdPreview(null); setFileSizeKB(null); }}
                  className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors">
                  <X size={14} />
                </button>
                {fileSizeKB !== null && (
                  <div className={`absolute bottom-2 left-2 text-xs px-2 py-0.5 rounded-full font-medium ${fileSizeKB <= 300 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                    {fileSizeKB}KB {fileSizeKB <= 300 ? '✓' : '(quá lớn)'}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
                <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileChange} />
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={compressing}
                  className="flex flex-col items-center gap-2 py-4 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary">
                  {compressing ? <Loader2 size={20} className="animate-spin" /> : <Upload size={20} />}
                  <span className="text-xs font-medium">Tải ảnh lên</span>
                </button>
                <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={compressing}
                  className="flex flex-col items-center gap-2 py-4 border-2 border-dashed border-border rounded-xl hover:border-primary hover:bg-primary/5 transition-colors text-muted-foreground hover:text-primary">
                  {compressing ? <Loader2 size={20} className="animate-spin" /> : <Camera size={20} />}
                  <span className="text-xs font-medium">Chụp ảnh</span>
                </button>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={submitting || compressing}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:opacity-90 disabled:opacity-60 transition-opacity flex items-center justify-center gap-2">
            {submitting ? <><Loader2 size={16} className="animate-spin" /> Đang gửi...</> : 'Gửi đăng ký'}
          </button>
          <p className="text-xs text-center text-muted-foreground">
            Thông tin của bạn được bảo mật và chỉ dùng cho mục đích quản lý cư trú.
          </p>
        </form>
      </div>
    </div>
  );
}
