import { useEffect, useCallback, useRef } from 'react';
import { useCamera } from '../hooks/useCamera';
import { FlaticonGallery, FlaticonCamera, FlaticonShutter } from './Icon';

export default function Camera({ onCapture }) {
  const { videoRef, photo, error, isActive, startCamera, stopCamera, capturePhoto, clearPhoto } =
    useCamera();
  const fileInputRef = useRef(null);

  useEffect(() => {
    startCamera();
    return () => stopCamera();
  }, [startCamera, stopCamera]);

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
        const image = new Image();
        image.onload = () => {
          // 휴대폰 원본은 지나치게 커서 전송 중 실패할 수 있어, 인식에 충분한 크기로 정리합니다.
          const maxSide = 2048;
          const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(image.width * scale);
          canvas.height = Math.round(image.height * scale);
          canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
          onCapture({ base64: dataUrl.split(',')[1], mimeType: 'image/jpeg', dataUrl });
        };
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    },
    [onCapture]
  );

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 p-8 fluffy-card text-center my-4">
        <div className="p-4 bg-[#FFF0EE] rounded-3xl shadow-xs"><FlaticonCamera size={54} /></div>
        <div className="space-y-2 max-w-sm">
          <p className="text-base font-bold text-[#4A3E3D]">{error}</p>
          <p className="text-sm text-[#806F6D]">
            카메라 권한이 없거나 웹캠을 사용할 수 없습니다. 대신 갤러리나 파일에서 사진을 올려보세요!
          </p>
        </div>
        <label className="fluffy-button cursor-pointer bg-[#FFB7B2] text-[#4A3E3D] px-8 py-4 font-extrabold text-base shadow-[0_10px_24px_rgba(255,183,178,0.4)] flex items-center gap-3">
          <FlaticonGallery size={28} />
          <span>갤러리에서 사진 불러오기</span>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>
        <button
          type="button"
          onClick={startCamera}
          className="fluffy-button bg-white text-[#806F6D] px-6 py-3 font-bold text-sm shadow-[0_8px_20px_rgba(74,62,61,0.08)]"
        >
          ↻ 카메라 다시 시도
        </button>
      </div>
    );
  }

  if (photo) {
    return (
      <div className="flex flex-col items-center gap-2.5 w-full max-w-md sm:max-w-lg md:max-w-[560px] mx-auto">
        <div className="relative w-full rounded-[22px] sm:rounded-[26px] overflow-hidden shadow-[0_12px_28px_rgba(74,62,61,0.1)] bg-[#4A3E3D] aspect-[4/3] max-h-[420px] flex items-center justify-center">
          <img
            src={photo.dataUrl}
            alt="촬영된 사진"
            className="w-full h-full object-contain"
          />
        </div>
        <div className="flex gap-2.5 w-full shrink-0">
          <button
            type="button"
            onClick={handleRetake}
            className="fluffy-button flex-1 py-2.5 px-3.5 bg-white text-[#806F6D] font-bold text-xs sm:text-sm shadow-[0_6px_16px_rgba(74,62,61,0.06)]"
          >
            🔄 다시 찍기
          </button>
          <button
            type="button"
            onClick={handleUsePhoto}
            className="fluffy-button flex-1 py-2.5 px-3.5 bg-[#FFB7B2] text-[#4A3E3D] font-extrabold text-xs sm:text-sm shadow-[0_8px_20px_rgba(255,183,178,0.4)] flex items-center justify-center gap-1.5"
          >
            <span>✨ AI로 물건 분석</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2.5 w-full max-w-md sm:max-w-lg md:max-w-[560px] mx-auto">
      {/* 카메라 라이브 뷰 (살짝 줄인 단정하고 예쁜 4:3 비율) */}
      <div className="relative w-full rounded-[22px] sm:rounded-[26px] overflow-hidden shadow-[0_12px_28px_rgba(74,62,61,0.1)] bg-black aspect-[4/3] max-h-[420px] flex items-center justify-center">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {/* 가이드라인 십자선 오버레이 */}
        <div className="absolute inset-3 sm:inset-5 border border-white/30 rounded-2xl pointer-events-none flex items-center justify-center">
          <span className="text-white/80 text-[11px] sm:text-xs font-semibold px-2.5 py-1 bg-black/45 backdrop-blur-md rounded-full shadow-sm">
            정리할 구역을 화면 안에 비춰주세요
          </span>
        </div>
      </div>

      {/* 셔터 및 갤러리 컨트롤러 바 */}
      <div className="w-full flex items-center justify-between px-4 sm:px-6 py-2.5 bg-white rounded-[22px] sm:rounded-[26px] shadow-[0_8px_24px_rgba(74,62,61,0.06)] border border-[#F4EEEA] shrink-0">
        {/* 갤러리 업로드 버튼 */}
        <label className="fluffy-button cursor-pointer flex items-center gap-1.5 px-3 sm:px-3.5 py-2 bg-[#FFF0E5] hover:bg-[#FFE5D6] text-[#80604F] font-extrabold text-xs shrink-0 transition-all shadow-xs">
          <FlaticonGallery size={18} />
          <span>사진 업로드</span>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </label>

        {/* 셔터 버튼 */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={handleCapture}
            disabled={!isActive}
            title="사진 촬영"
            className="fluffy-button w-14 h-14 sm:w-16 sm:h-16 bg-gradient-to-tr from-[#FF9E99] to-[#FFB7B2] shadow-[0_6px_18px_rgba(255,183,178,0.5)] disabled:opacity-50 flex items-center justify-center ring-4 ring-[#FFF0E5] group transition-all"
          >
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full border-2 border-white/80 flex items-center justify-center transition-transform group-hover:scale-105 group-active:scale-95">
              <FlaticonShutter size={22} />
            </div>
          </button>
          <span className="text-[10px] font-black text-[#806F6D] mt-0.5 tracking-tight">촬영</span>
        </div>

        {/* 우측 균형용 공간 */}
        <div className="w-[74px] sm:w-[84px] hidden xs:block" aria-hidden="true" />
      </div>
    </div>
  );
}
