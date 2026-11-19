import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { HabitCategory, HabitFrequency } from '../../types';

interface HabitModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HabitModal: React.FC<HabitModalProps> = ({ isOpen, onClose }) => {
  const { addHabit } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<HabitCategory>('Morning');
  const [frequency, setFrequency] = useState<HabitFrequency>('Daily');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    addHabit({
      title: title.trim(),
      category,
      frequency,
    });

    setTitle('');
    setCategory('Morning');
    setFrequency('Daily');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-10">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              Create New Habit
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">
                Habit Name
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. 10-Minute Morning Sunlight"
                required
                autoFocus
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value as HabitCategory)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="Morning">Morning</option>
                  <option value="Body & Health">Body & Health</option>
                  <option value="Focus & Mind">Focus & Mind</option>
                  <option value="Evening">Evening</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">
                  Frequency
                </label>
                <select
                  value={frequency}
                  onChange={e => setFrequency(e.target.value as HabitFrequency)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekdays">Weekdays (Mon-Fri)</option>
                  <option value="3x/week">3x per week</option>
                </select>
              </div>
            </div>

            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-relaxed">
              Tip: Keep it tiny at first. Make it so easy you cannot say no, even on high-fatigue days.
            </p>
          </div>

          <div className="px-6 py-4 bg-neutral-50 dark:bg-neutral-800/50 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 rounded-lg hover:bg-neutral-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 rounded-lg shadow-xs"
            >
              Save Habit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
