# Struktura Bazy Danych Cloud Firestore — Kompas Kompetencji

Dokument definiuje kolekcje, schematy dokumentów, indeksy oraz założenia reguł bezpieczeństwa (RBAC) dla aplikacji **Kompas Kompetencji** w Firebase / Cloud Firestore.

Struktura wspiera:
* obie ścieżki oceny (*Pierwsza ocena* oraz *Ocena okresowa — Formularz B i C*),
* mechanizm **Human-in-the-loop** (rozdzielenie `suggestedScore` od `finalScore`),
* panel monitoringu i przypomnień dla **HR / Administratora**,
* historię czatów z **Asystentem Formalnym (RAG)** i **Asystentem Rozmowy**,
* minimalizację danych osobowych (RODO).

---

## 1. Kolekcja `users/{userId}`
Konta użytkowników systemu (przełożeni, kierujący komórkami, pracownicy HR / administratorzy) powiązane z Firebase Authentication (`uid`).

```json
{
  "uid": "string",
  "email": "string",
  "displayName": "string",
  "role": "SUPERVISOR | DEPARTMENT_HEAD | HR_ADMIN",
  "department": "Departament Cyberbezpieczeństwa",
  "unit": "Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa",
  "position": "Naczelnik Wydziału",
  "createdAt": "Timestamp"
}
```

---

## 2. Kolekcja `employees/{employeeId}`
Minimalny profil ocenianego pracownika wraz z zagnieżdżonymi danymi z Opisu Stanowiska Pracy (OSP), niezbędnymi do automatycznego doboru arkusza (`B` lub `C`) oraz sugestii kryteriów dodatkowych.

```json
{
  "firstName": "string",
  "lastName": "string",
  "employmentType": "PRACOWNIK_SC | URZEDNIK_SC",
  "contractType": "DEFINITE_12M | INDEFINITE",
  "hireDate": "Timestamp",
  "supervisorId": "users/{uid}",
  "departmentHeadId": "users/{uid}",
  "osp": {
    "symbol": "DC WZKSOiC 6",
    "positionName": "starszy specjalista",
    "department": "Departament Cyberbezpieczeństwa",
    "unit": "Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa",
    "hasDirectSubordinates": false,
    "recommendedForm": "B | C",
    "mainTasks": [
      "Zadanie 1...",
      "Zadanie 2..."
    ],
    "softCompetencies": [
      "organizacja pracy i orientacja na osiąganie celów",
      "współpraca",
      "myślenie analityczne",
      "wykorzystywanie wiedzy i doskonalenie zawodowe"
    ]
  },
  "lastPeriodicEvaluation": {
    "result": "POSITIVE | NEGATIVE",
    "level": "na poziomie oczekiwań",
    "date": "Timestamp"
  }
}
```

> **Uwaga projektowa:** Pole `osp` jest zagnieżdżone bezpośrednio w dokumencie pracownika, aby uniknąć dodatkowych zapytań przy otwieraniu karty oceny i od razu przekazywać kontekst stanowiska do analizy OSP oraz Asystenta Rozmowy.

---

## 3. Kolekcja `competencies/{competencyId}`
Słownik 14 kryteriów oceny z Załącznika nr 1 do rozporządzenia z 2016 r., zasilany wskaźnikami behawioralnymi z pliku `Model_kompetencji.xlsx`.

```json
{
  "code": "KOMUNIKACJA",
  "name": "Komunikacja",
  "description": "Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie...",
  "mandatoryFor": ["FIRST", "FORM_B", "FORM_C"],
  "indicators": [
    {
      "id": "ind_1",
      "label": "Jasność wypowiedzi pisemnych",
      "behaviors": [
        { "level": 1, "description": "Opis zachowania na poziomie 1 (znacznie poniżej oczekiwań)" },
        { "level": 3, "description": "Opis zachowania na poziomie 3 (poniżej oczekiwań)" },
        { "level": 5, "description": "Opis zachowania na poziomie 5 (na poziomie oczekiwań)" },
        { "level": 7, "description": "Opis zachowania na poziomie 7 (powyżej oczekiwań)" },
        { "level": 9, "description": "Opis zachowania na poziomie 9 (znacznie powyżej oczekiwań)" }
      ]
    }
  ]
}
```

> **Uwaga dla Pierwszej Oceny:** W ścieżce `FIRST` interfejs filtruje zachowania/poziomy do skali 3-stopniowej (`3`, `5`, `7` pkt).

---

## 4. Kolekcja `evaluations/{evaluationId}`
Główna kolekcja procesów oceny. Wspólna kolekcja dla obu ścieżek upraszcza filtrowanie i budowę zbiorczego panelu dla HR/Administratora.

```json
{
  "type": "FIRST_EVALUATION | PERIODIC_EVALUATION",
  "formType": "FIRST | FORM_B | FORM_C",
  "status": "DRAFT | INITIAL_TALK_DONE | IN_PROGRESS | FINAL_TALK_DONE | COMPLETED",

  "employeeId": "employees/{id}",
  "employeeName": "Jan Kowalski",
  "department": "Departament Cyberbezpieczeństwa",
  "supervisorId": "users/{uid}",
  "supervisorName": "Anna Nowak",
  "departmentHeadId": "users/{uid}",

  "deadlines": {
    "initialTalkDue": "Timestamp",
    "initialTalkDate": "Timestamp | null",
    "evaluationDueDate": "Timestamp",
    "periodFrom": "Timestamp | null",
    "periodTo": "Timestamp | null",
    "finalTalkDate": "Timestamp | null",
    "reportDueFrom": "Timestamp | null",
    "reportDueTo": "Timestamp | null"
  },

  "criteriaAssessments": [
    {
      "competencyId": "KOMUNIKACJA",
      "isMandatory": true,
      "selectedBehaviors": [
        { "indicatorId": "ind_1", "selectedLevel": 5 }
      ],
      "suggestedScore": 5,
      "finalScore": 7,
      "overrideReason": "string | null"
    }
  ],

  "firstEvalRequirements": {
    "examPassed": "YES | NO | NOT_APPLICABLE",
    "reportSubmittedOnTime": "YES | NO"
  },

  "summary": {
    "averageScore": 5.8,
    "overallLevel": "na poziomie oczekiwań",
    "finalResult": "POSITIVE | NEGATIVE",
    "justification": "string",
    "developmentPlan": "string"
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
* **Human-in-the-loop:** `suggestedScore` jest wyliczane deterministycznie ze wskaźników `selectedBehaviors`; `finalScore` jest zawsze wybierane/zatwierdzane przez przełożonego.
* **Terminy:** `reportDueFrom` / `reportDueTo` oraz obiekt `firstEvalRequirements` dotyczą wyłącznie `type == "FIRST_EVALUATION"`.
* **Część III (`promotionRequest`):** Dotyczy wyłącznie `type == "PERIODIC_EVALUATION"` dla pracownika ze statusem `URZEDNIK_SC` oraz wynikiem `POSITIVE`. Pola `appointmentYear` (rok mianowania) i `currentRankGrantedAt` (data przyznania posiadanego stopnia) są wymagane przez wzór Części III arkusza.

### 4.1. Kolekcja `evaluation_tracking/{evaluationId}` (widok dla HR)
Zdenormalizowana kopia **wyłącznie** danych potrzebnych w panelu monitoringu HR. Identyfikator dokumentu = `evaluationId`. Firestore Security Rules nie pozwalają ograniczyć odczytu do wybranych pól dokumentu, dlatego `HR_ADMIN` **nie ma** dostępu do `evaluations` (oceny cząstkowe, uzasadnienie, IPRZ), a jedynie do tej kolekcji (minimalizacja danych — RODO).

```json
{
  "evaluationId": "evaluations/{id}",
  "type": "FIRST_EVALUATION | PERIODIC_EVALUATION",
  "formType": "FIRST | FORM_B | FORM_C",
  "status": "DRAFT | INITIAL_TALK_DONE | IN_PROGRESS | FINAL_TALK_DONE | COMPLETED",
  "employeeName": "Jan Kowalski",
  "department": "Departament Cyberbezpieczeństwa",
  "supervisorId": "users/{uid}",
  "supervisorName": "Anna Nowak",
  "deadlines": {
    "initialTalkDue": "Timestamp",
    "evaluationDueDate": "Timestamp",
    "reportDueTo": "Timestamp | null"
  },
  "updatedAt": "Timestamp"
}
```

> **Synchronizacja:** dokument aktualizowany przy każdej zmianie `status` / `deadlines` w `evaluations` — w prototypie w tej samej transakcji/batchu po stronie klienta, docelowo przez Cloud Function (trigger `onDocumentWritten` na `evaluations/{id}`). Wynik oceny (`POSITIVE`/`NEGATIVE`) celowo nie jest kopiowany.

---

## 5. Kolekcja `reminders/{reminderId}`
Kolekcja powiadomień i przypomnień wysyłanych automatycznie lub ręcznie przez panel HR / Administratora.

```json
{
  "evaluationId": "evaluations/{id}",
  "recipientUserId": "users/{uid}",
  "sentByUserId": "users/{uid}",
  "type": "INITIAL_TALK_DUE | REPORT_DUE | EVALUATION_DUE | MANUAL_HR",
  "message": "Przypomnienie: termin oceny okresowej mija za 14 dni.",
  "status": "SENT | READ",
  "createdAt": "Timestamp"
}
```

---

## 6. Kolekcja `ai_sessions/{sessionId}` i podkolekcja `messages/{messageId}`
Przechowywanie kontekstu i historii rozmów z dwoma trybami asystenta AI.

### Dokument główny: `ai_sessions/{sessionId}`
```json
{
  "userId": "users/{uid}",
  "evaluationId": "evaluations/{id} | null",
  "mode": "FORMAL_ASSISTANT | INTERVIEW_ASSISTANT",
  "createdAt": "Timestamp"
}
```

### Podkolekcja: `ai_sessions/{sessionId}/messages/{messageId}`
```json
{
  "role": "user | assistant",
  "content": "string",
  "citations": [
    {
      "sourceTitle": "Rozporządzenie o ocenach okresowych z 2016 r.",
      "section": "§ 11 ust. 1 pkt 4",
      "excerpt": "Ocenę negatywną przyznaje się..."
    }
  ],
  "createdAt": "Timestamp"
}
```

---

## 7. Zalecane indeksy złożone (Composite Indexes)
Aby zapytania w panelu przełożonego i panelu HR działały bez błędów `FAILED_PRECONDITION`, należy utworzyć indeksy:
1. `evaluations`: `supervisorId` (ASC) + `status` (ASC) + `deadlines.evaluationDueDate` (ASC) — *lista ocen przełożonego posortowana po terminie*.
2. `evaluation_tracking`: `department` (ASC) + `status` (ASC) + `deadlines.evaluationDueDate` (ASC) — *filtrowanie w panelu HR po departamencie i statusie*.
3. `reminders`: `recipientUserId` (ASC) + `status` (ASC) + `createdAt` (DESC) — *nieprzeczytane przypomnienia dla zalogowanego przełożonego*.

---

## 8. Założenia bezpieczeństwa (Firestore Security Rules / RBAC)
* **`users`:** Odczyt własnego profilu lub dostęp dla `HR_ADMIN`.
* **`competencies`:** Tylko do odczytu (`read: true`) dla każdego zalogowanego użytkownika; zapis wyłącznie dla `HR_ADMIN`.
* **`employees`:** Odczyt i edycja dla przypisanego `supervisorId`, `departmentHeadId` oraz `HR_ADMIN`.
* **`evaluations`:**
  * `SUPERVISOR`: pełny odczyt i zapis tylko dokumentów, gdzie `resource.data.supervisorId == request.auth.uid`.
  * `DEPARTMENT_HEAD`: odczyt i zatwierdzanie dokumentów, gdzie `resource.data.departmentHeadId == request.auth.uid` (Pierwsza ocena).
  * `HR_ADMIN`: **brak dostępu** — statusy i terminy odczytuje z `evaluation_tracking`.
* **`evaluation_tracking`:** Odczyt dla `HR_ADMIN` oraz dla przełożonego, gdzie `resource.data.supervisorId == request.auth.uid`; zapis wyłącznie przez przełożonego właściwej oceny (prototyp) lub Cloud Function (produkcja).
* **`reminders`:** Tworzenie przez `HR_ADMIN` (lub Cloud Function); odczyt i zmiana `status` na `READ` przez adresata (`resource.data.recipientUserId == request.auth.uid`).
* **`ai_sessions`:** Odczyt i zapis wyłącznie dla właściciela sesji (`resource.data.userId == request.auth.uid`).