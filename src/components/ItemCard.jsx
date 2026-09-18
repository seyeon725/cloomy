import { useState } from 'react';
import ItemEditModal from './ItemEditModal';

const sizeLabels = {
  tiny: '아주 작음 (손가락)',
  small: '작음 (손바닥)',
  medium: '보통 (팔뚝)',
  large: '큼 (그 이상)',
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
  active: 'bg-green-100 text-green-800 border-green-200',
  archived: 'bg-amber-100 text-amber-800 border-amber-200',
  discarded: 'bg-rose-100 text-rose-800 border-rose-200',
};

const statusLabels = {
  active: '보관 중',
  archived: '보관함 이동',
  discarded: '폐기 예정',
};

export default function ItemCard({
  item,
  onUpdate,
  onRemove,
  onDirectEdit,
  otherItems = [],
  onBatchRecalibrate,
}) {
  const [isEditing, setIsEditing] = useState(false);
  const emoji = categoryEmojis[item.category] || '📦';

  const handleSaveEdit = (updatedItem) => {
    if (onDirectEdit) {
      onDirectEdit(updatedItem);
    } else if (onUpdate && item.id) {
      onUpdate(item.id, updatedItem);
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-gray-200/80 hover:shadow-md transition-all">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 flex-1">
            <span className="text-3xl sm:text-4xl p-2 bg-slate-50 rounded-2xl border border-slate-100 shrink-0">
              {emoji}
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base sm:text-lg font-bold text-gray-900 break-words">
                  {item.name}
                </h3>
                <span className="text-xs sm:text-sm font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100">
                  {item.category}
                </span>
              </div>
              {item.description && (
                <p className="text-sm text-gray-600 mt-1 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className="text-xs sm:text-sm font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  📍 {item.location || '미분류'}
                </span>
                <span className="text-xs sm:text-sm font-medium px-3 py-1 rounded-full bg-slate-100 text-slate-700">
                  📏 {sizeLabels[item.size] || item.size}
                </span>
                {item.status && (
                  <span
                    className={`text-xs sm:text-sm font-bold px-3 py-1 rounded-full border ${
                      statusColors[item.status] || 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {statusLabels[item.status] || item.status}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* 수정 버튼 */}
          {(onDirectEdit || onUpdate) && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title="수정하기"
              className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all shrink-0"
            >
              <span className="text-base">✏️</span>
            </button>
          )}
        </div>

        {/* 하단 액션 버튼 영역 */}
        {onUpdate && item.id && (
          <div className="flex items-center gap-2 mt-4 pt-3.5 border-t border-gray-100 flex-wrap">
            {item.status === 'active' && (
              <>
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { status: 'archived' })}
                  className="text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors border border-amber-200"
                >
                  📦 보관함으로
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(item.id, { status: 'discarded' })}
                  className="text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl bg-rose-50 text-rose-800 hover:bg-rose-100 transition-colors border border-rose-200"
                >
                  🗑️ 폐기
                </button>
              </>
            )}
            {item.status !== 'active' && (
              <button
                type="button"
                onClick={() => onUpdate(item.id, { status: 'active' })}
                className="text-xs sm:text-sm font-semibold px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors border border-emerald-200"
              >
                ↩️ 다시 보관 중으로
              </button>
            )}
            {onRemove && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`'${item.name}' 물건을 목록에서 삭제하시겠습니까?`)) {
                    onRemove(item.id);
                  }
                }}
                className="text-xs sm:text-sm font-medium px-3 py-2 rounded-xl text-gray-400 hover:text-rose-600 hover:bg-rose-50 transition-colors ml-auto"
              >
                삭제
              </button>
            )}
          </div>
        )}
      </div>

      {isEditing && (
        <ItemEditModal
          item={item}
          onSave={handleSaveEdit}
          onClose={() => setIsEditing(false)}
          otherItems={otherItems}
          onBatchRecalibrate={onBatchRecalibrate}
        />
      )}
    </>
  );
}
