export type Priority = 'Low' | 'Medium' | 'High';

export type TaskCategory = 
  | 'Career & Work'
  | 'Personal'
  | 'Health & Mind'
  | 'Errands & Admin'
  | 'Finance'
  | 'Creative';

export interface Task {
  id: string;
  title: string;
  notes?: string;
  category: TaskCategory;
  priority: Priority;
  dueDate: string; // YYYY-MM-DD
  completed: boolean;
  completedAt?: string;
  isTopPriority?: boolean;
  createdAt: string;
}

export interface GoalMilestone {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  deadline: string;
  whyItMatters: string;
  milestones: GoalMilestone[];
  createdAt: string;
}

export type HabitFrequency = 'Daily' | 'Weekdays' | '3x/week';
export type HabitCategory = 'Morning' | 'Body & Health' | 'Focus & Mind' | 'Evening';

export interface Habit {
  id: string;
  title: string;
  category: HabitCategory;
  frequency: HabitFrequency;
  completedDates: string[]; // ['2026-10-07', ...]
  streak: number;
  bestStreak: number;
  createdAt: string;
}

export interface WeeklyReflection {
  wins: string;
  challenges: string;
  nextWeekFocus: string;
}

export interface WeeklyPlan {
  weekId: string; // e.g. "2026-W41"
  mainGoals: string[];
  importantTasks: string[];
  habitFocus: string[];
  personalPriorities: string[];
  reflection: WeeklyReflection;
}

export interface DailyNote {
  date: string;
  content: string;
  mood?: 'calm' | 'focused' | 'overwhelmed' | 'restless' | 'proud';
}

export interface FocusSessionRecord {
  id: string;
  taskTitle: string;
  durationMinutes: number;
  type: '5-minute' | 'pomodoro' | 'deep-work' | 'custom';
  timestamp: string;
}

export type AppTheme = 'stone' | 'slate' | 'sage' | 'dark';

export type SubscriptionStatus = 'pending' | 'active' | 'cancelled' | 'expired' | 'paused';

export interface UserSubscription {
  status: SubscriptionStatus;
  planId: string; // e.g. 'life-reset-all-access'
  planTitle: string; // 'Life Reset Full Access'
  priceIntro: number; // 9.99 USD
  priceRecurring: number; // 14.99 USD
  currency: string; // 'USD'
  billingInterval: 'month';
  billingAnchorDay?: number | null;
  currentPeriodEnd?: string | null;
  gracePeriodEnd?: string | null;
  lastPaidOrderId?: string | null;
  cancelAtPeriodEnd?: boolean;
  shopifyCustomerId?: string | null;
  initialOrderId?: string | null;
  customerBindingProof?: string | null;
  shopifySubscriptionId?: string | null;
  shopifyOrderId?: string | null;
  checkoutUrl?: string | null;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt?: string;
}

export interface UserSettings {
  userName: string;
  theme: AppTheme;
  soundEnabled: boolean;
  ambientSound: 'none' | 'rain' | 'white-noise' | 'brown-noise';
  defaultFocusMinutes: number;
  dailyGoalTarget: number;
  subscriptionStatus?: SubscriptionStatus;
  subscription?: UserSubscription;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedTasks?: string[];
}

export type ViewType = 
  | 'dashboard'
  | 'today'
  | 'tasks'
  | 'goals'
  | 'habits'
  | 'weekly'
  | 'anti-procrastination'
  | 'ai-assistant'
  | 'progress'
  | 'settings';
