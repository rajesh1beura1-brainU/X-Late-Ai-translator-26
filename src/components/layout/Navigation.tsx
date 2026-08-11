import React from 'react';
import { useXLate } from '../../context/XLateContext';
import { ActiveTab } from '../../types';
import { Mic, History, CheckSquare, Settings, Music } from 'lucide-react';

export const Navigation: React.FC = () => {
  const { activeTab, setActiveTab, tasks, morningAlerts } = useXLate();

  const pendingTasksCount = tasks.filter(t => t.status === 'PENDING').length;
  const hasMorningAlerts = morningAlerts.length > 0;

  const tabs: { id: ActiveTab; label: string; icon: React.ReactNode; badge?: number | string }[] = [
    { id: 'home', label: 'Translate', icon: <Mic className="w-5 h-5" /> },
    { id: 'lyrics', label: 'Live Lyrics', icon: <Music className="w-5 h-5" /> },
    { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: <CheckSquare className="w-5 h-5" />,
      badge: hasMorningAlerts ? '!' : pendingTasksCount > 0 ? pendingTasksCount : undefined
    },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> }
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-950/90 backdrop-blur-2xl border-t border-slate-800/80 px-4 py-2">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-200 ${
                isActive
                  ? 'text-cyan-400 font-semibold scale-105'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="relative">
                {tab.icon}
                {tab.badge !== undefined && (
                  <span
                    className={`absolute -top-1.5 -right-2 text-[10px] font-bold px-1.5 py-0.2 rounded-full flex items-center justify-center min-w-[18px] h-[18px] ${
                      tab.badge === '!'
                        ? 'bg-amber-500 text-slate-950 animate-bounce'
                        : 'bg-cyan-500 text-slate-950'
                    }`}
                  >
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className="text-[11px] tracking-tight">{tab.label}</span>
              {isActive && (
                <div className="absolute -bottom-1 w-8 h-1 bg-gradient-to-r from-cyan-400 to-indigo-500 rounded-full shadow-lg shadow-cyan-500/50" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
