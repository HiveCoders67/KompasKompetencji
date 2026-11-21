import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useRef, useState } from 'react';
import type { AiMessage, Evaluation, StepId } from '@kompas/domain';
import { askFormalFn, askInterviewFn, callableError, type InterviewTask } from '../data/repo';
import { Alert } from './ui';

/*
 * AI assistants panel (docs/03 § 2): Formal (RAG, citations) and Interview (coaching, drafts).
 * Drafts reach the form only via „Wstaw do formularza”.
 */

export const EXAMPLE_QUESTIONS = [
  'Pracownik ma średnią 5,8 z oceny okresowej, ale dostał 1 punkt za komunikację. Czy ocena jest pozytywna?',
  'Nowy pracownik został zwolniony ze służby przygotowawczej przez Dyrektora Generalnego. Czy musi zdawać egzamin?',
  'Pracownik na ocenie okresowej był na L4 przez 44 dni bez przerwy. Co z terminem oceny?',
  'Ile dni ma pracownik na złożenie sprzeciwu od oceny okresowej i do kogo?',
];

export function MessageView({ m }: { m: AiMessage }) {
  if (m.role === 'user') return <div className="ml-10 rounded-lg bg-[color-mix(in_srgb,var(--sf-text-primary)_6%,transparent)] p-s3 text-sm">{m.content}</div>;
  return (
    <div className={`rounded-lg border p-s3 text-sm ${m.refused ? 'border-warning' : 'border-line'}`}>
      {m.refused && <p className="mb-1 text-xs font-semibold text-warning">Brak informacji w bazie wiedzy</p>}
      <p className="whitespace-pre-wrap">{m.content}</p>
      {m.citations.length > 0 && (
        <ul className="mt-s3 flex flex-col gap-2 border-t border-line pt-s2">
          {m.citations.map((c, i) => (
            <li key={i}>
              <details>
                <summary className="cursor-pointer text-xs font-semibold">
                  Źródło: {c.unit ? `${c.unit} — ` : ''}
                  {c.sourceTitle}
                  {c.page ? `, s. ${c.page}` : ''}
                </summary>
                <blockquote className="hint mt-1 border-l-2 border-line-strong pl-2 text-xs">„{c.excerpt}”</blockquote>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function FormalChat({ evaluationId, step, path, examples }: { evaluationId?: string; step?: string; path?: 'A' | 'B'; examples?: boolean }) {
  const [messages, setMessages] = useState<AiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [messages.length, busy]);

  const ask = async (question: string) => {
    if (!question.trim() || busy) return;
    setBusy(true);
    setError(null);
    setQ('');
    const local: AiMessage = { id: `u${Date.now()}`, role: 'user', content: question, refused: false, context: null, citations: [], createdAt: new Date().toISOString() };
    setMessages((m) => [...m, local]);
    try {
      const r = await askFormalFn({ question, evaluationId, step, path, sessionId });
      setSessionId(r.sessionId);
      setMessages((m) => [...m, r.message]);
    } catch (e) {
      // nothing was stored on the server — drop the local question and give it back for a retry (no duplicates)
      setMessages((m) => m.filter((x) => x.id !== local.id));
      setQ(question);
      setError(callableError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex h-full flex-col gap-s3">
      <p className="hint text-xs">Odpowiedzi wyłącznie na podstawie ustawy o służbie cywilnej, rozporządzeń z 2015 i 2016 r., poradników KPRM, wzorów arkuszy i modelu kompetencji MC — z cytatem źródła.</p>
      <div className="flex min-h-0 flex-1 flex-col gap-s2 overflow-y-auto">
        {messages.length === 0 && examples && (
          <div className="flex flex-col gap-2">
            <p className="label">Przykładowe pytania</p>
            {EXAMPLE_QUESTIONS.map((x) => (
              <button key={x} className="radio-card text-left" onClick={() => ask(x)}>
                {x}
              </button>
            ))}
          </div>
        )}
        {messages.map((m) => (
          <MessageView key={m.id} m={m} />
        ))}
        {busy && <p className="hint text-sm" role="status">Szukam w bazie wiedzy…</p>}
        {error && <Alert tone="error">{error}</Alert>}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask(q);
        }}
      >
        <label htmlFor="formal-q" className="sr-only">
          Pytanie do asystenta formalnego
        </label>
        <input id="formal-q" className="input" placeholder="Zadaj pytanie o przepisy lub procedurę…" value={q} onChange={(e) => setQ(e.target.value)} maxLength={1500} />
        <button className="btn" type="submit" disabled={busy || !q.trim()}>
          Zapytaj
        </button>
      </form>
    </div>
  );
}

const TASKS: { task: InterviewTask; label: string; insert?: 'justification' | 'developmentPlan' }[] = [
  { task: 'AGENDA', label: 'Agenda i pytania do rozmowy' },
  { task: 'FEEDBACK', label: 'Informacja zwrotna (FUKO)' },
  { task: 'JUSTIFICATION', label: 'Szkic uzasadnienia', insert: 'justification' },
  { task: 'DEVELOPMENT_PLAN', label: 'Szkic wniosków rozwojowych (IPRZ)', insert: 'developmentPlan' },
  { task: 'DIFFICULT_TALK', label: 'Jak przeprowadzić trudną rozmowę' },
];

function InterviewChat({ ev, step, update, readOnly }: { ev: Evaluation; step: StepId; update: (fn: (e: Evaluation) => Evaluation) => void; readOnly: boolean }) {
  const [items, setItems] = useState<{ task: InterviewTask; message: AiMessage; inserted?: boolean }[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [busy, setBusy] = useState<InterviewTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const run = async (task: InterviewTask, message?: string) => {
    setBusy(task);
    setError(null);
    try {
      const r = await askInterviewFn({ task, evaluationId: ev.id, message, step, sessionId });
      setSessionId(r.sessionId);
      setItems((x) => [...x, { task, message: r.message }]);
    } catch (e) {
      setError(callableError(e));
    } finally {
      setBusy(null);
    }
  };

  const insert = (idx: number, field: 'justification' | 'developmentPlan') => {
    const text = items[idx].message.content;
    update((e) => ({ ...e, texts: { ...e.texts, [field]: text, [`${field}AiDraft`]: true } }));
    setItems((x) => x.map((it, i) => (i === idx ? { ...it, inserted: true } : it)));
  };

  return (
    <div className="flex h-full flex-col gap-s3">
      <p className="hint text-xs">Asystent pracuje na OSP, wybranych wskaźnikach i Twoich notatkach. Nie wystawia ocen — tylko pomaga przygotować rozmowę i teksty.</p>
      <div className="flex flex-wrap gap-2">
        {TASKS.map((t) => (
          <button key={t.task} className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run(t.task)}>
            {busy === t.task ? 'Generowanie…' : t.label}
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-s3 overflow-y-auto">
        {items.map((it, i) => {
          const def = TASKS.find((t) => t.task === it.task);
          return (
            <div key={it.message.id} className="rounded-lg border border-line p-s3 text-sm">
              <p className="mb-1 text-xs font-semibold">{def?.label ?? 'Odpowiedź'}</p>
              <p className="whitespace-pre-wrap">{it.message.content}</p>
              {def?.insert && (
                <div className="mt-s2 flex items-center gap-s2">
                  <button className="btn btn-sm" disabled={readOnly || it.inserted} onClick={() => insert(i, def.insert!)}>
                    {it.inserted ? 'Wstawiono' : 'Wstaw do formularza'}
                  </button>
                  <span className="hint text-xs">Szkic wygenerowany przez AI — wymaga weryfikacji</span>
                </div>
              )}
            </div>
          );
        })}
        {error && <Alert tone="error">{error}</Alert>}
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) run('CHAT', q.trim());
          setQ('');
        }}
      >
        <label htmlFor="interview-q" className="sr-only">
          Pytanie do asystenta rozmowy
        </label>
        <input id="interview-q" className="input" placeholder="Zapytaj o przygotowanie rozmowy…" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" type="submit" disabled={!!busy || !q.trim()}>
          Wyślij
        </button>
      </form>
    </div>
  );
}

export function AssistantPanel({
  open,
  onClose,
  ev,
  step,
  update,
  readOnly,
}: {
  open: boolean;
  onClose: () => void;
  ev: Evaluation;
  step: StepId;
  update: (fn: (e: Evaluation) => Evaluation) => void;
  readOnly: boolean;
}) {
  if (!open) return null;
  return (
    <aside aria-label="Asystent AI" className="fixed right-0 top-0 z-20 flex h-screen w-[400px] flex-col border-l border-line bg-surface p-s4 shadow-lg">
      <div className="mb-s3 flex items-center justify-between">
        <h5>Asystent AI</h5>
        <button className="btn btn-ghost btn-sm" onClick={onClose}>
          Zamknij
        </button>
      </div>
      <Tabs.Root defaultValue={step === 'final' || step === 'start' ? 'interview' : 'formal'} className="flex min-h-0 flex-1 flex-col">
        <Tabs.List className="mb-s3 flex border-b border-line" aria-label="Rodzaj asystenta">
          <Tabs.Trigger value="formal" className="tab">
            Formalny (przepisy)
          </Tabs.Trigger>
          <Tabs.Trigger value="interview" className="tab">
            Rozmowa
          </Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="formal" className="min-h-0 flex-1 data-[state=inactive]:hidden" forceMount>
          <FormalChat evaluationId={ev.id} step={step} />
        </Tabs.Content>
        <Tabs.Content value="interview" className="min-h-0 flex-1 data-[state=inactive]:hidden" forceMount>
          <InterviewChat ev={ev} step={step} update={update} readOnly={readOnly} />
        </Tabs.Content>
      </Tabs.Root>
    </aside>
  );
}
