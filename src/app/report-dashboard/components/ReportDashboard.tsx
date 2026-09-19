'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Users, LayoutGrid, Percent, AlertCircle } from 'lucide-react';

export default function ReportDashboard() {
  const [stats, setStats] = useState({
    total: 0,
    male: 0,
    female: 0,
    xd: 0,
    me: 0,
    vinalpha: 0,
    otherUnit: 0,
    ktx1: 0,
    ktx2: 0,
    loading: true,
  });

  useEffect(() => {
    async function loadRealDataFromSupabase() {
      const supabase = createClient();

      try {
        // Thực hiện các query đếm song song trực tiếp trên Supabase Engine
        const [
          totalRes,
          maleRes,
          femaleRes,
          xdRes,
          meRes,
          vinalphaRes,
          ktx1Res,
          ktx2Res
        ] = await Promise.all([
          // 1. Tổng công nhân
          supabase.from('workers').select('*', { count: 'exact', head: true }),
          // 2. Nam
          supabase.from('workers').select('*', { count: 'exact', head: true }).ilike('gioi_tinh', '%nam%'),
          // 3. Nữ
          supabase.from('workers').select('*', { count: 'exact', head: true }).or('gioi_tinh.ilike.%nữ%,gioi_tinh.ilike.%nu%'),
          // 4. Đơn vị XD
          supabase.from('workers').select('*', { count: 'exact', head: true }).or('don_vi.ilike.%xd%,don_vi.ilike.%xây%,don_vi.ilike.%xay%'),
          // 5. Đơn vị ME
          supabase.from('workers').select('*', { count: 'exact', head: true }).or('don_vi.ilike.%me%,don_vi.ilike.%cơ%,don_vi.ilike.%co%'),
          // 6. Đơn vị Vinalpha
          supabase.from('workers').select('*', { count: 'exact', head: true }).or('don_vi.ilike.%vinalpha%,don_vi.ilike.%alpha%'),
          // 7. KTX 1
          supabase.from('workers').select('*', { count: 'exact', head: true }).ilike('ktx', '%1%'),
          // 8. KTX 2
          supabase.from('workers').select('*', { count: 'exact', head: true }).ilike('ktx', '%2%'),
        ]);

        const totalCount = totalRes.count || 0;
        const xdCount = xdRes.count || 0;
        const meCount = meRes.count || 0;
        const vinalphaCount = vinalphaRes.count || 0;

        setStats({
          total: totalCount,
          male: maleRes.count || 0,
          female: femaleRes.count || 0,
          xd: xdCount,
          me: meCount,
          vinalpha: vinalphaCount,
          otherUnit: Math.max(0, totalCount - (xdCount + meCount + vinalphaCount)),
          ktx1: ktx1Res.count || 0,
          ktx2: ktx2Res.count || 0,
          loading: false,
        });
      } catch (err) {
        console.error("Lỗi đồng bộ dữ liệu Supabase:", err);
        setStats(prev => ({ ...prev, loading: false }));
      }
    }

    loadRealDataFromSupabase();
  }, []);

  if (stats.loading) {
    return (
      <div className="p-12 text-center text-gray-500 font-medium animate-pulse">
        Đang đồng bộ dữ liệu thực tế từ Supabase Database...
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Khối KPI Tổng Quan */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">CÔNG NHÂN</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">{stats.total.toLocaleString()}</h3>
            <p className="text-xs text-gray-500 mt-1">2 ký túc xá • 11 dãy</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">SỐ DÃY / SỐ PHÒNG</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">11 dãy / 127 phòng</h3>
            <p className="text-xs text-gray-500 mt-1">Sức chứa: 2540 chỗ</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
            <LayoutGrid className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">TỶ LỆ LẤP ĐẦY</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">
              {stats.total > 0 ? Math.round((stats.total / 2540) * 100) : 0}%
            </h3>
            <p className="text-xs text-gray-500 mt-1">{stats.total}/2540 chỗ đã dùng</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
            <Percent className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-xl border p-5 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">THIẾU DỮ LIỆU</p>
            <h3 className="text-3xl font-extrabold text-gray-900 mt-1">0</h3>
            <p className="text-xs text-gray-500 mt-1">Click để gán phòng ngay</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Khối Báo Cáo Thống Kê Chi Tiết */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Thống kê giới tính */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>♂♀</span> Thống kê giới tính
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50/60 border border-blue-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-blue-600 block mb-1">Nam</span>
              <span className="text-2xl font-black text-blue-700">{stats.male}</span>
            </div>
            <div className="bg-pink-50/60 border border-pink-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-pink-600 block mb-1">Nữ</span>
              <span className="text-2xl font-black text-pink-700">{stats.female}</span>
            </div>
          </div>
        </div>

        {/* Thống kê Đơn vị / Nhà thầu */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>🏗️</span> Đơn vị / Nhà thầu
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">XD</span>
              <span className="text-lg font-black text-amber-700">{stats.xd}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">ME</span>
              <span className="text-lg font-black text-amber-700">{stats.me}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">Vinalpha</span>
              <span className="text-lg font-black text-amber-700">{stats.vinalpha}</span>
            </div>
            <div className="bg-amber-50/60 border border-amber-100 p-3 rounded-xl flex justify-between items-center">
              <span className="text-xs font-bold text-gray-600">Khác</span>
              <span className="text-lg font-black text-amber-700">{stats.otherUnit}</span>
            </div>
          </div>
        </div>

        {/* Phân bổ Khu KTX */}
        <div className="bg-white rounded-xl border p-5 shadow-sm">
          <h4 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <span>🏢</span> Phân bổ theo Khu KTX
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-purple-50/60 border border-purple-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-purple-600 block mb-1">KTX 1</span>
              <span className="text-2xl font-black text-purple-700">{stats.ktx1}</span>
              <span className="text-[10px] text-gray-400 block mt-1">công nhân</span>
            </div>
            <div className="bg-purple-50/60 border border-purple-100 p-4 rounded-xl">
              <span className="text-xs font-bold text-purple-600 block mb-1">KTX 2</span>
              <span className="text-2xl font-black text-purple-700">{stats.ktx2}</span>
              <span className="text-[10px] text-gray-400 block mt-1">công nhân</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}