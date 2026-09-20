import { useEffect, useState, useRef } from 'react';
import { PRELOADED_RECOVERY_DATA } from '../data/recoveryBackup';

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
export const DEFAULT_DOOR = { offset: 6.8, reversed: false };
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
  } catch {}
  return separateFurniture(initial);
};

const loadRooms = (userId) => {
  try {
    const rawUser = localStorage.getItem(roomsKey(userId));
    const rawGuest = localStorage.getItem('cloomy_rooms');
    const parsedUser = rawUser ? JSON.parse(rawUser) : null;
    const parsedGuest = rawGuest ? JSON.parse(rawGuest) : null;

    // 게스트 방 목록에 더 많은 방이 있으면 게스트 방 목록 우선 복원
    let source =
      Array.isArray(parsedGuest) && parsedGuest.length > (parsedUser?.length || 0)
        ? parsedGuest
        : Array.isArray(parsedUser) && parsedUser.length > 0
        ? parsedUser
        : parsedGuest;

    // 만약 방이 1개뿐이고 신발장/서브책장 등 커스텀 가구가 없는 초기 상태라면 백업 데이터 복원
    const hasCustomFurniture =
      Array.isArray(source) &&
      source.some(r => (r.furniture || []).some(f => f.id === 'shelf-sub' || f.name === '서브 책장' || f.name === '신발장 옆 공간'));

    if ((!source || source.length <= 1 || !hasCustomFurniture) && PRELOADED_RECOVERY_DATA?.rooms?.length > 0) {
      source = PRELOADED_RECOVERY_DATA.rooms;
      try {
        localStorage.setItem(roomsKey(userId), JSON.stringify(source));
        localStorage.setItem('cloomy_rooms', JSON.stringify(source));
      } catch {}
    }

    if (Array.isArray(source) && source.length > 0) {
      return source.map((r, i) => ({
        id: r.id || `room-${i + 1}`,
        name: r.name || (i === 0 ? '내 방' : `방 ${i + 1}`),
        furniture: Array.isArray(r.furniture) ? separateFurniture(r.furniture) : (i === 0 ? separateFurniture(initial) : []),
        door: r.door || DEFAULT_DOOR,
      }));
    }
  } catch {}

  const legacyFurniture = loadLegacyFurniture(userId);
  const defaultRooms = [
    {
      id: 'room-1',
      name: '내 방',
      furniture: legacyFurniture,
      door: DEFAULT_DOOR,
    }
  ];
  try {
    localStorage.setItem(roomsKey(userId), JSON.stringify(defaultRooms));
  } catch {}
  return defaultRooms;
};

export function useRoom(userId) {
  const [rooms, setRooms] = useState(() => loadRooms(userId));
  const [activeRoomId, setActiveRoomIdState] = useState(() => {
    const saved = localStorage.getItem(activeRoomKey(userId));
    if (saved && rooms.some(r => r.id === saved)) return saved;
    return rooms[0]?.id || 'room-1';
  });
  const [saveError, setSaveError] = useState('');
  const prevUserId = useRef(userId);

  useEffect(() => {
    if (prevUserId.current !== userId) {
      prevUserId.current = userId;
      const loaded = loadRooms(userId);
      setRooms(loaded);
      const saved = localStorage.getItem(activeRoomKey(userId));
      if (saved && loaded.some(r => r.id === saved)) {
        setActiveRoomIdState(saved);
      } else {
        setActiveRoomIdState(loaded[0]?.id || 'room-1');
      }
    }
  }, [userId]);

  const activeRoom = rooms.find(r => r.id === activeRoomId) || rooms[0] || {
    id: 'room-1',
    name: '내 방',
    furniture: separateFurniture(initial),
    door: DEFAULT_DOOR,
  };

  const furniture = activeRoom.furniture || [];

  useEffect(() => {
    try {
      localStorage.setItem(roomsKey(userId), JSON.stringify(rooms));
      localStorage.setItem(activeRoomKey(userId), activeRoom.id);
      localStorage.setItem(legacyRoomKey(userId), JSON.stringify(furniture));
      setSaveError('');
    } catch {
      setSaveError('방 배치를 저장하지 못했어요. 브라우저 저장 공간을 확인해주세요.');
    }
  }, [rooms, activeRoom.id, furniture, userId]);

  const setFurniture = (action) => {
    setRooms(prevRooms => {
      return prevRooms.map(r => {
        if (r.id === activeRoom.id) {
          const nextFurn = typeof action === 'function' ? action(r.furniture || []) : action;
          return { ...r, furniture: nextFurn };
        }
        return r;
      });
    });
  };

  const updateRoomFurniture = (roomId, action) => {
    setRooms(prevRooms => {
      return prevRooms.map(r => {
        if (r.id === roomId) {
          const nextFurn = typeof action === 'function' ? action(r.furniture || []) : action;
          return { ...r, furniture: nextFurn };
        }
        return r;
      });
    });
  };

  const setActiveRoomId = (id) => {
    setActiveRoomIdState(id);
    try { localStorage.setItem(activeRoomKey(userId), id); } catch {}
  };

  const addRoom = (name) => {
    const trimmed = (name || '').trim();
    const newRoomName = trimmed || `방 ${rooms.length + 1}`;
    const newId = `room-${Date.now()}`;
    const newRoom = {
      id: newId,
      name: newRoomName,
      furniture: [],
      door: DEFAULT_DOOR,
    };
    const nextRooms = [...rooms, newRoom];
    setRooms(nextRooms);
    setActiveRoomIdState(newId);
    try {
      localStorage.setItem(roomsKey(userId), JSON.stringify(nextRooms));
      localStorage.setItem(activeRoomKey(userId), newId);
    } catch {}
    return newRoom;
  };

  const renameRoom = (roomId, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed) return;
    setRooms(prev => prev.map(r => r.id === roomId ? { ...r, name: trimmed } : r));
  };

  const deleteRoom = (roomId) => {
    if (rooms.length <= 1) return false;
    const nextRooms = rooms.filter(r => r.id !== roomId);
    setRooms(nextRooms);
    if (activeRoomId === roomId) {
      setActiveRoomIdState(nextRooms[0].id);
    }
    return true;
  };

  return {
    rooms,
    setRooms,
    activeRoomId: activeRoom.id,
    activeRoom,
    setActiveRoomId,
    addRoom,
    renameRoom,
    deleteRoom,
    furniture,
    setFurniture,
    updateRoomFurniture,
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

