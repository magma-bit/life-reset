import React, { useState } from 'react';
import { Timer, SplitSquareVertical, Zap, Focus } from 'lucide-react';
import { FiveMinuteStart } from './FiveMinuteStart';
import { BreakItDown } from './BreakItDown';
import { FocusTimer } from './FocusTimer';
import { JustOneThing } from './JustOneThing';

type ToolTab = '5-minute' | 'break-down' | 'focus-session' | 'just-one-thing';

export const AntiProcrastinationView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ToolTab>('5-minute');

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Studio Header */}
      <div className="text-center max-w-xl mx-auto space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
          Anti-Procrastination Toolkit
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          Cognitive tools built for when your brain feels frozen, overwhelmed, or resistant to starting.
        </p>
      </div>

      {/* Segmented Control / Tool Tabs */}
      <div className="flex flex-wrap items-center justify-center gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-xl max-w-xl mx-auto">
        <button
          onClick={() => setActiveTab('5-minute')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === '5-minute'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          <Timer className="w-3.5 h-3.5" />
          <span>5-Minute Start</span>
        </button>

        <button
          onClick={() => setActiveTab('break-down')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'break-down'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          <SplitSquareVertical className="w-3.5 h-3.5" />
          <span>Break It Down</span>
        </button>

        <button
          onClick={() => setActiveTab('focus-session')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'focus-session'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          <Zap className="w-3.5 h-3.5" />
          <span>Focus Session</span>
        </button>

        <button
          onClick={() => setActiveTab('just-one-thing')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'just-one-thing'
              ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xs'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100'
          }`}
        >
          <Focus className="w-3.5 h-3.5" />
          <span>Just One Thing</span>
        </button>
      </div>

      {/* Active Tool Content */}
      <div className="pt-2">
        {activeTab === '5-minute' && <FiveMinuteStart />}
        {activeTab === 'break-down' && <BreakItDown />}
        {activeTab === 'focus-session' && <FocusTimer />}
        {activeTab === 'just-one-thing' && <JustOneThing />}
      </div>
    </div>
  );
};
