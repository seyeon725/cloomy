import { useEffect, useMemo, useRef, useState } from 'react';
import { dimensions, findOpenPosition, FLOOR_LOCATION, FURNITURE, slotCount, slotName } from '../hooks/useRoom';
import FurnitureDeleteModal from '../components/FurnitureDeleteModal';
import MoveItemsModal from '../components/MoveItemsModal';
import UnplacedItemsModal from '../components/UnplacedItemsModal';
import PlacedSummaryModal from '../components/PlacedSummaryModal';
import './RoomPage.css';

const point = (x, y, z = 0) => [350 + (x - y) * 29, 148 + (x + y) * 15 - z * 34];
const points = vertices => vertices.map(v => point(...v).join(',')).join(' ');
const ROOM_SIZE = 12;
const SVG_HEIGHT = 560;
const GRID_SIZE = .25;
const DOOR_WIDTH = 2.35;
const DEFAULT_DOOR = { offset: 6.8, reversed: false };
const DOOR_ID = 'room-door';
const FLOOR_STORAGE = { id: 'floor-storage', type: 'floorStorage', name: '바닥 보관', slots: 1 };
const configFor = furniture => furniture.type === 'floorStorage' ? { label: '바닥 보관', slots: 1 } : FURNITURE[furniture.type];
const locationFor = (furniture, index) => furniture.type === 'floorStorage' ? FLOOR_LOCATION : slotName(furniture, index);
const CATEGORY_EMOJIS = {
  '책': '📚',
  '의류': '👕',
  '전자기기': '📱',
  '식기': '🍽️',
  '문구': '✏️',
  '화장품': '💄',
  '장식품': '🎨',
  '식품': '🍎',
  '잡화': '📦',
  '기타': '🔹',
};
const getCategoryIcon = (item) => {
  if (!item) return '📦';
  return CATEGORY_EMOJIS[item.category] || item.emoji || '📦';
};
// 가구의 변을 딱 맞춰 붙일 수 있고, 실제로 겹칠 때만 이동을 막습니다.
const GAP = 0;
const SNAP_DISTANCE = .3;
const overlaps = (a, b) => a.x < b.x + b.w + GAP && a.x + a.w + GAP > b.x && a.y < b.y + b.d + GAP && a.y + a.d + GAP > b.y;
const closestSnap = (value, targets) => targets.reduce((best, target) => Math.abs(target - value) < Math.abs(best - value) ? target : best, value);
const constrainToRoom = (furniture, size) => {
  const maxX = ROOM_SIZE - size.w;
  const maxY = ROOM_SIZE - size.d;
  const snap = (value, max) => Math.max(0, Math.min(max, Number((Math.round(value / GRID_SIZE) * GRID_SIZE).toFixed(2))));
  const x = snap(furniture.x, maxX);
  const y = snap(furniture.y, maxY);
  return { ...furniture, x, y, z: 0 };
};
function Block({ x, y, z = 0, w, d, h, color, selected }) {
  return <g stroke={selected ? '#9c5754' : '#ffffff80'} strokeWidth={selected ? 2 : 1} strokeLinejoin="round">
    <polygon points={points([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]])} fill={color} />
    <polygon points={points([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]])} fill={color} style={{ filter: 'brightness(.88)' }} />
    <polygon points={points([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]])} fill={color} style={{ filter: 'brightness(.73)' }} />
  </g>;
}
function SoftBedLayers({ x, y, w, d, z, rotated, flipped }) {
  const bedPoint = (u, v, height = z) => {
    if (rotated) return [x + w * (1 - v), y + d * (flipped ? 1 - u : u), height];
    return [x + w * (flipped ? 1 - u : u), y + d * (flipped ? 1 - v : v), height];
  };
  return <g pointerEvents="none">
    <polygon points={points([bedPoint(.25,.08,z+.05),bedPoint(.75,.08,z+.05),bedPoint(.75,.23,z+.05),bedPoint(.25,.23,z+.05)])} fill="#fffaf3" stroke="#dfd3c6" strokeWidth="1.5" />
    <polygon points={points([bedPoint(0,.29,z+.035),bedPoint(1,.29,z+.035),bedPoint(1,1,z+.035),bedPoint(0,1,z+.035)])} fill="#eee2d5" stroke="#d9c9ba" strokeWidth="1.5" />
    <line x1={point(...bedPoint(.08,.36,z+.06))[0]} y1={point(...bedPoint(.08,.36,z+.06))[1]} x2={point(...bedPoint(.92,.36,z+.06))[0]} y2={point(...bedPoint(.92,.36,z+.06))[1]} stroke="#fff9f1" strokeWidth="2" />
  </g>;
}
function DoorMarker({ door, selected, onSelect }) {
  const hingeY = door.reversed ? door.offset + DOOR_WIDTH : door.offset;
  const turn = door.reversed ? -1 : 1;
  const arc = Array.from({ length: 13 }, (_, index) => {
    const angle = (index / 12) * Math.PI / 2;
    return [ROOM_SIZE - DOOR_WIDTH * Math.sin(angle), hingeY + turn * DOOR_WIDTH * Math.cos(angle), .1];
  });
  const swingArea = `M ${point(ROOM_SIZE, hingeY, .08).join(' ')} L ${arc.map(vertex => point(...vertex).join(' ')).join(' L ')} Z`;
  return <g role="button" tabIndex="0" aria-label="방문 설정" aria-pressed={selected} onClick={onSelect} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(); } }} className="room-door-marker">
    <path d={swingArea} fill="#c68b79" stroke="#af705f" strokeWidth="1.5" />
  </g>;
}
export default function RoomPage({ itemsHook, room, onScan, pendingNotice, clearPendingNotice }) {
  const { furniture, setFurniture, saveError } = room;
  const { items, updateItem, updateMultipleItems } = itemsHook;
  const [selectedId, setSelectedId] = useState(furniture[0]?.id);
  const [selectedIds, setSelectedIds] = useState(() => furniture[0]?.id ? [furniture[0].id] : []);
  const [slot, setSlot] = useState(0);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [layoutNotice, setLayoutNotice] = useState('');
  const [stackBaseId, setStackBaseId] = useState(null);
  const [deletingFurniture, setDeletingFurniture] = useState(null);
  const [isItemSelectMode, setIsItemSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState([]);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showUnplacedModal, setShowUnplacedModal] = useState(false);
  const [showPlacedModal, setShowPlacedModal] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const toastTimerRef = useRef(null);

  const showToast = (msg) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(msg);
    toastTimerRef.current = setTimeout(() => {
      setToastMessage('');
    }, 2800);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);
  useEffect(() => {
    setIsItemSelectMode(false);
    setSelectedItemIds([]);
    setShowMoveModal(false);
  }, [selectedId, slot]);
  const historyRef = useRef({ past: [], future: [], snapshot: JSON.stringify(furniture) });
  const [door, setDoor] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('cloomy_door'));
      if (Number.isFinite(saved?.offset) && typeof saved.reversed === 'boolean') return { offset: Math.max(.6, Math.min(ROOM_SIZE - DOOR_WIDTH - .6, saved.offset)), reversed: saved.reversed };
    } catch { /* Use the right-lower doorway by default. */ }
    return DEFAULT_DOOR;
  });
  const svgRef = useRef(null);
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const doorSelected = selectedId === DOOR_ID;
  const selected = selectedId === FLOOR_STORAGE.id ? FLOOR_STORAGE : furniture.find(f => f.id === selectedId);
  const selectedConfig = selected && configFor(selected);
  const stackedChild = selected && furniture.find(f => f.stackedOn === selected.id);
  const resizeTarget = selected && selected.type !== 'floorStorage' ? (selected.stackedOn ? furniture.find(f => f.id === selected.stackedOn) : selected) : null;
  const isFloor = selected?.type === 'floorStorage';
  const hasSlots = selected ? slotCount(selected) > 0 : false;
  const currentTargetLocation = selected
    ? (isFloor ? FLOOR_LOCATION : (hasSlots ? locationFor(selected, slot) : selected.name))
    : '';
  const location = currentTargetLocation;
  const activeItems = items.filter(i => i.status !== 'discarded' && i.status !== 'trading');
  const placed = activeItems.filter(i => room.locations.includes(i.location));
  const unplacedItems = activeItems.filter(i => !room.locations.includes(i.location) || i.location === '미분류' || !i.location);
  const contents = activeItems.filter(i => {
    if (!selected) return false;
    if (isFloor) return i.location === FLOOR_LOCATION;
    if (!hasSlots) {
      return i.location === selected.name || i.location.startsWith(`${selected.name} · `);
    }
    if (i.location === locationFor(selected, slot)) return true;
    if (slot === 0 && i.location === selected.name) return true;
    return false;
  });
  const candidates = activeItems.filter(i => !contents.some(c => c.id === i.id) && `${i.name} ${i.location}`.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { setNameDraft(selected?.name || ''); }, [selected?.id, selected?.name]);
  useEffect(() => {
    const outsideItems = items.filter(item => item.location?.startsWith('현관 밖 신발장'));
    if (outsideItems.length) updateMultipleItems(outsideItems.map(item => ({ id: item.id, location: '미분류' })));
  }, [items, updateMultipleItems]);
  useEffect(() => { localStorage.setItem('cloomy_door', JSON.stringify(door)); }, [door]);
  useEffect(() => {
    if (!pendingNotice) return;
    setEditing(true);
    setLayoutNotice(pendingNotice);
    const last = furniture[furniture.length - 1];
    if (last) { setSelectedId(last.id); setSelectedIds([last.id]); }
    if (clearPendingNotice) clearPendingNotice();
  }, [pendingNotice]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const history = historyRef.current;
    const current = JSON.stringify(furniture);
    if (current === history.snapshot) return;
    history.past.push(JSON.parse(history.snapshot));
    history.past = history.past.slice(-30);
    history.future = [];
    history.snapshot = current;
  }, [furniture]);
  const attachFurniture = (baseId, topId) => setFurniture(prev => {
    const base = prev.find(f => f.id === baseId);
    const top = prev.find(f => f.id === topId);
    if (!base || !top || baseId === topId || base.stackedOn || top.stackedOn) return prev;
    const baseSize = dimensions(base); const topSize = dimensions(top);
    const commonSize = { w: Math.max(baseSize.w, topSize.w), d: Math.max(baseSize.d, topSize.d) };
    const commonLevel = Math.max(base.sizeLevel ?? Math.round(((base.scale || 1) - 1) * 10), top.sizeLevel ?? Math.round(((top.scale || 1) - 1) * 10));
    const nextBase = constrainToRoom({ ...base, stackedSize: commonSize, sizeLevel: commonLevel }, commonSize);
    const nextTop = { ...top, x: nextBase.x, y: nextBase.y, stackedSize: commonSize, sizeLevel: commonLevel, stackedOn: baseId, z: 0 };
    const blocked = prev.some(other => ![baseId, topId].includes(other.id) && overlaps({ ...nextBase, ...commonSize }, { ...other, ...dimensions(other) }));
    if (blocked) { setLayoutNotice('위에 올릴 가구가 다른 가구와 겹쳐요. 먼저 빈 공간을 만들어주세요.'); return prev; }
    setLayoutNotice(`${top.name}을(를) ${base.name} 위에 올렸어요. 이제 함께 움직여요.`);
    return prev.map(f => f.id === baseId ? { ...nextBase, z: 0 } : f.id === topId ? nextTop : f);
  });
  const detachFurniture = id => {
    setFurniture(prev => {
      const child = prev.find(f => f.id === id);
      if (!child) return prev;
      const baseId = child.stackedOn;
      const detached = { ...child, stackedOn: undefined, stackedSize: undefined, z: 0 };
      const size = dimensions(detached);
      const others = prev.filter(f => f.id !== id);
      let best = null; let bestDistance = Infinity;
      for (let y = 0; y <= ROOM_SIZE - size.d; y += GRID_SIZE) for (let x = 0; x <= ROOM_SIZE - size.w; x += GRID_SIZE) {
        const candidate = { ...detached, x, y };
        if (others.some(other => overlaps({ ...candidate, ...size }, { ...other, ...dimensions(other) }))) continue;
        const distance = (x - child.x) ** 2 + (y - child.y) ** 2;
        if (distance < bestDistance) { best = candidate; bestDistance = distance; }
      }
      if (!best) { setLayoutNotice('분리해서 놓을 빈 공간이 없어요. 다른 가구를 옮긴 뒤 다시 시도해주세요.'); return prev; }
      setLayoutNotice('가구를 분리해 가장 가까운 빈 위치에 놓았어요.');
      return prev.map(f => f.id === id ? best : f.id === baseId ? { ...f, stackedSize: undefined } : f);
    });
    setStackBaseId(null);
  };
  const renameSelected = () => {
    if (!selected || selected.type === 'floorStorage') return;
    const name = nameDraft.trim();
    if (!name || name === selected.name) return;
    const oldLocations = Array.from({ length: slotCount(selected) }, (_, index) => slotName(selected, index));
    const renamed = { ...selected, name };
    const newLocations = Array.from({ length: slotCount(renamed) }, (_, index) => slotName(renamed, index));
    updateMultipleItems(items.filter(item => oldLocations.includes(item.location)).map(item => ({ id: item.id, location: newLocations[oldLocations.indexOf(item.location)] })));
    setFurniture(prev => prev.map(f => f.id === selected.id ? { ...f, name } : f));
    setLayoutNotice('가구 이름과 연결된 보관 위치를 바꿨어요.');
  };
  const select = (f, multi = false) => {
    if (stackBaseId && f.id !== stackBaseId) { attachFurniture(stackBaseId, f.id); setStackBaseId(null); return; }
    setSelectedId(f.id); setSlot(0); setAdding(false);
    setSelectedIds(current => multi ? (current.includes(f.id) ? current.filter(id => id !== f.id) : [...current, f.id]) : [f.id]);
  };
  const moveFurniture = (id, patch) => setFurniture(prev => {
    const target = prev.find(f => f.id === id);
    const baseId = target?.stackedOn || id;
    const selectedGroupIds = new Set(selectedIds.includes(id) ? selectedIds : [id]);
    selectedGroupIds.add(baseId);
    prev.filter(f => f.stackedOn && selectedGroupIds.has(f.stackedOn)).forEach(f => selectedGroupIds.add(f.id));
    const group = prev.filter(f => selectedGroupIds.has(f.id));
    if (group.length > 1 && patch.customSize) {
      const base = prev.find(f => f.id === baseId);
      const resizedBase = constrainToRoom({ ...base, x: patch.x ?? base.x, y: patch.y ?? base.y, stackedSize: patch.customSize }, { ...dimensions(base), ...patch.customSize });
      const dx = resizedBase.x - base.x; const dy = resizedBase.y - base.y;
      const groupIds = new Set(group.map(f => f.id));
      const resizedGroup = group.map(f => ({ ...f, x: f.x + dx, y: f.y + dy, stackedSize: patch.customSize, customSize: undefined }));
      const valid = resizedGroup.every(f => {
        const size = dimensions(f);
        return f.x >= 0 && f.y >= 0 && f.x + size.w <= ROOM_SIZE && f.y + size.d <= ROOM_SIZE && !prev.some(other => !groupIds.has(other.id) && overlaps({ ...f, ...size }, { ...other, ...dimensions(other) }));
      });
      if (!valid) return prev;
      return prev.map(f => resizedGroup.find(member => member.id === f.id) || f);
    }
    if (group.length > 1 && ('x' in patch || 'y' in patch)) {
      const base = prev.find(f => f.id === baseId);
      const requested = { ...base, x: base.x + ((patch.x ?? target.x) - target.x), y: base.y + ((patch.y ?? target.y) - target.y) };
      const anchored = constrainToRoom(requested, dimensions(base));
      const dx = anchored.x - base.x; const dy = anchored.y - base.y;
      const groupIds = new Set(group.map(f => f.id));
      const movedGroup = group.map(f => ({ ...f, x: f.x + dx, y: f.y + dy }));
      const valid = movedGroup.every(f => {
        const size = dimensions(f);
        return f.x >= 0 && f.y >= 0 && f.x + size.w <= ROOM_SIZE && f.y + size.d <= ROOM_SIZE && !prev.some(other => !groupIds.has(other.id) && overlaps({ ...f, ...size }, { ...other, ...dimensions(other) }));
      });
      if (!valid) return prev;
      return prev.map(f => movedGroup.find(member => member.id === f.id) || f);
    }
    return prev.map(f => {
    if (f.id !== id) return f;
    const next = { ...f, ...patch };
    const size = dimensions(next);
    const candidate = { ...constrainToRoom(next, size), ...size };
    const relatedIds = new Set([id, target?.stackedOn, ...prev.filter(o => o.stackedOn === id).map(o => o.id)].filter(Boolean));
    const others = prev.filter(other => !relatedIds.has(other.id)).map(other => ({ ...other, ...dimensions(other) }));
    // 가까운 가구의 앞·뒤·옆 선에는 붙여 놓기 쉽게 맞추되, 자동으로 고정하지는 않습니다.
    const xTargets = others.flatMap(other => [other.x, other.x + other.w - candidate.w, other.x - candidate.w - GAP, other.x + other.w + GAP]);
    const yTargets = others.flatMap(other => [other.y, other.y + other.d - candidate.d, other.y - candidate.d - GAP, other.y + other.d + GAP]);
    const snappedX = closestSnap(candidate.x, xTargets);
    if (Math.abs(snappedX - candidate.x) <= SNAP_DISTANCE && !others.some(other => overlaps({ ...candidate, x: snappedX }, other))) candidate.x = snappedX;
    const snappedY = closestSnap(candidate.y, yTargets);
    if (Math.abs(snappedY - candidate.y) <= SNAP_DISTANCE && !others.some(other => overlaps({ ...candidate, y: snappedY }, other))) candidate.y = snappedY;
    Object.assign(candidate, constrainToRoom(candidate, size));
    const blocked = prev.some(other => {
      if (relatedIds.has(other.id)) return false;
      const otherSize = dimensions(other);
      return overlaps(candidate, { ...other, ...otherSize });
    });
    // candidate에는 충돌 검사에만 쓰는 가로·세로 값이 포함되어 있으므로, 실제 저장값은 보정된 좌표만 반영합니다.
    return blocked ? f : { ...next, x: candidate.x, y: candidate.y, z: 0 };
    });
  });
  const addSlot = () => {
    if (!selected || selected.type === 'floorStorage') return;
    const current = slotCount(selected);
    if (current >= 6) {
      showToast('가구 칸은 최대 6칸까지 추가할 수 있어요!');
      return;
    }
    const nextSlots = current + 1;
    setFurniture(prev => prev.map(f => f.id === selectedId ? { ...f, slots: nextSlots } : f));
    setSlot(nextSlots - 1);
    setLayoutNotice(`${selected.name}에 칸을 추가했어요. (총 ${nextSlots}칸)`);
  };
  const removeSlot = () => {
    if (!selected || selected.type === 'floorStorage') return;
    const current = slotCount(selected);
    if (current <= 0) return;
    const nextSlots = current - 1;
    const removedLocation = slotName(selected, nextSlots);
    const affected = items.filter(i => i.location === removedLocation);
    if (affected.length > 0) {
      updateMultipleItems(affected.map(i => ({ id: i.id, location: '미분류' })));
      setLayoutNotice(`${selected.name}의 마지막 칸을 삭제하고, 보관 중이던 물건 ${affected.length}개를 미분류로 이동했어요.`);
    } else {
      setLayoutNotice(`${selected.name}의 칸을 삭제했어요. (총 ${nextSlots}칸)`);
    }
    setFurniture(prev => prev.map(f => f.id === selectedId ? { ...f, slots: nextSlots } : f));
    setSlot(currentSlot => Math.min(currentSlot, Math.max(0, nextSlots - 1)));
  };
  const change = patch => selected?.type !== 'floorStorage' && moveFurniture(selectedId, patch);
  const rotateSelected = () => {
    if (!selected || selected.type === 'floorStorage') return;
    let moved = false;
    setFurniture(prev => {
      const current = prev.find(f => f.id === selectedId);
      if (!current) return prev;
      const baseId = current.stackedOn || current.id;
      const group = prev.filter(f => f.id === baseId || f.stackedOn === baseId);
      if (group.length > 1) {
        const base = prev.find(f => f.id === baseId);
        const turnedBase = { ...base, rotated: !base.rotated };
        const size = dimensions(turnedBase);
        const others = prev.filter(f => !group.some(member => member.id === f.id)).map(f => ({ ...f, ...dimensions(f) }));
        const clear = candidate => !others.some(other => overlaps({ ...candidate, ...size }, other));
        let best = clear(constrainToRoom(turnedBase, size)) ? constrainToRoom(turnedBase, size) : null;
        let bestDistance = Infinity;
        if (!best) for (let y = 0; y <= ROOM_SIZE - size.d; y += GRID_SIZE) for (let x = 0; x <= ROOM_SIZE - size.w; x += GRID_SIZE) {
          const candidate = { ...turnedBase, x, y };
          if (!clear(candidate)) continue;
          const distance = (x - base.x) ** 2 + (y - base.y) ** 2;
          if (distance < bestDistance) { best = candidate; bestDistance = distance; }
        }
        if (!best) return prev;
        moved = best.x !== base.x || best.y !== base.y;
        return prev.map(f => {
          const member = group.find(item => item.id === f.id);
          return member ? { ...member, rotated: !member.rotated, x: best.x + member.x - base.x, y: best.y + member.y - base.y, z: 0 } : f;
        });
      }
      const turned = { ...current, rotated: !current.rotated };
      const size = dimensions(turned);
      const desired = constrainToRoom(turned, size);
      const others = prev.filter(f => f.id !== current.id).map(f => ({ ...f, ...dimensions(f) }));
      const clear = candidate => !others.some(other => overlaps({ ...candidate, ...size }, other));
      let best = clear(desired) ? desired : null;
      let bestDistance = Infinity;
      if (!best) {
        for (let y = 0; y <= ROOM_SIZE - size.d; y += GRID_SIZE) for (let x = 0; x <= ROOM_SIZE - size.w; x += GRID_SIZE) {
          const candidate = { ...turned, x, y };
          if (!clear(candidate)) continue;
          const distance = (x - desired.x) ** 2 + (y - desired.y) ** 2;
          if (distance < bestDistance) { best = candidate; bestDistance = distance; }
        }
      }
      if (!best) return prev;
      moved = best.x !== current.x || best.y !== current.y;
      return prev.map(f => f.id === current.id ? { ...best, z: 0 } : f);
    });
    setLayoutNotice(moved ? '회전할 자리를 찾아 가까운 빈 위치로 옮겼어요.' : '');
  };
  const flipBed = () => {
    if (selected?.type !== 'bed') return;
    setFurniture(prev => prev.map(f => f.id === selectedId ? { ...f, bedFlipped: !f.bedFlipped } : f));
  };
  const resizeSelected = delta => {
    if (!selected || selected.type === 'floorStorage') return;
    let moved = false;
    let fitted = false;
    setFurniture(prev => {
      const current = prev.find(f => f.id === selectedId);
      if (!current) return prev;
      const baseId = current.stackedOn || current.id;
      const group = prev.filter(f => f.id === baseId || f.stackedOn === baseId);
      if (group.length > 1) {
        const commonLevel = Math.max(...group.map(f => f.sizeLevel ?? Math.round(((f.scale || 1) - 1) * 10)));
        const sizeLevel = commonLevel + Math.sign(delta);
        if (sizeLevel === commonLevel) return prev;
        const oldSize = dimensions(prev.find(f => f.id === baseId));
        const change = (sizeLevel - commonLevel) * GRID_SIZE;
        const stackedSize = { w: Number((oldSize.w + change).toFixed(2)), d: Number((oldSize.d + change).toFixed(2)) };
        const groupIds = new Set(group.map(f => f.id));
        const candidate = group.map(f => ({ ...f, sizeLevel, stackedSize }));
        const valid = candidate.every(f => {
          const size = dimensions(f);
          return f.x >= 0 && f.y >= 0 && f.x + size.w <= ROOM_SIZE && f.y + size.d <= ROOM_SIZE && !prev.some(other => !groupIds.has(other.id) && overlaps({ ...f, ...size }, { ...other, ...dimensions(other) }));
        });
        if (!valid) return prev;
        fitted = true;
        return prev.map(f => candidate.find(member => member.id === f.id) || f);
      }
      const currentLevel = current.sizeLevel ?? Math.round(((current.scale || 1) - 1) * 10);
      const sizeLevel = currentLevel + Math.sign(delta);
      const resized = current.customSize ? { ...current, customSize: { w: Math.max(GRID_SIZE, current.customSize.w + Math.sign(delta) * GRID_SIZE), d: Math.max(GRID_SIZE, current.customSize.d + Math.sign(delta) * GRID_SIZE) } } : { ...current, sizeLevel };
      const size = dimensions(resized);
      const desired = constrainToRoom(resized, size);
      const others = prev.filter(f => f.id !== current.id).map(f => ({ ...f, ...dimensions(f) }));
      const clear = candidate => !others.some(other => overlaps({ ...candidate, ...size }, other));
      let best = clear(desired) ? desired : null;
      let bestDistance = Infinity;
      if (!best) {
        for (let y = 0; y <= ROOM_SIZE - size.d; y += GRID_SIZE) for (let x = 0; x <= ROOM_SIZE - size.w; x += GRID_SIZE) {
          const candidate = { ...resized, x, y };
          if (!clear(candidate)) continue;
          const distance = (x - desired.x) ** 2 + (y - desired.y) ** 2;
          if (distance < bestDistance) { best = candidate; bestDistance = distance; }
        }
      }
      if (!best) return prev;
      fitted = true;
      moved = best.x !== current.x || best.y !== current.y;
      return prev.map(f => f.id === current.id ? { ...best, z: 0 } : f);
    });
    if (fitted) setLayoutNotice(moved ? '크기를 키울 자리를 찾아 가까운 빈 위치로 옮겼어요.' : '');
    else setLayoutNotice('이 크기로 둘 빈자리가 없어요. 다른 가구를 옮긴 뒤 다시 시도해주세요.');
  };
  const findOpenPosition = (type, current) => {
    const template = { type, x: 0, y: 0, rotated: false };
    const size = dimensions(template);
    const minX = 0;
    const maxX = ROOM_SIZE - size.w;
    for (let y = 0; y <= ROOM_SIZE - size.d; y += GRID_SIZE) {
      for (let x = minX; x <= maxX; x += GRID_SIZE) {
        const candidate = { ...constrainToRoom({ x, y }, size), ...size };
        if (!current.some(other => overlaps(candidate, { ...other, ...dimensions(other) }))) return { x, y };
      }
    }
    return null;
  };
  const toSvgPoint = event => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return { x: (event.clientX - rect.left) * 700 / rect.width, y: (event.clientY - rect.top) * SVG_HEIGHT / rect.height };
  };
  const beginDrag = (event, furniture) => {
    select(furniture, event.shiftKey);
    event.currentTarget.focus?.();
    if (!editing) return;
    const start = toSvgPoint(event);
    if (!start) return;
    dragRef.current = { id: furniture.id, start, x: furniture.x, y: furniture.y };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  };
  const beginResize = (event, furniture, edge) => {
    if (!editing || furniture.stackedOn) return;
    const start = toSvgPoint(event);
    if (!start) return;
    const size = dimensions(furniture);
    const rotatedEdge = furniture.rotated ? ({ east: 'south', west: 'north', north: 'east', south: 'west' }[edge]) : edge;
    resizeRef.current = { id: furniture.id, edge: rotatedEdge, start, x: furniture.x, y: furniture.y, w: size.w, d: size.d };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    event.stopPropagation(); event.preventDefault();
  };
  const drag = event => {
    const resize = resizeRef.current;
    const state = dragRef.current;
    const current = toSvgPoint(event);
    if (resize && current) {
      const screenX = current.x - resize.start.x;
      const screenY = current.y - resize.start.y;
      const dx = (screenX / 29 + screenY / 15) / 2;
      const dy = (screenY / 15 - screenX / 29) / 2;
      const snap = value => Math.max(GRID_SIZE, Number((Math.round(value / GRID_SIZE) * GRID_SIZE).toFixed(2)));
      let x = resize.x; let y = resize.y; let w = resize.w; let d = resize.d;
      if (resize.edge === 'east') w = snap(resize.w + dx);
      if (resize.edge === 'west') { w = snap(resize.w - dx); x = resize.x + resize.w - w; }
      if (resize.edge === 'south') d = snap(resize.d + dy);
      if (resize.edge === 'north') { d = snap(resize.d - dy); y = resize.y + resize.d - d; }
      moveFurniture(resize.id, { x, y, customSize: { w, d } });
      return;
    }
    if (!state || !current) return;
    const screenX = current.x - state.start.x;
    const screenY = current.y - state.start.y;
    moveFurniture(state.id, { x: state.x + (screenX / 29 + screenY / 15) / 2, y: state.y + (screenY / 15 - screenX / 29) / 2 });
  };
  const endDrag = () => { dragRef.current = null; resizeRef.current = null; };
  const add = type => {
    let n = 1;
    while (furniture.some(f => f.name === `${FURNITURE[type].label} ${n}`)) n++;
    const position = findOpenPosition(type, furniture);
    if (!position) { setLayoutNotice('가구를 놓을 빈자리가 없어요. 다른 가구를 옮긴 뒤 다시 추가해주세요.'); return; }
    const next = { id: crypto.randomUUID(), type, name: `${FURNITURE[type].label} ${n}`, ...position, z: 0, rotated: false };
    setLayoutNotice('');
    setFurniture(prev => [...prev, next]); select(next);
  };
  const swapStackOrder = () => {
    if (!selected) return;
    const baseId = selected.stackedOn || (stackedChild ? selected.id : null);
    const topId = selected.stackedOn ? selected.id : (stackedChild ? stackedChild.id : null);
    if (!baseId || !topId) return;

    setFurniture(prev => {
      const base = prev.find(f => f.id === baseId);
      const top = prev.find(f => f.id === topId);
      if (!base || !top) return prev;

      return prev.map(f => {
        if (f.id === baseId) return { ...f, stackedOn: topId };
        if (f.id === topId) return { ...f, stackedOn: undefined };
        return f;
      });
    });
    setLayoutNotice('쌓은 가구의 위아래 순서를 바꿨어요.');
  };
  const handleDeleteClick = () => {
    if (!selected || selected.type === 'floorStorage') return;
    const targetLocations = [selected.name, ...Array.from({ length: slotCount(selected) }, (_, i) => slotName(selected, i))];
    const furnitureItems = items.filter(i => targetLocations.includes(i.location));
    if (furnitureItems.length === 0) {
      if (confirm(`'${selected.name}' 가구를 삭제하시겠습니까?`)) {
        const targetId = selected.id;
        setFurniture(prev => prev.filter(f => f.id !== targetId).map(f => f.stackedOn === targetId ? { ...f, stackedOn: undefined, stackedSize: undefined, z: 0 } : f));
        setSelectedId(null);
        setSelectedIds([]);
        setLayoutNotice(`'${selected.name}' 가구를 삭제했어요.`);
      }
      return;
    }
    setDeletingFurniture(selected);
  };
  const handleConfirmDeleteWithMoves = (moveMap) => {
    if (!deletingFurniture) return;
    const updates = Object.entries(moveMap).map(([id, location]) => ({ id, location }));
    if (updates.length > 0) {
      updateMultipleItems(updates);
    }
    const targetId = deletingFurniture.id;
    setFurniture(prev => prev.filter(f => f.id !== targetId).map(f => f.stackedOn === targetId ? { ...f, stackedOn: undefined, stackedSize: undefined, z: 0 } : f));
    setSelectedId(null);
    setSelectedIds([]);
    setLayoutNotice(`'${deletingFurniture.name}' 가구를 삭제하고 물건을 이동했어요.`);
    setDeletingFurniture(null);
  };
  const toggleItemSelection = (id) => {
    setSelectedItemIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };
  const toggleSelectAll = () => {
    if (selectedItemIds.length === contents.length) {
      setSelectedItemIds([]);
    } else {
      setSelectedItemIds(contents.map(i => i.id));
    }
  };
  const handleBatchRemove = () => {
    if (selectedItemIds.length === 0) return;
    if (confirm(`선택한 ${selectedItemIds.length}개 물건을 이 가구에서 뺄까요? (미분류로 이동)`)) {
      updateMultipleItems(selectedItemIds.map(id => ({ id, location: '미분류' })));
      setLayoutNotice(`${selectedItemIds.length}개 물건을 미분류로 뺐어요.`);
      setSelectedItemIds([]);
      setIsItemSelectMode(false);
    }
  };
  const handleBatchMoveConfirm = ({ targetLocation, newFurniture }) => {
    if (!targetLocation || selectedItemIds.length === 0) return;

    if (newFurniture) {
      const openPos = findOpenPosition(newFurniture.type, furniture) || { x: 1, y: 1 };
      const newId = crypto.randomUUID();
      const newFurnitureObj = {
        id: newId,
        type: newFurniture.type,
        name: newFurniture.name,
        ...openPos,
        z: 0,
        rotated: false,
      };

      setFurniture(prev => [...prev, newFurnitureObj]);
      updateMultipleItems(selectedItemIds.map(id => ({ id, location: targetLocation })));

      setEditing(true);
      setSelectedId(newId);
      setSelectedIds([newId]);
      setLayoutNotice(`'${newFurniture.name}'을(를) 원하는 위치에 배치해주세요.`);
    } else {
      updateMultipleItems(selectedItemIds.map(id => ({ id, location: targetLocation })));
      setLayoutNotice(`${selectedItemIds.length}개 물건을 '${targetLocation}'(으)로 이동했어요.`);
    }

    setSelectedItemIds([]);
    setIsItemSelectMode(false);
    setShowMoveModal(false);
  };
  const handlePlaceUnplacedItems = ({ itemIds, targetLocation, newFurniture }) => {
    if (!itemIds.length || !targetLocation) return;
    if (newFurniture) {
      const openPos = findOpenPosition(newFurniture.type, furniture) || { x: 1, y: 1 };
      const newId = crypto.randomUUID();
      const newFurnitureObj = {
        id: newId,
        type: newFurniture.type,
        name: newFurniture.name,
        ...openPos,
        z: 0,
        rotated: false,
      };
      setFurniture(prev => [...prev, newFurnitureObj]);
      updateMultipleItems(itemIds.map(id => ({ id, location: targetLocation })));
      setEditing(true);
      setSelectedId(newId);
      setSelectedIds([newId]);
      setLayoutNotice(`'${newFurniture.name}'을(를) 원하는 위치에 배치해주세요.`);
    } else {
      updateMultipleItems(itemIds.map(id => ({ id, location: targetLocation })));
      setLayoutNotice(`${itemIds.length}개 물건을 '${targetLocation}'(으)로 배치했어요.`);
    }
  };
  const handleSelectFurnitureFromSummary = (furnitureId) => {
    if (furnitureId === FLOOR_STORAGE.id) {
      select(FLOOR_STORAGE);
    } else {
      const target = furniture.find(f => f.id === furnitureId);
      if (target) {
        select(target);
      }
    }
  };
  const undoLayout = () => {
    const history = historyRef.current;
    const previous = history.past.pop();
    if (!previous) return;
    history.future.push(JSON.parse(history.snapshot));
    history.snapshot = JSON.stringify(previous);
    setFurniture(previous);
  };
  const redoLayout = () => {
    const history = historyRef.current;
    const next = history.future.pop();
    if (!next) return;
    history.past.push(JSON.parse(history.snapshot));
    history.snapshot = JSON.stringify(next);
    setFurniture(next);
  };
  useEffect(() => {
    const onKeyDown = event => {
      const key = event.key.toLowerCase();
      if (!(event.ctrlKey || event.metaKey) || !['z', 'y'].includes(key)) return;
      event.preventDefault();
      if (key === 'y' || event.shiftKey) redoLayout(); else undoLayout();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });
  return <div className="room-page">
    {toastMessage && (
      <div className="room-floating-toast" role="status">
        <span>{toastMessage}</span>
      </div>
    )}
    <div className="room-heading">
      <div>
        <p className="room-eyebrow">MY LITTLE SPACE</p>
        <h2>내 방, 한눈에</h2>
        <p>방 안의 가구와 물건 위치를 한곳에서 찾아보세요.</p>
      </div>
      <div className="room-heading-actions">
        <button className="room-icon-button" aria-label="되돌리기" title="되돌리기 (Ctrl+Z)" onClick={undoLayout}>↶</button>
        <button className="room-icon-button" aria-label="다시하기" title="다시하기 (Ctrl+Shift+Z)" onClick={redoLayout}>↷</button>
        <button
          type="button"
          className={`room-main-layout-btn ${editing ? 'is-active' : ''}`}
          onClick={() => setEditing(!editing)}
        >
          <span>{editing ? '배치 완료' : '가구 배치하기'}</span>
        </button>
      </div>
    </div>
    {saveError && <p role="alert">{saveError}</p>}
    <div className="room-stats">
      <button
        type="button"
        className="room-stat-card clickable"
        onClick={() => setShowPlacedModal(true)}
        title="가구별 물건 보관 현황 보기"
      >
        <span>방에 배치한 물건</span>
        <strong>{placed.length}<small>개</small></strong>
      </button>
      <button
        type="button"
        className="room-stat-card clickable"
        onClick={() => setShowUnplacedModal(true)}
        title="위치를 정할 물건 목록 및 배치"
      >
        <span>위치를 정할 물건</span>
        <strong>{unplacedItems.length}<small>개</small></strong>
      </button>
      <div className="room-stat-card">
        <span>나의 가구</span>
        <strong>{furniture.length}<small>개</small></strong>
      </div>
    </div>
    <div className="room-layout">
      <section className="room-stage" aria-label="입체 방 배치">
        <div className="room-stage-top"><span><i /> MY ROOM</span><span>{editing ? '드래그 또는 방향키로 가구를 옮겨보세요' : '가구를 눌러 안을 살펴보세요'}</span></div>
        <svg ref={svgRef} viewBox={`0 0 700 ${SVG_HEIGHT}`} role="group" aria-label="내 방 3D 모형" onPointerMove={drag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <defs><filter id="room-shadow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12" /></filter></defs>
          <ellipse cx="350" cy="430" rx="300" ry="92" fill="#665646" opacity=".1" filter="url(#room-shadow)" />
          <polygon points={points([[0,0,0],[ROOM_SIZE,0,0],[ROOM_SIZE,0,3.8],[0,0,3.8]])} fill="#e9e1d6" />
          <polygon points={points([[0,0,0],[0,ROOM_SIZE,0],[0,ROOM_SIZE,3.8],[0,0,3.8]])} fill="#f3ece3" />
          <polygon points={points([[0,0,0],[ROOM_SIZE,0,0],[ROOM_SIZE,ROOM_SIZE,0],[0,ROOM_SIZE,0]])} fill="#e6cfb3" stroke="#cfae89" strokeWidth="2" />
          {Array.from({length: ROOM_SIZE - 1}, (_, i) => <line key={i} x1={point(i+1,0)[0]} y1={point(i+1,0)[1]} x2={point(i+1,ROOM_SIZE)[0]} y2={point(i+1,ROOM_SIZE)[1]} stroke="#d8bd9d" opacity=".7" />)}
          <g tabIndex="0" role="button" aria-label={`바닥 보관, 물건 ${activeItems.filter(item => item.location === FLOOR_LOCATION).length}개`} aria-pressed={selectedId === FLOOR_STORAGE.id} className="room-floor-storage" onClick={() => select(FLOOR_STORAGE)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(FLOOR_STORAGE); } }}>
            <polygon points={points([[4.1,4.2,.02],[7.9,4.2,.02],[7.9,7.8,.02],[4.1,7.8,.02]])} fill="#f5eee4" stroke={selectedId === FLOOR_STORAGE.id ? '#9c5754' : '#e0d3c4'} strokeWidth={selectedId === FLOOR_STORAGE.id ? 4 : 3} />
          </g>
          <DoorMarker door={door} selected={doorSelected} onSelect={() => { setSelectedId(DOOR_ID); setAdding(false); }} />
          {[...furniture].sort((a,b) => b.stackedOn === a.id ? -1 : a.stackedOn === b.id ? 1 : a.x + a.y - b.x - b.y).map(f => {
            // 저장 데이터가 이전 버전에서 벽 밖으로 이동했어도, 화면에서는 항상 바닥 안에 그립니다.
            const baseParent = f.stackedOn && furniture.find(parent => parent.id === f.stackedOn);
            const baseRawSize = baseParent ? dimensions(baseParent) : null;
            const baseInside = baseParent ? constrainToRoom(baseParent, baseRawSize) : null;

            const rawSize = dimensions(f);
            const rawInside = constrainToRoom(f, rawSize);
            // 위에 쌓인 가구는 아래 베이스 가구의 (x, y) 위치 및 (w, d) 평면 크기에 정확히 동기화
            const inside = baseInside ? { ...rawInside, x: baseInside.x, y: baseInside.y } : rawInside;
            const size = baseInside ? dimensions(baseInside) : dimensions(inside);
            const type = configFor(inside);
            const count = activeItems.filter(i => i.location === inside.name || (inside.type === 'floorStorage' && i.location === FLOOR_LOCATION) || Array.from({length:slotCount(inside)},(_,n)=>locationFor(inside,n)).includes(i.location) || i.location.startsWith(`${inside.name} · `)).length;
            const displaySize = { ...size, h: Math.min(1.35, Math.max(.45, size.h * .3)) };
            const stackZ = baseParent ? Math.min(1.35, Math.max(.45, dimensions(baseParent).h * .3)) : 0;
            const isSelected = selectedIds.includes(f.id);
            const isBed = inside.type === 'bed';
            const topZ = stackZ + displaySize.h + .02;
            return <g key={f.id} tabIndex="0" role="button" aria-label={`${f.name}, 물건 ${count}${editing ? ', 드래그 또는 방향키로 이동 가능' : ''}`} aria-pressed={isSelected} onPointerDown={event => beginDrag(event, f)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(f); } const delta = GRID_SIZE; const moves = { ArrowLeft: { x: f.x - delta }, ArrowRight: { x: f.x + delta }, ArrowUp: { y: f.y - delta }, ArrowDown: { y: f.y + delta } }; if (moves[e.key] && editing) { e.preventDefault(); select(f); moveFurniture(f.id, moves[e.key]); } }} className={`room-furniture ${editing ? 'is-draggable' : ''}`}>
              <polygon points={points([[inside.x,inside.y,stackZ+.005],[inside.x+size.w,inside.y,stackZ+.005],[inside.x+size.w,inside.y+size.d,stackZ+.005],[inside.x,inside.y+size.d,stackZ+.005]])} fill="#6d5a49" opacity=".16" />
              <Block x={inside.x} y={inside.y} z={stackZ} {...displaySize} color={type.color} selected={isSelected} />
              {isBed && <SoftBedLayers x={inside.x} y={inside.y} w={size.w} d={size.d} z={topZ} rotated={inside.rotated} flipped={inside.bedFlipped} />}
              {Array.from({length: slotCount(inside)}, (_, i) => {
                const z = stackZ + displaySize.h * (i+.5)/slotCount(inside);
                const a = point(inside.x+.25, inside.y+size.d, z); const b = point(inside.x+size.w-.25, inside.y+size.d, z);
                return <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#fff8" strokeWidth="3" />;
              })}
            </g>;
          })}
          {editing && resizeTarget && selectedIds.length === 1 && (() => {
            const size = dimensions(resizeTarget);
            const group = furniture.filter(f => f.id === resizeTarget.id || f.stackedOn === resizeTarget.id);
            const resizeZ = group.reduce((total, f) => total + Math.min(1.35, Math.max(.45, dimensions(f).h * .3)), 0) + .08;
            return <g aria-label={`${resizeTarget.name} 크기 조절 핸들`} className="room-resize-layer">{[['west', resizeTarget.x, resizeTarget.y + size.d / 2], ['east', resizeTarget.x + size.w, resizeTarget.y + size.d / 2], ['north', resizeTarget.x + size.w / 2, resizeTarget.y], ['south', resizeTarget.x + size.w / 2, resizeTarget.y + size.d]].map(([edge, x, y]) => { const [cx, cy] = point(x, y, resizeZ); return <circle key={edge} cx={cx} cy={cy} r="7" fill="#fff9f2" stroke="#a66760" strokeWidth="2.5" className="room-resize-handle" onPointerDown={event => beginResize(event, resizeTarget, edge)} />; })}</g>;
          })()}
        </svg>
        <div className="room-legend"><span><i /> 선택한 가구</span><span>간단한 입체 모형 · 실제 크기와 다를 수 있어요</span></div>
        {editing && <div className="room-editor"><p><b>가구를 드래그하거나 방향키로 옮겨보세요.</b> Shift를 누른 채 선택하면 함께 움직일 수 있어요.</p>{layoutNotice && <p className="room-layout-notice" role="status">{layoutNotice}</p>}<div className="room-chips">{Object.entries(FURNITURE).map(([type, f]) => <button key={type} onClick={() => add(type)}>+ {f.label}</button>)}</div>{doorSelected && <div className="room-chips room-door-controls"><span className="room-size-label">방문</span><button onClick={() => setDoor(current => ({ ...current, offset: Math.max(.6, Math.round((current.offset - .5) * 10) / 10) }))}>↑ 위치</button><button onClick={() => setDoor(current => ({ ...current, offset: Math.min(ROOM_SIZE - DOOR_WIDTH - .6, Math.round((current.offset + .5) * 10) / 10) }))}>↓ 위치</button><button onClick={() => setDoor(current => ({ ...current, reversed: !current.reversed }))}>열림 방향 바꾸기</button></div>}{selected && selected.type !== 'floorStorage' && <div className="room-chips">{selected.stackedOn ? <><span className="room-size-label">아래 가구와 결합됨</span><button onClick={swapStackOrder}>위아래 순서 바꾸기</button><button onClick={() => detachFurniture(selected.id)}>분리하기</button></> : stackedChild ? <><span className="room-size-label">위에 {stackedChild.name} 있음</span><button onClick={swapStackOrder}>위아래 순서 바꾸기</button><button onClick={() => detachFurniture(stackedChild.id)}>분리하기</button></> : <button onClick={() => { setStackBaseId(selected.id); setLayoutNotice('위에 올릴 가구를 선택해주세요.'); }}>쌓기</button>}{stackBaseId && <button onClick={() => { setStackBaseId(null); setLayoutNotice(''); }}>쌓기 취소</button>}<input className="room-rename-input" aria-label="가구 이름" value={nameDraft} onChange={event => setNameDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); renameSelected(); } }} /><button onClick={renameSelected}>이름 저장</button><button onClick={rotateSelected}>90° 회전</button>{selected.type === 'bed' && <button onClick={flipBed}>180° 방향 전환</button>}<button onClick={handleDeleteClick}>가구 삭제</button></div>}</div>}
      </section>
      <section className="room-details" aria-label="가구 안의 물건">
        {!selected ? <div className="room-empty"><span>🏡</span><b>가구를 선택해주세요</b><p>가구를 선택하면 안의 물건을 볼 수 있어요.</p></div> : <>
          <p className="room-eyebrow">INSIDE MY SPACE</p>
          <h3>{selected.name}</h3>
          <p className="room-muted">{selected.type === 'floorStorage' ? '바닥에 임시로 둔 물건을 모아볼 수 있어요.' : hasSlots ? '칸을 선택하면 보관한 물건이 보여요.' : '칸 구분 없이 가구에 보관 중인 물건이에요. 필요하면 칸을 추가할 수 있어요.'}</p>
          {hasSlots && <div className="room-slots">{Array.from({ length: slotCount(selected) }, (_, i) => {
            const slotLoc = locationFor(selected, i);
            const countInSlot = activeItems.filter(item => item.location === slotLoc || (i === 0 && item.location === selected.name)).length;
            return <button key={i} className={slot === i ? 'selected' : ''} aria-pressed={slot === i} onClick={() => { setSlot(i); setAdding(false); }}><span>{isFloor ? '바닥 보관' : `${i + 1}번째 칸`}</span><b>{countInSlot}개</b></button>;
          })}</div>}
          {selectedConfig?.configurableSlots && (
            <div className="room-slot-actions">
              <button
                type="button"
                className={`room-slot-action-btn ${slotCount(selected) >= 6 ? 'is-max-slots' : ''}`}
                onClick={addSlot}
                title={slotCount(selected) >= 6 ? '가구 칸은 최대 6칸까지 추가할 수 있어요' : '새로운 칸 추가'}
              >
                + 칸 추가
              </button>
              {slotCount(selected) > 0 && <button type="button" className="room-slot-action-btn danger" onClick={removeSlot}>− 칸 삭제</button>}
            </div>
          )}
          <div className="room-contents-title">
            <h4>{isFloor ? '바닥에 둔 물건' : (hasSlots ? `${slot + 1}번째 칸의 물건` : `${selected.name}의 물건`)}</h4>
            <div className="room-contents-header-actions">
              <span>{contents.length}개</span>
              {contents.length > 0 && (
                <button
                  type="button"
                  className={`room-item-edit-btn ${isItemSelectMode ? 'active' : ''}`}
                  onClick={() => {
                    setIsItemSelectMode(!isItemSelectMode);
                    setSelectedItemIds([]);
                  }}
                >
                  {isItemSelectMode ? '완료' : '편집'}
                </button>
              )}
            </div>
          </div>
          {isItemSelectMode && contents.length > 0 && (
            <div className="room-batch-bar">
              <button type="button" onClick={toggleSelectAll} className="room-batch-select-all">
                {selectedItemIds.length === contents.length ? '선택 해제' : '전체 선택'}
              </button>
              <span className="room-batch-count">{selectedItemIds.length}개 선택</span>
              <div className="room-batch-actions">
                <button
                  type="button"
                  disabled={selectedItemIds.length === 0}
                  onClick={handleBatchRemove}
                  className="room-batch-btn danger"
                >
                  빼기
                </button>
                <button
                  type="button"
                  disabled={selectedItemIds.length === 0}
                  onClick={() => setShowMoveModal(true)}
                  className="room-batch-btn primary"
                >
                  이동
                </button>
              </div>
            </div>
          )}
          {contents.length ? (
            <ul className="room-item-list">
              {contents.map(item => {
                const isChecked = selectedItemIds.includes(item.id);
                return (
                  <li
                    key={item.id}
                    className={isItemSelectMode ? 'is-selectable' : ''}
                    onClick={isItemSelectMode ? () => toggleItemSelection(item.id) : undefined}
                  >
                    {isItemSelectMode && (
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItemSelection(item.id)}
                        onClick={e => e.stopPropagation()}
                        className="room-item-checkbox"
                        aria-label={`${item.name} 선택`}
                      />
                    )}
                    <span className="room-item-icon">{getCategoryIcon(item)}</span>
                    <div>
                      <b>{item.name}</b>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="room-empty">
              <span>🧺</span>
              <b>아직 비어 있는 곳이에요</b>
              <p>스캔한 물건을 여기에 넣어보세요.</p>
            </div>
          )}
          <button className="room-button primary full" onClick={() => setAdding(!adding)}>{adding ? '물건 선택 닫기' : '+ 등록한 물건 넣기'}</button>
          {adding && <div className="room-picker"><input aria-label="등록한 물건 검색" placeholder="물건 이름 또는 위치 검색" value={query} onChange={e => setQuery(e.target.value)} /><p className="room-muted">다른 위치의 물건은 여기로 이동해요.</p><ul className="room-item-list">{candidates.map(item => <li key={item.id}><span className="room-item-icon">{getCategoryIcon(item)}</span><div><b>{item.name}</b><small>{item.location}</small></div><button onClick={() => updateItem(item.id, { location: currentTargetLocation })}>넣기</button></li>)}</ul>{!candidates.length && <p className="room-muted">넣을 수 있는 물건이 없어요.</p>}</div>}
          <button className="room-scan-link" onClick={onScan}>새 물건 스캔하기 ↗</button>
        </>}
      </section>
    </div><p className="room-footnote">스캔 화면에서 보관 위치를 선택하면 해당 칸에 바로 연결돼요. 배치는 이 브라우저에 저장됩니다.</p>
    {deletingFurniture && (
      <FurnitureDeleteModal
        furniture={deletingFurniture}
        items={items.filter(i => [deletingFurniture.name, ...Array.from({ length: slotCount(deletingFurniture) }, (_, idx) => slotName(deletingFurniture, idx))].includes(i.location))}
        otherFurniture={furniture.filter(f => f.id !== deletingFurniture.id)}
        onConfirm={handleConfirmDeleteWithMoves}
        onClose={() => setDeletingFurniture(null)}
      />
    )}
    {showMoveModal && (
      <MoveItemsModal
        selectedItemCount={selectedItemIds.length}
        currentLocation={currentTargetLocation}
        roomFurniture={furniture}
        onConfirm={handleBatchMoveConfirm}
        onClose={() => setShowMoveModal(false)}
      />
    )}
    {showUnplacedModal && (
      <UnplacedItemsModal
        unplacedItems={unplacedItems}
        roomFurniture={furniture}
        onPlaceItems={handlePlaceUnplacedItems}
        onClose={() => setShowUnplacedModal(false)}
      />
    )}
    {showPlacedModal && (
      <PlacedSummaryModal
        furniture={furniture}
        activeItems={activeItems}
        onSelectFurniture={handleSelectFurnitureFromSummary}
        onClose={() => setShowPlacedModal(false)}
      />
    )}
  </div>;
}
