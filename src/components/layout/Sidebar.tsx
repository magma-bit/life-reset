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
  Plus,
  Sparkles,
  LogOut,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { ViewType } from '../../types';
import { getTodayDateString } from '../../utils/date';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

export const Sidebar: React.FC = () => {
  const { currentView, setCurrentView, tasks, openTaskModal, settings } = useApp();
  const { user, logOut } = useAuth();

  const todayStr = getTodayDateString();
  const todayTasks = tasks.filter(t => t.dueDate === todayStr);
  const pendingTodayCount = todayTasks.filter(t => !t.completed).length;

  const navItems: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'today', label: 'Today', icon: CalendarCheck, badge: pendingTodayCount > 0 ? pendingTodayCount : undefined },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'habits', label: 'Habits', icon: Flame },
    { id: 'weekly', label: 'Weekly Planner', icon: Calendar },
    { id: 'anti-procrastination', label: 'Anti-Procrastination', icon: Zap },
    { id: 'ai-assistant', label: 'AI Assistant', icon: Sparkles },
    { id: 'progress', label: 'Progress', icon: TrendingUp },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="hidden lg:flex w-64 flex-col border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/70 backdrop-blur-sm select-none shrink-0 h-screen sticky top-0">
      {/* Brand Zone */}
      <div className="p-6 border-b border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 flex items-center justify-center font-bold text-sm tracking-tighter shadow-sm">
              LR
            </div>
            <span className="font-semibold text-lg tracking-tight text-neutral-900 dark:text-neutral-100">
              Life Reset
            </span>
          </div>
          <p className="text-[11px] text-neutral-600 dark:text-neutral-300 mt-1">
            Focus · Action · Clarity
          </p>
        </div>
      </div>

      {/* Quick Action Button */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => openTaskModal()}
          className="w-full py-2.5 px-3 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-neutral-200 dark:text-neutral-900 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-2 space-y-0.5 overflow-y-auto">
        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-neutral-500 dark:text-neutral-400">
          Navigation
        </div>
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all group ${
                isActive
                  ? 'bg-neutral-200/70 dark:bg-neutral-800/80 text-neutral-950 dark:text-neutral-50 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-900/60'
              }`}
            >
              <div className="flex items-center gap-3 truncate">
                <Icon
                  className={`w-4 h-4 shrink-0 transition-colors ${
                    isActive
                      ? 'text-neutral-900 dark:text-neutral-100'
                      : 'text-neutral-500 dark:text-neutral-400 group-hover:text-neutral-900 dark:group-hover:text-neutral-200'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>
              {item.badge !== undefined && (
                <span className="tabular-nums text-[11px] font-semibold px-1.5 py-0.5 rounded text-neutral-600 dark:text-neutral-300 bg-neutral-200/80 dark:bg-neutral-800">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Bottom User & Mindset Anchor */}
      <div className="p-3 border-t border-neutral-200/80 dark:border-neutral-800 flex items-center justify-between gap-1">
        <button
          onClick={() => setCurrentView('settings')}
          className="flex-1 flex items-center gap-2.5 p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-900 text-left transition-colors min-w-0"
        >
          <div className="w-7 h-7 rounded-full bg-emerald-600/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 border border-emerald-600/20">
            {(user?.displayName || user?.email || settings.userName || 'U').charAt(0).toUpperCase()}
          </div>
          <div className="truncate flex-1">
            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {user?.displayName || settings.userName || 'You'}
            </div>
            <div className="flex items-center gap-1.5 truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 shadow-xs" title="Auto-saving to your cloud account" />
              <span className="text-[10px] text-neutral-400 truncate">
                {user?.email || 'Cloud Synced'}
              </span>
            </div>
          </div>
        </button>

        <button
          onClick={() => logOut()}
          className="p-2 text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
          title="Sign Out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};
