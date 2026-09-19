import { useEffect, useState, useRef } from 'react';
import {
  isFirebaseConfigured,
  saveRoomsToCloud,
  loadRoomsFromCloud,
  subscribeRoomsCloud,
} from '../services/firebase';

export const FURNITURE = {
  drawers: { label: '서랍장', w: 2.2, d: 1.3, h: 1.5, color: '#c99c7a', slots: 3, configurableSlots: true },
  shelf: { label: '책장', w: 2, d: 1, h: 4.2, color: '#91aaa0', slots: 4, configurableSlots: true },
  desk: { label: '책상', w: 2.8, d: 1.5, h: 1.5, color: '#dfbc91', slots: 0, configurableSlots: true },
  bed: { label: '침대', w: 2.4, d: 3.8, h: .7, color: '#c3bdcf', slots: 1 },
  wardrobe: { label: '옷장', w: 2.4, d: 1.2, h: 4.6, color: '#b7a4ba', slots: 3, configurableSlots: true },
  organizer: { label: '정리함', w: 1.7, d: 1.1, h: 1.3, color: '#d8ae76', slots: 2, configurableSlots: true },
};
export const FLOOR_LOCATION = '바닥 보관';
const ROOM_SIZE = 12;
const GRID_SIZE = .25;
// 변끼리 맞닿는 것은 허용하되, 면적이 겹치는 배치만 막습니다.
const GAP = 0;
const initial = [
  { id: 'drawers-1', type: 'drawers', name: '서랍장', x: 6, y: .5, rotated: false },
  { id: 'shelf-1', type: 'shelf', name: '책장', x: .5, y: .5, rotated: false },
  { id: 'bed-1', type: 'bed', name: '침대', x: .5, y: 4, rotated: false },
  { id: 'desk-1', type: 'desk', name: '책상', x: 6, y: 6, rotated: false },
  { id: 'wardrobe-1', type: 'wardrobe', name: '옷장', x: 7.1, y: 3.7, rotated: false },
  { id: 'organizer-1', type: 'organizer', name: '정리함', x: 4.1, y: 7.8, rotated: false },
];
export const slotName = (f, index) => `${f.name} · ${index + 1}번째 칸`;
export const slotCount = f => Number.isInteger(f.slots) ? f.slots : FURNITURE[f.type].slots;
export const dimensions = f => {
  const { w, d, h } = FURNITURE[f.type];
  const sizeLevel = Number.isInteger(f.sizeLevel) ? f.sizeLevel : Math.round(((f.scale || 1) - 1) * 10);
  const baseW = Math.round((f.rotated ? d : w) / GRID_SIZE) * GRID_SIZE;
  const baseD = Math.round((f.rotated ? w : d) / GRID_SIZE) * GRID_SIZE;
  const override = f.stackedSize || f.customSize;
  return { w: override ? (f.rotated ? override.d : override.w) : Math.max(GRID_SIZE, baseW + sizeLevel * GRID_SIZE), d: override ? (f.rotated ? override.w : override.d) : Math.max(GRID_SIZE, baseD + sizeLevel * GRID_SIZE), h: Math.max(.25, h + sizeLevel * .08) };
};
const overlaps = (a, b) => a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.d + GAP && a.y + a.d + GAP > b.y;
const keepInside = furniture => {
  const size = dimensions(furniture);
  const snap = (value, max) => Math.max(0, Math.min(max, Number((Math.round(value / GRID_SIZE) * GRID_SIZE).toFixed(2))));
  return { ...furniture, x: snap(furniture.x, ROOM_SIZE - size.w), y: snap(furniture.y, ROOM_SIZE - size.d), z: 0 };
};
const separateFurniture = list => {
  const sorted = [...list].sort((a, b) => (a.stackedOn ? 1 : 0) - (b.stackedOn ? 1 : 0));
  return sorted.reduce((placed, furniture) => {
    const parent = furniture.stackedOn && placed.find(other => other.id === furniture.stackedOn);
    if (parent) {
      // 위에 쌓인 가구는 부모 가구의 (x, y) 위치와 크기를 그대로 따름
      return [...placed, { ...furniture, x: parent.x, y: parent.y, z: 0 }];
    }
    const desired = keepInside(furniture);
    const desiredBox = { ...desired, ...dimensions(desired) };
    if (!placed.some(other => overlaps(desiredBox, { ...other, ...dimensions(other) }))) return [...placed, desired];
  const size = dimensions(desired);
  for (let y = 0; y <= ROOM_SIZE - size.d; y += GRID_SIZE) {
    for (let x = 0; x <= ROOM_SIZE - size.w; x += GRID_SIZE) {
      const candidate = { ...desired, x, y, ...size };
      if (!placed.some(other => overlaps(candidate, { ...other, ...dimensions(other) }))) return [...placed, { ...desired, x, y }];
    }
  }
    return [...placed, desired];
  }, []);
};
export const findOpenPosition = (type, currentFurniture) => {
  const template = { type, x: 0, y: 0, rotated: false };
  const size = dimensions(template);
  for (let y = 0; y <= ROOM_SIZE - size.d; y += GRID_SIZE) {
    for (let x = 0; x <= ROOM_SIZE - size.w; x += GRID_SIZE) {
      const candidate = { x, y, ...size };
      if (!currentFurniture.some(other => overlaps(candidate, { ...other, ...dimensions(other) }))) return { x, y };
    }
  }
  return null;
};
export const DEFAULT_DOOR = { offset: 3, reversed: false };
export const ROOM_PRESETS = ['내 방', '거실', '침실', '서재', '드레스룸', '주방', '아이방'];

const roomsKey = (userId) => {
  if (!userId || userId === 'guest') return 'cloomy_rooms';
  return `cloomy_rooms_${userId}`;
};

const activeRoomKey = (userId) => {
  if (!userId || userId === 'guest') return 'cloomy_active_room_id';
  return `cloomy_active_room_id_${userId}`;
};

const legacyRoomKey = (userId) => {
  if (!userId || userId === 'guest') return 'cloomy_room';
  return `cloomy_room_${userId}`;
};

const loadLegacyFurniture = (userId) => {
  try {
    const saved = JSON.parse(localStorage.getItem(legacyRoomKey(userId)));
    const insideRoomOnly = Array.isArray(saved) ? saved.filter(f => f.type !== 'shoeCabinet' && f.type !== 'floorStorage' && f.type !== 'vanity') : saved;
    if (Array.isArray(insideRoomOnly) && insideRoomOnly.every(f => FURNITURE[f.type] && typeof f.id === 'string' && typeof f.name === 'string' && Number.isFinite(f.x) && Number.isFinite(f.y))) {
      const migrated = insideRoomOnly.map(f => {
        if (f.type === 'shelf' && f.slots === 3) return { ...f, slots: 4 };
        if (f.type === 'wardrobe' && f.slots === 2) return { ...f, slots: 3 };
        return f;
      });
      return separateFurniture(migrated);
    }
  } catch { /* Fallback */ }
  return separateFurniture(initial);
};

const loadLegacyDoor = () => {
  try {
    const saved = JSON.parse(localStorage.getItem('cloomy_door'));
    if (Number.isFinite(saved?.offset) && typeof saved.reversed === 'boolean') {
      return { offset: Math.max(.6, Math.min(ROOM_SIZE - 2.4 - .6, saved.offset)), reversed: saved.reversed };
    }
  } catch { /* Fallback */ }
  return DEFAULT_DOOR;
};

const sanitizeRoom = (room, index) => {
  const id = room.id || `room-${index + 1}`;
  const name = typeof room.name === 'string' && room.name.trim() ? room.name.trim() : (index === 0 ? '내 방' : `방 ${index + 1}`);
  const rawFurn = Array.isArray(room.furniture) ? room.furniture : [];
  const validFurn = rawFurn.filter(f => FURNITURE[f.type] && typeof f.id === 'string' && typeof f.name === 'string' && Number.isFinite(f.x) && Number.isFinite(f.y));
  const furniture = separateFurniture(validFurn.length > 0 ? validFurn : (index === 0 ? initial : []));
  const door = room.door && Number.isFinite(room.door.offset) ? room.door : DEFAULT_DOOR;
  return {
    id,
    name,
    furniture,
    door,
    createdAt: room.createdAt || new Date().toISOString(),
  };
};

const loadRooms = (userId) => {
  try {
    const raw = localStorage.getItem(roomsKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((r, i) => sanitizeRoom(r, i));
      }
    }
  } catch { /* Try migration from legacy */ }

  // 마이그레이션: 기존 단일 방 데이터가 있는 경우 첫 번째 방으로 변환
  const legacyFurn = loadLegacyFurniture(userId);
  const legacyDoor = loadLegacyDoor();
  const defaultRooms = [
    {
      id: 'room-1',
      name: '내 방',
      furniture: legacyFurn,
      door: legacyDoor,
      createdAt: new Date().toISOString(),
    }
  ];

  try {
    localStorage.setItem(roomsKey(userId), JSON.stringify(defaultRooms));
  } catch { /* Ignore */ }

  return defaultRooms;
};

export function useRoom(userId) {
  const [rooms, setRooms] = useState(() => loadRooms(userId));
  const [activeRoomId, setActiveRoomIdState] = useState(() => {
    const savedId = localStorage.getItem(activeRoomKey(userId));
    if (savedId && rooms.some(r => r.id === savedId)) return savedId;
    return rooms[0]?.id || 'room-1';
  });
  const [saveError, setSaveError] = useState('');
  const prevUserId = useRef(userId);
  const cloudDebounceRef = useRef(null);
  const isSyncingFromCloudRef = useRef(false);

  // userId 변경 시 해당 사용자의 방 목록 로드 및 클라우드 동기화
  useEffect(() => {
    if (prevUserId.current !== userId) {
      prevUserId.current = userId;
      const loaded = loadRooms(userId);
      setRooms(loaded);
      const savedId = localStorage.getItem(activeRoomKey(userId));
      if (savedId && loaded.some(r => r.id === savedId)) {
        setActiveRoomIdState(savedId);
      } else {
        setActiveRoomIdState(loaded[0]?.id || 'room-1');
      }
    }

    if (!isFirebaseConfigured || !userId || userId === 'guest') {
      return;
    }

    let isMounted = true;

    // 1) 클라우드 방 데이터 확인 및 마이그레이션
    loadRoomsFromCloud(userId).then((cloudData) => {
      if (!isMounted) return;
      if (cloudData && Array.isArray(cloudData.rooms) && cloudData.rooms.length > 0) {
        isSyncingFromCloudRef.current = true;
        setRooms(cloudData.rooms);
        if (cloudData.activeRoomId) {
          setActiveRoomIdState(cloudData.activeRoomId);
        }
        try {
          localStorage.setItem(roomsKey(userId), JSON.stringify(cloudData.rooms));
          if (cloudData.activeRoomId) {
            localStorage.setItem(activeRoomKey(userId), cloudData.activeRoomId);
          }
        } catch {}
        setTimeout(() => {
          isSyncingFromCloudRef.current = false;
        }, 300);
      } else {
        // 클라우드에 데이터가 없으면 현재 로컬 방 데이터를 클라우드에 최초 백업
        const local = loadRooms(userId);
        if (local.length > 0) {
          saveRoomsToCloud(userId, local, local[0]?.id || 'room-1');
        }
      }
    });

    // 2) 실시간 클라우드 동기화 구독
    const unsubscribe = subscribeRoomsCloud(userId, ({ rooms: cloudRooms, activeRoomId: cloudActiveId }) => {
      if (!isMounted) return;
      isSyncingFromCloudRef.current = true;
      setRooms(cloudRooms);
      if (cloudActiveId) {
        setActiveRoomIdState(cloudActiveId);
      }
      try {
        localStorage.setItem(roomsKey(userId), JSON.stringify(cloudRooms));
        if (cloudActiveId) {
          localStorage.setItem(activeRoomKey(userId), cloudActiveId);
        }
      } catch {}
      setTimeout(() => {
        isSyncingFromCloudRef.current = false;
      }, 300);
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [userId]);

  // 활성 방이 유효한지 확인하고 없으면 첫 번째 방으로 보정
  useEffect(() => {
    if (!rooms.some(r => r.id === activeRoomId)) {
      const fallbackId = rooms[0]?.id || 'room-1';
      setActiveRoomIdState(fallbackId);
      try { localStorage.setItem(activeRoomKey(userId), fallbackId); } catch {}
    }
  }, [rooms, activeRoomId, userId]);

  // 활성 방 변경 시 localStorage에 저장
  const setActiveRoomId = (id) => {
    setActiveRoomIdState(id);
    try { localStorage.setItem(activeRoomKey(userId), id); } catch {}
  };

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0] || {
    id: 'room-1',
    name: '내 방',
    furniture: [],
    door: DEFAULT_DOOR,
  };

  const furniture = activeRoom.furniture;
  const door = activeRoom.door || DEFAULT_DOOR;

  // 방 목록 저장 (영구 로컬 동기화 + 하위 호환 미러링 + 클라우드 디바운스 백업)
  useEffect(() => {
    try {
      localStorage.setItem(roomsKey(userId), JSON.stringify(rooms));
      if (activeRoom && activeRoom.furniture) {
        localStorage.setItem(legacyRoomKey(userId), JSON.stringify(activeRoom.furniture));
      }
      setSaveError('');
    } catch {
      setSaveError('방 배치를 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.');
    }

    if (!isSyncingFromCloudRef.current && isFirebaseConfigured && userId && userId !== 'guest') {
      if (cloudDebounceRef.current) clearTimeout(cloudDebounceRef.current);
      cloudDebounceRef.current = setTimeout(() => {
        saveRoomsToCloud(userId, rooms, activeRoomId);
      }, 600);
    }
    return () => {
      if (cloudDebounceRef.current) clearTimeout(cloudDebounceRef.current);
    };
  }, [rooms, activeRoom, activeRoomId, userId]);

  // 현재 활성 방의 가구 업데이트
  const setFurniture = (updater) => {
    setRooms(prevRooms => {
      return prevRooms.map(r => {
        if (r.id === activeRoomId) {
          const nextFurniture = typeof updater === 'function' ? updater(r.furniture) : updater;
          return { ...r, furniture: nextFurniture };
        }
        return r;
      });
    });
  };

  // 현재 활성 방의 방문 설정 업데이트
  const setDoor = (updater) => {
    setRooms(prevRooms => {
      return prevRooms.map(r => {
        if (r.id === activeRoomId) {
          const nextDoor = typeof updater === 'function' ? updater(r.door || DEFAULT_DOOR) : updater;
          return { ...r, door: nextDoor };
        }
        return r;
      });
    });
  };

  // 새 방 추가
  const addRoom = (name, starterTemplate = 'starter') => {
    const trimmedName = (name || '').trim();
    let finalName = trimmedName;
    if (!finalName) {
      let counter = 1;
      while (rooms.some(r => r.name === `새 방 ${counter}`)) counter++;
      finalName = `새 방 ${counter}`;
    }

    const newId = `room-${Date.now()}`;
    let starterFurniture = [];
    if (starterTemplate === 'starter') {
      starterFurniture = separateFurniture([
        { id: `drawers-${Date.now()}`, type: 'drawers', name: '서랍장', x: 6, y: .5, rotated: false },
        { id: `shelf-${Date.now()}`, type: 'shelf', name: '책장', x: .5, y: .5, rotated: false },
        { id: `organizer-${Date.now()}`, type: 'organizer', name: '정리함', x: 4.1, y: 7.8, rotated: false },
      ]);
    }

    const newRoom = {
      id: newId,
      name: finalName,
      furniture: starterFurniture,
      door: DEFAULT_DOOR,
      createdAt: new Date().toISOString(),
    };

    setRooms(prev => [...prev, newRoom]);
    setActiveRoomId(newId);
    return newRoom;
  };

  // 방 이름 변경
  const renameRoom = (roomId, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) return;
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name: trimmed } : r));
  };

  // 방 삭제 (최소 1개의 방은 항상 보존)
  const deleteRoom = (roomId) => {
    if (rooms.length <= 1) return false;
    setRooms(prev => {
      const remaining = prev.filter(r => r.id !== roomId);
      if (activeRoomId === roomId) {
        const nextActive = remaining[0]?.id || 'room-1';
        setActiveRoomId(nextActive);
      }
      return remaining;
    });
    return true;
  };

  // 특정 방의 가구 직접 업데이트 (예: 스캔 등록 시 지정한 방에 가구 추가 등)
  const updateRoomFurniture = (roomId, updater) => {
    setRooms(prevRooms => {
      return prevRooms.map(r => {
        if (r.id === roomId) {
          const nextFurniture = typeof updater === 'function' ? updater(r.furniture) : updater;
          return { ...r, furniture: nextFurniture };
        }
        return r;
      });
    });
  };

  // 특정 방의 위치 목록 반환
  const getRoomLocations = (roomId) => {
    const target = rooms.find(r => r.id === roomId);
    if (!target) return [FLOOR_LOCATION];
    return [
      FLOOR_LOCATION,
      ...target.furniture.flatMap(f => {
        const count = slotCount(f);
        const slots = Array.from({ length: count }, (_, i) => slotName(f, i));
        return [f.name, ...slots];
      })
    ];
  };

  return {
    rooms,
    setRooms,
    activeRoomId,
    setActiveRoomId,
    activeRoom,
    furniture,
    setFurniture,
    door,
    setDoor,
    addRoom,
    renameRoom,
    deleteRoom,
    updateRoomFurniture,
    getRoomLocations,
    saveError,
    locations: [
      FLOOR_LOCATION,
      ...furniture.flatMap(f => {
        const count = slotCount(f);
        const slots = Array.from({ length: count }, (_, i) => slotName(f, i));
        return [f.name, ...slots];
      })
    ]
  };
}

