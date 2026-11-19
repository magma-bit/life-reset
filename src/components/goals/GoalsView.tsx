import React, { useState } from 'react';
import {
  Plus,
  Target,
  CheckCircle2,
  Circle,
  Calendar,
  Trash2,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { GoalModal } from '../modals/GoalModal';
import { formatDatePretty } from '../../utils/date';

export const GoalsView: React.FC = () => {
  const { goals, toggleMilestone, addMilestone, deleteMilestone, deleteGoal } = useApp();
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [newMilestoneText, setNewMilestoneText] = useState<Record<string, string>>({});

  const handleAddMilestoneInline = (goalId: string) => {
    const text = newMilestoneText[goalId];
    if (!text || !text.trim()) return;
    addMilestone(goalId, text.trim());
    setNewMilestoneText(prev => ({ ...prev, [goalId]: '' }));
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Big Vision & Milestones
            </h2>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
            A goal without milestones is just background anxiety. Break each one into tiny verifiable steps.
          </p>
        </div>

        <button
          onClick={() => setIsGoalModalOpen(true)}
          className="px-3.5 py-2 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg flex items-center gap-1.5 self-start sm:self-auto transition-colors shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>New Goal</span>
        </button>
      </div>

      {/* Goal Cards Grid */}
      <div className="space-y-6">
        {goals.length === 0 ? (
          <div className="bg-white dark:bg-neutral-900 rounded-xl p-12 text-center border border-neutral-200/80 dark:border-neutral-800">
            <Sparkles className="w-8 h-8 text-neutral-400 mx-auto mb-2 opacity-60" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No active goals defined yet
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Set 1 or 2 meaningful goals with deadlines to give your month clarity.
            </p>
            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="mt-4 px-3.5 py-1.5 text-xs font-medium bg-neutral-900 text-white rounded-lg"
            >
              Define First Goal
            </button>
          </div>
        ) : (
          goals.map(goal => {
            const total = goal.milestones.length;
            const completedCount = goal.milestones.filter(m => m.completed).length;
            const percent = total > 0 ? Math.round((completedCount / total) * 100) : 0;

            return (
              <div
                key={goal.id}
                className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-5"
              >
                {/* Goal Top Header */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{goal.category}</span>
                      <span aria-hidden="true">·</span>
                      <span className="flex items-center gap-1 tabular-nums">
                        <Calendar className="w-3 h-3" />
                        Target: {formatDatePretty(goal.deadline)}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">
                      {goal.title}
                    </h3>

                    {goal.whyItMatters && (
                      <p className="text-xs text-neutral-600 dark:text-neutral-400 italic mt-1">
                        &ldquo;{goal.whyItMatters}&rdquo;
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100 tabular-nums">
                        {percent}% Complete
                      </div>
                      <div className="text-[11px] text-neutral-500 tabular-nums">
                        {completedCount} of {total} milestones
                      </div>
                    </div>
                    <button
                      onClick={() => deleteGoal(goal.id)}
                      className="p-1.5 text-neutral-400 hover:text-rose-600 rounded"
                      title="Delete goal"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full h-2 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 dark:bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                {/* Milestones List */}
                <div className="space-y-2 pt-1">
                  <h4 className="text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                    Milestones Breakdown
                  </h4>
                  <div className="space-y-1.5">
                    {goal.milestones.map(m => (
                      <div
                        key={m.id}
                        className={`flex items-center justify-between p-2.5 rounded-lg text-xs transition-colors ${
                          m.completed
                            ? 'bg-neutral-50/80 dark:bg-neutral-800/30 text-neutral-400 line-through'
                            : 'bg-neutral-50/40 dark:bg-neutral-800/20 text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100/50'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <button
                            onClick={() => toggleMilestone(goal.id, m.id)}
                            className="text-neutral-400 hover:text-emerald-600 transition-colors shrink-0"
                          >
                            {m.completed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Circle className="w-4 h-4" />
                            )}
                          </button>
                          <span className="truncate">{m.title}</span>
                        </div>

                        {goal.milestones.length > 1 && (
                          <button
                            onClick={() => deleteMilestone(goal.id, m.id)}
                            className="p-1 text-neutral-300 hover:text-red-500 rounded opacity-0 hover:opacity-100 focus:opacity-100 transition-opacity"
                            title="Remove milestone"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Inline Add Milestone Input */}
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="text"
                      value={newMilestoneText[goal.id] || ''}
                      onChange={e =>
                        setNewMilestoneText({
                          ...newMilestoneText,
                          [goal.id]: e.target.value,
                        })
                      }
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          handleAddMilestoneInline(goal.id);
                        }
                      }}
                      placeholder="Add next micro-milestone..."
                      className="flex-1 px-3 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-900"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddMilestoneInline(goal.id)}
                      className="px-3 py-1.5 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 text-neutral-900 dark:text-neutral-100 rounded-lg transition-colors flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <GoalModal isOpen={isGoalModalOpen} onClose={() => setIsGoalModalOpen(false)} />
    </div>
  );
};
