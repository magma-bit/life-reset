import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import {
  Task,
  Goal,
  Habit,
  WeeklyPlan,
  UserSettings,
  FocusSessionRecord,
  DailyNote,
  ViewType,
} from '../types';
import { useAuth } from './AuthContext';
import { db } from '../services/firebase';
import { StorageService } from '../services/storage';
import { cleanForFirestore } from '../utils/firestoreClean';
import { audioManager } from '../utils/audio';
import { calculateHabitStreak, getTodayDateString } from '../utils/date';
import {
  INITIAL_USER_SETTINGS,
  getEmptyWeeklyPlan,
  getInitialTasks,
  getInitialGoals,
  getInitialHabits,
  getInitialWeeklyPlan,
  getInitialFocusSessions,
} from '../services/sampleData';

interface AppContextType {
  currentView: ViewType;
  setCurrentView: (view: ViewType) => void;
  // Tasks
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  deleteTask: (id: string) => void;
  toggleTaskComplete: (id: string) => void;
  toggleTaskTopPriority: (id: string) => void;
  // Goals
  goals: Goal[];
  addGoal: (goal: Omit<Goal, 'id' | 'createdAt'>) => void;
  updateGoal: (id: string, updates: Partial<Goal>) => void;
  deleteGoal: (id: string) => void;
  toggleMilestone: (goalId: string, milestoneId: string) => void;
  addMilestone: (goalId: string, title: string) => void;
  deleteMilestone: (goalId: string, milestoneId: string) => void;
  // Habits
  habits: Habit[];
  addHabit: (habit: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak' | 'completedDates'>) => void;
  updateHabit: (id: string, updates: Partial<Habit>) => void;
  deleteHabit: (id: string) => void;
  toggleHabitDay: (habitId: string, dateStr: string) => void;
  // Weekly Planner
  weeklyPlan: WeeklyPlan;
  updateWeeklyPlan: (updates: Partial<WeeklyPlan>) => void;
  // Daily Notes
  dailyNotes: Record<string, DailyNote>;
  saveDailyNote: (dateStr: string, content: string, mood?: DailyNote['mood']) => void;
  // Focus sessions
  focusSessions: FocusSessionRecord[];
  recordFocusSession: (session: Omit<FocusSessionRecord, 'id' | 'timestamp'>) => void;
  // Settings
  settings: UserSettings;
  updateSettings: (updates: Partial<UserSettings>) => void;
  resetAllData: () => void;
  restoreSampleData: () => void;
  // Modals & Quick actions
  isTaskModalOpen: boolean;
  taskToEdit: Task | null;
  openTaskModal: (task?: Task) => void;
  closeTaskModal: () => void;
  activeFocusTask: Task | null;
  setActiveFocusTask: (task: Task | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();

  const [currentView, setCurrentView] = useState<ViewType>('dashboard');
  const [settings, setSettings] = useState<UserSettings>(INITIAL_USER_SETTINGS);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [weeklyPlan, setWeeklyPlan] = useState<WeeklyPlan>(getEmptyWeeklyPlan());
  const [dailyNotes, setDailyNotes] = useState<Record<string, DailyNote>>({});
  const [focusSessions, setFocusSessions] = useState<FocusSessionRecord[]>([]);

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [taskToEdit, setTaskToEdit] = useState<Task | null>(null);
  const [activeFocusTask, setActiveFocusTask] = useState<Task | null>(null);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.classList.remove('theme-stone', 'theme-slate', 'theme-sage', 'theme-dark');
    document.documentElement.classList.add(`theme-${settings.theme}`);
    if (settings.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings.theme]);

  // Real-time synchronization with Firestore subcollections per authenticated user
  useEffect(() => {
    if (!user) {
      // User logged out: clear state completely so no cross-user data leakage occurs
      setTasks([]);
      setGoals([]);
      setHabits([]);
      setWeeklyPlan(getEmptyWeeklyPlan());
      setDailyNotes({});
      setFocusSessions([]);
      setSettings(INITIAL_USER_SETTINGS);
      return;
    }

    const uid = user.uid;

    // 1. Immediately hydrate from user-scoped storage for instant zero-latency feedback
    const cachedTasks = StorageService.getUserTasks(uid);
    const cachedGoals = StorageService.getUserGoals(uid);
    const cachedHabits = StorageService.getUserHabits(uid);
    const cachedWeekly = StorageService.getUserWeeklyPlan(uid);
    const cachedNotes = StorageService.getUserDailyNotes(uid);
    const cachedSessions = StorageService.getUserFocusSessions(uid);
    const cachedSettings = StorageService.getUserSettings(uid);

    if (cachedTasks && cachedTasks.length > 0) setTasks(cachedTasks);
    if (cachedGoals && cachedGoals.length > 0) setGoals(cachedGoals);
    if (cachedHabits && cachedHabits.length > 0) setHabits(cachedHabits);
    if (cachedWeekly && cachedWeekly.weekId) setWeeklyPlan(cachedWeekly);
    if (cachedNotes && Object.keys(cachedNotes).length > 0) setDailyNotes(cachedNotes);
    if (cachedSessions && cachedSessions.length > 0) setFocusSessions(cachedSessions);
    if (cachedSettings && cachedSettings.userName) setSettings(cachedSettings);

    // 2. Settings listener
    const userDocRef = doc(db, 'users', uid);
    const unsubSettings = onSnapshot(
      userDocRef,
      snap => {
        if (snap.exists()) {
          const data = snap.data();
          const nextSettings: UserSettings = {
            ...settings,
            userName: data.displayName || user.displayName || 'You',
            theme: data.theme || 'dark',
            soundEnabled: data.soundEnabled !== undefined ? data.soundEnabled : true,
          };
          setSettings(nextSettings);
          StorageService.saveUserSettings(uid, nextSettings);
        }
      },
      err => {
        console.warn('Settings listener notice:', err.message);
      }
    );

    // 3. Tasks listener
    const tasksColRef = collection(db, 'users', uid, 'tasks');
    const unsubTasks = onSnapshot(
      tasksColRef,
      snap => {
        const items = snap.docs.map(d => d.data() as Task);
        setTasks(items);
        StorageService.saveUserTasks(uid, items);
      },
      err => {
        console.warn('Tasks listener notice:', err.message);
      }
    );

    // 4. Goals listener
    const goalsColRef = collection(db, 'users', uid, 'goals');
    const unsubGoals = onSnapshot(
      goalsColRef,
      snap => {
        const items = snap.docs.map(d => d.data() as Goal);
        setGoals(items);
        StorageService.saveUserGoals(uid, items);
      },
      err => {
        console.warn('Goals listener notice:', err.message);
      }
    );

    // 5. Habits listener
    const habitsColRef = collection(db, 'users', uid, 'habits');
    const unsubHabits = onSnapshot(
      habitsColRef,
      snap => {
        const items = snap.docs.map(d => d.data() as Habit);
        setHabits(items);
        StorageService.saveUserHabits(uid, items);
      },
      err => {
        console.warn('Habits listener notice:', err.message);
      }
    );

    // 6. Weekly plan listener
    const weeklyPlansColRef = collection(db, 'users', uid, 'weeklyPlans');
    const unsubWeekly = onSnapshot(
      weeklyPlansColRef,
      snap => {
        if (!snap.empty) {
          const latest = snap.docs[0].data() as WeeklyPlan;
          setWeeklyPlan(latest);
          StorageService.saveUserWeeklyPlan(uid, latest);
        }
      },
      err => {
        console.warn('Weekly plan listener notice:', err.message);
      }
    );

    // 7. Daily notes listener
    const notesColRef = collection(db, 'users', uid, 'dailyNotes');
    const unsubNotes = onSnapshot(
      notesColRef,
      snap => {
        const notesMap: Record<string, DailyNote> = {};
        snap.docs.forEach(d => {
          const note = d.data() as DailyNote;
          if (note.date) notesMap[note.date] = note;
        });
        setDailyNotes(notesMap);
        StorageService.saveUserDailyNotes(uid, notesMap);
      },
      err => {
        console.warn('Daily notes listener notice:', err.message);
      }
    );

    // 8. Focus sessions listener
    const sessionsColRef = collection(db, 'users', uid, 'focusSessions');
    const unsubSessions = onSnapshot(
      sessionsColRef,
      snap => {
        const items = snap.docs.map(d => d.data() as FocusSessionRecord);
        items.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
        setFocusSessions(items);
        StorageService.saveUserFocusSessions(uid, items);
      },
      err => {
        console.warn('Focus sessions listener notice:', err.message);
      }
    );

    return () => {
      unsubSettings();
      unsubTasks();
      unsubGoals();
      unsubHabits();
      unsubWeekly();
      unsubNotes();
      unsubSessions();
    };
  }, [user]);

  // Task Actions
  const addTask = async (newTask: Omit<Task, 'id' | 'createdAt'>) => {
    const id = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const task: Task = {
      ...newTask,
      id,
      createdAt: new Date().toISOString(),
    };

    setTasks(prev => {
      const next = [task, ...prev];
      if (user) StorageService.saveUserTasks(user.uid, next);
      return next;
    });
    audioManager.playClick(settings.soundEnabled);

    if (user) {
      try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', id);
        const payload = cleanForFirestore({ ...task, userId: user.uid });
        await setDoc(taskRef, payload);
      } catch (err) {
        console.error('Failed to save task to Firestore:', err);
      }
    }
  };

  const updateTask = async (id: string, updates: Partial<Task>) => {
    setTasks(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, ...updates } : t));
      if (user) StorageService.saveUserTasks(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', id);
        const payload = cleanForFirestore(updates);
        await setDoc(taskRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to update task in Firestore:', err);
      }
    }
  };

  const deleteTask = async (id: string) => {
    setTasks(prev => {
      const next = prev.filter(t => t.id !== id);
      if (user) StorageService.saveUserTasks(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', id);
        await deleteDoc(taskRef);
      } catch (err) {
        console.error('Failed to delete task from Firestore:', err);
      }
    }
  };

  const toggleTaskComplete = async (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;

    const willBeCompleted = !target.completed;
    if (willBeCompleted) {
      audioManager.playClick(settings.soundEnabled);
    }

    const updates: Partial<Task> = {
      completed: willBeCompleted,
      completedAt: willBeCompleted ? getTodayDateString() : '',
    };

    setTasks(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, ...updates } : t));
      if (user) StorageService.saveUserTasks(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', id);
        const payload = cleanForFirestore(updates);
        await setDoc(taskRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to update task completion in Firestore:', err);
      }
    }
  };

  const toggleTaskTopPriority = async (id: string) => {
    const target = tasks.find(t => t.id === id);
    if (!target) return;

    const updates = { isTopPriority: !target.isTopPriority };
    setTasks(prev => {
      const next = prev.map(t => (t.id === id ? { ...t, ...updates } : t));
      if (user) StorageService.saveUserTasks(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const taskRef = doc(db, 'users', user.uid, 'tasks', id);
        const payload = cleanForFirestore(updates);
        await setDoc(taskRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to update task priority in Firestore:', err);
      }
    }
  };

  // Goal Actions
  const addGoal = async (newGoal: Omit<Goal, 'id' | 'createdAt'>) => {
    const id = `goal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const goal: Goal = {
      ...newGoal,
      id,
      createdAt: new Date().toISOString(),
    };

    setGoals(prev => {
      const next = [goal, ...prev];
      if (user) StorageService.saveUserGoals(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const goalRef = doc(db, 'users', user.uid, 'goals', id);
        const payload = cleanForFirestore({ ...goal, userId: user.uid });
        await setDoc(goalRef, payload);
      } catch (err) {
        console.error('Failed to save goal to Firestore:', err);
      }
    }
  };

  const updateGoal = async (id: string, updates: Partial<Goal>) => {
    setGoals(prev => {
      const next = prev.map(g => (g.id === id ? { ...g, ...updates } : g));
      if (user) StorageService.saveUserGoals(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const goalRef = doc(db, 'users', user.uid, 'goals', id);
        const payload = cleanForFirestore(updates);
        await setDoc(goalRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to update goal in Firestore:', err);
      }
    }
  };

  const deleteGoal = async (id: string) => {
    setGoals(prev => {
      const next = prev.filter(g => g.id !== id);
      if (user) StorageService.saveUserGoals(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const goalRef = doc(db, 'users', user.uid, 'goals', id);
        await deleteDoc(goalRef);
      } catch (err) {
        console.error('Failed to delete goal from Firestore:', err);
      }
    }
  };

  const toggleMilestone = async (goalId: string, milestoneId: string) => {
    const target = goals.find(g => g.id === goalId);
    if (!target) return;

    const updatedMilestones = target.milestones.map(m => {
      if (m.id === milestoneId) {
        const nextComp = !m.completed;
        if (nextComp) {
          audioManager.playClick(settings.soundEnabled);
        }
        return {
          ...m,
          completed: nextComp,
          completedAt: nextComp ? getTodayDateString() : '',
        };
      }
      return m;
    });

    setGoals(prev => {
      const next = prev.map(g => (g.id === goalId ? { ...g, milestones: updatedMilestones } : g));
      if (user) StorageService.saveUserGoals(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
        const payload = cleanForFirestore({ milestones: updatedMilestones });
        await setDoc(goalRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to toggle milestone in Firestore:', err);
      }
    }
  };

  const addMilestone = async (goalId: string, title: string) => {
    if (!title.trim()) return;
    const target = goals.find(g => g.id === goalId);
    if (!target) return;

    const newMilestone = {
      id: `m-${Date.now()}`,
      title: title.trim(),
      completed: false,
    };

    const nextMilestones = [...target.milestones, newMilestone];
    setGoals(prev => {
      const next = prev.map(g => (g.id === goalId ? { ...g, milestones: nextMilestones } : g));
      if (user) StorageService.saveUserGoals(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
        const payload = cleanForFirestore({ milestones: nextMilestones });
        await setDoc(goalRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to add milestone in Firestore:', err);
      }
    }
  };

  const deleteMilestone = async (goalId: string, milestoneId: string) => {
    const target = goals.find(g => g.id === goalId);
    if (!target) return;

    const nextMilestones = target.milestones.filter(m => m.id !== milestoneId);
    setGoals(prev => {
      const next = prev.map(g => (g.id === goalId ? { ...g, milestones: nextMilestones } : g));
      if (user) StorageService.saveUserGoals(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const goalRef = doc(db, 'users', user.uid, 'goals', goalId);
        const payload = cleanForFirestore({ milestones: nextMilestones });
        await setDoc(goalRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to delete milestone in Firestore:', err);
      }
    }
  };

  // Habit Actions
  const addHabit = async (
    newHabit: Omit<Habit, 'id' | 'createdAt' | 'streak' | 'bestStreak' | 'completedDates'>
  ) => {
    const id = `habit-${Date.now()}`;
    const habit: Habit = {
      ...newHabit,
      id,
      streak: 0,
      bestStreak: 0,
      completedDates: [],
      createdAt: new Date().toISOString(),
    };

    setHabits(prev => {
      const next = [...prev, habit];
      if (user) StorageService.saveUserHabits(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const habitRef = doc(db, 'users', user.uid, 'habits', id);
        const payload = cleanForFirestore({ ...habit, userId: user.uid });
        await setDoc(habitRef, payload);
      } catch (err) {
        console.error('Failed to save habit to Firestore:', err);
      }
    }
  };

  const updateHabit = async (id: string, updates: Partial<Habit>) => {
    setHabits(prev => {
      const next = prev.map(h => (h.id === id ? { ...h, ...updates } : h));
      if (user) StorageService.saveUserHabits(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const habitRef = doc(db, 'users', user.uid, 'habits', id);
        const payload = cleanForFirestore(updates);
        await setDoc(habitRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to update habit in Firestore:', err);
      }
    }
  };

  const deleteHabit = async (id: string) => {
    setHabits(prev => {
      const next = prev.filter(h => h.id !== id);
      if (user) StorageService.saveUserHabits(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const habitRef = doc(db, 'users', user.uid, 'habits', id);
        await deleteDoc(habitRef);
      } catch (err) {
        console.error('Failed to delete habit from Firestore:', err);
      }
    }
  };

  const toggleHabitDay = async (habitId: string, dateStr: string) => {
    const target = habits.find(h => h.id === habitId);
    if (!target) return;

    const exists = target.completedDates.includes(dateStr);
    const nextDates = exists
      ? target.completedDates.filter(d => d !== dateStr)
      : [...target.completedDates, dateStr];

    if (!exists) {
      audioManager.playClick(settings.soundEnabled);
    }

    const newStreak = calculateHabitStreak(nextDates);
    const newBestStreak = Math.max(target.bestStreak, newStreak);

    const updates = {
      completedDates: nextDates,
      streak: newStreak,
      bestStreak: newBestStreak,
    };

    setHabits(prev => {
      const next = prev.map(h => (h.id === habitId ? { ...h, ...updates } : h));
      if (user) StorageService.saveUserHabits(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const habitRef = doc(db, 'users', user.uid, 'habits', habitId);
        const payload = cleanForFirestore(updates);
        await setDoc(habitRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to toggle habit day in Firestore:', err);
      }
    }
  };

  // Weekly Planner
  const updateWeeklyPlan = async (updates: Partial<WeeklyPlan>) => {
    const updated = { ...weeklyPlan, ...updates };
    setWeeklyPlan(updated);
    if (user) StorageService.saveUserWeeklyPlan(user.uid, updated);

    if (user) {
      try {
        const docId = updated.weekId || 'current';
        const planRef = doc(db, 'users', user.uid, 'weeklyPlans', docId);
        const payload = cleanForFirestore({ ...updated, userId: user.uid });
        await setDoc(planRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to update weekly plan in Firestore:', err);
      }
    }
  };

  // Daily Notes
  const saveDailyNote = async (dateStr: string, content: string, mood?: DailyNote['mood']) => {
    const note: DailyNote = {
      date: dateStr,
      content,
      mood: mood || dailyNotes[dateStr]?.mood,
    };

    setDailyNotes(prev => {
      const next = { ...prev, [dateStr]: note };
      if (user) StorageService.saveUserDailyNotes(user.uid, next);
      return next;
    });

    if (user) {
      try {
        const noteRef = doc(db, 'users', user.uid, 'dailyNotes', dateStr);
        const payload = cleanForFirestore({ ...note, userId: user.uid });
        await setDoc(noteRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to save daily note in Firestore:', err);
      }
    }
  };

  // Focus Sessions
  const recordFocusSession = async (session: Omit<FocusSessionRecord, 'id' | 'timestamp'>) => {
    const id = `session-${Date.now()}`;
    const record: FocusSessionRecord = {
      ...session,
      id,
      timestamp: new Date().toISOString(),
    };

    setFocusSessions(prev => {
      const next = [record, ...prev];
      if (user) StorageService.saveUserFocusSessions(user.uid, next);
      return next;
    });
    audioManager.playBell(settings.soundEnabled);

    if (user) {
      try {
        const sessionRef = doc(db, 'users', user.uid, 'focusSessions', id);
        const payload = cleanForFirestore({ ...record, userId: user.uid });
        await setDoc(sessionRef, payload);
      } catch (err) {
        console.error('Failed to save focus session in Firestore:', err);
      }
    }
  };

  // Settings
  const updateSettings = async (updates: Partial<UserSettings>) => {
    const nextSettings = { ...settings, ...updates };
    setSettings(nextSettings);
    if (user) StorageService.saveUserSettings(user.uid, nextSettings);

    if (user) {
      try {
        const userRef = doc(db, 'users', user.uid);
        const payload = cleanForFirestore({
          displayName: nextSettings.userName,
          theme: nextSettings.theme,
          soundEnabled: nextSettings.soundEnabled,
          updatedAt: new Date().toISOString(),
        });
        await setDoc(userRef, payload, { merge: true });
      } catch (err) {
        console.error('Failed to update settings in Firestore:', err);
      }
    }
  };

  const resetAllData = async () => {
    setTasks([]);
    setGoals([]);
    setHabits([]);
    setWeeklyPlan(getEmptyWeeklyPlan());
    setDailyNotes({});
    setFocusSessions([]);

    if (user) {
      StorageService.clearUserData(user.uid);
      try {
        for (const t of tasks) {
          await deleteDoc(doc(db, 'users', user.uid, 'tasks', t.id));
        }
        for (const g of goals) {
          await deleteDoc(doc(db, 'users', user.uid, 'goals', g.id));
        }
        for (const h of habits) {
          await deleteDoc(doc(db, 'users', user.uid, 'habits', h.id));
        }
      } catch (err) {
        console.error('Error resetting Firestore documents', err);
      }
    }
  };

  const restoreSampleData = async () => {
    const sampleT = getInitialTasks();
    const sampleG = getInitialGoals();
    const sampleH = getInitialHabits();
    const sampleW = getInitialWeeklyPlan();
    const sampleS = getInitialFocusSessions();

    setTasks(sampleT);
    setGoals(sampleG);
    setHabits(sampleH);
    setWeeklyPlan(sampleW);
    setFocusSessions(sampleS);

    if (user) {
      StorageService.saveUserTasks(user.uid, sampleT);
      StorageService.saveUserGoals(user.uid, sampleG);
      StorageService.saveUserHabits(user.uid, sampleH);
      StorageService.saveUserWeeklyPlan(user.uid, sampleW);
      StorageService.saveUserFocusSessions(user.uid, sampleS);

      try {
        for (const t of sampleT) {
          await setDoc(doc(db, 'users', user.uid, 'tasks', t.id), cleanForFirestore({ ...t, userId: user.uid }));
        }
        for (const g of sampleG) {
          await setDoc(doc(db, 'users', user.uid, 'goals', g.id), cleanForFirestore({ ...g, userId: user.uid }));
        }
        for (const h of sampleH) {
          await setDoc(doc(db, 'users', user.uid, 'habits', h.id), cleanForFirestore({ ...h, userId: user.uid }));
        }
        if (sampleW) {
          await setDoc(doc(db, 'users', user.uid, 'weeklyPlans', sampleW.weekId), cleanForFirestore({ ...sampleW, userId: user.uid }));
        }
      } catch (err) {
        console.error('Error populating demo data into Firestore', err);
      }
    }
  };

  // Modals
  const openTaskModal = (task?: Task) => {
    setTaskToEdit(task || null);
    setIsTaskModalOpen(true);
  };

  const closeTaskModal = () => {
    setIsTaskModalOpen(false);
    setTaskToEdit(null);
  };

  return (
    <AppContext.Provider
      value={{
        currentView,
        setCurrentView,
        tasks,
        addTask,
        updateTask,
        deleteTask,
        toggleTaskComplete,
        toggleTaskTopPriority,
        goals,
        addGoal,
        updateGoal,
        deleteGoal,
        toggleMilestone,
        addMilestone,
        deleteMilestone,
        habits,
        addHabit,
        updateHabit,
        deleteHabit,
        toggleHabitDay,
        weeklyPlan,
        updateWeeklyPlan,
        dailyNotes,
        saveDailyNote,
        focusSessions,
        recordFocusSession,
        settings,
        updateSettings,
        resetAllData,
        restoreSampleData,
        isTaskModalOpen,
        taskToEdit,
        openTaskModal,
        closeTaskModal,
        activeFocusTask,
        setActiveFocusTask,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
