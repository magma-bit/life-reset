import React, { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Plus,
  Search,
  Filter,
  Calendar,
  Star,
  Trash2,
  Edit2,
  Zap,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Priority, TaskCategory, Task } from '../../types';
import { getTodayDateString, formatDatePretty } from '../../utils/date';

export const TasksView: React.FC = () => {
  const {
    tasks,
    addTask,
    toggleTaskComplete,
    toggleTaskTopPriority,
    openTaskModal,
    deleteTask,
    setActiveFocusTask,
    setCurrentView,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'completed'>('all');
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<TaskCategory | 'all'>('all');

  // Quick inline add state
  const [quickTitle, setQuickTitle] = useState('');

  const handleQuickAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) return;

    addTask({
      title: quickTitle.trim(),
      category: 'Career & Work',
      priority: 'Medium',
      dueDate: getTodayDateString(),
      completed: false,
    });
    setQuickTitle('');
  };

  const filteredTasks = useMemo(() => {
    return tasks.filter(task => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesNotes = task.notes?.toLowerCase().includes(q);
        const matchesCat = task.category.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNotes && !matchesCat) return false;
      }
      // Status
      if (statusFilter === 'pending' && task.completed) return false;
      if (statusFilter === 'completed' && !task.completed) return false;
      // Priority
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false;
      // Category
      if (categoryFilter !== 'all' && task.category !== categoryFilter) return false;

      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, categoryFilter]);

  const handleFocusNow = (task: Task) => {
    setActiveFocusTask(task);
    setCurrentView('anti-procrastination');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Header and Quick Add */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
              Task Masterlist
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              Capture everything out of your mind into concrete, clear actions.
            </p>
          </div>
          <button
            onClick={() => openTaskModal()}
            className="px-3.5 py-2 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg flex items-center gap-1.5 self-start sm:self-auto transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Detailed Task</span>
          </button>
        </div>

        {/* Quick inline capture input */}
        <form onSubmit={handleQuickAdd} className="relative">
          <input
            type="text"
            value={quickTitle}
            onChange={e => setQuickTitle(e.target.value)}
            placeholder="Quick capture: type a task and press Enter (defaults to today)..."
            className="w-full pl-4 pr-24 py-2.5 text-sm rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 transition-colors"
          />
          <button
            type="submit"
            disabled={!quickTitle.trim()}
            className="absolute right-2 top-2 px-3 py-1 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded text-xs font-medium disabled:opacity-40 transition-opacity"
          >
            Add
          </button>
        </form>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-4 border border-neutral-200/80 dark:border-neutral-800 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-900"
            />
          </div>

          {/* Segmented Status Filter (Interactive Button Group) */}
          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg self-start md:self-auto">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              All ({tasks.length})
            </button>
            <button
              onClick={() => setStatusFilter('pending')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'pending'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Pending ({tasks.filter(t => !t.completed).length})
            </button>
            <button
              onClick={() => setStatusFilter('completed')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'completed'
                  ? 'bg-white dark:bg-neutral-700 text-neutral-900 dark:text-neutral-100 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
              }`}
            >
              Completed ({tasks.filter(t => t.completed).length})
            </button>
          </div>
        </div>

        {/* Dropdown Filters for Priority and Category */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-neutral-100 dark:border-neutral-800 text-xs text-neutral-500">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            <span>Priority:</span>
            <select
              value={priorityFilter}
              onChange={e => setPriorityFilter(e.target.value as Priority | 'all')}
              className="bg-transparent text-neutral-800 dark:text-neutral-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          <span aria-hidden="true" className="text-neutral-300 dark:text-neutral-700">|</span>

          <div className="flex items-center gap-1.5">
            <span>Category:</span>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value as TaskCategory | 'all')}
              className="bg-transparent text-neutral-800 dark:text-neutral-200 font-medium focus:outline-none cursor-pointer"
            >
              <option value="all">All Categories</option>
              <option value="Career & Work">Career & Work</option>
              <option value="Personal">Personal</option>
              <option value="Health & Mind">Health & Mind</option>
              <option value="Errands & Admin">Errands & Admin</option>
              <option value="Finance">Finance</option>
              <option value="Creative">Creative</option>
            </select>
          </div>

          {(priorityFilter !== 'all' || categoryFilter !== 'all' || searchQuery.trim()) && (
            <button
              onClick={() => {
                setPriorityFilter('all');
                setCategoryFilter('all');
                setSearchQuery('');
              }}
              className="ml-auto text-[11px] text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Task List */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 divide-y divide-neutral-100 dark:divide-neutral-800 shadow-xs overflow-hidden">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No tasks match your filters
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Try adjusting your query or create a new task.
            </p>
          </div>
        ) : (
          filteredTasks.map(task => (
            <div
              key={task.id}
              className={`p-4 flex items-start justify-between gap-3 transition-colors ${
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
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
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

                  {task.notes && (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 line-clamp-2">
                      {task.notes}
                    </p>
                  )}

                  {/* Clean unboxed metadata with typographic separators */}
                  <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400 mt-1.5">
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
                    <span aria-hidden="true">·</span>
                    <span className="flex items-center gap-1 tabular-nums">
                      <Calendar className="w-3 h-3 text-neutral-400" />
                      {formatDatePretty(task.dueDate)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-1 shrink-0">
                {!task.completed && (
                  <button
                    onClick={() => handleFocusNow(task)}
                    className="p-1.5 text-neutral-400 hover:text-emerald-600 dark:hover:text-emerald-400 rounded transition-colors"
                    title="Focus on this task now"
                  >
                    <Zap className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => toggleTaskTopPriority(task.id)}
                  className={`p-1.5 rounded transition-colors ${
                    task.isTopPriority
                      ? 'text-amber-500'
                      : 'text-neutral-400 hover:text-amber-500'
                  }`}
                  title={task.isTopPriority ? 'Unpin from Top 3' : 'Pin to Top 3'}
                >
                  <Star className="w-4 h-4" />
                </button>

                <button
                  onClick={() => openTaskModal(task)}
                  className="p-1.5 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 rounded transition-colors"
                  title="Edit task"
                >
                  <Edit2 className="w-4 h-4" />
                </button>

                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1.5 text-neutral-400 hover:text-rose-600 rounded transition-colors"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
