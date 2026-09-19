'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/context/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { UserPlus, Pencil, Trash2, Shield, ShieldCheck, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

// All possible blocks grouped by KTX — stored as "KTX 1 - Dãy 1" format
const KTX_BLOCK_GROUPS: { ktx: string; color: 'blue' | 'orange'; blocks: string[] }[] = [
  {
    ktx: 'KTX 1',
    color: 'blue',
    blocks: ['KTX 1 - Dãy 1', 'KTX 1 - Dãy 2', 'KTX 1 - Dãy 3', 'KTX 1 - Dãy 4', 'KTX 1 - Dãy 5', 'KTX 1 - Dãy 6'],
  },
  {
    ktx: 'KTX 2',
    color: 'orange',
    blocks: ['KTX 2 - Dãy 1', 'KTX 2 - Dãy 2', 'KTX 2 - Dãy 3', 'KTX 2 - Dãy 4', 'KTX 2 - Dãy 5', 'KTX 2 - Dãy 6'],
  },
];

interface ProfileRecord {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  assigned_blocks: string[];
  created_at: string;
}

interface UserFormData {
  full_name: string;
  email: string;
  password: string;
  role: UserRole;
  assigned_blocks: string[];
}

const emptyForm: UserFormData = { full_name: '', email: '', password: '', role: 'staff', assigned_blocks: [] };

// Toast notification component
function Toast({ message, type, onClose }: { message: string; type: 'success' | 'error'; onClose: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className={`fixed top-4 right-4 z-[100] flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border max-w-sm ${
      type === 'success' ?'bg-green-50 border-green-200 text-green-800 dark:bg-green-900/30 dark:border-green-700 dark:text-green-300' :'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/30 dark:border-red-700 dark:text-red-300'
    }`}>
      {type === 'success' ? <CheckCircle size={18} className="flex-shrink-0 mt-0.5" /> : <AlertCircle size={18} className="flex-shrink-0 mt-0.5" />}
      <p className="text-sm font-medium leading-snug">{message}</p>
      <button onClick={onClose} className="ml-auto text-current opacity-60 hover:opacity-100 flex-shrink-0">✕</button>
    </div>
  );
}

export default function UserManagementClient() {
  const { isAdmin, currentUser } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<ProfileRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileRecord | null>(null);
  const [form, setForm] = useState<UserFormData>(emptyForm);
  const [formError, setFormError] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'admin' | 'staff'>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
  };

  // Route protection
  if (!isAdmin) {
    if (typeof window !== 'undefined') {
      router.replace('/');
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <Shield size={48} className="text-muted-foreground" />
        <p className="text-lg font-semibold text-foreground">Bạn không có quyền truy cập trang này.</p>
        <button onClick={() => router.push('/')} className="btn-primary px-4 py-2 rounded-lg text-sm">Về Tổng Quan</button>
      </div>
    );
  }

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_all_profiles');

      if (!rpcError && rpcData) {
        setProfiles((rpcData as ProfileRecord[]).map(p => ({
          ...p,
          assigned_blocks: p.assigned_blocks ?? [],
        })));
      } else {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, email, full_name, role, assigned_blocks, created_at')
          .order('created_at', { ascending: false });

        if (error) {
          showToast(`Lỗi tải danh sách tài khoản: ${error.message}`, 'error');
        } else {
          setProfiles((data ?? []).map(p => ({ ...p, assigned_blocks: p.assigned_blocks ?? [] })));
        }
      }
    } catch {
      showToast('Không thể kết nối Supabase.', 'error');
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  const filteredProfiles = profiles.filter(p => {
    if (activeTab === 'all') return true;
    return p.role === activeTab;
  });

  const openAdd = () => {
    setEditTarget(null);
    setForm(emptyForm);
    setFormError('');
    setShowModal(true);
  };

  const openEdit = (profile: ProfileRecord) => {
    setEditTarget(profile);
    setForm({
      full_name: profile.full_name,
      email: profile.email,
      password: '',
      role: profile.role,
      assigned_blocks: profile.assigned_blocks ?? [],
    });
    setFormError('');
    setShowModal(true);
  };

  const toggleBlock = (block: string) => {
    setForm(f => {
      const current = f.assigned_blocks ?? [];
      if (current.includes(block)) {
        return { ...f, assigned_blocks: current.filter(b => b !== block) };
      } else {
        return { ...f, assigned_blocks: [...current, block] };
      }
    });
  };

  const toggleKtxGroup = (group: typeof KTX_BLOCK_GROUPS[0]) => {
    const allChecked = group.blocks.every(b => (form.assigned_blocks ?? []).includes(b));
    if (allChecked) {
      setForm(f => ({ ...f, assigned_blocks: (f.assigned_blocks ?? []).filter(b => !group.blocks.includes(b)) }));
    } else {
      setForm(f => {
        const current = f.assigned_blocks ?? [];
        const merged = [...new Set([...current, ...group.blocks])];
        return { ...f, assigned_blocks: merged };
      });
    }
  };

  const handleSubmit = async () => {
    if (!form.full_name.trim() || !form.email.trim()) {
      setFormError('Vui lòng điền đầy đủ Họ tên và Email.');
      return;
    }
    if (!editTarget && !form.password.trim()) {
      setFormError('Vui lòng nhập mật khẩu cho tài khoản mới.');
      return;
    }
    if (!editTarget && form.password.length < 6) {
      setFormError('Mật khẩu phải có ít nhất 6 ký tự.');
      return;
    }

    setSubmitting(true);
    setFormError('');

    try {
      if (editTarget) {
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: form.full_name,
            role: form.role,
            assigned_blocks: form.assigned_blocks,
          })
          .eq('id', editTarget.id);

        if (error) {
          setFormError(`Lỗi cập nhật: ${error.message}`);
        } else {
          setShowModal(false);
          showToast(`Đã cập nhật tài khoản ${form.full_name} thành công.`, 'success');
          await loadProfiles();
        }
      } else {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setFormError('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
          setSubmitting(false);
          return;
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const response = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            full_name: form.full_name,
            role: form.role,
            assigned_blocks: form.assigned_blocks,
          }),
        });

        const result = await response.json();

        if (!response.ok || result.error) {
          setFormError(result.error || 'Tạo tài khoản thất bại. Vui lòng thử lại.');
        } else {
          setShowModal(false);
          showToast(`Đã tạo tài khoản ${form.full_name} (${form.email}) thành công!`, 'success');
          await new Promise(resolve => setTimeout(resolve, 500));
          await loadProfiles();
        }
      }
    } catch (err) {
      setFormError(`Lỗi kết nối: ${err instanceof Error ? err.message : 'Không xác định'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.id === currentUser?.id) {
      showToast('Không thể xóa tài khoản đang đăng nhập.', 'error');
      setDeleteTarget(null);
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', deleteTarget.id);

      if (error) {
        showToast(`Lỗi xóa tài khoản: ${error.message}`, 'error');
      } else {
        showToast(`Đã xóa tài khoản ${deleteTarget.full_name}.`, 'success');
        setDeleteTarget(null);
        await loadProfiles();
      }
    } catch {
      showToast('Không thể xóa tài khoản.', 'error');
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quản Lý Tài Khoản</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Quản lý tài khoản người dùng trong hệ thống</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadProfiles}
            disabled={loading}
            className="flex items-center gap-2 border border-border text-muted-foreground px-3 py-2 rounded-lg text-sm hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Tải lại
          </button>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <UserPlus size={16} />
            + Tạo tài khoản mới
          </button>
        </div>
      </div>

      {/* Tab Filter Bar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {([
          { key: 'all', label: 'Tất cả', count: profiles.length },
          { key: 'admin', label: 'Admin', count: profiles.filter(u => u.role === 'admin').length },
          { key: 'staff', label: 'Staff', count: profiles.filter(u => u.role === 'staff').length },
        ] as { key: 'all' | 'admin' | 'staff'; label: string; count: number }[]).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold border transition-all duration-150 select-none ${
              activeTab === tab.key
                ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                : 'bg-card text-muted-foreground border-border hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {tab.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-tabular ${
              activeTab === tab.key
                ? 'bg-primary-foreground/20 text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3 text-muted-foreground">
            <RefreshCw size={20} className="animate-spin" />
            <span className="text-sm">Đang tải danh sách tài khoản...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Họ và tên</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Email</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Vai trò</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">KTX + Dãy phụ trách</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Ngày tạo</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredProfiles.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">
                      Không có tài khoản nào trong danh mục này.
                    </td>
                  </tr>
                ) : (
                  filteredProfiles.map((profile, idx) => (
                    <tr key={profile.id} className={`border-b border-border last:border-0 hover:bg-muted/20 transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${profile.role === 'admin' ? 'bg-red-500' : 'bg-blue-500'}`}>
                            {(profile.full_name || profile.email).charAt(0).toUpperCase()}
                          </div>
                          <span className="font-medium text-foreground">
                            {profile.full_name || '—'}
                            {profile.id === currentUser?.id && (
                              <span className="ml-1.5 text-xs text-muted-foreground">(bạn)</span>
                            )}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{profile.email}</td>
                      <td className="px-4 py-3">
                        {profile.role === 'admin' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                            <ShieldCheck size={11} /> Admin
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            <Shield size={11} /> Staff
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {profile.role === 'admin' ? (
                          <span className="text-xs text-muted-foreground italic">Toàn bộ KTX</span>
                        ) : profile.assigned_blocks && profile.assigned_blocks.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {KTX_BLOCK_GROUPS.map(group => {
                              const groupBlocks = profile.assigned_blocks.filter(b => b.startsWith(group.ktx));
                              if (groupBlocks.length === 0) return null;
                              return (
                                <div key={group.ktx} className="flex flex-wrap items-center gap-1">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${group.color === 'blue' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                                    {group.ktx}:
                                  </span>
                                  {groupBlocks.map(b => (
                                    <span key={b} className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${group.color === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                                      {b.replace(`${group.ktx} - `, '')}
                                    </span>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-xs text-amber-600">Chưa gán dãy</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {profile.created_at ? new Date(profile.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(profile)}
                            title="Sửa tài khoản"
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(profile)}
                            title="Xóa tài khoản"
                            disabled={profile.id === currentUser?.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-bold text-foreground">{editTarget ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}</h2>
              {!editTarget && (
                <p className="text-xs text-muted-foreground mt-0.5">Tài khoản sẽ được tạo trong Supabase Auth và lưu vào bảng profiles.</p>
              )}
            </div>
            <div className="px-6 py-4 flex flex-col gap-4">
              {formError && (
                <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-800">
                  <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Họ và tên *</label>
                <input
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  placeholder="Nguyễn Văn A"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Email *</label>
                <input
                  type="email"
                  disabled={!!editTarget}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60 disabled:cursor-not-allowed"
                  placeholder="email@ktx.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
                {editTarget && <p className="text-xs text-muted-foreground mt-1">Email không thể thay đổi sau khi tạo.</p>}
              </div>
              {!editTarget && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Mật khẩu * <span className="font-normal">(tối thiểu 6 ký tự)</span></label>
                  <input
                    type="password"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                    placeholder="••••••"
                    value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Vai trò</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                >
                  <option value="staff">Staff (Bảo vệ / Quản lý dãy)</option>
                  <option value="admin">Admin (Toàn quyền)</option>
                </select>
              </div>

              {/* Assigned Blocks — grouped by KTX, only for staff */}
              {form.role === 'staff' && (
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-2">
                    Phân quyền theo KTX + Dãy{' '}
                    <span className="font-normal text-muted-foreground">(Staff chỉ Thêm/Sửa/Xóa công nhân ở tổ hợp được gán)</span>
                  </label>
                  <div className="flex flex-col gap-3">
                    {KTX_BLOCK_GROUPS.map(group => {
                      const checkedCount = group.blocks.filter(b => (form.assigned_blocks ?? []).includes(b)).length;
                      const allChecked = checkedCount === group.blocks.length;
                      const someChecked = checkedCount > 0 && !allChecked;
                      return (
                        <div key={group.ktx} className={`border rounded-xl overflow-hidden ${group.color === 'blue' ? 'border-blue-200' : 'border-orange-200'}`}>
                          {/* KTX Group Header with "Select All" checkbox */}
                          <div className={`flex items-center gap-2.5 px-3 py-2.5 ${group.color === 'blue' ? 'bg-blue-50' : 'bg-orange-50'}`}>
                            <input
                              type="checkbox"
                              checked={allChecked}
                              ref={el => { if (el) el.indeterminate = someChecked; }}
                              onChange={() => toggleKtxGroup(group)}
                              className="accent-primary w-4 h-4 cursor-pointer"
                            />
                            <span className={`text-sm font-bold ${group.color === 'blue' ? 'text-blue-700' : 'text-orange-700'}`}>
                              {group.ktx}
                            </span>
                            <span className="text-xs text-muted-foreground ml-auto">
                              {checkedCount}/{group.blocks.length} dãy được chọn
                            </span>
                          </div>
                          {/* Individual block checkboxes */}
                          <div className="grid grid-cols-3 gap-2 p-3">
                            {group.blocks.map(block => {
                              const checked = (form.assigned_blocks ?? []).includes(block);
                              const dayLabel = block.replace(`${group.ktx} - `, '');
                              return (
                                <label
                                  key={block}
                                  className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all text-xs select-none ${
                                    checked
                                      ? group.color === 'blue' ?'bg-blue-100 border-blue-400 text-blue-700 font-semibold' :'bg-orange-100 border-orange-400 text-orange-700 font-semibold' :'bg-background border-border text-muted-foreground hover:border-primary/40'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleBlock(block)}
                                    className="accent-primary w-3.5 h-3.5"
                                  />
                                  {dayLabel}
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {(form.assigned_blocks ?? []).length === 0 && (
                    <p className="text-xs text-amber-600 mt-2">⚠ Chưa gán dãy — Staff này sẽ không thể Thêm/Sửa/Xóa công nhân nào.</p>
                  )}
                  {(form.assigned_blocks ?? []).length > 0 && (
                    <p className="text-xs text-green-700 mt-2">
                      ✓ Đã gán {(form.assigned_blocks ?? []).length} tổ hợp KTX + Dãy
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setShowModal(false)} disabled={submitting} className="btn-secondary text-sm">Hủy</button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="btn-primary text-sm flex items-center gap-2 disabled:opacity-60"
              >
                {submitting && <RefreshCw size={14} className="animate-spin" />}
                {editTarget ? 'Lưu thay đổi' : 'Tạo tài khoản'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="px-6 py-5">
              <h2 className="text-base font-bold text-foreground mb-2">Xác nhận xóa tài khoản</h2>
              <p className="text-sm text-muted-foreground">
                Bạn có chắc muốn xóa tài khoản <span className="font-semibold text-foreground">{deleteTarget.full_name}</span>?
                <br />
                <span className="text-xs text-amber-600 dark:text-amber-400 mt-1 block">Lưu ý: Hành động này chỉ xóa hồ sơ phân quyền, không xóa tài khoản Auth.</span>
              </p>
            </div>
            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary text-sm">Hủy</button>
              <button onClick={handleDelete} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors">
                Xóa tài khoản
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
