'use client';
import React, { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Worker, calcSoNgay } from '@/data/workers';
import { X, Loader2, Save, Camera, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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

/** Compress an image File to under maxSizeKB using canvas */
async function compressImage(file: File, maxSizeKB = 300): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      let { width, height } = img;

      // Scale down if too large
      const MAX_DIM = 1200;
      if (width > MAX_DIM || height > MAX_DIM) {
        if (width > height) { height = Math.round((height * MAX_DIM) / width); width = MAX_DIM; }
        else { width = Math.round((width * MAX_DIM) / height); height = MAX_DIM; }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('Canvas not supported')); return; }
      ctx.drawImage(img, 0, 0, width, height);

      // Try decreasing quality until under maxSizeKB
      let quality = 0.85;
      const tryCompress = () => {
        canvas.toBlob((blob) => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          if (blob.size <= maxSizeKB * 1024 || quality <= 0.1) {
            resolve(blob);
          } else {
            quality -= 0.1;
            tryCompress();
          }
        }, 'image/jpeg', quality);
      };
      tryCompress();
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

export default function WorkerFormModal({ worker, onSave, onClose, allWorkers = [] }: Props) {
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string>(worker?.avatar || '');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEdit = !!worker;

  // Dynamic options from existing data
  const ktxList = [...new Set(allWorkers.map(w => w.ktx).filter(Boolean))].sort();
  const dayList = [...new Set(allWorkers.map(w => w.day).filter(Boolean))].sort();
  const platoonList = [...new Set(allWorkers.map(w => w.tieuDoan).filter(Boolean))].sort();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
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

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    setAvatarUploading(true);
    try {
      // Compress to under 300KB
      const compressed = await compressImage(file, 300);
      const ext = 'jpg';
      const fileName = `cccd_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      const supabase = createClient();

      // Upload to Supabase Storage bucket 'worker-avatars'
      const { data, error } = await supabase.storage
        .from('worker-avatars')
        .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: false });

      if (error) {
        // If bucket doesn't exist, try 'avatars' bucket as fallback
        const { data: data2, error: error2 } = await supabase.storage
          .from('avatars')
          .upload(fileName, compressed, { contentType: 'image/jpeg', upsert: false });
        if (error2) {
          setAvatarError(`Lỗi upload: ${error2.message}`);
          return;
        }
        const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(data2!.path);
        setAvatarUrl(urlData.publicUrl);
      } else {
        const { data: urlData } = supabase.storage.from('worker-avatars').getPublicUrl(data!.path);
        setAvatarUrl(urlData.publicUrl);
      }
    } catch (err) {
      setAvatarError(`Lỗi xử lý ảnh: ${err instanceof Error ? err.message : 'Không thể upload'}`);
    } finally {
      setAvatarUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
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
      avatar: avatarUrl || data.avatar || '',
    };
    onSave(saved);
    setSaving(false);
  };

  return (
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
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 pb-1 border-b border-border">Thông tin cá nhân</p>
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

                {/* CCCD Photo Upload */}
                <div className="sm:col-span-2 form-group">
                  <label className="label-field">Ảnh CCCD</label>
                  <div className="flex items-start gap-3">
                    {/* Preview */}
                    <div className="flex-shrink-0 w-24 h-16 rounded-lg border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Ảnh CCCD" className="w-full h-full object-cover rounded-lg" />
                      ) : (
                        <ImageIcon size={20} className="text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          disabled={avatarUploading}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white hover:bg-muted text-xs font-semibold text-foreground transition-colors disabled:opacity-50"
                        >
                          {avatarUploading ? (
                            <><Loader2 size={12} className="animate-spin" />Đang upload...</>
                          ) : (
                            <><Camera size={12} />Chụp / Chọn ảnh</>
                          )}
                        </button>
                        {avatarUrl && (
                          <button
                            type="button"
                            onClick={() => setAvatarUrl('')}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-semibold text-red-600 transition-colors"
                          >
                            <Trash2 size={12} />Xóa ảnh
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">Hỗ trợ chụp trực tiếp từ camera hoặc chọn file. Ảnh tự động nén dưới 300KB.</p>
                      {avatarError && <p className="text-xs text-red-500">{avatarError}</p>}
                    </div>
                  </div>
                  {/* Hidden file input — capture="environment" enables rear camera on mobile */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleAvatarChange}
                  />
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
              <button type="submit" disabled={saving || avatarUploading} className="btn-primary text-xs min-w-[110px] justify-center">
                {saving ? <><Loader2 size={13} className="animate-spin" />Đang lưu...</> : <><Save size={13} />{isEdit ? 'Lưu thay đổi' : 'Thêm công nhân'}</>}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}