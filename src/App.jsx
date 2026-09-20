import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from './hooks/useAuth';
import { useItems } from './hooks/useItems';
import ScanPage from './pages/ScanPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';
import Icon from './components/Icon';
import RoomPage from './pages/RoomPage';
import { useRoom, slotCount, findOpenPosition } from './hooks/useRoom';
import UnsavedConfirmModal from './components/UnsavedConfirmModal';
import AuthModal from './components/AuthModal';
import DataRecoveryModal from './components/DataRecoveryModal';
import { useCloudSync } from './hooks/useCloudSync';

const TABS = [
  { id: 'scan', label: '스캔', icon: 'scan' },
  { id: 'dashboard', label: '내 물건', icon: 'list' },
  { id: 'room', label: '내 방', icon: 'box' },
  { id: 'chat', label: 'AI 정리', icon: 'sparkle' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const authHook = useAuth();
  const { user, loading: authLoading } = authHook;
  const userId = user?.uid;
  const itemsHook = useItems(userId);
  const room = useRoom(userId);
  const { syncStatus, syncMessage } = useCloudSync({ user, itemsHook, room });
  const [pendingNotice, setPendingNotice] = useState('');
  const [pendingDeclutterItems, setPendingDeclutterItems] = useState(null);
  const [hasUnsavedScan, setHasUnsavedScan] = useState(false);
  const [scanResetKey, setScanResetKey] = useState(0);
  const [unsavedNavTarget, setUnsavedNavTarget] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);
  const clearPendingNotice = useCallback(() => setPendingNotice(''), []);

  // 미저장 작업 중 브라우저 새로고침/종료 방지
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedScan) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedScan]);

  // CLOOMY 아이콘/로고 클릭 시 홈(스캔) 화면으로 이동
  const handleGoHome = useCallback(() => {
    if (hasUnsavedScan) {
      setUnsavedNavTarget({ type: 'home', targetName: '홈 화면(새로 스캔)' });
      return;
    }
    setScanResetKey((prev) => prev + 1);
    setActiveTab('scan');
  }, [hasUnsavedScan]);

  // 하단 탭 이동 (등록 작업 중이면 모달로 확인)
  const handleTabChange = useCallback(
    (targetTabId) => {
      if (targetTabId === activeTab) {
        if (targetTabId === 'scan') {
          handleGoHome();
        }
        return;
      }

      if (hasUnsavedScan) {
        const targetTab = TABS.find((t) => t.id === targetTabId);
        setUnsavedNavTarget({
          type: 'tab',
          tabId: targetTabId,
          targetName: `'${targetTab?.label || '다른'}' 탭`,
        });
        return;
      }
      setActiveTab(targetTabId);
    },
    [activeTab, hasUnsavedScan, handleGoHome]
  );

  // 미저장 안내 모달에서 '이동하기' 확인 시
  const handleConfirmDiscardNav = useCallback(() => {
    const target = unsavedNavTarget;
    setUnsavedNavTarget(null);
    setHasUnsavedScan(false);
    setScanResetKey((prev) => prev + 1);
    if (!target || target.type === 'home') {
      setActiveTab('scan');
    } else if (target.type === 'tab') {
      setActiveTab(target.tabId);
    }
  }, [unsavedNavTarget]);

  const handleStartDeclutter = useCallback((selectedItems) => {
    setPendingDeclutterItems(selectedItems);
    setActiveTab('chat');
  }, []);

  // 기존 roomId가 없는 레거시 물건들에 대해 해당 가구가 속한 방 또는 첫 번째 방(내 방)의 roomId 자동 보정 및 영구 저장
  const migratedRoomIdsRef = useRef(false);
  useEffect(() => {
    if (migratedRoomIdsRef.current || !itemsHook.items.length || !room.rooms.length) return;
    const missingRoomItems = itemsHook.items.filter((i) => !i.roomId);
    if (missingRoomItems.length > 0) {
      migratedRoomIdsRef.current = true;
      const updates = missingRoomItems.map((item) => {
        const rawLoc = (item.location || '').trim();
        const furnName = rawLoc.includes(' · ') ? rawLoc.slice(0, rawLoc.indexOf(' · ')).trim() : rawLoc;
        let matchedRoomId = room.rooms[0]?.id || 'room-1';
        if (furnName && furnName !== '바닥 보관' && furnName !== '미분류') {
          const found = room.rooms.find((r) => (r.furniture || []).some((f) => f.name === furnName));
          if (found) matchedRoomId = found.id;
        }
        return { id: item.id, roomId: matchedRoomId };
      });
      itemsHook.updateMultipleItems(updates);
    }
  }, [itemsHook.items, room.rooms, itemsHook.updateMultipleItems]);

  // 가구 칸 추가 핸들러 (방 가구와 즉시 연동 및 영구 저장)
  const handleAddSlot = useCallback(
    (furnitureId) => {
      let nextIndex = 0;
      const target = room.furniture.find((f) => f.id === furnitureId);
      if (target) {
        const current = slotCount(target);
        const nextSlots = current + 1;
        nextIndex = nextSlots - 1;
        room.setFurniture((prev) =>
          prev.map((f) => (f.id === furnitureId ? { ...f, slots: nextSlots } : f))
        );
      }
      return nextIndex;
    },
    [room]
  );

  const handleRegistered = (meta = {}) => {
    setHasUnsavedScan(false);
    const targetRoomId = meta.roomId || room.activeRoomId;
    const targetRoom = room.rooms?.find(r => r.id === targetRoomId) || room.activeRoom;
    const targetFurniture = targetRoom?.furniture || room.furniture;

    if (meta.newFurniture) {
      const { type, name, slots } = meta.newFurniture;
      const pos = findOpenPosition(type, targetFurniture);
      if (pos) {
        const newFurnObj = {
          id: crypto.randomUUID(),
          type,
          name,
          ...pos,
          z: 0,
          rotated: false,
          slots: Number.isInteger(slots) ? slots : 1,
        };
        if (targetRoomId === room.activeRoomId) {
          room.setFurniture(prev => [...prev, newFurnObj]);
        } else if (room.updateRoomFurniture) {
          room.updateRoomFurniture(targetRoomId, prev => [...prev, newFurnObj]);
        }
      }
      if (targetRoomId && targetRoomId !== room.activeRoomId && room.setActiveRoomId) {
        room.setActiveRoomId(targetRoomId);
      }
      setPendingNotice(`'${name}'을(를) 원하는 위치에 배치해주세요.`);
      setActiveTab('room');
    } else {
      if (meta.furnitureId && meta.slotIndex !== undefined) {
        const furniture = targetFurniture.find(f => f.id === meta.furnitureId);
        if (furniture) {
          const current = slotCount(furniture);
          const needed = meta.slotIndex + 1;
          if (current < needed) {
            if (targetRoomId === room.activeRoomId) {
              room.setFurniture(prev => prev.map(f =>
                f.id === meta.furnitureId ? { ...f, slots: needed } : f
              ));
            } else if (room.updateRoomFurniture) {
              room.updateRoomFurniture(targetRoomId, prev => prev.map(f =>
                f.id === meta.furnitureId ? { ...f, slots: needed } : f
              ));
            }
          }
        }
      }
      setActiveTab('dashboard');
    }
  };

  const handleAddFurniture = useCallback((newFurniture) => {
    const pos = findOpenPosition(newFurniture.type, room.furniture) || { x: 1, y: 1 };
    const newId = crypto.randomUUID();
    room.setFurniture(prev => [...prev, {
      id: newId,
      type: newFurniture.type,
      name: newFurniture.name,
      ...pos,
      z: 0,
      rotated: false,
      slots: 1,
    }]);
  }, [room]);

  // 인증 상태 로딩 중
  if (authLoading) {
    return (
      <div className="min-h-dvh bg-[#FAF8F5] flex items-center justify-center">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-[#FFF0EE] flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Icon name="box" size={28} strokeWidth={1.65} />
          </div>
          <h1 className="text-xl font-black text-[#B56562]">CLOOMY</h1>
          <p className="text-xs text-[#9A8784] mt-1">불러오는 중...</p>
        </div>
      </div>
    );
  }

  const isLoggedIn = user && !user.isGuest;
  const isCloudConnected = Boolean(isLoggedIn && syncStatus === 'synced');
  const isSyncing = Boolean(isLoggedIn && syncStatus === 'syncing');

  return (
    <div className="min-h-dvh bg-[#FAF8F5] flex flex-col font-sans text-[#4A3E3D]">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md px-4 sm:px-8 py-2 sm:py-2.5 flex items-center justify-between sticky top-0 z-30 shadow-[0_4px_18px_rgba(74,62,61,0.05)]">
        <button
          type="button"
          onClick={handleGoHome}
          className="flex items-center gap-2 text-left group focus:outline-none transition-transform active:scale-95 cursor-pointer"
          title="홈(스캔) 화면으로 이동"
        >
          <span className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-full bg-[#FFF0EE] text-[#B56562] group-hover:scale-105 group-hover:bg-[#FFE5E0] transition-all shadow-xs">
            <Icon name="box" size={18} strokeWidth={1.65} />
          </span>
          <div>
            <h1 className="text-lg sm:text-xl font-black text-[#B56562] tracking-tight group-hover:text-[#9E4E4B] transition-colors leading-tight">
              CLOOMY
            </h1>
            <span className="text-[11px] text-[#9A8784] font-medium hidden sm:inline leading-none">Clear space, feel roomy</span>
          </div>
        </button>

        <div className="flex items-center gap-2 sm:gap-2.5">
          <span className="text-[11px] sm:text-xs font-extrabold text-[#8F5E4D] bg-[#FFF0E5] px-2.5 sm:px-3 py-1.5 rounded-full shadow-[0_3px_10px_rgba(255,218,193,0.3)]">
            등록 물건 {itemsHook.items.length}개
          </span>

          {/* 클라우드 연동 및 백업 아이콘 버튼 */}
          <button
            type="button"
            onClick={() => setShowRecoveryModal(true)}
            className={`relative flex items-center justify-center w-8 h-8 sm:w-9 sm:h-9 rounded-full transition-all cursor-pointer shadow-xs active:scale-95 border ${
              isCloudConnected
                ? 'bg-[#EAF5EC] hover:bg-[#DDF2E1] border-[#B7E4C7] text-[#2E7D32]'
                : isSyncing
                ? 'bg-[#FFFBEB] hover:bg-[#FEF3C7] border-[#FDE68A] text-[#D97706]'
                : !isLoggedIn
                ? 'bg-[#F7F4F0] hover:bg-[#EFEAE4] border-[#E2DAD4] text-[#8F5E4D]'
                : syncStatus === 'permission_denied'
                ? 'bg-[#FFF0EE] hover:bg-[#FFE5E0] border-[#FFCCD2] text-[#E5484D]'
                : 'bg-[#FFF0EE] hover:bg-[#FFE5E0] border-[#FFCCD2] text-[#E5484D]'
            }`}
            title={
              isCloudConnected
                ? '🟢 클라우드 실시간 연동 완료 (모바일/PC 동기화 중)'
                : isSyncing
                ? '🔄 클라우드 실시간 동기화 진행 중...'
                : !isLoggedIn
                ? '☁️ 브라우저 로컬에 안전하게 보관 중 (클릭하여 Google 로그인 & 실시간 연동)'
                : syncStatus === 'permission_denied'
                ? '⚠️ 클라우드 설정 필요 (Firestore 보안 규칙 설정)'
                : '🔴 클라우드 미연동 (클릭하여 모바일/PC 실시간 연동하기)'
            }
          >
            <Icon
              name="cloud"
              size={19}
              strokeWidth={1.9}
              fill={
                isCloudConnected
                  ? '#A5D6A7'
                  : isSyncing
                  ? '#FDE68A'
                  : !isLoggedIn
                  ? '#D5C8C3'
                  : '#FFCDD2'
              }
              fillOpacity={0.45}
              className={isSyncing ? 'animate-pulse' : ''}
            />
          </button>

          {/* 사용자 프로필 / 로그인 버튼 */}
          <button
            type="button"
            onClick={() => setShowAuthModal(true)}
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-xs sm:text-xs font-bold transition-all active:scale-95 shadow-xs ${
              isLoggedIn
                ? 'bg-[#FAF8F5] hover:bg-[#FFF0EE] text-[#4A3E3D]'
                : 'bg-[#B56562] hover:bg-[#9E4E4B] text-white'
            }`}
            title={isLoggedIn ? `${user.displayName} (프로필)` : '로그인'}
          >
            {isLoggedIn ? (
              <>
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-5 h-5 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-[#B56562] text-white flex items-center justify-center text-[10px] font-bold">
                    {(user.displayName || '?')[0].toUpperCase()}
                  </span>
                )}
                <span className="hidden sm:inline max-w-[80px] truncate">{user.displayName}</span>
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 48 48" className="flex-shrink-0">
                  <path fill="#fff" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" opacity=".9"/>
                  <path fill="#fff" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" opacity=".7"/>
                  <path fill="#fff" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z" opacity=".8"/>
                  <path fill="#fff" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" opacity=".6"/>
                </svg>
                <span>로그인</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-16 sm:pb-20">
        <div
          className={`${
            activeTab === 'dashboard'
              ? 'w-full max-w-5xl xl:max-w-6xl px-4 sm:px-6 md:px-8 py-4 sm:py-6'
              : activeTab === 'scan'
              ? 'w-full max-w-5xl px-3 sm:px-6 py-2 sm:py-3'
              : activeTab === 'chat'
              ? 'w-full max-w-6xl xl:max-w-7xl 2xl:max-w-[1600px] px-4 sm:px-6 md:px-8 lg:px-10 py-4 sm:py-6'
              : activeTab === 'room'
              ? 'w-full max-w-6xl xl:max-w-7xl px-4 sm:px-6 md:px-8 py-2 sm:py-3'
              : 'w-full max-w-5xl px-4 sm:px-6 py-4 sm:py-6'
          } mx-auto transition-all duration-300`}
        >
          {activeTab === 'scan' && (
            <ScanPage
              key={scanResetKey}
              itemsHook={itemsHook}
              rooms={room.rooms}
              activeRoomId={room.activeRoomId}
              roomFurniture={room.furniture}
              onRegistered={handleRegistered}
              onUnsavedChange={setHasUnsavedScan}
              onAddSlot={handleAddSlot}
            />
          )}
          {activeTab === 'dashboard' && (
            <DashboardPage
              itemsHook={itemsHook}
              rooms={room.rooms}
              activeRoomId={room.activeRoomId}
              setActiveRoomId={room.setActiveRoomId}
              roomFurniture={room.furniture}
              onAddFurniture={handleAddFurniture}
              onStartDeclutter={handleStartDeclutter}
              onAddSlot={handleAddSlot}
            />
          )}
          {activeTab === 'room' && (
            <RoomPage
              itemsHook={itemsHook}
              room={room}
              onScan={() => handleTabChange('scan')}
              pendingNotice={pendingNotice}
              clearPendingNotice={clearPendingNotice}
            />
          )}
          {activeTab === 'chat' && (
            <ChatPage
              itemsHook={itemsHook}
              declutterItems={pendingDeclutterItems}
              onClearDeclutterItems={() => setPendingDeclutterItems(null)}
            />
          )}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md flex z-40 shadow-[0_-4px_20px_rgba(74,62,61,0.06)] border-t border-[#f2ece6]">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 sm:py-2.5 transition-all ${
                isActive
                  ? 'text-[#B56562] font-black scale-102'
                  : 'text-[#B9A8A5] hover:text-[#806F6D] font-semibold'
              }`}
            >
              <span className="mb-0.5"><Icon name={tab.icon} size={20} strokeWidth={isActive ? 2 : 1.7} /></span>
              <span className="text-[11px] sm:text-xs tracking-tight">{tab.label}</span>
              {isActive && <div className="w-6 h-0.5 bg-[#FFB7B2] rounded-full mt-0.5"></div>}
            </button>
          );
        })}
      </nav>

      {/* Unsaved changes confirmation modal */}
      <UnsavedConfirmModal
        isOpen={Boolean(unsavedNavTarget)}
        targetName={unsavedNavTarget?.targetName || '홈 화면'}
        onConfirm={handleConfirmDiscardNav}
        onCancel={() => setUnsavedNavTarget(null)}
      />

      {/* 로그인 / 프로필 모달 */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={user}
        onLoginGoogle={authHook.loginWithGoogle}
        onLogout={authHook.logout}
        onContinueGuest={authHook.continueAsGuest}
      />

      {/* 클라우드 연동 / 데이터 복구 / 백업 모달 */}
      <DataRecoveryModal
        isOpen={showRecoveryModal}
        onClose={() => setShowRecoveryModal(false)}
        itemsHook={itemsHook}
        room={room}
        user={user}
        syncStatus={syncStatus}
        syncMessage={syncMessage}
        onOpenAuth={() => setShowAuthModal(true)}
      />
    </div>
  );
}
