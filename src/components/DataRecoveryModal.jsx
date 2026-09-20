import { useState, useEffect, useRef } from 'react';
import { PRELOADED_RECOVERY_DATA } from '../data/recoveryBackup';
import { saveCloudData } from '../services/cloudSync';
import Icon from './Icon';

export default function DataRecoveryModal({
  isOpen,
  onClose,
  itemsHook,
  room,
  user,
  syncStatus,
  syncMessage,
  onOpenAuth,
}) {
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');
  const [copiedRule, setCopiedRule] = useState(false);
  const [showRuleGuide, setShowRuleGuide] = useState(syncStatus === 'permission_denied');
  const [showRestoreDetails, setShowRestoreDetails] = useState(false);
  const fileInputRef = useRef(null);

  const isLoggedIn = user && !user.isGuest;

  useEffect(() => {
    if (!isOpen) return;
    setMessage('');
    if (syncStatus === 'permission_denied') {
      setShowRuleGuide(true);
    }
  }, [isOpen, syncStatus]);

  if (!isOpen) return null;

  const handleRestorePreloaded = async () => {
    try {
      if (itemsHook?.setItems) {
        itemsHook.setItems(PRELOADED_RECOVERY_DATA.items);
      }
      if (room?.setRooms) {
        room.setRooms(PRELOADED_RECOVERY_DATA.rooms);
      }
      if (room?.setActiveRoomId) {
        room.setActiveRoomId(PRELOADED_RECOVERY_DATA.activeRoomId);
      }

      const userKey = isLoggedIn ? `cloomy_items_${user.uid}` : 'cloomy_items';
      const userRoomKey = isLoggedIn ? `cloomy_rooms_${user.uid}` : 'cloomy_rooms';
      const activeKey = isLoggedIn ? `cloomy_active_room_id_${user.uid}` : 'cloomy_active_room_id';

      try {
        localStorage.setItem(userKey, JSON.stringify(PRELOADED_RECOVERY_DATA.items));
        localStorage.setItem('cloomy_items', JSON.stringify(PRELOADED_RECOVERY_DATA.items));
        localStorage.setItem(userRoomKey, JSON.stringify(PRELOADED_RECOVERY_DATA.rooms));
        localStorage.setItem('cloomy_rooms', JSON.stringify(PRELOADED_RECOVERY_DATA.rooms));
        localStorage.setItem(activeKey, PRELOADED_RECOVERY_DATA.activeRoomId);
        localStorage.setItem('cloomy_active_room_id', PRELOADED_RECOVERY_DATA.activeRoomId);
      } catch (storageErr) {
        console.warn('localStorage 저장 경고:', storageErr);
      }

      if (isLoggedIn) {
        saveCloudData(user.uid, PRELOADED_RECOVERY_DATA).catch((cloudErr) => {
          console.warn('클라우드 저장 대기:', cloudErr);
        });
      }

      setMessage(
        `전체 물건 ${PRELOADED_RECOVERY_DATA.items.length}개와 방 2개('내 방' 12개 가구, '거실')가 완벽히 복원되었습니다! 🎉`
      );
    } catch (e) {
      console.error('복원 에러 상세:', e);
      setMessage(`복원 중 오류가 발생했습니다: ${e?.message || e}`);
    }
  };

  const firestoreRuleText = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}`;

  const handleCopyRule = () => {
    navigator.clipboard.writeText(firestoreRuleText);
    setCopiedRule(true);
    setTimeout(() => setCopiedRule(false), 2000);
  };

  const handleExportClipboard = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      items: itemsHook.items,
      rooms: room.rooms,
      activeRoomId: room.activeRoomId,
    };
    navigator.clipboard.writeText(JSON.stringify(backup, null, 2));
    setMessage('클립보드에 백업 데이터가 복사되었습니다! 다른 브라우저나 기기에서 붙여넣으실 수 있습니다.');
  };

  const handleDownloadBackup = () => {
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      items: itemsHook.items,
      rooms: room.rooms,
      activeRoomId: room.activeRoomId,
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cloomy_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage('백업 JSON 파일이 성공적으로 다운로드되었습니다! 📁');
  };

  const applyImportData = (parsed) => {
    let itemCount = 0;
    let roomCount = 0;
    if (parsed.items && Array.isArray(parsed.items)) {
      if (itemsHook?.setItems) itemsHook.setItems(parsed.items);
      const userKey = isLoggedIn ? `cloomy_items_${user.uid}` : 'cloomy_items';
      try {
        localStorage.setItem(userKey, JSON.stringify(parsed.items));
        localStorage.setItem('cloomy_items', JSON.stringify(parsed.items));
      } catch {}
      itemCount = parsed.items.length;
    }

    if (parsed.rooms && Array.isArray(parsed.rooms)) {
      if (room?.setRooms) room.setRooms(parsed.rooms);
      const userRoomKey = isLoggedIn ? `cloomy_rooms_${user.uid}` : 'cloomy_rooms';
      try {
        localStorage.setItem(userRoomKey, JSON.stringify(parsed.rooms));
        localStorage.setItem('cloomy_rooms', JSON.stringify(parsed.rooms));
      } catch {}
      roomCount = parsed.rooms.length;
    }

    if (parsed.activeRoomId && room?.setActiveRoomId) {
      room.setActiveRoomId(parsed.activeRoomId);
      const activeKey = isLoggedIn ? `cloomy_active_room_id_${user.uid}` : 'cloomy_active_room_id';
      try {
        localStorage.setItem(activeKey, parsed.activeRoomId);
        localStorage.setItem('cloomy_active_room_id', parsed.activeRoomId);
      } catch {}
    }

    setMessage(`성공적으로 복원되었습니다! (물건 ${itemCount}개, 방 ${roomCount}개) ✨`);
    setImportText('');
  };

  const handleImportText = () => {
    try {
      const parsed = JSON.parse(importText.trim());
      applyImportData(parsed);
    } catch {
      setMessage('올바른 백업 JSON 형식이 아닙니다. 형식을 확인해주세요.');
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result);
        applyImportData(parsed);
      } catch {
        setMessage('파일 내용을 읽는 중 오류가 발생했습니다. 유효한 JSON 백업 파일인지 확인해주세요.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleResetAll = () => {
    if (
      !window.confirm(
        '정말 현재 브라우저의 물건과 방 배치를 모두 초기화하시겠습니까?\n(필요 시 [내 데이터 백업]을 먼저 진행해주세요.)'
      )
    ) {
      return;
    }
    const defaultRooms = [
      {
        id: 'room-1',
        name: '내 방',
        furniture: [
          { id: 'f-1', type: 'desk', name: '책상', x: 0, y: 0, z: 0, rotated: false, slots: 2 },
          { id: 'f-2', type: 'bed', name: '침대', x: 2, y: 0, z: 0, rotated: false, slots: 1 },
          { id: 'f-3', type: 'bookshelf', name: '책장', x: 4, y: 0, z: 0, rotated: false, slots: 3 },
          { id: 'f-4', type: 'closet', name: '옷장', x: 0, y: 3, z: 0, rotated: false, slots: 2 },
          { id: 'f-5', type: 'drawer', name: '서랍장', x: 3, y: 3, z: 0, rotated: false, slots: 3 },
          { id: 'f-6', type: 'hanger', name: '행거', x: 4, y: 3, z: 0, rotated: false, slots: 1 },
        ],
        door: { x: 2, y: 4 },
      },
    ];

    if (itemsHook?.setItems) itemsHook.setItems([]);
    if (room?.setRooms) room.setRooms(defaultRooms);
    if (room?.setActiveRoomId) room.setActiveRoomId('room-1');

    const userKey = isLoggedIn ? `cloomy_items_${user.uid}` : 'cloomy_items';
    const userRoomKey = isLoggedIn ? `cloomy_rooms_${user.uid}` : 'cloomy_rooms';
    try {
      localStorage.setItem(userKey, JSON.stringify([]));
      localStorage.setItem('cloomy_items', JSON.stringify([]));
      localStorage.setItem(userRoomKey, JSON.stringify(defaultRooms));
      localStorage.setItem('cloomy_rooms', JSON.stringify(defaultRooms));
    } catch {}

    setMessage('새로운 시작을 위해 데이터가 깨끗하게 초기화되었습니다.');
  };

  const isCloudConnected = Boolean(isLoggedIn && syncStatus === 'synced');

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl animate-[fadeIn_0.15s_ease-out] max-h-[88vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 모달 상단 헤더 */}
        <div className="flex items-center justify-between pb-3 border-b border-[#F0ECE9] mb-4">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-9 h-9 rounded-2xl flex items-center justify-center shadow-xs border ${
                isCloudConnected
                  ? 'bg-[#EAF5EC] border-[#B7E4C7] text-[#2E7D32]'
                  : 'bg-[#FFF0EE] border-[#FFCCD2] text-[#E5484D]'
              }`}
            >
              <Icon
                name="cloud"
                size={20}
                strokeWidth={2}
                fill={isCloudConnected ? '#A5D6A7' : '#FFCDD2'}
                fillOpacity={0.45}
              />
            </span>
            <div>
              <h3 className="text-base sm:text-lg font-black text-[#4A3E3D] tracking-tight">
                클라우드 연동 및 백업 관리
              </h3>
              <p className="text-[11px] text-[#9A8784]">
                모바일·PC 실시간 동기화 및 내 데이터 백업
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF8F5] hover:bg-[#F0ECE9] text-[#705E5B] flex items-center justify-center font-bold text-sm cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {message && (
          <div className="p-3 mb-4 rounded-2xl bg-[#EAF5EC] border border-[#D4ECD8] text-[#3D7C4F] text-xs font-bold leading-relaxed">
            {message}
          </div>
        )}

        {/* 1. 실시간 클라우드 동기화 섹션 */}
        <div className="mb-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFE8E3]">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-xs font-extrabold text-[#8F5E4D] uppercase tracking-wider flex items-center gap-1.5">
              <span>☁️</span> 실시간 클라우드 연동
            </h4>
            {isLoggedIn && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  syncStatus === 'permission_denied'
                    ? 'bg-[#FFF0EE] text-[#E5484D] border border-[#FFD5CF]'
                    : syncStatus === 'syncing'
                    ? 'bg-[#FFF0E5] text-[#D97706]'
                    : 'bg-[#EAF5EC] text-[#3D7C4F]'
                }`}
              >
                {syncStatus === 'permission_denied'
                  ? '⚠️ 규칙 설정 필요'
                  : syncStatus === 'syncing'
                  ? '동기화 중...'
                  : '연동 완료'}
              </span>
            )}
          </div>

          {isLoggedIn ? (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-white border border-[#EFE8E3]">
                {user.photoURL ? (
                  <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="w-8 h-8 rounded-full bg-[#B56562] text-white flex items-center justify-center text-xs font-bold">
                    {(user.displayName || '?')[0].toUpperCase()}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-[#4A3E3D] block truncate">
                    {user.displayName || 'Google 계정'}
                  </span>
                  <span className="text-[11px] text-[#9A8784] block truncate">
                    {user.email || '연동됨'}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-[#705E5B] leading-relaxed">
                스마트폰이나 다른 기기에서 동일한 구글 계정으로 로그인하면 등록된 물건과 방 배치가 실시간으로 자동 연동됩니다.
              </p>

              {syncStatus === 'permission_denied' && (
                <div className="p-3 rounded-xl bg-[#FFF5F3] border border-[#FFD5CF] text-xs text-[#B56562]">
                  <p className="font-bold mb-1">
                    ⚠️ Firebase 보안 규칙 게시가 필요합니다.
                  </p>
                  <p className="text-[11px] text-[#705E5B] mb-2 leading-relaxed">
                    Firebase Console에서 읽기/쓰기 규칙을 게시해야 모바일과 실시간으로 연동됩니다.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowRuleGuide((prev) => !prev)}
                    className="text-[11px] font-bold text-[#B56562] underline cursor-pointer"
                  >
                    {showRuleGuide ? '규칙 설정 방법 접기 ▲' : '규칙 복사 및 설정 가이드 보기 ▼'}
                  </button>
                </div>
              )}

              {showRuleGuide && (
                <div className="pt-2 border-t border-[#EFE8E3] space-y-2">
                  <ol className="text-[11px] text-[#554745] space-y-1 pl-4 list-decimal">
                    <li>
                      <a
                        href="https://console.firebase.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#B56562] font-bold underline"
                      >
                        Firebase 콘솔
                      </a>
                      에 접속 &gt; <code>cloody-acc46</code> 프로젝트 선택
                    </li>
                    <li>
                      왼쪽 메뉴 <strong>Firestore Database</strong> &gt; <strong>규칙(Rules)</strong> 탭
                    </li>
                    <li>아래 코드로 교체 후 <strong>[게시 (Publish)]</strong> 클릭</li>
                  </ol>
                  <div className="relative">
                    <pre className="p-2.5 rounded-xl bg-[#2D2828] text-[#E0D8D5] text-[10px] font-mono overflow-x-auto">
                      {firestoreRuleText}
                    </pre>
                    <button
                      type="button"
                      onClick={handleCopyRule}
                      className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-[#FAF8F5] hover:bg-white text-[#4A3E3D] font-bold text-[10px] transition-all cursor-pointer shadow-xs"
                    >
                      {copiedRule ? '복사완료! ✓' : '규칙 복사'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[11px] text-[#705E5B] leading-relaxed">
                현재 <strong>게스트 모드</strong>(이 브라우저 로컬 저장소)로 작동 중입니다. Google 계정으로 로그인하면 모바일과 PC 간에 언제든지 실시간으로 물건과 방이 연동됩니다.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onOpenAuth) onOpenAuth();
                }}
                className="w-full py-2.5 rounded-xl bg-[#B56562] hover:bg-[#9E4E4B] text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
              >
                <span>Google 계정으로 로그인하고 실시간 연동하기</span>
              </button>
            </div>
          )}

          {/* 구름 아이콘 색상 설명 뱃지 */}
          <div
            className={`mt-3 p-2.5 rounded-xl border text-[11px] leading-relaxed flex items-center gap-2 ${
              isCloudConnected
                ? 'bg-[#EAF5EC] border-[#C8E6C9] text-[#2E7D32]'
                : 'bg-[#FFF0EE] border-[#FFCCD2] text-[#C93B3E]'
            }`}
          >
            <span className="text-sm">{isCloudConnected ? '🟢' : '🔴'}</span>
            <span>
              상단 구름 아이콘:{' '}
              <strong>{isCloudConnected ? '연두빛 (실시간 연동 활성)' : '빨간빛 (미연동/로컬 보관)'}</strong>
            </span>
          </div>
        </div>

        {/* 2. 데이터 백업 및 복원 (JSON) */}
        <div className="mb-4 p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFE8E3]">
          <h4 className="text-xs font-extrabold text-[#8F5E4D] uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span>💾</span> 내 데이터 백업 및 가져오기
          </h4>
          <p className="text-[11px] text-[#9A8784] mb-3 leading-relaxed">
            현재 등록된 물건({itemsHook.items.length}개)과 방 배치({room.rooms.length}개 방)를 파일로 안전하게 보관하거나 다른 기기로 옮길 수 있습니다.
          </p>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <button
              type="button"
              onClick={handleDownloadBackup}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#705E5B] border border-[#E0D8D4] text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>📁</span>
              <span>파일로 저장</span>
            </button>
            <button
              type="button"
              onClick={handleExportClipboard}
              className="py-2.5 px-3 rounded-xl bg-white hover:bg-[#FAF8F5] text-[#705E5B] border border-[#E0D8D4] text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <span>📋</span>
              <span>클립보드 복사</span>
            </button>
          </div>

          <div className="pt-2 border-t border-[#EFE8E3] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#705E5B]">백업 데이터 불러오기</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-[11px] font-bold text-[#B56562] hover:underline cursor-pointer"
              >
                📂 JSON 파일 선택
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="또는 백업 JSON 텍스트를 여기에 붙여넣으세요..."
              rows={2}
              className="w-full p-2.5 rounded-xl bg-white border border-[#E0D8D4] text-xs font-mono text-[#4A3E3D] focus:outline-none focus:border-[#B56562]"
            />
            {importText.trim() && (
              <button
                type="button"
                onClick={handleImportText}
                className="w-full py-2 rounded-xl bg-[#B56562] text-white text-xs font-bold hover:bg-[#9E4E4B] transition-all cursor-pointer shadow-xs"
              >
                붙여넣은 데이터로 복원하기
              </button>
            )}
          </div>
        </div>

        {/* 3. 이전 작업 데이터 복원 (필요 시 복구 옵션) */}
        <div className="mb-4 p-3.5 rounded-2xl bg-[#FFF8F0] border border-[#FFE8D6]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-base">✨</span>
              <div>
                <h4 className="text-xs font-bold text-[#8A5D4D]">
                  이전 작업 데이터 복원 도구
                </h4>
                <p className="text-[10px] text-[#A67D6E]">
                  이전에 작업하던 전체 65개 물건 및 2개 방 배치를 불러옵니다.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowRestoreDetails((prev) => !prev)}
              className="text-[11px] font-bold text-[#B56562] cursor-pointer"
            >
              {showRestoreDetails ? '닫기 ▲' : '열기 ▼'}
            </button>
          </div>

          {showRestoreDetails && (
            <div className="mt-3 pt-3 border-t border-[#FFE2CC] space-y-2">
              <p className="text-[11px] text-[#705E5B] leading-relaxed">
                이전에 작업하셨던 <strong>물건 65개</strong>와 <strong>방 2개('내 방' 12개 가구, '거실')</strong>를 한 번의 클릭으로 현재 브라우저에 불러올 수 있습니다.
              </p>
              <button
                type="button"
                onClick={handleRestorePreloaded}
                className="w-full py-2.5 rounded-xl bg-[#B56562] hover:bg-[#9E4E4B] text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
              >
                <span>✨</span>
                <span>이전 데이터(65개 물건 + 2개 방) 지금 불러오기</span>
              </button>
            </div>
          )}
        </div>

        {/* 4. 초기화 및 브라우저 상태 */}
        <div className="flex items-center justify-between pt-2 text-[11px] text-[#9A8784]">
          <span>현재 등록: 물건 {itemsHook.items.length}개 / 방 {room.rooms.length}개</span>
          <button
            type="button"
            onClick={handleResetAll}
            className="text-[11px] text-[#9A8784] hover:text-[#E5484D] transition-colors cursor-pointer"
          >
            데이터 초기화(새로 시작)
          </button>
        </div>
      </div>
    </div>
  );
}
