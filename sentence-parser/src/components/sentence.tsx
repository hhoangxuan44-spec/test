import { Fragment, useState, type ReactNode } from 'react';
import { FAMILY_STYLES, LABELS, type LabelId } from '../../shared/labels';
import { ROLE_NAMES, type Analysis, type Role } from '../../shared/types';
import { ROLE_STYLES } from './sentenceStyles';

export function LabelBadge({ label, className = '' }: { label: LabelId; className?: string }) {
  const info = LABELS[label];
  return (
    <span title={info.hint} className={`inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-xs font-medium ${FAMILY_STYLES[info.family].badge} ${className}`}>
      {info.name}
    </span>
  );
}

interface TokensProps {
  tokens: string[];
  targets?: Set<number>;
  tokenClass?: (i: number) => string;
  onToken?: (i: number) => void;
  tokenLabel?: (i: number) => string;
  gap?: (i: number) => ReactNode;
}

/** The sentence as a row of words; steps decorate words and the gaps between them. */
export function SentenceTokens({ tokens, targets, tokenClass, onToken, tokenLabel, gap }: TokensProps) {
  return (
    <p className="flex flex-wrap items-center gap-y-2 font-serif text-xl leading-loose text-slate-900">
      {tokens.map((t, i) => {
        const target = targets?.has(i) ? 'font-semibold underline decoration-indigo-400 decoration-dotted decoration-2 underline-offset-[6px]' : '';
        const cls = `rounded px-0.5 ${target} ${tokenClass?.(i) ?? ''}`;
        return (
          <Fragment key={i}>
            {onToken ? (
              <button type="button" onClick={() => onToken(i)} aria-label={tokenLabel?.(i) ?? t} className={`${cls} cursor-pointer hover:bg-slate-100`}>
                {t}
              </button>
            ) : (
              <span className={cls}>{t}</span>
            )}
            {i < tokens.length - 1 && (gap ? gap(i) : <span className="w-1.5" />)}
          </Fragment>
        );
      })}
    </p>
  );
}

/** Whole sentence with every chunk underlined in its family colour and the skeleton boxed. */
export function ColoredSentence({ analysis }: { analysis: Analysis }) {
  const role = new Map<number, Role>();
  (['subject', 'predicate', 'complement'] as Role[]).forEach((r) => analysis.skeleton[r].forEach((i) => role.set(i, r)));
  const targets = new Set(analysis.targets.flatMap((t) => t.tokens));
  return (
    <p className="font-serif text-xl leading-[2.4] text-slate-900">
      {analysis.chunks.map((c, ci) => {
        const groups: Array<{ role?: Role; indices: number[] }> = [];
        for (let i = c.start; i <= c.end; i++) {
          const last = groups.at(-1);
          if (last && last.role === role.get(i)) last.indices.push(i);
          else groups.push({ role: role.get(i), indices: [i] });
        }
        return (
          <Fragment key={ci}>
            <span
              className={`underline decoration-[3px] underline-offset-[7px] ${FAMILY_STYLES[LABELS[c.label].family].underline}`}
              title={`${LABELS[c.label].name}${c.modifies ? ' → ' + c.modifies : ''}`}
            >
              {groups.map((g, gi) => (
                <Fragment key={gi}>
                  {gi > 0 && ' '}
                  <span className={g.role ? `rounded px-1 font-semibold ${ROLE_STYLES[g.role].token}` : ''}>
                    {g.indices.map((i, k) => (
                      <Fragment key={i}>
                        {k > 0 && ' '}
                        <span className={targets.has(i) ? 'font-semibold text-indigo-700' : ''}>{analysis.tokens[i]}</span>
                      </Fragment>
                    ))}
                  </span>
                </Fragment>
              ))}
            </span>
            {ci < analysis.chunks.length - 1 && <span className="mx-1 text-slate-300">/</span>}
          </Fragment>
        );
      })}
    </p>
  );
}

export function RoleLegend() {
  return (
    <div className="flex flex-wrap gap-3 text-xs text-slate-600">
      {(['subject', 'predicate', 'complement'] as Role[]).map((r) => (
        <span key={r} className="inline-flex items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-sm ${ROLE_STYLES[r].dot}`} />
          {ROLE_NAMES[r]}
        </span>
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="font-semibold text-indigo-700 underline decoration-dotted">word</span>
        目标词
      </span>
    </div>
  );
}

/** Chunks in reading order, indented by depth, each with its role and what it attaches to. */
export function StructureView({ analysis, showTranslation = true }: { analysis: Analysis; showTranslation?: boolean }) {
  const [open, setOpen] = useState(showTranslation);
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={() => setOpen((v) => !v)}>
          {open ? '隐藏意群译文' : '显示意群译文'}
        </button>
      </div>
      <ol className="space-y-2">
        {analysis.chunks.map((c, i) => {
          const style = FAMILY_STYLES[LABELS[c.label].family];
          return (
            <li key={i} style={{ marginLeft: `${Math.min(c.depth, 4) * 1.25}rem` }} className={`rounded-lg border-l-4 bg-slate-50 px-3 py-2 ${c.depth === 0 ? 'border-amber-400' : 'border-slate-300'}`}>
              <div className="flex flex-wrap items-center gap-2">
                <LabelBadge label={c.label} />
                {c.modifies && <span className="text-xs text-slate-500">→ 修饰 / 依附 <span className="font-medium text-slate-700">{c.modifies}</span></span>}
              </div>
              <p className={`mt-1 font-serif text-lg ${c.depth === 0 ? 'font-semibold text-slate-900' : style.text}`}>{c.text}</p>
              <p className="mt-0.5 text-sm text-slate-600">{c.explanation}</p>
              {open && <p className="mt-0.5 text-sm text-slate-500">译：{c.translation}</p>}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
