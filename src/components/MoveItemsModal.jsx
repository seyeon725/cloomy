import { useState, useMemo } from 'react';
import { FURNITURE, slotCount, slotName, FLOOR_LOCATION } from '../hooks/useRoom';
import Icon from './Icon';

export default function MoveItemsModal({
  selectedItemCount,
  currentLocation,
  rooms = [],
  activeRoomId = null,
  roomFurniture = [],
  onConfirm,
  onClose,
  onAddSlot,
}) {
  const [selectedRoomId, setSelectedRoomId] = useState(() => activeRoomId || rooms[0]?.id || 'room-1');
  const [pendingNew, setPendingNew] = useState(null);
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [targetLocation, setTargetLocation] = useState('');

  // 새 가구 추가 폼 상태
  const [showNewForm, setShowNewForm] = useState(false);
  const [newType, setNewType] = useState('drawers');
  const [newName, setNewName] = useState('');

  const currentRoom = useMemo(() => {
    return rooms.find(r => r.id === selectedRoomId) || rooms[0] || null;
  }, [rooms, selectedRoomId]);

  const baseFurniture = currentRoom?.furniture || roomFurniture;

  const allFurniture = useMemo(() => {
    return pendingNew ? [...baseFurniture, pendingNew] : baseFurniture;
  }, [baseFurniture, pendingNew]);

  const handleSelectRoom = (roomId) => {
    if (selectedRoomId === roomId) return;
    setSelectedRoomId(roomId);
    setSelectedFurnitureId(null);
    setSelectedSlotIndex(null);
    setTargetLocation('');
    setPendingNew(null);
    setShowNewForm(false);
  };

  const selectedFurniture = allFurniture.find((f) => f.id === selectedFurnitureId);

  const effectiveSlots = (f) => {
    if (!f) return 0;
    if (f.isPending) return f.slots || 1;
    return slotCount(f);
  };

  const handleAddSlotClick = (furniture) => {
    if (!furniture) return;
    if (furniture.isPending) {
      const current = furniture.slots || 1;
      const nextSlots = current + 1;
      const updated = { ...furniture, slots: nextSlots };
      setPendingNew(updated);
      setSelectedSlotIndex(nextSlots - 1);
      setTargetLocation(slotName(updated, nextSlots - 1));
      return;
    }

    if (onAddSlot) {
      const nextIndex = onAddSlot(furniture.id);
      setSelectedSlotIndex(nextIndex);
      setTargetLocation(slotName(furniture, nextIndex));
    }
  };

  const selectFurniture = (f) => {
    setShowNewForm(false);
    setSelectedFurnitureId(f.id);
    const slots = effectiveSlots(f);
    if (slots === 0) {
      setSelectedSlotIndex(null);
      setTargetLocation(f.name);
    } else if (slots === 1) {
      setSelectedSlotIndex(0);
      setTargetLocation(slotName(f, 0));
    } else {
      setSelectedSlotIndex(null);
      setTargetLocation('');
    }
  };

  const selectSlot = (index) => {
    if (!selectedFurniture) return;
    setSelectedSlotIndex(index);
    setTargetLocation(slotName(selectedFurniture, index));
  };

  const selectFloor = () => {
    setShowNewForm(false);
    setSelectedFurnitureId('floor-storage');
    setSelectedSlotIndex(null);
    setTargetLocation(FLOOR_LOCATION);
  };

  const openNewForm = () => {
    const type = newType;
    let n = 1;
    const label = FURNITURE[type].label;
    while (allFurniture.some((f) => f.name === `${label} ${n}`)) n++;
    setNewName(`${label} ${n}`);
    setShowNewForm(true);
  };

  const confirmNew = () => {
    if (!newName.trim()) return;
    const pendingObj = {
      id: `new-${Date.now()}`,
      type: newType,
      name: newName.trim(),
      isPending: true,
      slots: 1,
    };
    setPendingNew(pendingObj);
    setShowNewForm(false);
    setSelectedFurnitureId(pendingObj.id);
    setSelectedSlotIndex(0);
    setTargetLocation(slotName(pendingObj, 0));
  };

  const isLocationValid = Boolean(targetLocation && (targetLocation !== currentLocation || (selectedRoomId && activeRoomId && selectedRoomId !== activeRoomId)));

  const handleConfirm = () => {
    if (!isLocationValid) return;
    if (pendingNew && selectedFurnitureId === pendingNew.id) {
      onConfirm({
        targetLocation,
        targetRoomId: selectedRoomId,
        newFurniture: { type: pendingNew.type, name: pendingNew.name, slots: pendingNew.slots || 1 },
      });
    } else {
      onConfirm({ targetLocation, targetRoomId: selectedRoomId });
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#4A3E3D]/35 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg fluffy-card rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-7 max-h-[85vh] flex flex-col animate-[fade-in-up_220ms_ease-out]">
        <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-[#FFDAC1] sm:hidden" />

        {/* 헤더 */}
        <div className="flex items-start justify-between pb-3 border-b border-[#F4EEEA]">
          <div>
            <h2 className="text-xl font-extrabold text-[#4A3E3D] flex items-center gap-2">
              <Icon name="box" size={20} />
              <span>물건 이동</span>
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#806F6D]">
              선택한 <b>{selectedItemCount}개</b> 물건을 어디로 옮길까요?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl px-2 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 목적지 선택 영역 */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4 pr-1">
          {/* 현재 선택된 목적지 배지 */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#806F6D]">이동할 위치</span>
            {targetLocation ? (
              <span className={`text-xs font-bold px-3 py-1 rounded-full truncate max-w-[240px] ${targetLocation === currentLocation ? 'bg-amber-100 text-amber-700' : 'bg-[#FFF0EE] text-[#B56562]'}`}>
                {targetLocation === currentLocation ? `${targetLocation} (현재 위치)` : `${currentRoom?.name ? `${currentRoom.name} > ` : ''}${targetLocation}`}
              </span>
            ) : (
              <span className="text-xs text-[#9A8784]">방과 가구를 선택해주세요</span>
            )}
          </div>

          {/* 1단계: 이동할 방 선택 */}
          {rooms.length > 0 && (
            <div className="pb-3 border-b border-[#F4EEEA]">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-bold text-[#806F6D] flex items-center gap-1">
                  <Icon name="room" size={14} />
                  <span>1단계 · 보관할 방 선택</span>
                </span>
                {currentRoom && (
                  <span className="text-[11px] text-[#9A8784]">
                    선택: <b className="text-[#8F5E4D]">{currentRoom.name}</b>
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {rooms.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => handleSelectRoom(r.id)}
                    className={`fluffy-button px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                      selectedRoomId === r.id
                        ? 'bg-[#B56562] text-white shadow-xs font-bold'
                        : 'bg-[#FAF8F5] text-[#806F6D] hover:bg-[#FFF0EE]'
                    }`}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 2단계: 가구 버튼 목록 */}
          <div>
            <span className="text-xs font-bold text-[#806F6D] flex items-center gap-1 mb-2">
              <Icon name="box" size={14} />
              <span>2단계 · {currentRoom?.name || '방'} 안의 가구 선택</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectFloor}
                className={`fluffy-button px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                  selectedFurnitureId === 'floor-storage'
                    ? 'bg-[#FFB7B2] text-[#4A3E3D] shadow-[0_6px_16px_rgba(255,183,178,0.35)] font-bold'
                    : 'bg-[#FAF8F5] text-[#806F6D]'
                }`}
              >
                바닥 보관
              </button>
              {allFurniture.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => selectFurniture(f)}
                  className={`fluffy-button px-3.5 py-2 text-xs font-semibold cursor-pointer ${
                    selectedFurnitureId === f.id
                      ? 'bg-[#FFB7B2] text-[#4A3E3D] shadow-[0_6px_16px_rgba(255,183,178,0.35)] font-bold'
                      : 'bg-[#FAF8F5] text-[#806F6D]'
                  }`}
                >
                  {f.name}
                  {f.isPending ? ' (신규)' : ''}
                </button>
              ))}
              <button
                type="button"
                onClick={openNewForm}
                className="fluffy-button px-3.5 py-2 text-xs font-semibold bg-[#FAF8F5] text-[#806F6D] flex items-center gap-1 cursor-pointer"
              >
                <Icon name="plus" size={12} strokeWidth={2.2} />
                <span>새 가구 추가</span>
              </button>
            </div>
          </div>

          {/* 3단계: 칸 서브 선택기 및 칸 추가 */}
          {selectedFurniture && selectedFurnitureId !== 'floor-storage' && (
            <div className="flex flex-wrap items-center gap-1.5 p-3 bg-[#FAF8F5] rounded-2xl border border-[#F4EEEA]">
              <span className="text-xs text-[#806F6D] font-bold mr-1.5 flex items-center gap-1">
                <Icon name="layers" size={13} />
                <span>3단계 · {selectedFurniture.name} 칸 선택:</span>
              </span>
              {effectiveSlots(selectedFurniture) > 0 ? (
                Array.from({ length: effectiveSlots(selectedFurniture) }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectSlot(i)}
                    className={`fluffy-button px-3 py-1.5 text-xs font-semibold ${
                      selectedSlotIndex === i
                        ? 'bg-[#FFDAC1] text-[#4A3E3D] shadow-[0_4px_12px_rgba(255,218,193,0.4)] font-bold'
                        : 'bg-white text-[#806F6D] border border-[#F0E8E2]'
                    }`}
                  >
                    {i + 1}번째 칸
                  </button>
                ))
              ) : (
                <span className="text-xs text-[#9A8784] font-medium py-1">
                  (칸 없음 · 가구 전체에 보관)
                </span>
              )}
              <button
                type="button"
                onClick={() => handleAddSlotClick(selectedFurniture)}
                className="fluffy-button px-2.5 py-1 text-xs font-bold rounded-xl bg-[#FFF0EE] hover:bg-[#FFE5E0] text-[#B56562] border border-[#FFD0CC] flex items-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                title={`${selectedFurniture.name}에 새 칸을 추가하고 바로 선택해요`}
              >
                <span>+ 칸 추가</span>
              </button>
            </div>
          )}

          {/* 새 가구 추가 폼 */}
          {showNewForm && (
            <div className="p-4 bg-[#FFF9F5] rounded-2xl border border-[#FFE8DE] space-y-3">
              <p className="text-xs font-bold text-[#4A3E3D]">✨ 새 가구 추가 후 바로 넣기</p>
              <div className="flex gap-2">
                <select
                  value={newType}
                  onChange={(e) => {
                    const t = e.target.value;
                    setNewType(t);
                    let n = 1;
                    const label = FURNITURE[t].label;
                    while (allFurniture.some((f) => f.name === `${label} ${n}`)) n++;
                    setNewName(`${label} ${n}`);
                  }}
                  className="fluffy-input px-3 py-2 text-xs font-medium bg-white"
                >
                  {Object.entries(FURNITURE).map(([t, c]) => (
                    <option key={t} value={t}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newName.trim()) confirmNew();
                  }}
                  placeholder="가구 이름"
                  className="fluffy-input flex-1 px-3 py-2 text-xs font-medium"
                  autoFocus
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => setShowNewForm(false)}
                  className="fluffy-button px-3 py-1.5 text-xs font-semibold bg-white text-[#806F6D]"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={confirmNew}
                  disabled={!newName.trim()}
                  className="fluffy-button px-3.5 py-1.5 text-xs font-bold bg-[#FFB7B2] text-[#4A3E3D] disabled:opacity-50"
                >
                  이 가구로 선택
                </button>
              </div>
            </div>
          )}

          {targetLocation === currentLocation && (
            <p className="text-xs text-amber-600 font-medium text-center">
              ⚠️ 현재 위치와 다른 위치를 선택해주세요.
            </p>
          )}
        </div>

        {/* 하단 액션 버튼 */}
        <div className="flex gap-3 pt-3 border-t border-[#F4EEEA]">
          <button
            type="button"
            onClick={onClose}
            className="fluffy-button flex-1 py-3.5 px-4 bg-[#FAF8F5] font-bold text-sm text-[#806F6D]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isLocationValid}
            className="fluffy-button flex-1 py-3.5 px-4 bg-[#FFB7B2] font-extrabold text-sm text-[#4A3E3D] disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_8px_20px_rgba(255,183,178,0.35)]"
          >
            {targetLocation ? `[${targetLocation}]으로 ` : ''}이동하기
          </button>
        </div>
      </div>
    </div>
  );
}
