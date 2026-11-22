import { fromDateOnly, toDateOnly } from './dates';

/*
 * Domain ↔ Firestore mapping shared by the web SDK and the Admin SDK (schema § 0):
 *  - `*Id` fields pointing to documents  ↔ DocumentReference,
 *  - calendar dates (DateOnly)          ↔ Timestamp at 00:00 Europe/Warsaw (toDateOnly / fromDateOnly only),
 *  - instants (ISO strings)             ↔ Timestamp.
 * The SDK-specific constructors are injected, so the domain stays free of Firebase imports.
 */

export interface FirestoreAdapter {
  ref(collection: string, id: string): unknown;
  isRef(v: unknown): v is { id: string; path: string };
  timestamp(d: Date): unknown;
  isTimestamp(v: unknown): v is { toDate(): Date };
}

/** Field name → referenced collection. */
const REF_FIELDS: Record<string, string> = {
  employeeId: 'employees',
  supervisorId: 'users',
  departmentHeadId: 'users',
  recipientUserId: 'users',
  sentByUserId: 'users',
  userId: 'users',
  evaluationId: 'evaluations',
  competencyId: 'competencies',
};

/** Calendar-date fields (besides every field inside `deadlines`). */
const DATE_FIELDS = new Set(['hireDate', 'indefiniteEmploymentDate', 'from', 'to', 'date', 'until', 'currentRankGrantedAt']);
const INSTANT_FIELDS = new Set(['createdAt', 'updatedAt', 'completedAt', 'computedAt', 'departmentHeadApprovedAt']);

type Kind = 'ref' | 'date' | 'instant' | null;
const kindOf = (key: string, inDeadlines: boolean): Kind =>
  key in REF_FIELDS ? 'ref' : inDeadlines || DATE_FIELDS.has(key) ? 'date' : INSTANT_FIELDS.has(key) ? 'instant' : null;

/** Domain object → Firestore data. The domain `id` field is dropped (it is the document id). */
export function encode(fs: FirestoreAdapter, value: unknown, key = '', inDeadlines = false): unknown {
  if (value === null || value === undefined) return value ?? null;
  const kind = kindOf(key, inDeadlines);
  if (typeof value === 'string' && kind) {
    if (kind === 'ref') return fs.ref(REF_FIELDS[key], value);
    if (kind === 'date') return fs.timestamp(toDateOnly(value));
    return fs.timestamp(new Date(value));
  }
  if (Array.isArray(value)) return value.map((v) => encode(fs, v, key, inDeadlines));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === 'id' && key === '') continue;
      out[k] = encode(fs, v, k, inDeadlines || key === 'deadlines');
    }
    return out;
  }
  return value;
}

/** Firestore data → domain object (`id` = document id). */
export function decode<T>(fs: FirestoreAdapter, data: unknown, id?: string): T {
  const walk = (value: unknown, key: string, inDeadlines: boolean): unknown => {
    if (value === null || value === undefined) return null;
    if (fs.isRef(value)) return value.id;
    if (fs.isTimestamp(value)) {
      const d = value.toDate();
      return kindOf(key, inDeadlines) === 'date' ? fromDateOnly(d) : d.toISOString();
    }
    if (Array.isArray(value)) return value.map((v) => walk(v, key, inDeadlines));
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) out[k] = walk(v, k, inDeadlines || key === 'deadlines');
      return out;
    }
    return value;
  };
  const out = walk(data, '', false) as Record<string, unknown>;
  return (id === undefined ? out : { ...out, id }) as T;
}
