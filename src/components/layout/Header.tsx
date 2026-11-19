import React from 'react';
import { Plus, Zap, Menu, Volume2, VolumeX, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { formatFullTodayDate } from '../../utils/date';
import { ViewType } from '../../types';

interface HeaderProps {
  onToggleMobileMenu: () => void;
}

const VIEW_TITLES: Record<ViewType, string> = {
  dashboard: 'Overview',
  today: 'Today',
  tasks: 'Tasks',
  goals: 'Goals & Milestones',
  habits: 'Daily Habits',
  weekly: 'Weekly Planner',
  'anti-procrastination': 'Anti-Procrastination Studio',
  'ai-assistant': 'Life Reset Assistant',
  progress: 'Progress & Insights',
  settings: 'Preferences',
};

export const Header: React.FC<HeaderProps> = ({ onToggleMobileMenu }) => {
  const { currentView, setCurrentView, openTaskModal, settings, updateSettings } = useApp();

  return (
    <header className="h-16 px-4 md:px-8 border-b border-neutral-200/80 dark:border-neutral-800 bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
      {/* Zone 1: Breadcrumb & Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleMobileMenu}
          className="lg:hidden p-2 -ml-2 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label="Open Navigation Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
          <span className="hidden sm:inline font-normal">Life Reset</span>
          <span className="hidden sm:inline" aria-hidden="true">/</span>
          <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {VIEW_TITLES[currentView]}
          </h1>
        </div>
      </div>

      {/* Zone 2: Date context (hidden on small screens) */}
      <div className="hidden md:flex items-center text-xs text-neutral-600 dark:text-neutral-300 font-medium">
        <span>{formatFullTodayDate()}</span>
      </div>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Sound toggle button */}
        <button
          onClick={() => updateSettings({ soundEnabled: !settings.soundEnabled })}
          className="p-2 text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          title={settings.soundEnabled ? 'Mute audio' : 'Enable audio'}
          aria-label={settings.soundEnabled ? 'Mute audio' : 'Enable audio'}
        >
          {settings.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* AI Assistant Button */}
        <button
          onClick={() => setCurrentView('ai-assistant')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
            currentView === 'ai-assistant'
              ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 border-transparent shadow-xs'
              : 'text-neutral-700 dark:text-neutral-300 bg-neutral-100/80 dark:bg-neutral-800 border-neutral-200/80 dark:border-neutral-700 hover:bg-neutral-200 dark:hover:bg-neutral-700'
          }`}
          title="Open AI Clarity Assistant"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-500" />
          <span className="hidden sm:inline">AI Clarity</span>
          <span className="sm:hidden">AI</span>
        </button>

        {/* Focus Mode button */}
        <button
          onClick={() => setCurrentView('anti-procrastination')}
          className="px-3 py-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 rounded-lg hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-colors flex items-center gap-1.5 whitespace-nowrap"
        >
          <Zap className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Focus Session</span>
          <span className="sm:hidden">Focus</span>
        </button>

        {/* Add Task button */}
        <button
          onClick={() => openTaskModal()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 dark:bg-neutral-100 dark:text-neutral-900 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors flex items-center gap-1.5 whitespace-nowrap shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Task</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>
    </header>
  );
};
