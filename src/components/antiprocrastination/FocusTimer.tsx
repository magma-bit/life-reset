import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2, VolumeX, CheckCircle, Zap } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { audioManager } from '../../utils/audio';

export const FocusTimer: React.FC = () => {
  const {
    tasks,
    recordFocusSession,
    settings,
    activeFocusTask,
    setActiveFocusTask,
  } = useApp();

  const [selectedDuration, setSelectedDuration] = useState<number>(25); // minutes
  const [timeLeft, setTimeLeft] = useState<number>(25 * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [ambientSound, setAmbientSound] = useState<'none' | 'rain' | 'brown-noise' | 'white-noise'>('none');
  const [customTaskTitle, setCustomTaskTitle] = useState<string>('');

  const currentTaskLabel = activeFocusTask
    ? activeFocusTask.title
    : customTaskTitle.trim() || 'Focused Work Session';

  // If activeFocusTask was passed from another view
  useEffect(() => {
    if (activeFocusTask) {
      setCustomTaskTitle(activeFocusTask.title);
    }
  }, [activeFocusTask]);

  // Timer interval
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isRunning && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isRunning && timeLeft === 0) {
      setIsRunning(false);
      audioManager.playBell(settings.soundEnabled);
      audioManager.stopAmbient();
      recordFocusSession({
        taskTitle: currentTaskLabel,
        durationMinutes: selectedDuration,
        type: selectedDuration === 50 ? 'deep-work' : selectedDuration === 25 ? 'pomodoro' : 'custom',
      });
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRunning, timeLeft, currentTaskLabel, selectedDuration, settings.soundEnabled, recordFocusSession]);

  // Ambient sound management
  const handleAmbientChange = (type: 'none' | 'rain' | 'brown-noise' | 'white-noise') => {
    setAmbientSound(type);
    if (type === 'none') {
      audioManager.stopAmbient();
    } else if (isRunning) {
      audioManager.startAmbient(type);
    }
  };

  const toggleTimer = () => {
    const nextState = !isRunning;
    setIsRunning(nextState);

    if (nextState) {
      if (ambientSound !== 'none') {
        audioManager.startAmbient(ambientSound);
      }
    } else {
      audioManager.stopAmbient();
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTimeLeft(selectedDuration * 60);
    audioManager.stopAmbient();
  };

  const setPresetDuration = (mins: number) => {
    setIsRunning(false);
    audioManager.stopAmbient();
    setSelectedDuration(mins);
    setTimeLeft(mins * 60);
  };

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const totalSeconds = selectedDuration * 60;
  const progressPercent = totalSeconds > 0 ? ((totalSeconds - timeLeft) / totalSeconds) * 100 : 0;

  const pendingTasks = tasks.filter(t => !t.completed);

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 md:p-8 shadow-xs max-w-xl mx-auto space-y-6 text-center">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60 mb-3">
          <Zap className="w-3.5 h-3.5" />
          <span>Deep Focus Timer</span>
        </div>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Single-Task Immersion
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm mx-auto">
          Silence notifications. Pick one single activity and stay with it.
        </p>
      </div>

      {/* Preset Duration Buttons */}
      <div className="flex items-center justify-center gap-2">
        {[15, 25, 45, 50].map(mins => (
          <button
            key={mins}
            onClick={() => setPresetDuration(mins)}
            disabled={isRunning}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              selectedDuration === mins
                ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-xs'
                : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200'
            }`}
          >
            {mins} min
          </button>
        ))}
      </div>

      {/* Task Selector or Custom Title */}
      <div className="space-y-2 max-w-md mx-auto text-left">
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300">
          Current Focus Target:
        </label>
        {pendingTasks.length > 0 ? (
          <select
            value={activeFocusTask?.id || 'custom'}
            onChange={e => {
              const val = e.target.value;
              if (val === 'custom') {
                setActiveFocusTask(null);
              } else {
                const found = pendingTasks.find(t => t.id === val);
                if (found) {
                  setActiveFocusTask(found);
                  setCustomTaskTitle(found.title);
                }
              }
            }}
            disabled={isRunning}
            className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
          >
            <option value="custom">-- Custom Activity --</option>
            {pendingTasks.map(t => (
              <option key={t.id} value={t.id}>
                {t.title} ({t.category})
              </option>
            ))}
          </select>
        ) : null}

        {(!activeFocusTask || activeFocusTask.id === 'custom') && (
          <input
            type="text"
            value={customTaskTitle}
            onChange={e => setCustomTaskTitle(e.target.value)}
            placeholder="Type focus goal here..."
            disabled={isRunning}
            className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        )}
      </div>

      {/* Big Circular / Numerical Timer Display */}
      <div className="py-4">
        <div className="text-6xl md:text-7xl font-bold font-mono tracking-tight text-neutral-900 dark:text-neutral-100 tabular-nums select-none">
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>

        <div className="w-56 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full mx-auto mt-4 overflow-hidden">
          <div
            className="h-full bg-emerald-600 transition-all duration-1000 ease-linear"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Ambient Sound Selector */}
      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Ambient Soundscape:
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => handleAmbientChange('none')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              ambientSound === 'none'
                ? 'bg-neutral-200 dark:bg-neutral-700 font-medium text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <VolumeX className="w-3.5 h-3.5 inline mr-1" />
            None
          </button>
          <button
            onClick={() => handleAmbientChange('rain')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              ambientSound === 'rain'
                ? 'bg-blue-100 dark:bg-blue-900/60 font-medium text-blue-900 dark:text-blue-100'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 inline mr-1" />
            Gentle Rain
          </button>
          <button
            onClick={() => handleAmbientChange('brown-noise')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              ambientSound === 'brown-noise'
                ? 'bg-amber-100 dark:bg-amber-900/60 font-medium text-amber-900 dark:text-amber-100'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 inline mr-1" />
            Brown Noise
          </button>
          <button
            onClick={() => handleAmbientChange('white-noise')}
            className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
              ambientSound === 'white-noise'
                ? 'bg-neutral-200 dark:bg-neutral-700 font-medium text-neutral-900 dark:text-neutral-100'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5 inline mr-1" />
            White Noise
          </button>
        </div>
      </div>

      {/* Timer Controls */}
      <div className="flex items-center justify-center gap-3 pt-2">
        <button
          onClick={toggleTimer}
          className="px-6 py-2.5 text-xs font-semibold rounded-lg bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 transition-colors flex items-center gap-2 shadow-xs"
        >
          {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          <span>{isRunning ? 'Pause' : 'Start Focus'}</span>
        </button>

        <button
          onClick={handleReset}
          className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-400 transition-colors"
          title="Reset timer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {activeFocusTask && !activeFocusTask.completed && (
          <button
            onClick={() => {
              if (activeFocusTask) {
                // Completed
                recordFocusSession({
                  taskTitle: activeFocusTask.title,
                  durationMinutes: Math.round((totalSeconds - timeLeft) / 60) || 5,
                  type: 'custom',
                });
                setActiveFocusTask(null);
                handleReset();
              }
            }}
            className="px-3 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 rounded-lg hover:bg-emerald-100 flex items-center gap-1.5"
            title="Mark task done early"
          >
            <CheckCircle className="w-4 h-4" />
            <span>Finished Early</span>
          </button>
        )}
      </div>
    </div>
  );
};
