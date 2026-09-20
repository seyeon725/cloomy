import Dashboard from '../components/Dashboard';

export default function DashboardPage({
  itemsHook,
  rooms = [],
  activeRoomId,
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
        rooms={rooms}
        activeRoomId={activeRoomId}
        setActiveRoomId={setActiveRoomId}
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
