import React, { useState } from 'react';
import {
  Settings as SettingsIcon,
  User,
  Palette,
  Volume2,
  RotateCcw,
  Download,
  Upload,
  AlertTriangle,
  Check,
  ShieldCheck,
  RefreshCw,
  LogOut,
  KeyRound,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../context/SubscriptionContext';
import { AppTheme } from '../../types';
import { StorageService } from '../../services/storage';

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    resetAllData,
    restoreSampleData,
  } = useApp();
  const { user, logOut } = useAuth();
  const { status: subscriptionStatus, subscription, refreshStatus } = useSubscription();

  const [nameInput, setNameInput] = useState(settings.userName);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [exportNotice, setExportNotice] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    updateSettings({ userName: nameInput.trim() });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  const handleExportData = () => {
    const json = StorageService.exportAllDataJson(user?.uid);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `life-reset-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setExportNotice(true);
    setTimeout(() => setExportNotice(false), 2000);
  };

  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const content = event.target?.result as string;
      if (content) {
        const success = StorageService.importDataJson(content, user?.uid);
        if (success) {
          window.location.reload();
        } else {
          setImportError('Invalid JSON backup file format.');
        }
      }
    };
    reader.readAsText(file);
  };

  const themes: { id: AppTheme; label: string; desc: string; previewClass: string }[] = [
    {
      id: 'stone',
      label: 'Warm Stone',
      desc: 'Serene warm parchment with deep charcoal type',
      previewClass: 'bg-[#faf9f6] border-[#e7e5e4] text-[#1c1917]',
    },
    {
      id: 'slate',
      label: 'Cool Slate',
      desc: 'Crisp modern executive light palette',
      previewClass: 'bg-[#f8fafc] border-[#e2e8f0] text-[#0f172a]',
    },
    {
      id: 'sage',
      label: 'Botanical Sage',
      desc: 'Calming eucalyptus tone to ease high anxiety',
      previewClass: 'bg-[#f4f7f4] border-[#d8e2dc] text-[#1b4332]',
    },
    {
      id: 'dark',
      label: 'Midnight Dark',
      desc: 'Gentle low-luminance dark canvas for night focus',
      previewClass: 'bg-[#18181b] border-[#27272a] text-[#fafafa]',
    },
  ];

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-20">
      {/* Header */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 border border-neutral-200/80 dark:border-neutral-800 shadow-xs">
        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400">
          <SettingsIcon className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
          <span>App Preferences</span>
        </div>
        <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100 mt-1">
          Settings & Environment
        </h2>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
          Customize your experience, adjust audio feedback, switch visual themes, and manage your data ownership.
        </p>
      </div>

      {/* 0. Account & Authentication */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Account & Authentication
            </h3>
          </div>
          <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
            Authenticated
          </span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/60 text-xs">
          <div>
            <div className="text-[11px] text-neutral-400">Signed in email:</div>
            <div className="font-semibold text-neutral-900 dark:text-neutral-100 text-sm">
              {user?.email || 'Anonymous / Guest'}
            </div>
            <div className="text-[10px] text-neutral-500 mt-0.5">
              Provider: {user?.providerData?.[0]?.providerId === 'google.com' ? 'Google Account' : 'Email & Password'}
            </div>
          </div>

          <button
            type="button"
            onClick={() => logOut()}
            className="px-4 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:text-rose-700 bg-white dark:bg-neutral-800 border border-rose-200 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition-colors flex items-center gap-2 self-start sm:self-auto shadow-xs"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out of Account</span>
          </button>
        </div>
      </div>

      {/* 0.5 Subscription & Billing Status */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Membership & Subscription
            </h3>
          </div>
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
            subscriptionStatus === 'active'
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300 border-neutral-300 dark:border-neutral-700'
          }`}>
            {subscriptionStatus === 'active' ? 'Active Paid Access' : `Status: ${subscriptionStatus}`}
          </span>
        </div>

        <div className="p-4 rounded-xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-700/60 space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                {subscription?.planTitle || 'Life Reset Unlimited Access'}
              </div>
              <div className="text-[11px] text-neutral-500 mt-0.5">
                Pricing: $9.99 USD / month recurring
              </div>
            </div>

            <button
              type="button"
              onClick={() => refreshStatus()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 transition self-start sm:self-auto"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Access Status</span>
            </button>
          </div>

          {subscription?.currentPeriodEnd && (
            <div className="text-[11px] text-neutral-500 pt-1 border-t border-neutral-200/60 dark:border-neutral-700/60">
              Current Period Ends: <span className="font-mono text-neutral-700 dark:text-neutral-300">{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {/* 1. Profile / Display Name */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Personal Identity
          </h3>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-3 max-w-md">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
              What should Life Reset call you?
            </label>
            <input
              type="text"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full px-3.5 py-2 text-xs rounded-lg bg-neutral-50 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-xs font-medium bg-neutral-900 hover:bg-neutral-800 dark:bg-neutral-100 dark:hover:bg-neutral-200 text-white dark:text-neutral-900 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            {savedSuccess ? <Check className="w-3.5 h-3.5" /> : null}
            <span>{savedSuccess ? 'Saved Name' : 'Update Name'}</span>
          </button>
        </form>
      </div>

      {/* 2. Visual Theme Switcher */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Appearance & Aesthetic Theme
          </h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {themes.map(t => {
            const isCurrent = settings.theme === t.id;
            return (
              <button
                key={t.id}
                onClick={() => updateSettings({ theme: t.id })}
                className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${t.previewClass} ${
                  isCurrent
                    ? 'ring-2 ring-neutral-900 dark:ring-neutral-100 shadow-sm'
                    : 'opacity-70 hover:opacity-100'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{t.label}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
                        Active
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] opacity-80 mt-1">{t.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Audio & Focus Preferences */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-neutral-500" />
          <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
            Audio Feedback & Soundscapes
          </h3>
        </div>

        <div className="space-y-3 max-w-md">
          <label className="flex items-center justify-between p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-200/60 dark:border-neutral-700/60 cursor-pointer">
            <div>
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                Gentle Audio Feedback
              </div>
              <div className="text-[11px] text-neutral-500">
                Play subtle harmonic singing bowl chime on timer and task completion.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.soundEnabled}
              onChange={e => updateSettings({ soundEnabled: e.target.checked })}
              className="w-4 h-4 rounded text-neutral-900 dark:text-neutral-100"
            />
          </label>
        </div>
      </div>

      {/* 4. Data Ownership & Backup */}
      <div className="bg-white dark:bg-neutral-900 rounded-xl border border-neutral-200/80 dark:border-neutral-800 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Download className="w-4 h-4 text-neutral-500" />
            <h3 className="text-sm font-bold text-neutral-900 dark:text-neutral-100">
              Data Portability & Backup
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>100% Client-Side Persistent</span>
          </div>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          Your tasks, habits, and reflections are securely stored in your local browser storage. You can export a JSON backup at any time or restore on a new machine.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            onClick={handleExportData}
            className="px-3.5 py-2 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg flex items-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{exportNotice ? 'Exported Backup!' : 'Export JSON Backup'}</span>
          </button>

          <label className="px-3.5 py-2 text-xs font-medium bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-900 dark:text-neutral-100 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors">
            <Upload className="w-3.5 h-3.5" />
            <span>Import JSON Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportData}
              className="hidden"
            />
          </label>

          <button
            onClick={restoreSampleData}
            className="px-3.5 py-2 text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-lg flex items-center gap-1.5 transition-colors"
            title="Reload initial demo dataset"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Restore Demo Data</span>
          </button>
        </div>

        {importError && (
          <p className="text-xs text-rose-600 mt-2">{importError}</p>
        )}
      </div>

      {/* 5. Danger Zone: Reset Data */}
      <div className="bg-rose-50/40 dark:bg-rose-950/20 rounded-xl border border-rose-200/70 dark:border-rose-900/40 p-6 shadow-xs space-y-3">
        <div className="flex items-center gap-2 text-rose-800 dark:text-rose-400">
          <AlertTriangle className="w-4 h-4" />
          <h3 className="text-sm font-bold">Danger Zone: Reset All Data</h3>
        </div>
        <p className="text-xs text-rose-700/80 dark:text-rose-400/80 max-w-lg leading-relaxed">
          Clear all tasks, goals, habits, and weekly plans from this browser. This cannot be undone unless you have an exported backup.
        </p>

        {showResetConfirm ? (
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => {
                resetAllData();
                setShowResetConfirm(false);
              }}
              className="px-4 py-2 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
            >
              Confirm Complete Reset
            </button>
            <button
              onClick={() => setShowResetConfirm(false)}
              className="px-3 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:underline"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3.5 py-2 text-xs font-semibold text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800/80 rounded-lg hover:bg-rose-100/50 dark:hover:bg-rose-900/30 transition-colors flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Everything to Blank</span>
          </button>
        )}
      </div>
    </div>
  );
};
