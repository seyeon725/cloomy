import { useState } from 'react';
import { recalibrateItemSizes } from '../services/gemini';

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
  { id: 'tiny', label: '아주 작음 (손가락)' },
  { id: 'small', label: '작음 (손바닥)' },
  { id: 'medium', label: '보통 (팔뚝)' },
  { id: 'large', label: '큼 (그 이상)' },
];

const sizeNameMap = {
  tiny: '아주 작음 (손가락)',
  small: '작음 (손바닥)',
  medium: '보통 (팔뚝)',
  large: '큼 (그 이상)',
};

export default function ItemEditModal({
  item,
  onSave,
  onClose,
  existingLocations = [],
  otherItems = [],
  onBatchRecalibrate,
}) {
  const [name, setName] = useState(item.name || '');
  const [category, setCategory] = useState(item.category || '기타');
  const [size, setSize] = useState(item.size || 'small');
  const [description, setDescription] = useState(item.description || '');
  const [location, setLocation] = useState(item.location || '책상 위');
  const [customLocation, setCustomLocation] = useState('');

  // 상대적 크기 재조정 프롬프트 상태
  const [showPrompt, setShowPrompt] = useState(false);
  const [isRecalibrating, setIsRecalibrating] = useState(false);

  const allLocations = [
    ...new Set([
      '책상 위',
      '서랍',
      '메인 책장',
      '화장대',
      '옷장',
      '주방 선반',
      '거실',
      ...existingLocations,
    ]),
  ];

  const getFinalItem = () => {
    const finalLocation = location === '__custom__' ? (customLocation.trim() || '미분류') : location;
    return {
      ...item,
      name: name.trim(),
      category,
      size,
      description: description.trim(),
      location: finalLocation,
    };
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('물건 이름을 입력해주세요!');
      return;
    }

    const sizeChanged = item.size && item.size !== size;
    const hasOthers = otherItems && otherItems.length > 0;

    // 크기가 변경되었고, 같은 사진 속에 다른 물건들이 존재하며, 일괄 재조정 콜백이 있는 경우
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
      const allSceneItems = [finalItem, ...otherItems.filter((o) => o.id !== item.id && o.name !== item.name)];
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
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto space-y-6">
        {/* 상대적 크기 자동 보정 질문 프롬프트 뷰 */}
        {showPrompt ? (
          <div className="py-4 space-y-5 text-center">
            <div className="text-6xl p-4 bg-indigo-50 rounded-full inline-block">📐</div>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-gray-900">
                상대적 크기 자동 맞춤
              </h3>
              <p className="text-sm sm:text-base text-gray-600 leading-relaxed max-w-sm mx-auto">
                <span className="font-bold text-indigo-700">'{name}'</span>의 크기가{' '}
                <span className="font-bold text-gray-900 bg-gray-100 px-2 py-0.5 rounded">
                  {sizeNameMap[item.size] || item.size}
                </span>{' '}
                →{' '}
                <span className="font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
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
                  className="w-full py-4 px-5 rounded-2xl bg-indigo-600 font-extrabold text-base text-white hover:bg-indigo-700 shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <span>✨ 네, 상대적 크기에 맞춰 자동 변경</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveOnlyThis}
                  className="w-full py-3.5 px-5 rounded-2xl border border-gray-300 font-bold text-sm sm:text-base text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  아니요, 이 물건만 변경할게요
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-xl font-bold text-gray-900">✏️ 물건 정보 수정</h3>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-2xl px-2"
              >
                ✕
              </button>
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
                  className="w-full px-4 py-3 text-base rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
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
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  보관 위치
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {allLocations.map((loc) => (
                    <button
                      type="button"
                      key={loc}
                      onClick={() => setLocation(loc)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        location === loc
                          ? 'bg-indigo-600 text-white shadow-sm font-bold'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {loc}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setLocation('__custom__')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      location === '__custom__'
                        ? 'bg-indigo-600 text-white shadow-sm font-bold'
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
                    placeholder="위치를 입력하세요"
                    className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 mt-2"
                  />
                )}
              </div>

              {/* 메모 / 설명 */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1.5">
                  메모 / 설명 (선택)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="예: 인생네컷 앨범, 파란색 뚜껑 등"
                  className="w-full px-4 py-2.5 text-sm rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 버튼 */}
              <div className="flex gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-3.5 px-4 rounded-xl border border-gray-300 font-bold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3.5 px-4 rounded-xl bg-indigo-600 font-bold text-white hover:bg-indigo-700 shadow-md transition-colors"
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
