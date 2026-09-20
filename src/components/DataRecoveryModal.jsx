import { useState, useEffect } from 'react';
import { PRELOADED_RECOVERY_DATA } from '../data/recoveryBackup';
import { saveCloudData } from '../services/cloudSync';

export default function DataRecoveryModal({ isOpen, onClose, itemsHook, room, user }) {
  const [storages, setStorages] = useState([]);
  const [importText, setImportText] = useState('');
  const [message, setMessage] = useState('');
  const [copiedRule, setCopiedRule] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setMessage('');
    const found = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (
          key &&
          (key.includes('cloomy') ||
            key.includes('jeongnijjang') ||
            key.includes('items') ||
            key.includes('room'))
        ) {
          const val = localStorage.getItem(key);
          try {
            const parsed = JSON.parse(val);
            const count = Array.isArray(parsed)
              ? parsed.length
              : parsed && typeof parsed === 'object'
              ? Object.keys(parsed).length
              : 1;
            found.push({ key, count, data: parsed });
          } catch {
            found.push({ key, count: 'text', data: val });
          }
        }
      }
    } catch {}
    setStorages(found);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRestorePreloaded = async () => {
    try {
      itemsHook.setItems(PRELOADED_RECOVERY_DATA.items);
      room.setRooms(PRELOADED_RECOVERY_DATA.rooms);
      room.setActiveRoomId(PRELOADED_RECOVERY_DATA.activeRoomId);

      const userKey = user && !user.isGuest ? `cloomy_items_${user.uid}` : 'cloomy_items';
      const userRoomKey = user && !user.isGuest ? `cloomy_rooms_${user.uid}` : 'cloomy_rooms';
      const activeKey = user && !user.isGuest ? `cloomy_active_room_id_${user.uid}` : 'cloomy_active_room_id';

      localStorage.setItem(userKey, JSON.stringify(PRELOADED_RECOVERY_DATA.items));
      localStorage.setItem('cloomy_items', JSON.stringify(PRELOADED_RECOVERY_DATA.items));
      localStorage.setItem(userRoomKey, JSON.stringify(PRELOADED_RECOVERY_DATA.rooms));
      localStorage.setItem('cloomy_rooms', JSON.stringify(PRELOADED_RECOVERY_DATA.rooms));
      localStorage.setItem(activeKey, PRELOADED_RECOVERY_DATA.activeRoomId);
      localStorage.setItem('cloomy_active_room_id', PRELOADED_RECOVERY_DATA.activeRoomId);
      localStorage.setItem('cloomy_auto_recovered_v1', 'true');

      if (user && !user.isGuest) {
        saveCloudData(user.uid, PRELOADED_RECOVERY_DATA).catch(() => {});
      }

      setMessage(`전체 물건 ${PRELOADED_RECOVERY_DATA.items.length}개와 방 2개('내 방', '안방')가 완벽히 복원되었습니다! 🎉`);
    } catch (e) {
      setMessage('복원 중 오류가 발생했습니다.');
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

  const handleRestoreFromKey = (entry) => {
    if (Array.isArray(entry.data) && entry.data.length > 0) {
      const first = entry.data[0];
      if (first && (first.name || first.category || first.location)) {
        itemsHook.setItems(entry.data);
        const userKey = user && !user.isGuest ? `cloomy_items_${user.uid}` : 'cloomy_items';
        try {
          localStorage.setItem(userKey, JSON.stringify(entry.data));
          localStorage.setItem('cloomy_items', JSON.stringify(entry.data));
        } catch {}
        setMessage(`물건 ${entry.data.length}개를 성공적으로 복원했어요!`);
      } else if (first && first.furniture) {
        room.setRooms(entry.data);
        const userRoomKey = user && !user.isGuest ? `cloomy_rooms_${user.uid}` : 'cloomy_rooms';
        try {
          localStorage.setItem(userRoomKey, JSON.stringify(entry.data));
          localStorage.setItem('cloomy_rooms', JSON.stringify(entry.data));
        } catch {}
        setMessage(`방 ${entry.data.length}개를 성공적으로 복원했어요!`);
      }
    }
  };

  const handleExport = () => {
    const backup = {
      items: itemsHook.items,
      rooms: room.rooms,
      activeRoomId: room.activeRoomId,
      exportedAt: new Date().toISOString(),
    };
    navigator.clipboard.writeText(JSON.stringify(backup));
    setMessage('클립보드에 데이터가 복사되었어요! 다른 창이나 기기에 붙여넣을 수 있습니다.');
  };

  const handleImport = () => {
    try {
      const parsed = JSON.parse(importText.trim());
      let count = 0;
      if (parsed.items && Array.isArray(parsed.items)) {
        itemsHook.setItems(parsed.items);
        const userKey = user && !user.isGuest ? `cloomy_items_${user.uid}` : 'cloomy_items';
        try {
          localStorage.setItem(userKey, JSON.stringify(parsed.items));
          localStorage.setItem('cloomy_items', JSON.stringify(parsed.items));
        } catch {}
        count = parsed.items.length;
      }
      if (parsed.rooms && Array.isArray(parsed.rooms)) {
        room.setRooms(parsed.rooms);
        const userRoomKey = user && !user.isGuest ? `cloomy_rooms_${user.uid}` : 'cloomy_rooms';
        try {
          localStorage.setItem(userRoomKey, JSON.stringify(parsed.rooms));
          localStorage.setItem('cloomy_rooms', JSON.stringify(parsed.rooms));
        } catch {}
      }
      setMessage(`성공적으로 복원되었습니다! (물건 ${count}개)`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch {
      setMessage('올바른 백업 JSON 형식이 아닙니다.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-6 w-full max-w-lg shadow-2xl animate-[fadeIn_0.15s_ease-out] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-black text-[#4A3E3D]">데이터 복구 및 백업</h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF8F5] hover:bg-[#F0ECE9] text-[#705E5B] flex items-center justify-center font-bold text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {message && (
          <div className="p-3 mb-4 rounded-2xl bg-[#EAF5EC] border border-[#D4ECD8] text-[#3D7C4F] text-xs font-bold">
            {message}
          </div>
        )}

        {/* 🌟 원클릭 전체 복구 섹션 (가장 중요) */}
        <div className="mb-5 p-4 rounded-2xl bg-gradient-to-br from-[#FFF5F3] to-[#FFF0EB] border-2 border-[#FFD5CF] shadow-xs">
          <div className="flex items-start gap-2.5 mb-2">
            <span className="text-xl">🌟</span>
            <div>
              <h4 className="text-sm font-extrabold text-[#B56562]">
                발견된 42개 물건 & 방 전체 복원
              </h4>
              <p className="text-xs text-[#705E5B] mt-0.5 leading-relaxed">
                로컬 작업 중 등록하셨던 <strong>42개 물건</strong>(신발장, 서브 책장, 책상 서랍 등)과 <strong>방 2개('내 방', '안방')</strong> 데이터를 안전하게 확보했습니다.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleRestorePreloaded}
            className="w-full mt-2 py-3 rounded-xl bg-[#B56562] hover:bg-[#9E4E4B] text-white font-black text-sm transition-all cursor-pointer shadow-md active:scale-98 flex items-center justify-center gap-2"
          >
            <span>✨</span>
            <span>전체 데이터({PRELOADED_RECOVERY_DATA.items.length}개 물건 + 방 2개) 지금 복원하기</span>
          </button>
        </div>

        {/* 📱 모바일 연동을 위한 Firebase 설정 안내 */}
        <div className="mb-5 p-4 rounded-2xl bg-[#FAF8F5] border border-[#EFE8E3]">
          <h4 className="text-xs font-bold text-[#8F5E4D] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span>📱</span> 모바일과 실시간 연동 방법
          </h4>
          <p className="text-[11px] text-[#705E5B] mb-2.5 leading-relaxed">
            Firebase 클라우드 규칙을 1줄 열어주시면, PC와 모바일 간 데이터가 실시간으로 자동 동기화됩니다.
          </p>
          <ol className="text-[11px] text-[#554745] space-y-1 mb-2.5 pl-4 list-decimal">
            <li><a href="https://console.firebase.google.com" target="_blank" rel="noreferrer" className="text-[#B56562] font-bold underline">Firebase 콘솔</a> 접속 &gt; <code>cloody-acc46</code> 프로젝트 선택</li>
            <li>왼쪽 메뉴 <strong>Firestore Database</strong> &gt; 상단 <strong>규칙(Rules)</strong> 탭 클릭</li>
            <li>아래 규칙 코드로 교체 후 <strong>[게시 (Publish)]</strong> 클릭</li>
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

        {/* 1. 현재 브라우저 내 저장소 탐색 결과 */}
        <div className="mb-5">
          <h4 className="text-xs font-bold text-[#8F5E4D] uppercase tracking-wider mb-2">
            브라우저 로컬 저장소 목록
          </h4>

          <div className="space-y-2">
            {storages.map((entry) => (
              <div
                key={entry.key}
                className="flex items-center justify-between p-3 rounded-2xl bg-[#FAF8F5] border border-[#EFE8E3]"
              >
                <div>
                  <span className="text-xs font-bold text-[#4A3E3D] block font-mono">
                    {entry.key}
                  </span>
                  <span className="text-[11px] text-[#9A8784]">
                    항목 수: <strong>{entry.count}</strong>개
                  </span>
                </div>
                {Array.isArray(entry.data) && entry.data.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleRestoreFromKey(entry)}
                    className="px-3 py-1.5 rounded-xl bg-[#B56562] text-white text-xs font-bold hover:bg-[#9E4E4B] transition-all cursor-pointer shadow-xs"
                  >
                    이 데이터로 복원
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 2. 다른 주소(bypp-weld 또는 localhost)에서 가져오기 */}
        <div className="pt-4 border-t border-[#EFE8E3]">
          <h4 className="text-xs font-bold text-[#8F5E4D] uppercase tracking-wider mb-2">
            2. 다른 주소(로컬/이전 배포판)에서 데이터 가져오기
          </h4>
          <p className="text-xs text-[#9A8784] mb-3">
            물건을 <code>localhost:5173</code> 또는 <code>bypp-weld.vercel.app</code>에서 등록하셨다면,
            해당 주소에서 복사한 데이터를 여기에 붙여넣어 즉시 복원할 수 있습니다.
          </p>

          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="여기에 백업 데이터를 붙여넣으세요 (JSON)..."
            rows={3}
            className="w-full p-3 rounded-2xl bg-[#FAF8F5] border border-[#E8E0DC] text-xs font-mono text-[#4A3E3D] focus:outline-none focus:border-[#B56562] mb-3"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="flex-1 py-2.5 rounded-2xl bg-[#FAF8F5] hover:bg-[#F0ECE9] text-[#705E5B] text-xs font-bold transition-all cursor-pointer border border-[#EFE8E3]"
            >
              현재 데이터 복사(내보내기)
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={!importText.trim()}
              className="flex-1 py-2.5 rounded-2xl bg-[#B56562] hover:bg-[#9E4E4B] text-white text-xs font-bold transition-all disabled:opacity-40 cursor-pointer shadow-xs"
            >
              붙여넣은 데이터로 복원하기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
