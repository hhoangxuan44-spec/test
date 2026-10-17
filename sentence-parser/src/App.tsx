import { useCallback, useEffect, useState } from 'react';
import type { PublicSettings } from '../shared/api';
import { api } from './api';
import { ErrorBox, Spinner } from './components/ui';
import { HistoryPage } from './pages/HistoryPage';
import { PracticePage } from './pages/PracticePage';
import { SettingsPage } from './pages/SettingsPage';

interface Route {
  page: 'practice' | 'history' | 'settings';
  id: string | null;
}

function parse(hash: string): Route {
  const [page, id] = hash.replace(/^#\/?/, '').split('/');
  if (page === 'history' || page === 'settings') return { page, id: null };
  return { page: 'practice', id: id ? decodeURIComponent(id) : null };
}

const NAV: Array<{ page: Route['page']; label: string; hash: string }> = [
  { page: 'practice', label: '练习', hash: '#/practice' },
  { page: 'history', label: '记录', hash: '#/history' },
  { page: 'settings', label: '设置', hash: '#/settings' },
];

function StatusPill({ ok, label }: { ok: boolean; label: string }) {
  return (
    <a href="#/settings" className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 hover:border-slate-300">
      <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
      {label}
    </a>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  const [settings, setSettings] = useState<PublicSettings | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    const onHash = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Updates the route in the same render batch as the caller's state, so pages never see a stale id.
  const navigate = useCallback((hash: string) => {
    if (window.location.hash !== hash) window.location.hash = hash;
    setRoute(parse(hash));
  }, []);

  const loadSettings = useCallback(() => {
    api
      .settings()
      .then((s) => {
        setError(null);
        setSettings(s);
      })
      .catch(setError);
  }, []);
  useEffect(loadSettings, [loadSettings]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <a href="#/practice" className="text-base font-semibold text-slate-900">
            长难句 <span className="text-indigo-600">×</span> 墨墨
          </a>
          <nav className="flex gap-1">
            {NAV.map((n) => (
              <a
                key={n.page}
                href={n.hash}
                aria-current={route.page === n.page ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm ${route.page === n.page ? 'bg-indigo-50 font-medium text-indigo-700' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {n.label}
              </a>
            ))}
          </nav>
          {settings && (
            <div className="ml-auto flex gap-2">
              <StatusPill ok={settings.maimemoConfigured} label={settings.maimemoConfigured ? '墨墨已连接' : '墨墨未连接'} />
              <StatusPill
                ok={settings.llmConfigured}
                label={settings.llmConfigured ? (settings.llmProvider === 'anthropic' ? settings.anthropicModel : settings.openaiModel) : 'AI 未配置'}
              />
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6">
        {error ? (
          <ErrorBox error={error} onRetry={loadSettings} />
        ) : !settings ? (
          <Spinner className="text-slate-400" />
        ) : route.page === 'settings' ? (
          <SettingsPage settings={settings} onSaved={setSettings} />
        ) : route.page === 'history' ? (
          <HistoryPage navigate={navigate} />
        ) : (
          <PracticePage settings={settings} sentenceId={route.id} navigate={navigate} />
        )}
      </main>
    </div>
  );
}
