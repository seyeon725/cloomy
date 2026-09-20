const paths = {
  scan: <><path d="M4 7V5a1 1 0 0 1 1-1h2M17 4h2a1 1 0 0 1 1 1v2M20 17v2a1 1 0 0 1-1 1h-2M7 20H5a1 1 0 0 1-1-1v-2" /><path d="M8 12h8M12 8v8" /></>,
  box: <><path d="m21 8-9-5-9 5 9 5 9-5Z" /><path d="M3 8v8l9 5 9-5V8M12 13v8" /></>,
  list: <><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  sparkle: <><path d="m12 3-1.4 5.6L5 10l5.6 1.4L12 17l1.4-5.6L19 10l-5.6-1.4L12 3Z" /><path d="m19 16-.6 2.4L16 19l2.4.6L19 22l.6-2.4L22 19l-2.4-.6L19 16Z" /></>,
  trash: <><path d="M4 7h16M10 11v6M14 11v6M9 7l1-3h4l1 3M6 7l1 14h10l1-14" /></>,
  heartHand: <><path d="M8 12.5 5.7 10A3.2 3.2 0 0 1 10.3 5.5L12 7.2l1.7-1.7a3.2 3.2 0 0 1 4.6 4.5L16 12.5" /><path d="M3 18h4l2-2h4.5a2 2 0 1 0 0-4H11l-2-2H5M3 18v3h5l2-2h7.5L21 16" /></>,
  archive: <><path d="M4 5h16v4H4zM6 9v10h12V9M10 13h4" /></>,
  pencil: <><path d="m4 20 4.2-1 10.4-10.4a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z" /><path d="m13.8 7.2 3 3" /></>,
  pin: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  refresh: <><path d="M20 11a8 8 0 0 0-14.8-3M4 5v4h4M4 13a8 8 0 0 0 14.8 3M20 19v-4h-4" /></>,
  camera: <><path d="M4 8h3l1.5-3h7L17 8h3a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="14" r="3.5" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="3" /><circle cx="8.5" cy="9" r="1" /><path d="m21 16-5-5L5 20" /></>,
  close: <><path d="M18 6 6 18M6 6l12 12" /></>,
  filter: <><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></>,
};

export default function Icon({ name, size = 20, strokeWidth = 1.8, className = '', label }) {
  return <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden={label ? undefined : true} aria-label={label} className={className}>{paths[name]}</svg>;
}

/**
 * Flaticon 스타일 귀엽고 부드러운 갤러리/사진 업로드 SVG 아이콘
 */
export function FlaticonGallery({ size = 28, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* 액자 프레임 */}
      <rect x="2.5" y="3.5" width="27" height="25" rx="7" fill="#FFF2EC" stroke="#9E684D" strokeWidth="2" />
      {/* 해/달 */}
      <circle cx="9.5" cy="10.5" r="2.5" fill="#FFAAA6" stroke="#9E684D" strokeWidth="1.5" />
      {/* 언덕 1 */}
      <path
        d="M3.5 24L11 15.5L18.5 24"
        fill="#FFD3B6"
        stroke="#9E684D"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 언덕 2 */}
      <path
        d="M14.5 24L19 18.5L28.5 26"
        fill="#FFB7B2"
        stroke="#9E684D"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 우측 하단 귀여운 업로드 뱃지 */}
      <circle cx="23.5" cy="22.5" r="6" fill="#B56562" stroke="#FFFFFF" strokeWidth="1.8" />
      <path
        d="M23.5 25.5V19.5M23.5 19.5L21 22M23.5 19.5L26 22"
        stroke="#FFFFFF"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Flaticon 스타일 둥글둥글하고 귀여운 카메라 SVG 아이콘
 */
export function FlaticonCamera({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* 셔터 꼭지 */}
      <rect x="8" y="6.5" width="4.5" height="2.5" rx="1.2" fill="#8F5E4D" />
      {/* 상단 뷰파인더/플래시 굴곡 */}
      <path
        d="M13 9C13.5 7.2 14.8 6.5 16.5 6.5H19.5C21.2 6.5 22.5 7.2 23 9"
        fill="#FFE2D6"
        stroke="#8F5E4D"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* 카메라 본체 */}
      <rect x="4" y="9" width="28" height="20.5" rx="6.5" fill="#FFF7F2" stroke="#8F5E4D" strokeWidth="2" />
      {/* 카메라 띠 장식 */}
      <path d="M4 14.5H32" stroke="#FFDAC1" strokeWidth="2.2" />
      {/* 렌즈 외곽 링 */}
      <circle cx="18" cy="19.5" r="6.8" fill="#FFDAC1" stroke="#8F5E4D" strokeWidth="2" />
      {/* 렌즈 중심 */}
      <circle cx="18" cy="19.5" r="4.2" fill="#8F5E4D" />
      {/* 렌즈 하이라이트 반사광 */}
      <circle cx="19.5" cy="18" r="1.3" fill="#FFFFFF" />
      {/* 플래시/센서 */}
      <circle cx="26.5" cy="13.5" r="1.5" fill="#FFAAA6" stroke="#8F5E4D" strokeWidth="1.2" />
    </svg>
  );
}

/**
 * 촬영 셔터 버튼 전용 Flaticon 셔터 렌즈 SVG 아이콘
 */
export function FlaticonShutter({ size = 36, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 44 44"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* 외곽 점선 링 */}
      <circle cx="22" cy="22" r="20" stroke="#FFFFFF" strokeWidth="2.2" strokeDasharray="3 2" opacity="0.6" />
      {/* 내부 하얀 셔터 원형 */}
      <circle cx="22" cy="22" r="16" fill="#FFFFFF" />
      {/* 카메라 실루엣 */}
      <rect x="12" y="15.5" width="20" height="14" rx="4" fill="#B56562" />
      <path d="M17 15.5L18.5 13H23.5L25 15.5" fill="#B56562" />
      {/* 렌즈 링 */}
      <circle cx="22" cy="22.5" r="4.8" fill="#FFF0EE" />
      <circle cx="22" cy="22.5" r="3" fill="#4A3E3D" />
      <circle cx="23.2" cy="21.3" r="0.9" fill="#FFFFFF" />
      {/* 플래시 */}
      <circle cx="28" cy="18" r="1" fill="#FFDAC1" />
    </svg>
  );
}

/**
 * Flaticon 스타일 깔끔하고 부드러운 연필/편집 SVG 아이콘
 */
export function FlaticonEdit({ size = 18, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      {/* 뒤쪽 핑크 지우개 팁 */}
      <path
        d="M16.5 9.2L22.8 15.5L24.8 13.5C25.8 12.5 25.8 10.9 24.8 9.9L22.1 7.2C21.1 6.2 19.5 6.2 18.5 7.2L16.5 9.2Z"
        fill="#FFAAA6"
        stroke="#8F5E4D"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 금속 밴드 */}
      <path
        d="M16.5 9.2L22.8 15.5L20.8 17.5L14.5 11.2L16.5 9.2Z"
        fill="#E8DFD8"
        stroke="#8F5E4D"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* 연필 바디 */}
      <path
        d="M14.5 11.2L20.8 17.5L9.8 28.5L3.5 22.2L14.5 11.2Z"
        fill="#FFE2D6"
        stroke="#8F5E4D"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* 바디 음영/디테일 라인 */}
      <path
        d="M13 12.7L6.7 19"
        stroke="#FFB8A5"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* 깎인 나무 팁 */}
      <path
        d="M3.5 22.2L9.8 28.5L2 30L3.5 22.2Z"
        fill="#FFF7F2"
        stroke="#8F5E4D"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {/* 흑연 심 */}
      <path
        d="M2 30L4 28.5L3.5 28L2 30Z"
        fill="#8F5E4D"
      />
    </svg>
  );
}

/**
 * Flaticon 스타일 완료 체크 SVG 아이콘
 */
export function FlaticonCheck({ size = 18, strokeWidth = 2.4, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 ${className}`}
    >
      <path
        d="M4.5 12.5L9.5 17.5L19.5 6.5"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

