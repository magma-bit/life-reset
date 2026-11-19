import React, { useState } from 'react';
import { Plus, Trash2, ArrowRight, CheckCircle2, SplitSquareVertical } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getTodayDateString } from '../../utils/date';

const PRESET_TEMPLATES = [
  {
    name: 'Writing a Difficult Email / Document',
    steps: [
      'Open the document and write 1 rough bullet about the main point',
      'Draft the middle message without editing or polishing grammar',
      'Read once to check tone and recipient address, then click send',
    ],
  },
  {
    name: 'Tidying an Overwhelming Room',
    steps: [
      'Collect all trash/wrappers and throw in one trash bag (3 mins)',
      'Pick up all dirty laundry and put into hamper',
      'Clear only the top surface of the desk or coffee table',
    ],
  },
  {
    name: 'Unopened Bills / Administrative Backlog',
    steps: [
      'Gather all unopened envelopes or PDFs into one single stack',
      'Open only the top 2 envelopes and discard the outer packaging',
      'Pay or file just the first bill; take a deep breath',
    ],
  },
];

export const BreakItDown: React.FC = () => {
  const { addTask, setCurrentView } = useApp();
  const [bigTaskTitle, setBigTaskTitle] = useState('');
  const [steps, setSteps] = useState<string[]>([
    'Define the very first 2-minute physical movement',
    'Do the easiest middle piece',
    'Review or submit',
  ]);
  const [convertedNotice, setConvertedNotice] = useState(false);

  const handleStepChange = (index: number, value: string) => {
    const next = [...steps];
    next[index] = value;
    setSteps(next);
  };

  const addStep = () => {
    setSteps(prev => [...prev, '']);
  };

  const removeStep = (index: number) => {
    setSteps(prev => prev.filter((_, i) => i !== index));
  };

  const applyTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setBigTaskTitle(template.name);
    setSteps([...template.steps]);
  };

  const convertStepsToTasks = () => {
    const valid = steps.map(s => s.trim()).filter(Boolean);
    if (valid.length === 0) return;

    valid.forEach((step, idx) => {
      addTask({
        title: bigTaskTitle.trim() ? `${bigTaskTitle.trim()}: Step ${idx + 1} - ${step}` : step,
        category: 'Personal',
        priority: 'Medium',
        dueDate: getTodayDateString(),
        completed: false,
      });
    });

    setConvertedNotice(true);
    setTimeout(() => {
      setConvertedNotice(false);
      setCurrentView('tasks');
    }, 1500);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 md:p-8 shadow-xs max-w-2xl mx-auto space-y-6">
      <div>
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 mb-3">
          <SplitSquareVertical className="w-3.5 h-3.5" />
          <span>Cognitive Deconstruction</span>
        </div>
        <h3 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
          Break Down the Monster Task
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 leading-relaxed">
          When a task feels too big, your brain registers it as a threat and procrastinates. Deconstruct it into absurdly small physical actions.
        </p>
      </div>

      {/* Preset helpers */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider">
          Quick Deconstruction Inspiration:
        </span>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => applyTemplate(tmpl)}
              className="text-xs px-2.5 py-1 rounded-md bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300 transition-colors"
            >
              {tmpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Big task title input */}
      <div>
        <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
          What is the paralyzing task?
        </label>
        <input
          type="text"
          value={bigTaskTitle}
          onChange={e => setBigTaskTitle(e.target.value)}
          placeholder="e.g. Redo entire portfolio website / Finish taxes"
          className="w-full px-3.5 py-2.5 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
        />
      </div>

      {/* Micro-steps list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
            Micro-Steps (Under 5 minutes each)
          </label>
          <button
            type="button"
            onClick={addStep}
            className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Step</span>
          </button>
        </div>

        <div className="space-y-2">
          {steps.map((step, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-neutral-400 tabular-nums w-4">
                {idx + 1}.
              </span>
              <input
                type="text"
                value={step}
                onChange={e => handleStepChange(idx, e.target.value)}
                placeholder={`Micro-step ${idx + 1}...`}
                className="flex-1 px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
              />
              {steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(idx)}
                  className="p-1.5 text-neutral-400 hover:text-red-500 rounded"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Convert button */}
      <div className="pt-2">
        <button
          onClick={convertStepsToTasks}
          disabled={convertedNotice || steps.filter(s => s.trim()).length === 0}
          className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 transition-colors flex items-center justify-center gap-2 shadow-xs disabled:opacity-50"
        >
          {convertedNotice ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Converted! Redirecting to Tasks...</span>
            </>
          ) : (
            <>
              <span>Save Micro-Steps to Master Tasks</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
