'use client';
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';

export type AuditAction = 'Thêm' | 'Sửa' | 'Xóa' | 'Chuyển phòng' | 'Đổi trạng thái tạm trú' | 'Import';

export interface AuditEntry {
  id: string;
  timestamp: string;
  account: string;
  action: AuditAction;
  detail: string;
}

const LS_AUDIT_KEY = 'ktx_audit_logs';

/** Get current time as ISO string in UTC+7 */
function nowVN(): string {
  const now = new Date();
  // Offset to UTC+7
  const vnOffset = 7 * 60; // minutes
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const vnTime = new Date(utc + vnOffset * 60000);
  return vnTime.toISOString();
}

const INITIAL_LOG: AuditEntry = {
  id: 'log-init-1',
  timestamp: nowVN(),
  account: 'admin@ktx.com',
  action: 'Thêm',
  detail: 'Khởi tạo hệ thống với 221 công nhân từ dữ liệu thực tế',
};

function loadLogs(): AuditEntry[] {
  if (typeof window === 'undefined') return [INITIAL_LOG];
  try {
    const raw = localStorage.getItem(LS_AUDIT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AuditEntry[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [INITIAL_LOG];
}

interface AuditContextValue {
  logs: AuditEntry[];
  addLog: (account: string, action: AuditAction, detail: string) => void;
}

const AuditContext = createContext<AuditContextValue | null>(null);

export function AuditProvider({ children }: { children: React.ReactNode }) {
  const [logs, setLogs] = useState<AuditEntry[]>(() => loadLogs());

  // Persist logs to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(LS_AUDIT_KEY, JSON.stringify(logs));
    } catch {}
  }, [logs]);

  const addLog = useCallback((account: string, action: AuditAction, detail: string) => {
    const entry: AuditEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: nowVN(),
      account,
      action,
      detail,
    };
    setLogs(prev => [entry, ...prev]);
  }, []);

  return (
    <AuditContext.Provider value={{ logs, addLog }}>
      {children}
    </AuditContext.Provider>
  );
}

export function useAudit() {
  const ctx = useContext(AuditContext);
  if (!ctx) throw new Error('useAudit must be used within AuditProvider');
  return ctx;
}
