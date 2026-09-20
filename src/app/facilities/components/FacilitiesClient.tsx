'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Edit2, Check, X, Plus, Loader2, BedDouble, Wind, Package, Fan, Zap, Tv, Lightbulb, UtensilsCrossed, ChevronDown, ChevronUp } from 'lucide-react';

interface FacilityRow {
  id: string;
  ktx: string;
  day: string;
  phong_khu_vuc: string;
  giuong: number;
  dieu_hoa: number;
  tu: number;
  quat: number;
  o_cam_dien: number;
  remote: number;
  bong_tuyp: number;
  ban_an: number;
  ghe_an: number;
  ghi_chu: string;
}

interface EditingRow {
  id: string;
  giuong: number;
  dieu_hoa: number;
  tu: number;
  quat: number;
  o_cam_dien: number;
  remote: number;
  bong_tuyp: number;
  ban_an: number;
  ghe_an: number;
  ghi_chu: string;
}

interface MetricCard {
  label: string;
  key: keyof Pick<FacilityRow, 'giuong' | 'dieu_hoa' | 'tu' | 'quat' | 'o_cam_dien' | 'remote' | 'bong_tuyp' | 'ban_an' | 'ghe_an'>;
  icon: React.ReactNode;
  color: string;
}

const METRIC_CARDS: MetricCard[] = [
  { label: 'Giường', key: 'giuong', icon: <BedDouble size={18} />, color: 'text-blue-600 bg-blue-50' },
  { label: 'Điều hòa', key: 'dieu_hoa', icon: <Wind size={18} />, color: 'text-cyan-600 bg-cyan-50' },
  { label: 'Tủ', key: 'tu', icon: <Package size={18} />, color: 'text-amber-600 bg-amber-50' },
  { label: 'Quạt', key: 'quat', icon: <Fan size={18} />, color: 'text-green-600 bg-green-50' },
  { label: 'Ổ cắm điện', key: 'o_cam_dien', icon: <Zap size={18} />, color: 'text-yellow-600 bg-yellow-50' },
  { label: 'Remote', key: 'remote', icon: <Tv size={18} />, color: 'text-purple-600 bg-purple-50' },
  { label: 'Bóng tuýp', key: 'bong_tuyp', icon: <Lightbulb size={18} />, color: 'text-orange-600 bg-orange-50' },
  { label: 'Bàn ăn', key: 'ban_an', icon: <UtensilsCrossed size={18} />, color: 'text-rose-600 bg-rose-50' },
  { label: 'Ghế ăn', key: 'ghe_an', icon: <UtensilsCrossed size={18} />, color: 'text-pink-600 bg-pink-50' },
];

const NUMERIC_FIELDS: (keyof EditingRow)[] = ['giuong', 'dieu_hoa', 'tu', 'quat', 'o_cam_dien', 'remote', 'bong_tuyp', 'ban_an', 'ghe_an'];

export default function FacilitiesClient() {
  const [activeKtx, setActiveKtx] = useState<'KTX 1' | 'KTX 2'>('KTX 1');
  const [rows, setRows] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRow, setEditingRow] = useState<EditingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRow, setNewRow] = useState<Omit<FacilityRow, 'id'>>({
    ktx: 'KTX 1', day: '', phong_khu_vuc: '', giuong: 0, dieu_hoa: 0, tu: 0,
    quat: 0, o_cam_dien: 0, remote: 0, bong_tuyp: 0, ban_an: 0, ghe_an: 0, ghi_chu: ''
  });
  const [addingRow, setAddingRow] = useState(false);
  const [sortField, setSortField] = useState<keyof FacilityRow>('day');
  const [sortAsc, setSortAsc] = useState(true);

  const supabase = createClient();

  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('facilities')
        .select('*')
        .order('day', { ascending: true })
        .order('phong_khu_vuc', { ascending: true });
      if (error) {
        console.error('Fetch facilities error:', error.message);
      } else {
        setRows(data || []);
      }
    } catch (e: any) {
      console.error('Fetch error:', e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const ktxRows = rows.filter(r => r.ktx === activeKtx);

  const filteredRows = ktxRows.filter(r => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return r.day?.toLowerCase().includes(q) || r.phong_khu_vuc?.toLowerCase().includes(q);
  });

  const sortedRows = [...filteredRows].sort((a, b) => {
    const av = a[sortField];
    const bv = b[sortField];
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortAsc ? av - bv : bv - av;
    }
    const as = String(av ?? '');
    const bs = String(bv ?? '');
    return sortAsc ? as.localeCompare(bs) : bs.localeCompare(as);
  });

  const totals = ktxRows.reduce((acc, r) => {
    METRIC_CARDS.forEach(m => { acc[m.key] = (acc[m.key] || 0) + (r[m.key] || 0); });
    return acc;
  }, {} as Record<string, number>);

  const startEdit = (row: FacilityRow) => {
    setEditingId(row.id);
    setEditingRow({
      id: row.id,
      giuong: row.giuong,
      dieu_hoa: row.dieu_hoa,
      tu: row.tu,
      quat: row.quat,
      o_cam_dien: row.o_cam_dien,
      remote: row.remote,
      bong_tuyp: row.bong_tuyp,
      ban_an: row.ban_an,
      ghe_an: row.ghe_an,
      ghi_chu: row.ghi_chu || '',
    });
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingRow(null);
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!editingRow) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updatePayload: Record<string, number | string> = {};
      NUMERIC_FIELDS.forEach(f => {
        updatePayload[f as string] = Number(editingRow[f]) || 0;
      });
      updatePayload['ghi_chu'] = editingRow.ghi_chu;

      const { error } = await supabase
        .from('facilities')
        .update(updatePayload)
        .eq('id', editingRow.id);

      if (error) {
        setSaveError(error.message);
      } else {
        setRows(prev => prev.map(r => r.id === editingRow.id ? { ...r, ...updatePayload } as FacilityRow : r));
        setEditingId(null);
        setEditingRow(null);
      }
    } catch (e: any) {
      setSaveError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleAddRow = async () => {
    if (!newRow.day.trim() || !newRow.phong_khu_vuc.trim()) return;
    setAddingRow(true);
    try {
      const { data, error } = await supabase
        .from('facilities')
        .insert({ ...newRow, ktx: activeKtx })
        .select()
        .single();
      if (error) {
        console.error('Add row error:', error.message);
      } else if (data) {
        setRows(prev => [...prev, data]);
        setNewRow({ ktx: activeKtx, day: '', phong_khu_vuc: '', giuong: 0, dieu_hoa: 0, tu: 0, quat: 0, o_cam_dien: 0, remote: 0, bong_tuyp: 0, ban_an: 0, ghe_an: 0, ghi_chu: '' });
        setShowAddForm(false);
      }
    } catch (e: any) {
      console.error('Add error:', e.message);
    } finally {
      setAddingRow(false);
    }
  };

  const handleSort = (field: keyof FacilityRow) => {
    if (sortField === field) {
      setSortAsc(prev => !prev);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const SortIcon = ({ field }: { field: keyof FacilityRow }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp size={12} className="inline ml-0.5" /> : <ChevronDown size={12} className="inline ml-0.5" />;
  };

  const thClass = "px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap cursor-pointer hover:text-foreground select-none";
  const tdClass = "px-3 py-2 text-sm text-foreground whitespace-nowrap";
  const inputClass = "w-16 px-1.5 py-0.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center";

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground">Quản lý Cơ sở vật chất</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Theo dõi và cập nhật trang thiết bị từng phòng/khu vực</p>
        </div>
        <button
          onClick={() => { setShowAddForm(v => !v); setNewRow(r => ({ ...r, ktx: activeKtx })); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Thêm phòng/khu vực
        </button>
      </div>

      {/* KTX Sub-tabs */}
      <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
        {(['KTX 1', 'KTX 2'] as const).map(ktx => (
          <button
            key={ktx}
            onClick={() => { setActiveKtx(ktx); setEditingId(null); setEditingRow(null); setSearchQuery(''); }}
            className={`px-5 py-2 rounded-md text-sm font-semibold transition-all ${activeKtx === ktx ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {ktx}
          </button>
        ))}
      </div>

      {/* Metrics */}
      {loading ? (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {METRIC_CARDS.map(m => (
            <div key={m.key} className="bg-card border border-border rounded-xl p-3 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2" />
              <div className="h-6 bg-muted rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-3">
          {METRIC_CARDS.map(m => (
            <div key={m.key} className="bg-card border border-border rounded-xl p-3 flex flex-col gap-1.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${m.color}`}>
                {m.icon}
              </div>
              <p className="text-xs text-muted-foreground leading-tight">{m.label}</p>
              <p className="text-lg font-bold text-foreground font-tabular">{(totals[m.key] || 0).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Tìm theo Dãy hoặc Phòng/Khu vực..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Thêm phòng/khu vực mới — {activeKtx}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Dãy *</label>
              <input type="text" value={newRow.day} onChange={e => setNewRow(r => ({ ...r, day: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Dãy A" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Phòng/Khu vực *</label>
              <input type="text" value={newRow.phong_khu_vuc} onChange={e => setNewRow(r => ({ ...r, phong_khu_vuc: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Phòng A101" />
            </div>
            {NUMERIC_FIELDS.map(f => (
              <div key={f as string}>
                <label className="text-xs text-muted-foreground mb-1 block capitalize">{METRIC_CARDS.find(m => m.key === f)?.label || f as string}</label>
                <input type="number" min={0} value={(newRow as any)[f as string]} onChange={e => setNewRow(r => ({ ...r, [f as string]: Number(e.target.value) }))}
                  className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary text-center" />
              </div>
            ))}
            <div className="sm:col-span-2">
              <label className="text-xs text-muted-foreground mb-1 block">Ghi chú</label>
              <input type="text" value={newRow.ghi_chu} onChange={e => setNewRow(r => ({ ...r, ghi_chu: e.target.value }))}
                className="w-full px-2 py-1.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Ghi chú..." />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddRow} disabled={addingRow || !newRow.day.trim() || !newRow.phong_khu_vuc.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity">
              {addingRow ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Lưu
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors">
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            {activeKtx} — {sortedRows.length} phòng/khu vực
            {searchQuery && <span className="ml-2 text-xs text-muted-foreground">(đang lọc)</span>}
          </span>
          {saveError && (
            <span className="text-xs text-red-500">{saveError}</span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-primary" />
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package size={40} className="mb-3 opacity-30" />
            <p className="text-sm">{searchQuery ? 'Không tìm thấy kết quả phù hợp' : 'Chưa có dữ liệu cơ sở vật chất'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-muted/50 border-b border-border">
                <tr>
                  <th className={thClass} onClick={() => handleSort('day')}>Dãy <SortIcon field="day" /></th>
                  <th className={thClass} onClick={() => handleSort('phong_khu_vuc')}>Phòng/Khu vực <SortIcon field="phong_khu_vuc" /></th>
                  <th className={thClass} onClick={() => handleSort('giuong')}>Giường <SortIcon field="giuong" /></th>
                  <th className={thClass} onClick={() => handleSort('dieu_hoa')}>Điều hòa <SortIcon field="dieu_hoa" /></th>
                  <th className={thClass} onClick={() => handleSort('tu')}>Tủ <SortIcon field="tu" /></th>
                  <th className={thClass} onClick={() => handleSort('quat')}>Quạt <SortIcon field="quat" /></th>
                  <th className={thClass} onClick={() => handleSort('o_cam_dien')}>Ổ cắm <SortIcon field="o_cam_dien" /></th>
                  <th className={thClass} onClick={() => handleSort('remote')}>Remote <SortIcon field="remote" /></th>
                  <th className={thClass} onClick={() => handleSort('bong_tuyp')}>Bóng tuýp <SortIcon field="bong_tuyp" /></th>
                  <th className={thClass} onClick={() => handleSort('ban_an')}>Bàn ăn <SortIcon field="ban_an" /></th>
                  <th className={thClass} onClick={() => handleSort('ghe_an')}>Ghế ăn <SortIcon field="ghe_an" /></th>
                  <th className={thClass}>Ghi chú</th>
                  <th className={`${thClass} text-right`}>Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedRows.map(row => {
                  const isEditing = editingId === row.id;
                  return (
                    <tr key={row.id} className={`transition-colors ${isEditing ? 'bg-primary/5' : 'hover:bg-muted/30'}`}>
                      <td className={tdClass}><span className="font-medium">{row.day}</span></td>
                      <td className={tdClass}>{row.phong_khu_vuc}</td>
                      {isEditing && editingRow ? (
                        <>
                          {NUMERIC_FIELDS.map(f => (
                            <td key={f as string} className="px-2 py-1.5">
                              <input
                                type="number"
                                min={0}
                                value={(editingRow as any)[f as string]}
                                onChange={e => setEditingRow(r => r ? { ...r, [f as string]: Number(e.target.value) } : r)}
                                className={inputClass}
                              />
                            </td>
                          ))}
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={editingRow.ghi_chu}
                              onChange={e => setEditingRow(r => r ? { ...r, ghi_chu: e.target.value } : r)}
                              className="w-28 px-1.5 py-0.5 text-sm border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button onClick={saveEdit} disabled={saving}
                                className="p-1.5 rounded-lg bg-green-100 text-green-700 hover:bg-green-200 transition-colors disabled:opacity-50">
                                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                              </button>
                              <button onClick={cancelEdit} className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                                <X size={14} />
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className={`${tdClass} text-center font-tabular`}>{row.giuong}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.dieu_hoa}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.tu}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.quat}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.o_cam_dien}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.remote}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.bong_tuyp}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.ban_an}</td>
                          <td className={`${tdClass} text-center font-tabular`}>{row.ghe_an}</td>
                          <td className={`${tdClass} text-muted-foreground max-w-[120px] truncate`}>{row.ghi_chu || '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => startEdit(row)}
                              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
                              <Edit2 size={14} />
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              {/* Totals row */}
              <tfoot className="bg-muted/60 border-t-2 border-border">
                <tr>
                  <td className="px-3 py-2.5 text-xs font-bold text-foreground" colSpan={2}>TỔNG CỘNG ({ktxRows.length} phòng)</td>
                  {METRIC_CARDS.map(m => (
                    <td key={m.key} className="px-3 py-2.5 text-center text-sm font-bold text-foreground font-tabular">
                      {(totals[m.key] || 0).toLocaleString()}
                    </td>
                  ))}
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
