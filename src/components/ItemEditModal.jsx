import { useState, useMemo, useRef } from 'react';
import { recalibrateItemSizes } from '../services/gemini';
import { FURNITURE, slotCount, slotName, FLOOR_LOCATION } from '../hooks/useRoom';
import { USAGE_CONFIG } from '../hooks/useItems';

const CATEGORIES = [
  { name: '책', emoji: '📚' },
  { name: '의류', emoji: '👕' },
  { name: '전자기기', emoji: '📱' },
  { name: '식기', emoji: '🍽️' },
  { name: '문구', emoji: '✏️' },
  { name: '화장품', emoji: '💄' },
  { name: '장식품', emoji: '🎨' },
  { name: '식품', emoji: '🍎' },
  { name: '잡화', emoji: '📦' },
  { name: '기타', emoji: '🔹' },
];

const SIZES = [
  { id: 'tiny', label: '아주 작음' },
  { id: 'small', label: '작음' },
  { id: 'medium', label: '보통' },
  { id: 'large', label: '큼' },
];

const sizeNameMap = {
  tiny: '아주 작음',
  small: '작음',
  medium: '보통',
  large: '큼',
};

export default function ItemEditModal({
  item,
  onSave,
  onClose,
  otherItems = [],
  onBatchRecalibrate,
  roomFurniture = [],
  onAddSlot,
}) {
  const [name, setName] = useState(item.name || '');
  const [category, setCategory] = useState(item.category || '기타');
  const [size, setSize] = useState(item.size || 'small');
  const [description, setDescription] = useState(item.description || '');
  const [usage, setUsage] = useState(item.usage || 'frequent');
  const [imageUrl, setImageUrl] = useState(item.imageUrl || '');
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetSize = 220;
        const w = img.width;
        const h = img.height;
        const minDim = Math.min(w, h);
        canvas.width = targetSize;
        canvas.height = targetSize;
        const ctx = canvas.getContext('2d');
        const sx = (w - minDim) / 2;
        const sy = (h - minDim) / 2;
        ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, targetSize, targetSize);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setImageUrl(compressed);
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  };

  // 상대적 크기 재조정 프롬프트 상태
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRecalibrating, setIsRecalibrating] = useState(false);

  // 초기 위치 파싱 (방 가구와 매칭)
  const initial = useMemo(() => {
    const raw = (item.location || '').trim();
    if (!raw || raw === '미분류') {
      return { furnitureId: null, slotIndex: null, custom: '', isCustom: false };
    }
    if (raw === FLOOR_LOCATION) {
      return { furnitureId: 'floor-storage', slotIndex: null, custom: '', isCustom: false };
    }
    for (const f of roomFurniture) {
      if (raw === f.name) {
        return { furnitureId: f.id, slotIndex: 0, custom: '', isCustom: false };
      }
      if (raw.startsWith(`${f.name} · `)) {
        const slotPart = raw.slice(`${f.name} · `.length);
        const match = slotPart.match(/^(\d+)번째\s*칸$/);
        const slotIdx = match ? parseInt(match[1], 10) - 1 : 0;
        return { furnitureId: f.id, slotIndex: slotIdx, custom: '', isCustom: false };
      }
    }
    return { furnitureId: null, slotIndex: null, custom: raw, isCustom: true };
  }, [item.location, roomFurniture]);

  const [selectedFurnitureId, setSelectedFurnitureId] = useState(initial.furnitureId);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState(initial.slotIndex);
  const [isCustom, setIsCustom] = useState(initial.isCustom);
  const [customLocation, setCustomLocation] = useState(initial.custom);
  const [location, setLocation] = useState(item.location || '');

  const selectedFurniture = roomFurniture.find((f) => f.id === selectedFurnitureId);

  const effectiveSlots = (f) => (f ? slotCount(f) : 0);

  const handleAddSlotClick = (furniture) => {
    if (!furniture || !onAddSlot) return;
    const nextIndex = onAddSlot(furniture.id);
    setSelectedSlotIndex(nextIndex);
    setLocation(slotName(furniture, nextIndex));
  };

  const selectFurniture = (f) => {
    setIsCustom(false);
    setSelectedFurnitureId(f.id);
    const slots = effectiveSlots(f);
    if (slots === 0) {
      setSelectedSlotIndex(null);
      setLocation(f.name);
    } else if (slots === 1) {
      setSelectedSlotIndex(0);
      setLocation(slotName(f, 0));
    } else {
      const nextSlot = selectedSlotIndex !== null && selectedSlotIndex < slots ? selectedSlotIndex : 0;
      setSelectedSlotIndex(nextSlot);
      setLocation(slotName(f, nextSlot));
    }
  };

  const selectSlot = (f, index) => {
    setSelectedSlotIndex(index);
    setLocation(slotName(f, index));
  };

  const selectFloor = () => {
    setIsCustom(false);
    setSelectedFurnitureId('floor-storage');
    setSelectedSlotIndex(null);
    setLocation(FLOOR_LOCATION);
  };

  const selectCustom = () => {
    setIsCustom(true);
    setSelectedFurnitureId(null);
    setSelectedSlotIndex(null);
    setLocation(customLocation.trim() || '미분류');
  };

  const getFinalItem = () => {
    const finalLocation = isCustom
      ? (customLocation.trim() || '미분류')
      : (location || '미분류');
    return {
      ...item,
      name: name.trim(),
      category,
      size,
      description: description.trim(),
      location: finalLocation,
      usage,
      imageUrl: imageUrl || null,
    };
  };

  const otherSceneItems = useMemo(() => {
    return (otherItems || []).filter((o) => {
      if (o.id && item.id) return o.id !== item.id;
      return o.name !== item.name;
    });
  }, [otherItems, item]);

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('물건 이름을 입력해주세요!');
      return;
    }

    const sizeChanged = (item.size || 'small') !== size;
    const hasOthers = otherSceneItems.length > 0;

    // 크기가 변경되었고, 같은 씬/목록에 다른 물건들이 존재하며, 일괄 재조정 콜백이 있는 경우
    if (sizeChanged && hasOthers && onBatchRecalibrate) {
      setShowPrompt(true);
    } else {
      onSave(getFinalItem());
      onClose();
    }
  };

  // 1. 단일 아이템만 저장
  const handleSaveOnlyThis = () => {
    onSave(getFinalItem());
    onClose();
  };

  // 2. 다른 물건들도 상대적 크기로 AI 일괄 재계산
  const handleRecalibrateAll = async () => {
    const finalItem = getFinalItem();
    setIsRecalibrating(true);
    try {
      const allSceneItems = [finalItem, ...otherSceneItems];
      const updatedList = await recalibrateItemSizes(finalItem, size, allSceneItems);

      // 부모 컴포넌트에 일괄 업데이트 전달
      onBatchRecalibrate(finalItem, updatedList);
      onClose();
    } catch (err) {
      console.error('Failed to recalibrate relative sizes:', err);
      alert('상대적 크기 계산 중 오류가 발생했습니다. 이 물건의 크기만 저장합니다.');
      onSave(finalItem);
      onClose();
    } finally {
      setIsRecalibrating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#4A3E3D]/35 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-[32px] max-w-lg w-full p-6 shadow-[0_20px_60px_rgba(74,62,61,0.2)] max-h-[90vh] overflow-y-auto space-y-6">
        {/* 상대적 크기 자동 보정 질문 프롬프트 뷰 */}
        {showPrompt ? (
          <div className="py-4 space-y-5 text-center">
            <div className="text-6xl p-4 bg-[#FFF0EE] rounded-full inline-block">📐</div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-[#4A3E3D]">
                상대적 크기 자동 맞춤
              </h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-sm mx-auto">
                <span className="font-bold text-[#B56562]">'{name}'</span>의 크기가{' '}
                <span className="font-bold text-[#4A3E3D] bg-[#FAF8F5] px-2 py-0.5 rounded-full">
                  {sizeNameMap[item.size] || item.size}
                </span>{' '}
                →{' '}
                <span className="font-bold text-[#B56562] bg-[#FFF0EE] px-2 py-0.5 rounded-full">
                  {sizeNameMap[size] || size}
                </span>
                (으)로 변경되었습니다!
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs sm:text-sm text-amber-900 text-left space-y-1">
                <p className="font-bold">💡 AI 비례 분석 추천:</p>
                <p>
                  같은 사진에 함께 찍힌 다른 <b>{otherItems.length}개</b> 물건들의 크기도
                  이 기준 물건과의 시각적 비례에 맞춰 <b>상대적 크기를 자동으로 변경</b>할까요?
                </p>
              </div>
            </div>

            {isRecalibrating ? (
              <div className="p-6 bg-slate-50 rounded-2xl flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-bold text-indigo-700">
                  AI가 사진 속 다른 물건들의 상대적 비례를 재계산하고 있어요...
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleRecalibrateAll}
                  className="fluffy-button w-full py-4 px-5 bg-[#FFB7B2] font-extrabold text-base text-[#4A3E3D] shadow-[0_10px_24px_rgba(255,183,178,0.4)] flex items-center justify-center gap-2"
                >
                  <span>✨ 네, 상대적 크기에 맞춰 자동 변경</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveOnlyThis}
                  className="fluffy-button w-full py-3.5 px-5 bg-[#FAF8F5] font-bold text-sm sm:text-base text-[#806F6D]"
                >
                  아니요, 이 물건만 변경할게요
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between pb-3">
              <h3 className="text-xl font-bold text-[#4A3E3D]">✏️ 물건 정보 수정</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl px-2"
              >
                ✕
              </button>
            </div>

            {/* 사진 미리보기 및 등록/변경 영역 */}
            <div className="flex items-center gap-3.5 p-3.5 bg-[#FAF8F5] rounded-2xl border border-[#F0E5DC]">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
              <div className="w-16 h-16 rounded-xl bg-white border border-[#E8DDD4] shrink-0 shadow-xs flex items-center justify-center overflow-hidden">
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl select-none">
                    {CATEGORIES.find((c) => c.name === category)?.emoji || '📦'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-extrabold text-[#4A3E3D] text-sm">
                  {imageUrl ? '📸 등록된 사진' : '📷 사진 없음 (아이콘 표시 중)'}
                </p>
                <p className="text-[11px] text-[#9A8784] mt-0.5">
                  {imageUrl
                    ? '사진을 변경하거나 삭제할 수 있어요.'
                    : '카메라로 촬영하거나 사진을 업로드해 보세요.'}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1 bg-white hover:bg-[#FAF6F3] text-[#B56562] border border-[#FFD5CF] rounded-lg text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    {imageUrl ? '사진 변경' : '📸 사진 등록'}
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-2 py-1 bg-[#FFF5F5] hover:bg-[#FFEAE8] text-[#E5484D] border border-[#FFD5D2] rounded-lg text-xs font-bold transition-all cursor-pointer"
                    >
                      삭제
                    </button>
                  )}
                </div>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-5">
              {/* 이름 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  물건 이름
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="물건 이름을 입력하세요"
                  className="fluffy-input w-full px-4 py-3 text-base font-medium"
                  required
                />
              </div>

              {/* 카테고리 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  카테고리 선택
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {CATEGORIES.map((cat) => (
                    <button
                      type="button"
                      key={cat.name}
                      onClick={() => setCategory(cat.name)}
                      className={`flex flex-col items-center justify-center p-2.5 rounded-xl border text-sm font-medium transition-all ${
                        category === cat.name
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400 font-bold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      <span className="text-2xl mb-1">{cat.emoji}</span>
                      <span className="text-xs">{cat.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 크기 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-700">
                    크기 (상대적 기준)
                  </label>
                  {otherItems && otherItems.length > 0 && (
                    <span className="text-xs text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded">
                      💡 변경 시 다른 물건 비례 자동 조정 가능
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {SIZES.map((s) => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setSize(s.id)}
                      className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        size === s.id
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-2 ring-indigo-400 font-bold'
                          : 'border-gray-200 hover:bg-gray-50 text-gray-700'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 위치 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-gray-700">
                    보관 위치
                  </label>
                  {(isCustom ? customLocation.trim() : location) && (
                    <span className="text-xs font-bold px-2.5 py-1 bg-[#FFF0EE] text-[#B56562] rounded-full truncate max-w-[200px]">
                      {isCustom ? (customLocation.trim() || '직접 입력') : location}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={selectFloor}
                    className={`fluffy-button px-3.5 py-2 text-xs font-semibold ${
                      !isCustom && selectedFurnitureId === 'floor-storage'
                        ? 'bg-[#FFB7B2] text-[#4A3E3D] shadow-[0_6px_16px_rgba(255,183,178,0.35)]'
                        : 'bg-[#FAF8F5] text-[#806F6D]'
                    }`}
                  >
                    바닥 보관
                  </button>
                  {roomFurniture.map((f) => (
                    <button
                      type="button"
                      key={f.id}
                      onClick={() => selectFurniture(f)}
                      className={`fluffy-button px-3.5 py-2 text-xs font-semibold ${
                        !isCustom && selectedFurnitureId === f.id
                          ? 'bg-[#FFB7B2] text-[#4A3E3D] shadow-[0_6px_16px_rgba(255,183,178,0.35)]'
                          : 'bg-[#FAF8F5] text-[#806F6D]'
                      }`}
                    >
                      {f.name}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={selectCustom}
                    className={`fluffy-button px-3.5 py-2 text-xs font-semibold ${
                      isCustom
                        ? 'bg-[#FFB7B2] text-[#4A3E3D] shadow-[0_6px_16px_rgba(255,183,178,0.35)]'
                        : 'bg-[#FAF8F5] text-[#806F6D]'
                    }`}
                  >
                    + 직접 입력
                  </button>
                </div>

                {/* 칸 선택 서브 메뉴 */}
                {!isCustom && selectedFurniture && selectedFurnitureId !== 'floor-storage' && (
                  <div className="flex flex-wrap items-center gap-1.5 p-2.5 bg-[#FAF8F5] rounded-2xl mb-2 border border-[#F4EEEA]">
                    <span className="text-xs text-[#806F6D] font-bold mr-1">
                      {selectedFurniture.name} 칸 선택:
                    </span>
                    {effectiveSlots(selectedFurniture) > 0 ? (
                      Array.from({ length: effectiveSlots(selectedFurniture) }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => selectSlot(selectedFurniture, i)}
                          className={`fluffy-button px-3 py-1.5 text-xs font-semibold ${
                            selectedSlotIndex === i
                              ? 'bg-[#FFDAC1] text-[#4A3E3D] shadow-[0_4px_12px_rgba(255,218,193,0.4)] font-bold'
                              : 'bg-white text-[#806F6D] border border-[#F0E8E2]'
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
                    {onAddSlot && (
                      <button
                        type="button"
                        onClick={() => handleAddSlotClick(selectedFurniture)}
                        className="fluffy-button px-2.5 py-1 text-xs font-bold rounded-xl bg-[#FFF0EE] hover:bg-[#FFE5E0] text-[#B56562] border border-[#FFD0CC] flex items-center gap-1 hover:scale-105 active:scale-95 transition-all shadow-xs cursor-pointer"
                        title={`${selectedFurniture.name}에 새 칸을 추가하고 바로 선택해요`}
                      >
                        <span>+ 칸 추가</span>
                      </button>
                    )}
                  </div>
                )}

                {/* 직접 입력 인풋 */}
                {isCustom && (
                  <input
                    type="text"
                    value={customLocation}
                    onChange={(e) => {
                      setCustomLocation(e.target.value);
                      setLocation(e.target.value.trim() || '미분류');
                    }}
                    placeholder="위치를 직접 입력하세요 (예: 책장 3번째 칸)"
                    className="fluffy-input w-full px-4 py-2.5 text-sm font-medium mt-1"
                    autoFocus
                  />
                )}
              </div>

              {/* 사용 빈도 (사용도) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  사용 빈도 (사용도)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.values(USAGE_CONFIG).map((cfg) => {
                    const isSelected = usage === cfg.id;
                    return (
                      <button
                        key={cfg.id}
                        type="button"
                        onClick={() => setUsage(cfg.id)}
                        className={`fluffy-button p-2.5 sm:p-3 text-center rounded-2xl border transition-all ${
                          isSelected
                            ? `${cfg.badgeClass} ring-2 ring-[#FFDAC1] font-extrabold shadow-xs`
                            : 'bg-[#FAF8F5] text-[#806F6D] border-[#EDE5DE] hover:bg-[#FFF2EE]'
                        }`}
                      >
                        <div className="text-xl mb-0.5">{cfg.emoji}</div>
                        <div className="text-xs font-bold">{cfg.shortLabel}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 메모 / 설명 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  메모 / 물건 설명 (선택)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 인생네컷 앨범, 하늘색 원통 토너 등"
                  className="fluffy-input w-full px-4 py-2.5 text-sm font-medium"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="fluffy-button flex-1 py-3.5 px-4 bg-[#FAF8F5] font-bold text-[#806F6D]"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="fluffy-button flex-1 py-3.5 px-4 bg-[#FFB7B2] font-bold text-[#4A3E3D] shadow-[0_8px_20px_rgba(255,183,178,0.35)]"
                >
                  저장하기
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
