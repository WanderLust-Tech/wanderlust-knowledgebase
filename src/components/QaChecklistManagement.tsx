import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { qaChecklistService, QaChecklistRun, CreateRunRequest } from '../services/QaChecklistService';

const emptyForm = (): CreateRunRequest => ({
  appId: '',
  version: '',
});

const QaChecklistManagement: React.FC = () => {
  const navigate = useNavigate();
  const [runs, setRuns] = useState<QaChecklistRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateRunRequest>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await qaChecklistService.getRuns();
      setRuns(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load checklist runs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const run = await qaChecklistService.createRun(form);
      setForm(emptyForm());
      setShowForm(false);
      navigate(`/admin/qa-checklist/${run.id}`);
    } catch (e: any) {
      setError(e.message ?? 'Failed to start checklist run');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (run: QaChecklistRun) => {
    if (!confirm(`Delete the ${run.version} checklist run? This removes all ${run.totalCount} item statuses and can't be undone.`)) return;
    setDeletingId(run.id);
    setError(null);
    try {
      await qaChecklistService.deleteRun(run.id);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to delete checklist run');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QA Checklist Runs</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track manual QA sign-off for each browser release against the full testing checklist.
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          {showForm ? 'Cancel' : '+ Start New Run'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* New run form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Start New Checklist Run</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">App ID</label>
              <input
                type="text"
                value={form.appId}
                onChange={e => setForm(f => ({ ...f, appId: e.target.value }))}
                placeholder="{A1B2C3D4-...}"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version</label>
              <input
                type="text"
                value={form.version}
                onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                placeholder="1.8.30.0"
                required
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
            >
              {submitting ? 'Starting…' : 'Start Run'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyForm()); }}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 text-sm rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Runs table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          No checklist runs yet. Start one to begin QA on a new version.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Version', 'App ID', 'Progress', 'Created', 'Created By', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {runs.map(r => {
                const pct = r.totalCount > 0 ? Math.round((r.completedCount / r.totalCount) * 100) : 0;
                const isDone = r.totalCount > 0 && r.completedCount === r.totalCount;
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap">{r.version}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate font-mono text-xs">{r.appId}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-32 h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isDone ? 'bg-green-500' : 'bg-blue-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {r.completedCount}/{r.totalCount}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {new Date(r.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{r.createdBy ?? '—'}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => navigate(`/admin/qa-checklist/${r.id}`)}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.id}
                          className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                        >
                          {deletingId === r.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default QaChecklistManagement;
