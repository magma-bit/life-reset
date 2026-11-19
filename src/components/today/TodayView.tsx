import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Star,
  Plus,
  Zap,
  Flame,
  Check,
  Edit2,
  Smile,
  Meh,
  Frown,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString, formatFullTodayDate } from '../../utils/date';
import { DailyNote } from '../../types';

export const TodayView: React.FC = () => {
  const {
    tasks,
    toggleTaskComplete,
    toggleTaskTopPriority,
    openTaskModal,
    habits,
    toggleHabitDay,
    dailyNotes,
    saveDailyNote,
    setCurrentView,
    setActiveFocusTask,
  } = useApp();

  const todayStr = getTodayDateString();
  const todayNote = dailyNotes[todayStr]?.content || '';
  const currentMood = dailyNotes[todayStr]?.mood;

  const [noteText, setNoteText] = useState(todayNote);
  const [isSavedRecently, setIsSavedRecently] = useState(false);

  // Sync if todayNote updates externally
  React.useEffect(() => {
    setNoteText(dailyNotes[todayStr]?.content || '');
  }, [dailyNotes, todayStr]);

  const handleNoteBlur = () => {
    saveDailyNote(todayStr, noteText, currentMood);
    setIsSavedRecently(true);
    setTimeout(() => setIsSavedRecently(false), 2000);
  };

  const handleMoodSelect = (mood: DailyNote['mood']) => {
    saveDailyNote(todayStr, noteText, mood);
  };

  // Filter today's tasks
  const todayTasks = tasks.filter(t => t.dueDate === todayStr);
  const completedTodayTasks = todayTasks.filter(t => t.completed);
  const completionPercentage = todayTasks.length > 0
    ? Math.round((completedTodayTasks.length / todayTasks.length) * 100)
    : 0;

  // Top 3 Priorities: tasks where isTopPriority is true
  const top3Tasks = todayTasks.filter(t => t.isTopPriority);
  const otherTasks = todayTasks.filter(t => !t.isTopPriority);

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Top Banner / Focus Anchor */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 md:p-8 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
              <span>{formatFullTodayDate()}</span>
              <span aria-hidden="true">·</span>
              <span>Daily Focus Room</span>
            </div>
            <h2 className="text-xl md:text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mt-1">
              Your Daily Non-Negotiables
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
              Protect yourself from cognitive overload. Focus only on what moves the needle today.
            </p>
          </div>

          <div className="flex items-center gap-4 bg-neutral-50 dark:bg-neutral-800/60 p-3 rounded-xl border border-neutral-200/60 dark:border-neutral-700/60 shrink-0">
            <div>
              <div className="text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                Daily Completion
              </div>
              <div className="text-lg font-bold text-neutral-900 dark:text-neutral-100 tabular-nums">
                {completionPercentage}%
              </div>
            </div>
            <div className="w-12 h-12 rounded-full border-4 border-neutral-200 dark:border-neutral-700 flex items-center justify-center relative">
              <div
                className="w-12 h-12 rounded-full border-4 border-emerald-600 dark:border-emerald-500 absolute inset-0 -m-1"
                style={{
                  clipPath: `polygon(50% 50%, 50% 0%, ${
                    completionPercentage >= 25 ? '100% 0%,' : ''
                  }${completionPercentage >= 50 ? '100% 100%,' : ''}${
                    completionPercentage >= 75 ? '0% 100%,' : ''
                  }${completionPercentage === 100 ? '0% 0%,' : ''} 50% 0%)`,
                }}
              />
              <span className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 tabular-nums">
                {completedTodayTasks.length}/{todayTasks.length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: TOP 3 PRIORITIES (Anti-overwhelm rule) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Top 3 Priorities
              </h3>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              If you accomplish only these three, your day is an absolute success.
            </p>
          </div>
          <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {top3Tasks.length} / 3 selected
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[0, 1, 2].map(index => {
            const task = top3Tasks[index];
            if (!task) {
              return (
                <div
                  key={`empty-${index}`}
                  onClick={() => openTaskModal()}
                  className="border border-dashed border-neutral-300 dark:border-neutral-700 rounded-xl p-5 flex flex-col items-center justify-center text-center hover:bg-neutral-50 dark:hover:bg-neutral-800/40 cursor-pointer transition-colors min-h-[140px]"
                >
                  <Plus className="w-5 h-5 text-neutral-400 mb-1.5" />
                  <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                    Set Priority #{index + 1}
                  </span>
                  <span className="text-[11px] text-neutral-400 mt-0.5">
                    Click to add or pin from list
                  </span>
                </div>
              );
            }

            return (
              <div
                key={task.id}
                className={`border rounded-xl p-4 flex flex-col justify-between transition-all ${
                  task.completed
                    ? 'bg-neutral-50/60 dark:bg-neutral-800/30 border-neutral-200/60 dark:border-neutral-800 opacity-70'
                    : 'bg-white dark:bg-neutral-900 border-neutral-200 dark:border-neutral-700/80 shadow-xs'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                      Priority #{index + 1}
                    </span>
                    <button
                      onClick={() => toggleTaskTopPriority(task.id)}
                      className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-0.5"
                      title="Unpin from Top 3"
                    >
                      <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    </button>
                  </div>

                  <h4
                    className={`text-sm font-semibold leading-snug line-clamp-2 ${
                      task.completed
                        ? 'line-through text-neutral-400 dark:text-neutral-500'
                        : 'text-neutral-900 dark:text-neutral-100'
                    }`}
                  >
                    {task.title}
                  </h4>

                  {task.notes && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                      {task.notes}
                    </p>
                  )}
                </div>

                <div className="pt-3 mt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
                  <button
                    onClick={() => toggleTaskComplete(task.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    ) : (
                      <Circle className="w-4 h-4" />
                    )}
                    <span>{task.completed ? 'Done' : 'Mark Done'}</span>
                  </button>

                  {!task.completed && (
                    <button
                      onClick={() => {
                        setActiveFocusTask(task);
                        setCurrentView('anti-procrastination');
                      }}
                      className="px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 rounded hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors flex items-center gap-1"
                    >
                      <Zap className="w-3 h-3" />
                      <span>Focus</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* SECTION 2: ALL TODAY'S TASKS & HABITS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols): Today's Tasks Checklist */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Today's Remaining Checklist
            </h3>
            <button
              onClick={() => openTaskModal()}
              className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add to Today</span>
            </button>
          </div>

          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 overflow-hidden shadow-xs">
            {todayTasks.length === 0 ? (
              <div className="p-8 text-center">
                <Sparkles className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
                <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  No tasks scheduled for today
                </p>
                <p className="text-xs text-neutral-500 mt-1">
                  Start fresh with 1–3 manageable tasks.
                </p>
                <button
                  onClick={() => openTaskModal()}
                  className="mt-3 px-3 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg"
                >
                  Create Task
                </button>
              </div>
            ) : (
              otherTasks.map(task => (
                <div
                  key={task.id}
                  className={`p-3.5 flex items-start justify-between gap-3 transition-colors ${
                    task.completed
                      ? 'bg-neutral-50/50 dark:bg-neutral-800/20 opacity-60'
                      : 'hover:bg-neutral-50/60 dark:hover:bg-neutral-800/40'
                  }`}
                >
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <button
                      onClick={() => toggleTaskComplete(task.id)}
                      className="mt-0.5 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors shrink-0"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Circle className="w-4 h-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <span
                        className={`text-sm font-medium truncate block ${
                          task.completed
                            ? 'line-through text-neutral-400 dark:text-neutral-500'
                            : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        <span>{task.category}</span>
                        <span aria-hidden="true">·</span>
                        <span>{task.priority} Priority</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => toggleTaskTopPriority(task.id)}
                      className="p-1 text-neutral-400 hover:text-amber-500 transition-colors"
                      title="Promote to Top 3 Priorities"
                    >
                      <Star className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => openTaskModal(task)}
                      className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 transition-colors"
                      title="Edit task"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column (1 Col): Today's Habits Checklist */}
        <div className="space-y-3">
          <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            Habits to Complete Today
          </h3>
          <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-4 space-y-2.5 shadow-xs">
            {habits.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs text-neutral-500">No habits added yet.</p>
                <button
                  onClick={() => setCurrentView('habits')}
                  className="mt-2 text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline"
                >
                  + Add daily habit
                </button>
              </div>
            ) : (
              habits.map(habit => {
                const isDone = habit.completedDates.includes(todayStr);
                return (
                  <div
                    key={habit.id}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div
                        className={`text-xs font-medium truncate ${
                          isDone
                            ? 'line-through text-neutral-400 dark:text-neutral-500'
                            : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {habit.title}
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                        <Flame className="w-3 h-3 text-amber-500" />
                        <span className="tabular-nums">{habit.streak} streak</span>
                      </div>
                    </div>

                    <button
                      onClick={() => toggleHabitDay(habit.id, todayStr)}
                      className={`w-6 h-6 rounded flex items-center justify-center transition-all ${
                        isDone
                          ? 'bg-emerald-600 text-white'
                          : 'border border-neutral-300 dark:border-neutral-700 text-neutral-400 hover:border-neutral-400'
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: DAILY SCRATCHPAD & MOOD CHECK-IN */}
      <section className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Daily Brain Dump & Reflection
            </h3>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Empty your head of distractions, thoughts, or reflections. Autosaved.
            </p>
          </div>

          {/* Mood Check-In */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
              Energy today:
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleMoodSelect('calm')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  currentMood === 'calm'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                title="Calm & Grounded"
              >
                <Smile className="w-4 h-4" />
                <span className="hidden sm:inline">Calm</span>
              </button>
              <button
                onClick={() => handleMoodSelect('focused')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  currentMood === 'focused'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                title="In the Zone"
              >
                <Zap className="w-4 h-4" />
                <span className="hidden sm:inline">Focused</span>
              </button>
              <button
                onClick={() => handleMoodSelect('overwhelmed')}
                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                  currentMood === 'overwhelmed'
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
                title="Overwhelmed (Take it easy)"
              >
                <Frown className="w-4 h-4" />
                <span className="hidden sm:inline">Overwhelmed</span>
              </button>
            </div>
          </div>
        </div>

        <div>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            onBlur={handleNoteBlur}
            placeholder="Write freely: What is draining your energy right now? What is the one realistic win you want to feel proud of tonight?"
            rows={4}
            className="w-full p-3.5 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800/70 border border-neutral-200 dark:border-neutral-700/80 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none transition-colors"
          />
          <div className="flex justify-end mt-1 text-[11px] text-neutral-400">
            {isSavedRecently ? 'Saved ✓' : 'Click away or press tab to save'}
          </div>
        </div>
      </section>
    </div>
  );
};
