import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { REMINDER_LABELS, type Reminder } from '@kompas/domain';
import { useSession } from '../app/session';
import { Card, Empty, PageHeader, Spinner } from '../components/ui';
import { markReminderRead, watchMyReminders } from '../data/repo';

export function RemindersPage() {
  const { user } = useSession();
  const [items, setItems] = useState<Reminder[] | null>(null);
  useEffect(() => (user ? watchMyReminders(user, setItems) : undefined), [user]);
  if (!items) return <Spinner />;
  const sorted = [...items].sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  return (
    <>
      <PageHeader title="Przypomnienia" lead="Przypomnienia od komórki kadr o terminach ustawowych. Powiadomienia e-mail / EZD — przyszła integracja." />
      <Card>
        {sorted.length === 0 ? (
          <Empty>Brak przypomnień.</Empty>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {sorted.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-s4 py-s3">
                <div>
                  <p className="flex items-center gap-2 text-sm">
                    {r.status === 'SENT' && <span className="badge badge-info">nowe</span>}
                    <span className="hint">{REMINDER_LABELS[r.type]}</span>
                    <span className="hint">· {r.createdAt ? new Date(r.createdAt).toLocaleString('pl-PL') : ''}</span>
                  </p>
                  <p className="mt-1">{r.message}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Link className="btn btn-secondary btn-sm" to={`/oceny/${r.evaluationId}`}>
                    Otwórz ocenę
                  </Link>
                  {r.status === 'SENT' && (
                    <button className="btn btn-ghost btn-sm" onClick={() => markReminderRead(r.id)}>
                      Oznacz jako przeczytane
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
