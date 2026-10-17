import { useState, type ReactNode } from 'react';
import type { Effort, PublicSettings, Settings } from '../../shared/api';
import { EXAM_LEVELS, isExamLevel } from '../../shared/types';
import { api } from '../api';
import { Button, Card, ErrorBox, Notice, Segmented } from '../components/ui';

const CLAUDE_MODELS = [
  { id: 'claude-opus-5-5', note: '推荐：分析最准确' },
  { id: 'claude-sonnet-5-5', note: '更快、更省' },
  { id: 'claude-haiku-5-5', note: '最便宜，复杂句可能出错' },
];

const EFFORTS: Array<{ value: Effort; label: string }> = [
  { value: 'low', label: '快' },
  { value: 'medium', label: '标准' },
  { value: 'high', label: '更仔细' },
];

const PRESETS = [
  { name: 'DeepSeek', baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  { name: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
];

type Draft = Settings;

function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="flex gap-2">
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} className={`${inputCls} font-mono`} />
      {value && (
        <Button variant="ghost" className="shrink-0" onClick={() => onChange('')}>
          清除
        </Button>
      )}
    </div>
  );
}

export function SettingsPage({ settings, onSaved }: { settings: PublicSettings; onSaved: (s: PublicSettings) => void }) {
  const [draft, setDraft] = useState<Draft>(() => ({ ...settings }));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await api.saveSettings(draft);
      onSaved(next);
      setDraft({ ...next });
      setSaved(true);
      return next;
    } catch (e) {
      setError(e);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const testMaimemo = async () => {
    setTestResult(null);
    const next = await save();
    if (!next?.maimemoConfigured) return;
    setTesting(true);
    try {
      const { progress } = await api.testMaimemo();
      setTestResult(`连接成功！墨墨今日进度 ${progress.finished} / ${progress.total}`);
    } catch (e) {
      setError(e);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">墨墨背单词</h2>
        <Notice>
          打开墨墨背单词 App →「我的」→「更多设置」→「实验功能」→「开放 API」，复制你的专属 Token 粘贴到这里。Token 只保存在本机的 <code>data/settings.json</code> 里，只用来访问墨墨开放平台。
        </Notice>
        <Field label="开放 API Token">
          <SecretInput value={draft.maimemoToken} onChange={(v) => set('maimemoToken', v)} placeholder="粘贴墨墨开放 API Token" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="secondary" onClick={() => void testMaimemo()} busy={testing} disabled={!draft.maimemoToken}>
            保存并测试连接
          </Button>
          {testResult && <span className="text-sm text-emerald-700">{testResult}</span>}
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">AI 模型</h2>
        <p className="text-sm text-slate-600">用来根据你的单词写长难句、拆解你粘贴的句子、批改翻译。真题句库不需要 AI。</p>
        <Segmented
          value={draft.llmProvider}
          onChange={(v) => set('llmProvider', v)}
          options={[
            { value: 'anthropic', label: 'Claude（Anthropic）' },
            { value: 'openai', label: 'OpenAI 兼容接口（DeepSeek、通义千问等）' },
          ]}
        />
        {draft.llmProvider === 'anthropic' ? (
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Anthropic API Key" hint="也可以在 .env 里设置 ANTHROPIC_API_KEY；如需代理，见 README。">
              <SecretInput value={draft.anthropicApiKey} onChange={(v) => set('anthropicApiKey', v)} placeholder="sk-ant-…" />
            </Field>
            <Field label="模型" hint={CLAUDE_MODELS.find((m) => m.id === draft.anthropicModel)?.note}>
              <input list="claude-models" value={draft.anthropicModel} onChange={(e) => set('anthropicModel', e.target.value)} className={inputCls} />
              <datalist id="claude-models">
                {CLAUDE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.note}
                  </option>
                ))}
              </datalist>
            </Field>
            <Field label="思考强度" hint="越仔细越准确，但更慢、费用更高。">
              <Segmented value={draft.anthropicEffort} onChange={(v) => set('anthropicEffort', v)} options={EFFORTS} />
            </Field>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-600">快速填入：</span>
              {PRESETS.map((p) => (
                <Button
                  key={p.name}
                  variant="secondary"
                  onClick={() => {
                    set('openaiBaseUrl', p.baseUrl);
                    set('openaiModel', p.model);
                  }}
                >
                  {p.name}
                </Button>
              ))}
              <span className="text-xs text-slate-500">模型名以服务商文档为准</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="接口地址（Base URL）">
                <input value={draft.openaiBaseUrl} onChange={(e) => set('openaiBaseUrl', e.target.value)} className={inputCls} />
              </Field>
              <Field label="模型名">
                <input value={draft.openaiModel} onChange={(e) => set('openaiModel', e.target.value)} className={inputCls} />
              </Field>
              <Field label="API Key">
                <SecretInput value={draft.openaiApiKey} onChange={(v) => set('openaiApiKey', v)} placeholder="sk-…" />
              </Field>
            </div>
          </div>
        )}
      </Card>

      <Card className="space-y-4">
        <h2 className="text-base font-semibold text-slate-900">练习偏好</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="默认难度">
            <select value={draft.level} onChange={(e) => isExamLevel(e.target.value) && set('level', e.target.value)} className={inputCls}>
              {Object.entries(EXAM_LEVELS).map(([id, l]) => (
                <option key={id} value={id}>
                  {l.name}（{l.words} 词）
                </option>
              ))}
            </select>
          </Field>
          <Field label="每句放几个目标词" hint="1 个词句子更自然，3 个词复习效率更高。">
            <Segmented
              value={String(draft.wordsPerSentence)}
              onChange={(v) => set('wordsPerSentence', Number(v))}
              options={[
                { value: '1', label: '1 个' },
                { value: '2', label: '2 个' },
                { value: '3', label: '3 个' },
              ]}
            />
          </Field>
        </div>
      </Card>

      <ErrorBox error={error} />
      <div className="flex items-center justify-end gap-3">
        {saved && <span className="text-sm text-emerald-700">已保存</span>}
        <Button onClick={() => void save()} busy={saving}>
          保存设置
        </Button>
      </div>
    </div>
  );
}
