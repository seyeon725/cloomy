import { useState } from 'react';

/**
 * 로그인 / 프로필 모달
 * - 미로그인: Google 로그인 버튼 + 게스트 계속 사용 버튼
 * - 로그인 상태: 프로필 정보 + 로그아웃 버튼
 */
export default function AuthModal({ isOpen, onClose, user, onLoginGoogle, onLogout, onContinueGuest }) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isLoggedIn = user && !user.isGuest;

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await onLoginGoogle();
      onClose();
    } catch (err) {
      setError(err.message || 'Google 로그인에 실패했어요. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await onLogout();
    onClose();
  };

  const handleGuest = () => {
    onContinueGuest();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white rounded-3xl shadow-2xl w-[92vw] max-w-sm mx-auto overflow-hidden animate-[fadeIn_0.2s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[#FFF0EE] to-[#FFDAC1] px-6 pt-7 pb-5 text-center relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-white/60 hover:bg-white/90 text-[#9A8784] hover:text-[#B56562] transition-all text-lg"
          >
            ✕
          </button>

          {isLoggedIn ? (
            <>
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="프로필"
                  className="w-16 h-16 rounded-full mx-auto mb-3 shadow-md border-2 border-white/80"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-16 h-16 rounded-full mx-auto mb-3 bg-[#B56562] flex items-center justify-center text-2xl text-white font-bold shadow-md">
                  {(user.displayName || '?')[0].toUpperCase()}
                </div>
              )}
              <h3 className="text-lg font-extrabold text-[#4A3E3D]">{user.displayName}</h3>
              <p className="text-xs text-[#9A8784] mt-0.5">{user.email}</p>
            </>
          ) : (
            <>
              <div className="w-14 h-14 rounded-full mx-auto mb-3 bg-[#B56562] flex items-center justify-center text-2xl shadow-md">
                🏠
              </div>
              <h3 className="text-lg font-extrabold text-[#4A3E3D]">CLOOMY에 오신 걸 환영해요!</h3>
              <p className="text-xs text-[#806F6D] mt-1">
                로그인하면 물건과 방 배치가 안전하게 저장돼요
              </p>
            </>
          )}
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {isLoggedIn ? (
            <>
              {/* 로그인된 상태 — 사용자 정보 */}
              <div className="bg-[#FAF8F5] rounded-2xl p-4 text-center">
                <p className="text-sm text-[#806F6D]">
                  Google 계정으로 로그인됨
                </p>
                {user.isDemo && (
                  <p className="text-xs text-[#B56562] mt-1 font-semibold">
                    ⚠️ 데모 모드 — Firebase 설정 후 실제 Google 계정으로 연동 가능
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={handleLogout}
                className="w-full py-3 rounded-2xl bg-[#FAF8F5] hover:bg-[#FFE9E7] text-[#B56562] font-bold text-sm transition-all active:scale-[0.98]"
              >
                로그아웃
              </button>
            </>
          ) : (
            <>
              {/* Google 로그인 버튼 */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-3.5 rounded-2xl bg-white border-2 border-[#E8E0DC] hover:border-[#B56562] hover:bg-[#FFF8F6] flex items-center justify-center gap-3 font-bold text-sm text-[#4A3E3D] transition-all active:scale-[0.98] disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <span className="animate-spin text-lg">⏳</span>
                ) : (
                  <svg width="20" height="20" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                    <path fill="#FBBC05" d="M10.53 28.59a14.5 14.5 0 0 1 0-9.18l-7.98-6.19a24.1 24.1 0 0 0 0 21.56l7.98-6.19z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                  </svg>
                )}
                {loading ? '로그인 중...' : 'Google로 시작하기'}
              </button>

              {error && (
                <p className="text-xs text-red-500 text-center font-semibold">{error}</p>
              )}

              {/* 안내 */}
              <div className="bg-[#F0FAF2] rounded-2xl p-3.5 text-center">
                <p className="text-xs text-[#3D7C4F]">
                  🔒 지금까지 정리한 물건과 방 배치가 계정에 자동 연결돼요
                </p>
              </div>

              {/* 구분선 */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[#E8E0DC]" />
                <span className="text-xs text-[#B9A8A5]">또는</span>
                <div className="flex-1 h-px bg-[#E8E0DC]" />
              </div>

              {/* 게스트 계속 */}
              <button
                type="button"
                onClick={handleGuest}
                className="w-full py-3 rounded-2xl bg-[#FAF8F5] hover:bg-[#F5F0EC] text-[#9A8784] font-semibold text-sm transition-all active:scale-[0.98]"
              >
                게스트로 계속 사용하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
