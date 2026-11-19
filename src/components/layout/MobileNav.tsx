import React from 'react';
import {
  LayoutDashboard,
  CalendarCheck,
  CheckSquare,
  Target,
  Flame,
  Calendar,
  Zap,
  TrendingUp,
  Settings,
  X,
  Plus,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ViewType } from '../../types';

interface MobileNavProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ isOpen, onClose }) => {
  const { currentView, setCurrentView, openTaskModal, settings } = useApp();
  const { user, logOut } = useAuth();

  const navItems = [
    { id: 'dashboard' as ViewType, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'today' as ViewType, label: 'Today', icon: CalendarCheck },
    { id: 'tasks' as ViewType, label: 'Tasks', icon: CheckSquare },
    { id: 'goals' as ViewType, label: 'Goals', icon: Target },
    { id: 'habits' as ViewType, label: 'Habits', icon: Flame },
    { id: 'weekly' as ViewType, label: 'Weekly Planner', icon: Calendar },
    { id: 'anti-procrastination' as ViewType, label: 'Anti-Procrastination', icon: Zap },
    { id: 'ai-assistant' as ViewType, label: 'AI Assistant', icon: Sparkles },
    { id: 'progress' as ViewType, label: 'Progress', icon: TrendingUp },
    { id: 'settings' as ViewType, label: 'Settings', icon: Settings },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-neutral-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative w-72 max-w-[85vw] bg-white dark:bg-neutral-900 h-full flex flex-col shadow-2xl z-10">
        <div className="p-5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-xs">
              LR
            </div>
            <span className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
              Life Reset
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-md"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-neutral-100 dark:border-neutral-800/60">
          <button
            onClick={() => {
              onClose();
              openTaskModal();
            }}
            className="w-full py-2.5 px-3 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg text-xs font-medium flex items-center justify-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Task</span>
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(item => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setCurrentView(item.id);
                  onClose();
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-neutral-100 dark:bg-neutral-800 text-neutral-950 dark:text-neutral-50'
                    : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 flex items-center justify-between">
          <div className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
            <div>Signed in as:</div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-200 truncate">
              {user?.displayName || user?.email || settings.userName}
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              logOut();
            }}
            className="p-2 text-neutral-400 hover:text-rose-600 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
            title="Sign Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
