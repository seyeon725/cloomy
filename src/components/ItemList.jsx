import { useState } from 'react';
import ItemCard from './ItemCard';

const DEFAULT_LOCATIONS = [
  '책상 위',
  '서랍',
  '메인 책장',
  '화장대',
  '옷장',
  '주방 선반',
  '신발장',
  '거실',
];

export default function ItemList({ items, onSave, onCancel, existingLocations = [] }) {
  const allLocations = [
    ...new Set([...DEFAULT_LOCATIONS, ...existingLocations]),
  ];

  const [location, setLocation] = useState(allLocations[0] || '책상 위');
  const [customLocation, setCustomLocation] = useState('');
  const [itemStateList, setItemStateList] = useState(
    items.map((item) => ({ ...item, selected: true }))
  );
  const [recalibrateNotice, setRecalibrateNotice] = useState(null);

  const toggleItem = (index) => {
    setItemStateList((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, selected: !item.selected } : item
      )
    );
  };

  const handleEditItem = (index, updatedItem) => {
    setItemStateList((prev) =>
      prev.map((item, i) => (i === index ? { ...updatedItem, selected: item.selected } : item))
    );
  };

  // 상대적 크기 AI 일괄 보정 핸들러
  const handleBatchRecalibrate = (referenceItem, updatedList) => {
    let changedCount = 0;
    const sizeMap = new Map();
    updatedList.forEach((u) => {
      sizeMap.set(u.name, u.size);
    });

    setItemStateList((prev) =>
      prev.map((item) => {
        if (item.name === referenceItem.name) {
          return { ...referenceItem, selected: item.selected };
        }
        const newSize = sizeMap.get(item.name);
        if (newSize && newSize !== item.size) {
          changedCount++;
          return { ...item, size: newSize };
        }
        return item;
      })
    );

    setRecalibrateNotice({
      refName: referenceItem.name,
      newSize: referenceItem.size,
      count: changedCount,
    });
  };

  const finalLocation = location === '__custom__' ? customLocation.trim() : location;
  const isLocationValid = Boolean(finalLocation);
  const selectedCount = itemStateList.filter((i) => i.selected).length;

  const handleSave = () => {
    if (!isLocationValid) {
      alert('물건이 위치한 곳(예: 책상 위, 서랍 등)을 선택하거나 입력해주세요!');
      return;
    }
    if (selectedCount === 0) {
      alert('등록할 물건을 하나 이상 선택해주세요!');
      return;
    }
    const selected = itemStateList.filter((item) => item.selected);
    onSave(selected, finalLocation);
  };

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Location selector */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-3.5">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            📍 어디에 있는 물건들인가요?
          </h3>
          {finalLocation && (
            <span className="text-xs sm:text-sm font-bold px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full">
              {finalLocation}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2.5 mb-3">
          {allLocations.map((loc) => (
            <button
              key={loc}
              type="button"
              onClick={() => setLocation(loc)}
              className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
                location === loc
                  ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 scale-105'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {loc}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLocation('__custom__')}
            className={`px-4 py-2.5 rounded-full text-sm font-semibold transition-all ${
              location === '__custom__'
                ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 scale-105'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            + 직접 입력
          </button>
        </div>
        {location === '__custom__' && (
          <input
            type="text"
            value={customLocation}
            onChange={(e) => setCustomLocation(e.target.value)}
            placeholder="위치를 직접 입력하세요 (예: 책장 3번째 칸)"
            autoFocus
            className="w-full px-4 py-3 text-base rounded-xl border border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-2 font-medium"
          />
        )}
      </div>

      {/* 상대적 크기 보정 완료 알림 배너 */}
      {recalibrateNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div className="text-sm text-emerald-900">
              <span className="font-bold">'{recalibrateNotice.refName}'</span> 기준 상대적 크기 자동 보정 완료!
              <p className="text-xs text-emerald-700 mt-0.5">
                사진 속 다른 <b>{recalibrateNotice.count}개</b> 물건의 크기가 비례에 맞춰 조정되었습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setRecalibrateNotice(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold text-sm px-2.5 py-1 rounded-lg bg-white/70"
          >
            확인 ✕
          </button>
        </div>
      )}

      {/* Item list */}
      <div className="space-y-3.5">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            인식된 물건 ({selectedCount}/{itemStateList.length})
          </h3>
          <span className="text-xs sm:text-sm text-gray-500">
            ✏️ 수정 시 상대적 크기 자동 계산 지원
          </span>
        </div>

        {itemStateList.map((item, index) => (
          <div
            key={index}
            className={`rounded-2xl transition-all relative ${
              item.selected
                ? 'ring-2 ring-indigo-500 shadow-sm'
                : 'opacity-40 grayscale bg-gray-50'
            }`}
          >
            <div className="relative">
              <ItemCard
                item={{ ...item, location: finalLocation || '선택 대기' }}
                onDirectEdit={(updated) => handleEditItem(index, updated)}
                otherItems={itemStateList}
                onBatchRecalibrate={handleBatchRecalibrate}
              />
              {/* 선택 체크 토글 오버레이 버튼 */}
              <button
                type="button"
                onClick={() => toggleItem(index)}
                className="absolute bottom-3 right-3 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all bg-white shadow-sm hover:bg-gray-50"
              >
                {item.selected ? '✅ 등록 포함' : '❌ 제외됨'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Actions (Sticky bottom bar) */}
      <div className="sticky bottom-20 bg-white/95 backdrop-blur-md p-4 rounded-3xl shadow-xl border border-gray-200 flex flex-col gap-2.5 z-40">
        {!isLocationValid && (
          <p className="text-xs sm:text-sm text-amber-600 font-bold text-center">
            ⚠️ 상단에서 물건 위치를 선택하거나 입력해주세요
          </p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-6 py-4 rounded-2xl border-2 border-gray-300 text-gray-700 font-bold text-base hover:bg-gray-50 transition-colors"
          >
            다시 찍기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!isLocationValid || selectedCount === 0}
            className="flex-1 px-5 py-4 rounded-2xl bg-indigo-600 text-white font-extrabold text-base sm:text-lg hover:bg-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg active:scale-[0.99]"
          >
            {finalLocation ? `[${finalLocation}]에 ` : ''}{selectedCount}개 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}
