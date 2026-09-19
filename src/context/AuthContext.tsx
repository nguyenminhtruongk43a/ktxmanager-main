'use client';
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

export type UserRole = 'admin' | 'staff';

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  status: 'active' | 'inactive';
  assignedBlocks: string[];
}

interface AuthContextValue {
  currentUser: AppUser | null;
  isAdmin: boolean;
  isStaff: boolean;
  /** Can delete a single worker (admin + staff) */
  canDeleteSingle: boolean;
  /** Can bulk delete multiple workers (admin only) */
  canBulkDelete: boolean;
  /** Can delete all workers (admin only) */
  canDeleteAll: boolean;
  /** Legacy alias for canDeleteSingle */
  canDelete: boolean;
  canManageAccounts: boolean;
  canConfigKTX: boolean;
  /** Supabase session loading state */
  loading: boolean;
  /** Check if staff can write to a specific block */
  canWriteBlock: (blockName: string, ktxName?: string) => boolean;
  /** Supabase sign in */
  signIn: (email: string, password: string) => Promise<void>;
  /** Supabase sign out */
  signOut: () => Promise<void>;
  // Legacy user management (kept for UserManagementClient compatibility)
  isManager: boolean;
  users: AppUser[];
  addUser: (user: Omit<AppUser, 'id'>) => void;
  updateUser: (id: string, updates: Partial<AppUser>) => void;
  deleteUser: (id: string) => void;
  toggleUserStatus: (id: string) => void;
  updateProfile: (updates: { name?: string; email?: string }) => void;
  setCurrentUser: (user: AppUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<AppUser[]>([]);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email ?? '');
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadUserProfile(session.user.id, session.user.email ?? '');
      } else {
        setCurrentUserState(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role, assigned_blocks')
        .eq('id', userId)
        .single();

      if (error || !data) {
        const { data: newProfile } = await supabase
          .from('profiles')
          .insert({ id: userId, email, full_name: email.split('@')[0], role: 'staff', assigned_blocks: [] })
          .select()
          .single();

        if (newProfile) {
          setCurrentUserState({
            id: newProfile.id,
            email: newProfile.email ?? email,
            name: newProfile.full_name ?? email.split('@')[0],
            role: (newProfile.role as UserRole) ?? 'staff',
            status: 'active',
            assignedBlocks: newProfile.assigned_blocks ?? [],
          });
        }
      } else {
        setCurrentUserState({
          id: data.id,
          email: data.email ?? email,
          name: data.full_name ?? email.split('@')[0],
          role: (data.role as UserRole) ?? 'staff',
          status: 'active',
          assignedBlocks: data.assigned_blocks ?? [],
        });
      }
    } catch {
      setCurrentUserState({
        id: userId,
        email,
        name: email.split('@')[0],
        role: 'staff',
        status: 'active',
        assignedBlocks: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, [supabase]);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setCurrentUserState(null);
  }, [supabase]);

  const isAdmin = currentUser?.role === 'admin';
  const isStaff = currentUser?.role === 'staff';
  const isManager = false;

  const canDeleteSingle = isAdmin || isStaff;
  const canBulkDelete = isAdmin;
  const canDeleteAll = isAdmin;
  const canManageAccounts = isAdmin;
  const canConfigKTX = isAdmin;

  /**
   * Returns true if the current user can write (add/edit/delete) workers in the given KTX + block combination.
   * Admin can write to all blocks. Staff can only write to their assigned KTX+Block combinations.
   * assignedBlocks stores entries like "KTX 1 - Dãy 1", "KTX 2 - Dãy 3", etc.
   */
  const canWriteBlock = useCallback((blockName: string, ktxName?: string): boolean => {
    if (isAdmin) return true;
    if (!currentUser) return false;
    const assigned = currentUser.assignedBlocks ?? [];
    if (assigned.length === 0) return false;

    // If ktxName is provided, check the combined "KTX X - Dãy Y" format
    if (ktxName) {
      const combined = `${ktxName.trim()} - ${blockName.trim()}`;
      return assigned.some(b => b.trim().toLowerCase() === combined.toLowerCase());
    }

    // Fallback: check if blockName matches any assigned block (supports both old "Dãy X" and new "KTX X - Dãy Y" formats)
    return assigned.some(b => {
      const bLower = b.trim().toLowerCase();
      const nameLower = blockName.trim().toLowerCase();
      // Exact match (old format "Dãy 1" or new format "KTX 1 - Dãy 1")
      if (bLower === nameLower) return true;
      // New format: check if the block part after " - " matches
      const parts = b.split(' - ');
      if (parts.length === 2 && parts[1].trim().toLowerCase() === nameLower) return true;
      return false;
    });
  }, [isAdmin, currentUser]);

  const addUser = useCallback((_user: Omit<AppUser, 'id'>) => {}, []);
  const updateUser = useCallback((_id: string, _updates: Partial<AppUser>) => {}, []);
  const deleteUser = useCallback((_id: string) => {}, []);
  const toggleUserStatus = useCallback((_id: string) => {}, []);
  const updateProfile = useCallback((_updates: { name?: string; email?: string }) => {}, []);
  const setCurrentUser = useCallback((user: AppUser) => { setCurrentUserState(user); }, []);

  return (
    <AuthContext.Provider value={{
      currentUser,
      isAdmin,
      isStaff,
      isManager,
      canDeleteSingle,
      canBulkDelete,
      canDeleteAll,
      canDelete: canDeleteSingle,
      canManageAccounts,
      canConfigKTX,
      loading,
      canWriteBlock,
      signIn,
      signOut,
      users,
      addUser,
      updateUser,
      deleteUser,
      toggleUserStatus,
      updateProfile,
      setCurrentUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
