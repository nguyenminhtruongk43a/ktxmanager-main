'use client';
import React from 'react';
import { Worker, calcSoNgay, getProfileStatus } from '@/data/workers';
import { Eye, Pencil, Trash2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface Props {
  workers: Worker[];
  sortKey: keyof Worker;
  sortDir: 'asc' | 'desc';
  onSort: (key: keyof Worker) => void;
  selectedIds: Set<string>;
  onSelectChange: (ids: Set<string>) => void;
  allIds: string[];
  onView: (w: Worker) => void;
  onEdit: (w: Worker) => void;
  onDelete?: (w: Worker) => void;
  onToggleTamTru?: (w: Worker) => void;
  /** Optional: function to check if current user can write to a specific KTX+block combination */
  canWriteBlock?: (blockName: string, ktxName?: string) => boolean;
  /** Sequential row number offset for renumbering after filter (0-based index of first row) */
  rowOffset?: number;
}

const COLUMNS: { key: keyof Worker; label: string; width?: string }[] = [
  { key: 'stt', label: 'STT', width: 'w-12' },
  { key: 'hoVaTen', label: 'Họ và Tên', width: 'min-w-[180px]' },
  { key: 'maNV', label: 'Mã NV', width: 'w-28' },
  { key: 'tieuDoan', label: 'TD', width: 'w-20' },
  { key: 'ktx', label: 'KTX', width: 'w-20' },
  { key: 'day', label: 'Dãy', width: 'w-20' },
  { key: 'phongSo', label: 'Phòng', width: 'w-16' },
  { key: 'giuong', label: 'Giường', width: 'w-16' },
  { key: 'soDienThoai', label: 'SĐT', width: 'w-32' },
  { key: 'cccd', label: 'CCCD', width: 'w-36' },
  { key: 'hoKhauTinh', label: 'Tỉnh/TP', width: 'min-w-[120px]' },
  { key: 'toTruong', label: 'Tổ Trưởng', width: 'min-w-[130px]' },
  { key: 'ngayVaoKTX', label: 'Ngày Vào', width: 'w-28' },
  { key: 'ngayVaoKTX', label: 'Số Ngày', width: 'w-20' },
];

function PlatoonBadge({ value }: { value: string }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  const cls = value === '8' ? 'badge-platoon-8' : value === '111' ? 'badge-platoon-111' : 'badge-platoon-113';
  return <span className={cls}>TD {value}</span>;
}

function MaNVCell({ value }: { value: string }) {
  if (!value) return <span className="text-xs text-muted-foreground italic">Chưa có</span>;
  if (value.toLowerCase().startsWith('chờ')) return <span className="badge-pending">{value}</span>;
  return <span className="text-xs font-tabular text-foreground">{value}</span>;
}

function CCCDCell({ value }: { value: string }) {
  if (!value) return <span className="badge-missing">Thiếu CCCD</span>;
  const masked = value.slice(0, 3) + '****' + value.slice(-3);
  return <span className="text-xs font-tabular text-muted-foreground">{masked}</span>;
}

function ProfileStatusTag({ worker }: { worker: Worker }) {
  const status = getProfileStatus(worker);
  if (status === 'full') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-green-100 text-green-700 border border-green-200">
      <span className="w-1.5 h-1.5 rounded-full bg-green-500" />Đủ hồ sơ
    </span>
  );
  if (status === 'missing_cccd_sdt') return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-700 border border-red-200">
      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />Thiếu CCCD/SĐT
    </span>
  );
  // Build specific missing field labels
  const missing: string[] = [];
  if (!worker.tieuDoan) missing.push('Tiểu đoàn');
  if (!worker.ktx) missing.push('Khu KTX');
  if (!worker.day) missing.push('Dãy nhà');
  if (!worker.phongSo) missing.push('Phòng');
  if (!worker.ngaySinh) missing.push('Ngày sinh');
  if (!worker.gioiTinh) missing.push('Giới tính');

  const label = missing.length > 0
    ? `Thiếu: ${missing.slice(0, 2).join(', ')}${missing.length > 2 ? ` +${missing.length - 2}` : ''}`
    : 'Chưa phân bổ';

  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-yellow-100 text-yellow-700 border border-yellow-200"
      title={missing.length > 0 ? `Thiếu thông tin: ${missing.join(', ')}` : 'Chưa phân bổ đầy đủ'}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />{label}
    </span>
  );
}

function TamTruTag({ worker, onToggle }: { worker: Worker; onToggle?: (w: Worker) => void }) {
  const isRegistered = worker.tamTruStatus === 'registered';
  return (
    <button
      onClick={e => { e.stopPropagation(); onToggle?.(worker); }}
      title={`Click để đổi → ${isRegistered ? 'Chưa đăng ký' : 'Đã đăng ký'}`}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all hover:opacity-80 ${isRegistered ? 'bg-green-100 text-green-700 border-green-200' : 'bg-orange-100 text-orange-700 border-orange-200'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isRegistered ? 'bg-green-500' : 'bg-orange-500'}`} />
      {isRegistered ? 'Đã ĐK' : 'Chưa ĐK'}
    </button>
  );
}

export default function WorkerTable({
  workers, sortKey, sortDir, onSort, selectedIds, onSelectChange, allIds, onView, onEdit, onDelete, onToggleTamTru, canWriteBlock, rowOffset = 0
}: Props) {
  // allSelected: true only when ALL rows on current page are selected
  const allSelected = allIds.length > 0 && allIds.every(id => selectedIds.has(id));
  // indeterminate: some but not all selected
  const someSelected = allIds.some(id => selectedIds.has(id)) && !allSelected;

  const toggleAll = () => {
    const next = new Set(selectedIds);
    if (allSelected) {
      // Deselect all on this page
      allIds.forEach(id => next.delete(id));
    } else {
      // Select all on this page
      allIds.forEach(id => next.add(id));
    }
    onSelectChange(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectChange(next);
  };

  const SortIcon = ({ col }: { col: keyof Worker }) => {
    if (sortKey !== col) return <ArrowUpDown size={12} className="opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp size={12} className="text-primary" /> : <ArrowDown size={12} className="text-primary" />;
  };

  if (workers.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center py-16 text-center">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
          <Eye size={24} className="text-muted-foreground" />
        </div>
        <p className="text-base font-semibold text-foreground">Không tìm thấy công nhân</p>
        <p className="text-sm text-muted-foreground mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
      </div>
    );
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="table-header w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </th>
              {['STT','Họ và Tên','Mã NV','TD','KTX','Dãy','Phòng','Giường','SĐT','CCCD','Tỉnh/TP','Tổ Trưởng','Ngày Vào','Số Ngày'].map((label, i) => (
                <th key={`th-${i}`} className="table-header cursor-pointer" onClick={() => onSort(COLUMNS[i]?.key ?? 'stt')}>
                  <div className="flex items-center gap-1">{label}<SortIcon col={COLUMNS[i]?.key ?? 'stt'} /></div>
                </th>
              ))}
              <th className="table-header w-24">Tạm trú</th>
              <th className="table-header w-28 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((w, idx) => {
              const isSelected = selectedIds.has(w.id);
              const soNgay = calcSoNgay(w.ngayVaoKTX, w.ngayRaKTX);
              // Sequential STT: rowOffset + idx + 1 (renumbers from 1 when filtered)
              const displayStt = rowOffset + idx + 1;
              return (
                <tr
                  key={w.id}
                  className={`border-b border-border transition-colors cursor-pointer
                    ${isSelected ? 'bg-secondary/50' : idx % 2 === 0 ? 'bg-card' : 'bg-muted/20'}
                    hover:bg-secondary/40 group`}
                  onClick={() => onView(w)}
                >
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(w.id)}
                      className="rounded border-border"
                    />
                  </td>
                  <td className="table-cell"><span className="text-xs font-tabular text-muted-foreground">{displayStt}</span></td>
                  <td className="table-cell">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-primary text-xs font-bold flex-shrink-0">
                          {w.hoVaTen.split(' ').pop()?.charAt(0) ?? '?'}
                        </div>
                        <p className="text-sm font-semibold text-foreground leading-tight">{w.hoVaTen}</p>
                      </div>
                      <ProfileStatusTag worker={w} />
                    </div>
                  </td>
                  <td className="table-cell"><MaNVCell value={w.maNV} /></td>
                  <td className="table-cell"><PlatoonBadge value={w.tieuDoan} /></td>
                  <td className="table-cell"><span className="text-xs text-foreground">{w.ktx || '—'}</span></td>
                  <td className="table-cell"><span className="text-xs font-semibold text-foreground">{w.day}</span></td>
                  <td className="table-cell">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold">{w.phongSo}</span>
                  </td>
                  <td className="table-cell"><span className="text-xs font-tabular text-muted-foreground">{w.giuong || '—'}</span></td>
                  <td className="table-cell"><span className="text-xs font-tabular text-foreground">{w.soDienThoai || '—'}</span></td>
                  <td className="table-cell"><CCCDCell value={w.cccd} /></td>
                  <td className="table-cell"><span className="text-xs text-foreground truncate max-w-[120px] block">{w.hoKhauTinh || '—'}</span></td>
                  <td className="table-cell"><span className="text-xs text-foreground truncate max-w-[130px] block">{w.toTruong || '—'}</span></td>
                  <td className="table-cell"><span className="text-xs font-tabular text-foreground">{w.ngayVaoKTX || '—'}</span></td>
                  <td className="table-cell">
                    {soNgay !== null ? (
                      <span className={`text-xs font-tabular font-semibold ${soNgay <= 7 ? 'text-green-600' : 'text-foreground'}`}>{soNgay}n</span>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <TamTruTag worker={w} onToggle={onToggleTamTru} />
                  </td>
                  <td className="table-cell" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => onView(w)} title="Xem" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Eye size={14} /></button>
                      {(!canWriteBlock || canWriteBlock(w.day, w.ktx)) ? (
                        <button onClick={() => onEdit(w)} title="Sửa" className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-primary transition-colors"><Pencil size={14} /></button>
                      ) : (
                        <button disabled title="Không có quyền sửa tổ hợp KTX + Dãy này" className="p-1.5 rounded-lg text-muted-foreground/30 cursor-not-allowed"><Pencil size={14} /></button>
                      )}
                      {onDelete && (
                        (!canWriteBlock || canWriteBlock(w.day, w.ktx)) ? (
                          <button onClick={() => onDelete(w)} title="Xóa" className="p-1.5 rounded-lg hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
                        ) : (
                          <button disabled title="Không có quyền xóa tổ hợp KTX + Dãy này" className="p-1.5 rounded-lg text-muted-foreground/30 cursor-not-allowed"><Trash2 size={14} /></button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}