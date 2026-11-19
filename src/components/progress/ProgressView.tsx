import React from 'react';
import {
  CheckCircle2,
  Flame,
  Target,
  Zap,
  TrendingUp,
  Clock,
  Award,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getPastNDays } from '../../utils/date';

export const ProgressView: React.FC = () => {
  const { tasks, habits, goals, focusSessions } = useApp();

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.completed).length;
  const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Habit metrics
  const totalStreaks = habits.reduce((acc, h) => acc + h.streak, 0);
  const bestStreakOverall = habits.reduce((max, h) => Math.max(max, h.bestStreak), 0);

  // Focus time metrics
  const totalFocusMinutes = focusSessions.reduce((acc, s) => acc + s.durationMinutes, 0);
  const totalFocusHours = (totalFocusMinutes / 60).toFixed(1);

  // Goal metrics
  const totalMilestones = goals.reduce((acc, g) => acc + g.milestones.length, 0);
  const completedMilestones = goals.reduce(
    (acc, g) => acc + g.milestones.filter(m => m.completed).length,
    0
  );
  const milestoneRate = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  // Past 7 days productivity bar trend
  const past7Days = getPastNDays(7);
  const dailyTaskCompletions = past7Days.map(dayStr => {
    const count = tasks.filter(t => t.completedAt === dayStr).length;
    const dateObj = new Date(dayStr);
    const label = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    return { dayStr, label, count };
  });

  const maxDailyCount = Math.max(...dailyTaskCompletions.map(d => d.count), 4);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <TrendingUp className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>Real Progress, No Pressure</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mt-1">
          Your Momentum & Consistency
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
          Progress is not linear. Measure your wins in small repetitions and time spent in presence.
        </p>
      </div>

      {/* 4 Stat Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Metric 1: Tasks Done */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium text-neutral-500">Tasks Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
            {completedTasks}
          </div>
          <div className="text-[11px] text-neutral-500 tabular-nums">
            {taskCompletionRate}% of all recorded tasks
          </div>
        </div>

        {/* Metric 2: Focus Time */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium text-neutral-500">Focus Logged</span>
            <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
            {totalFocusHours} <span className="text-sm font-normal text-neutral-500">hrs</span>
          </div>
          <div className="text-[11px] text-neutral-500 tabular-nums">
            {focusSessions.length} total sessions
          </div>
        </div>

        {/* Metric 3: Active Habit Streaks */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium text-neutral-500">Habit Streaks</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
            {totalStreaks} <span className="text-sm font-normal text-neutral-500">days</span>
          </div>
          <div className="text-[11px] text-neutral-500 tabular-nums">
            Best streak record: {bestStreakOverall} days
          </div>
        </div>

        {/* Metric 4: Goal Milestones */}
        <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-5 shadow-xs space-y-2">
          <div className="flex items-center justify-between text-neutral-400">
            <span className="text-xs font-medium text-neutral-500">Milestones Hit</span>
            <Target className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
            {completedMilestones}
          </div>
          <div className="text-[11px] text-neutral-500 tabular-nums">
            {milestoneRate}% goal execution
          </div>
        </div>
      </div>

      {/* Productivity Trend Chart (Past 7 Days) */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
              7-Day Execution Rhythm
            </h3>
            <p className="text-xs text-neutral-500">
              Tasks checked off over the past week.
            </p>
          </div>
          <span className="text-xs font-semibold text-neutral-500 tabular-nums">
            Last 7 Days
          </span>
        </div>

        <div className="flex items-end justify-between gap-3 pt-6 h-48 px-2 border-b border-neutral-100 dark:border-neutral-800">
          {dailyTaskCompletions.map(item => {
            const heightPercent = maxDailyCount > 0 ? (item.count / maxDailyCount) * 100 : 0;
            return (
              <div key={item.dayStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                <span className="text-[11px] font-semibold text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity tabular-nums">
                  {item.count}
                </span>
                <div className="w-full max-w-[40px] bg-neutral-100 dark:bg-neutral-800 rounded-t-lg h-full flex items-end overflow-hidden">
                  <div
                    className="w-full bg-emerald-600 dark:bg-emerald-500 rounded-t-lg transition-all duration-500"
                    style={{ height: `${Math.max(heightPercent, 6)}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mt-2">
                  {item.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Focus Session Log History */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-neutral-900 dark:text-neutral-100">
            Recent Focus Sessions
          </h3>
          <span className="text-xs text-neutral-500 tabular-nums">
            {focusSessions.length} total logged
          </span>
        </div>

        {focusSessions.length === 0 ? (
          <p className="text-xs text-neutral-400 italic">No focus sessions recorded yet.</p>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
            {focusSessions.slice(0, 5).map(session => (
              <div key={session.id} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Zap className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {session.taskTitle}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-neutral-500">
                  <span className="tabular-nums font-semibold text-neutral-700 dark:text-neutral-300">
                    {session.durationMinutes} mins
                  </span>
                  <span className="text-[11px] tabular-nums">
                    {new Date(session.timestamp).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
