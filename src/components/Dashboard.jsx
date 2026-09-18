import { useState, useMemo } from 'react';
import ItemCard from './ItemCard';

const categoryEmojis = {
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

export default function Dashboard({ items, stats, onUpdate, onUpdateMultiple, onRemove }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('active'); // active | archived | discarded | all

  // 필터링 로직
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 상태 필터
      if (selectedStatus !== 'all' && item.status !== selectedStatus) {
        return false;
      }
      // 카테고리 필터
      if (selectedCategory && item.category !== selectedCategory) {
        return false;
      }
      // 위치 필터
      if (selectedLocation && item.location !== selectedLocation) {
        return false;
      }
      return true;
    });
  }, [items, selectedStatus, selectedCategory, selectedLocation]);

  const clearAllFilters = () => {
    setSelectedCategory(null);
    setSelectedLocation(null);
    setSelectedStatus('active');
  };

  const isFiltered = Boolean(selectedCategory || selectedLocation || selectedStatus !== 'active');
  const [recalibrateNotice, setRecalibrateNotice] = useState(null);

  const handleBatchRecalibrate = (referenceItem, updatedList) => {
    const sizeOrder = ['tiny', 'small', 'medium', 'large'];

    // 기존 크기와 새 크기 비교
    const originalRef = items.find((i) => i.id === referenceItem.id);
    const oldIdx = sizeOrder.indexOf(originalRef?.size || 'small');
    const newIdx = sizeOrder.indexOf(referenceItem.size || 'small');
    const delta = newIdx !== -1 && oldIdx !== -1 ? newIdx - oldIdx : -1; // 기본은 1단계 하향/상향

    const idMap = new Map();
    const nameMap = new Map();

    updatedList.forEach((u) => {
      if (u.id) idMap.set(String(u.id), u.size);
      if (u.name) nameMap.set(u.name.trim().toLowerCase(), u.size);
    });

    // 대상 물건들 (같은 위치 우선, 없으면 다른 모든 물건들)
    const sameLocItems = items.filter(
      (o) => o.id !== referenceItem.id && o.location === referenceItem.location
    );
    const targetItems = sameLocItems.length > 0
      ? sameLocItems
      : items.filter((o) => o.id !== referenceItem.id);

    const itemsToUpdate = [];
    let changedCount = 0;

    // 1. 기준 물건
    itemsToUpdate.push(referenceItem);

    // 2. 다른 물건들의 크기 매칭 및 상대 보정
    targetItems.forEach((item) => {
      let calculatedSize =
        idMap.get(String(item.id)) ||
        nameMap.get(item.name.trim().toLowerCase());

      // AI 응답에 없거나 크기가 동일해서 변화가 없다면, 기준 물건의 delta를 적용하여 상대적 비례 보정!
      if (!calculatedSize || calculatedSize === item.size) {
        const curIdx = sizeOrder.indexOf(item.size || 'small');
        if (curIdx !== -1 && delta !== 0) {
          const adjustedIdx = Math.max(0, Math.min(3, curIdx + delta));
          calculatedSize = sizeOrder[adjustedIdx];
        }
      }

      if (calculatedSize && calculatedSize !== item.size) {
        changedCount++;
        itemsToUpdate.push({ id: item.id, size: calculatedSize });
      } else if (calculatedSize) {
        itemsToUpdate.push({ id: item.id, size: calculatedSize });
      }
    });

    if (onUpdateMultiple) {
      onUpdateMultiple(itemsToUpdate);
    } else {
      itemsToUpdate.forEach((up) => onUpdate(up.id, up));
    }

    setRecalibrateNotice({
      refName: referenceItem.name,
      count: changedCount > 0 ? changedCount : targetItems.length,
    });
  };

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="text-7xl p-6 bg-indigo-50 rounded-3xl mb-2">📋</div>
        <h3 className="text-2xl font-extrabold text-gray-900">아직 등록된 물건이 없어요</h3>
        <p className="text-base text-gray-500 max-w-xs">
          카메라 탭에서 방 안의 물건을 사진 찍어서 등록해보세요!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* 4개 통계 카드 (클릭 시 상태별 필터링) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'all' ? 'active' : 'all')}
          className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all text-center ${
            selectedStatus === 'all'
              ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/50 scale-[1.02]'
              : 'border-gray-200 hover:border-indigo-200'
          }`}
        >
          <div className="text-3xl sm:text-4xl font-extrabold text-indigo-600">{stats.total}</div>
          <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">전체 물건</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus('active')}
          className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all text-center ${
            selectedStatus === 'active'
              ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/50 scale-[1.02]'
              : 'border-gray-200 hover:border-emerald-200'
          }`}
        >
          <div className="text-3xl sm:text-4xl font-extrabold text-emerald-600">{stats.active}</div>
          <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">보관 중</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'archived' ? 'active' : 'archived')}
          className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all text-center ${
            selectedStatus === 'archived'
              ? 'ring-2 ring-amber-500 border-amber-500 bg-amber-50/50 scale-[1.02]'
              : 'border-gray-200 hover:border-amber-200'
          }`}
        >
          <div className="text-3xl sm:text-4xl font-extrabold text-amber-600">{stats.archived}</div>
          <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">보관함 이동</div>
        </button>

        <button
          type="button"
          onClick={() => setSelectedStatus(selectedStatus === 'discarded' ? 'active' : 'discarded')}
          className={`bg-white rounded-2xl p-4 sm:p-5 shadow-sm border transition-all text-center ${
            selectedStatus === 'discarded'
              ? 'ring-2 ring-rose-500 border-rose-500 bg-rose-50/50 scale-[1.02]'
              : 'border-gray-200 hover:border-rose-200'
          }`}
        >
          <div className="text-3xl sm:text-4xl font-extrabold text-rose-600">{stats.discarded}</div>
          <div className="text-xs sm:text-sm font-bold text-gray-600 mt-1">폐기 예정</div>
        </button>
      </div>

      {/* 카테고리별 필터 (클릭 시 해당 카테고리만 보기) */}
      {Object.keys(stats.categories).length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              📊 카테고리별 <span className="text-xs font-normal text-gray-500">(클릭하여 모아보기)</span>
            </h3>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full hover:bg-indigo-100"
              >
                카테고리 필터 해제 ✕
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(stats.categories)
              .sort(([, a], [, b]) => b - a)
              .map(([cat, count]) => {
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setSelectedCategory(isSelected ? null : cat)}
                    className={`flex items-center justify-between p-2.5 sm:p-3 rounded-xl transition-all text-left ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-md scale-[1.01]'
                        : 'bg-slate-50 hover:bg-slate-100 text-gray-800'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl">{categoryEmojis[cat] || '📦'}</span>
                      <span className="text-sm sm:text-base font-semibold">{cat}</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <div className={`w-16 sm:w-24 h-2 rounded-full overflow-hidden ${isSelected ? 'bg-indigo-400' : 'bg-gray-200'}`}>
                        <div
                          className={`h-full rounded-full ${isSelected ? 'bg-white' : 'bg-indigo-500'}`}
                          style={{ width: `${(count / stats.total) * 100}%` }}
                        />
                      </div>
                      <span className={`text-sm sm:text-base font-bold min-w-[24px] text-right ${isSelected ? 'text-white' : 'text-gray-600'}`}>
                        {count}
                      </span>
                    </div>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* 위치별 필터 (클릭 시 해당 위치만 보기) */}
      {Object.keys(stats.locations).length > 0 && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="text-base sm:text-lg font-bold text-gray-900">
              📍 위치별 <span className="text-xs font-normal text-gray-500">(클릭하여 모아보기)</span>
            </h3>
            {selectedLocation && (
              <button
                type="button"
                onClick={() => setSelectedLocation(null)}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full hover:bg-indigo-100"
              >
                위치 필터 해제 ✕
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2.5">
            {Object.entries(stats.locations)
              .sort(([, a], [, b]) => b - a)
              .map(([loc, count]) => {
                const isSelected = selectedLocation === loc;
                return (
                  <button
                    type="button"
                    key={loc}
                    onClick={() => setSelectedLocation(isSelected ? null : loc)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-md ring-2 ring-indigo-300 scale-105'
                        : 'bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
                    }`}
                  >
                    <span>📍 {loc}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs ${isSelected ? 'bg-indigo-800 text-white' : 'bg-white text-indigo-600'}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
          </div>
        </div>
      )}

      {/* 현재 적용된 필터 알림 바 */}
      {isFiltered && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap text-sm sm:text-base font-bold text-indigo-900">
            <span>🔎 필터 적용:</span>
            {selectedCategory && (
              <span className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                카테고리: {selectedCategory}
              </span>
            )}
            {selectedLocation && (
              <span className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                위치: {selectedLocation}
              </span>
            )}
            {selectedStatus !== 'active' && (
              <span className="bg-white px-2.5 py-1 rounded-lg border border-indigo-200">
                상태: {selectedStatus === 'all' ? '전체 상태' : selectedStatus === 'archived' ? '보관함' : '폐기'}
              </span>
            )}
            <span className="text-indigo-600">({filteredItems.length}개 발견)</span>
          </div>
          <button
            type="button"
            onClick={clearAllFilters}
            className="text-xs sm:text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 px-3.5 py-2 rounded-xl shrink-0 transition-colors shadow-sm"
          >
            전체 보기 ↺
          </button>
        </div>
      )}

      {/* 상대적 크기 보정 완료 알림 배너 */}
      {recalibrateNotice && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="text-2xl">✨</span>
            <div className="text-sm text-emerald-900">
              <span className="font-bold">'{recalibrateNotice.refName}'</span> 기준 상대적 크기 자동 보정 완료!
              <p className="text-xs text-emerald-700 mt-0.5">
                같은 위치의 다른 <b>{recalibrateNotice.count}개</b> 물건 크기가 상대적 비례에 맞춰 조정되었습니다.
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
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg sm:text-xl font-extrabold text-gray-900">
            🗂️ 물건 목록 ({filteredItems.length}개)
          </h3>
          <span className="text-xs sm:text-sm text-gray-500">
            ✏️ 클릭하여 수정 (상대 크기 자동 계산)
          </span>
        </div>

        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 border border-gray-200 text-center space-y-3">
            <p className="text-base text-gray-500 font-medium">선택한 필터 조건에 해당하는 물건이 없습니다.</p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl hover:bg-indigo-100"
            >
              모든 물건 보기
            </button>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredItems.map((item) => {
              const sameLoc = items.filter((o) => o.id !== item.id && o.location === item.location);
              const targetOthers = sameLoc.length > 0 ? sameLoc : items.filter((o) => o.id !== item.id);
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  otherItems={targetOthers}
                  onBatchRecalibrate={handleBatchRecalibrate}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
