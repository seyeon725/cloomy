import { useState } from 'react';
import ItemEditModal from './ItemEditModal';
import Icon from './Icon';
import { USAGE_CONFIG } from '../hooks/useItems';

const sizeLabels = {
  tiny: '아주 작음',
  small: '작음',
  medium: '보통',
  large: '큼',
};

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

const statusColors = {
  active: 'bg-[#FFF0E5] text-[#A96845]',
  archived: 'bg-[#FFF5D9] text-[#9A6D25]',
  discarded: 'bg-[#FFE9E7] text-[#B55B59]',
  trading: 'bg-[#FFF0D8] text-[#A66E22]',
};

const statusLabels = {
  active: '보관 중',
  archived: '보관함 이동',
  discarded: '폐기 예정',
  trading: '거래 · 나눔 예정',
};

export default function ItemCard({
  item,
  onUpdate,
  onRemove,
  onDirectEdit,
  otherItems = [],
  onBatchRecalibrate,
  roomFurniture = [],
  viewMode = 'list',
  isDeclutterMode = false,
  isEditMode = false,
  isSelected = false,
  onToggleSelect,
  onAddSlot,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [imgError, setImgError] = useState(false);
  const emoji = categoryEmojis[item.category] || '📦';
  const isSelectMode = isDeclutterMode || isEditMode;

  const handleSaveEdit = (updatedItem) => {
    if (onDirectEdit) {
      onDirectEdit(updatedItem);
    } else if (onUpdate && item.id) {
      onUpdate(item.id, updatedItem);
    }
  };

  const handleUsageChange = (newUsage) => {
    if (onDirectEdit) {
      onDirectEdit({ ...item, usage: newUsage });
    } else if (onUpdate && item.id) {
      onUpdate(item.id, { usage: newUsage });
    }
  };

  const handleCardClick = () => {
    if (isSelectMode) {
      if (onToggleSelect) onToggleSelect(item.id);
    } else {
      setIsEditing(true);
    }
  };

  // -------------------------------------------------------------
  // 1. BLOCK VIEW (블록형: 널널하고 여유로운 카드 갤러리)
  // -------------------------------------------------------------
  if (viewMode === 'block') {
    return (
      <>
        <div
          onClick={handleCardClick}
          className={`fluffy-card p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(74,62,61,0.1)] flex flex-col justify-between h-full min-h-[285px] sm:min-h-[305px] bg-white relative border group cursor-pointer ${
            isSelected
              ? 'ring-2 ring-[#B56562] bg-[#FFF9F7] border-[#FFB7B2] shadow-sm'
              : 'border-[#F6EFEA]'
          }`}
        >
          {/* 선택 모드 체크박스 */}
          {isSelectMode && (
            <div className="absolute top-2.5 left-2.5 z-20">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black transition-all shadow-sm ${
                  isSelected
                    ? 'bg-[#B56562] text-white scale-110'
                    : 'border-2 border-[#D9CBC5] bg-white/95 text-transparent'
                }`}
              >
                ✓
              </div>
            </div>
          )}

          <div className="flex flex-col flex-1">
            {/* 썸네일 / 이모지 영역 */}
            <div className="w-full h-28 sm:h-32 rounded-xl bg-gradient-to-b from-[#FFF8F5] to-[#FFF1EB] border border-[#F2ECE6] relative overflow-hidden flex items-center justify-center mb-2.5 shrink-0">
              {!imgError && item.imageUrl ? (
                <img
                  src={item.imageUrl}
                  alt={item.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="text-4xl sm:text-5xl drop-shadow-xs transition-transform group-hover:scale-110 select-none">
                  {emoji}
                </span>
              )}

              {/* 카테고리 뱃지 (상단 좌측 오버레이) */}
              <span
                className={`absolute text-[11px] font-bold text-[#B56562] bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-full shadow-xs border border-[#FFDCD6] ${
                  isSelectMode ? 'top-2.5 left-9' : 'top-2.5 left-2.5'
                }`}
              >
                {item.category}
              </span>

              {/* 수정 버튼 (상단 우측 오버레이) */}
              {!isSelectMode && (onDirectEdit || onUpdate) && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  title="수정하기"
                  className="absolute top-2.5 right-2.5 p-1.5 rounded-full bg-white/95 text-[#9A8784] hover:text-[#B56562] shadow-xs hover:bg-white transition-all"
                >
                  <Icon name="pencil" size={13} />
                </button>
              )}
            </div>

            {/* 물건 이름: 2줄 규격 높이 */}
            <div className="min-h-[2.4rem] flex items-center">
              <h3
                className="text-xs sm:text-sm font-bold text-[#4A3E3D] break-words line-clamp-2 leading-snug"
                title={item.name}
              >
                {item.name}
              </h3>
            </div>

            {/* 위치 & 크기 칩 */}
            <div className="flex flex-wrap items-center gap-1 mt-2 min-h-[1.5rem]">
              <span
                className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#685957] border border-[#EDE5DE] truncate max-w-full flex items-center gap-1"
                title={item.location || '미분류'}
              >
                <Icon name="pin" size={10} className="shrink-0 text-[#B56562]" />
                <span className="truncate">{item.location || '미분류'}</span>
              </span>
              <span className="text-[10px] sm:text-[11px] font-medium px-2 py-0.5 rounded-full bg-[#FAF8F5] text-[#685957] border border-[#EDE5DE]">
                📏 {sizeLabels[item.size] || item.size}
              </span>
              {item.status && item.status !== 'active' && (
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                    statusColors[item.status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {statusLabels[item.status] || item.status}
                </span>
              )}
            </div>
          </div>

          {/* 하단 사용도 선택기 */}
          <div className="mt-auto pt-2.5 border-t border-[#F5EFEA] flex items-center justify-between gap-1">
            <span className="text-[11px] font-bold text-[#8A7977]">사용도</span>
            <div className="inline-flex rounded-full bg-[#FAF8F5] p-0.5 border border-[#EDE5DE] gap-0.5">
              {Object.values(USAGE_CONFIG).map((cfg) => {
                const isUsageSelected = (item.usage || 'frequent') === cfg.id;
                return (
                  <button
                    key={cfg.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUsageChange(cfg.id);
                    }}
                    className={`w-6 h-6 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                      isUsageSelected
                        ? `${cfg.badgeClass} border shadow-xs scale-105`
                        : 'text-[#9C8B88] hover:text-[#4A3E3D] hover:bg-[#FFF0EE]'
                    }`}
                    title={cfg.label}
                  >
                    <span>{cfg.emoji}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {isEditing && (
          <ItemEditModal
            item={item}
            onSave={handleSaveEdit}
            onClose={() => setIsEditing(false)}
            otherItems={otherItems}
            onBatchRecalibrate={onBatchRecalibrate}
            roomFurniture={roomFurniture}
            onAddSlot={onAddSlot}
          />
        )}
      </>
    );
  }

  // -------------------------------------------------------------
  // 2. LIST VIEW (목록형: 완벽한 규격 정렬과 시원한 여백)
  // -------------------------------------------------------------
  return (
    <>
      <div
        onClick={handleCardClick}
        className={`fluffy-card p-3 sm:p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(74,62,61,0.08)] cursor-pointer border flex flex-col justify-between h-full min-h-[150px] ${
          isSelected
            ? 'ring-2 ring-[#B56562] bg-[#FFF9F7] border-[#FFB7B2]'
            : 'border-[#F6EFEA]'
        }`}
      >
        <div className="flex items-start gap-3 sm:gap-3.5 flex-1">
          {/* 선택 모드 체크박스 */}
          {isSelectMode && (
            <div className="shrink-0 flex items-center pt-1 self-start">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black transition-all shadow-xs ${
                  isSelected
                    ? 'bg-[#B56562] text-white scale-110'
                    : 'border-2 border-[#D9CBC5] bg-white text-transparent'
                }`}
              >
                ✓
              </div>
            </div>
          )}

          {/* 좌측 썸네일 / 이모지 */}
          <div className="w-16 h-16 rounded-xl overflow-hidden bg-gradient-to-b from-[#FFF8F5] to-[#FFF1EB] border border-[#F2ECE6] shrink-0 shadow-xs flex items-center justify-center relative">
            {!imgError && item.imageUrl ? (
              <img
                src={item.imageUrl}
                alt={item.name}
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            ) : (
              <span className="text-3xl select-none">{emoji}</span>
            )}
          </div>

          {/* 우측 컨텐츠 영역: 상단 카테고리/액션 -> 타이틀 -> 칩 규격 통일 */}
          <div className="flex-1 min-w-0 flex flex-col justify-between">
            {/* 상단 1열: 카테고리 뱃지와 우측 관리 액션 (항상 동일한 위치) */}
            <div className="flex items-center justify-between gap-2 mb-1">
              <span className="text-xs font-bold text-[#B56562] bg-[#FFF0EE] px-2.5 py-0.5 rounded-full border border-[#FFDCD6]">
                {item.category}
              </span>

              {!isSelectMode && (
                <div className="flex items-center gap-1 shrink-0">
                  {(onDirectEdit || onUpdate) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                      }}
                      title="수정하기"
                      className="fluffy-button p-1.5 text-[#B9A8A5] hover:text-[#B56562] hover:bg-[#FFF0EE] rounded-xl transition-colors"
                    >
                      <Icon name="pencil" size={15} />
                    </button>
                  )}
                  {onRemove && item.id && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`'${item.name}' 물건을 목록에서 삭제하시겠습니까?`)) {
                          onRemove(item.id);
                        }
                      }}
                      title="삭제하기"
                      className="fluffy-button p-1.5 text-[#B9A8A5] hover:text-[#B55B59] hover:bg-[#FFF0EE] rounded-xl transition-colors"
                    >
                      <Icon name="trash" size={15} />
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* 타이틀: min-h-[2.85rem] 규격 높이 고정으로 1줄/2줄 카드 높이 차이 제거 */}
            <div className="min-h-[2.85rem] flex items-center">
              <h3
                className="text-base sm:text-lg font-bold text-[#4A3E3D] break-words line-clamp-2 leading-snug"
                title={item.name}
              >
                {item.name}
              </h3>
            </div>

            {/* 위치 & 크기 칩 */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#FAF8F5] text-[#685957] border border-[#EDE5DE] truncate max-w-full flex items-center gap-1">
                <Icon name="pin" size={12} className="inline mr-0.5 text-[#B56562]" />
                <span className="truncate">{item.location || '미분류'}</span>
              </span>
              <span className="text-xs font-medium px-3 py-1 rounded-full bg-[#FAF8F5] text-[#685957] border border-[#EDE5DE]">
                📏 {sizeLabels[item.size] || item.size}
              </span>
              {item.status && item.status !== 'active' && (
                <span
                  className={`text-xs font-bold px-2.5 py-0.5 rounded-full ${
                    statusColors[item.status] || 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {statusLabels[item.status] || item.status}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 하단 사용도 선택기: mt-auto pt-3으로 모든 카드의 가로선 완벽 일치 */}
        <div className="mt-auto pt-3 border-t border-[#F5EFEA] flex items-center justify-between">
          <span className="text-xs font-bold text-[#8A7977] shrink-0">사용도:</span>
          <div className="inline-flex rounded-full bg-[#FAF8F5] p-0.5 border border-[#EDE5DE] gap-1">
            {Object.values(USAGE_CONFIG).map((cfg) => {
              const isUsageSelected = (item.usage || 'frequent') === cfg.id;
              return (
                <button
                  key={cfg.id}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUsageChange(cfg.id);
                  }}
                  className={`w-7 h-7 rounded-full text-xs font-bold transition-all flex items-center justify-center ${
                    isUsageSelected
                      ? `${cfg.badgeClass} border shadow-xs scale-105`
                      : 'text-[#9C8B88] hover:text-[#4A3E3D] hover:bg-[#FFF0EE]'
                  }`}
                  title={cfg.label}
                >
                  <span>{cfg.emoji}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {isEditing && (
        <ItemEditModal
          item={item}
          onSave={handleSaveEdit}
          onClose={() => setIsEditing(false)}
          otherItems={otherItems}
          onBatchRecalibrate={onBatchRecalibrate}
          roomFurniture={roomFurniture}
          onAddSlot={onAddSlot}
        />
      )}
    </>
  );
}
