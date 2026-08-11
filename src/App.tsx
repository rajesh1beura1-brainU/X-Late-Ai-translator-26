import React, { useState, useEffect } from 'react';
import { XLateProvider, useXLate } from './context/XLateContext';
import { Header } from './components/layout/Header';
import { Navigation } from './components/layout/Navigation';
import { HomeView } from './components/home/HomeView';
import { HistoryView } from './components/history/HistoryView';
import { TasksView } from './components/tasks/TasksView';
import { SettingsView } from './components/settings/SettingsView';
import { LyricsTranslatorView } from './components/lyrics/LyricsTranslatorView';
import { OnboardingModal } from './components/onboarding/OnboardingModal';

const AppContent: React.FC = () => {
  const { activeTab } = useXLate();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    const onboarded = localStorage.getItem('xlate_onboarded_v1');
    if (!onboarded) {
      setShowOnboarding(true);
    }
  }, []);

  const handleCompleteOnboarding = () => {
    localStorage.setItem('xlate_onboarded_v1', 'true');
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      
      {/* Onboarding Modal */}
      {showOnboarding && <OnboardingModal onComplete={handleCompleteOnboarding} />}

      {/* Top Header */}
      <Header />

      {/* Main Active Tab Content */}
      <main className="flex-1 pb-16">
        {activeTab === 'home' || activeTab === 'conversation' ? (
          <HomeView />
        ) : activeTab === 'lyrics' ? (
          <LyricsTranslatorView />
        ) : activeTab === 'history' ? (
          <HistoryView />
        ) : activeTab === 'tasks' ? (
          <TasksView />
        ) : (
          <SettingsView />
        )}
      </main>

      {/* Fixed Bottom Navigation */}
      <Navigation />

    </div>
  );
};

export default function App() {
  return (
    <XLateProvider>
      <AppContent />
    </XLateProvider>
  );
}
