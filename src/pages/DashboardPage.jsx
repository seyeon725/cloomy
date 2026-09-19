import Dashboard from '../components/Dashboard';

export default function DashboardPage({
  itemsHook,
  rooms = [],
  activeRoomId = null,
  setActiveRoomId,
  roomFurniture = [],
  onStartDeclutter,
  onAddFurniture,
  onAddSlot,
}) {
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
        rooms={rooms}
        activeRoomId={activeRoomId}
        setActiveRoomId={setActiveRoomId}
        roomFurniture={roomFurniture}
        onAddFurniture={onAddFurniture}
        onStartDeclutter={onStartDeclutter}
        onAddSlot={onAddSlot}
      />
    </div>
  );
}
