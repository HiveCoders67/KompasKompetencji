import * as Tabs from '@radix-ui/react-tabs';
import { useEffect, useRef, useState } from 'react';
import { previewResult, type AiMessage, type Evaluation, type StepId } from '@kompas/domain';
import { stepLock } from '../pages/steps/progress';
import { askFormalFn, askInterviewFn, callableError, type InterviewTask } from '../data/repo';
import { Alert } from './ui';

/*
 * AI assistants panel (docs/03 § 2): Formal (RAG, citations) and Interview (coaching, drafts).
 * Drafts reach the form only via „Wstaw do formularza”.
 */

/** Example questions per path — each set only asks about the path the user narrowed the assistant to. */
export const EXAMPLE_QUESTIONS: Record<'A' | 'B' | 'ALL', string[]> = {
  A: [
    'Nowy pracownik został zwolniony ze służby przygotowawczej przez Dyrektora Generalnego. Czy musi zdawać egzamin?',
    'Pracownik w pierwszej ocenie dostał jedną trójkę, trzy piątki i jedną siódemkę. Zdał egzamin i złożył sprawozdanie w terminie. Jaki będzie wynik?',
    'W jakim terminie pracownik w służbie przygotowawczej składa sprawozdanie do pierwszej oceny?',
    'W jakim terminie przełożony przeprowadza rozmowę wstępną z nowym pracownikiem?',
  ],
  B: [
    'Pracownik ma średnią 5,8 z oceny okresowej, ale dostał 1 punkt za komunikację. Czy ocena jest pozytywna?',
    'Pracownik na ocenie okresowej był na L4 przez 44 dni bez przerwy. Co z terminem oceny?',
    'Ile dni ma pracownik na złożenie sprzeciwu od oceny okresowej i do kogo?',
    'Kiedy stosuje się arkusz B, a kiedy arkusz C?',
  ],
  ALL: [
    'Pracownik ma średnią 5,8 z oceny okresowej, ale dostał 1 punkt za komunikację. Czy ocena jest pozytywna?',
    'Nowy pracownik został zwolniony ze służby przygotowawczej przez Dyrektora Generalnego. Czy musi zdawać egzamin?',
    'Pracownik na ocenie okresowej był na L4 przez 44 dni bez przerwy. Co z terminem oceny?',
    'Ile dni ma pracownik na złożenie sprzeciwu od oceny okresowej i do kogo?',
  ],
};

/** The user's own message — the same bubble in both assistants. */
function UserBubble({ children }: { children: string }) {
  return <div className="ml-10 whitespace-pre-wrap rounded-lg bg-[color-mix(in_srgb,var(--sf-text-primary)_6%,transparent)] p-s3 text-sm">{children}</div>;
}

export function MessageView({ m }: { m: AiMessage }) {
  if (m.role === 'user') return <UserBubble>{m.content}</UserBubble>;
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
            {EXAMPLE_QUESTIONS[path ?? 'ALL'].map((x) => (
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

type DraftField = 'justification' | 'developmentPlan';

/**
 * Form fields an AI draft may fill right now. The justification and the development plan live in the
 * „Rozmowa oceniająca i wynik” step, so their drafts are offered (and inserted) only there, once the step is unlocked,
 * and only for a field the step shows (a negative first evaluation has no development plan).
 */
export function draftTargets(ev: Evaluation, step: StepId): ReadonlySet<DraftField> {
  if (step !== 'final' || stepLock(ev, 'final')) return new Set();
  const negativeFirst = ev.type === 'FIRST_EVALUATION' && previewResult(ev)?.finalResult === 'NEGATIVE';
  return new Set<DraftField>(negativeFirst ? ['justification'] : ['justification', 'developmentPlan']);
}

/** Conversation entry: the user's request (typed question or the chosen task) or the assistant's answer. */
type InterviewItem = { kind: 'user'; id: string; text: string } | { kind: 'answer'; task: InterviewTask; message: AiMessage; inserted?: boolean };

function InterviewChat({ ev, step, update, readOnly }: { ev: Evaluation; step: StepId; update: (fn: (e: Evaluation) => Evaluation) => void; readOnly: boolean }) {
  const [items, setItems] = useState<InterviewItem[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [busy, setBusy] = useState<InterviewTask | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  // ready-made prompts („podpowiedzi”) take a lot of the narrow panel — they fold away once the user types their own question
  const [tasksOpen, setTasksOpen] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'nearest' });
  }, [items.length, busy]);

  const run = async (task: InterviewTask, message?: string) => {
    if (busy) return;
    // the request is shown at once — a typed question as written, a task button by its label
    const local: InterviewItem = { kind: 'user', id: `u${Date.now()}`, text: message ?? TASKS.find((t) => t.task === task)?.label ?? task };
    setItems((x) => [...x, local]);
    setBusy(task);
    setError(null);
    if (message) {
      setQ('');
      setTasksOpen(false);
    }
    try {
      const r = await askInterviewFn({ task, evaluationId: ev.id, message, step, sessionId });
      setSessionId(r.sessionId);
      setItems((x) => [...x, { kind: 'answer', task, message: r.message }]);
    } catch (e) {
      // nothing was stored — drop the request and give a typed question back for a retry (as in the formal assistant)
      setItems((x) => x.filter((it) => it !== local));
      if (message) setQ(message);
      setError(callableError(e));
    } finally {
      setBusy(null);
    }
  };

  const targets = draftTargets(ev, step);
  const tasks = TASKS.filter((t) => !t.insert || targets.has(t.insert));
  const insert = (idx: number, field: DraftField) => {
    const it = items[idx];
    if (it.kind !== 'answer') return;
    update((e) => ({ ...e, texts: { ...e.texts, [field]: it.message.content, [`${field}AiDraft`]: true } }));
    setItems((x) => x.map((y, i) => (i === idx && y.kind === 'answer' ? { ...y, inserted: true } : y)));
  };

  return (
    <div className="flex h-full flex-col gap-s3">
      <p className="hint text-xs">Asystent pracuje na OSP, wybranych wskaźnikach i Twoich notatkach. Nie wystawia ocen — tylko pomaga przygotować rozmowę i teksty.</p>
      <div>
        <button
          type="button"
          className="show-more btn btn-ghost btn-sm !px-2"
          aria-expanded={tasksOpen}
          aria-controls="interview-tasks"
          onClick={() => setTasksOpen((o) => !o)}
        >
          {tasksOpen ? 'Ukryj podpowiedzi' : `Pokaż podpowiedzi (${tasks.length})`}
          <svg className="show-more-chevron" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3.5 6L8 10.5 12.5 6" />
          </svg>
        </button>
        <div id="interview-tasks" className="sf-collapse" data-collapsed={!tasksOpen} aria-hidden={!tasksOpen} inert={!tasksOpen}>
          <div className="sf-collapse-inner">
            <div className="flex flex-wrap gap-2 pt-s2">
              {tasks.map((t) => (
                <button key={t.task} className="btn btn-secondary btn-sm" disabled={!!busy} onClick={() => run(t.task)}>
                  {busy === t.task ? 'Generowanie…' : t.label}
                </button>
              ))}
            </div>
            {targets.size === 0 && (
              <p className="hint mt-s2 text-xs">Szkic uzasadnienia i wniosków rozwojowych będzie dostępny w kroku „Rozmowa oceniająca i wynik”.</p>
            )}
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-s3 overflow-y-auto">
        {items.map((it, i) => {
          if (it.kind === 'user') return <UserBubble key={it.id}>{it.text}</UserBubble>;
          const def = TASKS.find((t) => t.task === it.task);
          return (
            <div key={it.message.id} className="rounded-lg border border-line p-s3 text-sm">
              <p className="mb-1 text-xs font-semibold">{def?.label ?? 'Odpowiedź'}</p>
              <p className="whitespace-pre-wrap">{it.message.content}</p>
              {def?.insert && (
                <div className="mt-s2 flex items-center gap-s2">
                  {/* a draft made earlier can be inserted only while its field is on screen */}
                  <button className="btn btn-sm" disabled={readOnly || it.inserted || !targets.has(def.insert)} onClick={() => insert(i, def.insert!)}>
                    {it.inserted ? 'Wstawiono' : 'Wstaw do formularza'}
                  </button>
                  <span className="hint text-xs">
                    {targets.has(def.insert) || it.inserted ? 'Szkic wygenerowany przez AI — wymaga weryfikacji' : 'Wstawisz go w kroku „Rozmowa oceniająca i wynik”.'}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {busy && (
          <p className="hint text-sm" role="status">
            Przygotowuję odpowiedź…
          </p>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        <div ref={end} />
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (q.trim()) run('CHAT', q.trim());
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

/**
 * Floating AI assistant of the evaluation view: a button pinned to the bottom-right corner opens a chat window above it.
 * The window floats over the page (never squeezes the content) and stays mounted while hidden, so the conversation survives closing.
 */
export function AssistantPanel({
  open,
  onOpenChange,
  ev,
  step,
  update,
  readOnly,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ev: Evaluation;
  step: StepId;
  update: (fn: (e: Evaluation) => Evaluation) => void;
  readOnly: boolean;
}) {
  const panel = useRef<HTMLElement>(null);
  const fab = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(open);
  useEffect(() => {
    // focus moves into the window on open and back to the button on close
    if (open && !wasOpen.current) requestAnimationFrame(() => panel.current?.focus());
    if (!open && wasOpen.current && panel.current?.contains(document.activeElement)) fab.current?.focus();
    wasOpen.current = open;
  }, [open]);

  return (
    <>
      <aside
        ref={panel}
        id="assistant-window"
        aria-label="Asystent AI"
        tabIndex={-1}
        className="assistant-window"
        data-open={open}
        aria-hidden={!open}
        inert={!open}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            onOpenChange(false);
          }
        }}
      >
        <div className="mb-s3 flex items-center justify-between gap-s3">
          <h5>Asystent AI</h5>
          <button className="btn btn-ghost btn-sm" onClick={() => onOpenChange(false)} aria-label="Zwiń asystenta AI">
            Zwiń
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
      <button
        ref={fab}
        type="button"
        className="assistant-fab"
        data-open={open}
        aria-expanded={open}
        aria-controls="assistant-window"
        onClick={() => onOpenChange(!open)}
      >
        {open ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        ) : (
          <svg className="assistant-fab-spark" width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0.8l1.7 4.6 4.6 1.7-4.6 1.7L8 13.4 6.3 8.8 1.7 7.1l4.6-1.7z" />
            <path d="M13.2 10.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
          </svg>
        )}
        {open ? 'Zamknij asystenta' : 'Asystent AI'}
      </button>
    </>
  );
}
