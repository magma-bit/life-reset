import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SubscriptionProvider, useSubscription } from './context/SubscriptionContext';
import { AppProvider, useApp } from './context/AppContext';
import { AuthView } from './components/auth/AuthView';
import { SubscriptionView } from './components/subscription/SubscriptionView';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { MobileNav } from './components/layout/MobileNav';
import { TaskModal } from './components/modals/TaskModal';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { TodayView } from './components/today/TodayView';
import { TasksView } from './components/tasks/TasksView';
import { GoalsView } from './components/goals/GoalsView';
import { HabitsView } from './components/habits/HabitsView';
import { WeeklyPlannerView } from './components/weekly/WeeklyPlannerView';
import { AntiProcrastinationView } from './components/antiprocrastination/AntiProcrastinationView';
import { AiAssistantView } from './components/assistant/AiAssistantView';
import { ProgressView } from './components/progress/ProgressView';
import { SettingsView } from './components/settings/SettingsView';

const AuthenticatedApp: React.FC = () => {
  const { currentView } = useApp();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex text-neutral-900 dark:text-neutral-100 transition-colors duration-200">
      {/* Desktop Left Sidebar */}
      <Sidebar />

      {/* Mobile Drawer */}
      <MobileNav
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />

      {/* Primary Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden">
        {/* Top Header */}
        <Header onToggleMobileMenu={() => setIsMobileMenuOpen(true)} />

        {/* View Router */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto animate-in fade-in duration-150">
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'today' && <TodayView />}
          {currentView === 'tasks' && <TasksView />}
          {currentView === 'goals' && <GoalsView />}
          {currentView === 'habits' && <HabitsView />}
          {currentView === 'weekly' && <WeeklyPlannerView />}
          {currentView === 'anti-procrastination' && <AntiProcrastinationView />}
          {currentView === 'ai-assistant' && <AiAssistantView />}
          {currentView === 'progress' && <ProgressView />}
          {currentView === 'settings' && <SettingsView />}
        </main>
      </div>

      {/* Global Task Creation/Editing Modal */}
      <TaskModal />
    </div>
  );
};

/**
 * Access Control Gate:
 * Enforces server-authoritative paid subscription access.
 * Only users with a verified active subscription can enter the main app.
 */
const SubscriptionAccessGate: React.FC = () => {
  const { hasActiveAccess, loading: checkingSubscription } = useSubscription();

  if (checkingSubscription) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-950 text-neutral-100">
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 text-neutral-900 flex items-center justify-center font-bold text-lg mb-4 animate-pulse">
          LR
        </div>
        <p className="text-xs text-neutral-400 font-medium tracking-wide">
          Verifying server subscription access...
        </p>
      </div>
    );
  }

  // If user does not have an active subscription, display the polished subscription paywall
  if (!hasActiveAccess) {
    return <SubscriptionView />;
  }

  // Only mounted when server has verified active paid subscription
  return (
    <AppProvider>
      <AuthenticatedApp />
    </AppProvider>
  );
};

const RootGate: React.FC = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
        <div className="w-12 h-12 rounded-2xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 flex items-center justify-center font-bold text-lg mb-4 animate-pulse">
          LR
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 font-medium tracking-wide">
          Restoring your calm workspace...
        </p>
      </div>
    );
  }

  // Enforce authentication gate: show login/signup screen before entering app
  if (!user) {
    return <AuthView />;
  }

  return (
    <SubscriptionProvider>
      <SubscriptionAccessGate />
    </SubscriptionProvider>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RootGate />
    </AuthProvider>
  );
}
