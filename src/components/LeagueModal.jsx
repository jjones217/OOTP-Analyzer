import { useState, useEffect } from 'react';
import { validateLeague } from '../api/statsplus';

const EMPTY = {
  name: '',
  lgurl: '',
  myTeamId: '',
  role: 'gm',
  token: '',
};

const STATSPLUS_DOMAIN = 'statsplus.net';

function extractLgurl(input) {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    const url = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
    // Must be a statsplus.net URL — extract first path segment
    if (url.hostname.endsWith(STATSPLUS_DOMAIN)) {
      const parts = url.pathname.split('/').filter(Boolean);
      return parts[0] ?? '';
    }
    // Raw slug (no domain) — return as-is
    return trimmed;
  } catch {
    return trimmed;
  }
}

function withTimeout(promise, ms, msg) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(msg)), ms)
    ),
  ]);
}

export function LeagueModal({ initial, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(initial ?? EMPTY);
  const [validating, setValidating] = useState(false);
  const [validationMsg, setValidationMsg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    setForm(initial ?? EMPTY);
    setValidationMsg(null);
    setSaveError(null);
  }, [initial]);

  function setField(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'lgurl') setValidationMsg(null);
  }

  const slug = extractLgurl(form.lgurl);

  async function handleValidate() {
    if (!slug) return;
    setValidating(true);
    setValidationMsg(null);
    const result = await validateLeague(slug);
    setValidating(false);
    if (result.valid) {
      setForm((f) => ({ ...f, lgurl: slug }));
      setValidationMsg({ ok: true, text: `Valid league — current date: ${result.currentDate}` });
    } else {
      setValidationMsg({ ok: false, text: `Could not reach this league: ${result.error ?? 'unknown error'}` });
    }
  }

  async function handleSave() {
    if (!form.name || !slug) return;
    setSaving(true);
    setSaveError(null);
    try {
      await withTimeout(
        onSave({ ...form, lgurl: slug, myTeamId: form.myTeamId || null }),
        8000,
        'Save timed out — check your Firebase config and database rules.'
      );
      onClose();
    } catch (err) {
      setSaveError(err.message ?? 'Failed to save. Check Firebase connection.');
    } finally {
      setSaving(false);
    }
  }

  const isEditing = !!initial;
  const canSave = !!form.name && !!slug && !saving;

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
              onChange={(e) => setField('name', e.target.value)}
              placeholder="e.g. GBL"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">StatsPlus URL</span>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                value={form.lgurl}
                onChange={(e) => setField('lgurl', e.target.value)}
                placeholder="statsplus.net/yourleague  or just  yourleague"
                className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={handleValidate}
                disabled={!slug || validating}
                className="shrink-0 px-3 py-2 text-sm rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-40"
              >
                {validating ? '…' : 'Test'}
              </button>
            </div>
            {slug && (
              <p className="text-xs text-gray-400 mt-0.5">
                Slug detected: <span className="font-mono text-gray-600 dark:text-gray-300">{slug}</span>
              </p>
            )}
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
              onChange={(e) => setField('myTeamId', e.target.value)}
              placeholder="Numeric team ID from /api/teams"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">
              Find it at{' '}
              {slug ? (
                <a
                  href={`https://statsplus.net/${slug}/api/teams`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-blue-500 hover:underline"
                >
                  statsplus.net/{slug}/api/teams
                </a>
              ) : (
                <span className="font-mono">statsplus.net/yourleague/api/teams</span>
              )}
            </p>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">My Role</span>
            <select
              value={form.role}
              onChange={(e) => setField('role', e.target.value)}
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="gm">GM</option>
              <option value="commissioner">Commissioner</option>
            </select>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              API Token{' '}
              <span className="font-normal text-gray-400">(optional — enables /ratings & /tradeblock)</span>
            </span>
            <input
              type="password"
              value={form.token}
              onChange={(e) => setField('token', e.target.value)}
              placeholder="From statsplus.net/yourleague → Prefs → API Token"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
            />
            <p className="text-xs text-gray-400 mt-0.5">Tokens expire every 90 days.</p>
          </label>

          {saveError && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3 text-sm text-red-700 dark:text-red-300">
              {saveError}
            </div>
          )}
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
              disabled={!canSave}
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
