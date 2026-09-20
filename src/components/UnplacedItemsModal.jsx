import { useState } from 'react';
import MoveItemsModal from './MoveItemsModal';

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

export default function UnplacedItemsModal({
  unplacedItems = [],
  roomFurniture = [],
  roomName,
  onPlaceItems,
  onClose,
}) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeItemForPlacement, setActiveItemForPlacement] = useState(null); // 단일 물건 배치 시
  const [showBatchPlacement, setShowBatchPlacement] = useState(false); // 다중 물건 배치 시

  const toggleSelect = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === unplacedItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(unplacedItems.map((i) => i.id));
    }
  };

  const handlePlacementConfirm = ({ targetLocation, newFurniture }) => {
    const targetIds = activeItemForPlacement
      ? [activeItemForPlacement.id]
      : selectedIds;

    if (!targetIds.length || !targetLocation) return;

    onPlaceItems({
      itemIds: targetIds,
      targetLocation,
      newFurniture,
    });

    // 선택 상태 초기화
    setSelectedIds((prev) => prev.filter((id) => !targetIds.includes(id)));
    setActiveItemForPlacement(null);
    setShowBatchPlacement(false);
  };

  return (
    <>
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
              <h2 className="text-xl font-extrabold text-[#4A3E3D]">
                📍 {roomName ? `${roomName}의 위치를 정할 물건` : '위치를 정할 물건'}
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#806F6D]">
                방에 아직 배치되지 않은 물건이 <b>{unplacedItems.length}개</b> 있어요.
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

          {unplacedItems.length === 0 ? (
            <div className="py-12 text-center space-y-3">
              <span className="text-5xl block">🎉</span>
              <h3 className="text-lg font-extrabold text-[#4A3E3D]">
                모든 물건이 방에 배치되었어요!
              </h3>
              <p className="text-sm text-[#806F6D]">
                새로운 물건을 스캔하거나 등록해보세요.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="fluffy-button mt-4 px-6 py-2.5 bg-[#FAF8F5] text-sm font-bold text-[#806F6D]"
              >
                닫기
              </button>
            </div>
          ) : (
            <>
              {/* 일괄 선택 바 */}
              <div className="py-3 flex items-center justify-between border-b border-[#FAF8F5]">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="text-xs font-bold text-[#995e54] underline hover:opacity-80"
                >
                  {selectedIds.length === unplacedItems.length
                    ? '선택 해제'
                    : '전체 선택'}
                </button>
                <span className="text-xs font-semibold text-[#806F6D]">
                  {selectedIds.length}개 선택됨
                </span>
              </div>

              {/* 물건 리스트 */}
              <div className="flex-1 overflow-y-auto space-y-2 py-3 pr-1">
                {unplacedItems.map((item) => {
                  const isChecked = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleSelect(item.id)}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
                        isChecked
                          ? 'bg-[#FFF9F5] border-[#FFDAC1] shadow-xs'
                          : 'bg-[#FAF8F5] border-[#F1ECE6] hover:bg-[#FDFBFA]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSelect(item.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-[#A66760] cursor-pointer"
                        />
                        <span className="text-2xl shrink-0">
                          {CATEGORY_EMOJIS[item.category] || item.emoji || '📦'}
                        </span>
                        <div className="min-w-0">
                          <span className="block text-sm font-bold text-[#4A3E3D] truncate">
                            {item.name}
                          </span>
                          <span className="text-xs text-[#9A8784]">
                            {item.category || '기타'}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveItemForPlacement(item);
                        }}
                        className="fluffy-button text-xs font-bold px-3 py-1.5 bg-white text-[#B56562] border border-[#FFDAC1] hover:bg-[#FFF0EE] shrink-0 ml-2"
                      >
                        배치 ›
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* 하단 액션 버튼 */}
              <div className="pt-3 border-t border-[#F4EEEA] flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="fluffy-button flex-1 py-3 px-4 bg-[#FAF8F5] font-bold text-sm text-[#806F6D]"
                >
                  닫기
                </button>
                <button
                  type="button"
                  disabled={selectedIds.length === 0}
                  onClick={() => setShowBatchPlacement(true)}
                  className="fluffy-button flex-1 py-3 px-4 bg-[#FFB7B2] font-extrabold text-sm text-[#4A3E3D] disabled:opacity-50 shadow-[0_8px_20px_rgba(255,183,178,0.35)]"
                >
                  선택한 {selectedIds.length}개 가구에 배치
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* 가구 및 칸 선택 모달 (단일 또는 일괄 배치 시) */}
      {(activeItemForPlacement || showBatchPlacement) && (
        <MoveItemsModal
          selectedItemCount={
            activeItemForPlacement ? 1 : selectedIds.length
          }
          currentLocation="미분류"
          roomFurniture={roomFurniture}
          onConfirm={handlePlacementConfirm}
          onClose={() => {
            setActiveItemForPlacement(null);
            setShowBatchPlacement(false);
          }}
        />
      )}
    </>
  );
}
