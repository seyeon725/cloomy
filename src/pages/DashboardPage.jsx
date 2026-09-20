import Dashboard from '../components/Dashboard';

export default function DashboardPage({ itemsHook, roomFurniture = [], onStartDeclutter, onAddFurniture, onAddSlot }) {
  const { items, getStats, updateItem, updateMultipleItems, removeItem, removeMultipleItems } = itemsHook;

  return (
    <div>
      <Dashboard
        items={items}
        stats={getStats()}
        onUpdate={updateItem}
        onUpdateMultiple={updateMultipleItems}
        onRemove={removeItem}
        onRemoveMultiple={removeMultipleItems}
        roomFurniture={roomFurniture}
        onAddFurniture={onAddFurniture}
        onStartDeclutter={onStartDeclutter}
        onAddSlot={onAddSlot}
      />
    </div>
  );
}
