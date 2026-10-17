import { useMemo, useState } from 'react';
import { referenceSplits, ROLES } from '../../../shared/scoring';
import { ROLE_NAMES, type Analysis, type Role } from '../../../shared/types';
import { SentenceTokens } from '../sentence';
import { joinTokens, ROLE_STYLES } from '../sentenceStyles';
import { Button, Notice } from '../ui';

export type RoleMap = Record<Role, number[]>;

interface Props {
  analysis: Analysis;
  roles: RoleMap;
  onChange: (roles: RoleMap) => void;
  result: { results: Record<Role, boolean>; score: number } | null;
  onCheck: () => void;
  onNext: () => void;
}

const ORDER: Role[] = ['predicate', 'subject', 'complement'];

export function SkeletonStep({ analysis, roles, onChange, result, onCheck, onNext }: Props) {
  const [active, setActive] = useState<Role>('predicate');
  const { tokens } = analysis;
  const targets = useMemo(() => new Set(analysis.targets.flatMap((t) => t.tokens)), [analysis]);
  const boundaries = useMemo(() => new Set(referenceSplits(analysis.chunks)), [analysis]);

  const roleOf = (i: number) => ROLES.find((r) => roles[r].includes(i));
  const refRoleOf = (i: number) => ROLES.find((r) => analysis.skeleton[r].includes(i));

  const toggle = (i: number) => {
    if (result) return;
    const current = roleOf(i);
    const next: RoleMap = { subject: roles.subject.filter((x) => x !== i), predicate: roles.predicate.filter((x) => x !== i), complement: roles.complement.filter((x) => x !== i) };
    if (current !== active) next[active] = [...next[active], i].sort((a, b) => a - b);
    onChange(next);
  };

  return (
    <div className="space-y-5">
      <Notice>
        <strong>先找谓语</strong>：排除从句和非谓语里的动词，剩下的才是主句谓语；再找它的主语和宾语 / 表语。只选核心词，别把后面的修饰成分选进来；没有宾语或表语就不选。竖线是上一步的参考意群边界。
      </Notice>

      {!result && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="选择要标注的成分">
          {ORDER.map((r) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={active === r}
              onClick={() => setActive(r)}
              className={`rounded-lg border-2 px-3 py-1.5 text-sm font-medium transition-colors ${active === r ? ROLE_STYLES[r].button : 'border-slate-200 bg-white text-slate-600'}`}
            >
              <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-sm ${ROLE_STYLES[r].dot}`} />
              {ROLE_NAMES[r]}
              {roles[r].length > 0 && <span className="ml-1 text-xs opacity-70">（{roles[r].length}）</span>}
            </button>
          ))}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-5">
        <SentenceTokens
          tokens={tokens}
          targets={targets}
          onToken={result ? undefined : toggle}
          tokenLabel={(i) => `把「${tokens[i]}」标为${ROLE_NAMES[active]}`}
          tokenClass={(i) => {
            const r = result ? refRoleOf(i) : roleOf(i);
            return r ? ROLE_STYLES[r].token : '';
          }}
          gap={(i) => (boundaries.has(i) ? <span className="mx-1 h-6 w-px bg-slate-300" /> : <span className="w-1.5" />)}
        />
      </div>

      {!result ? (
        <div className="flex justify-end">
          <Button onClick={onCheck} disabled={roles.subject.length === 0 && roles.predicate.length === 0}>
            检查主干
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-lg font-semibold">主干得分 {result.score}</p>
          <ul className="space-y-2">
            {ROLES.map((r) => (
              <li key={r} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span className={result.results[r] ? 'text-emerald-600' : 'text-rose-600'}>{result.results[r] ? '✓' : '✗'}</span>
                <span className="w-20 font-medium text-slate-700">{ROLE_NAMES[r]}</span>
                <span className="text-slate-500">你选的：{roles[r].length ? joinTokens(tokens, roles[r]) : '（未选）'}</span>
                <span className="text-slate-900">参考：{analysis.skeleton[r].length ? joinTokens(tokens, analysis.skeleton[r]) : '（无）'}</span>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">主干意思：{analysis.skeleton.summary}</p>
          <div className="flex justify-end">
            <Button onClick={onNext}>下一步：标成分 →</Button>
          </div>
        </div>
      )}
    </div>
  );
}
