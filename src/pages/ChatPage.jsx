import ChatAgent from '../components/ChatAgent';

export default function ChatPage({ itemsHook }) {
  const { items } = itemsHook;

  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-gray-900">AI 정리 컨설턴트</h2>
        <p className="text-sm text-gray-500 mt-1">
          AI와 대화하며 정리해요 🧹
        </p>
      </div>
      <ChatAgent items={items} />
    </div>
  );
}
