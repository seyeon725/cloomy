import { useState, useMemo } from 'react';
import ItemCard from './ItemCard';
import { FURNITURE, slotCount, slotName, FLOOR_LOCATION } from '../hooks/useRoom';
import DuplicateResolutionModal from './DuplicateResolutionModal';
import { findDuplicateCandidate } from '../utils/duplicate';

export default function ItemList({
  items,
  onSave,
  onCancel,
  roomFurniture = [],
  cancelLabel = '다시 찍기',
  existingItems = [],
  onAddSlot,
}) {
  // --- Location selection ---
  const [selectedFurnitureId, setSelectedFurnitureId] = useState(null);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(null);
  const [location, setLocation] = useState('');

  // --- New furniture creation ---
  const [showNewForm, setShowNewForm] = useState(false);
  const [newType, setNewType] = useState('drawers');
  const [newName, setNewName] = useState('');
  const [pendingNew, setPendingNew] = useState(null);

  // --- Item state ---
  const [itemStateList, setItemStateList] = useState(
    items.map((item) => ({ ...item, selected: true }))
  );
  const [recalibrateNotice, setRecalibrateNotice] = useState(null);

  const allFurniture = useMemo(() => {
    const list = [...roomFurniture];
    if (pendingNew) list.push(pendingNew);
    return list;
  }, [roomFurniture, pendingNew]);

  const selectedFurniture = allFurniture.find(f => f.id === selectedFurnitureId);

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
      setLocation(slotName(updated, nextSlots - 1));
      return;
    }

    if (onAddSlot) {
      const nextIndex = onAddSlot(furniture.id);
      setSelectedSlotIndex(nextIndex);
      setLocation(slotName(furniture, nextIndex));
    }
  };

  const selectFurniture = (f) => {
    if (selectedFurnitureId === f.id) {
      setSelectedFurnitureId(null);
      setSelectedSlotIndex(null);
      setLocation('');
      return;
    }
    setShowNewForm(false);
    setSelectedFurnitureId(f.id);
    const slots = effectiveSlots(f);
    if (slots === 0) {
      setSelectedSlotIndex(null);
      setLocation(f.name);
    } else if (slots === 1) {
      setSelectedSlotIndex(0);
      setLocation(slotName(f, 0));
    } else {
      setSelectedSlotIndex(null);
      setLocation('');
    }
  };

  const selectSlot = (index) => {
    if (!selectedFurniture) return;
    setSelectedSlotIndex(index);
    setLocation(slotName(selectedFurniture, index));
  };

  const selectFloor = () => {
    setShowNewForm(false);
    setSelectedFurnitureId('floor-storage');
    setSelectedSlotIndex(null);
    setLocation(FLOOR_LOCATION);
  };

  const openNewForm = () => {
    const type = newType;
    let n = 1;
    const label = FURNITURE[type].label;
    while (allFurniture.some(f => f.name === `${label} ${n}`)) n++;
    setNewName(`${label} ${n}`);
    setShowNewForm(true);
  };

  const confirmNew = () => {
    const name = newName.trim();
    if (!name) return;
    const f = { id: `pending-${Date.now()}`, type: newType, name, isPending: true, x: 0, y: 0, rotated: false, slots: 1 };
    setPendingNew(f);
    setShowNewForm(false);
    setSelectedFurnitureId(f.id);
    setSelectedSlotIndex(0);
    setLocation(slotName(f, 0));
  };

  const toggleItem = (index) => {
    setItemStateList((prev) =>
      prev.map((item, i) => (i === index ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleEditItem = (index, updatedItem) => {
    setItemStateList((prev) =>
      prev.map((item, i) => (i === index ? { ...updatedItem, selected: item.selected } : item))
    );
  };

  const handleBatchRecalibrate = (referenceItem, updatedList) => {
    let changedCount = 0;
    const sizeMap = new Map();
    updatedList.forEach((u) => sizeMap.set(u.name, u.size));
    setItemStateList((prev) =>
      prev.map((item) => {
        if (item.name === referenceItem.name) return { ...referenceItem, selected: item.selected };
        const newSize = sizeMap.get(item.name);
        if (newSize && newSize !== item.size) { changedCount++; return { ...item, size: newSize }; }
        return item;
      })
    );
    setRecalibrateNotice({ refName: referenceItem.name, newSize: referenceItem.size, count: changedCount });
  };

  const isLocationValid = Boolean(location);
  const selectedCount = itemStateList.filter((i) => i.selected).length;

  const [pendingConflicts, setPendingConflicts] = useState(null);
  const [pendingSaveContext, setPendingSaveContext] = useState(null);

  const handleSave = () => {
    if (!isLocationValid) { alert('물건이 위치한 가구와 칸을 선택해주세요!'); return; }
    if (selectedCount === 0) { alert('등록할 물건을 하나 이상 선택해주세요!'); return; }
    const selected = itemStateList.filter((item) => item.selected);
    const meta = {};
    if (pendingNew && selectedFurnitureId === pendingNew.id) {
      meta.newFurniture = {
        type: pendingNew.type,
        name: pendingNew.name,
        slots: pendingNew.slots || 1,
      };
    } else if (selectedFurniture && selectedSlotIndex !== null && selectedFurnitureId !== 'floor-storage') {
      meta.furnitureId = selectedFurnitureId;
      meta.slotIndex = selectedSlotIndex;
    }

    // 기존 물건과 중복/유사 물건 감지
    const conflicts = [];
    const nonConflicts = [];

    for (const item of selected) {
      const match = findDuplicateCandidate(item, existingItems);
      if (match) {
        conflicts.push({
          newItem: item,
          existingItem: match.existing,
          reason: match.reason,
        });
      } else {
        nonConflicts.push(item);
      }
    }

    if (conflicts.length > 0) {
      setPendingConflicts(conflicts);
      setPendingSaveContext({ selected, location, meta, nonConflicts });
    } else {
      onSave(selected, location, meta);
    }
  };

  const handleResolveConflicts = (decisions) => {
    if (!pendingSaveContext) return;
    const { location: loc, meta, nonConflicts } = pendingSaveContext;
    const itemsToAdd = [...nonConflicts];
    const itemsToUpdate = [];

    pendingConflicts.forEach((conflict, idx) => {
      const decision = decisions[idx] || 'create_both';
      const { newItem, existingItem } = conflict;

      if (decision === 'create_both') {
        // 각각 다른 물건으로 둘 다 보관 -> 새 물건으로 추가 등록
        itemsToAdd.push(newItem);
      } else if (decision === 'update_existing') {
        // 새 정보로 변경 -> 기존 물건 업데이트
        itemsToUpdate.push({
          id: existingItem.id,
          name: newItem.name || existingItem.name,
          category: newItem.category || existingItem.category,
          size: newItem.size || existingItem.size,
          description: newItem.description || existingItem.description,
          location: loc || existingItem.location,
          usage: newItem.usage || existingItem.usage || 'frequent',
          imageUrl: newItem.imageUrl || existingItem.imageUrl,
        });
      } else if (decision === 'keep_existing') {
        // 원래 것만 유지 -> 새 물건은 추가하지 않음
      }
    });

    setPendingConflicts(null);
    setPendingSaveContext(null);

    onSave(itemsToAdd, loc, meta, { itemsToAdd, itemsToUpdate });
  };

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* ===== Location selector ===== */}
      <div className="fluffy-card p-5">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-base sm:text-lg font-bold text-[#4A3E3D]">📍 어디에 보관하나요?</h3>
          {location && <span className="text-xs sm:text-sm font-bold px-3 py-1 bg-[#FFF0EE] text-[#B56562] rounded-full truncate max-w-[160px]">{location}</span>}
        </div>

        {/* Furniture buttons */}
        <div className="flex flex-wrap gap-2.5">
          <button type="button" onClick={selectFloor} className={`fluffy-button px-4 py-2.5 text-sm font-semibold ${selectedFurnitureId === 'floor-storage' ? 'bg-[#FFB7B2] text-[#4A3E3D] shadow-[0_8px_20px_rgba(255,183,178,0.35)]' : 'bg-[#FAF8F5] text-[#806F6D]'}`}>바닥 보관</button>
          {allFurniture.map(f => (
            <button key={f.id} type="button" onClick={() => selectFurniture(f)} className={`fluffy-button px-4 py-2.5 text-sm font-semibold ${selectedFurnitureId === f.id ? 'bg-[#FFB7B2] text-[#4A3E3D] shadow-[0_8px_20px_rgba(255,183,178,0.35)]' : 'bg-[#FAF8F5] text-[#806F6D]'}`}>
              {f.name}{f.isPending ? ' ✨' : ''}
            </button>
          ))}
          <button type="button" onClick={openNewForm} className="fluffy-button px-4 py-2.5 text-sm font-semibold bg-[#FAF8F5] text-[#806F6D]">+ 새 가구 추가</button>
        </div>

        {/* Slot sub-selector & add slot button */}
        {selectedFurniture && selectedFurnitureId !== 'floor-storage' && (
          <div className="flex flex-wrap items-center gap-2 mt-3.5 pl-4 border-l-3 border-[#FFDAC1] animate-fadeIn">
            <span className="text-xs text-[#806F6D] font-extrabold flex items-center gap-1 shrink-0 mr-1">
              <span>📂</span>
              <span>{selectedFurniture.name} 칸 선택:</span>
            </span>

            {effectiveSlots(selectedFurniture) > 0 ? (
              Array.from({ length: effectiveSlots(selectedFurniture) }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectSlot(i)}
                  className={`fluffy-button px-3.5 py-2 text-xs sm:text-sm font-semibold transition-all ${
                    selectedSlotIndex === i
                      ? 'bg-[#FFDAC1] text-[#4A3E3D] shadow-[0_6px_16px_rgba(255,218,193,0.45)] ring-2 ring-[#FF9E99] font-bold'
                      : 'bg-white text-[#806F6D] border border-[#F0E8E2] hover:bg-[#FFF5EE]'
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

            {/* + 칸 추가 버튼 */}
            <button
              type="button"
              onClick={() => handleAddSlotClick(selectedFurniture)}
              className="fluffy-button px-3 py-2 text-xs sm:text-sm font-bold rounded-xl bg-[#FFF0EE] hover:bg-[#FFE5E0] text-[#B56562] border border-[#FFD0CC] flex items-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
              title={`${selectedFurniture.name}에 새 칸을 추가하고 바로 선택해요`}
            >
              <span>+ 칸 추가</span>
            </button>
          </div>
        )}

        {/* New furniture form */}
        {showNewForm && (
          <div className="mt-3 p-4 bg-[#FFF9F5] rounded-2xl space-y-3">
            <p className="text-sm font-bold text-[#4A3E3D]">새 가구 추가</p>
            <div className="flex gap-2">
              <select value={newType} onChange={e => { const t = e.target.value; setNewType(t); let n = 1; const l = FURNITURE[t].label; while (allFurniture.some(f => f.name === `${l} ${n}`)) n++; setNewName(`${l} ${n}`); }} className="fluffy-input px-3 py-2.5 text-sm font-medium">
                {Object.entries(FURNITURE).map(([t, c]) => <option key={t} value={t}>{c.label}</option>)}
              </select>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) confirmNew(); }} placeholder="가구 이름" className="fluffy-input flex-1 px-3 py-2.5 text-sm font-medium" autoFocus />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setShowNewForm(false)} className="fluffy-button px-4 py-2 text-sm font-semibold bg-white text-[#806F6D]">취소</button>
              <button type="button" onClick={confirmNew} disabled={!newName.trim()} className="fluffy-button px-4 py-2 text-sm font-bold bg-[#FFB7B2] text-[#4A3E3D] disabled:opacity-50">추가</button>
            </div>
          </div>
        )}
      </div>

      {/* ===== Recalibrate notice ===== */}
      {recalibrateNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div className="text-sm text-emerald-900">
              <span className="font-bold">&apos;{recalibrateNotice.refName}&apos;</span> 기준 상대적 크기 자동 보정 완료!
              <p className="text-xs text-emerald-700 mt-0.5">사진 속 다른 <b>{recalibrateNotice.count}개</b> 물건의 크기가 비례에 맞춰 조정되었습니다.</p>
            </div>
          </div>
          <button type="button" onClick={() => setRecalibrateNotice(null)} className="text-emerald-700 hover:text-emerald-900 font-bold text-sm px-2.5 py-1 rounded-lg bg-white/70">확인 ✕</button>
        </div>
      )}

      {/* ===== Item list ===== */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base sm:text-lg font-bold text-[#4A3E3D]">인식된 물건 ({selectedCount}/{itemStateList.length})</h3>
          <span className="text-xs sm:text-sm text-gray-500">✏️ 수정 시 상대적 크기 자동 계산 지원</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-5">
          {itemStateList.map((item, index) => (
            <div key={index} className={`rounded-[24px] transition-all relative ${item.selected ? 'ring-4 ring-[#FFDAC1] shadow-[0_10px_30px_rgba(74,62,61,0.06)]' : 'opacity-40 grayscale bg-[#FAF8F5]'}`}>
              <div className="relative h-full">
                <ItemCard
                  item={{ ...item, location: location || '선택 대기' }}
                  viewMode="block"
                  onDirectEdit={(updated) => handleEditItem(index, updated)}
                  otherItems={itemStateList}
                  onBatchRecalibrate={handleBatchRecalibrate}
                  roomFurniture={allFurniture}
                  onAddSlot={onAddSlot}
                />
                <button type="button" onClick={() => toggleItem(index)} className="fluffy-button absolute bottom-3 right-3 text-xs font-bold px-3 py-1.5 bg-white shadow-[0_6px_18px_rgba(74,62,61,0.1)] z-10">
                  {item.selected ? '✅ 등록 포함' : '❌ 제외됨'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== Actions ===== */}
      <div className="sticky bottom-20 bg-white/95 backdrop-blur-md p-4 rounded-[28px] shadow-[0_12px_32px_rgba(74,62,61,0.12)] flex flex-col gap-2.5 z-40">
        {!isLocationValid && <p className="text-xs sm:text-sm text-amber-600 font-bold text-center">⚠️ 상단에서 가구와 칸을 선택해주세요</p>}
        <div className="flex gap-3">
          <button type="button" onClick={onCancel} className="fluffy-button px-6 py-4 bg-[#FAF8F5] text-[#806F6D] font-bold text-base">{cancelLabel}</button>
          <button type="button" onClick={handleSave} disabled={!isLocationValid || selectedCount === 0} className="fluffy-button flex-1 px-5 py-4 bg-[#FFB7B2] text-[#4A3E3D] font-extrabold text-base sm:text-lg disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_10px_24px_rgba(255,183,178,0.4)]">
            {location ? `[${location}]에 ` : ''}{selectedCount}개 등록하기
          </button>
        </div>
      </div>

      {/* ===== Duplicate / Overlap Resolution Modal ===== */}
      {pendingConflicts && (
        <DuplicateResolutionModal
          conflicts={pendingConflicts}
          targetLocation={location}
          onConfirm={handleResolveConflicts}
          onClose={() => {
            setPendingConflicts(null);
            setPendingSaveContext(null);
          }}
        />
      )}
    </div>
  );
}
