import { useState, useRef, useEffect, useCallback } from 'react';
import { chatWithAgent } from '../services/gemini';
import { USAGE_CONFIG } from '../hooks/useItems';

export default function ChatAgent({ itemsHook, items: itemsProp, declutterItems, onClearDeclutterItems }) {
  const items = itemsHook?.items || itemsProp || [];
  const updateItem = itemsHook?.updateItem;

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // AI가 지시한 실시간 물건 변경사항 실행
  const applyActions = useCallback(
    (actions) => {
      const applied = [];
      if (!Array.isArray(actions) || !updateItem) return applied;

      for (const act of actions) {
        if (!act.targetName) continue;
        const target = act.targetName.trim().toLowerCase();

        // 이름 매칭 (정확 일치 -> 부분 일치 순)
        let matched = items.find((i) => i.name.trim().toLowerCase() === target);
        if (!matched) {
          matched = items.find((i) => {
            const n = i.name.trim().toLowerCase();
            return n.includes(target) || target.includes(n);
          });
        }

        if (matched) {
          if (act.type === 'rename' && act.newName && matched.name !== act.newName) {
            updateItem(matched.id, { name: act.newName });
            applied.push({
              emoji: '✏️',
              desc: `'${matched.name}' ➔ '${act.newName}'`,
            });
          } else if (act.type === 'updateUsage' && act.usage) {
            const cfg = USAGE_CONFIG[act.usage];
            updateItem(matched.id, { usage: act.usage });
            applied.push({
              emoji: cfg?.emoji || '⏱️',
              desc: `'${matched.name}' 사용도: ${cfg?.shortLabel || act.usage}`,
            });
          } else if (act.type === 'move' && act.location) {
            updateItem(matched.id, { location: act.location });
            applied.push({
              emoji: '📍',
              desc: `'${matched.name}' ➔ '${act.location}'`,
            });
          } else if (act.type === 'discard') {
            updateItem(matched.id, { status: 'discarded' });
            applied.push({
              emoji: '🗑️',
              desc: `'${matched.name}' 폐기 처리`,
            });
          }
        }
      }
      return applied;
    },
    [items, updateItem]
  );

  const startChat = useCallback(async () => {
    setIsStarted(true);
    setIsLoading(true);
    try {
      const result = await chatWithAgent(
        items,
        [],
        '정리 시작! 1문장으로 가볍게 인사하고 어떤 물건부터 정리할지 물어봐줘.'
      );
      const applied = applyActions(result.actions);
      setMessages([
        { role: 'user', text: '정리 도와줘! 🙋' },
        {
          role: 'assistant',
          text: result.reply,
          quickReplies: result.quickReplies,
          appliedChanges: applied,
        },
      ]);
    } catch (err) {
      console.error('startChat error:', err);
      setMessages([
        { role: 'user', text: '정리 도와줘! 🙋' },
        {
          role: 'assistant',
          text: '안녕하세요! 물건 정리를 도와드릴게요. 어떤 물건부터 정리해볼까요? 😊',
          quickReplies: ['자주 쓰는 물건 정리 ⭐', '안 쓰는 물건 비우기 🗑️', '미분류 물건 배치 📍'],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [items, applyActions]);

  const startDeclutterChat = useCallback(
    async (selectedList) => {
      setIsStarted(true);
      setIsLoading(true);
      const names = selectedList.map((i) => `'${i.name}'`).join(', ');
      const userMsgText = `선택한 물건 ${selectedList.length}개(${names})를 정리할래! 🧹`;

      const initialUserMsg = { role: 'user', text: userMsgText };
      setMessages([initialUserMsg]);

      try {
        const result = await chatWithAgent(
          items,
          [initialUserMsg],
          `사용자가 정리할 물건으로 ${names} 총 ${selectedList.length}개를 선택했어. 1~2문장으로 아주 짧고 친절하게 인사하고, 이 물건들을 어떻게 정리할지 물어봐줘.`
        );
        const applied = applyActions(result.actions);
        setMessages([
          initialUserMsg,
          {
            role: 'assistant',
            text: result.reply,
            quickReplies:
              result.quickReplies && result.quickReplies.length > 0
                ? result.quickReplies
                : ['자주 쓰는 것 남기기 ⭐', '3개월 미사용 보관 ⏳', '안 쓰는 것 비우기 🗑️'],
            appliedChanges: applied,
          },
        ]);
      } catch (err) {
        console.error('startDeclutterChat error:', err);
        setMessages([
          initialUserMsg,
          {
            role: 'assistant',
            text: `선택하신 ${selectedList.length}개 물건 정리를 도와드릴게요! 어떤 물건부터 확인해볼까요? 😊`,
            quickReplies: ['자주 쓰는 것 남기기 ⭐', '3개월 미사용 보관 ⏳', '안 쓰는 것 비우기 🗑️'],
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [items, applyActions]
  );

  useEffect(() => {
    if (declutterItems && declutterItems.length > 0) {
      startDeclutterChat(declutterItems);
      if (onClearDeclutterItems) {
        onClearDeclutterItems();
      }
    }
  }, [declutterItems, onClearDeclutterItems, startDeclutterChat]);

  const handleSendText = useCallback(
    async (textToSend) => {
      if (!textToSend.trim() || isLoading) return;
      const userMsg = textToSend.trim();
      setInput('');

      const newMessages = [...messages, { role: 'user', text: userMsg }];
      setMessages(newMessages);
      setIsLoading(true);

      try {
        const result = await chatWithAgent(items, newMessages, userMsg);
        const applied = applyActions(result.actions);

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: result.reply,
            quickReplies: result.quickReplies,
            appliedChanges: applied,
          },
        ]);
      } catch (err) {
        console.error('sendMessage error:', err);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: '말씀해주신 내용 확인했어요! 계속해서 정리해볼까요? 😊',
            quickReplies: ['다음 물건 보기 ➡️', '책상 정리', '서랍 정리'],
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, items, applyActions]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText(input);
    }
  };

  if (!isStarted) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 py-16 sm:py-24 px-6 text-center bg-white rounded-[32px] shadow-[0_12px_36px_rgba(74,62,61,0.06)] border border-[#F4EEEA] w-full">
        <div className="text-7xl sm:text-8xl p-6 bg-[#FFF0EE] rounded-full shadow-[0_10px_30px_rgba(255,183,178,0.22)]">
          🧹
        </div>
        <div className="space-y-2 max-w-md">
          <h3 className="text-2xl sm:text-3xl font-black text-[#4A3E3D]">AI 정리 컨설턴트</h3>
          <p className="text-base text-[#806F6D] leading-relaxed">
            간결한 질문과 편리한 버튼으로 물건 이름과 위치, 사용도를 바로 정리해요!
          </p>
        </div>
        {items.length === 0 ? (
          <p className="text-base font-bold text-[#A66E22] bg-[#FFF5D9] px-5 py-3 rounded-full shadow-[0_8px_20px_rgba(74,62,61,0.06)]">
            ⚠️ 먼저 물건을 스캔해서 등록해주세요!
          </p>
        ) : (
          <button
            type="button"
            onClick={startChat}
            className="fluffy-button px-8 py-4 bg-[#FFB7B2] hover:bg-[#FFA59E] text-[#4A3E3D] font-extrabold text-lg shadow-[0_12px_28px_rgba(255,183,178,0.45)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95"
          >
            <span>🗣️ 초간결 정리 상담 시작</span>
            <span className="text-sm font-semibold bg-white/60 px-2.5 py-0.5 rounded-full">
              {items.length}개 물건
            </span>
          </button>
        )}
      </div>
    );
  }

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeQuickReplies = lastAssistantMsg?.quickReplies || [];

  return (
    <div className="flex flex-col h-[calc(100dvh-13rem)] bg-white rounded-[32px] shadow-[0_12px_36px_rgba(74,62,61,0.08)] border border-[#F2ECE6] overflow-hidden w-full">
      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 sm:p-6 bg-[#FAF8F5]">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex flex-col ${
              msg.role === 'user' ? 'items-end' : 'items-start'
            } space-y-2`}
          >
            <div
              className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 rounded-3xl text-sm sm:text-base leading-relaxed whitespace-pre-wrap shadow-xs ${
                msg.role === 'user'
                  ? 'bg-[#FFB7B2] text-[#4A3E3D] rounded-br-[8px] font-medium'
                  : 'bg-white text-[#4A3E3D] rounded-bl-[8px]'
              }`}
            >
              {msg.text}

              {/* 실시간 변경사항 뱃지 */}
              {msg.appliedChanges && msg.appliedChanges.length > 0 && (
                <div className="mt-3 pt-2.5 border-t border-[#F2ECE8] space-y-1.5">
                  <div className="text-[11px] font-bold text-[#8F655D] flex items-center gap-1">
                    <span>⚡</span> <span>내 물건 목록에 바로 반영됨:</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {msg.appliedChanges.map((ch, cIdx) => (
                      <span
                        key={cIdx}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-[#EAF5EC] text-[#2C6A3E] border border-[#D0EBD6]"
                      >
                        <span>{ch.emoji}</span>
                        <span>{ch.desc}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 개별 메시지의 빠른 선택지 버튼들 (해당 메시지가 마지막일 때) */}
            {msg.role === 'assistant' &&
              i === messages.length - 1 &&
              msg.quickReplies &&
              msg.quickReplies.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1 max-w-[90%]">
                  {msg.quickReplies.map((opt, oIdx) => (
                    <button
                      key={oIdx}
                      type="button"
                      onClick={() => handleSendText(opt)}
                      disabled={isLoading}
                      className="fluffy-button text-xs sm:text-sm font-bold bg-white hover:bg-[#FFEAE5] text-[#6E423E] px-3.5 py-1.5 rounded-full border border-[#FFD5CC] shadow-xs transition-all active:scale-95 disabled:opacity-50"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white px-5 py-3.5 rounded-3xl shadow-[0_6px_18px_rgba(74,62,61,0.06)] rounded-bl-[8px] flex items-center gap-2">
              <span className="text-sm font-semibold text-[#806F6D]">
                정리 비서가 생각하고 있어요
              </span>
              <div className="flex gap-1.5 ml-1">
                <span
                  className="w-2 h-2 bg-[#FFB7B2] rounded-full animate-bounce"
                  style={{ animationDelay: '0ms' }}
                />
                <span
                  className="w-2 h-2 bg-[#FFB7B2] rounded-full animate-bounce"
                  style={{ animationDelay: '150ms' }}
                />
                <span
                  className="w-2 h-2 bg-[#FFB7B2] rounded-full animate-bounce"
                  style={{ animationDelay: '300ms' }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input Area with persistent Quick Reply bar if available */}
      <div className="p-3 sm:p-4 bg-white shadow-[0_-4px_18px_rgba(74,62,61,0.04)] space-y-2">
        {!isLoading && activeQuickReplies.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
            <span className="text-[#A1908D] font-bold shrink-0 text-[11px] pl-1">💡 추천:</span>
            {activeQuickReplies.map((qr, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSendText(qr)}
                className="shrink-0 font-semibold px-2.5 py-1 rounded-full bg-[#FAF5F2] hover:bg-[#FFEBE7] text-[#6E4B46] border border-[#F0E4DE] transition-colors"
              >
                {qr}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="답변을 입력하거나 위 옵션을 눌러주세요 (예: 1년 동안 안 썼어)"
            disabled={isLoading}
            className="fluffy-input flex-1 px-5 py-3 text-sm sm:text-base disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => handleSendText(input)}
            disabled={isLoading || !input.trim()}
            className="fluffy-button px-6 py-3 bg-[#FFB7B2] text-[#4A3E3D] font-bold text-base disabled:opacity-50 shadow-[0_8px_20px_rgba(255,183,178,0.35)] shrink-0"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
