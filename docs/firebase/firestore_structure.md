# Struktura Bazy Danych Cloud Firestore — Kompas Kompetencji

Dokument definiuje kolekcje, schematy dokumentów, indeksy oraz założenia reguł bezpieczeństwa (RBAC) dla aplikacji **Kompas Kompetencji** w Firebase / Cloud Firestore.

Struktura wspiera:
* obie ścieżki oceny (*Pierwsza ocena* oraz *Ocena okresowa — Formularz B i C*),
* mechanizm **Human-in-the-loop** (rozdzielenie `suggestedScore` od `finalScore`),
* panel monitoringu i przypomnień dla **HR / Administratora**,
* historię czatów z **Asystentem Formalnym (RAG)** i **Asystentem Rozmowy**,
* minimalizację danych osobowych (RODO) i **wielourzędowość** (`officeId`).

## 0. Konwencje schematu
* **Referencje** (`*Id` wskazujące dokument) to `DocumentReference` — w przykładach zapisane jako `ref(users/{uid})`. W regułach porównujemy je ze ścieżką: `resource.data.supervisorId == /databases/$(database)/documents/users/$(request.auth.uid)`.
* **Enumy** to angielskie kody; polskie etykiety tylko w słowniku UI/PDF `labels.pl`.
* **Daty kalendarzowe** (terminy, daty rozmów, nieobecności) to `Timestamp` o 00:00 `Europe/Warsaw`, wyłącznie przez helpery `toDateOnly` / `fromDateOnly`. `createdAt` / `updatedAt` — zwykłe `Timestamp` (serverTimestamp).
* **`officeId`** w każdym dokumencie domenowym; reguły wymagają `resource.data.officeId == request.auth.token.officeId`.
* **Role** w custom claims: `request.auth.token.roles` (lista: `SUPERVISOR`, `DEPARTMENT_HEAD`, `HR_ADMIN`). Jedna osoba może mieć kilka ról (np. naczelnik = przełożony i kierujący komórką).

---

## 1. Kolekcja `users/{userId}`
Konta użytkowników systemu powiązane z Firebase Authentication (`uid`). Pole `roles` jest kopią claims do wyświetlania — reguły ufają wyłącznie claims.

```json
{
  "uid": "string",
  "officeId": "string",
  "email": "string",
  "displayName": "string",
  "roles": ["SUPERVISOR", "DEPARTMENT_HEAD"],
  "department": "Departament Cyberbezpieczeństwa",
  "unit": "Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa",
  "position": "Naczelnik Wydziału",
  "createdAt": "Timestamp"
}
```

---

## 2. Kolekcja `employees/{employeeId}`
Minimalny profil ocenianego pracownika wraz z zagnieżdżonymi danymi z Opisu Stanowiska Pracy (OSP), niezbędnymi do doboru arkusza (`FORM_B` / `FORM_C`) oraz sugestii kryteriów dodatkowych.

```json
{
  "officeId": "string",
  "firstName": "string",
  "lastName": "string",
  "employmentType": "CIVIL_SERVICE_EMPLOYEE | CIVIL_SERVANT",
  "contractType": "DEFINITE_12M | SUBSTITUTION | INDEFINITE",
  "hireDate": "Timestamp (data kalendarzowa)",
  "supervisorId": "ref(users/{uid})",
  "departmentHeadId": "ref(users/{uid})",
  "absences": [
    { "from": "Timestamp (data kalendarzowa)", "to": "Timestamp (data kalendarzowa)" }
  ],
  "osp": {
    "symbol": "DC WZKSOiC 6",
    "positionName": "starszy specjalista",
    "department": "Departament Cyberbezpieczeństwa",
    "unit": "Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa",
    "directSupervisorPosition": "naczelnik wydziału",
    "subordinates": "NONE | UP_TO_4 | FROM_5_TO_9 | ABOVE_9 | MANAGERS_SUBORDINATE",
    "managementConfirmed": "boolean | null",
    "recommendedForm": "FORM_B | FORM_C",
    "mainTasks": ["Zadanie 1...", "Zadanie 2..."],
    "softCompetencies": ["ORGANIZACJA_PRACY", "WSPOLPRACA", "MYSLENIE_ANALITYCZNE", "WYKORZYSTYWANIE_WIEDZY"]
  },
  "lastPeriodicEvaluation": {
    "result": "POSITIVE | NEGATIVE",
    "level": "FAR_BELOW_EXPECTATIONS | BELOW_EXPECTATIONS | MEETS_EXPECTATIONS | ABOVE_EXPECTATIONS | FAR_ABOVE_EXPECTATIONS",
    "date": "Timestamp (data kalendarzowa)"
  }
}
```

> **Uwagi projektowe:**
> * Pole `osp` jest zagnieżdżone w dokumencie pracownika, aby od razu przekazywać kontekst stanowiska do analizy OSP i Asystenta Rozmowy.
> * `subordinates` pochodzi z checkboxów OSP. Wartość inna niż `NONE` → sugestia `FORM_B`, wymagająca potwierdzenia przez przełożonego (`managementConfirmed`), bo pole OSP obejmuje też „koordynowanie” (patrz `02_...` § 1.2).
> * `absences` — wyłącznie okresy, **bez przyczyny** (przyczyna mogłaby być daną o zdrowiu, art. 9 RODO).

---

## 3. Kolekcja `competencies/{competencyId}`
Słownik 14 kryteriów oceny z Załącznika nr 1 do rozporządzenia z 2016 r. ze wskaźnikami behawioralnymi z modelu kompetencji MC. Seed z `packages/domain/data/competencies.json` (generowanego z `knowledge/sources/model/model-kompetencji.xlsx`). Kolekcja globalna (bez `officeId`).

```json
{
  "code": "KOMUNIKACJA",
  "name": "Komunikacja",
  "mandatoryFor": ["FIRST", "FORM_B", "FORM_C"],
  "indicators": [
    {
      "id": "KOMUNIKACJA_1",
      "label": "Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie.",
      "behaviors": [
        { "level": 1, "description": "Przerywa wypowiedź lub odpowiada, pomijając kluczowe informacje przekazane przez rozmówcę." },
        { "level": 3, "description": "Wysłuchuje wypowiedzi, lecz pozostawia istotne niejasności…" },
        { "level": 5, "description": "Pozwala rozmówcy dokończyć wypowiedź, dopytuje o niejasności i potwierdza kluczowe ustalenia." },
        { "level": 7, "description": "W rozmowie o niejednoznacznych kwestiach parafrazuje stanowisko rozmówcy…" },
        { "level": 9, "description": "W rozmowie wielostronnej porządkuje różne interpretacje…" }
      ]
    }
  ]
}
```

> **Ścieżka `FIRST`:** UI pokazuje wyłącznie zachowania z poziomów `3`, `5`, `7`.

---

## 4. Kolekcja `evaluations/{evaluationId}`
Główna kolekcja procesów oceny — wspólna dla obu ścieżek.

```json
{
  "officeId": "string",
  "type": "FIRST_EVALUATION | PERIODIC_EVALUATION",
  "formType": "FIRST | FORM_B | FORM_C",
  "status": "DRAFT | INITIAL_TALK_DONE | REPORT_SUBMITTED | IN_PROGRESS | FINAL_TALK_DONE | COMPLETED | ACKNOWLEDGED",
  "currentStep": "string",
  "isReEvaluationAfterNegative": false,

  "employeeId": "ref(employees/{id})",
  "employeeName": "Jan Kowalski",
  "department": "Departament Cyberbezpieczeństwa",
  "supervisorId": "ref(users/{uid})",
  "supervisorName": "Anna Nowak",
  "previousSupervisors": [
    { "supervisorId": "ref(users/{uid})", "until": "Timestamp (data kalendarzowa)" }
  ],
  "departmentHeadId": "ref(users/{uid})",
  "departmentHeadApprovedAt": "Timestamp | null",

  "deadlines": {
    "initialTalkDue": "Timestamp",
    "initialTalkDate": "Timestamp | null",
    "evaluationDueDate": "Timestamp",
    "periodFrom": "Timestamp | null",
    "periodTo": "Timestamp | null",
    "finalTalkDate": "Timestamp | null",
    "reportDueFrom": "Timestamp | null",
    "reportDueTo": "Timestamp | null",
    "reportSubmittedAt": "Timestamp | null",
    "evaluationWindowFrom": "Timestamp | null",
    "evaluationWindowTo": "Timestamp | null",
    "acknowledgedAt": "Timestamp | null",
    "objectionDeadline": "Timestamp | null"
  },

  "criteriaAssessments": [
    {
      "competencyId": "ref(competencies/KOMUNIKACJA)",
      "isMandatory": true,
      "indicatorAssessments": [
        { "indicatorId": "KOMUNIKACJA_1", "selected": true, "level": 5, "evidence": "string | null" },
        { "indicatorId": "KOMUNIKACJA_2", "selected": true, "level": null, "evidence": null },
        { "indicatorId": "KOMUNIKACJA_3", "selected": false, "level": null, "evidence": null }
      ],
      "suggestedMean": 5.0,
      "suggestedScore": 5,
      "finalScore": 7
    }
  ],

  "firstEvalRequirements": {
    "examPassed": "YES | NO | NOT_APPLICABLE",
    "reportSubmittedOnTime": "YES | NO"
  },

  "texts": {
    "justification": "string | null",
    "developmentPlan": "string | null",
    "justificationAiDraft": false,
    "developmentPlanAiDraft": false
  },

  "summary": {
    "averageScore": 5.8,
    "overallLevel": "MEETS_EXPECTATIONS",
    "finalResult": "POSITIVE | NEGATIVE",
    "computedAt": "Timestamp"
  },

  "promotionRequest": {
    "included": false,
    "appointmentYear": "number | null",
    "currentRank": "string | null",
    "currentRankGrantedAt": "Timestamp | null",
    "requestedRank": "string | null",
    "motivation": "string | null"
  },

  "updatedAt": "Timestamp",
  "completedAt": "Timestamp | null"
}
```

### Kluczowe reguły pól:
* **Human-in-the-loop:** `suggestedMean` / `suggestedScore` liczone deterministycznie z `indicatorAssessments` (`02_...` § 3.4; `level: null` przy `selected: true` = „brak podstaw do oceny”); `finalScore` zawsze wybiera przełożony. Brak pola na uzasadnienie odstępstwa.
* **`summary`** zapisuje wyłącznie Cloud Function `completeEvaluation` (wraz z przejściem do `COMPLETED`). Klient nie może go zapisać.
* **`texts.*AiDraft`** — `true` po wstawieniu szkicu AI, `false` po pierwszej ręcznej edycji (steruje etykietą „Szkic wygenerowany przez AI”).
* **Statusy** (`02_...` § 4): ścieżka B nie używa `REPORT_SUBMITTED`; ścieżka A nie używa `IN_PROGRESS`. `COMPLETED` w ścieżce A wymaga `departmentHeadApprovedAt`.
* **Pola ścieżki A:** `reportDue*`, `reportSubmittedAt`, `evaluationWindow*`, `firstEvalRequirements`, `departmentHeadApprovedAt`. Treści sprawozdania nie przechowujemy.
* **Część III (`promotionRequest`):** wyłącznie `PERIODIC_EVALUATION`, `employmentType == CIVIL_SERVANT`, wynik `POSITIVE`.
* **`currentStep`** — ostatni krok steppera (przycisk „Kontynuuj” na liście ocen); autozapis aktualizuje dokument w trakcie edycji.

### 4.1. Kolekcja `evaluation_tracking/{evaluationId}` (widok dla HR)
Zdenormalizowana kopia **wyłącznie** danych potrzebnych w panelu monitoringu HR. Identyfikator dokumentu = `evaluationId`. Firestore Security Rules nie pozwalają ograniczyć odczytu do wybranych pól, dlatego `HR_ADMIN` **nie ma** dostępu do `evaluations`, a jedynie do tej kolekcji (minimalizacja danych — RODO).

```json
{
  "officeId": "string",
  "evaluationId": "ref(evaluations/{id})",
  "type": "FIRST_EVALUATION | PERIODIC_EVALUATION",
  "formType": "FIRST | FORM_B | FORM_C",
  "status": "DRAFT | INITIAL_TALK_DONE | REPORT_SUBMITTED | IN_PROGRESS | FINAL_TALK_DONE | COMPLETED | ACKNOWLEDGED",
  "employeeName": "Jan Kowalski",
  "department": "Departament Cyberbezpieczeństwa",
  "supervisorId": "ref(users/{uid})",
  "supervisorName": "Anna Nowak",
  "deadlines": {
    "initialTalkDue": "Timestamp",
    "evaluationDueDate": "Timestamp",
    "reportDueTo": "Timestamp | null",
    "objectionDeadline": "Timestamp | null"
  },
  "updatedAt": "Timestamp"
}
```

> **Synchronizacja:** wyłącznie Cloud Functions — trigger `onDocumentWritten` na `evaluations/{id}` (zmiany `status` / `deadlines`) oraz `completeEvaluation`. Wynik oceny (`POSITIVE`/`NEGATIVE`) celowo nie jest kopiowany.

---

## 5. Kolekcja `reminders/{reminderId}`
Przypomnienia wyłącznie w aplikacji (bez e-maili): licznik w sidebarze przełożonego, oznaczanie jako przeczytane.

```json
{
  "officeId": "string",
  "evaluationId": "ref(evaluations/{id})",
  "recipientUserId": "ref(users/{uid})",
  "sentByUserId": "ref(users/{uid}) | null",
  "type": "INITIAL_TALK_DUE | REPORT_DUE | EVALUATION_DUE | MANUAL_HR",
  "message": "Przypomnienie: termin oceny okresowej mija za 14 dni.",
  "status": "SENT | READ",
  "createdAt": "Timestamp"
}
```

---

## 6. Kolekcja `ai_sessions/{sessionId}` i podkolekcja `messages/{messageId}`

### Dokument główny: `ai_sessions/{sessionId}`
```json
{
  "officeId": "string",
  "userId": "ref(users/{uid})",
  "evaluationId": "ref(evaluations/{id}) | null",
  "mode": "FORMAL_ASSISTANT | INTERVIEW_ASSISTANT",
  "createdAt": "Timestamp"
}
```

### Podkolekcja: `ai_sessions/{sessionId}/messages/{messageId}`
Wiadomości asystenta zapisuje Cloud Function (po walidacji cytatów).

```json
{
  "role": "user | assistant",
  "content": "string",
  "refused": false,
  "context": { "path": "A | B", "formType": "FIRST | FORM_B | FORM_C | null", "step": "string | null", "status": "string | null" },
  "citations": [
    {
      "source": "ROZP_2016",
      "sourceTitle": "Rozporządzenie PRM z 4 kwietnia 2016 r. (Dz. U. poz. 470)",
      "unit": "§ 11 ust. 1 pkt 4",
      "page": null,
      "excerpt": "przyznaniu oceny negatywnej – w przypadku…"
    }
  ],
  "createdAt": "Timestamp"
}
```

---

## 7. Zalecane indeksy złożone (Composite Indexes)
1. `evaluations`: `officeId` (ASC) + `supervisorId` (ASC) + `status` (ASC) + `deadlines.evaluationDueDate` (ASC) — *lista ocen przełożonego posortowana po terminie*.
2. `evaluation_tracking`: `officeId` (ASC) + `department` (ASC) + `status` (ASC) + `deadlines.evaluationDueDate` (ASC) — *filtrowanie w panelu HR*.
3. `reminders`: `recipientUserId` (ASC) + `status` (ASC) + `createdAt` (DESC) — *nieprzeczytane przypomnienia*.

---

## 8. Założenia bezpieczeństwa (Firestore Security Rules / RBAC)
Wszystkie reguły dodatkowo wymagają zgodności `officeId` z `request.auth.token.officeId`. Role czytane wyłącznie z `request.auth.token.roles`.

* **`users`:** odczyt własnego profilu lub przez `HR_ADMIN`. Klient nie może zapisywać pola `roles` (role nadaje skrypt / Cloud Function przez Admin SDK).
* **`competencies`:** odczyt dla każdego zalogowanego; zapis wyłącznie Admin SDK (seed).
* **`employees`:** odczyt dla przypisanego `supervisorId`, `departmentHeadId` oraz `HR_ADMIN`. Przełożony może edytować `osp` i `absences`, ale **nie** `supervisorId`, `departmentHeadId`, `employmentType`, `contractType`, `hireDate`.
* **`evaluations`:**
  * `SUPERVISOR`: tworzenie tylko, gdy `employees/{employeeId}.supervisorId` wskazuje na niego; odczyt i zapis dokumentów, gdzie `supervisorId` wskazuje na niego. Zakaz zapisu `summary` i `departmentHeadApprovedAt`. Po `COMPLETED` dozwolone wyłącznie przejście do `ACKNOWLEDGED` z ustawieniem `deadlines.acknowledgedAt`.
  * `DEPARTMENT_HEAD`: odczyt dokumentów, gdzie `departmentHeadId` wskazuje na niego i `type == FIRST_EVALUATION`; zapis wyłącznie `departmentHeadApprovedAt`.
  * Przejście do `COMPLETED` — wyłącznie Cloud Function `completeEvaluation`.
  * `HR_ADMIN`: **brak dostępu** — statusy i terminy odczytuje z `evaluation_tracking`.
* **`evaluation_tracking`:** odczyt dla `HR_ADMIN` oraz przełożonego, gdzie `supervisorId` wskazuje na niego; zapis wyłącznie Cloud Functions.
* **`reminders`:** tworzenie przez `HR_ADMIN` (lub Cloud Function); odczyt i zmiana `status` na `READ` przez adresata.
* **`ai_sessions`:** odczyt i tworzenie sesji wyłącznie przez właściciela; wiadomości asystenta zapisuje Cloud Function.
* **Testy reguł:** `@firebase/rules-unit-testing` na emulatorze — m.in. „HR nie może odczytać `evaluations`”, „przełożony nie może utworzyć oceny dla cudzego pracownika”, „klient nie może zapisać `summary`”, „edycja po `COMPLETED` odrzucona”.
