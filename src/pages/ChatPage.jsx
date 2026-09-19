import { useState, useMemo } from 'react';
import ChatAgent from '../components/ChatAgent';
import Icon from '../components/Icon';

export default function ChatPage({
  itemsHook,
  rooms = [],
  activeRoomId = null,
  setActiveRoomId,
  declutterItems,
  onClearDeclutterItems,
}) {
  const { items } = itemsHook;
  const [selectedRoomId, setSelectedRoomId] = useState(() => activeRoomId || 'all');

  const currentRoom = useMemo(() => {
    return rooms.find((r) => r.id === selectedRoomId) || null;
  }, [rooms, selectedRoomId]);

  const targetItems = useMemo(() => {
    if (declutterItems && declutterItems.length > 0) return declutterItems;
    if (!selectedRoomId || selectedRoomId === 'all') return items;
    return items.filter((item) => {
      if (item.roomId) return item.roomId === selectedRoomId;
      return selectedRoomId === (rooms[0]?.id || 'room-1');
    });
  }, [items, selectedRoomId, rooms, declutterItems]);

  return (
    <div className="space-y-4">
      <div className="text-center mb-3">
        <h2 className="text-lg font-extrabold text-[#4A3E3D]">AI 정리 컨설턴트</h2>
        <p className="text-sm text-[#806F6D] mt-1">
          {currentRoom ? `'${currentRoom.name}'의 물건들을 함께 정리해볼까요?` : '대화하며 방 안의 물건들을 정리해요'}
        </p>
      </div>

      {/* 방 선택 칩 바 */}
      {rooms.length > 0 && !declutterItems && (
        <div className="bg-white/90 backdrop-blur-sm p-2 rounded-[20px] border border-[#EDE5DE] shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-[#806F6D] flex items-center gap-1 px-2 shrink-0">
            <Icon name="room" size={14} />
            <span>정리할 방:</span>
          </span>
          <button
            type="button"
            onClick={() => setSelectedRoomId('all')}
            className={`fluffy-button px-3 py-1 rounded-full text-xs font-extrabold transition-all flex items-center gap-1 shrink-0 ${
              selectedRoomId === 'all'
                ? 'bg-[#4A3E3D] text-white shadow-xs'
                : 'bg-[#FAF8F5] text-[#6D5A57] hover:bg-[#FFF5EE]'
            }`}
          >
            <span>전체 공간</span>
            <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${selectedRoomId === 'all' ? 'bg-white/25 text-white' : 'bg-[#EFE7E2] text-[#806F6D]'}`}>
              {items.length}
            </span>
          </button>
          {rooms.map((r) => {
            const count = items.filter((i) => (i.roomId ? i.roomId === r.id : r.id === (rooms[0]?.id || 'room-1'))).length;
            const isSelected = selectedRoomId === r.id;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedRoomId(r.id)}
                className={`fluffy-button px-3 py-1 rounded-full text-xs font-extrabold transition-all flex items-center gap-1 shrink-0 ${
                  isSelected
                    ? 'bg-[#B56562] text-white shadow-xs'
                    : 'bg-[#FAF8F5] text-[#6D5A57] hover:bg-[#FFF5EE]'
                }`}
              >
                <Icon name="door" size={12} />
                <span>{r.name}</span>
                <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-white/25 text-white' : 'bg-[#EFE7E2] text-[#806F6D]'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <ChatAgent
        key={selectedRoomId}
        itemsHook={itemsHook}
        items={targetItems}
        declutterItems={declutterItems}
        onClearDeclutterItems={onClearDeclutterItems}
      />
    </div>
  );
}
