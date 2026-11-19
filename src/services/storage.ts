import { 
  Task, 
  Goal, 
  Habit, 
  WeeklyPlan, 
  UserSettings, 
  FocusSessionRecord, 
  DailyNote,
  ChatMessage 
} from '../types';
import { 
  INITIAL_USER_SETTINGS, 
  getEmptyWeeklyPlan, 
} from './sampleData';

const BASE_KEYS = {
  SETTINGS: 'lifereset_settings_v2',
  TASKS: 'lifereset_tasks_v2',
  GOALS: 'lifereset_goals_v2',
  HABITS: 'lifereset_habits_v2',
  WEEKLY: 'lifereset_weekly_v2',
  SESSIONS: 'lifereset_sessions_v2',
  DAILY_NOTES: 'lifereset_notes_v2',
  CHAT_MESSAGES: 'lifereset_chat_v2',
};

function safeGet<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`Error reading ${key} from localStorage`, err);
    return defaultValue;
  }
}

function safeSet<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error writing ${key} to localStorage`, err);
  }
}

export const StorageService = {
  // User-scoped keys
  getUserTasks(userId: string): Task[] {
    return safeGet<Task[]>(`lifereset_${userId}_tasks`, []);
  },
  saveUserTasks(userId: string, tasks: Task[]): void {
    safeSet(`lifereset_${userId}_tasks`, tasks);
  },

  getUserGoals(userId: string): Goal[] {
    return safeGet<Goal[]>(`lifereset_${userId}_goals`, []);
  },
  saveUserGoals(userId: string, goals: Goal[]): void {
    safeSet(`lifereset_${userId}_goals`, goals);
  },

  getUserHabits(userId: string): Habit[] {
    return safeGet<Habit[]>(`lifereset_${userId}_habits`, []);
  },
  saveUserHabits(userId: string, habits: Habit[]): void {
    safeSet(`lifereset_${userId}_habits`, habits);
  },

  getUserWeeklyPlan(userId: string): WeeklyPlan {
    return safeGet<WeeklyPlan>(`lifereset_${userId}_weekly`, getEmptyWeeklyPlan());
  },
  saveUserWeeklyPlan(userId: string, plan: WeeklyPlan): void {
    safeSet(`lifereset_${userId}_weekly`, plan);
  },

  getUserDailyNotes(userId: string): Record<string, DailyNote> {
    return safeGet<Record<string, DailyNote>>(`lifereset_${userId}_notes`, {});
  },
  saveUserDailyNotes(userId: string, notes: Record<string, DailyNote>): void {
    safeSet(`lifereset_${userId}_notes`, notes);
  },

  getUserFocusSessions(userId: string): FocusSessionRecord[] {
    return safeGet<FocusSessionRecord[]>(`lifereset_${userId}_sessions`, []);
  },
  saveUserFocusSessions(userId: string, sessions: FocusSessionRecord[]): void {
    safeSet(`lifereset_${userId}_sessions`, sessions);
  },

  getUserSettings(userId: string): UserSettings {
    return safeGet<UserSettings>(`lifereset_${userId}_settings`, INITIAL_USER_SETTINGS);
  },
  saveUserSettings(userId: string, settings: UserSettings): void {
    safeSet(`lifereset_${userId}_settings`, settings);
  },

  getUserChat(userId: string): ChatMessage[] {
    return safeGet<ChatMessage[]>(`lifereset_${userId}_chat`, []);
  },
  saveUserChat(userId: string, messages: ChatMessage[]): void {
    safeSet(`lifereset_${userId}_chat`, messages);
  },

  // Fallback / legacy methods
  getSettings(): UserSettings {
    return safeGet<UserSettings>(BASE_KEYS.SETTINGS, INITIAL_USER_SETTINGS);
  },
  saveSettings(settings: UserSettings): void {
    safeSet(BASE_KEYS.SETTINGS, settings);
  },

  getTasks(): Task[] {
    return safeGet<Task[]>(BASE_KEYS.TASKS, []);
  },
  saveTasks(tasks: Task[]): void {
    safeSet(BASE_KEYS.TASKS, tasks);
  },

  getGoals(): Goal[] {
    return safeGet<Goal[]>(BASE_KEYS.GOALS, []);
  },
  saveGoals(goals: Goal[]): void {
    safeSet(BASE_KEYS.GOALS, goals);
  },

  getHabits(): Habit[] {
    return safeGet<Habit[]>(BASE_KEYS.HABITS, []);
  },
  saveHabits(habits: Habit[]): void {
    safeSet(BASE_KEYS.HABITS, habits);
  },

  getWeeklyPlan(): WeeklyPlan {
    return safeGet<WeeklyPlan>(BASE_KEYS.WEEKLY, getEmptyWeeklyPlan());
  },
  saveWeeklyPlan(plan: WeeklyPlan): void {
    safeSet(BASE_KEYS.WEEKLY, plan);
  },

  getFocusSessions(): FocusSessionRecord[] {
    return safeGet<FocusSessionRecord[]>(BASE_KEYS.SESSIONS, []);
  },
  saveFocusSessions(sessions: FocusSessionRecord[]): void {
    safeSet(BASE_KEYS.SESSIONS, sessions);
  },

  getDailyNotes(): Record<string, DailyNote> {
    return safeGet<Record<string, DailyNote>>(BASE_KEYS.DAILY_NOTES, {});
  },
  saveDailyNotes(notes: Record<string, DailyNote>): void {
    safeSet(BASE_KEYS.DAILY_NOTES, notes);
  },

  getChatMessages(): ChatMessage[] {
    return safeGet<ChatMessage[]>(BASE_KEYS.CHAT_MESSAGES, []);
  },
  saveChatMessages(messages: ChatMessage[]): void {
    safeSet(BASE_KEYS.CHAT_MESSAGES, messages);
  },

  clearUserData(userId: string): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(`lifereset_${userId}_tasks`);
      localStorage.removeItem(`lifereset_${userId}_goals`);
      localStorage.removeItem(`lifereset_${userId}_habits`);
      localStorage.removeItem(`lifereset_${userId}_weekly`);
      localStorage.removeItem(`lifereset_${userId}_notes`);
      localStorage.removeItem(`lifereset_${userId}_sessions`);
      localStorage.removeItem(`lifereset_${userId}_settings`);
      localStorage.removeItem(`lifereset_${userId}_chat`);
    } catch (err) {
      console.error('Failed to clear user data', err);
    }
  },

  resetAllData(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.removeItem(BASE_KEYS.SETTINGS);
      localStorage.removeItem(BASE_KEYS.TASKS);
      localStorage.removeItem(BASE_KEYS.GOALS);
      localStorage.removeItem(BASE_KEYS.HABITS);
      localStorage.removeItem(BASE_KEYS.WEEKLY);
      localStorage.removeItem(BASE_KEYS.SESSIONS);
      localStorage.removeItem(BASE_KEYS.DAILY_NOTES);
      localStorage.removeItem(BASE_KEYS.CHAT_MESSAGES);
    } catch (err) {
      console.error('Failed to clear storage', err);
    }
  },

  exportAllDataJson(userId?: string): string {
    const data = {
      settings: userId ? this.getUserSettings(userId) : this.getSettings(),
      tasks: userId ? this.getUserTasks(userId) : this.getTasks(),
      goals: userId ? this.getUserGoals(userId) : this.getGoals(),
      habits: userId ? this.getUserHabits(userId) : this.getHabits(),
      weekly: userId ? this.getUserWeeklyPlan(userId) : this.getWeeklyPlan(),
      sessions: userId ? this.getUserFocusSessions(userId) : this.getFocusSessions(),
      notes: userId ? this.getUserDailyNotes(userId) : this.getDailyNotes(),
      exportedAt: new Date().toISOString(),
      appVersion: '1.0.0',
    };
    return JSON.stringify(data, null, 2);
  },

  importDataJson(jsonString: string, userId?: string): boolean {
    try {
      const data = JSON.parse(jsonString);
      if (userId) {
        if (data.settings) this.saveUserSettings(userId, data.settings);
        if (data.tasks) this.saveUserTasks(userId, data.tasks);
        if (data.goals) this.saveUserGoals(userId, data.goals);
        if (data.habits) this.saveUserHabits(userId, data.habits);
        if (data.weekly) this.saveUserWeeklyPlan(userId, data.weekly);
        if (data.sessions) this.saveUserFocusSessions(userId, data.sessions);
        if (data.notes) this.saveUserDailyNotes(userId, data.notes);
      } else {
        if (data.settings) this.saveSettings(data.settings);
        if (data.tasks) this.saveTasks(data.tasks);
        if (data.goals) this.saveGoals(data.goals);
        if (data.habits) this.saveHabits(data.habits);
        if (data.weekly) this.saveWeeklyPlan(data.weekly);
        if (data.sessions) this.saveFocusSessions(data.sessions);
        if (data.notes) this.saveDailyNotes(data.notes);
      }
      return true;
    } catch (err) {
      console.error('Failed to import JSON data', err);
      return false;
    }
  },
};
