import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { useAuth } from '../AuthContext';
import { useTheme } from '../ThemeContext';
import { X, Globe, User, Check, Sun, Moon } from 'lucide-react';

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

export default function UserSettings({ onClose }: { onClose: () => void }) {
  const { user, profile } = useAuth();
  const { theme, setTheme, followsSystem, setFollowSystem, availableThemes } = useTheme();

  const browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const allTimezones = Array.from(new Set([browserTz, ...COMMON_TIMEZONES])).sort();

  const [displayName, setDisplayName] = useState(profile?.displayName || user?.displayName || '');
  const [employeeId, setEmployeeId] = useState(profile?.employeeId || '');
  const [timezone, setTimezone] = useState(profile?.timezone || browserTz);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: displayName.trim() || user.displayName || 'Team Member',
        employeeId: employeeId.trim() || null,
        timezone,
      });
      setSavedMessage(true);
      setTimeout(() => {
        setSavedMessage(false);
        onClose();
      }, 600);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-surface-2 border border-main-border rounded-xl shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-main-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-main-text">Profile & Preferences</h2>
            <p className="text-xs text-main-text-muted mt-0.5">
              Customize your display info, local timezone, and workspace theme.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-main-text-muted hover:text-main-text hover:bg-surface-3"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-5">
          <div>
            <label className="block text-xs font-medium text-main-text mb-1.5">
              Full Name
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-main-text-muted absolute left-3 top-3" />
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                className="input-field pl-9"
              />
            </div>
          </div>

          <div>
            <label htmlFor="usersettings-field-1" className="block text-xs font-medium text-main-text mb-1.5">
              Employee ID (Optional)
            </label>
            <input id="usersettings-field-1"
              type="text"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              placeholder="e.g. EMP-104"
              className="input-field font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-main-text mb-1.5">
              Your Local Timezone
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 text-main-text-muted absolute left-3 top-3" />
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="input-field pl-9"
              >
                {allTimezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-xs text-main-text-muted mt-1.5">
              All shift times are automatically converted to this timezone.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-medium text-main-text">
                Workspace Appearance
              </label>
              <button
                type="button"
                onClick={setFollowSystem}
                aria-pressed={followsSystem}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                  followsSystem
                    ? 'border-primary bg-primary-subtle text-primary font-semibold'
                    : 'border-main-border bg-surface-1 text-main-text-muted hover:text-main-text'
                }`}
              >
                Follow system
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {availableThemes.map((opt) => {
                const isSelected = !followsSystem && theme === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTheme(opt.id)}
                    className={`p-3 rounded-lg border text-left transition-opacity cursor-pointer ${
                      isSelected
                        ? 'border-primary bg-primary-subtle'
                        : 'border-main-border bg-surface-1 hover:border-main-border-strong'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-main-text flex items-center gap-1.5">
                        {opt.mode === 'dark' ? (
                          <Moon className="w-3.5 h-3.5 text-primary" />
                        ) : (
                          <Sun className="w-3.5 h-3.5 text-primary" />
                        )}
                        {opt.name}
                      </span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-primary" />}
                    </div>
                    <p className="text-[11px] text-main-text-muted leading-snug">
                      {opt.id === 'amoled'
                        ? 'True #000000 OLED canvas'
                        : opt.mode === 'dark'
                          ? 'Graphite studio dark'
                          : 'Porcelain warm daylight'}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-main-border">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex items-center gap-1.5">
              {savedMessage ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Saved</span>
                </>
              ) : saving ? (
                <span>Saving...</span>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
