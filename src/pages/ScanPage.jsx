import { useState, useEffect } from 'react';
import Camera from '../components/Camera';
import ItemList from '../components/ItemList';
import { analyzeImage } from '../services/gemini';
import { cropObjectThumbnail } from '../utils/cropThumbnail';

const CATEGORIES = ['책', '의류', '전자기기', '식기', '문구', '화장품', '장식품', '식품', '잡화', '기타'];
const CATEGORY_EMOJI = { '책': '📚', '의류': '👕', '전자기기': '📱', '식기': '🍽️', '문구': '✏️', '화장품': '💄', '장식품': '🎀', '식품': '🍎', '잡화': '📦', '기타': '📦' };

function recognitionErrorMessage(error) {
  const message = String(error?.message || error || '');
  if (message.includes('API_KEY_MISSING')) return 'AI 인식 키가 설정되지 않았어요. .env의 VITE_GEMINI_API_KEY를 확인해주세요.';
  if (/api key|401|403|permission/i.test(message)) return 'AI 인식 키를 확인해주세요. 키 권한 또는 프로젝트 설정 문제일 수 있어요.';
  if (/429|quota|resource exhausted/i.test(message)) return 'AI 인식 요청 한도에 도달했어요. 잠시 뒤 다시 시도해주세요.';
  if (/503|unavailable|high demand/i.test(message)) return 'AI 서비스가 일시적으로 지연되고 있어요. 잠시 후 다시 시도해주세요.';
  if (/model|not found|404/i.test(message)) return 'AI 인식 모델에 연결하지 못했어요. 잠시 뒤 다시 시도해주세요.';
  return '물건 인식에 실패했어요. 밝은 곳에서 물건이 잘 보이게 다시 찍어주세요.';
}

/**
 * Loads an image from dataUrl into an HTMLImageElement safely
 */
function loadImage(dataUrl) {
  return new Promise((resolve) => {
    if (!dataUrl) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = dataUrl;
    if (img.complete && img.naturalWidth) {
      resolve(img);
    }
  });
}

export default function ScanPage({
  itemsHook,
  onRegistered,
  rooms = [],
  activeRoomId,
  roomFurniture = [],
  onUnsavedChange,
  onAddSlot,
}) {
  const { addItems, updateMultipleItems, items: existingItems } = itemsHook;
  const [step, setStep] = useState('camera'); // camera | loading | results | manual
  const [recognizedItems, setRecognizedItems] = useState([]);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [error, setError] = useState(null);

  // Manual item addition
  const [manualItems, setManualItems] = useState([]);
  const [manualName, setManualName] = useState('');
  const [manualCategory, setManualCategory] = useState('기타');

  // 작업 중인 내용(인식 결과 등록 화면, 수동 입력 중 등)이 있을 때 상위로 상태 전달
  useEffect(() => {
    const isUnsaved =
      (step === 'results' && recognizedItems.length > 0) ||
      (step === 'manual' && manualItems.length > 0) ||
      step === 'loading';
    if (onUnsavedChange) {
      onUnsavedChange(isUnsaved);
    }
    return () => {
      if (onUnsavedChange) {
        onUnsavedChange(false);
      }
    };
  }, [step, recognizedItems.length, manualItems.length, onUnsavedChange]);

  const handleCapture = async (photo) => {
    setCurrentPhoto(photo);
    setStep('loading');
    setError(null);
    try {
      const [items, loadedImg] = await Promise.all([
        analyzeImage(photo.base64, photo.mimeType),
        loadImage(photo.dataUrl),
      ]);

      const itemsWithThumb = items.map((item) => {
        const croppedThumb = loadedImg ? cropObjectThumbnail(loadedImg, item.box_2d, 260) : null;
        return {
          ...item,
          imageUrl: croppedThumb,
        };
      });

      setRecognizedItems(itemsWithThumb);
      setStep('results');
    } catch (err) {
      console.error('Recognition error:', err);
      setError(recognitionErrorMessage(err));
      setStep('camera');
    }
  };

  const handleSave = (selectedItems, location, meta = {}, resolutionPlan = null) => {
    try {
      const targetRoomId = meta.roomId || activeRoomId;
      if (resolutionPlan) {
        if (resolutionPlan.itemsToUpdate && resolutionPlan.itemsToUpdate.length > 0) {
          const updatedWithRoom = resolutionPlan.itemsToUpdate.map(i => ({ ...i, roomId: targetRoomId }));
          updateMultipleItems(updatedWithRoom);
        }
        if (resolutionPlan.itemsToAdd && resolutionPlan.itemsToAdd.length > 0) {
          const addedWithRoom = resolutionPlan.itemsToAdd.map(i => ({ ...i, roomId: targetRoomId }));
          addItems(addedWithRoom, location);
        }
      } else if (selectedItems && selectedItems.length > 0) {
        const withRoom = selectedItems.map(i => ({ ...i, roomId: targetRoomId }));
        addItems(withRoom, location);
      }
      setStep('camera');
      setRecognizedItems([]);
      setCurrentPhoto(null);
      setManualItems([]);
      if (onRegistered) onRegistered({ ...meta, roomId: targetRoomId });
    } catch (err) {
      console.error('Save error:', err);
      alert('물건 저장 중 오류가 발생했습니다.');
    }
  };

  const handleCancel = () => {
    if (currentPhoto) {
      setStep('camera');
      setRecognizedItems([]);
      setCurrentPhoto(null);
    } else {
      setStep('manual');
    }
  };

  const addManualItem = () => {
    const name = manualName.trim();
    if (!name) return;
    setManualItems(prev => [...prev, {
      name,
      category: manualCategory,
      size: 'small',
      description: '',
      emoji: CATEGORY_EMOJI[manualCategory] || '📦',
    }]);
    setManualName('');
  };

  const removeManualItem = (index) => {
    setManualItems(prev => prev.filter((_, i) => i !== index));
  };

  const proceedManualToResults = () => {
    setRecognizedItems(manualItems);
    setCurrentPhoto(null);
    setStep('results');
  };

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="relative">
          <div className="w-16 h-16 bg-[#FFF0E5] rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-[#FFB7B2] rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-[#806F6D] font-medium">AI가 물건을 인식하고 있어요...</p>
        <p className="text-sm text-[#9A8784]">잠시만 기다려주세요 🔍</p>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div>
        {currentPhoto && (
          <div className="mb-4 rounded-[24px] overflow-hidden shadow-[0_10px_30px_rgba(74,62,61,0.08)]">
            <img src={currentPhoto.dataUrl} alt="촬영한 사진" className="w-full" />
          </div>
        )}
        <ItemList
          key={currentPhoto?.dataUrl || recognizedItems.map(i => i.name).join(',') || 'results'}
          items={recognizedItems}
          onSave={handleSave}
          onCancel={handleCancel}
          rooms={rooms}
          activeRoomId={activeRoomId}
          roomFurniture={roomFurniture}
          cancelLabel={currentPhoto ? '다시 찍기' : '← 돌아가기'}
          existingItems={existingItems}
          onAddSlot={onAddSlot}
        />
      </div>
    );
  }

  if (step === 'manual') {
    return (
      <div className="max-w-md sm:max-w-lg md:max-w-[560px] mx-auto w-full">
        <div className="text-center mb-4">
          <h2 className="text-lg font-extrabold text-[#4A3E3D]">✏️ 수동 물건 추가</h2>
          <p className="text-sm text-[#806F6D] mt-1">물건 정보를 직접 입력해서 등록하세요</p>
        </div>

        <div className="fluffy-card p-5 space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && manualName.trim()) addManualItem(); }}
              placeholder="물건 이름"
              autoFocus
              className="fluffy-input flex-1 px-4 py-3 text-base font-medium"
            />
            <select
              value={manualCategory}
              onChange={e => setManualCategory(e.target.value)}
              className="fluffy-input px-3 py-3 text-sm font-medium"
            >
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
            <button
              type="button"
              onClick={addManualItem}
              disabled={!manualName.trim()}
              className="fluffy-button px-4 py-3 bg-[#FFB7B2] text-[#4A3E3D] font-bold text-sm disabled:opacity-50"
            >
              추가
            </button>
          </div>

          {manualItems.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-[#4A3E3D]">추가한 물건 ({manualItems.length}개)</p>
              <ul className="space-y-1.5">
                {manualItems.map((item, i) => (
                  <li key={i} className="flex items-center justify-between bg-[#FAF8F5] rounded-2xl px-4 py-2.5">
                    <span className="text-sm font-medium text-[#4A3E3D]">{item.emoji} {item.name} <span className="text-[#9A8784] text-xs">({item.category})</span></span>
                    <button type="button" onClick={() => removeManualItem(i)} className="text-[#B56562] text-sm font-bold px-2">✕</button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-4">
          <button
            type="button"
            onClick={() => { setStep('camera'); setManualItems([]); }}
            className="fluffy-button px-6 py-4 bg-[#FAF8F5] text-[#806F6D] font-bold text-base"
          >
            ← 돌아가기
          </button>
          <button
            type="button"
            onClick={proceedManualToResults}
            disabled={!manualItems.length}
            className="fluffy-button flex-1 px-5 py-4 bg-[#FFB7B2] text-[#4A3E3D] font-extrabold text-base disabled:opacity-50 shadow-[0_10px_24px_rgba(255,183,178,0.4)]"
          >
            위치 선택 → ({manualItems.length}개)
          </button>
        </div>
      </div>
    );
  }

  // Camera step
  return (
    <div className="flex flex-col justify-start max-w-md sm:max-w-lg md:max-w-[560px] mx-auto w-full pb-2">
      <div className="text-center mb-2.5 shrink-0">
        <h2 className="text-xl sm:text-2xl font-black text-[#4A3E3D]">물건 스캔</h2>
        <p className="text-xs sm:text-sm text-[#806F6D] mt-0.5">정리할 구역이나 물건을 사진 찍어주세요 📸</p>
      </div>
      {error && (
        <div className="w-full mb-3 p-3 rounded-[20px] bg-[#FFE9E7] text-[#B55B59] text-xs sm:text-sm font-bold shadow-xs border border-[#FFD0CC] shrink-0">
          {error}
        </div>
      )}
      <Camera onCapture={handleCapture} />
      <div className="w-full mt-2.5 shrink-0">
        <button
          type="button"
          onClick={() => setStep('manual')}
          className="fluffy-button w-full py-2.5 sm:py-3 bg-white hover:bg-[#FFF5EE] text-[#806F6D] hover:text-[#4A3E3D] font-bold text-xs sm:text-sm shadow-[0_6px_18px_rgba(74,62,61,0.06)] border border-[#F4EEEA] transition-all flex items-center justify-center gap-2 rounded-[20px] sm:rounded-[22px]"
        >
          <span>✏️</span>
          <span>스캔 없이 수동으로 물건 추가</span>
        </button>
      </div>
    </div>
  );
}
