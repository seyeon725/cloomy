import { useState } from 'react';
import Camera from '../components/Camera';
import ItemList from '../components/ItemList';
import { analyzeImage } from '../services/gemini';

export default function ScanPage({ itemsHook, onRegistered }) {
  const { addItems, getLocations } = itemsHook;
  const [step, setStep] = useState('camera'); // camera | loading | results
  const [recognizedItems, setRecognizedItems] = useState([]);
  const [currentPhoto, setCurrentPhoto] = useState(null);
  const [error, setError] = useState(null);

  const handleCapture = async (photo) => {
    setCurrentPhoto(photo);
    setStep('loading');
    setError(null);
    try {
      const items = await analyzeImage(photo.base64, photo.mimeType);
      setRecognizedItems(items);
      setStep('results');
    } catch (err) {
      console.error('Recognition error:', err);
      setError('물건 인식에 실패했어요. 다시 시도해주세요.');
      setStep('camera');
    }
  };

  const handleSave = (selectedItems, location) => {
    try {
      addItems(selectedItems, location);
      setStep('camera');
      setRecognizedItems([]);
      setCurrentPhoto(null);
      if (onRegistered) {
        onRegistered();
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('물건 저장 중 오류가 발생했습니다.');
    }
  };

  const handleCancel = () => {
    setStep('camera');
    setRecognizedItems([]);
    setCurrentPhoto(null);
  };

  if (step === 'loading') {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <div className="relative">
          <div className="w-16 h-16 border-4 border-indigo-200 rounded-full"></div>
          <div className="absolute top-0 left-0 w-16 h-16 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-600 font-medium">AI가 물건을 인식하고 있어요...</p>
        <p className="text-sm text-gray-400">잠시만 기다려주세요 🔍</p>
      </div>
    );
  }

  if (step === 'results') {
    return (
      <div>
        {currentPhoto && (
          <div className="mb-4 rounded-xl overflow-hidden shadow-sm">
            <img src={currentPhoto.dataUrl} alt="촬영한 사진" className="w-full" />
          </div>
        )}
        <ItemList
          items={recognizedItems}
          onSave={handleSave}
          onCancel={handleCancel}
          existingLocations={getLocations()}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-gray-900">물건 스캔</h2>
        <p className="text-sm text-gray-500 mt-1">
          정리할 곳을 사진 찍어주세요 📸
        </p>
      </div>
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-600 text-sm">
          {error}
        </div>
      )}
      <Camera onCapture={handleCapture} />
    </div>
  );
}
