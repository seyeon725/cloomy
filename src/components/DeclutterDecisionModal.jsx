import Icon from './Icon';

const DECISIONS = [
  {
    id: 'discarded',
    icon: 'trash',
    title: '비우기',
    description: '필요 없는 물건으로 표시해둘게요',
    color: 'bg-[#FFE9E7] text-[#B55B59]',
  },
  {
    id: 'active',
    icon: 'archive',
    title: '보관하기',
    description: '지금의 위치에 소중히 보관해요',
    color: 'bg-[#FFF0E5] text-[#A96845]',
  },
  {
    id: 'trading',
    icon: 'heartHand',
    title: '중고거래 · 나눔',
    description: '새 주인을 찾아줄 물건이에요',
    color: 'bg-[#FFF5D9] text-[#9A6D25]',
  },
];

export default function DeclutterDecisionModal({ item, onSelect, onClose }) {
  const choose = (status) => {
    onSelect(status);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-[#4A3E3D]/35 backdrop-blur-sm p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decision-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md fluffy-card rounded-t-[32px] sm:rounded-[32px] p-6 sm:p-7 animate-[fade-in-up_220ms_ease-out]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-[#FFDAC1] sm:hidden" />
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-[#FFF0E5] text-4xl shadow-[0_8px_20px_rgba(255,183,178,0.22)]">
            <Icon name="sparkle" size={29} strokeWidth={1.55} />
          </div>
          <h2 id="decision-title" className="text-xl font-extrabold text-[#4A3E3D]">
            {item.name}, 어떻게 정리할까요?
          </h2>
          <p className="mt-1.5 text-sm text-[#806F6D]">지금 마음에 드는 방법을 골라주세요</p>
        </div>

        <div className="mt-6 space-y-3">
          {DECISIONS.map((decision) => (
            <button
              key={decision.id}
              type="button"
              onClick={() => choose(decision.id)}
              className={`fluffy-button flex w-full items-center gap-4 p-4 text-left ${decision.color}`}
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/75 text-2xl shadow-[0_5px_14px_rgba(74,62,61,0.08)]">
                <Icon name={decision.icon} size={23} strokeWidth={1.65} />
              </span>
              <span>
                <span className="block text-base font-extrabold">{decision.title}</span>
                <span className="mt-0.5 block text-xs font-medium opacity-80">{decision.description}</span>
              </span>
              <span className="ml-auto text-lg opacity-50">›</span>
            </button>
          ))}
        </div>

        <button type="button" onClick={onClose} className="fluffy-button mt-5 w-full py-3 text-sm font-bold text-[#806F6D] hover:bg-[#FAF8F5]">
          나중에 결정할게요
        </button>
      </div>
    </div>
  );
}
