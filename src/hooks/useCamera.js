import { useState, useRef, useCallback } from 'react';

export function useCamera() {
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null); // { base64, mimeType, dataUrl }
  const [error, setError] = useState(null);
  const [isActive, setIsActive] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const startCamera = useCallback(async () => {
    const stopActiveStream = () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
    try {
      setError(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new DOMException('Camera API is unavailable', 'NotSupportedError');
      }
      stopActiveStream();
      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (primaryError) {
        // 데스크톱 웹캠 등 후면 카메라 조건을 지원하지 않는 환경에서는 일반 웹캠으로 한 번 더 시도합니다.
        if (!['OverconstrainedError', 'NotFoundError'].includes(primaryError.name)) throw primaryError;
        mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = mediaStream;
      setStream(mediaStream);
      setIsActive(true);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      const messages = {
        NotAllowedError: '카메라 권한이 차단되어 있어요. 주소창의 카메라 권한을 허용한 뒤 다시 시도해주세요.',
        NotFoundError: '사용할 수 있는 카메라를 찾지 못했어요. 카메라 연결 상태를 확인해주세요.',
        NotReadableError: '다른 앱이 카메라를 사용 중이에요. 카메라 앱을 닫고 다시 시도해주세요.',
        NotSupportedError: '이 브라우저에서는 카메라를 사용할 수 없어요.',
      };
      setError(messages[err.name] || '카메라를 시작하지 못했어요. 잠시 뒤 다시 시도해주세요.');
      setIsActive(false);
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
    setIsActive(false);
  }, []);

  const capturePhoto = useCallback(() => {
    if (!videoRef.current) return null;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    const base64 = dataUrl.split(',')[1];
    const result = { base64, mimeType: 'image/jpeg', dataUrl };
    setPhoto(result);
    return result;
  }, []);

  const clearPhoto = useCallback(() => {
    setPhoto(null);
  }, []);

  return {
    videoRef,
    stream,
    photo,
    error,
    isActive,
    startCamera,
    stopCamera,
    capturePhoto,
    clearPhoto,
  };
}
