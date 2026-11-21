import { useEffect, useMemo, useState } from 'react';
import {
  FORM_SHORT,
  STATUS_LABELS,
  TYPE_LABELS,
  deadlineState,
  formatPL,
  today,
  type DateOnly,
  type DeadlineState,
  type EvaluationStatus,
  type EvaluationTracking,
  type Reminder,
} from '@kompas/domain';
import { useSession } from '../app/session';
import { Alert, Card, DeadlineBadge, Empty, Field, Modal, PageHeader, Spinner, StatusBadge } from '../components/ui';
import { sendReminder, watchOfficeReminders, watchTracking } from '../data/repo';

/*
 * HR panel — statuses and statutory deadlines only (evaluation_tracking). HR_ADMIN has no access to
 * evaluations, so scores and results are never visible here (GDPR, data minimisation).
 */

interface NextAction {
  label: string;
  due: DateOnly | null;
  state: DeadlineState | null;
}

function nextAction(t: EvaluationTracking, now: DateOnly): NextAction {
  const d = t.deadlines;
  const make = (label: string, due: DateOnly | null): NextAction => ({ label, due, state: due ? deadlineState(due, now, false) : null });
  if (t.status === 'DRAFT') return make(t.type === 'FIRST_EVALUATION' ? 'Rozmowa wstępna' : 'Rozmowa rozpoczynająca', d.initialTalkDue);
  if (t.type === 'FIRST_EVALUATION' && t.status === 'INITIAL_TALK_DONE') return make('Sprawozdanie', d.reportDueTo);
  if (t.status === 'COMPLETED') return make('Zapoznanie ocenianego z oceną', null);
  if (t.status === 'ACKNOWLEDGED') return { label: d.objectionDeadline ? 'Termin na sprzeciw' : 'Zakończona', due: d.objectionDeadline, state: null };
  return make(t.type === 'FIRST_EVALUATION' ? 'Koniec okresu pierwszej oceny' : 'Sporządzenie oceny', d.evaluationDueDate);
}

function defaultMessage(t: EvaluationTracking, a: NextAction): string {
  if (!a.due) return `Przypomnienie dotyczące oceny: ${t.employeeName} — ${a.label.toLowerCase()}.`;
  const left = a.state === 'OVERDUE' ? `minął ${formatPL(a.due)}` : `upływa ${formatPL(a.due)}`;
  return `Przypomnienie: ${a.label.toLowerCase()} — ${t.employeeName}. Termin ${left}.`;
}

export function HrPanel() {
  const { user } = useSession();
  const [rows, setRows] = useState<EvaluationTracking[] | null>(null);
  const [sent, setSent] = useState<Reminder[]>([]);
  const [dept, setDept] = useState('');
  const [status, setStatus] = useState<'' | EvaluationStatus>('');
  const [due, setDue] = useState<'' | 'OVERDUE' | 'SOON'>('');
  const [target, setTarget] = useState<EvaluationTracking | null>(null);
  const [message, setMessage] = useState('');
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = today();

  useEffect(() => {
    if (!user) return;
    const a = watchTracking(user, setRows);
    const b = watchOfficeReminders(user, setSent);
    return () => {
      a();
      b();
    };
  }, [user]);

  const enriched = useMemo(() => (rows ?? []).map((t) => ({ t, a: nextAction(t, now) })), [rows, now]);
  const departments = [...new Set(enriched.map((x) => x.t.department))].sort();
  const filtered = enriched
    .filter(({ t, a }) => (!dept || t.department === dept) && (!status || t.status === status) && (!due || a.state === due))
    .sort((x, y) => (x.a.due ?? '9999').localeCompare(y.a.due ?? '9999'));
  const count = (st: DeadlineState) => enriched.filter((x) => x.a.state === st).length;
  const active = enriched.filter(({ t }) => t.status !== 'COMPLETED' && t.status !== 'ACKNOWLEDGED').length;

  const open = (t: EvaluationTracking, a: NextAction) => {
    setTarget(t);
    setMessage(defaultMessage(t, a));
    setError(null);
  };
  const send = async () => {
    if (!user || !target) return;
    try {
      await sendReminder(user, target, message.trim());
      setInfo(`Wysłano przypomnienie do: ${target.supervisorName}.`);
      setTarget(null);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!rows) return <Spinner />;
  return (
    <>
      <PageHeader
        title="Panel HR"
        lead="Statusy procesów i terminy ustawowe. Treści ocen, oceny cząstkowe i wyniki nie są dostępne w tym widoku (minimalizacja danych — RODO)."
      />
      {info && <div className="mb-s4"><Alert tone="success">{info}</Alert></div>}

      <div className="mb-s5 grid grid-cols-4 gap-s4">
        {[
          ['Oceny w toku', active, ''],
          ['Po terminie', count('OVERDUE'), 'text-error'],
          ['Termin w ciągu 14 dni', count('SOON'), 'text-warning'],
          ['Wysłane przypomnienia', sent.length, ''],
        ].map(([label, value, cls]) => (
          <div key={label as string} className="card">
            <p className="hint">{label}</p>
            <p className={`font-heading text-[34px] leading-tight ${cls}`}>{value}</p>
          </div>
        ))}
      </div>

      <Card
        title="Procesy ocen"
        actions={
          <div className="flex gap-2">
            <select className="select text-sm" value={dept} onChange={(e) => setDept(e.target.value)} aria-label="Komórka">
              <option value="">Wszystkie komórki</option>
              {departments.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select className="select text-sm" value={status} onChange={(e) => setStatus(e.target.value as EvaluationStatus | '')} aria-label="Status">
              <option value="">Każdy status</option>
              {(Object.keys(STATUS_LABELS) as EvaluationStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABELS[s]}
                </option>
              ))}
            </select>
            <select className="select text-sm" value={due} onChange={(e) => setDue(e.target.value as '' | 'OVERDUE' | 'SOON')} aria-label="Termin">
              <option value="">Każdy termin</option>
              <option value="OVERDUE">Po terminie</option>
              <option value="SOON">W ciągu 14 dni</option>
            </select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <Empty>Brak procesów spełniających kryteria.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Oceniany</th>
                <th>Komórka</th>
                <th>Rodzaj</th>
                <th>Status</th>
                <th>Najbliższa czynność</th>
                <th>Przełożony</th>
                <th aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ t, a }) => (
                <tr key={t.id}>
                  <td className="font-semibold">{t.employeeName}</td>
                  <td className="text-sm">{t.department}</td>
                  <td className="text-sm">
                    {TYPE_LABELS[t.type]}
                    <p className="hint">{FORM_SHORT[t.formType]}</p>
                  </td>
                  <td>
                    <StatusBadge status={t.status} type={t.type} />
                  </td>
                  <td>
                    <p className="text-sm">{a.label}</p>
                    <DeadlineBadge due={a.due} today={now} done={false} />
                  </td>
                  <td className="text-sm">{t.supervisorName}</td>
                  <td className="text-right">
                    {t.status !== 'ACKNOWLEDGED' && (
                      <button className="btn btn-secondary btn-sm" onClick={() => open(t, a)}>
                        Przypomnij
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Ostatnie przypomnienia" className="mt-s5">
        {sent.length === 0 ? (
          <Empty>Nie wysłano jeszcze przypomnień.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line text-sm">
            {sent.slice(0, 10).map((r) => (
              <li key={r.id} className="flex justify-between gap-s4 py-2">
                <span>{r.message}</span>
                <span className="hint shrink-0">
                  {r.status === 'READ' ? 'przeczytane' : 'nieprzeczytane'} · {r.createdAt ? new Date(r.createdAt).toLocaleDateString('pl-PL') : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={!!target} onOpenChange={(o) => !o && setTarget(null)} title="Wyślij przypomnienie" description={target ? `Do: ${target.supervisorName} (licznik w aplikacji)` : undefined}>
        <Field label="Treść" htmlFor="reminder-msg">
          <textarea id="reminder-msg" className="textarea" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} />
        </Field>
        {error && <div className="mt-s3"><Alert tone="error">{error}</Alert></div>}
        <div className="mt-s4 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={() => setTarget(null)}>
            Anuluj
          </button>
          <button className="btn" onClick={send} disabled={!message.trim()}>
            Wyślij
          </button>
        </div>
      </Modal>
    </>
  );
}
