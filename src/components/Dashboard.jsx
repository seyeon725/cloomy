import { useMemo, useState } from 'react';
import ItemCard from './ItemCard';
import MoveItemsModal from './MoveItemsModal';
import Icon from './Icon';
import { USAGE_CONFIG } from '../hooks/useItems';

const categoryEmojis = { 책: '📚', 의류: '👕', 전자기기: '📱', 식기: '🍽️', 문구: '✏️', 화장품: '💄', 장식품: '🎨', 식품: '🍎', 잡화: '📦', 기타: '🔹' };
const statusOptions = [
  { id: 'all', icon: 'sparkle', label: '전체 물건', color: 'text-[#B56562] bg-[#FFF0EE]' },
  { id: 'active', icon: 'archive', label: '보관하기', color: 'text-[#A96845] bg-[#FFF0E5]' },
  { id: 'trading', icon: 'heartHand', label: '거래 · 나눔', color: 'text-[#A66E22] bg-[#FFF5D9]' },
  { id: 'discarded', icon: 'trash', label: '비우기', color: 'text-[#B55B59] bg-[#FFE9E7]' },
];

export default function Dashboard({
  items,
  stats,
  rooms = [],
  activeRoomId,
  setActiveRoomId,
  onUpdate,
  onUpdateMultiple,
  onRemove,
  onRemoveMultiple,
  roomFurniture = [],
  onAddFurniture,
  onStartDeclutter,
  onAddSlot,
}) {
  const [selectedFilterRoom, setSelectedFilterRoom] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [expandedFurn, setExpandedFurn] = useState(null);
  const [selectedUsage, setSelectedUsage] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(() => {
    const saved = localStorage.getItem('cloomy_show_filters');
    if (saved !== null) return saved === 'true';
    return typeof window !== 'undefined' && window.innerWidth >= 1024;
  });
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('cloomy_view_mode') || 'block';
  });
  const [recalibrateNotice, setRecalibrateNotice] = useState(null);
  const [isDeclutterMode, setIsDeclutterMode] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [noticeMessage, setNoticeMessage] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());

  const handleToggleFilters = () => {
    setShowFilters((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('cloomy_show_filters', String(next));
      } catch (e) {}
      return next;
    });
  };

  const handleSetViewMode = (mode) => {
    setViewMode(mode);
    try {
      localStorage.setItem('cloomy_view_mode', mode);
    } catch (e) {}
  };

  const toggleSelectItem = (id) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedItemIds(new Set(filteredItems.map((i) => i.id)));
  };

  const deselectAll = () => {
    setSelectedItemIds(new Set());
  };

  const handleExitDeclutterMode = () => {
    setIsDeclutterMode(false);
    setSelectedItemIds(new Set());
  };

  const handleExitEditMode = () => {
    setIsEditMode(false);
    setSelectedItemIds(new Set());
  };

  const handleTriggerAiDeclutter = () => {
    if (selectedItemIds.size === 0) return;
    const selectedList = items.filter((i) => selectedItemIds.has(i.id));
    handleExitDeclutterMode();
    if (onStartDeclutter) {
      onStartDeclutter(selectedList);
    }
  };

  const handleBatchDelete = () => {
    if (selectedItemIds.size === 0) return;
    const count = selectedItemIds.size;
    if (window.confirm(`선택한 ${count}개의 물건을 정말 삭제하시겠습니까?`)) {
      const idsToDelete = Array.from(selectedItemIds);
      if (onRemoveMultiple) {
        onRemoveMultiple(idsToDelete);
      } else if (onRemove) {
        idsToDelete.forEach((id) => onRemove(id));
      }
      setNoticeMessage(`✨ ${count}개의 물건을 삭제했어요.`);
      setSelectedItemIds(new Set());
      setIsEditMode(false);
    }
  };

  const handleBatchMoveConfirm = ({ targetLocation, newFurniture }) => {
    if (!targetLocation || selectedItemIds.size === 0) return;
    const count = selectedItemIds.size;

    if (newFurniture && onAddFurniture) {
      onAddFurniture(newFurniture);
    }

    const updates = Array.from(selectedItemIds).map((id) => ({
      id,
      location: targetLocation,
    }));

    if (onUpdateMultiple) {
      onUpdateMultiple(updates);
    } else if (onUpdate) {
      updates.forEach((u) => onUpdate(u.id, { location: targetLocation }));
    }

    setShowMoveModal(false);
    setNoticeMessage(`✨ ${count}개 물건을 '${targetLocation}'(으)로 이동했어요.`);
    setSelectedItemIds(new Set());
    setIsEditMode(false);
  };

  const activeFilterCount =
    (selectedFilterRoom !== 'all' ? 1 : 0) +
    (selectedCategory ? 1 : 0) +
    selectedLocations.length +
    (selectedUsage ? 1 : 0);

  const currentRoomFurniture = useMemo(() => {
    if (selectedFilterRoom === 'all') {
      if (rooms && rooms.length > 0) {
        const allFurn = rooms.flatMap((r) => r.furniture || []);
        const unique = [];
        const seenNames = new Set();
        for (const f of allFurn) {
          if (!seenNames.has(f.name)) {
            seenNames.add(f.name);
            unique.push(f);
          }
        }
        return unique.length > 0 ? unique : roomFurniture;
      }
      return roomFurniture;
    }
    const found = rooms.find((r) => r.id === selectedFilterRoom);
    return found?.furniture || roomFurniture;
  }, [selectedFilterRoom, rooms, roomFurniture]);

  const isItemInSelectedRoom = (item) => {
    if (selectedFilterRoom === 'all') return true;
    if (item.roomId) {
      return item.roomId === selectedFilterRoom;
    }
    const rawLoc = (item.location || '').trim();
    const furnName = rawLoc.includes(' · ') ? rawLoc.slice(0, rawLoc.indexOf(' · ')).trim() : rawLoc;
    const targetRoom = rooms.find((r) => r.id === selectedFilterRoom);
    if (targetRoom && (targetRoom.furniture || []).some((f) => f.name === furnName)) {
      return true;
    }
    const firstRoom = rooms[0];
    if (firstRoom && firstRoom.id === selectedFilterRoom) {
      const isClaimedByOther = rooms.some((r) => r.id !== firstRoom.id && (r.furniture || []).some((f) => f.name === furnName));
      return !isClaimedByOther;
    }
    return false;
  };

  const furnitureGroups = useMemo(() => {
    const furnMap = new Map();
    const getIcon = (furnName) => {
      if (furnName === '바닥 보관') return '🧺';
      if (furnName === '미분류') return '📍';
      const f = currentRoomFurniture.find((rf) => rf.name === furnName);
      if (f && f.type) {
        const icons = { drawers: '🗄️', shelf: '📚', desk: '🖥️', bed: '🛏️', wardrobe: '👗', organizer: '📦' };
        return icons[f.type] || '🗄️';
      }
      return '🏠';
    };

    for (const f of currentRoomFurniture) {
      furnMap.set(f.name, { id: f.id, name: f.name, icon: getIcon(f.name), totalCount: 0, slots: new Map() });
    }

    const roomItems = items.filter(isItemInSelectedRoom);

    for (const item of roomItems) {
      const rawLoc = (item.location || '미분류').trim();
      let furnName = rawLoc;
      let slotPart = null;
      if (rawLoc.includes(' · ')) {
        const idx = rawLoc.indexOf(' · ');
        furnName = rawLoc.slice(0, idx).trim();
        slotPart = rawLoc.slice(idx + 3).trim();
      }
      if (!furnMap.has(furnName)) {
        furnMap.set(furnName, { id: furnName, name: furnName, icon: getIcon(furnName), totalCount: 0, slots: new Map() });
      }
      const g = furnMap.get(furnName);
      g.totalCount++;
      if (slotPart) {
        const sObj = g.slots.get(rawLoc) || { fullLocation: rawLoc, label: slotPart, count: 0 };
        sObj.count++;
        g.slots.set(rawLoc, sObj);
      }
    }

    return Array.from(furnMap.values())
      .filter((g) => g.totalCount > 0)
      .map((g) => ({
        ...g,
        hasSlots: g.slots.size > 0,
        slots: Array.from(g.slots.values()).sort((a, b) => a.label.localeCompare(b.label, 'ko', { numeric: true })),
      }))
      .sort((a, b) => b.totalCount - a.totalCount);
  }, [items, currentRoomFurniture, selectedFilterRoom, rooms]);

  const toggleFurniture = (furn) => {
    const furnKey = `furn:${furn.name}`;
    const isWhole = selectedLocations.includes(furnKey);
    const hasAnySlot = selectedLocations.some((k) => k.startsWith(`slot:${furn.name} · `));
    const isSelected = isWhole || hasAnySlot;

    if (furn.hasSlots) {
      if (isSelected && expandedFurn === furn.name) {
        setExpandedFurn(null);
      } else {
        setExpandedFurn(furn.name);
      }
    }

    setSelectedLocations((prev) => {
      if (isSelected) {
        return prev.filter((k) => k !== furnKey && !k.startsWith(`slot:${furn.name} · `));
      } else {
        return [...prev, furnKey];
      }
    });
  };

  const toggleSlot = (furnName, fullLocation) => {
    const slotKey = `slot:${fullLocation}`;
    const furnKey = `furn:${furnName}`;

    setSelectedLocations((prev) => {
      const isSlotSelected = prev.includes(slotKey);
      if (isSlotSelected) {
        return prev.filter((k) => k !== slotKey);
      } else {
        const withoutWhole = prev.filter((k) => k !== furnKey);
        return [...withoutWhole, slotKey];
      }
    });
  };

  const toggleWholeFurnitureOnly = (furnName) => {
    const furnKey = `furn:${furnName}`;
    setSelectedLocations((prev) => {
      if (prev.includes(furnKey)) {
        return prev.filter((k) => k !== furnKey);
      } else {
        const withoutSlots = prev.filter((k) => !k.startsWith(`slot:${furnName} · `));
        return [...withoutSlots, furnKey];
      }
    });
  };

  const filteredItems = useMemo(() => items.filter((item) => {
    if (!isItemInSelectedRoom(item)) return false;
    if (selectedStatus !== 'all' && item.status !== selectedStatus) return false;
    if (selectedCategory && item.category !== selectedCategory) return false;
    if (selectedUsage && (item.usage || 'frequent') !== selectedUsage) return false;
    if (selectedLocations.length > 0) {
      const loc = (item.location || '미분류').trim();
      const matched = selectedLocations.some((k) => {
        if (k.startsWith('furn:')) {
          const fn = k.slice(5);
          return loc === fn || loc.startsWith(`${fn} · `);
        }
        if (k.startsWith('slot:')) {
          return loc === k.slice(5);
        }
        return loc === k;
      });
      if (!matched) return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const nameMatch = item.name && item.name.toLowerCase().includes(q);
      const descMatch = item.description && item.description.toLowerCase().includes(q);
      const catMatch = item.category && item.category.toLowerCase().includes(q);
      const locMatch = item.location && item.location.toLowerCase().includes(q);
      if (!nameMatch && !descMatch && !catMatch && !locMatch) return false;
    }
    return true;
  }), [items, selectedFilterRoom, rooms, selectedStatus, selectedCategory, selectedLocations, selectedUsage, searchQuery]);

  const clearAllFilters = () => {
    setSelectedFilterRoom('all');
    setSelectedCategory(null);
    setSelectedLocations([]);
    setSelectedUsage(null);
    setSelectedStatus('all');
    setExpandedFurn(null);
    setSearchQuery('');
  };
  const isFiltered = selectedFilterRoom !== 'all' || selectedCategory || selectedLocations.length > 0 || selectedUsage || selectedStatus !== 'all' || !!searchQuery.trim();

  const handleBatchRecalibrate = (referenceItem, updatedList) => {
    const sizeOrder = ['tiny', 'small', 'medium', 'large'];
    const oldSize = items.find((i) => i.id === referenceItem.id)?.size || 'small';
    const delta = sizeOrder.indexOf(referenceItem.size || 'small') - sizeOrder.indexOf(oldSize);
    const sizeByName = new Map(updatedList.filter((u) => u.name).map((u) => [u.name.trim().toLowerCase(), u.size]));
    const sizeById = new Map(updatedList.filter((u) => u.id).map((u) => [u.id, u.size]));
    const nearby = items.filter((i) => i.id !== referenceItem.id && i.location === referenceItem.location);
    const targets = nearby.length ? nearby : items.filter((i) => i.id !== referenceItem.id);
    let changedCount = 0;
    const updates = [referenceItem, ...targets.map((item) => {
      let size = sizeById.get(item.id) || sizeByName.get(item.name.trim().toLowerCase());
      if (!size || size === item.size) size = sizeOrder[Math.max(0, Math.min(3, sizeOrder.indexOf(item.size || 'small') + delta))];
      if (size !== item.size) changedCount += 1;
      return { ...item, size };
    })];
    if (onUpdateMultiple) onUpdateMultiple(updates); else updates.forEach((update) => onUpdate(update.id, update));
    setRecalibrateNotice({ refName: referenceItem.name, count: changedCount || targets.length });
  };

  if (!items.length) return <div className="flex flex-col items-center justify-center gap-4 py-16 text-center"><div className="text-7xl p-6 bg-[#FFF0EE] rounded-full shadow-[0_10px_30px_rgba(255,183,178,0.22)]">📋</div><h3 className="text-2xl font-extrabold text-[#4A3E3D]">아직 등록된 물건이 없어요</h3><p className="text-base text-[#806F6D] max-w-xs">카메라 탭에서 방 안의 물건을 사진 찍어서 등록해보세요!</p></div>;

  return (
    <div className="space-y-6 pb-12">
      {/* 상태별 카운트 버튼 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4.5">
        {statusOptions.map(({ id, icon, label, color }) => {
          const isActive = selectedStatus === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setSelectedStatus(id)}
              className={`fluffy-button fluffy-card p-4 sm:p-5 text-center transition-all ${
                isActive ? `${color} ring-4 ring-[#FFDAC1]/60 font-black` : 'hover:bg-[#FFFDFC]'
              }`}
            >
              <div className="mb-2 flex justify-center">
                <Icon name={icon} size={21} strokeWidth={1.7} />
              </div>
              <div className={`text-3xl sm:text-4xl font-extrabold ${isActive ? '' : 'text-[#4A3E3D]'}`}>
                {id === 'all' ? stats.total : stats[id] || 0}
              </div>
              <div className="text-xs sm:text-sm font-bold text-[#806F6D] mt-1">{label}</div>
            </button>
          );
        })}
      </div>

      {/* 🔍 물건 검색창 및 🎛️ 필터링 버튼 */}
      <div className="flex items-center gap-2.5">
        <div className="flex-1 fluffy-card p-3 sm:p-4 flex items-center gap-3 border border-[#F4EEEA] shadow-[0_8px_24px_rgba(74,62,61,0.06)] focus-within:ring-2 focus-within:ring-[#FFB7B2] focus-within:border-[#FFB7B2] transition-all bg-white">
          <span className="text-[#B56562] pl-1.5 shrink-0">
            <Icon name="search" size={20} strokeWidth={2.2} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="물건 이름 또는 설명으로 검색해보세요 (예: 토너, 반팔, 충전기...)"
            className="w-full bg-transparent border-none text-sm sm:text-base font-semibold text-[#4A3E3D] placeholder-[#B9A8A5] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="fluffy-button px-2.5 py-1 text-xs font-bold text-[#806F6D] hover:text-[#B56562] bg-[#FAF8F5] hover:bg-[#FFF0EE] rounded-full shrink-0 transition-colors flex items-center gap-1"
              title="검색어 지우기"
            >
              <Icon name="close" size={13} strokeWidth={2.5} />
              <span className="hidden sm:inline">지우기</span>
            </button>
          )}
        </div>

        {/* 🎛️ 필터링 토글 버튼 */}
        <button
          type="button"
          onClick={handleToggleFilters}
          className={`fluffy-button px-4 sm:px-5 py-3.5 sm:py-4 rounded-[22px] font-black text-sm sm:text-base flex items-center gap-2 shrink-0 transition-all shadow-xs ${
            showFilters
              ? 'bg-[#FFB7B2] text-[#4A3E3D] ring-2 ring-[#FF9E99] shadow-md'
              : activeFilterCount > 0
              ? 'bg-[#FFE8E4] text-[#4A3E3D] border-2 border-[#FFB7B2]'
              : 'bg-white text-[#6D5A57] border border-[#EFE5DC] hover:bg-[#FFF5EE]'
          }`}
          title={showFilters ? '필터 접기' : '필터 펼치기'}
        >
          <Icon name="filter" size={18} strokeWidth={2.2} />
          <span className="hidden sm:inline">필터링</span>
          {activeFilterCount > 0 && (
            <span className="rounded-full bg-[#B56562] text-white px-2 py-0.5 text-xs font-black shadow-xs">
              {activeFilterCount}
            </span>
          )}
          <span className="text-xs text-[#9A8784]">{showFilters ? '▴' : '▾'}</span>
        </button>
      </div>

      {/* 필터링 버튼 클릭 시 펼쳐지는 상세 필터 패널 */}
      {showFilters && (
        <div className="space-y-3 p-4 sm:p-5 bg-gradient-to-b from-[#FFF9F5] to-[#FFF4ED] border border-[#FFDAC1] rounded-[28px] shadow-sm animate-fadeIn">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs sm:text-sm font-extrabold text-[#7D5E53] flex items-center gap-1.5">
              상세 필터링 (카테고리 · 위치 · 사용 빈도)
            </span>
            <button
              type="button"
              onClick={handleToggleFilters}
              className="fluffy-button text-xs font-bold text-[#9A8784] hover:text-[#4A3E3D] px-2.5 py-1 rounded-xl hover:bg-white/80 transition-colors"
            >
              접기 ▴
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5 xl:gap-6 lg:items-start">
            {/* 1. 카테고리별 */}
            {Object.keys(stats.categories).length > 0 && (
              <section className="fluffy-card p-4 sm:p-5 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <h3 className="text-base sm:text-lg font-extrabold text-[#4A3E3D]">
                      카테고리별 <span className="text-xs font-medium text-[#9A8784]">(모아보기)</span>
                    </h3>
                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={() => setSelectedCategory(null)}
                        className="fluffy-button text-xs font-bold text-[#B56562] bg-[#FFF0EE] px-2.5 py-1"
                      >
                        해제 ✕
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2 sm:gap-2.5">
                    {Object.entries(stats.categories)
                      .sort(([, a], [, b]) => b - a)
                      .map(([category, count]) => {
                        const selected = selectedCategory === category;
                        return (
                          <button
                            type="button"
                            key={category}
                            onClick={() => setSelectedCategory(selected ? null : category)}
                            className={`fluffy-button flex items-center justify-between p-2.5 sm:p-3 text-left transition-all ${
                              selected
                                ? 'bg-[#FFB7B2] text-[#4A3E3D] font-extrabold ring-2 ring-[#FF9E99] shadow-xs'
                                : 'bg-[#FAF8F5] text-[#4A3E3D] hover:bg-[#FFF5EE]'
                            }`}
                          >
                            <span className="font-bold flex items-center gap-1.5 text-xs sm:text-sm truncate">
                              <span className="text-base shrink-0">{categoryEmojis[category] || '📦'}</span>
                              <span className="truncate">{category}</span>
                            </span>
                            <b className="text-xs sm:text-sm shrink-0 ml-1">{count}</b>
                          </button>
                        );
                      })}
                  </div>
                </div>
              </section>
            )}

            {/* 2. 위치별 */}
            {(furnitureGroups.length > 0 || (rooms && rooms.length > 0)) && (
              <section className="fluffy-card p-4 sm:p-5 h-full flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <h3 className="text-base sm:text-lg font-extrabold text-[#4A3E3D] flex items-center gap-1.5">
                      위치별 <span className="text-xs font-medium text-[#9A8784]">(칸/중복 선택)</span>
                    </h3>
                    {(selectedLocations.length > 0 || selectedFilterRoom !== 'all') && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedLocations([]);
                          setExpandedFurn(null);
                          setSelectedFilterRoom('all');
                        }}
                        className="fluffy-button text-xs font-bold text-[#B56562] bg-[#FFF0EE] px-2.5 py-1"
                      >
                        해제 ✕
                      </button>
                    )}
                  </div>

                  {/* 방 구분 선택 바 */}
                  {rooms && rooms.length > 0 && (
                    <div className="mb-3 pt-1 pb-2.5 border-b border-[#F4EEEA]">
                      <div className="text-[11px] font-extrabold text-[#806F6D] mb-1.5 flex items-center justify-between">
                        <span>방 선택</span>
                        {selectedFilterRoom !== 'all' && (
                          <span className="text-[11px] text-[#B56562] font-bold">
                            {rooms.find((r) => r.id === selectedFilterRoom)?.name || '방'} 필터 적용 중
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFilterRoom('all');
                            setSelectedLocations([]);
                            setExpandedFurn(null);
                          }}
                          className={`fluffy-button px-2.5 py-1 text-xs rounded-xl font-bold transition-all ${
                            selectedFilterRoom === 'all'
                              ? 'bg-[#4A3E3D] text-white shadow-xs'
                              : 'bg-[#FAF8F5] text-[#806F6D] hover:bg-[#FFF5EE] border border-[#EFE5DC]'
                          }`}
                        >
                          전체 방
                        </button>
                        {rooms.map((r) => {
                          const isRoomSelected = selectedFilterRoom === r.id;
                          const roomItemCount = items.filter((item) => {
                            if (item.roomId) return item.roomId === r.id;
                            const rawLoc = (item.location || '').trim();
                            const furnName = rawLoc.includes(' · ') ? rawLoc.slice(0, rawLoc.indexOf(' · ')).trim() : rawLoc;
                            return (r.furniture || []).some((f) => f.name === furnName);
                          }).length;

                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setSelectedFilterRoom(r.id);
                                setSelectedLocations([]);
                                setExpandedFurn(null);
                              }}
                              className={`fluffy-button px-2.5 py-1 text-xs rounded-xl font-bold transition-all flex items-center gap-1 ${
                                isRoomSelected
                                  ? 'bg-[#FFB7B2] text-[#4A3E3D] font-extrabold ring-2 ring-[#FF9E99] shadow-xs'
                                  : 'bg-[#FAF8F5] text-[#806F6D] hover:bg-[#FFF5EE] border border-[#EFE5DC]'
                              }`}
                            >
                              <span>{r.name}</span>
                              <span className="text-[10px] opacity-75 font-normal">({roomItemCount})</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-[#9A8784] mb-3">가구 클릭 시 칸 선택 서랍이 열려요</p>

                  {/* 가구 칩 버튼 목록 */}
                  {furnitureGroups.length === 0 ? (
                    <p className="text-xs text-[#9A8784] py-3 text-center">선택한 방에 보관된 가구/물건이 없어요.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                    {furnitureGroups.map((g) => {
                      const isWholeSelected = selectedLocations.includes(`furn:${g.name}`);
                      const selectedSlotCount = g.slots.filter((s) => selectedLocations.includes(`slot:${s.fullLocation}`)).length;
                      const isPartiallySelected = !isWholeSelected && selectedSlotCount > 0;
                      const isExpanded = expandedFurn === g.name;

                      let chipStyle = 'bg-[#FFF5EE] text-[#806F6D] border border-[#EFE5DC] hover:bg-[#FFEFE5]';
                      if (isWholeSelected) {
                        chipStyle = 'bg-[#FFB7B2] text-[#4A3E3D] font-extrabold ring-2 ring-[#FF9E99] shadow-xs';
                      } else if (isPartiallySelected) {
                        chipStyle = 'bg-[#FFE8E4] text-[#4A3E3D] font-bold border-2 border-[#FFB7B2] shadow-xs';
                      }

                      return (
                        <div key={g.name} className="inline-flex items-center">
                          <button
                            type="button"
                            onClick={() => toggleFurniture(g)}
                            className={`fluffy-button px-3 py-2 text-xs sm:text-sm font-bold transition-all flex items-center gap-1 rounded-2xl ${chipStyle}`}
                          >
                            <span>{g.icon}</span>
                            <span className="truncate max-w-[110px]">{g.name}</span>
                            <span className="ml-0.5 rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] text-[#80604F]">
                              {g.totalCount}
                            </span>
                            {isPartiallySelected && (
                              <span className="text-[10px] bg-[#FFB7B2]/70 text-[#4A3E3D] font-bold px-1.5 py-0.5 rounded-full">
                                {selectedSlotCount}칸
                              </span>
                            )}
                            {g.hasSlots && (
                              <span
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedFurn((curr) => (curr === g.name ? null : g.name));
                                }}
                                className="ml-0.5 text-xs text-[#9A8784] hover:text-[#4A3E3D] px-1 py-0.5 rounded-md hover:bg-black/5"
                                title={isExpanded ? '칸 접기' : '칸 펼치기'}
                              >
                                {isExpanded ? '▴' : '▾'}
                              </span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                    </div>
                  )}

                  {/* 가구 칸 서랍 */}
                  {expandedFurn && (() => {
                    const activeGroup = furnitureGroups.find((g) => g.name === expandedFurn);
                    if (!activeGroup || !activeGroup.hasSlots) return null;
                    const isWholeSelected = selectedLocations.includes(`furn:${activeGroup.name}`);

                    return (
                      <div className="mt-3 p-3 bg-gradient-to-r from-[#FFF8F5] to-[#FFF3ED] border border-[#FFDAC1] rounded-2xl shadow-xs animate-fadeIn">
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <span className="text-xs font-bold text-[#6D5A57] flex items-center gap-1 truncate">
                            <span className="text-sm">{activeGroup.icon}</span>
                            <b className="text-[#4A3E3D] truncate">{activeGroup.name}</b>의 칸 선택
                          </span>
                          <button
                            type="button"
                            onClick={() => setExpandedFurn(null)}
                            className="text-xs font-bold text-[#9A8784] hover:text-[#4A3E3D] px-1.5 py-0.5 rounded-lg hover:bg-white/80 shrink-0"
                          >
                            닫기 ✕
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => toggleWholeFurnitureOnly(activeGroup.name)}
                            className={`fluffy-button px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                              isWholeSelected
                                ? 'bg-[#FFB7B2] text-[#4A3E3D] ring-2 ring-[#FF9E99] font-extrabold shadow-xs'
                                : 'bg-white text-[#806F6D] border border-[#EDE5DE] hover:bg-[#FFF5EE]'
                            }`}
                          >
                            전체 ({activeGroup.totalCount})
                          </button>
                          {activeGroup.slots.map((slot) => {
                            const isSlotSelected = selectedLocations.includes(`slot:${slot.fullLocation}`);
                            return (
                              <button
                                key={slot.fullLocation}
                                type="button"
                                onClick={() => toggleSlot(activeGroup.name, slot.fullLocation)}
                                className={`fluffy-button px-2.5 py-1.5 text-xs font-bold rounded-xl transition-all ${
                                  isSlotSelected
                                    ? 'bg-[#FFB7B2] text-[#4A3E3D] ring-2 ring-[#FF9E99] font-extrabold shadow-xs'
                                    : 'bg-white text-[#806F6D] border border-[#EDE5DE] hover:bg-[#FFF5EE]'
                                }`}
                              >
                                {slot.label} ({slot.count})
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </section>
            )}

            {/* 3. 사용 빈도별 */}
            <section className="fluffy-card p-4 sm:p-5 h-full flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-3.5">
                  <h3 className="text-base sm:text-lg font-extrabold text-[#4A3E3D]">
                    사용 빈도별 <span className="text-xs font-medium text-[#9A8784]">(모아보기)</span>
                  </h3>
                  {selectedUsage && (
                    <button
                      type="button"
                      onClick={() => setSelectedUsage(null)}
                      className="fluffy-button text-xs font-bold text-[#B56562] bg-[#FFF0EE] px-2.5 py-1"
                    >
                      해제 ✕
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2.5">
                  {Object.values(USAGE_CONFIG).map((cfg) => {
                    const count = stats.usages
                      ? stats.usages[cfg.id] || 0
                      : items.filter((i) => (i.usage || 'frequent') === cfg.id).length;
                    const selected = selectedUsage === cfg.id;
                    return (
                      <button
                        type="button"
                        key={cfg.id}
                        onClick={() => setSelectedUsage(selected ? null : cfg.id)}
                        className={`fluffy-button flex items-center justify-between p-3 text-left rounded-2xl border transition-all ${
                          selected
                            ? `${cfg.badgeClass} ring-2 ring-[#FFDAC1] font-extrabold shadow-xs`
                            : 'bg-[#FAF8F5] text-[#4A3E3D] border-[#EDE5DE] hover:bg-[#FFF5EE]'
                        }`}
                      >
                        <span className="font-bold flex items-center gap-2 text-xs sm:text-sm">
                          <span className="text-lg">{cfg.emoji}</span>
                          <span>{cfg.label}</span>
                        </span>
                        <b className="text-xs sm:text-sm">{count}</b>
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        </div>
      )}

      {/* 적용된 필터 활성 상태 태그 요약 바 */}
      {isFiltered && (
        <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#FFF0E5] p-3.5 sm:p-4 shadow-[0_10px_30px_rgba(74,62,61,0.06)] flex-wrap">
          <div className="flex items-center gap-2 flex-wrap text-xs sm:text-sm">
            <span className="font-extrabold text-[#80604F]">🏷️ 적용된 필터:</span>
            {selectedFilterRoom !== 'all' && (
              <span className="bg-white px-2.5 py-1 rounded-xl text-[#B56562] font-bold border border-[#FFDAC1] flex items-center gap-1 shadow-xs">
                방: {rooms.find((r) => r.id === selectedFilterRoom)?.name || '선택된 방'}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFilterRoom('all');
                    setSelectedLocations([]);
                    setExpandedFurn(null);
                  }}
                  className="hover:text-red-500 font-black"
                >
                  ✕
                </button>
              </span>
            )}
            {searchQuery && (
              <span className="bg-white px-2.5 py-1 rounded-xl text-[#B56562] font-bold border border-[#FFDAC1] flex items-center gap-1 shadow-xs">
                검색: '{searchQuery}'
                <button type="button" onClick={() => setSearchQuery('')} className="hover:text-red-500 font-black">✕</button>
              </span>
            )}
            {selectedCategory && (
              <span className="bg-white px-2.5 py-1 rounded-xl text-[#B56562] font-bold border border-[#FFDAC1] flex items-center gap-1 shadow-xs">
                카테고리: {selectedCategory}
                <button type="button" onClick={() => setSelectedCategory(null)} className="hover:text-red-500 font-black">✕</button>
              </span>
            )}
            {selectedLocations.map((k) => {
              const label = k.startsWith('furn:') ? k.slice(5) : k.startsWith('slot:') ? k.slice(5) : k;
              return (
                <span key={k} className="bg-white px-2.5 py-1 rounded-xl text-[#685957] font-bold border border-[#EDE5DE] flex items-center gap-1 shadow-xs">
                  위치: {label}
                  <button type="button" onClick={() => setSelectedLocations((prev) => prev.filter((x) => x !== k))} className="hover:text-red-500 font-black">✕</button>
                </span>
              );
            })}
            {selectedUsage && (
              <span className="bg-white px-2.5 py-1 rounded-xl text-[#685957] font-bold border border-[#EDE5DE] flex items-center gap-1 shadow-xs">
                사용: {USAGE_CONFIG[selectedUsage]?.label || selectedUsage}
                <button type="button" onClick={() => setSelectedUsage(null)} className="hover:text-red-500 font-black">✕</button>
              </span>
            )}
            <span className="text-[#80604F] font-black ml-1">
              ({filteredItems.length}개)
            </span>
          </div>

          <button
            type="button"
            onClick={clearAllFilters}
            className="fluffy-button bg-white px-3.5 py-2 text-xs font-extrabold text-[#A96845] hover:bg-[#FFEFE5] transition-colors shadow-xs ml-auto"
          >
            필터 초기화 ↺
          </button>
        </div>
      )}

      {recalibrateNotice && (
        <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#FFF5D9] p-4 shadow-[0_10px_30px_rgba(74,62,61,0.06)]">
          <p className="text-sm text-[#80604F]">
            ✨ <b>{recalibrateNotice.refName}</b> 기준으로 {recalibrateNotice.count}개 물건의 크기를 다시 맞췄어요.
          </p>
          <button
            type="button"
            onClick={() => setRecalibrateNotice(null)}
            className="fluffy-button bg-white px-3 py-2 text-xs font-bold text-[#80604F]"
          >
            확인 ✕
          </button>
        </div>
      )}

      {noticeMessage && (
        <div className="flex items-center justify-between gap-3 rounded-[24px] bg-[#FFF0EE] border border-[#FFDAC1] p-4 shadow-[0_10px_30px_rgba(74,62,61,0.08)] animate-fadeIn">
          <p className="text-sm font-extrabold text-[#B56562]">{noticeMessage}</p>
          <button
            type="button"
            onClick={() => setNoticeMessage('')}
            className="fluffy-button bg-white px-3 py-1.5 text-xs font-bold text-[#806F6D] hover:text-[#4A3E3D] rounded-xl shadow-xs"
          >
            확인 ✕
          </button>
        </div>
      )}

      {/* 물건 목록 섹션 (헤더: 개수 + 뷰 모드 토글 + 편집 / 정리하기 버튼) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1 flex-wrap gap-2.5">
          <div>
            <h3 className="text-lg sm:text-xl font-extrabold text-[#4A3E3D]">
              🗂️ 물건 목록 ({filteredItems.length}개)
            </h3>
            <span className="text-xs text-[#9A8784]">
              {isEditMode
                ? '💡 물건을 체크하여 다른 곳으로 이동하거나 삭제할 수 있어요'
                : isDeclutterMode
                ? '✨ 정리할 물건들을 클릭하여 선택해주세요'
                : viewMode === 'block'
                ? '⊞ 블록 그리드로 보는 중'
                : '☰ 일렬 목록으로 보는 중'}
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* 편집 모드 헤더 액션 */}
            {isEditMode ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="fluffy-button px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFF5EE] text-[#806F6D] hover:text-[#4A3E3D] border border-[#EFE5DC]"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="fluffy-button px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFF5EE] text-[#806F6D] hover:text-[#4A3E3D] border border-[#EFE5DC]"
                >
                  선택 해제
                </button>
                <button
                  type="button"
                  onClick={handleExitEditMode}
                  className="fluffy-button px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold bg-[#4A3E3D] text-white hover:bg-[#342B2A] shadow-xs"
                >
                  완료 ✓
                </button>
              </div>
            ) : isDeclutterMode ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={selectAllFiltered}
                  className="fluffy-button px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFF5EE] text-[#806F6D] hover:text-[#4A3E3D] border border-[#EFE5DC]"
                >
                  전체 선택
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  className="fluffy-button px-3 py-1.5 rounded-xl text-xs font-bold bg-[#FFF5EE] text-[#806F6D] hover:text-[#4A3E3D] border border-[#EFE5DC]"
                >
                  선택 해제
                </button>
                <button
                  type="button"
                  onClick={handleExitDeclutterMode}
                  className="fluffy-button px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-extrabold bg-[#FAF8F5] text-[#806F6D] hover:bg-[#FFEAE5] hover:text-[#B56562] border border-[#EDE5DE]"
                >
                  ✕ 취소
                </button>
              </div>
            ) : (
              <>
                {/* ✏️ 편집 모드 토글 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsEditMode(true);
                    setIsDeclutterMode(false);
                    setSelectedItemIds(new Set());
                  }}
                  className="fluffy-button px-3.5 sm:px-4 py-1.5 rounded-2xl text-xs sm:text-sm font-bold bg-white text-[#6D5A57] border border-[#EDE5DE] hover:bg-[#FAF8F5] flex items-center gap-1.5 shadow-xs transition-all"
                  title="물건들을 선택하여 다른 위치로 이동하거나 한 번에 삭제해요"
                >
                  <Icon name="pencil" size={14} />
                  <span>편집</span>
                </button>

                {/* ✨ 정리하기 버튼 */}
                <button
                  type="button"
                  onClick={() => {
                    setIsDeclutterMode(true);
                    setIsEditMode(false);
                    setSelectedItemIds(new Set());
                  }}
                  className="fluffy-button px-3.5 sm:px-4 py-1.5 rounded-2xl text-xs sm:text-sm font-extrabold bg-gradient-to-r from-[#FFB7B2] to-[#FFDAC1] text-[#4A3E3D] shadow-[0_4px_14px_rgba(255,183,178,0.4)] flex items-center gap-1.5 hover:scale-105 active:scale-95 transition-all"
                  title="정리할 물건들을 선택해서 AI와 함께 정리해요"
                >
                  <Icon name="sparkle" size={15} />
                  <span>✨ 정리하기</span>
                </button>
              </>
            )}

            {/* 뷰 모드 토글 (목록형 vs 블록형) */}
            <div className="flex items-center bg-[#FAF8F5] p-1 rounded-2xl border border-[#EDE5DE] gap-1">
              <button
                type="button"
                onClick={() => handleSetViewMode('list')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'list'
                    ? 'bg-white text-[#4A3E3D] shadow-xs ring-1 ring-black/5 font-extrabold'
                    : 'text-[#806F6D] hover:text-[#4A3E3D]'
                }`}
                title="일렬 목록형 보기"
              >
                <Icon name="list" size={15} />
                <span>목록형</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode('block')}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                  viewMode === 'block'
                    ? 'bg-white text-[#4A3E3D] shadow-xs ring-1 ring-black/5 font-extrabold'
                    : 'text-[#806F6D] hover:text-[#4A3E3D]'
                }`}
                title="작은 블록형 보기"
              >
                <Icon name="grid" size={15} />
                <span>블록형</span>
              </button>
            </div>
          </div>
        </div>

        {filteredItems.length === 0 ? (
          <div className="fluffy-card p-8 text-center">
            <p className="font-medium text-[#806F6D]">
              {searchQuery ? `'${searchQuery}' 검색 결과와 일치하는 물건이 없어요.` : '선택한 조건에 맞는 물건이 없어요.'}
            </p>
            <button
              type="button"
              onClick={clearAllFilters}
              className="fluffy-button mt-3 bg-[#FFF0EE] px-4 py-2 text-sm font-bold text-[#B56562]"
            >
              모든 물건 보기
            </button>
          </div>
        ) : (
          <div
            className={
              viewMode === 'block'
                ? 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4.5'
                : 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3 sm:gap-4'
            }
          >
            {filteredItems.map((item) => {
              const nearby = items.filter((other) => other.id !== item.id && other.location === item.location);
              return (
                <ItemCard
                  key={item.id}
                  item={item}
                  onUpdate={onUpdate}
                  onRemove={onRemove}
                  otherItems={nearby.length ? nearby : items.filter((other) => other.id !== item.id)}
                  onBatchRecalibrate={handleBatchRecalibrate}
                  roomFurniture={currentRoomFurniture}
                  viewMode={viewMode}
                  isDeclutterMode={isDeclutterMode}
                  isEditMode={isEditMode}
                  isSelected={selectedItemIds.has(item.id)}
                  onToggleSelect={toggleSelectItem}
                  onAddSlot={onAddSlot}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* 정리 모드 하단 플로팅 바 */}
      {isDeclutterMode && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] sm:w-auto animate-fadeIn">
          <div className="bg-white/95 backdrop-blur-md border-2 border-[#FFB7B2] shadow-[0_16px_40px_rgba(74,62,61,0.2)] rounded-full px-5 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 pl-1">
              <span className="text-xl">✨</span>
              <span className="text-sm sm:text-base font-extrabold text-[#4A3E3D]">
                <b className="text-[#B56562] font-black text-base sm:text-lg">{selectedItemIds.size}개</b> 선택됨
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExitDeclutterMode}
                className="fluffy-button px-3.5 py-2 text-xs font-bold text-[#806F6D] hover:bg-[#FAF8F5] rounded-full"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleTriggerAiDeclutter}
                disabled={selectedItemIds.size === 0}
                className="fluffy-button px-4 sm:px-5 py-2.5 bg-[#FFB7B2] hover:bg-[#FFA59E] text-[#4A3E3D] font-black text-xs sm:text-sm rounded-full shadow-[0_6px_18px_rgba(255,183,178,0.45)] flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Icon name="sparkle" size={15} />
                <span>AI 정리 시작하기 →</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 편집 모드 하단 플로팅 바 */}
      {isEditMode && (
        <div className="fixed bottom-20 sm:bottom-24 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[92%] sm:w-auto animate-fadeIn">
          <div className="bg-white/95 backdrop-blur-md border-2 border-[#FFB7B2] shadow-[0_16px_40px_rgba(74,62,61,0.22)] rounded-full px-4 sm:px-5 py-3 flex items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 pl-1 shrink-0">
              <span className="text-lg sm:text-xl">✏️</span>
              <span className="text-xs sm:text-sm font-extrabold text-[#4A3E3D]">
                <b className="text-[#B56562] font-black text-sm sm:text-base">{selectedItemIds.size}개</b> 선택됨
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* 다른 곳으로 이동 */}
              <button
                type="button"
                onClick={() => setShowMoveModal(true)}
                disabled={selectedItemIds.size === 0}
                className="fluffy-button px-3 sm:px-4 py-2 bg-[#FFF0EE] hover:bg-[#FFE5E1] text-[#B56562] font-black text-xs sm:text-sm rounded-full border border-[#FFDAC1] shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="선택한 물건들을 다른 위치로 이동해요"
              >
                <Icon name="box" size={14} />
                <span>위치 이동</span>
              </button>

              {/* 한 번에 삭제 */}
              <button
                type="button"
                onClick={handleBatchDelete}
                disabled={selectedItemIds.size === 0}
                className="fluffy-button px-3 sm:px-4 py-2 bg-[#FFE9E7] hover:bg-[#FFD3CF] text-[#B55B59] font-black text-xs sm:text-sm rounded-full border border-[#FFCCD2] shadow-xs flex items-center gap-1.5 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                title="선택한 물건들을 한 번에 삭제해요"
              >
                <Icon name="trash" size={14} />
                <span>삭제</span>
              </button>

              {/* 완료 버튼 */}
              <button
                type="button"
                onClick={handleExitEditMode}
                className="fluffy-button px-3.5 sm:px-4 py-2 bg-[#4A3E3D] hover:bg-[#342B2A] text-white font-black text-xs sm:text-sm rounded-full shadow-xs transition-all"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 위치 이동 모달 */}
      {showMoveModal && (
        <MoveItemsModal
          selectedItemCount={selectedItemIds.size}
          currentLocation=""
          roomFurniture={currentRoomFurniture}
          onConfirm={handleBatchMoveConfirm}
          onClose={() => setShowMoveModal(false)}
          onAddSlot={onAddSlot}
        />
      )}
    </div>
  );
}
