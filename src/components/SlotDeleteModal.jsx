import { useState, useMemo } from 'react';
import { slotCount, slotName, FLOOR_LOCATION } from '../hooks/useRoom';

const CATEGORY_EMOJIS = {
  '옷': '👕',
  '화장품': '💄',
  '책/서류': '📚',
  '전자기기': '🔌',
  '생활용품': '🧴',
  '식품': '🍎',
  '취미': '🎨',
  '문구': '✏️',
  '잡화': '📦',
  '기타': '🔹',
};

const getItemIcon = (item) => {
  if (!item) return '📦';
  return CATEGORY_EMOJIS[item.category] || item.emoji || '📦';
};

export default function SlotDeleteModal({
  furniture,
  slotIndex,
  slotLabel,
  items,
  nextSlots,
  otherFurniture = [],
  onConfirm,
  onClose,
}) {
  const destinationOptions = useMemo(() => {
    const options = [
      { value: '미분류', label: '미분류 (나중에 정리)' },
      { value: FLOOR_LOCATION, label: `📍 ${FLOOR_LOCATION}` },
    ];

    // 현재 가구의 남은 다른 칸들
    if (nextSlots > 0) {
      for (let i = 0; i < nextSlots; i++) {
        const loc = slotName(furniture, i);
        options.push({ value: loc, label: `📥 ${loc} (현재 가구)` });
      }
    } else {
      // 칸이 0개가 되는 경우 가구 자체에 보관할 수 있는 옵션
      options.push({ value: furniture.name, label: `📥 ${furniture.name} (칸 구분 없음)` });
    }

    // 방의 다른 가구들
    otherFurniture.forEach((f) => {
      const count = slotCount(f);
      if (count <= 0) {
        options.push({ value: f.name, label: `📦 ${f.name}` });
      } else {
        for (let i = 0; i < count; i++) {
          const loc = slotName(f, i);
          options.push({ value: loc, label: `📦 ${loc}` });
        }
      }
    });

    return options;
  }, [furniture, nextSlots, otherFurniture]);

  // 기본 목적지: 남은 칸이 있으면 바로 이전 칸, 없으면 '미분류'
  const defaultTarget = useMemo(() => {
    if (nextSlots > 0) {
      return slotName(furniture, nextSlots - 1);
    }
    return '미분류';
  }, [furniture, nextSlots]);

  const [moveMap, setMoveMap] = useState(() => {
    const initial = {};
    items.forEach((item) => {
      initial[item.id] = defaultTarget;
    });
    return initial;
  });

  const handleSetAllTo = (target) => {
    const updated = {};
    items.forEach((item) => {
      updated[item.id] = target;
    });
    setMoveMap(updated);
  };

  const handleChangeDestination = (itemId, targetLocation) => {
    setMoveMap((prev) => ({ ...prev, [itemId]: targetLocation }));
  };

  const handleConfirm = () => {
    onConfirm(moveMap);
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

        <div className="flex items-start justify-between pb-3 border-b border-[#F4EEEA]">
          <div>
            <h2 className="text-xl font-extrabold text-[#4A3E3D]">
              🗑️ &apos;{slotLabel || `${slotIndex + 1}번째 칸`}&apos; 삭제
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#806F6D]">
              보관 중인 물건 <b>{items.length}개</b>를 어디로 옮길까요?
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl px-2"
          >
            ✕
          </button>
        </div>

        <div className="py-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs text-[#9A8784]">물건별로 위치를 하나씩 고를 수 있어요</span>
          <div className="flex gap-2">
            {nextSlots > 0 && (
              <button
                type="button"
                onClick={() => handleSetAllTo(slotName(furniture, nextSlots - 1))}
                className="fluffy-button text-xs font-bold px-2.5 py-1.5 bg-[#FFF4E6] text-[#C27D38] hover:bg-[#FFECCF]"
              >
                📥 전부 {nextSlots}번째 칸으로
              </button>
            )}
            <button
              type="button"
              onClick={() => handleSetAllTo('미분류')}
              className="fluffy-button text-xs font-bold px-2.5 py-1.5 bg-[#FFF0EE] text-[#B56562] hover:bg-[#FFE5E1]"
            >
              ⚡ 전부 미분류로
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 my-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[#FAF8F5] rounded-2xl border border-[#F1ECE6]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">{getItemIcon(item)}</span>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-[#4A3E3D] truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-[#9A8784]">
                    현재 위치: {item.location || slotLabel}
                  </span>
                </div>
              </div>

              <select
                value={moveMap[item.id] || defaultTarget}
                onChange={(e) => handleChangeDestination(item.id, e.target.value)}
                className="fluffy-input text-xs font-semibold px-3 py-2 bg-white text-[#4A3E3D] border border-[#E6DCD4] rounded-xl shrink-0 max-w-full sm:max-w-[210px]"
              >
                {destinationOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="flex gap-3 pt-4 mt-2 border-t border-[#F4EEEA]">
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
            className="fluffy-button flex-1 py-3.5 px-4 bg-[#FFB7B2] font-extrabold text-sm text-[#4A3E3D] shadow-[0_8px_20px_rgba(255,183,178,0.35)]"
          >
            이동하고 칸 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
