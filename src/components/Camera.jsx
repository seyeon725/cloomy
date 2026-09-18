import { useEffect, useCallback, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';

export default function Camera({ onCapture }) {
  const { videoRef, photo, error, isActive, startCamera, stopCamera, capturePhoto, clearPhoto } =
    useCamera();
  const fileInputRef = useRef(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, []);

  const handleCapture = useCallback(() => {
    const result = capturePhoto();
    if (result) {
      stopCamera();
    }
  }, [capturePhoto, stopCamera]);

  const handleRetake = useCallback(() => {
    clearPhoto();
    startCamera();
  }, [clearPhoto, startCamera]);

  const handleUsePhoto = useCallback(() => {
    if (photo) {
      onCapture(photo);
    }
  }, [photo, onCapture]);

  const handleFileUpload = useCallback(
    (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result;
        const base64 = dataUrl.split(',')[1];
        onCapture({ base64, mimeType: file.type, dataUrl });
      };
      reader.readAsDataURL(file);
    },
    [onCapture]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8 bg-white rounded-3xl border border-gray-200 shadow-sm text-center my-4">
        <div className="text-7xl">📸</div>
        <div className="space-y-2 max-w-sm">
          <p className="text-base font-bold text-gray-800">{error}</p>
          <p className="text-sm text-gray-500">
            카메라 권한이 없거나 웹캠을 사용할 수 없습니다. 대신 갤러리나 파일에서 사진을 올려보세요!
          </p>
        </div>
        <label className="cursor-pointer bg-indigo-600 text-white px-8 py-4 rounded-2xl font-extrabold text-base hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center gap-3">
          <span className="text-2xl">🖼️</span>
          <span>갤러리에서 사진 불러오기</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
      </div>
    );
  }

  if (photo) {
    return (
      <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
        <div className="relative w-full rounded-3xl overflow-hidden shadow-xl border-4 border-white bg-slate-900 aspect-[4/3] max-h-[500px]">
          <img
            src={photo.dataUrl}
            alt="촬영된 사진"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex gap-4 w-full">
          <button
            type="button"
            onClick={handleRetake}
            className="flex-1 py-4 px-5 rounded-2xl border-2 border-gray-300 text-gray-800 font-bold text-base sm:text-lg hover:bg-gray-100 transition-colors"
          >
            🔄 다시 찍기
          </button>
          <button
            type="button"
            onClick={handleUsePhoto}
            className="flex-1 py-4 px-5 rounded-2xl bg-indigo-600 text-white font-extrabold text-base sm:text-lg hover:bg-indigo-700 transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
          >
            <span>✨ AI로 물건 분석</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-xl mx-auto">
      {/* 카메라 라이브 뷰 (크고 시원하게) */}
      <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl bg-black border-4 border-white aspect-[4/3] max-h-[500px] flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {/* 가이드라인 십자선 오버레이 */}
        <div className="absolute inset-8 border border-white/30 rounded-2xl pointer-events-none flex items-center justify-center">
          <span className="text-white/60 text-xs font-semibold px-3 py-1 bg-black/40 backdrop-blur rounded-full">
            정리할 구역을 화면 안에 비춰주세요
          </span>
        </div>
      </div>

      {/* 셔터 및 갤러리 컨트롤러 바 */}
      <div className="w-full flex items-center justify-between px-6 py-4 bg-white rounded-3xl shadow-md border border-gray-200">
        {/* 갤러리 업로드 버튼 */}
        <label className="cursor-pointer flex items-center gap-2 px-4 py-3 rounded-2xl bg-slate-100 hover:bg-slate-200 transition-colors text-slate-800 font-bold text-sm sm:text-base shrink-0">
          <span className="text-2xl">🖼️</span>
          <span>사진 업로드</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>

        {/* 대형 셔터 버튼 */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={handleCapture}
            disabled={!isActive}
            title="사진 촬영"
            className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-indigo-600 border-4 border-white shadow-2xl hover:bg-indigo-700 active:scale-90 transition-all disabled:opacity-50 flex items-center justify-center ring-4 ring-indigo-300"
          >
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-white/60 flex items-center justify-center">
              <span className="text-2xl">📸</span>
            </div>
          </button>
          <span className="text-xs font-bold text-gray-500 mt-1.5">촬영</span>
        </div>

        {/* 빈 공간 균형용 (or 빠른 가이드) */}
        <div className="w-[120px] text-right hidden sm:block">
          <span className="text-xs text-gray-400 font-medium">여러 물건도<br />한 번에 인식해요</span>
        </div>
      </div>
    </div>
  );
}
