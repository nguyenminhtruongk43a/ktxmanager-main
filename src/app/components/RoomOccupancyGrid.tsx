'use client';
import React, { useState, useMemo } from 'react';
import { ROOM_CAPACITY } from '@/data/workers';
import { useWorkers } from '@/context/WorkerContext';
import { Users } from 'lucide-react';
import dynamic from 'next/dynamic';

const RoomDrawer = dynamic(() => import('./RoomDrawer'), { ssr: false });

function getRoomClass(pct: number): string {
  if (pct >= 0.9) return 'room-card-full';
  if (pct >= 0.7) return 'room-card-high';
  if (pct >= 0.4) return 'room-card-medium';
  return 'room-card-low';
}

function getRoomBarColor(pct: number): string {
  if (pct >= 0.9) return 'bg-red-400';
  if (pct >= 0.7) return 'bg-amber-400';
  if (pct >= 0.4) return 'bg-green-400';
  return 'bg-blue-400';
}

/** Group key: KTX + Dãy combination to avoid overlap between KTX 1 and KTX 2 */
interface BuildingGroup {
  ktx: string;
  building: string;
  key: string; // "KTX 1|Dãy 3"
}

export default function RoomOccupancyGrid() {
  const { workers } = useWorkers();
  const [selectedKtx, setSelectedKtx] = useState<string | null>(null);
  const [selectedBuilding, setSelectedBuilding] = useState<string | null>(null);
  const [drawerRoom, setDrawerRoom] = useState<{ ktx: string; building: string; room: string } | null>(null);

  // Build unique KTX list
  const ktxList = useMemo(() => {
    return [...new Set(workers.map(w => w.ktx).filter(Boolean))].sort();
  }, [workers]);

  // Build unique [KTX + Building] groups
  const buildingGroups = useMemo((): BuildingGroup[] => {
    const seen = new Set<string>();
    const groups: BuildingGroup[] = [];
    workers.forEach(w => {
      if (!w.day) return;
      const ktx = w.ktx || '';
      const key = `${ktx}|${w.day}`;
      if (!seen.has(key)) {
        seen.add(key);
        groups.push({ ktx, building: w.day, key });
      }
    });
    return groups.sort((a, b) => {
      const ktxCmp = a.ktx.localeCompare(b.ktx, 'vi');
      if (ktxCmp !== 0) return ktxCmp;
      return a.building.localeCompare(b.building, 'vi');
    });
  }, [workers]);

  // Filter groups by selected KTX and/or building
  const filteredGroups = useMemo(() => {
    return buildingGroups.filter(g => {
      if (selectedKtx && g.ktx !== selectedKtx) return false;
      if (selectedBuilding && g.building !== selectedBuilding) return false;
      return true;
    });
  }, [buildingGroups, selectedKtx, selectedBuilding]);

  // Get unique rooms for a specific KTX+Building combination
  const getRoomsForGroup = (ktx: string, building: string): string[] => {
    const rooms = [...new Set(
      workers
        .filter(w => w.ktx === ktx && w.day === building && w.phongSo)
        .map(w => w.phongSo)
    )];
    return rooms.sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  };

  const drawerWorkers = useMemo(() => {
    if (!drawerRoom) return [];
    return workers.filter(w =>
      w.ktx === drawerRoom.ktx &&
      w.day === drawerRoom.building &&
      w.phongSo === drawerRoom.room
    );
  }, [drawerRoom, workers]);

  // Unique building names for filter buttons (across all KTX)
  const allBuildings = useMemo(() => {
    return [...new Set(buildingGroups.map(g => g.building))].sort();
  }, [buildingGroups]);

  return (
    <>
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-base font-semibold text-foreground">Sơ Đồ Phòng</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Click vào phòng để xem danh sách công nhân</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* KTX filter */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => { setSelectedKtx(null); setSelectedBuilding(null); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedKtx === null ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}
              >Tất cả KTX</button>
              {ktxList.map(ktx => (
                <button
                  key={ktx}
                  onClick={() => { setSelectedKtx(ktx); setSelectedBuilding(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedKtx === ktx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}
                >{ktx}</button>
              ))}
            </div>
            {/* Building filter (only shown when a KTX is selected) */}
            {selectedKtx && allBuildings.length > 1 && (
              <div className="flex items-center gap-1 border-l border-border pl-2">
                <button
                  onClick={() => setSelectedBuilding(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedBuilding === null ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}
                >Tất cả Dãy</button>
                {buildingGroups.filter(g => g.ktx === selectedKtx).map(g => (
                  <button
                    key={g.key}
                    onClick={() => setSelectedBuilding(g.building)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${selectedBuilding === g.building ? 'bg-secondary text-foreground' : 'bg-muted text-muted-foreground hover:bg-secondary'}`}
                  >{g.building}</button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          {filteredGroups.map((group) => {
            const groupWorkers = workers.filter(w => w.ktx === group.ktx && w.day === group.building);
            const rooms = getRoomsForGroup(group.ktx, group.building);
            const totalCapacity = rooms.length * ROOM_CAPACITY;
            const occupancyPct = totalCapacity > 0 ? groupWorkers.length / totalCapacity : 0;

            return (
              <div key={group.key} className="flex-1 min-w-[280px]">
                {/* Building header with KTX badge */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{group.building}</span>
                      {group.ktx && (
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${group.ktx === 'KTX 1' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                          {group.ktx}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{groupWorkers.length}/{totalCapacity} · {Math.round(occupancyPct * 100)}% đầy</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${getRoomBarColor(occupancyPct)}`}
                      style={{ width: `${Math.min(occupancyPct * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {rooms.map((room) => {
                    const count = workers.filter(w => w.ktx === group.ktx && w.day === group.building && w.phongSo === room).length;
                    const pct = count / ROOM_CAPACITY;
                    const roomClass = getRoomClass(pct);
                    const barColor = getRoomBarColor(pct);
                    return (
                      <div
                        key={`room-${group.key}-${room}`}
                        className={`border rounded-lg p-3 cursor-pointer hover:shadow-md transition-all hover:scale-105 ${roomClass}`}
                        onClick={() => setDrawerRoom({ ktx: group.ktx, building: group.building, room })}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-foreground">Phòng {room}</span>
                          <span className="text-xs font-tabular font-semibold text-foreground">{count}/{ROOM_CAPACITY}</span>
                        </div>
                        <div className="w-full h-1.5 bg-white/50 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(pct * 100, 100)}%` }} />
                        </div>
                        <div className="mt-1.5 flex items-center gap-1">
                          <Users size={10} className="text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{Math.round(pct * 100)}% đầy</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-4 pt-3 border-t border-border">
          {[
            { label: '≥ 90% (Đầy)', cls: 'bg-red-300' },
            { label: '70–89% (Cao)', cls: 'bg-amber-300' },
            { label: '40–69% (Trung bình)', cls: 'bg-green-300' },
            { label: '< 40% (Thấp)', cls: 'bg-blue-300' },
          ].map((leg) => (
            <div key={leg.label} className="flex items-center gap-1.5">
              <span className={`w-3 h-3 rounded-sm ${leg.cls}`} />
              <span className="text-xs text-muted-foreground">{leg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Room Drawer */}
      {drawerRoom && (
        <RoomDrawer
          building={`${drawerRoom.ktx ? drawerRoom.ktx + ' · ' : ''}${drawerRoom.building}`}
          room={drawerRoom.room}
          workers={drawerWorkers}
          onClose={() => setDrawerRoom(null)}
        />
      )}
    </>
  );
}