import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { today, type Evaluation } from '@kompas/domain';
import { useSession } from '../app/session';
import { Card, DeadlineBadge, Empty, PageHeader, Spinner, StatusBadge, rowLink } from '../components/ui';
import { watchHeadEvaluations } from '../data/repo';

/** Who / what the first evaluation is waiting for — the head sees why it is not in „Do zatwierdzenia” yet. */
function waitingFor(e: Evaluation): { text: string; you?: boolean } {
  switch (e.status) {
    case 'DRAFT':
      return { text: 'Rozmowa wstępna (przełożony)' };
    case 'INITIAL_TALK_DONE':
      return { text: 'Sprawozdanie ocenianego' };
    case 'REPORT_SUBMITTED':
    case 'IN_PROGRESS':
      return { text: 'Ocena i rozmowa oceniająca (przełożony)' };
    case 'FINAL_TALK_DONE':
      return e.departmentHeadApprovedAt ? { text: 'Zatwierdzenie oceny (przełożony)' } : { text: 'Twoje zatwierdzenie', you: true };
    case 'COMPLETED':
      return { text: 'Zapoznanie ocenianego z oceną' };
    case 'ACKNOWLEDGED':
      return { text: '— zakończona' };
  }
}

/** Department head: path A evaluations of the unit — approval of the first evaluation (Part VI of the form). */
export function HeadApprovals() {
  const { user } = useSession();
  const [evals, setEvals] = useState<Evaluation[] | null>(null);
  useEffect(() => (user ? watchHeadEvaluations(user, setEvals) : undefined), [user]);
  if (!evals) return <Spinner />;
  const waiting = evals.filter((e) => e.status === 'FINAL_TALK_DONE' && !e.departmentHeadApprovedAt);
  const now = today();
  return (
    <>
      <PageHeader title="Zatwierdzenia" lead="Pierwsze oceny pracowników komórki. Arkusz pierwszej oceny podpisują bezpośredni przełożony i kierujący komórką organizacyjną." />
      <Card title={`Do zatwierdzenia (${waiting.length})`} className="mb-s5">
        {waiting.length === 0 ? (
          <Empty>Brak ocen oczekujących na zatwierdzenie. Ocena trafia tutaj po rozmowie oceniającej przeprowadzonej przez przełożonego.</Empty>
        ) : (
          <List evals={waiting} now={now} />
        )}
      </Card>
      <Card title="Wszystkie pierwsze oceny w komórce">{evals.length === 0 ? <Empty>Brak.</Empty> : <List evals={evals} now={now} />}</Card>
    </>
  );
}

function List({ evals, now }: { evals: Evaluation[]; now: string }) {
  const nav = useNavigate();
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Oceniany</th>
          <th>Przełożony</th>
          <th>Status</th>
          <th>Czeka na</th>
          <th>Koniec okresu oceny</th>
          <th aria-label="Akcje" />
        </tr>
      </thead>
      <tbody>
        {evals.map((e) => {
          const w = waitingFor(e);
          return (
            <tr key={e.id} {...rowLink(() => nav(`/oceny/${e.id}`))}>
              <td className="font-semibold">{e.employeeName}</td>
              <td>{e.supervisorName}</td>
              <td>
                <StatusBadge status={e.status} type={e.type} />
                {e.departmentHeadApprovedAt && <p className="hint mt-1">zatwierdzona przez Ciebie</p>}
              </td>
              <td className={w.you ? 'font-semibold' : ''}>{w.text}</td>
              <td>
                <DeadlineBadge due={e.deadlines.evaluationWindowTo} today={now} done={e.status === 'COMPLETED' || e.status === 'ACKNOWLEDGED'} />
              </td>
              <td className="text-right">
                <Link className="btn btn-secondary btn-sm" to={`/oceny/${e.id}`}>
                  Otwórz
                </Link>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
