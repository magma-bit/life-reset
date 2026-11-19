import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Zap,
  Star,
  Target,
  Flame,
  ArrowRight,
  Sparkles,
  Check,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString, formatFullTodayDate, getGreeting } from '../../utils/date';
import { MOTIVATIONAL_REFLECTIONS } from '../../services/sampleData';

export const DashboardView: React.FC = () => {
  const {
    tasks,
    toggleTaskComplete,
    openTaskModal,
    habits,
    toggleHabitDay,
    goals,
    setCurrentView,
    settings,
    setActiveFocusTask,
  } = useApp();

  const todayStr = getTodayDateString();

  // Pick daily reflection based on date hash so it feels intentional and steady
  const [reflectionIndex] = useState(() => {
    const sum = todayStr.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return sum % MOTIVATIONAL_REFLECTIONS.length;
  });

  const todayTasks = tasks.filter(t => t.dueDate === todayStr);
  const completedTodayTasks = todayTasks.filter(t => t.completed);
  const completionPercentage = todayTasks.length > 0
    ? Math.round((completedTodayTasks.length / todayTasks.length) * 100)
    : 0;

  // Priority tasks: top priority first, then high priority
  const priorityTasks = [...todayTasks]
    .sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.isTopPriority && !b.isTopPriority) return -1;
      if (!a.isTopPriority && b.isTopPriority) return 1;
      const pOrder = { High: 0, Medium: 1, Low: 2 };
      return pOrder[a.priority] - pOrder[b.priority];
    })
    .slice(0, 5);

  const startFocusOnTask = (task: typeof tasks[0]) => {
    setActiveFocusTask(task);
    setCurrentView('anti-procrastination');
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Welcome Hero / Greeting Card */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 md:p-8 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium text-neutral-500 dark:text-neutral-400">
              <span>{formatFullTodayDate()}</span>
              <span aria-hidden="true">·</span>
              <span>Today's Anchor</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
              {getGreeting(settings.userName)}
            </h2>
            <p className="text-sm text-neutral-600 dark:text-neutral-300 max-w-xl leading-relaxed">
              {MOTIVATIONAL_REFLECTIONS[reflectionIndex]}
            </p>
          </div>

          {/* Quick Action CTAs */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => openTaskModal()}
              className="px-3.5 py-2.5 rounded-lg text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>Add Task</span>
            </button>
            <button
              onClick={() => setCurrentView('ai-assistant')}
              className="px-3.5 py-2.5 rounded-lg text-xs font-medium bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Ask AI Coach</span>
            </button>
            <button
              onClick={() => setCurrentView('anti-procrastination')}
              className="px-3.5 py-2.5 rounded-lg text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 transition-colors flex items-center gap-1.5 shadow-xs"
            >
              <Zap className="w-4 h-4 text-emerald-400 dark:text-emerald-600" />
              <span>Focus Session</span>
            </button>
          </div>
        </div>

        {/* Daily Completion Indicator Bar */}
        <div className="mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800/80">
          <div className="flex items-center justify-between text-xs font-medium mb-2.5">
            <span className="text-neutral-600 dark:text-neutral-400">
              Today's Execution Progress
            </span>
            <span className="text-neutral-900 dark:text-neutral-100 tabular-nums">
              {completedTodayTasks.length} of {todayTasks.length} tasks completed ({completionPercentage}%)
            </span>
          </div>
          <div className="w-full h-2.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${completionPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Grid: Priorities & Habits */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Priority Tasks */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Today's Priority Tasks
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                What matters most today. Avoid multitasking.
              </p>
            </div>
            <button
              onClick={() => setCurrentView('today')}
              className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 group"
            >
              <span>View Today's Plan</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden shadow-xs">
            {priorityTasks.length === 0 ? (
              <div className="p-8 text-center">
                <Sparkles className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  No tasks due today yet
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  Add 2 or 3 essential tasks to give your day gentle direction.
                </p>
                <button
                  onClick={() => openTaskModal()}
                  className="mt-4 px-3.5 py-1.5 text-xs font-medium bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg"
                >
                  Create First Task
                </button>
              </div>
            ) : (
              priorityTasks.map(task => (
                <div
                  key={task.id}
                  className={`p-4 flex items-start justify-between gap-3 transition-colors ${
                    task.completed
                      ? 'bg-neutral-50/50 dark:bg-neutral-900/50 opacity-60'
                      : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className="mt-0.5 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-sm font-medium leading-snug truncate ${
                            task.completed
                              ? 'line-through text-neutral-400 dark:text-neutral-500'
                              : 'text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.isTopPriority && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                      </div>

                      {/* Clean metadata without pill boxes */}
                      <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                        <span>{task.category}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            task.priority === 'High'
                              ? 'text-rose-600 dark:text-rose-400 font-medium'
                              : ''
                          }
                        >
                          {task.priority} Priority
                        </span>
                        {task.notes && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate max-w-xs">{task.notes}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {!task.completed && (
                    <button
                      onClick={() => startFocusOnTask(task)}
                      className="px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/80 dark:border-emerald-800/80 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1 shrink-0"
                      title="Focus on this task now"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Focus</span>
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Daily Habits & Active Goals */}
        <div className="space-y-6">
          {/* Today's Habits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Daily Habits
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Small repetitive actions build identity.
                </p>
              </div>
              <button
                onClick={() => setCurrentView('habits')}
                className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 group"
              >
                <span>All</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-4 space-y-3 shadow-xs">
              {habits.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-neutral-500">No habits tracked yet.</p>
                  <button
                    onClick={() => setCurrentView('habits')}
                    className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    + Create first habit
                  </button>
                </div>
              ) : (
                habits.slice(0, 4).map(habit => {
                  const isDoneToday = habit.completedDates.includes(todayStr);
                  return (
                    <div
                      key={habit.id}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div
                          className={`text-xs font-medium truncate ${
                            isDoneToday
                              ? 'text-neutral-400 dark:text-neutral-500 line-through'
                              : 'text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          {habit.title}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                          <Flame className="w-3 h-3 text-amber-500" />
                          <span className="tabular-nums">{habit.streak} day streak</span>
                        </div>
                      </div>

                      <button
                        onClick={() => toggleHabitDay(habit.id, todayStr)}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${
                          isDoneToday
                            ? 'bg-emerald-600 text-white'
                            : 'border border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400 hover:text-neutral-600'
                        }`}
                        aria-label={`Toggle habit ${habit.title}`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Active Goals Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  Active Goals
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  Your long-term milestones.
                </p>
              </div>
              <button
                onClick={() => setCurrentView('goals')}
                className="text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 flex items-center gap-1 group"
              >
                <span>View</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>

            <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-4 space-y-4 shadow-xs">
              {goals.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-neutral-500">No active goals yet.</p>
                  <button
                    onClick={() => setCurrentView('goals')}
                    className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                  >
                    + Define first goal
                  </button>
                </div>
              ) : (
                goals.slice(0, 2).map(goal => {
                  const totalM = goal.milestones.length;
                  const doneM = goal.milestones.filter(m => m.completed).length;
                  const pct = totalM > 0 ? Math.round((doneM / totalM) * 100) : 0;

                  return (
                    <div key={goal.id} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate max-w-[180px]">
                          {goal.title}
                        </span>
                        <span className="text-neutral-500 dark:text-neutral-400 tabular-nums">
                          {doneM}/{totalM} ({pct}%)
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-neutral-900 dark:bg-neutral-100 rounded-full transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
