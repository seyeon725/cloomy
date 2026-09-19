import Icon from './Icon';

/**
 * 물건 등록 작업 중 화면을 벗어나거나 홈으로 이동하려 할 때 띄우는 확인 모달
 */
export default function UnsavedConfirmModal({ isOpen, onConfirm, onCancel, targetName = '홈 화면' }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-[32px] p-6 sm:p-7 max-w-md w-full shadow-[0_20px_50px_rgba(74,62,61,0.2)] border border-[#F4EEEA] space-y-5 animate-scaleUp">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0EE] text-[#B56562] flex items-center justify-center shrink-0 shadow-xs">
            <Icon name="sparkle" size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-[#4A3E3D]">작업 중인 내용이 있어요!</h3>
            <p className="text-xs text-[#9A8784] font-medium mt-0.5">저장되지 않은 물건 정보 안내</p>
          </div>
        </div>

        <p className="text-sm text-[#705E5B] leading-relaxed bg-[#FAF8F5] p-4 rounded-2xl border border-[#F2ECE6]">
          현재 스캔된 물건 정보를 등록하는 중이에요.<br />
          <strong className="text-[#B56562]">{targetName}</strong>(으)로 이동하면 지금까지 인식한 물건 정보가 저장되지 않고 초기화됩니다. 정말 이동하시겠습니까?
        </p>

        <div className="flex gap-3 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="fluffy-button flex-1 py-3.5 px-4 bg-[#FAF8F5] hover:bg-[#F2ECE6] text-[#806F6D] font-bold text-sm"
          >
            계속 등록하기
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="fluffy-button flex-1 py-3.5 px-4 bg-[#FFB7B2] hover:bg-[#FF9E99] text-[#4A3E3D] font-black text-sm shadow-[0_8px_20px_rgba(255,183,178,0.4)]"
          >
            이동하기
          </button>
        </div>
      </div>
    </div>
  );
}
