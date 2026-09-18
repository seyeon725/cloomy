import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

const STORAGE_KEY = 'jeongnijjang_items';

function loadItems() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveItems(items) {
  try {
    // 거대한 base64 이미지가 포함되어 있으면 localStorage 용량(5MB) 초과 에러가 발생하므로
    // photoUrl 같은 거대 데이터는 제외하고 메타데이터 위주로 안전하게 저장합니다.
    const sanitized = items.map(({ photoUrl, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch (err) {
    console.warn('localStorage 저장 실패 (용량 초과 등):', err);
  }
}

export function useItems() {
  const [items, setItems] = useState(loadItems);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    saveItems(items);
  }, [items]);

  const addItems = useCallback((newItems, location) => {
    const itemsWithMeta = newItems.map((item) => ({
      ...item,
      id: uuidv4(),
      location: location || '미분류',
      status: 'active',
      createdAt: new Date().toISOString(),
      lastUsedAt: null,
    }));
    setItems((prev) => [...itemsWithMeta, ...prev]);
    return itemsWithMeta;
  }, []);

  const updateItem = useCallback((id, updates) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }, []);

  const updateMultipleItems = useCallback((updatedItemsList) => {
    const updateMap = new Map(updatedItemsList.map((u) => [u.id, u]));
    setItems((prev) =>
      prev.map((item) => {
        const updates = updateMap.get(item.id);
        return updates ? { ...item, ...updates } : item;
      })
    );
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const getItemsByLocation = useCallback(
    (location) => items.filter((item) => item.location === location),
    [items]
  );

  const getLocations = useCallback(() => {
    const locs = [...new Set(items.map((item) => item.location))];
    return locs;
  }, [items]);

  const getStats = useCallback(() => {
    const total = items.length;
    const active = items.filter((i) => i.status === 'active').length;
    const archived = items.filter((i) => i.status === 'archived').length;
    const discarded = items.filter((i) => i.status === 'discarded').length;
    const categories = {};
    items.forEach((i) => {
      categories[i.category] = (categories[i.category] || 0) + 1;
    });
    const locations = {};
    items.forEach((i) => {
      locations[i.location] = (locations[i.location] || 0) + 1;
    });
    return { total, active, archived, discarded, categories, locations };
  }, [items]);

  return {
    items,
    loading,
    addItems,
    updateItem,
    updateMultipleItems,
    removeItem,
    getItemsByLocation,
    getLocations,
    getStats,
  };
}
