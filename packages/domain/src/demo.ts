import demoOsp from '../data/demo-osp.json';
import { acknowledge, buildNewEvaluation, completeEvaluation, recalc, setAdditionalCriteria } from './evaluation';
import { toOsp, type ParsedOsp } from './osp';
import type { AppUser, CompetencyCode, Employee, Evaluation, Osp, Reminder, Score } from './types';

/*
 * Demo data — ALL PEOPLE ARE FICTIONAL. Job descriptions come from the three MC OSP files
 * (demo-data/osp/*.docx, parsed by the production parser — docs/04 § 1).
 * Used by the Firestore seed, the „Przywróć dane demo” function and tests.
 */

export const DEMO_OFFICE_ID = 'MC';
export const DEMO_PASSWORD = 'Kompas2026!';
/** Reference „today” of the demo scenario (deadline states in the seeded data are computed against it). */
export const DEMO_TODAY = '2026-11-21';
const NOW = '2026-11-21T08:00:00.000Z';

const OSP = demoOsp as Record<string, ParsedOsp>;

/** The three MC job descriptions (parsed from demo-data/osp/*.docx) offered as demo profiles in step 1. */
export const DEMO_OSP_PROFILES: { file: string; label: string; parsed: ParsedOsp }[] = Object.entries(OSP).map(([file, parsed]) => ({
  file,
  label: `${parsed.positionName} — ${parsed.symbol}`,
  parsed,
}));

const osp = (file: string, managementConfirmed: boolean | null = null): Osp => ({ ...toOsp(OSP[file]), managementConfirmed });

const user = (u: Omit<AppUser, 'officeId'>): AppUser => ({ ...u, officeId: DEMO_OFFICE_ID });

export const DEMO_USERS: AppUser[] = [
  user({
    uid: 'sup_dc',
    email: 'marta.zielinska@demo.kompas.local',
    displayName: 'Marta Zielińska',
    roles: ['SUPERVISOR'],
    department: 'Departament Cyberbezpieczeństwa',
    unit: 'Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa',
    position: 'Naczelnik Wydziału',
  }),
  user({
    uid: 'sup_dsi',
    email: 'tomasz.wisniewski@demo.kompas.local',
    displayName: 'Tomasz Wiśniewski',
    roles: ['SUPERVISOR'],
    department: 'Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji',
    unit: 'Wydział Wspierania Innowacyjności',
    position: 'Naczelnik Wydziału',
  }),
  user({
    uid: 'sup_dwm',
    email: 'katarzyna.lewandowska@demo.kompas.local',
    displayName: 'Katarzyna Lewandowska',
    roles: ['SUPERVISOR', 'DEPARTMENT_HEAD'],
    department: 'Departament Współpracy Międzynarodowej',
    unit: 'Departament Współpracy Międzynarodowej',
    position: 'Zastępca Dyrektora',
  }),
  user({
    uid: 'head_dc',
    email: 'pawel.kaminski@demo.kompas.local',
    displayName: 'Paweł Kamiński',
    roles: ['DEPARTMENT_HEAD'],
    department: 'Departament Cyberbezpieczeństwa',
    unit: 'Departament Cyberbezpieczeństwa',
    position: 'Dyrektor Departamentu',
  }),
  user({
    uid: 'head_dsi',
    email: 'iwona.grabowska@demo.kompas.local',
    displayName: 'Iwona Grabowska',
    roles: ['DEPARTMENT_HEAD'],
    department: 'Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji',
    unit: 'Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji',
    position: 'Dyrektor Departamentu',
  }),
  user({
    uid: 'hr_admin',
    email: 'joanna.dabrowska@demo.kompas.local',
    displayName: 'Joanna Dąbrowska',
    roles: ['HR_ADMIN'],
    department: 'Biuro Dyrektora Generalnego',
    unit: 'Wydział Kadr',
    position: 'Główny specjalista ds. kadr',
  }),
];

/** Jury entry buttons on the login screen (docs/01 § 9). */
export const JURY_ENTRY: { label: string; uid: string; description: string }[] = [
  { label: 'Wejdź jako przełożony', uid: 'sup_dc', description: 'Marta Zielińska — ocena okresowa (Arkusz C), pierwsza ocena i nowy pracownik bez oceny' },
  { label: 'Wejdź jako kierujący komórką', uid: 'head_dc', description: 'Paweł Kamiński — zatwierdzanie pierwszej oceny' },
  { label: 'Wejdź jako HR', uid: 'hr_admin', description: 'Joanna Dąbrowska — terminy i przypomnienia, bez treści ocen' },
];

/** Fills the office and the department head's display data from DEMO_USERS. */
const emp = (e: Omit<Employee, 'officeId' | 'departmentHeadName' | 'departmentHeadPosition'>): Employee => {
  const head = DEMO_USERS.find((u) => u.uid === e.departmentHeadId)!;
  return { ...e, officeId: DEMO_OFFICE_ID, departmentHeadName: head.displayName, departmentHeadPosition: head.position };
};

export const DEMO_EMPLOYEES: Employee[] = [
  // Scenario 1 — senior specialist, form C
  emp({
    id: 'emp_wojcik',
    firstName: 'Michał',
    lastName: 'Wójcik',
    employmentType: 'CIVIL_SERVICE_EMPLOYEE',
    contractType: 'INDEFINITE',
    hireDate: '2020-03-02',
    indefiniteEmploymentDate: '2021-03-02', // after a 12-month contract and a positive first evaluation
    supervisorId: 'sup_dc',
    departmentHeadId: 'head_dc',
    absences: [{ from: '2025-11-03', to: '2025-12-16' }],
    osp: osp('osp-dc-wzksoic-6-starszy-specjalista.docx'),
    lastPeriodicEvaluation: { result: 'POSITIVE', level: 'MEETS_EXPECTATIONS', date: '2024-12-02' },
  }),
  // Scenario 2 — legal counsel (radca), form C, civil servant
  emp({
    id: 'emp_kaczmarek',
    firstName: 'Agnieszka',
    lastName: 'Kaczmarek',
    employmentType: 'CIVIL_SERVANT',
    contractType: 'INDEFINITE',
    hireDate: '2018-09-01',
    indefiniteEmploymentDate: '2019-09-01', // after a 12-month contract and a positive first evaluation
    supervisorId: 'sup_dsi',
    departmentHeadId: 'head_dsi',
    absences: [],
    osp: osp('osp-dsi-wwi-5-radca.docx'),
    lastPeriodicEvaluation: { result: 'POSITIVE', level: 'ABOVE_EXPECTATIONS', date: '2025-03-10' },
  }),
  // Scenario 3 — head of unit, form B (direct management confirmed), civil servant
  emp({
    id: 'emp_szymanski',
    firstName: 'Krzysztof',
    lastName: 'Szymański',
    employmentType: 'CIVIL_SERVANT',
    contractType: 'INDEFINITE',
    hireDate: '2016-02-01',
    indefiniteEmploymentDate: '2017-02-01', // after a 12-month contract and a positive first evaluation
    supervisorId: 'sup_dwm',
    departmentHeadId: 'sup_dwm',
    absences: [],
    osp: osp('osp-dwm-wkam-1-naczelnik-wydzialu.docx', true),
    lastPeriodicEvaluation: { result: 'POSITIVE', level: 'ABOVE_EXPECTATIONS', date: '2025-01-15' },
  }),
  // Path A — first evaluation in progress (report submitted)
  emp({
    id: 'emp_mazur',
    firstName: 'Adam',
    lastName: 'Mazur',
    employmentType: 'CIVIL_SERVICE_EMPLOYEE',
    contractType: 'DEFINITE_12M',
    hireDate: '2026-02-02',
    indefiniteEmploymentDate: null,
    supervisorId: 'sup_dc',
    departmentHeadId: 'head_dc',
    absences: [],
    osp: osp('osp-dc-wzksoic-6-starszy-specjalista.docx'),
    lastPeriodicEvaluation: null,
  }),
  // Path A — new hire, initial talk overdue (HR reminder)
  emp({
    id: 'emp_krawczyk',
    firstName: 'Natalia',
    lastName: 'Krawczyk',
    employmentType: 'CIVIL_SERVICE_EMPLOYEE',
    contractType: 'DEFINITE_12M',
    hireDate: '2026-10-20',
    indefiniteEmploymentDate: null,
    supervisorId: 'sup_dsi',
    departmentHeadId: 'head_dsi',
    absences: [],
    osp: osp('osp-dsi-wwi-5-radca.docx'),
    lastPeriodicEvaluation: null,
  }),
  // Path A — new hire with no evaluation yet: the jury starts one from „Pracownicy bez oceny w toku”
  emp({
    id: 'emp_pawlak',
    firstName: 'Karolina',
    lastName: 'Pawlak',
    employmentType: 'CIVIL_SERVICE_EMPLOYEE',
    contractType: 'DEFINITE_12M',
    hireDate: '2026-11-16',
    indefiniteEmploymentDate: null,
    supervisorId: 'sup_dc',
    departmentHeadId: 'head_dc',
    absences: [],
    osp: osp('osp-dc-wzksoic-6-starszy-specjalista.docx'),
    lastPeriodicEvaluation: null,
  }),
];

const byId = (id: string) => DEMO_EMPLOYEES.find((e) => e.id === id)!;
const sup = (uid: string) => DEMO_USERS.find((u) => u.uid === uid)!;

/** Sets indicator levels (in indicator order; null = „brak podstaw”) and the supervisor's final score. */
function assess(ev: Evaluation, code: CompetencyCode, levels: (Score | null)[], finalScore: Score | null, evidence?: string): Evaluation {
  return recalc({
    ...ev,
    criteriaAssessments: ev.criteriaAssessments.map((c) =>
      c.competencyId !== code
        ? c
        : {
            ...c,
            finalScore,
            indicatorAssessments: c.indicatorAssessments.map((i, n) => ({
              ...i,
              level: levels[n] ?? null,
              evidence: n === 0 && evidence ? evidence : i.evidence,
            })),
          },
    ),
  });
}

export function buildDemoEvaluations(): Evaluation[] {
  // 1. Wójcik — periodic, form C, not started (initial talk / OSP analysis ahead)
  const wojcik = buildNewEvaluation({ id: 'ev_wojcik_2026', employee: byId('emp_wojcik'), supervisor: sup('sup_dc'), now: NOW });

  // 2. Kaczmarek — periodic, form C, in progress
  let kaczmarek = buildNewEvaluation({ id: 'ev_kaczmarek_2027', employee: byId('emp_kaczmarek'), supervisor: sup('sup_dsi'), now: NOW });
  kaczmarek = setAdditionalCriteria(kaczmarek, ['MYSLENIE_ANALITYCZNE', 'KREATYWNOSC', 'PODEJMOWANIE_DECYZJI']);
  kaczmarek = {
    ...kaczmarek,
    status: 'IN_PROGRESS',
    currentStep: 'assessment',
    deadlines: { ...kaczmarek.deadlines, initialTalkDate: '2025-03-28', periodFrom: '2025-03-28' },
  };
  kaczmarek = assess(kaczmarek, 'WYKORZYSTYWANIE_WIEDZY', [7, 7, 5], 7, 'Opinia o projekcie ustawy o systemach AI — samodzielna analiza orzecznictwa TSUE, przyjęta bez poprawek.');
  kaczmarek = assess(kaczmarek, 'RZETELNOSC', [5, 5], 5);
  kaczmarek = assess(kaczmarek, 'MYSLENIE_ANALITYCZNE', [7, 7, 9], null);

  // 3. Szymański — periodic, form B, completed and acknowledged (history + PDF)
  let szym = buildNewEvaluation({ id: 'ev_szymanski_2025', employee: byId('emp_szymanski'), supervisor: sup('sup_dwm'), now: NOW, baseDate: '2023-01-16' });
  szym = setAdditionalCriteria(szym, ['WYKORZYSTYWANIE_WIEDZY', 'NEGOCJOWANIE', 'RZETELNOSC']);
  szym = { ...szym, deadlines: { ...szym.deadlines, initialTalkDate: '2023-02-06', periodFrom: '2023-02-06', finalTalkDate: '2025-01-14' } };
  for (const [code, levels, score] of [
    ['ZARZADZANIE_LUDZMI', [7, 7, 5, 7, 7, 5], 7],
    ['PODEJMOWANIE_DECYZJI', [7, 7, 7], 7],
    ['ORGANIZACJA_PRACY', [7, 7, 5, 7, 7], 7],
    ['WSPOLPRACA', [5, 7, 5, 5, 7, 5], 5],
    ['KOMUNIKACJA', [7, 7, 7, 5], 7],
    ['WYKORZYSTYWANIE_WIEDZY', [9, 7, 7], 7],
    ['NEGOCJOWANIE', [7, 5, 7], 7],
    ['RZETELNOSC', [7, 7], 7],
  ] as [CompetencyCode, Score[], Score][]) {
    szym = assess(szym, code, levels, score);
  }
  szym = {
    ...szym,
    texts: {
      justification: 'Wydział sprawnie przygotował 14 wizyt zagranicznych kierownictwa MC; terminowe rozliczenie dotacji.',
      developmentPlan: 'Szkolenie z negocjacji wielostronnych; udział w programie mentoringowym dla kadry kierowniczej.',
      justificationAiDraft: false,
      developmentPlanAiDraft: false,
    },
  };
  szym = completeEvaluation(szym, byId('emp_szymanski'), '2025-01-15', '2025-01-15T10:00:00.000Z');
  szym = acknowledge(szym, '2025-01-16', '2025-01-16T09:00:00.000Z');

  // 4. Mazur — first evaluation, report submitted on time, assessment ahead
  let mazur = buildNewEvaluation({ id: 'ev_mazur_first', employee: byId('emp_mazur'), supervisor: sup('sup_dc'), now: NOW });
  mazur = {
    ...mazur,
    status: 'REPORT_SUBMITTED',
    currentStep: 'assessment',
    deadlines: { ...mazur.deadlines, initialTalkDate: '2026-02-16', reportSubmittedAt: '2026-10-12' },
    firstEvalRequirements: { examPassed: null, reportSubmittedOnTime: 'YES' },
  };

  // 5. Krawczyk — first evaluation, initial talk overdue
  const krawczyk = buildNewEvaluation({ id: 'ev_krawczyk_first', employee: byId('emp_krawczyk'), supervisor: sup('sup_dsi'), now: NOW });

  return [wojcik, kaczmarek, szym, mazur, krawczyk];
}

export function buildDemoReminders(): Reminder[] {
  return [
    {
      id: 'rem_krawczyk_initial',
      officeId: DEMO_OFFICE_ID,
      evaluationId: 'ev_krawczyk_first',
      recipientUserId: 'sup_dsi',
      sentByUserId: 'hr_admin',
      type: 'MANUAL_HR',
      message: 'Przypomnienie: termin rozmowy wstępnej z Natalią Krawczyk minął 10.11.2026 (21 dni od nawiązania stosunku pracy).',
      status: 'SENT',
      createdAt: NOW,
    },
  ];
}
