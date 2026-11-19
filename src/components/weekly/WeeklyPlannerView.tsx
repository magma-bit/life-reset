import React, { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Plus,
  Trash2,
  Save,
  Smile,
  Shield,
  Lightbulb,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export const WeeklyPlannerView: React.FC = () => {
  const { weeklyPlan, updateWeeklyPlan } = useApp();

  const [newGoal, setNewGoal] = useState('');
  const [newTask, setNewTask] = useState('');
  const [newHabitFocus, setNewHabitFocus] = useState('');
  const [newPersonalPriority, setNewPersonalPriority] = useState('');

  // Reflection states
  const [wins, setWins] = useState(weeklyPlan.reflection?.wins || '');
  const [challenges, setChallenges] = useState(weeklyPlan.reflection?.challenges || '');
  const [nextWeekFocus, setNextWeekFocus] = useState(weeklyPlan.reflection?.nextWeekFocus || '');
  const [savedMessage, setSavedMessage] = useState(false);

  // Sync if weeklyPlan updates
  React.useEffect(() => {
    if (weeklyPlan.reflection) {
      setWins(weeklyPlan.reflection.wins || '');
      setChallenges(weeklyPlan.reflection.challenges || '');
      setNextWeekFocus(weeklyPlan.reflection.nextWeekFocus || '');
    }
  }, [weeklyPlan]);

  const handleAddGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoal.trim()) return;
    updateWeeklyPlan({
      mainGoals: [...weeklyPlan.mainGoals, newGoal.trim()],
    });
    setNewGoal('');
  };

  const handleRemoveGoal = (idx: number) => {
    updateWeeklyPlan({
      mainGoals: weeklyPlan.mainGoals.filter((_, i) => i !== idx),
    });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    updateWeeklyPlan({
      importantTasks: [...weeklyPlan.importantTasks, newTask.trim()],
    });
    setNewTask('');
  };

  const handleRemoveTask = (idx: number) => {
    updateWeeklyPlan({
      importantTasks: weeklyPlan.importantTasks.filter((_, i) => i !== idx),
    });
  };

  const handleAddHabitFocus = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitFocus.trim()) return;
    updateWeeklyPlan({
      habitFocus: [...weeklyPlan.habitFocus, newHabitFocus.trim()],
    });
    setNewHabitFocus('');
  };

  const handleRemoveHabitFocus = (idx: number) => {
    updateWeeklyPlan({
      habitFocus: weeklyPlan.habitFocus.filter((_, i) => i !== idx),
    });
  };

  const handleAddPersonalPriority = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonalPriority.trim()) return;
    updateWeeklyPlan({
      personalPriorities: [...weeklyPlan.personalPriorities, newPersonalPriority.trim()],
    });
    setNewPersonalPriority('');
  };

  const handleRemovePersonalPriority = (idx: number) => {
    updateWeeklyPlan({
      personalPriorities: weeklyPlan.personalPriorities.filter((_, i) => i !== idx),
    });
  };

  const handleSaveReflection = () => {
    updateWeeklyPlan({
      reflection: {
        wins,
        challenges,
        nextWeekFocus,
      },
    });
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <Calendar className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Weekly Blueprint</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mt-1">
          Plan Your Week Ahead
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
          Zoom out to see the forest. When you decide what matters on Sunday or Monday, you avoid reactivity throughout the week.
        </p>
      </div>

      {/* 4 Quadrants / Focus Areas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 1. Main Goals For The Week */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              1. Big Outcomes This Week
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            Limit to 2–3 needle-movers so you don't scatter your attention.
          </p>

          <div className="space-y-2">
            {weeklyPlan.mainGoals.map((goal, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 text-xs text-neutral-800 dark:text-neutral-200 group"
              >
                <span className="flex-1 pr-2">{goal}</span>
                <button
                  onClick={() => handleRemoveGoal(idx)}
                  className="text-neutral-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddGoal} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              placeholder="Add key weekly outcome..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={!newGoal.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* 2. Important Tasks */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              2. Important Tasks & Milestones
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            Crucial tasks that must happen before the weekend.
          </p>

          <div className="space-y-2">
            {weeklyPlan.importantTasks.map((task, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 text-xs text-neutral-800 dark:text-neutral-200 group"
              >
                <span className="flex-1 pr-2">{task}</span>
                <button
                  onClick={() => handleRemoveTask(idx)}
                  className="text-neutral-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddTask} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newTask}
              onChange={e => setNewTask(e.target.value)}
              placeholder="Add important task..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={!newTask.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* 3. Habit Focus */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Smile className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              3. Habit & Routine Anchors
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            What micro-behavior do you want to protect at all costs?
          </p>

          <div className="space-y-2">
            {weeklyPlan.habitFocus.map((h, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 text-xs text-neutral-800 dark:text-neutral-200 group"
              >
                <span className="flex-1 pr-2">{h}</span>
                <button
                  onClick={() => handleRemoveHabitFocus(idx)}
                  className="text-neutral-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddHabitFocus} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newHabitFocus}
              onChange={e => setNewHabitFocus(e.target.value)}
              placeholder="e.g. Protect morning 45 mins from phone..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={!newHabitFocus.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* 4. Personal Priorities & Boundaries */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-indigo-500" />
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              4. Personal Priorities & Boundaries
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            Energy management, boundaries, saying no, and restful offline time.
          </p>

          <div className="space-y-2">
            {weeklyPlan.personalPriorities.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-2.5 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 text-xs text-neutral-800 dark:text-neutral-200 group"
              >
                <span className="flex-1 pr-2">{item}</span>
                <button
                  onClick={() => handleRemovePersonalPriority(idx)}
                  className="text-neutral-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddPersonalPriority} className="flex gap-2 pt-1">
            <input
              type="text"
              value={newPersonalPriority}
              onChange={e => setNewPersonalPriority(e.target.value)}
              placeholder="e.g. No checking Slack after 7:30 PM..."
              className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
            <button
              type="submit"
              disabled={!newPersonalPriority.trim()}
              className="px-3 py-1.5 text-xs font-medium bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      </div>

      {/* Weekly Reflection Section */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              End-of-Week Reflection & Audit
            </h3>
            <p className="text-xs text-neutral-500">
              Honest, non-judgmental evaluation of what went well and what stalled.
            </p>
          </div>
          <button
            onClick={handleSaveReflection}
            className="px-4 py-2 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg self-start sm:self-auto flex items-center gap-1.5 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{savedMessage ? 'Saved Reflection ✓' : 'Save Reflection'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Wins & Progress This Week
            </label>
            <textarea
              value={wins}
              onChange={e => setWins(e.target.value)}
              placeholder="What actually worked? Celebrate any step forward..."
              rows={4}
              className="w-full p-3 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              What Caused Friction / Procrastination?
            </label>
            <textarea
              value={challenges}
              onChange={e => setChallenges(e.target.value)}
              placeholder="What felt heavy? Were tasks too large or vague? Sleep deficit?"
              rows={4}
              className="w-full p-3 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
              Next Week's #1 Focal Point
            </label>
            <textarea
              value={nextWeekFocus}
              onChange={e => setNextWeekFocus(e.target.value)}
              placeholder="If you could only do one thing right next week, what is it?"
              rows={4}
              className="w-full p-3 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900 resize-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
