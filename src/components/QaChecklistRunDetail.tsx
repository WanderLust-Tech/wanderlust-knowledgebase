import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { qaChecklistService, QaChecklistRun, QaChecklistRunItem } from '../services/QaChecklistService';

interface FeatureGroup {
  featureName: string;
  items: QaChecklistRunItem[];
}

interface CategoryGroup {
  category: string;
  features: FeatureGroup[];
  completed: number;
  total: number;
}

const groupItems = (items: QaChecklistRunItem[]): CategoryGroup[] => {
  const categories = new Map<string, Map<string, QaChecklistRunItem[]>>();

  for (const item of items) {
    if (!categories.has(item.category)) categories.set(item.category, new Map());
    const features = categories.get(item.category)!;
    if (!features.has(item.featureName)) features.set(item.featureName, []);
    features.get(item.featureName)!.push(item);
  }

  return Array.from(categories.entries()).map(([category, features]) => {
    const featureGroups = Array.from(features.entries()).map(([featureName, items]) => ({ featureName, items }));
    const allItems = featureGroups.flatMap(f => f.items);
    return {
      category,
      features: featureGroups,
      completed: allItems.filter(i => i.isComplete).length,
      total: allItems.length,
    };
  });
};

const QaChecklistRunDetail: React.FC = () => {
  const { runId } = useParams<{ runId: string }>();
  const navigate = useNavigate();
  const [run, setRun] = useState<QaChecklistRun | null>(null);
  const [items, setItems] = useState<QaChecklistRunItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  const load = async () => {
    if (!runId) return;
    try {
      setLoading(true);
      setError(null);
      const detail = await qaChecklistService.getRun(Number(runId));
      setRun(detail.run);
      setItems(detail.items);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load checklist run');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [runId]);

  const categories = useMemo(() => groupItems(items), [items]);
  const totalCompleted = items.filter(i => i.isComplete).length;
  const totalPct = items.length > 0 ? Math.round((totalCompleted / items.length) * 100) : 0;

  const toggleCategory = (category: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category); else next.add(category);
      return next;
    });
  };

  const handleToggleItem = async (item: QaChecklistRunItem) => {
    if (!runId) return;
    const nextComplete = !item.isComplete;
    setSavingId(item.id);
    setError(null);
    try {
      const notes = notesDraft[item.id] ?? item.notes ?? undefined;
      await qaChecklistService.setItemStatus(Number(runId), item.id, nextComplete, notes);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, isComplete: nextComplete } : i));
    } catch (e: any) {
      setError(e.message ?? 'Failed to update item');
    } finally {
      setSavingId(null);
    }
  };

  const handleNotesBlur = async (item: QaChecklistRunItem) => {
    if (!runId) return;
    const notes = notesDraft[item.id];
    if (notes === undefined || notes === (item.notes ?? '')) return;
    setSavingId(item.id);
    setError(null);
    try {
      await qaChecklistService.setItemStatus(Number(runId), item.id, item.isComplete, notes);
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, notes } : i));
    } catch (e: any) {
      setError(e.message ?? 'Failed to save notes');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center text-gray-500 dark:text-gray-400">
        Checklist run not found.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <button
        onClick={() => navigate('/admin/qa-checklist')}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        ← Back to runs
      </button>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          QA Checklist — {run.version}
        </h1>
        <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{run.appId}</span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Started {new Date(run.createdAt).toLocaleString()}{run.createdBy ? ` by ${run.createdBy}` : ''}
      </p>

      {/* Overall progress */}
      <div className="mb-6 p-4 border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Overall Progress</span>
          <span className="text-sm text-gray-500 dark:text-gray-400 font-mono">{totalCompleted}/{items.length} ({totalPct}%)</span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className={`h-full rounded-full ${totalPct === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
            style={{ width: `${totalPct}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {categories.map(cat => {
          const isCollapsed = collapsed.has(cat.category);
          const catDone = cat.completed === cat.total;
          return (
            <div key={cat.category} className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleCategory(cat.category)}
                className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`transform transition-transform text-gray-400 ${isCollapsed ? '' : 'rotate-90'}`}>▶</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{cat.category}</span>
                </div>
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${
                  catDone
                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}>
                  {cat.completed}/{cat.total}
                </span>
              </button>

              {!isCollapsed && (
                <div className="divide-y divide-gray-100 dark:divide-gray-800">
                  {cat.features.map(feature => (
                    <div key={feature.featureName} className="p-4">
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">{feature.featureName}</h3>
                      <ul className="space-y-2">
                        {feature.items.map(item => (
                          <li key={item.id} className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={item.isComplete}
                              disabled={savingId === item.id}
                              onChange={() => handleToggleItem(item)}
                              className="mt-1 h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex-1 min-w-0">
                              <span className={`text-sm ${item.isComplete ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-800 dark:text-gray-200'}`}>
                                {item.itemText}
                              </span>
                              <input
                                type="text"
                                placeholder="Notes (optional)"
                                value={notesDraft[item.id] ?? item.notes ?? ''}
                                onChange={e => setNotesDraft(prev => ({ ...prev, [item.id]: e.target.value }))}
                                onBlur={() => handleNotesBlur(item)}
                                className="mt-1 w-full px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                              />
                              {item.isComplete && item.completedBy && (
                                <span className="block mt-1 text-xs text-gray-400 dark:text-gray-500">
                                  Checked by {item.completedBy}{item.completedAt ? ` on ${new Date(item.completedAt).toLocaleDateString()}` : ''}
                                </span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default QaChecklistRunDetail;
