import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface GoalModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const GoalModal: React.FC<GoalModalProps> = ({ isOpen, onClose }) => {
  const { addGoal } = useApp();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Career & Work');
  const [deadline, setDeadline] = useState('');
  const [whyItMatters, setWhyItMatters] = useState('');
  const [milestones, setMilestones] = useState<string[]>(['', '']);

  if (!isOpen) return null;

  const handleMilestoneChange = (index: number, val: string) => {
    const next = [...milestones];
    next[index] = val;
    setMilestones(next);
  };

  const addMilestoneField = () => {
    setMilestones(prev => [...prev, '']);
  };

  const removeMilestoneField = (index: number) => {
    setMilestones(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !deadline) return;

    const validMilestones = milestones
      .map(m => m.trim())
      .filter(Boolean)
      .map((m, idx) => ({
        id: `m-${Date.now()}-${idx}`,
        title: m,
        completed: false,
      }));

    addGoal({
      title: title.trim(),
      category,
      deadline,
      whyItMatters: whyItMatters.trim() || 'Keep moving forward step by step.',
      milestones: validMilestones.length > 0 ? validMilestones : [
        { id: `m-${Date.now()}-0`, title: 'Define first actionable milestone', completed: false }
      ],
    });

    setTitle('');
    setWhyItMatters('');
    setDeadline('');
    setMilestones(['', '']);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-neutral-900/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-neutral-900 rounded-xl shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden z-10">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              New Long-Term Goal
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">
                Goal Title
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Save $5,000 Emergency Fund"
                required
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
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="Financial Freedom">Financial Freedom</option>
                  <option value="Career & Work">Career & Work</option>
                  <option value="Health & Mind">Health & Mind</option>
                  <option value="Personal Living">Personal Living</option>
                  <option value="Creative & Skills">Creative & Skills</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">
                  Target Deadline
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-600 dark:text-neutral-300 mb-1.5">
                Why This Matters to You
              </label>
              <textarea
                value={whyItMatters}
                onChange={e => setWhyItMatters(e.target.value)}
                placeholder="Emotional grounding: e.g. Eliminates financial anxiety so I can breathe..."
                rows={2}
                className="w-full px-3.5 py-2 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  Initial Milestones (Break It Down)
                </label>
                <button
                  type="button"
                  onClick={addMilestoneField}
                  className="text-xs font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Step
                </button>
              </div>
              <div className="space-y-2">
                {milestones.map((m, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400 tabular-nums w-4">
                      {idx + 1}.
                    </span>
                    <input
                      type="text"
                      value={m}
                      onChange={e => handleMilestoneChange(idx, e.target.value)}
                      placeholder={`Milestone ${idx + 1}...`}
                      className="flex-1 px-3 py-1.5 text-xs rounded bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100"
                    />
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeMilestoneField(idx)}
                        className="text-neutral-400 hover:text-red-500 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
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
              Create Goal
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
