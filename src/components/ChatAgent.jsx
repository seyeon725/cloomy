import { useState, useRef, useEffect, useCallback } from 'react';
import { chatWithAgent } from '../services/gemini';
import { USAGE_CONFIG } from '../hooks/useItems';

const CHAT_STORAGE_KEY = 'cloomy_chat_messages';

function checkIsNoPhotoDeclutterIntent(text) {
  if (!text) return false;
  const t = text.replace(/\s+/g, '').toLowerCase();
  const hasPhotoKeyword = t.includes('사진') || t.includes('이미지') || t.includes('아이콘') || t.includes('카메라');
  const hasNegativeKeyword =
    t.includes('없는') ||
    t.includes('없') ||
    t.includes('안된') ||
    t.includes('안등록') ||
    t.includes('등록안') ||
    t.includes('미등록') ||
    t.includes('기본') ||
    t.includes('안찍') ||
    t.includes('안들어');
  const hasDiscardKeyword =
    t.includes('비움') ||
    t.includes('비워') ||
    t.includes('버려') ||
    t.includes('폐기') ||
    t.includes('정리') ||
    t.includes('삭제');

  return hasPhotoKeyword && hasNegativeKeyword && hasDiscardKeyword;
}

export default function ChatAgent({ itemsHook, items: itemsProp, declutterItems, onClearDeclutterItems }) {
  const items = itemsHook?.items || itemsProp || [];
  const updateItem = itemsHook?.updateItem;
  const updateMultipleItems = itemsHook?.updateMultipleItems;

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarted, setIsStarted] = useState(() => {
    try {
      const saved = localStorage.getItem(CHAT_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) && parsed.length > 0;
    } catch {
      return false;
    }
  });
  const bottomRef = useRef(null);
  const lastDeclutteredIdsRef = useRef([]);

  // 사진 유무 완벽 판별 헬퍼
  const hasPhoto = (item) => Boolean(item?.imageUrl && typeof item.imageUrl === 'string' && item.imageUrl.trim().length > 0);

  // 메시지 로컬스토리지 보존 (새로고침 시 대화 및 결과 유지)
  useEffect(() => {
    try {
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
    } catch {}
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // AI가 지시한 실시간 물건 변경사항 실행 (원자적 일괄 업데이트 & 안전가드 탑재)
  const applyActions = useCallback(
    (actions, contextUserMsg = '', chatHistory = []) => {
      const applied = [];
      if (!Array.isArray(actions) || (!updateMultipleItems && !updateItem)) return applied;

      // 최근 메시지에서 '사진 없는/안 등록된 물건' 요청 여부 감지
      const recentUserText = [
        contextUserMsg,
        ...(chatHistory || []).filter((m) => m.role === 'user').map((m) => m.text),
      ]
        .slice(0, 3)
        .join(' ');
      const isUserAskingNoPhotoOnly = checkIsNoPhotoDeclutterIntent(recentUserText);

      const itemUpdates = [];

      for (const act of actions) {
        if (!act.targetName && !act.targetId) continue;
        const targetName = act.targetName ? act.targetName.trim().toLowerCase() : '';

        // targetId 우선, 그 후 이름 매칭 (정확 일치 -> 부분 일치 순)
        let matched = act.targetId ? items.find((i) => i.id === act.targetId) : null;
        if (!matched && targetName) {
          matched = items.find((i) => i.name.trim().toLowerCase() === targetName);
        }
        if (!matched && targetName) {
          matched = items.find((i) => {
            const n = i.name.trim().toLowerCase();
            return n.includes(targetName) || targetName.includes(n);
          });
        }

        if (matched) {
          const itemHasPhoto = hasPhoto(matched);

          // [이중 안전장치]: 사진 없는 물건 비우기 요청 맥락인 경우, 사진이 있는 물건은 비움/폐기/이동에서 100% 보호
          if (isUserAskingNoPhotoOnly && itemHasPhoto) {
            if (
              act.type === 'discard' ||
              (act.type === 'move' && (act.location?.includes('비움') || act.location?.includes('폐기')))
            ) {
              console.warn(`[ChatAgent] 안전 가드: 사진이 등록된 '${matched.name}'은(는) 비움 대상에서 완벽히 보호되었습니다.`);
              continue;
            }
          }

          const now = new Date().toISOString();
          const updates = { id: matched.id, updatedAt: now };
          let appliedDesc = null;

          if (act.type === 'rename' && act.newName && matched.name !== act.newName) {
            updates.name = act.newName;
            appliedDesc = {
              emoji: '✏️',
              desc: `'${matched.name}' ➔ '${act.newName}'`,
            };
          } else if (act.type === 'updateUsage' && act.usage) {
            const cfg = USAGE_CONFIG[act.usage];
            updates.usage = act.usage;
            appliedDesc = {
              emoji: cfg?.emoji || '⏱️',
              desc: `'${matched.name}' 사용도: ${cfg?.shortLabel || act.usage}`,
            };
          } else if (act.type === 'move' && act.location) {
            updates.location = act.location;
            appliedDesc = {
              emoji: '📍',
              desc: `'${matched.name}' ➔ '${act.location}'`,
            };
          } else if (act.type === 'discard') {
            updates.status = 'discarded';
            appliedDesc = {
              emoji: '🗑️',
              desc: `'${matched.name}' 비우기(폐기) 처리`,
            };
          }

          if (appliedDesc) {
            itemUpdates.push(updates);
            applied.push(appliedDesc);
          }
        }
      }

      if (itemUpdates.length > 0) {
        if (updateMultipleItems) {
          updateMultipleItems(itemUpdates);
        } else if (updateItem) {
          itemUpdates.forEach((u) => {
            const { id, ...rest } = u;
            updateItem(id, rest);
          });
        }
      }

      return applied;
    },
    [items, updateMultipleItems, updateItem]
  );

  const handleResetChat = useCallback(() => {
    localStorage.removeItem(CHAT_STORAGE_KEY);
    setMessages([]);
    setIsStarted(false);
  }, []);

  const startChat = useCallback(async () => {
    setIsStarted(true);
    setIsLoading(true);
    const startPrompt = '정리 시작! 1문장으로 가볍게 인사하고 어떤 물건부터 정리할지 물어봐줘.';
    try {
      const result = await chatWithAgent(
        items,
        [],
        startPrompt
      );
      const applied = applyActions(result.actions, startPrompt);
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
        const applied = applyActions(result.actions, userMsgText);
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

      // 1. 실행 취소 요청 감지
      const isUndoRequest =
        userMsg.includes('실행 취소') ||
        userMsg.includes('되돌리기') ||
        userMsg.includes('취소해') ||
        userMsg === '취소';

      if (isUndoRequest && lastDeclutteredIdsRef.current.length > 0) {
        const idsToRestore = lastDeclutteredIdsRef.current;
        const now = new Date().toISOString();
        const restoreUpdates = idsToRestore.map((id) => ({ id, status: 'active', updatedAt: now }));
        if (updateMultipleItems) {
          updateMultipleItems(restoreUpdates);
        } else if (updateItem) {
          restoreUpdates.forEach((u) => updateItem(u.id, { status: 'active' }));
        }
        lastDeclutteredIdsRef.current = [];

        const applied = idsToRestore.map((id) => {
          const it = items.find((i) => i.id === id);
          return { emoji: '↩️', desc: `'${it?.name || '물건'}' 보관 복원` };
        });

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: `방금 비움 처리되었던 물건 ${idsToRestore.length}개를 다시 정상 보관 상태로 복원했어요! ✨`,
            quickReplies: ['내 물건 보기 📋', '자주 쓰는 물건 정리 ⭐', '정리 완료 ✨'],
            appliedChanges: applied,
          },
        ]);
        setIsLoading(false);
        return;
      }

      // 2. '사진 없는 물건 비우기' 요청 즉시 100% 무결점 처리
      if (checkIsNoPhotoDeclutterIntent(userMsg)) {
        const noPhotoItems = items.filter((i) => !hasPhoto(i) && i.status !== 'discarded');
        const photoItems = items.filter((i) => hasPhoto(i));

        if (noPhotoItems.length > 0) {
          const now = new Date().toISOString();
          const updates = noPhotoItems.map((i) => ({ id: i.id, status: 'discarded', updatedAt: now }));
          lastDeclutteredIdsRef.current = noPhotoItems.map((i) => i.id);

          if (updateMultipleItems) {
            updateMultipleItems(updates);
          } else if (updateItem) {
            updates.forEach((u) => updateItem(u.id, { status: 'discarded' }));
          }

          const applied = noPhotoItems.map((i) => ({
            emoji: '🗑️',
            desc: `'${i.name}' 비우기(폐기) 처리`,
          }));

          const previewNames = noPhotoItems.slice(0, 4).map((i) => `'${i.name}'`).join(', ');
          const moreCount = noPhotoItems.length > 4 ? ` 외 ${noPhotoItems.length - 4}개` : '';

          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: `사진이 등록되지 않은 물건 총 ${noPhotoItems.length}개(${previewNames}${moreCount})를 비움 처리했어요! 🗑️\n\n📸 사진이 등록된 물건 ${photoItems.length}개는 단 하나도 건드리지 않고 안전하게 보관 상태로 유지했습니다! ✨`,
              quickReplies: ['내 물건 보기 📋', '방금 비움 실행 취소 ↩️', '정리 완료 ✨'],
              appliedChanges: applied,
            },
          ]);
          setIsLoading(false);
          return;
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              text: `현재 사진이 등록되지 않은 물건이 없거나 이미 모두 비움 처리되었습니다. 사진이 등록된 ${photoItems.length}개 물건은 안전하게 보관 중이에요! 😊`,
              quickReplies: ['자주 쓰는 물건 정리 ⭐', '미분류 물건 배치 📍', '정리 완료 ✨'],
              appliedChanges: [],
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      // 3. 일반 정리 대화는 Gemini 모델 호출
      try {
        const result = await chatWithAgent(items, newMessages, userMsg);
        const applied = applyActions(result.actions, userMsg, newMessages);

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
    [isLoading, messages, items, applyActions, hasPhoto, updateMultipleItems, updateItem]
  );

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendText(input);
    }
  };

  const noPhotoItemsCount = items.filter((i) => !hasPhoto(i) && i.status !== 'discarded').length;

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
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={startChat}
              className="fluffy-button px-7 py-3.5 bg-[#FFB7B2] hover:bg-[#FFA59E] text-[#4A3E3D] font-extrabold text-base shadow-[0_12px_28px_rgba(255,183,178,0.45)] flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
            >
              <span>🗣️ 초간결 정리 상담 시작</span>
              <span className="text-xs font-semibold bg-white/60 px-2.5 py-0.5 rounded-full">
                {items.length}개 물건
              </span>
            </button>

            {noPhotoItemsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setIsStarted(true);
                  handleSendText('사진 등록 안 된 것들 비움으로 보내줘');
                }}
                className="fluffy-button px-6 py-3.5 bg-[#FFE9E7] hover:bg-[#FFD3CF] text-[#B55B59] font-extrabold text-sm border border-[#FFD3CF] shadow-xs flex items-center gap-2 transition-all hover:scale-105 active:scale-95 cursor-pointer"
              >
                <span>📸 사진 없는 물건 일괄 비우기</span>
                <span className="text-xs font-black bg-white/80 px-2 py-0.5 rounded-full text-[#B55B59]">
                  {noPhotoItemsCount}개
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');
  const activeQuickReplies = lastAssistantMsg?.quickReplies || [];

  return (
    <div className="flex flex-col h-[calc(100dvh-13rem)] bg-white rounded-[32px] shadow-[0_12px_36px_rgba(74,62,61,0.08)] border border-[#F2ECE6] overflow-hidden w-full">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-[#F2ECE6] text-xs gap-2">
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          <span className="font-bold text-[#806F6D] shrink-0 flex items-center gap-1.5">
            <span>🧹</span> <span>AI 실시간 정리</span>
          </span>
          {noPhotoItemsCount > 0 && (
            <button
              type="button"
              onClick={() => handleSendText('사진 등록 안 된 것들 비움으로 보내줘')}
              className="shrink-0 px-2.5 py-1 rounded-full font-bold text-[#B55B59] bg-[#FFE9E7] hover:bg-[#FFD3CF] border border-[#FFD3CF] transition-colors flex items-center gap-1 cursor-pointer"
              title="사진이 등록되지 않은 물건들만 모아서 비웁니다."
            >
              <span>📸 사진 없는 물건 비우기</span>
              <span className="text-[10px] font-black bg-white px-1.5 py-0.2 rounded-full">
                {noPhotoItemsCount}
              </span>
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={handleResetChat}
          className="shrink-0 px-2.5 py-1 rounded-full font-bold text-[#A66E22] bg-[#FFF5D9] hover:bg-[#FFE9BE] transition-colors flex items-center gap-1 cursor-pointer"
          title="대화 내역을 비우고 처음부터 다시 시작합니다."
        >
          <span>🔄</span> <span>대화 새로 시작</span>
        </button>
      </div>

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
