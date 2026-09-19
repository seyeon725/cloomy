# 🧸 CLOOMY (클루미) - AI 3D Room Organizer

> **Clear space, feel roomy.**  
> 사진 한 장으로 시작하는 스마트 룸 오거나이저 웹 서비스

[![Live Demo](https://img.shields.io/badge/Live_Demo-cloomy.vercel.app-FFB7B2?style=for-the-badge)](https://cloomy.vercel.app)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![Gemini API](https://img.shields.io/badge/Google_Gemini-Vision_&_Chat-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev/)
[![Vite](https://img.shields.io/badge/Vite-8.3-646CFF?style=for-the-badge&logo=vite)](https://vitejs.dev/)

---

## 🌟 프로젝트 소개

시중에는 인테리어 앱이나 방 배치 앱은 많지만, 정작 우리 일상에서 가장 번거로운 **'방 정리와 수납'을 실질적으로 도와주는 서비스**는 찾기 어려웠습니다. 기존 정리 앱은 물건 이름과 위치를 하나하나 텍스트로 타이핑해야 해 등록 피로도가 컸고, 단순 목록만으로는 물건이 내 방 어디에 있는지 직관적으로 떠올리기 어려웠습니다.

**CLOOMY**는 카메라로 방 안의 물건을 찍기만 하면 **AI가 물건을 자동 감지·크롭**해주고, 실제 내 방처럼 꾸민 **3D 입체 공간(아이소메트릭)의 가구와 칸**에 쏙쏙 정리할 수 있는 올인원 공간 정리 솔루션입니다.

🔗 **공식 배포 주소**: [https://cloomy.vercel.app](https://cloomy.vercel.app)  
*(별도 설치나 회원가입 없이 PC/모바일 브라우저에서 바로 체험 가능)*

---

## 🚀 주요 기능

### 1. 📸 AI 멀티모달 카메라 스캔 & 자동 썸네일 크롭
- 카메라로 책상이나 서랍을 비추면 최신 **Gemini 멀티모달 비전 모델**이 여러 물건을 다중 감지(Bounding Box)합니다.
- 브라우저 Canvas에서 물체별로 15% 여백을 주어 260px 정사각형 썸네일로 즉시 클로즈업 크롭합니다.
- 원하는 가구와 칸(예: '책상 위', '서랍장 2번째 칸')만 탭하면 타이핑 없이 등록이 완료됩니다.

### 2. 🛋️ 인터랙티브 3D 입체 방 & 가구 칸별 수납 시각화
- 텍스트 리스트가 아닌 실제 내 방을 미니어처로 시각화한 **3D 공간 메타포**를 제공합니다.
- 마우스 드래그와 방향키로 가구(책장, 옷장, 책상, 침대, 서랍장 등)를 자유롭게 배치, 90° 회전, 적재(위아래 쌓기)할 수 있습니다.
- 가구를 누르면 1~6번째 칸별 보관 물건이 썸네일과 함께 펼쳐지며, 다중 선택을 통해 다른 가구로 한 번에 이동할 수 있습니다.

### 3. 💬 AI 1:1 대화형 정리 코칭 에이전트 ('AI 정리' 탭)
- 방 정리가 어려운 가장 큰 이유인 '버리지 못하는 마음'을 해결합니다.
- 고민되는 물건을 선택하면 AI 코치가 사용 빈도와 애착도를 인터뷰하여 **보관 / 나눔 / 당근 판매 / 버림**의 명확하고 단호한 가이드를 제공합니다.

### 4. 📋 스마트 검색 및 물건 통합 관리 대시보드
- 물건 이름 검색 및 카테고리 필터링을 통해 찾고 싶은 물건의 보관 위치를 1초 만에 검색합니다.

---

## 🛠️ 기술적 특징 & 최적화

- **순수 React + SVG 경량 3D 엔진**: Three.js 같은 무거운 WebGL 그래픽 라이브러리 없이 자체 SVG 삼각 투영 좌표계를 설계하여, 모바일 저사양 기기에서도 발열과 렉 없이 60fps로 매끄럽게 동작합니다.
- **클라이언트단 이미지 전처리**: 촬영한 사진을 Canvas에서 최적 해상도로 압축하여 Gemini API로 전송함으로써 네트워크 페이로드와 토큰 소모량을 대폭 절감했습니다.
- **Local-First & 확장 아키텍처**: 브라우저 로컬 스토리지를 활용해 로그인 없이도 데이터가 영구 보존되며, 추후 멀티 디바이스 동기화를 위해 Firebase 연동 구조를 사전에 갖추었습니다.

---

## 💻 로컬 실행 방법

### 1. 환경 변수 설정
루트 디렉토리에 `.env` 파일을 생성하고 Google AI Studio에서 발급받은 키를 입력합니다.
```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
```

### 2. 설치 및 실행
```bash
# 패키지 설치
npm install

# 로컬 개발 서버 실행
npm run dev
```
브라우저에서 `http://localhost:5173`으로 접속합니다.

### 3. 프로덕션 빌드
```bash
npm run build
npm run preview
```

---

## 👥 협업 & 개발 과정

- **Google Antigravity Session ID**: `ea9368b5-bb17-4883-95eb-1e3b57b55e0a`
- AI 페어 프로그래밍을 통해 기획부터 아키텍처 수립, 데모 마켓 현장 피드백(가구 배치 버튼 시인성 강화, 칸 수 6칸 제한, 상하단 바 슬림화 등)을 실시간으로 반영하여 완성도를 높였습니다.
