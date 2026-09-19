'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Worker, calcSoNgay } from '@/data/workers';
import { X, Loader2, Save } from 'lucide-react';

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

export default function WorkerFormModal({ worker, onSave, onClose, allWorkers = [] }: Props) {
  const [saving, setSaving] = useState(false);
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
    } : { ktx: 'KTX 2', donVi: 'XD', gioiTinh: 'Nam', day: dayList[0] || 'Dãy 3', phongSo: '1' },
  });

  const watchedCheckIn = watch('ngayVaoKTX');
  const watchedCheckOut = watch('ngayRaKTX');
  const previewDays = calcSoNgay(watchedCheckIn || '', watchedCheckOut || '');

  const onSubmit = async (data: FormData) => {
    setSaving(true);
    await new Promise(r => setTimeout(r, 400));
    const saved: Worker = {
      ...data,
      id: worker?.id ?? `new-${Date.now()}`,
      stt: worker?.stt ?? 0,
      khoaTraCuu: `${data.day}|${data.phongSo}|${data.giuong}`,
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
  );
}