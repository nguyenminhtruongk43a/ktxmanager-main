'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Search, Edit2, Check, X, Plus, Loader2, BedDouble, Wind, Package, Fan, Zap, Tv, Lightbulb, UtensilsCrossed, ChevronDown, ChevronUp, Upload, AlertCircle, CheckCircle2 } from 'lucide-react';
import * as XLSX from 'xlsx';

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

interface ImportResult {
  success: boolean;
  message: string;
  inserted: number;
  updated: number;
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

// ─── Excel column header → DB field mapping ───────────────────────────────────
// Normalize: trim, lowercase, collapse whitespace, strip diacritics for fuzzy match
function normalizeHeader(h: string): string {
  return h
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

// Strip Vietnamese diacritics for loose matching
function stripDiacritics(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

function normalizeLoose(h: string): string {
  return stripDiacritics(normalizeHeader(h));
}

type DbField = keyof Omit<FacilityRow, 'id' | 'ktx'>;

// Map normalized (with diacritics) header → DB field
const COLUMN_MAP_EXACT: Record<string, DbField> = {
  // STT (row number — used for header detection only, not stored)
  'stt': 'day', // placeholder; STT column is detected but not mapped to a field

  // Dãy
  'dãy': 'day', 'day': 'day', 'dây': 'day', 'dãy/khu': 'day',
  // Phòng/Khu vực
  'phòng': 'phong_khu_vuc', 'phòng/khu vực': 'phong_khu_vuc', 'khu vực': 'phong_khu_vuc',
  'phong': 'phong_khu_vuc', 'phong/khu vuc': 'phong_khu_vuc', 'khu vuc': 'phong_khu_vuc',
  'phòng/khu': 'phong_khu_vuc', 'phong khu vuc': 'phong_khu_vuc',
  'phòng/khu vuc': 'phong_khu_vuc', 'phong/khu vực': 'phong_khu_vuc',
  // Giường
  'giường': 'giuong', 'giuong': 'giuong', 'số giường': 'giuong', 'so giuong': 'giuong',
  // Điều hòa
  'điều hòa': 'dieu_hoa', 'dieu hoa': 'dieu_hoa', 'điều hoà': 'dieu_hoa', 'ac': 'dieu_hoa',
  'dieu hòa': 'dieu_hoa', 'điều hoa': 'dieu_hoa',
  // Tủ
  'tủ': 'tu', 'tu': 'tu', 'số tủ': 'tu',
  // Quạt
  'quạt': 'quat', 'quat': 'quat', 'số quạt': 'quat',
  // Ổ cắm
  'ổ cắm': 'o_cam_dien', 'o cam': 'o_cam_dien', 'ổ cắm điện': 'o_cam_dien', 'o cam dien': 'o_cam_dien',
  'ổ điện': 'o_cam_dien', 'o dien': 'o_cam_dien', 'ổ cắm dien': 'o_cam_dien',
  // Remote
  'remote': 'remote', 'điều khiển': 'remote', 'dieu khien': 'remote', 'điều khiên': 'remote',
  // Bóng tuýp
  'bóng tuýp': 'bong_tuyp', 'bong tuyp': 'bong_tuyp', 'bóng đèn': 'bong_tuyp', 'bong den': 'bong_tuyp',
  'tuýp': 'bong_tuyp', 'tuyp': 'bong_tuyp', 'bóng tuyp': 'bong_tuyp', 'bong tuýp': 'bong_tuyp',
  // Bàn ăn
  'bàn ăn': 'ban_an', 'ban an': 'ban_an', 'bàn': 'ban_an',
  // Ghế ăn
  'ghế ăn': 'ghe_an', 'ghe an': 'ghe_an', 'ghế': 'ghe_an',
  // Ghi chú
  'ghi chú': 'ghi_chu', 'ghi chu': 'ghi_chu', 'note': 'ghi_chu', 'notes': 'ghi_chu',
};

// Loose map (no diacritics) for fallback matching
const COLUMN_MAP_LOOSE: Record<string, DbField> = {
  'day': 'day', 'day/khu': 'day',
  'phong': 'phong_khu_vuc', 'phong/khu vuc': 'phong_khu_vuc', 'khu vuc': 'phong_khu_vuc',
  'phong/khu': 'phong_khu_vuc',
  'giuong': 'giuong', 'so giuong': 'giuong',
  'dieu hoa': 'dieu_hoa', 'ac': 'dieu_hoa',
  'tu': 'tu', 'so tu': 'tu',
  'quat': 'quat', 'so quat': 'quat',
  'o cam': 'o_cam_dien', 'o cam dien': 'o_cam_dien', 'o dien': 'o_cam_dien',
  'remote': 'remote', 'dieu khien': 'remote',
  'bong tuyp': 'bong_tuyp', 'bong den': 'bong_tuyp', 'tuyp': 'bong_tuyp',
  'ban an': 'ban_an', 'ban': 'ban_an',
  'ghe an': 'ghe_an', 'ghe': 'ghe_an',
  'ghi chu': 'ghi_chu', 'note': 'ghi_chu', 'notes': 'ghi_chu',
};

function resolveColumnField(rawHeader: string): DbField | 'stt' | null {
  const norm = normalizeHeader(rawHeader);
  const loose = normalizeLoose(rawHeader);

  // STT detection (row number column — used only for header row detection)
  if (norm === 'stt' || loose === 'stt') return 'stt';

  // Exact match with diacritics
  if (COLUMN_MAP_EXACT[norm]) return COLUMN_MAP_EXACT[norm];

  // Loose match (no diacritics)
  if (COLUMN_MAP_LOOSE[loose]) return COLUMN_MAP_LOOSE[loose];

  // Partial / contains match for common keywords
  if (loose.includes('giuong')) return 'giuong';
  if (loose.includes('dieu hoa') || loose.includes('dieu hòa')) return 'dieu_hoa';
  if (loose.includes('o cam')) return 'o_cam_dien';
  if (loose.includes('bong tuyp') || loose.includes('bong den')) return 'bong_tuyp';
  if (loose.includes('ban an')) return 'ban_an';
  if (loose.includes('ghe an')) return 'ghe_an';
  if (loose.includes('remote') || loose.includes('dieu khien')) return 'remote';
  if (loose.includes('quat')) return 'quat';
  if (loose.includes('phong') || loose.includes('khu vuc')) return 'phong_khu_vuc';

  return null;
}

// ─── Determine KTX name from sheet name ───────────────────────────────────────
function resolveKtxFromSheetName(sheetName: string): 'KTX 1' | 'KTX 2' | null {
  const loose = normalizeLoose(sheetName).replace(/\s+/g, '');
  // Contains "1" → KTX 1; contains "2" → KTX 2
  if (/ktx.*1|1.*ktx|ktxtucxa1|kytuxa1|ktx1/.test(loose)) return 'KTX 1';
  if (/ktx.*2|2.*ktx|ktxtucxa2|kytuxa2|ktx2/.test(loose)) return 'KTX 2';

  // Broader: any sheet name containing "1" or "2" as the distinguishing digit
  const norm = normalizeHeader(sheetName);
  if (/\b1\b/.test(norm) || norm.endsWith('1') || norm.endsWith(' 1')) return 'KTX 1';
  if (/\b2\b/.test(norm) || norm.endsWith('2') || norm.endsWith(' 2')) return 'KTX 2';

  return null;
}

// ─── Core sheet parser ────────────────────────────────────────────────────────
/**
 * Parse a single worksheet into facility rows.
 *
 * Header detection strategy (in order):
 *  1. Find the first row (within rows 1–10) that contains the keyword "STT"
 *     → that row is the header row; data starts from the NEXT row.
 *  2. If "STT" is not found, default to row 7 (index 6) as the header row
 *     → data starts from row 8 (index 7).
 *  3. Additionally scan the header row for all known column keywords and build
 *     a column index → DB field map.
 */
function parseSheetToRows(sheet: XLSX.WorkSheet, ktxName: string): Omit<FacilityRow, 'id'>[] {
  const jsonData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!jsonData || jsonData.length < 2) return [];

  const SEARCH_LIMIT = Math.min(10, jsonData.length);

  let headerRowIdx = -1;
  let headerMap: Record<number, DbField> = {};

  // ── Step 1: Find row containing "STT" ──
  for (let i = 0; i < SEARCH_LIMIT; i++) {
    const row = jsonData[i];
    const hasStt = row.some((cell: any) => {
      const n = normalizeHeader(String(cell ?? ''));
      return n === 'stt';
    });
    if (hasStt) {
      headerRowIdx = i;
      break;
    }
  }

  // ── Step 2: Fallback — find row with most column matches ──
  if (headerRowIdx === -1) {
    let bestMatchCount = 0;
    for (let i = 0; i < SEARCH_LIMIT; i++) {
      const row = jsonData[i];
      let matchCount = 0;
      row.forEach((cell: any) => {
        const field = resolveColumnField(String(cell ?? ''));
        if (field && field !== 'stt') matchCount++;
      });
      if (matchCount > bestMatchCount) {
        bestMatchCount = matchCount;
        headerRowIdx = i;
      }
    }
    // If still no good match found (0 or 1 column), default to row 7 (index 6)
    if (bestMatchCount < 2) {
      headerRowIdx = Math.min(6, jsonData.length - 1);
    }
  }

  // ── Step 3: Build column map from the detected header row ──
  const headerRow = jsonData[headerRowIdx] || [];
  headerRow.forEach((cell: any, colIdx: number) => {
    const field = resolveColumnField(String(cell ?? ''));
    if (field && field !== 'stt') {
      headerMap[colIdx] = field as DbField;
    }
  });

  // Data starts immediately after the header row
  const dataStartIdx = headerRowIdx + 1;

  const results: Omit<FacilityRow, 'id'>[] = [];

  for (let i = dataStartIdx; i < jsonData.length; i++) {
    const row = jsonData[i];
    if (!row || row.every((c: any) => c === '' || c === null || c === undefined)) continue;

    const record: Omit<FacilityRow, 'id'> = {
      ktx: ktxName,
      day: '',
      phong_khu_vuc: '',
      giuong: 0,
      dieu_hoa: 0,
      tu: 0,
      quat: 0,
      o_cam_dien: 0,
      remote: 0,
      bong_tuyp: 0,
      ban_an: 0,
      ghe_an: 0,
      ghi_chu: '',
    };

    Object.entries(headerMap).forEach(([colIdxStr, field]) => {
      const colIdx = Number(colIdxStr);
      const cellVal = row[colIdx];
      if (field === 'day' || field === 'phong_khu_vuc' || field === 'ghi_chu') {
        (record as any)[field] = String(cellVal ?? '').trim();
      } else {
        const num = Number(cellVal);
        (record as any)[field] = isNaN(num) ? 0 : num;
      }
    });

    // Skip rows without any room identifier
    if (!record.day && !record.phong_khu_vuc) continue;

    results.push(record);
  }

  return results;
}

// ─── Determine which KTX a sheet belongs to ───────────────────────────────────
/**
 * For multi-sheet files: map each sheet to KTX 1 or KTX 2 by name.
 * For single-sheet files: assign KTX 1 by default (user can re-import for KTX 2).
 * Returns array of { sheetName, ktxName } pairs to process.
 */
function resolveSheets(workbook: XLSX.WorkBook): { sheetName: string; ktxName: 'KTX 1' | 'KTX 2' }[] {
  const sheets = workbook.SheetNames;

  if (sheets.length === 1) {
    // Single-sheet file: try to detect KTX from sheet name, default to KTX 1
    const ktx = resolveKtxFromSheetName(sheets[0]) ?? 'KTX 1';
    return [{ sheetName: sheets[0], ktxName: ktx }];
  }

  // Multi-sheet: map each sheet by name
  const result: { sheetName: string; ktxName: 'KTX 1' | 'KTX 2' }[] = [];
  for (const sheetName of sheets) {
    const ktx = resolveKtxFromSheetName(sheetName);
    if (ktx) {
      result.push({ sheetName, ktxName: ktx });
    }
  }

  // If no sheets matched by name but there are exactly 2 sheets, assign KTX 1 and KTX 2 in order
  if (result.length === 0 && sheets.length >= 2) {
    result.push({ sheetName: sheets[0], ktxName: 'KTX 1' });
    result.push({ sheetName: sheets[1], ktxName: 'KTX 2' });
  } else if (result.length === 0 && sheets.length === 1) {
    result.push({ sheetName: sheets[0], ktxName: 'KTX 1' });
  }

  return result;
}

// ─── Main Component ───────────────────────────────────────────────────────────
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

  // Import Excel state
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset file input so same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = '';

    setImporting(true);
    setImportResult(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });

      // Resolve which sheets map to which KTX
      const sheetMappings = resolveSheets(workbook);

      let allParsedRows: Omit<FacilityRow, 'id'>[] = [];
      const sheetLog: string[] = [];

      for (const { sheetName, ktxName } of sheetMappings) {
        const sheet = workbook.Sheets[sheetName];
        const parsed = parseSheetToRows(sheet, ktxName);
        sheetLog.push(`"${sheetName}" → ${ktxName}: ${parsed.length} dòng`);
        allParsedRows = allParsedRows.concat(parsed);
      }

      console.log('[Import] Sheet mapping:', sheetLog.join(', '));
      console.log('[Import] Total parsed rows:', allParsedRows.length);

      if (allParsedRows.length === 0) {
        setImportResult({
          success: false,
          message: `Không tìm thấy dữ liệu hợp lệ trong file. Kiểm tra lại file Excel (sheet: ${workbook.SheetNames.join(', ')}).`,
          inserted: 0,
          updated: 0,
        });
        setImporting(false);
        return;
      }

      // Fetch existing rows to determine insert vs update
      const { data: existingData, error: fetchErr } = await supabase
        .from('facilities')
        .select('id, ktx, day, phong_khu_vuc');

      if (fetchErr) throw new Error(fetchErr.message);

      const existingMap = new Map<string, string>();
      (existingData || []).forEach((r: any) => {
        const key = `${r.ktx}||${r.day}||${r.phong_khu_vuc}`;
        existingMap.set(key, r.id);
      });

      const toInsert: Omit<FacilityRow, 'id'>[] = [];
      const toUpdate: (Omit<FacilityRow, 'id'> & { id: string })[] = [];

      allParsedRows.forEach(row => {
        const key = `${row.ktx}||${row.day}||${row.phong_khu_vuc}`;
        const existingId = existingMap.get(key);
        if (existingId) {
          toUpdate.push({ ...row, id: existingId });
        } else {
          toInsert.push(row);
        }
      });

      let insertedCount = 0;
      let updatedCount = 0;
      const errors: string[] = [];

      // Insert new rows in batches of 50
      if (toInsert.length > 0) {
        for (let i = 0; i < toInsert.length; i += 50) {
          const batch = toInsert.slice(i, i + 50);
          const { error: insertErr } = await supabase.from('facilities').insert(batch);
          if (insertErr) {
            errors.push(`Insert error: ${insertErr.message}`);
          } else {
            insertedCount += batch.length;
          }
        }
      }

      // Update existing rows
      if (toUpdate.length > 0) {
        for (const row of toUpdate) {
          const { id, ...updateData } = row;
          const { error: updateErr } = await supabase
            .from('facilities')
            .update(updateData)
            .eq('id', id);
          if (updateErr) {
            errors.push(`Update error (${row.day} - ${row.phong_khu_vuc}): ${updateErr.message}`);
          } else {
            updatedCount++;
          }
        }
      }

      if (errors.length > 0) {
        setImportResult({
          success: false,
          message: `Có lỗi xảy ra: ${errors.slice(0, 2).join('; ')}`,
          inserted: insertedCount,
          updated: updatedCount,
        });
      } else {
        setImportResult({
          success: true,
          message: `Import thành công! Đã thêm ${insertedCount} dòng mới, cập nhật ${updatedCount} dòng.`,
          inserted: insertedCount,
          updated: updatedCount,
        });
      }

      // Reload all data to refresh UI and metrics
      await fetchFacilities();

    } catch (err: any) {
      setImportResult({
        success: false,
        message: `Lỗi đọc file: ${err.message}`,
        inserted: 0,
        updated: 0,
      });
    } finally {
      setImporting(false);
    }
  };

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

  // Totals calculated from ALL rows for the active KTX (not just filtered)
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
        <div className="flex items-center gap-2 flex-wrap">
          {/* Import Excel button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleImportExcel}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors"
          >
            {importing ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Upload size={16} />
            )}
            {importing ? 'Đang import...' : 'Import Excel'}
          </button>
          <button
            onClick={() => { setShowAddForm(v => !v); setNewRow(r => ({ ...r, ktx: activeKtx })); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={16} />
            Thêm phòng/khu vực
          </button>
        </div>
      </div>

      {/* Import Result Banner */}
      {importResult && (
        <div className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${importResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
          {importResult.success ? (
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle size={18} className="mt-0.5 shrink-0 text-red-500" />
          )}
          <div className="flex-1">
            <p className="font-medium">{importResult.message}</p>
            {importResult.success && (
              <p className="text-xs mt-0.5 text-emerald-700">
                Thêm mới: {importResult.inserted} dòng &nbsp;|&nbsp; Cập nhật: {importResult.updated} dòng
              </p>
            )}
          </div>
          <button onClick={() => setImportResult(null)} className="shrink-0 opacity-60 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Import Help Text */}
      <div className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-3 py-2">
        <span className="font-medium">Hướng dẫn Import Excel:</span> Hỗ trợ file <code className="bg-muted px-1 rounded">.xlsx</code> có 1 hoặc nhiều sheet với tên bất kỳ (KTX 1, KTX 2, KTX1, KTX2, Ký Túc Xá 1...). Hàng tiêu đề được tự động nhận dạng qua từ khóa <strong>STT</strong> hoặc mặc định hàng 7. Các cột nhận dạng tự động: <em>STT, Dãy, Phòng/Khu vực, Giường, Điều hòa, Tủ, Quạt, Ổ cắm điện, Remote, Bóng tuýp, Bàn ăn, Ghế ăn</em>.
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
