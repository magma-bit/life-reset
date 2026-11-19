import React, { useState } from 'react';
import {
  Flame,
  Plus,
  Check,
  Award,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HabitModal } from '../modals/HabitModal';
import { getPastNDays, getTodayDateString } from '../../utils/date';

export const HabitsView: React.FC = () => {
  const { habits, toggleHabitDay, deleteHabit } = useApp();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Past 7 days for the weekly habit grid
  const past7Days = getPastNDays(7);
  const todayStr = getTodayDateString();

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-amber-500" />
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Daily Habits & Identity
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            You do not rise to the level of your goals; you fall to the level of your systems. Keep chains unbroken.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-3.5 py-2 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg flex items-center gap-1.5 self-start sm:self-auto transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Habit</span>
        </button>
      </div>

      {/* Habit 7-Day Matrix Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 shadow-xs overflow-hidden">
        {habits.length === 0 ? (
          <div className="p-12 text-center">
            <Sparkles className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No habits set yet
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Add 1 or 2 small anchors to start building daily consistency.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-4 px-3.5 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg"
            >
              Add First Habit
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px]">
              <thead>
                <tr className="border-b border-neutral-100 dark:border-neutral-800 text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider bg-neutral-50/50 dark:bg-neutral-800/40">
                  <th className="py-3 px-4">Habit Name</th>
                  <th className="py-3 px-3 text-center">Frequency</th>
                  <th className="py-3 px-3 text-center">Streak</th>
                  {past7Days.map(dayStr => {
                    const isToday = dayStr === todayStr;
                    const dateObj = new Date(dayStr);
                    const dayLabel = dateObj.toLocaleDateString('en-US', { weekday: 'narrow' });
                    const dayNum = dateObj.getDate();

                    return (
                      <th
                        key={dayStr}
                        className={`py-3 px-2 text-center tabular-nums ${
                          isToday ? 'text-neutral-900 dark:text-neutral-100 font-bold' : ''
                        }`}
                      >
                        <div>{dayLabel}</div>
                        <div className="text-[10px] opacity-75">{dayNum}</div>
                      </th>
                    );
                  })}
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {habits.map(habit => (
                  <tr
                    key={habit.id}
                    className="hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    {/* Habit Title & Category */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {habit.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {habit.category}
                      </div>
                    </td>

                    {/* Frequency */}
                    <td className="py-3.5 px-3 text-center text-neutral-600 dark:text-neutral-300">
                      {habit.frequency}
                    </td>

                    {/* Current & Best Streak */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center gap-1 font-semibold text-amber-600 dark:text-amber-400 tabular-nums">
                        <Flame className="w-3.5 h-3.5" />
                        <span>{habit.streak}d</span>
                      </div>
                      <div className="text-[10px] text-neutral-400 flex items-center justify-center gap-0.5 tabular-nums">
                        <Award className="w-2.5 h-2.5" />
                        <span>best {habit.bestStreak}d</span>
                      </div>
                    </td>

                    {/* 7-Day Completion Dots */}
                    {past7Days.map(dayStr => {
                      const isDone = habit.completedDates.includes(dayStr);
                      const isToday = dayStr === todayStr;

                      return (
                        <td key={dayStr} className="py-3.5 px-2 text-center">
                          <button
                            onClick={() => toggleHabitDay(habit.id, dayStr)}
                            className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center transition-all ${
                              isDone
                                ? 'bg-emerald-600 text-white shadow-xs'
                                : isToday
                                ? 'border-2 border-dashed border-neutral-300 dark:border-neutral-600 hover:border-emerald-500'
                                : 'bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700'
                            }`}
                            title={`Toggle for ${dayStr}`}
                          >
                            {isDone ? (
                              <Check className="w-4 h-4 stroke-[2.5]" />
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-neutral-300 dark:bg-neutral-600" />
                            )}
                          </button>
                        </td>
                      );
                    })}

                    {/* Actions */}
                    <td className="py-3.5 px-3 text-right">
                      <button
                        onClick={() => deleteHabit(habit.id)}
                        className="p-1.5 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                        title="Delete habit"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <HabitModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};
