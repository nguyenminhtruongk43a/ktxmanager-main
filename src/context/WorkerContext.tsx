'use client';
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Worker, WORKERS } from '@/data/workers';
import { createClient } from '@/lib/supabase/client';

// ─── DB row ↔ Worker mapping ───────────────────────────────────────────────

function dbRowToWorker(row: Record<string, unknown>): Worker {
  return {
    id: String(row.id ?? ''),
    stt: Number(row.stt ?? 0),
    hoVaTen: String(row.ho_va_ten ?? ''),
    maNV: String(row.ma_nv ?? ''),
    tieuDoan: String(row.tieu_doan ?? ''),
    ktx: String(row.ktx ?? ''),
    donVi: String(row.don_vi ?? ''),
    gioiTinh: String(row.gioi_tinh ?? ''),
    ngaySinh: String(row.ngay_sinh ?? row.date_of_birth ?? row.dob ?? ''),
    soDienThoai: String(row.so_dien_thoai ?? ''),
    day: String(row.day ?? ''),
    phongSo: String(row.phong_so ?? ''),
    giuong: String(row.giuong ?? ''),
    cccd: String(row.cccd ?? ''),
    hoKhauTinh: String(row.ho_khau_tinh ?? ''),
    toTruong: String(row.to_truong ?? ''),
    sdtToTruong: String(row.sdt_to_truong ?? ''),
    ngayVaoKTX: String(row.ngay_vao_ktx ?? ''),
    ngayRaKTX: row.ngay_ra_ktx ? String(row.ngay_ra_ktx) : undefined,
    ghiChu: String(row.ghi_chu ?? ''),
    khoaTraCuu: String(row.khoa_tra_cuu ?? ''),
    avatar: row.avatar ? String(row.avatar) : undefined,
    tamTruStatus: (row.tam_tru_status as 'registered' | 'unregistered') ?? 'unregistered',
  };
}

function workerToDbRow(w: Worker): Record<string, unknown> {
  return {
    id: w.id,
    stt: w.stt,
    ho_va_ten: w.hoVaTen,
    ma_nv: w.maNV,
    tieu_doan: w.tieuDoan,
    ktx: w.ktx,
    don_vi: w.donVi,
    gioi_tinh: w.gioiTinh,
    ngay_sinh: w.ngaySinh,
    so_dien_thoai: w.soDienThoai,
    day: w.day,
    phong_so: w.phongSo,
    giuong: w.giuong ?? '',
    cccd: w.cccd,
    ho_khau_tinh: w.hoKhauTinh,
    to_truong: w.toTruong,
    sdt_to_truong: w.sdtToTruong,
    ngay_vao_ktx: w.ngayVaoKTX,
    ngay_ra_ktx: w.ngayRaKTX ?? null,
    ghi_chu: w.ghiChu,
    khoa_tra_cuu: w.khoaTraCuu,
    avatar: w.avatar ?? '',
    tam_tru_status: w.tamTruStatus ?? 'unregistered',
  };
}

// ─── Context types ─────────────────────────────────────────────────────────

interface WorkerContextValue {
  workers: Worker[];
  workerCount: number;
  /** Exact total count from DB (accurate even for 6000+ records) */
  totalWorkerCount: number;
  loading: boolean;
  refreshing: boolean;
  // CRUD operations (async, write to Supabase)
  addWorker: (worker: Worker) => Promise<void>;
  updateWorker: (worker: Worker) => Promise<void>;
  deleteWorker: (id: string) => Promise<void>;
  deleteWorkers: (ids: string[]) => Promise<void>;
  deleteAllWorkers: () => Promise<void>;
  importWorkers: (rows: Worker[]) => Promise<void>;
  updateTamTruStatus: (id: string, status: 'registered' | 'unregistered') => Promise<void>;
  bulkUpdateKtx: (ids: string[], ktxValue: string) => Promise<void>;
  refreshWorkers: () => Promise<void>;
  // Legacy setter for compatibility
  setWorkers: React.Dispatch<React.SetStateAction<Worker[]>>;
}

const WorkerContext = createContext<WorkerContextValue | null>(null);

/** Page size for range-based fetching to bypass Supabase 1000-row default limit */
const FETCH_PAGE_SIZE = 1000;

export function WorkerProvider({ children }: { children: React.ReactNode }) {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [totalWorkerCount, setTotalWorkerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const supabase = createClient();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Fetch exact count from DB (lightweight, no data transfer) ─────────────
  const fetchCount = useCallback(async () => {
    try {
      const { count, error } = await supabase
        .from('workers')
        .select('*', { count: 'exact', head: true });
      if (!error && count !== null) {
        setTotalWorkerCount(count);
      }
    } catch (err) {
      console.error('fetchCount error:', err);
    }
  }, []);

  // ── Fetch ALL workers using range pagination (bypasses 1000-row limit) ────
  const fetchWorkers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const allRows: Worker[] = [];
      let from = 0;
      let hasMore = true;

      while (hasMore) {
        const to = from + FETCH_PAGE_SIZE - 1;
        const { data, error } = await supabase
          .from('workers')
          .select('*')
          .order('stt', { ascending: true })
          .range(from, to);

        if (error) {
          console.error('Supabase load error:', error.message);
          if (
            error.message?.includes('does not exist') ||
            error.message?.includes('schema cache') ||
            error.code === '42P01' ||
            error.code === 'PGRST116'
          ) {
            if (!isRefresh && allRows.length === 0) setWorkers(WORKERS);
          }
          break;
        }

        const batch = (data ?? []).map(dbRowToWorker);
        allRows.push(...batch);

        // If we got fewer rows than the page size, we've reached the end
        if (batch.length < FETCH_PAGE_SIZE) {
          hasMore = false;
        } else {
          from += FETCH_PAGE_SIZE;
        }
      }

      if (allRows.length > 0 || !loading) {
        setWorkers(allRows);
        setTotalWorkerCount(allRows.length);
      }
    } catch (err) {
      console.error('Load workers failed:', err);
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  }, [loading]);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetchWorkers(false);
  }, [fetchWorkers]);

  // ── Real-time subscription (workers + profiles) ───────────────────────────
  useEffect(() => {
    // Workers realtime channel
    const workersChannel = supabase
      .channel('workers_realtime_v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'workers' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newWorker = dbRowToWorker(payload.new as Record<string, unknown>);
            setWorkers(prev => {
              if (prev.some(w => w.id === newWorker.id)) return prev;
              const next = [...prev, newWorker].sort((a, b) => a.stt - b.stt);
              setTotalWorkerCount(next.length);
              return next;
            });
          } else if (payload.eventType === 'UPDATE') {
            const updated = dbRowToWorker(payload.new as Record<string, unknown>);
            setWorkers(prev => prev.map(w => w.id === updated.id ? updated : w));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as Record<string, unknown>).id as string;
            setWorkers(prev => {
              const next = prev.filter(w => w.id !== deletedId);
              setTotalWorkerCount(next.length);
              return next;
            });
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[Realtime] workers channel subscribed');
        }
      });

    // Profiles realtime channel — triggers a full re-fetch when profiles change
    const profilesChannel = supabase
      .channel('profiles_realtime_v2')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        () => {
          fetchWorkers(false);
        }
      )
      .subscribe();

    channelRef.current = workersChannel;

    return () => {
      supabase.removeChannel(workersChannel);
      supabase.removeChannel(profilesChannel);
    };
  }, [fetchWorkers]);

  // ── Manual refresh ────────────────────────────────────────────────────────
  const refreshWorkers = useCallback(async () => {
    await fetchWorkers(true);
    await fetchCount();
  }, [fetchWorkers, fetchCount]);

  // ── CRUD operations ───────────────────────────────────────────────────────

  const addWorker = useCallback(async (worker: Worker) => {
    const { error } = await supabase
      .from('workers')
      .insert(workerToDbRow(worker));
    if (error) throw new Error(error.message);
    // Optimistic update: add to local state immediately (don't wait for realtime)
    setWorkers(prev => {
      if (prev.some(w => w.id === worker.id)) return prev;
      const next = [...prev, worker].sort((a, b) => a.stt - b.stt);
      setTotalWorkerCount(next.length);
      return next;
    });
    // Fallback re-fetch after short delay to ensure consistency
    setTimeout(() => fetchWorkers(false), 1500);
  }, [fetchWorkers]);

  const updateWorker = useCallback(async (worker: Worker) => {
    const { error } = await supabase
      .from('workers')
      .update(workerToDbRow(worker))
      .eq('id', worker.id);
    if (error) throw new Error(error.message);
    // Optimistic update
    setWorkers(prev => prev.map(w => w.id === worker.id ? worker : w));
  }, []);

  const deleteWorker = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('workers')
      .delete()
      .eq('id', id);
    if (error) throw new Error(error.message);
  }, []);

  const deleteWorkers = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await supabase
      .from('workers')
      .delete()
      .in('id', ids);
    if (error) throw new Error(error.message);
  }, []);

  const deleteAllWorkers = useCallback(async () => {
    const { error } = await supabase
      .from('workers')
      .delete()
      .neq('id', '___never___');
    if (error) throw new Error(error.message);
    setWorkers([]);
    setTotalWorkerCount(0);
  }, []);

  const importWorkers = useCallback(async (rows: Worker[]) => {
    if (rows.length === 0) return;
    const maxStt = workers.length > 0 ? Math.max(...workers.map(w => w.stt)) : 0;
    const rowsWithStt = rows.map((r, i) => ({ ...r, stt: maxStt + i + 1 }));
    const dbRows = rowsWithStt.map(workerToDbRow);

    const BATCH = 100;
    for (let i = 0; i < dbRows.length; i += BATCH) {
      const batch = dbRows.slice(i, i + BATCH);
      const { error } = await supabase
        .from('workers')
        .upsert(batch, { onConflict: 'id' });
      if (error) throw new Error(error.message);
    }
    // After import, re-fetch to get accurate state from DB (refresh mode)
    await fetchWorkers(true);
  }, [workers, fetchWorkers]);

  const updateTamTruStatus = useCallback(async (id: string, status: 'registered' | 'unregistered') => {
    const { error } = await supabase
      .from('workers')
      .update({ tam_tru_status: status })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }, []);

  const bulkUpdateKtx = useCallback(async (ids: string[], ktxValue: string) => {
    if (ids.length === 0) return;
    const BATCH = 200;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batchIds = ids.slice(i, i + BATCH);
      const { error } = await supabase
        .from('workers')
        .update({ ktx: ktxValue })
        .in('id', batchIds);
      if (error) throw new Error(error.message);
    }
    // Optimistic update in local state
    setWorkers(prev => prev.map(w => ids.includes(w.id) ? { ...w, ktx: ktxValue } : w));
  }, []);

  return (
    <WorkerContext.Provider value={{
      workers,
      workerCount: workers.length,
      totalWorkerCount,
      loading,
      refreshing,
      addWorker,
      updateWorker,
      deleteWorker,
      deleteWorkers,
      deleteAllWorkers,
      importWorkers,
      updateTamTruStatus,
      bulkUpdateKtx,
      refreshWorkers,
      setWorkers,
    }}>
      {children}
    </WorkerContext.Provider>
  );
}

export function useWorkers() {
  const ctx = useContext(WorkerContext);
  if (!ctx) throw new Error('useWorkers must be used within WorkerProvider');
  return ctx;
}
