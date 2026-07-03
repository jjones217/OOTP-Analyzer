import { useState, useEffect } from 'react';
import { validateLeague } from '../api/statsplus';

const EMPTY = {
  name: '',
  lgurl: '',
  myTeamId: '',
  role: 'gm',
  token: '',
};

function extractLgurl(input) {
  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    // e.g. statsplus.net/usba → pathname = /usba
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length > 0) return parts[0];
  } catch {
    // treat as raw slug
  }
  return input.trim();
}

export function LeagueModal({ initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(initial ?? EMPTY);
    setValidationMsg(null);
  }, [initial]);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'lgurl') setValidationMsg(null);
  }

  async function handleValidate() {
    const slug = extractLgurl(form.lgurl);
    if (!slug) return;
    setValidating(true);
    setValidationMsg(null);
    const result = await validateLeague(slug);
    setValidating(false);
    if (result.valid) {
      setForm((f) => ({ ...f, lgurl: slug }));
      setValidationMsg({ ok: true, text: `Valid league. Current date: ${result.currentDate}` });
    } else {
      setValidationMsg({ ok: false, text: 'Could not reach this league. Check the URL and try again.' });
    }
  }

  async function handleSave() {
    if (!form.name || !form.lgurl) return;
    setSaving(true);
    const slug = extractLgurl(form.lgurl);
    await onSave({ ...form, lgurl: slug, myTeamId: form.myTeamId || null });
    setSaving(false);
    onClose();
  }

  const isEditing = !!initial;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-md">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? 'Edit League' : 'Add League'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Display Name</span>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. USBA"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">StatsPlus URL</span>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={form.lgurl}
                onChange={(e) => set('lgurl', e.target.value)}
                placeholder="statsplus.net/yourleague  or just  yourleague"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={!form.lgurl || validating}
                className="shrink-0 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
              >
                {validating ? '…' : 'Test'}
              </button>
            </div>
            {validationMsg && (
              <p className={`text-xs mt-1 ${validationMsg.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {validationMsg.text}
              </p>
            )}
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">My Team ID</span>
            <input
              type="number"
              value={form.myTeamId}
              onChange={(e) => set('myTeamId', e.target.value)}
              placeholder="Numeric team ID from /api/teams"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Find it at statsplus.net/{extractLgurl(form.lgurl) || 'yourleague'}/api/teams
            </p>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">My Role</span>
            <select
              value={form.role}
              onChange={(e) => set('role', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gm">GM</option>
              <option value="commissioner">Commissioner</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              API Token <span className="font-normal text-gray-400">(optional — enables /ratings & /tradeblock)</span>
            </span>
            <input
              type="password"
              value={form.token}
              onChange={(e) => set('token', e.target.value)}
              placeholder="From statsplus.net/yourleague → Prefs → API Token"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-xs text-gray-400 mt-0.5">Tokens expire every 90 days.</p>
          </label>
        </div>

        <div className="p-5 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            {isEditing && onDelete && (
              <button
                onClick={() => { onDelete(); onClose(); }}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Remove league
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!form.name || !form.lgurl || saving}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
            >
              {saving ? 'Saving…' : isEditing ? 'Save changes' : 'Add league'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
