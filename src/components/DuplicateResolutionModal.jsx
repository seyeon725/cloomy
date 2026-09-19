import { useState } from 'react';
import Icon from './Icon';

const sizeLabels = {
  tiny: '아주 작음',
  small: '작음',
  medium: '보통',
  large: '큼',
};

const categoryEmojis = {
  책: '📚',
  의류: '👕',
  전자기기: '📱',
  식기: '🍽️',
  문구: '✏️',
  화장품: '💄',
  장식품: '🎨',
  식품: '🍎',
  잡화: '📦',
  기타: '🔹',
};

const formatSize = (size) => {
  if (!size) return '';
  const label = sizeLabels[size] || size;
  return label.replace(/\(.*?\)/g, '').trim();
};

/**
 * 물건 중복/유사 감지 시 간결한 2-카드 선택 모달
 * - 미선택(기본): '각각 등록'
 * - (기존) 선택: '원래 것만 유지'
 * - (신규) 선택: '새 정보로 변경'
 */
export default function DuplicateResolutionModal({
  conflicts = [],
  targetLocation = '',
  onConfirm,
  onClose,
}) {
  // 각 충돌 항목별 선택 상태 (null: 미선택, 'existing': 기존 선택, 'new': 신규 선택)
  const [selectedCards, setSelectedCards] = useState({});

  const handleToggle = (idx, type) => {
    setSelectedCards((prev) => ({
      ...prev,
      [idx]: prev[idx] === type ? null : type,
    }));
  };

  const handleComplete = () => {
    const decisions = {};
    conflicts.forEach((_, idx) => {
      const sel = selectedCards[idx];
      if (sel === 'existing') {
        decisions[idx] = 'keep_existing';
      } else if (sel === 'new') {
        decisions[idx] = 'update_existing';
      } else {
        decisions[idx] = 'create_both';
      }
    });
    onConfirm(decisions);
  };

  // 버튼 문구 및 스타일 계산
  const getButtonConfig = () => {
    if (conflicts.length === 1) {
      const sel = selectedCards[0];
      if (sel === 'existing') {
        return {
          label: '원래 것만 유지',
          icon: '📦',
          style:
            'bg-[#FFEAE7] hover:bg-[#FFDFDA] text-[#A64A47] border-2 border-[#FFB7B2] shadow-[0_8px_20px_rgba(255,183,178,0.35)]',
        };
      }
      if (sel === 'new') {
        return {
          label: '새 정보로 변경',
          icon: '🔄',
          style:
            'bg-[#FFB7B2] hover:brightness-105 text-[#4A3E3D] border-2 border-[#FF9E99] shadow-[0_8px_20px_rgba(255,183,178,0.4)]',
        };
      }
      return {
        label: '각각 등록',
        icon: '✨',
        style:
          'bg-[#FFF3D1] hover:bg-[#FFE9B0] text-[#5C4511] border-2 border-[#FFD572] shadow-[0_8px_20px_rgba(255,213,114,0.35)]',
      };
    }

    // 복수 항목일 때
    const hasExisting = Object.values(selectedCards).some((v) => v === 'existing');
    const hasNew = Object.values(selectedCards).some((v) => v === 'new');
    if (!hasExisting && !hasNew) {
      return {
        label: '각각 등록',
        icon: '✨',
        style:
          'bg-[#FFF3D1] hover:bg-[#FFE9B0] text-[#5C4511] border-2 border-[#FFD572] shadow-[0_8px_20px_rgba(255,213,114,0.35)]',
      };
    }
    if (hasExisting && !hasNew) {
      return {
        label: '원래 것만 유지',
        icon: '📦',
        style:
          'bg-[#FFEAE7] hover:bg-[#FFDFDA] text-[#A64A47] border-2 border-[#FFB7B2] shadow-[0_8px_20px_rgba(255,183,178,0.35)]',
      };
    }
    if (!hasExisting && hasNew) {
      return {
        label: '새 정보로 변경',
        icon: '🔄',
        style:
          'bg-[#FFB7B2] hover:brightness-105 text-[#4A3E3D] border-2 border-[#FF9E99] shadow-[0_8px_20px_rgba(255,183,178,0.4)]',
      };
    }
    return {
      label: '선택한 내용으로 등록',
      icon: '✓',
      style:
        'bg-[#FFB7B2] hover:brightness-105 text-[#4A3E3D] border-2 border-[#FF9E99] shadow-[0_8px_20px_rgba(255,183,178,0.4)]',
    };
  };

  const btnConfig = getButtonConfig();

  const renderThumbnail = (item, isNew = false) => {
    const emoji = categoryEmojis[item.category] || '📦';
    const imageSrc = item.imageUrl || item.image;
    if (imageSrc) {
      return (
        <img
          src={imageSrc}
          alt={item.name}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl object-cover border border-[#EDE5DE] shadow-xs shrink-0"
          onError={(e) => {
            e.currentTarget.style.display = 'none';
            if (e.currentTarget.nextElementSibling) {
              e.currentTarget.nextElementSibling.style.display = 'flex';
            }
          }}
        />
      );
    }
    return (
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center text-2xl sm:text-3xl shrink-0 shadow-xs ${
          isNew ? 'bg-[#FFF0EE] text-[#B56562]' : 'bg-[#F5EFEA] text-[#705E5B]'
        }`}
      >
        {emoji}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="fluffy-card max-w-xl w-full p-5 sm:p-7 bg-white rounded-[32px] max-h-[90vh] overflow-y-auto shadow-[0_20px_50px_rgba(74,62,61,0.22)] flex flex-col justify-between">
        <div className="space-y-4">
          {/* 간결한 헤더 */}
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#FFF0EE] text-[#B56562] flex items-center justify-center text-2xl shrink-0 shadow-xs">
              🤔
            </div>
            <div>
              <h3 className="text-lg sm:text-xl font-black text-[#4A3E3D] tracking-tight">
                원래 있던 물건과 겹치는 것 같아요!
              </h3>
              <p className="text-xs sm:text-sm text-[#806F6D] mt-0.5">
                카드를 클릭해 선택하거나, 미선택 시 둘 다 보관돼요.
              </p>
            </div>
          </div>

          {/* 충돌 목록 */}
          <div className="space-y-3.5 pt-1">
            {conflicts.map((conflict, idx) => {
              const { newItem, existingItem, reason } = conflict;
              const sel = selectedCards[idx];
              const isSelectedExisting = sel === 'existing';
              const isSelectedNew = sel === 'new';

              return (
                <div key={idx} className="space-y-2">
                  {conflicts.length > 1 && (
                    <div className="flex items-center justify-between text-xs font-bold text-[#806F6D] px-1">
                      <span>물건 {idx + 1}/{conflicts.length}</span>
                      {reason && <span className="text-[#A96845] font-medium text-[11px]">⚠️ {reason}</span>}
                    </div>
                  )}

                  {/* (기존) vs (신규) 카드 그리드 */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* 1. (기존) 카드 */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleToggle(idx, 'existing')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggle(idx, 'existing');
                        }
                      }}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all duration-200 select-none flex flex-col justify-between gap-3 text-left ${
                        isSelectedExisting
                          ? 'bg-[#FFF8F7] border-[#FF9E99] ring-2 ring-[#FFB7B2]/60 shadow-[0_8px_24px_rgba(255,158,153,0.25)]'
                          : 'bg-white border-[#EDE5DE] hover:border-[#DCCFC6] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-full transition-colors ${
                            isSelectedExisting
                              ? 'bg-[#B56562] text-white shadow-xs'
                              : 'bg-[#F2ECE6] text-[#7A6A67]'
                          }`}
                        >
                          (기존) {isSelectedExisting && '✓'}
                        </span>
                        <span className="text-[11px] font-bold text-[#A89895]">
                          {isSelectedExisting ? '선택됨' : '클릭하여 선택'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {renderThumbnail(existingItem, false)}
                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-base font-black text-[#4A3E3D] truncate"
                            title={existingItem.name}
                          >
                            {existingItem.name}
                          </h4>
                          <p className="text-xs text-[#806F6D] font-bold mt-1 truncate">
                            <Icon name="pin" size={13} className="inline mr-1 text-[#B56562]" />
                            {existingItem.location || '위치 미지정'}
                          </p>
                          <p className="text-[11px] text-[#A3928F] mt-0.5 truncate">
                            {existingItem.category} · {formatSize(existingItem.size)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 2. (신규) 카드 */}
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleToggle(idx, 'new')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleToggle(idx, 'new');
                        }
                      }}
                      className={`cursor-pointer rounded-2xl p-4 border-2 transition-all duration-200 select-none flex flex-col justify-between gap-3 text-left ${
                        isSelectedNew
                          ? 'bg-[#FFF5F2] border-[#FF8A80] ring-2 ring-[#FF8A80]/60 shadow-[0_8px_24px_rgba(255,138,128,0.28)]'
                          : 'bg-white border-[#EDE5DE] hover:border-[#DCCFC6] hover:bg-[#FAF8F5]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-xs font-black px-2.5 py-1 rounded-full transition-colors ${
                            isSelectedNew
                              ? 'bg-[#E5534B] text-white shadow-xs'
                              : 'bg-[#FFF0EE] text-[#B56562]'
                          }`}
                        >
                          (신규) {isSelectedNew && '✓'}
                        </span>
                        <span className="text-[11px] font-bold text-[#A89895]">
                          {isSelectedNew ? '선택됨' : '클릭하여 선택'}
                        </span>
                      </div>

                      <div className="flex items-center gap-3">
                        {renderThumbnail(newItem, true)}
                        <div className="min-w-0 flex-1">
                          <h4
                            className="text-base font-black text-[#4A3E3D] truncate"
                            title={newItem.name}
                          >
                            {newItem.name}
                          </h4>
                          <p className="text-xs text-[#A96845] font-bold mt-1 truncate">
                            <Icon name="pin" size={13} className="inline mr-1 text-[#B56562]" />
                            {targetLocation || '새 위치'}
                          </p>
                          <p className="text-[11px] text-[#A3928F] mt-0.5 truncate">
                            {newItem.category} · {formatSize(newItem.size)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 하단 동적 액션 버튼 */}
        <div className="flex items-center gap-3 mt-6 pt-4 border-t border-[#F5EFEA]">
          <button
            type="button"
            onClick={onClose}
            className="fluffy-button px-4 py-3 bg-[#FAF8F5] text-[#806F6D] font-bold text-sm hover:bg-[#F0EBE5] transition-colors"
          >
            뒤로
          </button>
          <button
            type="button"
            onClick={handleComplete}
            className={`fluffy-button flex-1 py-3.5 px-4 font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-[0.99] ${btnConfig.style}`}
          >
            <span className="text-lg">{btnConfig.icon}</span>
            <span>{btnConfig.label}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
