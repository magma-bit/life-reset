import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Check, Sparkles } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { audioManager } from '../../utils/audio';

export const FiveMinuteStart: React.FC = () => {
  const { recordFocusSession, settings } = useApp();
  const [taskName, setTaskName] = useState('');
  const [timeLeft, setTimeLeft] = useState(5 * 60); // 300 seconds
  const [isActive, setIsActive] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isActive && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isActive && timeLeft === 0) {
      setIsActive(false);
      setCompleted(true);
      audioManager.playBell(settings.soundEnabled);
      recordFocusSession({
        taskTitle: taskName.trim() || '5-Minute Momentum Start',
        durationMinutes: 5,
        type: '5-minute',
      });
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isActive, timeLeft, taskName, settings.soundEnabled, recordFocusSession]);

  const toggleTimer = () => {
    setIsActive(!isActive);
  };

  const resetTimer = () => {
    setIsActive(false);
    setTimeLeft(5 * 60);
    setCompleted(false);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 md:p-8 shadow-xs max-w-xl mx-auto space-y-6 text-center">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>The 5-Minute Rule</span>
        </div>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Just Commit to 5 Minutes
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-md mx-auto leading-relaxed">
          Tell yourself: &ldquo;I only have to work on this for 300 seconds. If I want to stop when the timer dings, I have 100% permission.&rdquo; Getting started is 90% of the battle.
        </p>
      </div>

      {/* Task input */}
      <div className="max-w-md mx-auto">
        <input
          type="text"
          value={taskName}
          onChange={e => setTaskName(e.target.value)}
          placeholder="What tiny task will you start? (e.g. Write 1 paragraph)"
          disabled={isActive}
          className="w-full px-4 py-2.5 text-xs text-center rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>

      {/* Big Calm Countdown Display */}
      <div className="py-6">
        <div className="text-6xl md:text-7xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums select-none">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        {completed ? (
          <div className="mt-4 p-3 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 rounded-lg text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center justify-center gap-2 animate-in fade-in">
            <Check className="w-4 h-4" />
            <span>5 minutes completed! Do you want to keep going or take a clean break?</span>
          </div>
        ) : (
          <div className="w-48 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full mx-auto mt-4 overflow-hidden">
            <div
              className="h-full bg-emerald-600 transition-all duration-1000 ease-linear"
              style={{ width: `${((300 - timeLeft) / 300) * 100}%` }}
            />
          </div>
        )}
      </div>

      {/* Timer Controls */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={toggleTimer}
          className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 transition-colors flex items-center gap-2 shadow-xs"
        >
          {isActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isActive ? 'Pause' : timeLeft < 300 ? 'Resume' : 'Start 5 Minutes'}</span>
        </button>

        <button
          onClick={resetTimer}
          className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          title="Reset timer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
