import ChatAgent from '../components/ChatAgent';

export default function ChatPage({ itemsHook, declutterItems, onClearDeclutterItems }) {
  const { items } = itemsHook;

  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="text-lg font-extrabold text-[#4A3E3D]">AI 정리 컨설턴트</h2>
        <p className="text-sm text-[#806F6D] mt-1">
          AI와 대화하며 정리해요 🧹
        </p>
      </div>
      <ChatAgent
        itemsHook={itemsHook}
        declutterItems={declutterItems}
        onClearDeclutterItems={onClearDeclutterItems}
      />
    </div>
  );
}
