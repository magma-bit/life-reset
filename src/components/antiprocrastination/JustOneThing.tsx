import React, { useState, useEffect } from 'react';
import { CheckCircle2, Shuffle, Sparkles, Star, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Task } from '../../types';

export const JustOneThing: React.FC = () => {
  const { tasks, toggleTaskComplete, openTaskModal } = useApp();

  const pendingTasks = tasks.filter(t => !t.completed);

  // Default to first top-priority task or first pending task
  const [selectedTask, setSelectedTask] = useState<Task | null>(() => {
    return pendingTasks.find(t => t.isTopPriority) || pendingTasks[0] || null;
  });

  useEffect(() => {
    if (!selectedTask || !pendingTasks.some(t => t.id === selectedTask.id)) {
      setSelectedTask(pendingTasks.find(t => t.isTopPriority) || pendingTasks[0] || null);
    }
  }, [tasks]);

  const [justFinished, setJustFinished] = useState(false);

  const handlePickRandom = () => {
    if (pendingTasks.length === 0) return;
    const randomIdx = Math.floor(Math.random() * pendingTasks.length);
    setSelectedTask(pendingTasks[randomIdx]);
    setJustFinished(false);
  };

  const handleComplete = () => {
    if (!selectedTask) return;
    toggleTaskComplete(selectedTask.id);
    setJustFinished(true);

    setTimeout(() => {
      // Pick next
      const remaining = pendingTasks.filter(t => t.id !== selectedTask.id);
      setSelectedTask(remaining.find(t => t.isTopPriority) || remaining[0] || null);
      setJustFinished(false);
    }, 1800);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 text-center">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Radical Monotasking</span>
        </div>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Just One Thing
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto">
          Close every other tab in your mind. Do not worry about tomorrow, or the 10 other tasks. Only this.
        </p>
      </div>

      {/* Task Picker dropdown */}
      <div className="flex items-center justify-center gap-2 max-w-sm mx-auto">
        <select
          value={selectedTask?.id || ''}
          onChange={e => {
            const found = pendingTasks.find(t => t.id === e.target.value);
            setSelectedTask(found || null);
            setJustFinished(false);
          }}
          className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
        >
          {pendingTasks.map(t => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>

        <button
          onClick={handlePickRandom}
          className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          title="Pick random task"
        >
          <Shuffle className="w-4 h-4" />
        </button>
      </div>

      {/* The Monotasking Focus Card */}
      {selectedTask ? (
        <div
          className={`bg-white dark:bg-neutral-900 rounded-2xl border-2 p-8 md:p-12 shadow-sm transition-all duration-300 ${
            justFinished
              ? 'border-emerald-500 bg-emerald-50/20 dark:bg-emerald-950/20 scale-[1.01]'
              : 'border-neutral-900 dark:border-neutral-100'
          }`}
        >
          {justFinished ? (
            <div className="space-y-4 animate-in zoom-in-95">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto animate-bounce" />
              <h4 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
                Splendid work!
              </h4>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                You took action and finished it. Loading your next gentle focus item...
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-center justify-center gap-2 text-xs font-semibold text-neutral-400 uppercase tracking-widest">
                <span>Current Non-Negotiable</span>
                {selectedTask.isTopPriority && (
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                )}
              </div>

              {/* Task Title in massive high-contrast typography */}
              <h2 className="text-2xl md:text-4xl font-extrabold tracking-tight text-neutral-900 dark:text-neutral-100 leading-tight">
                {selectedTask.title}
              </h2>

              {selectedTask.notes && (
                <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-lg mx-auto leading-relaxed">
                  {selectedTask.notes}
                </p>
              )}

              <div className="flex items-center justify-center gap-3 text-xs text-neutral-500">
                <span>{selectedTask.category}</span>
                <span aria-hidden="true">·</span>
                <span>{selectedTask.priority} Priority</span>
              </div>

              {/* Action Button */}
              <div className="pt-4">
                <button
                  onClick={handleComplete}
                  className="px-8 py-3.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white transition-all transform hover:scale-105 shadow-md flex items-center gap-2 mx-auto"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>I Finished This! Mark Complete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white dark:bg-neutral-900 rounded-xl p-12 border border-neutral-200 dark:border-neutral-800 text-center">
          <Sparkles className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            No pending tasks yet
          </h4>
          <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
            Add a task to experience radical single-task focus and beat decision fatigue.
          </p>
          <button
            onClick={() => openTaskModal()}
            className="mt-4 px-4 py-2 text-xs font-semibold bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Create a Task</span>
          </button>
        </div>
      )}
    </div>
  );
};
