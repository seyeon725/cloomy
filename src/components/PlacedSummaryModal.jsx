import { useMemo } from 'react';
import { slotCount, slotName, FLOOR_LOCATION } from '../hooks/useRoom';

export default function PlacedSummaryModal({
  furniture = [],
  activeItems = [],
  roomName,
  onSelectFurniture,
  onClose,
}) {
  // 가구별 물건 데이터 계산
  const breakdown = useMemo(() => {
    // 1. 바닥 보관
    const floorItems = activeItems.filter(
      (item) => item.location === FLOOR_LOCATION
    );

    // 2. 각 가구별
    const furnitureList = furniture.map((f) => {
      const count = slotCount(f);
      const isConfigurable = count > 0;

      // 이 가구 전체에 속한 물건들
      const itemsInFurniture = activeItems.filter(
        (i) =>
          i.location === f.name ||
          i.location.startsWith(`${f.name} · `)
      );

      // 칸별 상세
      const slotDetails = isConfigurable
        ? Array.from({ length: count }, (_, idx) => {
            const loc = slotName(f, idx);
            const slotItems = activeItems.filter(
              (i) => i.location === loc || (idx === 0 && i.location === f.name)
            );
            return {
              slotIndex: idx,
              label: `${idx + 1}번째 칸`,
              count: slotItems.length,
              items: slotItems,
            };
          })
        : [];

      return {
        id: f.id,
        name: f.name,
        type: f.type,
        totalCount: itemsInFurniture.length,
        items: itemsInFurniture,
        slotDetails,
      };
    });

    return {
      floorItems,
      furnitureList,
      totalPlaced:
        floorItems.length +
        furnitureList.reduce((acc, f) => acc + f.totalCount, 0),
    };
  }, [furniture, activeItems]);

  const handleSelect = (id) => {
    onSelectFurniture(id);
    onClose();
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
            <h2 className="text-xl font-extrabold text-[#4A3E3D]">
              🏡 {roomName ? `${roomName}에 배치한 물건` : '방에 배치한 물건'}
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-[#806F6D]">
              총 <b>{breakdown.totalPlaced}개</b>의 물건이 가구에 보관되어 있어요.
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

        {/* 가구별 카드 목록 */}
        <div className="flex-1 overflow-y-auto py-4 space-y-3 pr-1">
          {/* 바닥 보관 카드 */}
          <div
            onClick={() => handleSelect('floor-storage')}
            className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#F1ECE6] hover:border-[#FFDAC1] hover:bg-[#FFFDFB] transition-all cursor-pointer space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">📍</span>
                <span className="font-extrabold text-sm text-[#4A3E3D]">
                  {FLOOR_LOCATION}
                </span>
              </div>
              <span className="text-xs font-bold px-2.5 py-1 bg-white text-[#B56562] border border-[#FFDAC1] rounded-full">
                {breakdown.floorItems.length}개
              </span>
            </div>

            {breakdown.floorItems.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {breakdown.floorItems.slice(0, 6).map((item) => (
                  <span
                    key={item.id}
                    className="text-xs px-2 py-0.5 bg-white text-[#806F6D] rounded-md border border-[#ECE5DF] truncate max-w-[120px]"
                  >
                    {item.emoji} {item.name}
                  </span>
                ))}
                {breakdown.floorItems.length > 6 && (
                  <span className="text-xs px-2 py-0.5 text-[#9A8784] font-medium self-center">
                    +{breakdown.floorItems.length - 6}개 더보기
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 각 가구별 카드 */}
          {breakdown.furnitureList.map((f) => (
            <div
              key={f.id}
              onClick={() => handleSelect(f.id)}
              className="p-4 bg-[#FAF8F5] rounded-2xl border border-[#F1ECE6] hover:border-[#FFDAC1] hover:bg-[#FFFDFB] transition-all cursor-pointer space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📦</span>
                  <span className="font-extrabold text-sm text-[#4A3E3D]">
                    {f.name}
                  </span>
                </div>
                <span className="text-xs font-bold px-2.5 py-1 bg-white text-[#B56562] border border-[#FFDAC1] rounded-full">
                  총 {f.totalCount}개
                </span>
              </div>

              {/* 칸이 있는 경우 칸별 세부 목록 */}
              {f.slotDetails.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {f.slotDetails.map((slot) => (
                    <span
                      key={slot.slotIndex}
                      className="text-xs px-2.5 py-1 bg-white text-[#806F6D] rounded-xl border border-[#ECE5DF] flex items-center gap-1.5 font-medium"
                    >
                      <span>{slot.label}</span>
                      <b className="text-[#B56562]">{slot.count}개</b>
                    </span>
                  ))}
                </div>
              )}

              {/* 물건 미리보기 태그 */}
              {f.items.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {f.items.slice(0, 5).map((item) => (
                    <span
                      key={item.id}
                      className="text-xs px-2 py-0.5 bg-white/70 text-[#9A8784] rounded-md border border-[#ECE5DF] truncate max-w-[120px]"
                    >
                      {item.emoji} {item.name}
                    </span>
                  ))}
                  {f.items.length > 5 && (
                    <span className="text-xs px-1 text-[#9A8784] self-center">
                      +{f.items.length - 5}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 하단 닫기 버튼 */}
        <div className="pt-3 border-t border-[#F4EEEA]">
          <button
            type="button"
            onClick={onClose}
            className="fluffy-button w-full py-3.5 px-4 bg-[#FAF8F5] font-bold text-sm text-[#806F6D]"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
