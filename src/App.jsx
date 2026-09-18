import { useState } from 'react';
import { useItems } from './hooks/useItems';
import ScanPage from './pages/ScanPage';
import DashboardPage from './pages/DashboardPage';
import ChatPage from './pages/ChatPage';

const TABS = [
  { id: 'scan', label: '스캔', emoji: '📷' },
  { id: 'dashboard', label: '내 물건', emoji: '📋' },
  { id: 'chat', label: 'AI 정리', emoji: '🧹' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('scan');
  const itemsHook = useItems();

  return (
    <div className="min-h-dvh bg-slate-100/70 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-5 sm:px-8 py-4 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="text-2xl sm:text-3xl">📦</span>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-indigo-600 tracking-tight">
              정리짱
            </h1>
            <span className="text-xs text-gray-400 font-medium hidden sm:inline">
              AI 물건 정리 도우미
            </span>
          </div>
        </div>
        <span className="text-xs sm:text-sm font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-full">
          등록 물건 {itemsHook.items.length}개
        </span>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto p-4 sm:p-6">
          {activeTab === 'scan' && (
            <ScanPage
              itemsHook={itemsHook}
              onRegistered={() => setActiveTab('dashboard')}
            />
          )}
          {activeTab === 'dashboard' && <DashboardPage itemsHook={itemsHook} />}
          {activeTab === 'chat' && <ChatPage itemsHook={itemsHook} />}
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-gray-200 flex z-40 shadow-lg">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex flex-col items-center py-3 sm:py-3.5 transition-all ${
                isActive
                  ? 'text-indigo-600 font-black scale-105'
                  : 'text-gray-400 hover:text-gray-600 font-semibold'
              }`}
            >
              <span className="text-2xl sm:text-3xl mb-0.5">{tab.emoji}</span>
              <span className="text-xs sm:text-sm tracking-tight">{tab.label}</span>
              {isActive && (
                <div className="w-8 h-1 bg-indigo-600 rounded-full mt-1"></div>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
