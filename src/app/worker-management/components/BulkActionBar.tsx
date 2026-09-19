'use client';
import React from 'react';
import { Trash2, X } from 'lucide-react';

interface Props {
  selectedCount: number;
  onDelete?: () => void;
  onClear: () => void;
}

export default function BulkActionBar({ selectedCount, onDelete, onClear }: Props) {
  if (selectedCount === 0) return null;

  return (
    <div className="slide-up mb-3 flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-2.5">
      <span className="text-sm font-semibold text-primary">
        Đã chọn {selectedCount} công nhân
      </span>
      <div className="flex-1" />
      {onDelete && (
        <button
          onClick={onDelete}
          className="btn-danger text-xs py-1.5 px-3"
        >
          <Trash2 size={13} />
          Xóa {selectedCount} mục
        </button>
      )}
      <button onClick={onClear} className="btn-ghost text-xs py-1.5 px-2">
        <X size={13} />
        Bỏ chọn
      </button>
    </div>
  );
}