import { useState, useRef, useEffect, useCallback } from 'react';
import { chatWithAgent } from '../services/gemini';

export default function ChatAgent({ items }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const startChat = useCallback(async () => {
    setIsStarted(true);
    setIsLoading(true);
    try {
      const response = await chatWithAgent(
        items,
        [],
        '안녕! 내 물건 목록을 보고 정리를 도와줘. 먼저 전체적으로 어떤 상태인지 분석해주고, 하나씩 물어봐줘.'
      );
      setMessages([
        { role: 'user', text: '정리 도와줘! 🙋' },
        { role: 'assistant', text: response },
      ]);
    } catch (err) {
      setMessages([
        { role: 'user', text: '정리 도와줘! 🙋' },
        { role: 'assistant', text: '앗, 연결에 문제가 생겼어요. 잠시 후 다시 시도해주세요! 😅' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [items]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput('');

    const newMessages = [...messages, { role: 'user', text: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const response = await chatWithAgent(items, newMessages, userMsg);
      setMessages((prev) => [...prev, { role: 'assistant', text: response }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: '앗, 잠시 문제가 생겼어요. 다시 말씀해주세요! 😅' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, messages, items]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!isStarted) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="text-7xl sm:text-8xl p-6 bg-indigo-50 rounded-3xl">🧹</div>
        <div className="space-y-2 max-w-sm">
          <h3 className="text-2xl sm:text-3xl font-black text-gray-900">AI 정리 컨설턴트</h3>
          <p className="text-base text-gray-600 leading-relaxed">
            등록된 물건들을 보고 어떤 걸 버려야 할지, 어디로 옮겨야 할지 친절하게 알려드려요!
          </p>
        </div>
        {items.length === 0 ? (
          <p className="text-base font-bold text-amber-700 bg-amber-50 border border-amber-200 px-5 py-3 rounded-2xl">
            ⚠️ 먼저 물건을 스캔해서 등록해주세요!
          </p>
        ) : (
          <button
            type="button"
            onClick={startChat}
            className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-extrabold text-lg hover:bg-indigo-700 shadow-xl transition-all active:scale-95 flex items-center gap-2"
          >
            <span>🗣️ 정리 상담 시작</span>
            <span className="text-sm font-semibold bg-indigo-500/80 px-2.5 py-0.5 rounded-full">
              {items.length}개 물건
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100dvh-12rem)] bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6 bg-slate-50/50">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-3xl text-sm sm:text-base leading-relaxed whitespace-pre-wrap shadow-xs ${
                msg.role === 'user'
                  ? 'bg-indigo-600 text-white rounded-br-xs font-medium'
                  : 'bg-white text-gray-900 border border-gray-200 rounded-bl-xs'
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white px-5 py-4 rounded-3xl shadow-xs border border-gray-200 rounded-bl-xs flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-500">AI가 정리 방법을 생각하고 있어요</span>
              <div className="flex gap-1.5 ml-1">
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-3 sm:p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="AI에게 답변하거나 질문하세요 (예: 6개월 동안 안 썼어)"
            disabled={isLoading}
            className="flex-1 px-5 py-3.5 rounded-2xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base disabled:opacity-50"
          />
          <button
            type="button"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-6 py-3.5 rounded-2xl bg-indigo-600 text-white font-bold text-base hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-md shrink-0 active:scale-95"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
