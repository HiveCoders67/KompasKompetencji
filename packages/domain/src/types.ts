/*
 * Domain types mirroring docs/firebase/firestore_structure.md.
 * In the domain layer references are plain document ids and calendar dates are `DateOnly`
 * strings (yyyy-MM-dd). The Firestore adapters convert them to DocumentReference / Timestamp
 * (calendar dates only through toDateOnly / fromDateOnly — see dates.ts).
 */

/** Calendar date `yyyy-MM-dd` (Europe/Warsaw). */
export type DateOnly = string;
/** Instant as ISO-8601 string (createdAt, updatedAt, computedAt…). */
export type Instant = string;

export type Role = 'SUPERVISOR' | 'DEPARTMENT_HEAD' | 'HR_ADMIN';
export type EvaluationType = 'FIRST_EVALUATION' | 'PERIODIC_EVALUATION';
export type FormType = 'FIRST' | 'FORM_B' | 'FORM_C';
export type EvaluationStatus =
  | 'DRAFT'
  | 'INITIAL_TALK_DONE'
  | 'REPORT_SUBMITTED'
  | 'IN_PROGRESS'
  | 'FINAL_TALK_DONE'
  | 'COMPLETED'
  | 'ACKNOWLEDGED';

export type Score = 1 | 3 | 5 | 7 | 9;
export type OverallLevel =
  | 'FAR_BELOW_EXPECTATIONS'
  | 'BELOW_EXPECTATIONS'
  | 'MEETS_EXPECTATIONS'
  | 'ABOVE_EXPECTATIONS'
  | 'FAR_ABOVE_EXPECTATIONS';
export type FinalResult = 'POSITIVE' | 'NEGATIVE';
export type ExamPassed = 'YES' | 'NO' | 'NOT_APPLICABLE';
export type YesNo = 'YES' | 'NO';

export type EmploymentType = 'CIVIL_SERVICE_EMPLOYEE' | 'CIVIL_SERVANT';
export type ContractType = 'DEFINITE_12M' | 'SUBSTITUTION' | 'INDEFINITE';
export type Subordinates = 'NONE' | 'UP_TO_4' | 'FROM_5_TO_9' | 'ABOVE_9' | 'MANAGERS_SUBORDINATE';

export type CompetencyCode =
  | 'KOMUNIKACJA'
  | 'KREATYWNOSC'
  | 'NEGOCJOWANIE'
  | 'ORGANIZACJA_PRACY'
  | 'ORIENTACJA_NA_KLIENTA'
  | 'PODEJMOWANIE_DECYZJI'
  | 'SYTUACJE_KRYZYSOWE'
  | 'RZETELNOSC'
  | 'MYSLENIE_ANALITYCZNE'
  | 'WYKORZYSTYWANIE_WIEDZY'
  | 'WSPOLPRACA'
  | 'WYSTAPIENIA_PUBLICZNE'
  | 'ZARZADZANIE_LUDZMI'
  | 'ZARZADZANIE_STRATEGICZNE';

// ------------------------------------------------------------------ users
export interface AppUser {
  uid: string;
  officeId: string;
  email: string;
  displayName: string;
  roles: Role[];
  department: string;
  unit: string;
  position: string;
}

// ------------------------------------------------------------ competencies
export interface Behavior {
  level: Score;
  description: string;
}
export interface Indicator {
  id: string;
  label: string;
  behaviors: Behavior[];
}
export interface Competency {
  code: CompetencyCode;
  name: string;
  mandatoryFor: FormType[];
  indicators: Indicator[];
}

// --------------------------------------------------------------- employees
export interface Absence {
  from: DateOnly;
  to: DateOnly;
}

export interface Osp {
  symbol: string;
  positionName: string;
  department: string;
  unit: string;
  directSupervisorPosition: string;
  subordinates: Subordinates;
  /** Supervisor's confirmation that the post consists in direct management (FORM_B); null = not decided yet. */
  managementConfirmed: boolean | null;
  recommendedForm: FormType;
  mainTasks: string[];
  softCompetencies: CompetencyCode[];
  /** Extra structured fields extracted by the DOCX parser (docs/03 § 2.C). */
  purpose?: string[];
  authorizations?: string[];
  difficultyFactors?: string[];
}

export interface LastPeriodicEvaluation {
  result: FinalResult;
  level: OverallLevel;
  date: DateOnly;
}

export interface Employee {
  id: string;
  officeId: string;
  firstName: string;
  lastName: string;
  employmentType: EmploymentType;
  contractType: ContractType;
  hireDate: DateOnly;
  /**
   * Start of employment for an indefinite period (contract or appointment) — the base of the first periodic
   * evaluation (§ 7 pkt 1 rozp. 2016; art. 81 ust. 4 ustawy). Differs from `hireDate` when the person started on a
   * 12-month contract (art. 35 ust. 3). null for DEFINITE_12M / SUBSTITUTION.
   */
  indefiniteEmploymentDate: DateOnly | null;
  supervisorId: string;
  departmentHeadId: string;
  /** Display copies from users/{departmentHeadId} — Part I of the first-evaluation form (the supervisor cannot read users). */
  departmentHeadName: string;
  departmentHeadPosition: string;
  absences: Absence[];
  osp: Osp;
  lastPeriodicEvaluation: LastPeriodicEvaluation | null;
}

// ------------------------------------------------------------- evaluations
export interface IndicatorAssessment {
  indicatorId: string;
  selected: boolean;
  /** null with selected=true = „brak podstaw do oceny”. */
  level: Score | null;
  evidence: string | null;
}

export interface CriterionAssessment {
  competencyId: CompetencyCode;
  isMandatory: boolean;
  indicatorAssessments: IndicatorAssessment[];
  suggestedMean: number | null;
  suggestedScore: Score | null;
  finalScore: Score | null;
}

export interface Deadlines {
  initialTalkDue: DateOnly;
  initialTalkDate: DateOnly | null;
  evaluationDueDate: DateOnly;
  periodFrom: DateOnly | null;
  periodTo: DateOnly | null;
  finalTalkDate: DateOnly | null;
  reportDueFrom: DateOnly | null;
  reportDueTo: DateOnly | null;
  reportSubmittedAt: DateOnly | null;
  evaluationWindowFrom: DateOnly | null;
  evaluationWindowTo: DateOnly | null;
  acknowledgedAt: DateOnly | null;
  objectionDeadline: DateOnly | null;
}

export interface FirstEvalRequirements {
  examPassed: ExamPassed | null;
  reportSubmittedOnTime: YesNo | null;
}

export interface EvaluationTexts {
  justification: string | null;
  developmentPlan: string | null;
  justificationAiDraft: boolean;
  developmentPlanAiDraft: boolean;
}

export interface EvaluationSummary {
  averageScore: number;
  /** Periodic evaluation only (FIRST has no overall level on the form). */
  overallLevel: OverallLevel | null;
  finalResult: FinalResult;
  computedAt: Instant;
}

export interface PromotionRequest {
  included: boolean;
  appointmentYear: number | null;
  currentRank: string | null;
  currentRankGrantedAt: DateOnly | null;
  requestedRank: string | null;
  motivation: string | null;
}

export interface PreviousSupervisor {
  supervisorId: string;
  until: DateOnly;
}

export interface Evaluation {
  id: string;
  officeId: string;
  type: EvaluationType;
  formType: FormType;
  status: EvaluationStatus;
  currentStep: string;
  isReEvaluationAfterNegative: boolean;

  employeeId: string;
  employeeName: string;
  department: string;
  supervisorId: string;
  supervisorName: string;
  previousSupervisors: PreviousSupervisor[];
  departmentHeadId: string;
  departmentHeadApprovedAt: Instant | null;

  deadlines: Deadlines;
  criteriaAssessments: CriterionAssessment[];
  firstEvalRequirements: FirstEvalRequirements | null;
  texts: EvaluationTexts;
  summary: EvaluationSummary | null;
  promotionRequest: PromotionRequest;

  updatedAt: Instant;
  completedAt: Instant | null;
}

export interface EvaluationTracking {
  id: string;
  officeId: string;
  evaluationId: string;
  type: EvaluationType;
  formType: FormType;
  status: EvaluationStatus;
  employeeName: string;
  department: string;
  supervisorId: string;
  supervisorName: string;
  deadlines: {
    initialTalkDue: DateOnly;
    evaluationDueDate: DateOnly;
    reportDueTo: DateOnly | null;
    objectionDeadline: DateOnly | null;
  };
  updatedAt: Instant;
}

// ------------------------------------------------------- reminders, AI chat
export type ReminderType = 'INITIAL_TALK_DUE' | 'REPORT_DUE' | 'EVALUATION_DUE' | 'MANUAL_HR';
export interface Reminder {
  id: string;
  officeId: string;
  evaluationId: string;
  recipientUserId: string;
  sentByUserId: string | null;
  type: ReminderType;
  message: string;
  status: 'SENT' | 'READ';
  createdAt: Instant;
}

export type AssistantMode = 'FORMAL_ASSISTANT' | 'INTERVIEW_ASSISTANT';
export interface AiSession {
  id: string;
  officeId: string;
  userId: string;
  evaluationId: string | null;
  mode: AssistantMode;
  createdAt: Instant;
}

export type KbSource = 'USTAWA' | 'ROZP_2016' | 'ROZP_2015' | 'PORADNIK_OO' | 'PORADNIK_PO' | 'ARKUSZE' | 'MODEL';

export interface Citation {
  source: KbSource;
  sourceTitle: string;
  unit: string | null;
  page: number | null;
  excerpt: string;
}

export interface ScreenContext {
  path: 'A' | 'B' | null;
  formType: FormType | null;
  step: string | null;
  status: EvaluationStatus | null;
}

export interface AiMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  refused: boolean;
  context: ScreenContext | null;
  citations: Citation[];
  createdAt: Instant;
}
