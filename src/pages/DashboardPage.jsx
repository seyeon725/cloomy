import Dashboard from '../components/Dashboard';

export default function DashboardPage({ itemsHook }) {
  const { items, getStats, updateItem, updateMultipleItems, removeItem } = itemsHook;

  return (
    <div>
      <div className="text-center mb-4">
        <h2 className="text-lg font-bold text-gray-900">내 물건</h2>
        <p className="text-sm text-gray-500 mt-1">
          등록된 물건을 관리해요 🗂️
        </p>
      </div>
      <Dashboard
        items={items}
        stats={getStats()}
        onUpdate={updateItem}
        onUpdateMultiple={updateMultipleItems}
        onRemove={removeItem}
      />
    </div>
  );
}
