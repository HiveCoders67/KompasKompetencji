import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  buildNewEvaluation,
  isLocked,
  stepsFor,
  today,
  type Employee,
  type Evaluation,
} from '@kompas/domain';
import { useSession } from '../app/session';
import { Alert, Card, DeadlineBadge, Empty, EvalKind, ObjectionDeadlineBadge, PageHeader, Spinner, StatusBadge, rowLink } from '../components/ui';
import { createEvaluation, newEvaluationId, watchEmployees, watchSupervisorEvaluations } from '../data/repo';

/** „Krok 3 z 5: Ocena wskaźników · ocenione 2 z 5” — the same step numbering as the stepper. */
function progressLine(e: Evaluation): string | null {
  const steps = stepsFor(e);
  const i = steps.findIndex((s) => s.id === e.currentStep);
  if (i < 0) return null;
  const scored = e.criteriaAssessments.filter((c) => c.finalScore !== null).length;
  const extra = e.currentStep === 'assessment' ? ` · ocenione ${scored} z ${e.criteriaAssessments.length}` : '';
  return `Krok ${i + 1} z ${steps.length}: ${steps[i].label}${extra}`;
}

export function SupervisorDashboard() {
  const { user } = useSession();
  const nav = useNavigate();
  const [evals, setEvals] = useState<Evaluation[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const now = today();

  useEffect(() => {
    if (!user) return;
    const a = watchSupervisorEvaluations(user, setEvals);
    const b = watchEmployees(user, 'supervisorId', setEmployees);
    return () => {
      a();
      b();
    };
  }, [user]);

  const sorted = useMemo(
    () => [...(evals ?? [])].sort((x, y) => x.deadlines.evaluationDueDate.localeCompare(y.deadlines.evaluationDueDate)),
    [evals],
  );
  const active = sorted.filter((e) => !isLocked(e));
  const done = sorted.filter((e) => isLocked(e));
  const withoutActive = employees.filter((emp) => !active.some((e) => e.employeeId === emp.id));

  const start = async (emp: Employee) => {
    if (!user) return;
    setError(null);
    try {
      const ev = buildNewEvaluation({ id: newEvaluationId(), employee: emp, supervisor: user, now: new Date().toISOString() });
      await createEvaluation(ev);
      nav(`/oceny/${ev.id}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!evals) return <Spinner />;
  return (
    <>
      <PageHeader title="Moje oceny" lead="Oceny Twoich pracowników i postęp każdej z nich." />
      {error && <Alert tone="error">{error}</Alert>}

      <Card title="W toku" className="mb-s5">
        {active.length === 0 ? (
          <Empty>Brak ocen w toku.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Oceniany</th>
                <th>Rodzaj</th>
                <th>Status</th>
                <th>Rozmowa {`wstępna / rozpoczynająca`}</th>
                <th>Termin oceny</th>
                <th aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {active.map((e) => {
                const progress = progressLine(e);
                return (
                  <tr key={e.id} {...rowLink(() => nav(`/oceny/${e.id}`))}>
                    <td>
                      <p className="font-semibold">{e.employeeName}</p>
                      <p className="hint">{e.department}</p>
                    </td>
                    <td>
                      <EvalKind type={e.type} formType={e.formType} />
                    </td>
                    <td>
                      <StatusBadge status={e.status} type={e.type} />
                      {progress && <p className="hint mt-1">{progress}</p>}
                    </td>
                    <td>
                      <DeadlineBadge due={e.deadlines.initialTalkDue} today={now} done={!!e.deadlines.initialTalkDate} />
                    </td>
                    <td>
                      <DeadlineBadge due={e.deadlines.evaluationDueDate} today={now} done={false} />
                      {e.type === 'FIRST_EVALUATION' && e.deadlines.evaluationWindowFrom && (
                        <p className="hint mt-1">okno od {e.deadlines.evaluationWindowFrom.split('-').reverse().join('.')}</p>
                      )}
                    </td>
                    <td className="text-right">
                      <Link className="btn btn-sm" to={`/oceny/${e.id}`}>
                        Kontynuuj
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {withoutActive.length > 0 && (
        <Card title="Pracownicy bez oceny w toku" className="mb-s5">
          <ul className="flex flex-col divide-y divide-line">
            {withoutActive.map((emp) => (
              <li key={emp.id} className="flex items-center justify-between py-s3">
                <div>
                  <p className="font-semibold">
                    {emp.firstName} {emp.lastName}
                  </p>
                  <p className="hint">
                    {emp.osp.positionName} · {emp.contractType === 'INDEFINITE' ? 'ocena okresowa' : 'pierwsza ocena'}
                  </p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={() => start(emp)}>
                  Rozpocznij ocenę
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* an empty „Zakończone” card is just noise — the section appears with the first completed evaluation */}
      {done.length > 0 && (
        <Card title="Zakończone">
          <table className="table">
            <thead>
              <tr>
                <th>Oceniany</th>
                <th>Rodzaj</th>
                <th>Status</th>
                <th>Sprzeciw do</th>
                <th aria-label="Akcje" />
              </tr>
            </thead>
            <tbody>
              {done.map((e) => (
                <tr key={e.id} {...rowLink(() => nav(`/oceny/${e.id}`))}>
                  <td className="font-semibold">{e.employeeName}</td>
                  <td>
                    <EvalKind type={e.type} formType={e.formType} />
                  </td>
                  <td>
                    <StatusBadge status={e.status} type={e.type} />
                  </td>
                  <td>
                    <ObjectionDeadlineBadge due={e.deadlines.objectionDeadline} today={now} />
                  </td>
                  <td className="text-right">
                    <Link className="btn btn-secondary btn-sm" to={`/oceny/${e.id}`}>
                      Otwórz
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
