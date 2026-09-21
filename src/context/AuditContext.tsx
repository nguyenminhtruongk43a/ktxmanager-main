'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

export type AuditAction = 'Thêm' | 'Sửa' | 'Xóa' | 'Chuyển phòng' | 'Đổi trạng thái tạm trú' | 'Import' | 'CREATE' | 'UPDATE' | 'DELETE' | 'IMPORT';

export interface AuditEntry {
  id: string;
  timestamp: string;
  account: string;
  action: AuditAction;
  detail: string;
}

interface AuditContextValue {
  logs: AuditEntry[];
  addLog: (account: string, action: AuditAction, detail: string) => void;
  loading: boolean;
}

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  // Load all logs from Supabase on mount
  useEffect(() => {
    let mounted = true;
    async function fetchLogs() {
      try {
        const { data, error } = await supabase
          .from('audit_logs')
          .select('*')
          .order('timestamp', { ascending: false })
          .limit(500);
        if (!mounted) return;
        if (!error && data) {
          setLogs(data.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            account: row.account,
            action: row.action as AuditAction,
            detail: row.detail,
          })));
        }
      } catch {}
      if (mounted) setLoading(false);
    }
    fetchLogs();
    return () => { mounted = false; };
  }, []);

  const addLog = useCallback(async (account: string, action: AuditAction, detail: string) => {
    const entry: AuditEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      account,
      action,
      detail,
    };
    // Optimistic update
    setLogs(prev => [entry, ...prev]);
    // Persist to Supabase
    try {
      await supabase.from('audit_logs').insert({
        account,
        action,
        detail,
      });
    } catch {}
  }, [supabase]);

  return (
    <AuditContext.Provider value={{ logs, addLog, loading }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within AuditProvider');
  return ctx;
}
