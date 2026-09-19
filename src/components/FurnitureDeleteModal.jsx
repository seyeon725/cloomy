import { useState, useMemo } from 'react';
import { slotCount, slotName, FLOOR_LOCATION } from '../hooks/useRoom';

export default function FurnitureDeleteModal({
  furniture,
  items,
  otherFurniture = [],
  onConfirm,
  onClose,
}) {
  const destinationOptions = useMemo(() => {
    const options = [
      { value: '미분류', label: '미분류 (나중에 정리)' },
      { value: FLOOR_LOCATION, label: `📍 ${FLOOR_LOCATION}` },
    ];
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
  }, [otherFurniture]);

  const [moveMap, setMoveMap] = useState(() => {
    const initial = {};
    items.forEach((item) => {
      initial[item.id] = '미분류';
    });
    return initial;
  });

  const handleSetAllToUnclassified = () => {
    const allUnclassified = {};
    items.forEach((item) => {
      allUnclassified[item.id] = '미분류';
    });
    setMoveMap(allUnclassified);
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
              🗑️ &apos;{furniture.name}&apos; 가구 삭제
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

        <div className="py-3 flex items-center justify-between">
          <span className="text-xs text-[#9A8784]">물건별로 위치를 하나씩 고를 수 있어요</span>
          <button
            type="button"
            onClick={handleSetAllToUnclassified}
            className="fluffy-button text-xs font-bold px-3 py-1.5 bg-[#FFF0EE] text-[#B56562] hover:bg-[#FFE5E1]"
          >
            ⚡ 전부 미분류로 이동
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 my-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 bg-[#FAF8F5] rounded-2xl border border-[#F1ECE6]"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-2xl shrink-0">{item.emoji || '📦'}</span>
                <div className="min-w-0">
                  <span className="block text-sm font-bold text-[#4A3E3D] truncate">
                    {item.name}
                  </span>
                  <span className="text-xs text-[#9A8784]">
                    현재 위치: {item.location || '이 가구'}
                  </span>
                </div>
              </div>

              <select
                value={moveMap[item.id] || '미분류'}
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
            이동하고 가구 삭제
          </button>
        </div>
      </div>
    </div>
  );
}
