import { Task, Goal, Habit, WeeklyPlan, UserSettings, FocusSessionRecord } from '../types';
import { getTodayDateString, getCurrentWeekId } from '../utils/date';

export const INITIAL_USER_SETTINGS: UserSettings = {
  userName: 'You',
  theme: 'dark',
  soundEnabled: true,
  ambientSound: 'none',
  defaultFocusMinutes: 25,
  dailyGoalTarget: 3,
  subscriptionStatus: 'pending',
};

export function getEmptyWeeklyPlan(): WeeklyPlan {
  return {
    weekId: getCurrentWeekId(),
    mainGoals: [],
    importantTasks: [],
    habitFocus: [],
    personalPriorities: [],
    reflection: {
      wins: '',
      challenges: '',
      nextWeekFocus: '',
    },
  };
}

export function getInitialTasks(): Task[] {
  const today = getTodayDateString();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  const in3Days = new Date();
  in3Days.setDate(in3Days.getDate() + 3);
  const in3DaysStr = in3Days.toISOString().split('T')[0];

  return [
    {
      id: 'task-1',
      title: 'Finish client portfolio case study draft',
      notes: 'Focus only on the problem, architecture, and outcomes. Keep it under 600 words.',
      category: 'Career & Work',
      priority: 'High',
      dueDate: today,
      completed: false,
      isTopPriority: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-2',
      title: 'Schedule overdue dentist checkup & cleaning',
      notes: 'Call Dr. Bennett office (9am - 4pm). Check insurance copay.',
      category: 'Health & Mind',
      priority: 'High',
      dueDate: today,
      completed: false,
      isTopPriority: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-3',
      title: 'Audit recurring credit card subscriptions',
      notes: 'Cancel the 2 unused software trials before auto-renewal on the 15th.',
      category: 'Finance',
      priority: 'Medium',
      dueDate: today,
      completed: true,
      completedAt: today,
      isTopPriority: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-4',
      title: 'Clear desk clutter & setup clean workspace',
      notes: 'Put away papers, wipe monitor, fill water bottle for tomorrow morning.',
      category: 'Personal',
      priority: 'Low',
      dueDate: today,
      completed: false,
      isTopPriority: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-5',
      title: 'Submit quarterly estimated tax paperwork',
      notes: 'Everything is gathered in folder; just upload to accountant portal.',
      category: 'Errands & Admin',
      priority: 'High',
      dueDate: tomorrowStr,
      completed: false,
      isTopPriority: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-6',
      title: '30-minute outdoor walk without headphones',
      notes: 'Let mind decompress and disconnect from screen stimulation.',
      category: 'Health & Mind',
      priority: 'Medium',
      dueDate: tomorrowStr,
      completed: false,
      isTopPriority: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'task-7',
      title: 'Batch prep healthy lunches for next 3 days',
      notes: 'Quinoa bowls with roasted vegetables and chicken.',
      category: 'Health & Mind',
      priority: 'Medium',
      dueDate: in3DaysStr,
      completed: false,
      isTopPriority: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function getInitialGoals(): Goal[] {
  return [
    {
      id: 'goal-1',
      title: 'Build $6,000 Emergency Cash Reserve',
      category: 'Financial Freedom',
      deadline: '2026-12-31',
      whyItMatters: 'Relieves the chronic background anxiety of unexpected expenses and provides room to breathe.',
      createdAt: new Date().toISOString(),
      milestones: [
        { id: 'm-1-1', title: 'Audit last 3 months living expenses', completed: true, completedAt: '2026-09-15' },
        { id: 'm-1-2', title: 'Open dedicated high-yield savings account', completed: true, completedAt: '2026-09-20' },
        { id: 'm-1-3', title: 'Reach first milestone of $2,500 saved', completed: true, completedAt: '2026-10-01' },
        { id: 'm-1-4', title: 'Automate $450 direct deposit transfer every payday', completed: false },
        { id: 'm-1-5', title: 'Reach full $6,000 safety cushion', completed: false },
      ],
    },
    {
      id: 'goal-2',
      title: 'Launch Personal Portfolio & Case Studies',
      category: 'Career Growth',
      deadline: '2026-11-15',
      whyItMatters: 'Unlocks higher-paying freelance clients and builds long-term creative confidence.',
      createdAt: new Date().toISOString(),
      milestones: [
        { id: 'm-2-1', title: 'Select top 3 strongest projects to feature', completed: true, completedAt: '2026-09-28' },
        { id: 'm-2-2', title: 'Write 1-page outcome narratives for each project', completed: false },
        { id: 'm-2-3', title: 'Build clean responsive showcase website', completed: false },
        { id: 'm-2-4', title: 'Share publicly with 5 mentors for constructive critique', completed: false },
      ],
    },
    {
      id: 'goal-3',
      title: 'Reset Sleep Architecture & Reduce Brain Fog',
      category: 'Health & Mind',
      deadline: '2026-10-31',
      whyItMatters: 'When sleep is chaotic, willpower is exhausted before 10 AM. Rest fuels every other goal.',
      createdAt: new Date().toISOString(),
      milestones: [
        { id: 'm-3-1', title: 'No screens or bright blue lights past 10:30 PM', completed: true, completedAt: '2026-10-03' },
        { id: 'm-3-2', title: 'Consistent 11:00 PM sleep & 7:00 AM wake time for 10 straight days', completed: false },
        { id: 'm-3-3', title: '15 minutes morning sunlight before looking at social feeds', completed: false },
      ],
    },
  ];
}

export function getInitialHabits(): Habit[] {
  const today = getTodayDateString();
  const d1 = new Date(); d1.setDate(d1.getDate() - 1);
  const d1Str = d1.toISOString().split('T')[0];
  const d2 = new Date(); d2.setDate(d2.getDate() - 2);
  const d2Str = d2.toISOString().split('T')[0];
  const d3 = new Date(); d3.setDate(d3.getDate() - 3);
  const d3Str = d3.toISOString().split('T')[0];

  return [
    {
      id: 'habit-1',
      title: '10-Min Morning Sunlight & Breathing',
      category: 'Morning',
      frequency: 'Daily',
      completedDates: [d3Str, d2Str, d1Str, today],
      streak: 4,
      bestStreak: 12,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'habit-2',
      title: 'Drink 2 Liters of Clean Water',
      category: 'Body & Health',
      frequency: 'Daily',
      completedDates: [d2Str, d1Str],
      streak: 2,
      bestStreak: 8,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'habit-3',
      title: 'One 45-Min Deep Focus Block',
      category: 'Focus & Mind',
      frequency: 'Weekdays',
      completedDates: [d3Str, d2Str, d1Str, today],
      streak: 4,
      bestStreak: 9,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'habit-4',
      title: 'Evening 5-Min Desk Reset & Phone Docked',
      category: 'Evening',
      frequency: 'Daily',
      completedDates: [d3Str, d1Str],
      streak: 0,
      bestStreak: 6,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'habit-5',
      title: 'Weekly Budget Check-In',
      category: 'Focus & Mind',
      frequency: '3x/week',
      completedDates: [d2Str],
      streak: 1,
      bestStreak: 5,
      createdAt: new Date().toISOString(),
    },
  ];
}

export function getInitialWeeklyPlan(): WeeklyPlan {
  return {
    weekId: getCurrentWeekId(),
    mainGoals: [
      'Finalize the client portfolio case study draft without second-guessing',
      'Keep sleep routine steady (in bed by 11 PM 5 nights)',
      'Clear the administrative backlog of dentist + tax filing',
    ],
    importantTasks: [
      'Schedule dentist appointment',
      'Upload tax docs',
      'Finish case study draft',
      'Meal prep Sunday afternoon',
    ],
    habitFocus: [
      'Protect the first 45 minutes of the morning from dopamine apps',
      'Complete at least one 25-minute focus session every single weekday',
    ],
    personalPriorities: [
      'Do not say yes to new commitments until backlog is under 5 items',
      'Take real rest on the weekend without guilt',
    ],
    reflection: {
      wins: 'Started using the 5-minute rule instead of agonizing over big projects. Huge relief.',
      challenges: 'Felt an afternoon energy slump on Wednesday and scrolled Instagram for an hour.',
      nextWeekFocus: 'Schedule a 20-minute walk after lunch to beat the mid-day mental fog.',
    },
  };
}

export function getInitialFocusSessions(): FocusSessionRecord[] {
  const today = getTodayDateString();
  const d1 = new Date(); d1.setDate(d1.getDate() - 1);
  const d1Str = d1.toISOString().split('T')[0];

  return [
    {
      id: 'session-1',
      taskTitle: 'Portfolio case study draft',
      durationMinutes: 25,
      type: 'pomodoro',
      timestamp: `${today}T10:15:00Z`,
    },
    {
      id: 'session-2',
      taskTitle: 'Cancel software subscriptions',
      durationMinutes: 5,
      type: '5-minute',
      timestamp: `${today}T11:45:00Z`,
    },
    {
      id: 'session-3',
      taskTitle: 'Financial accounts reconciliation',
      durationMinutes: 50,
      type: 'deep-work',
      timestamp: `${d1Str}T14:30:00Z`,
    },
  ];
}

export const MOTIVATIONAL_REFLECTIONS = [
  "You don't need to feel ready to take action. Action creates readiness.",
  "You don't have to overhaul your whole life today. Just win the next 20 minutes.",
  "Procrastination is an emotional regulation problem, not a character flaw. Be gentle, then start small.",
  "Lower the bar until it feels absurdly easy to begin. Momentum will do the rest.",
  "Clarity follows engagement. You cannot think your way into taking action; you must act your way into clarity.",
  "Done is infinitely better than an unfinished masterpiece inside your head.",
  "A 5-minute start that actually happens beats a 4-hour plan that stays in your notes app.",
];
