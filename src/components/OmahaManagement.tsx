import React, { useEffect, useState } from 'react';
import { releasesService, BrowserRelease, CreateReleaseRequest } from '../services/ReleasesService';

const PLATFORMS = ['win', 'linux', 'mac'];
const ARCHS = ['x64', 'x86', 'arm64'];

const emptyForm = (): CreateReleaseRequest => ({
  appId: '',
  version: '',
  platform: 'win',
  arch: 'x64',
  installerName: '',
  installerUrl: '',
  hashSha256: '',
  sizeBytes: 0,
});

const OmahaManagement: React.FC = () => {
  const [releases, setReleases] = useState<BrowserRelease[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateReleaseRequest>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [deactivating, setDeactivating] = useState<number | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await releasesService.getAll();
      setReleases(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load releases');
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
      await releasesService.create(form);
      setForm(emptyForm());
      setShowForm(false);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create release');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeactivate = async (id: number) => {
    if (!confirm('Deactivate this release? Clients will no longer receive it.')) return;
    setDeactivating(id);
    setError(null);
    try {
      await releasesService.deactivate(id);
      await load();
    } catch (e: any) {
      setError(e.message ?? 'Failed to deactivate release');
    } finally {
      setDeactivating(null);
    }
  };

  const field = (key: keyof CreateReleaseRequest, label: string, type = 'text', extra?: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <input
        type={type}
        value={form[key] as string | number}
        onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        {...extra}
      />
    </div>
  );

  const select = (key: keyof CreateReleaseRequest, label: string, options: string[]) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{label}</label>
      <select
        value={form[key] as string}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
      >
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Omaha Release Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage browser releases served via the Omaha v4 update endpoint.
          </p>
        </div>
        <button
          onClick={() => setShowForm(f => !f)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Release'}
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* New release form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 p-5 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">New Release</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('appId', 'App ID', 'text', { placeholder: '{A1B2C3D4-...}', required: true })}
            {field('version', 'Version', 'text', { placeholder: '1.0.0.0', required: true })}
            {select('platform', 'Platform', PLATFORMS)}
            {select('arch', 'Architecture', ARCHS)}
            {field('installerName', 'Installer Filename', 'text', { placeholder: 'wanderlust-setup-1.0.0.0-win-x64.exe', required: true })}
            {field('installerUrl', 'Installer URL', 'url', { placeholder: 'https://cdn.example.com/releases/...', required: true })}
            {field('hashSha256', 'SHA-256 Hash', 'text', { placeholder: 'a1b2c3d4...', required: true })}
            {field('sizeBytes', 'Size (bytes)', 'number', { min: 1, required: true })}
          </div>
          <div className="mt-4 flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-md transition-colors"
            >
              {submitting ? 'Publishing…' : 'Publish Release'}
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

      {/* Releases table */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          No releases found. Publish one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Version', 'Platform', 'Arch', 'Installer', 'Size', 'Status', 'Created', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {releases.map(r => (
                <tr key={r.id} className={r.isActive ? '' : 'opacity-50'}>
                  <td className="px-4 py-3 font-mono font-medium text-gray-900 dark:text-white whitespace-nowrap">{r.version}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.platform}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">{r.arch}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    <a href={r.installerUrl} target="_blank" rel="noreferrer" className="hover:underline text-blue-600 dark:text-blue-400">
                      {r.installerName}
                    </a>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">
                    {(r.sizeBytes / 1_048_576).toFixed(1)} MB
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                      r.isActive
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {new Date(r.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {r.isActive && (
                      <button
                        onClick={() => handleDeactivate(r.id)}
                        disabled={deactivating === r.id}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                      >
                        {deactivating === r.id ? 'Deactivating…' : 'Deactivate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default OmahaManagement;
