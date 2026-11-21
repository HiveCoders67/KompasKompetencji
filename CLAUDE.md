# Kompas Kompetencji — instrukcje dla Claude

Prototyp aplikacji webowej (HackNation 2026, Ministerstwo Cyfryzacji) wspierającej przełożonych w służbie cywilnej w pierwszej ocenie i ocenie okresowej pracowników. Backend: Firebase (Auth, Cloud Firestore, Cloud Functions na planie Blaze, Hosting).

## Źródła prawdy — czytaj przed każdą zmianą

Wszystkie zmiany opieraj na dokumentach w `docs/`. Przed implementacją funkcji przeczytaj właściwy plik:

| Plik | Kiedy czytać |
| --- | --- |
| `docs/01_context_and_requirements.md` | Zakres, role, ścieżki użytkownika, wymagania MUST-HAVE, kryteria jury, stack |
| `docs/02_domain_logic_and_rules.md` | Reguły prawne, model kompetencji, wzór sugestii, wynik oceny, terminy, statusy — **każda logika oceny** |
| `docs/03_ai_assistants_and_rag_spec.md` | Asystent Formalny (RAG), Asystent Rozmowy, analiza OSP, model LLM |
| `docs/04_test_data_osp_and_forms.md` | Dane demo (3 OSP), parser OSP, układ arkuszy do eksportu PDF |
| `docs/firebase/firestore_structure.md` | Kolekcje, schematy, indeksy, reguły bezpieczeństwa |
| `docs/STYLE_GUIDE.md` | Cały wygląd UI: kolory, typografia, komponenty, motion |

Materiały źródłowe (akty prawne, poradniki KPRM, wzory arkuszy, model kompetencji) leżą w `knowledge/sources/` — przy wątpliwości prawnej sprawdzaj tekst źródła, nie streszczenie w `docs/`.

Jeśli dokumenty są ze sobą sprzeczne — zgłoś to, nie wybieraj po cichu.

## Struktura repozytorium

```
apps/web/            frontend (React + Vite + TypeScript, Tailwind v4, Radix UI)
functions/           Cloud Functions (LLM, RAG, completeEvaluation, sync evaluation_tracking)
packages/domain/     czysty TypeScript: wynik oceny, sugestia, terminy, typy schematu, competencies.json — testy Vitest
knowledge/sources/   źródła RAG (legal/, guides/, forms/, model/) + skrypt budujący indeks
demo-data/osp/       3 pliki OSP (scenariusze demo, test wgrywania)
docs/                specyfikacja; docs/assets/ — grafiki
```

## Konwencje

- **Ścieżka A** = Pierwsza ocena (`FIRST_EVALUATION`, arkusz `FIRST`, skala 3/5/7).
- **Ścieżka B** = Ocena okresowa (`PERIODIC_EVALUATION`, arkusz `FORM_B` lub `FORM_C`, skala 1/3/5/7/9).
- **Język:** teksty UI, dokumentacja domenowa i materiały dla jury po polsku; identyfikatory, pola Firestore, komentarze w kodzie i commity po angielsku.
- **Enumy:** wartości w danych to angielskie kody (np. `MEETS_EXPECTATIONS`, `CIVIL_SERVANT`). Polskie etykiety wyłącznie w jednym słowniku UI/PDF (`labels.pl`) — nigdy polski tekst jako wartość pola.
- **Referencje:** pola `*Id` wskazujące dokumenty to `DocumentReference` (reguły porównują je ze ścieżką, np. `/databases/$(database)/documents/users/$(request.auth.uid)`).
- **Daty:** w Firestore jako `Timestamp`. Data kalendarzowa (termin, data rozmowy, nieobecność) = `Timestamp` o 00:00 strefy `Europe/Warsaw`, tworzony i odczytywany **wyłącznie** przez helpery `toDateOnly` / `fromDateOnly` (`date-fns-tz`). Zakaz bezpośredniego `new Date()` w logice terminów. Dodawanie miesięcy wg `date-fns` (31.01 + 1 mies. = ostatni dzień lutego).
- **Role:** `roles: string[]` w custom claims Firebase Auth (`request.auth.token.roles`); pole w `users` jest tylko kopią do wyświetlania.
- **Wielourzędowość:** każdy dokument domenowy ma `officeId`; reguły sprawdzają zgodność z `request.auth.token.officeId`.

## Zasady nienegocjowalne

- **Tylko desktop** — bez widoków mobilnych / responsywności pod smartfony.
- **Human-in-the-loop** — system wylicza `suggestedScore` ze wskaźników, ale ocenę cząstkową (`finalScore`) zawsze wybiera przełożony, bez obowiązku uzasadniania odstępstwa. AI nigdy nie wystawia oceny; szkice tekstów AI trafiają do formularza tylko po kliknięciu „Wstaw do formularza”.
- **Logika wyniku deterministyczna w kodzie** (`packages/domain`, nie w LLM), pokryta testami jednostkowymi — w tym przypadki brzegowe z `03_...` (np. średnia 5,8 + jedna „1” → NEGATYWNA; pierwsza ocena 3,5,5,5,7 → POZYTYWNA). Porównania progów na liczbach całkowitych (`suma > 4·n`), bez zaokrąglania przed klasyfikacją.
- **Wynik zatwierdza serwer** — przejście do `COMPLETED` tylko przez Cloud Function `completeEvaluation`; klient nie może zapisać `summary`, a po `COMPLETED` edycja jest zablokowana.
- **Jeden model AI: Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`, płatny tier Gemini API, `thinkingLevel: minimal`) — świadome odstępstwo od wymogu „wyłącznie darmowe narzędzia AI” (`docs/01` § 5 pkt 2). Klucz tylko w Cloud Functions. Brak przełączania na inne modele; po wyczerpaniu limitu lub środków komunikat dla użytkownika. W prototypie dane są fikcyjne i nie stosujemy pseudonimizacji (wymóg produkcyjny opisany w dokumentacji dla jury).
- **RAG ze ścisłym ugruntowaniem** — zawsze cytuj źródło; cytaty walidowane w kodzie względem pobranych fragmentów; brak informacji w bazie wiedzy → odmowa zamiast zgadywania.
- **RODO** — `HR_ADMIN` widzi tylko `evaluation_tracking`, nigdy treści ocen.
- **WCAG 2.1 AA** w obu motywach (jasny i ciemny).

## Odstępstwa od STYLE_GUIDE.md (specyficzne dla projektu)

- **App shell:** zamiast dolnego paska nawigacji używamy **lewego sidebara** (nawigacja główna, przełącznik motywu, licznik przypomnień) oraz **steppera** w procesie oceny — aplikacja jest desktopowym narzędziem krokowym, na co guide wprost pozwala („unless the project clearly needs a different one”).
- Widoki procesu oceny i panel HR traktujemy jako „dense tools”: tytuł strony `h2`, wyższa gęstość informacji niż domyślna.
- **PDF** nie korzysta ze STYLE_GUIDE — odwzorowuje urzędowe wzory arkuszy (`knowledge/sources/forms/`).
- Poza powyższym obowiązują tokeny i reguły z `STYLE_GUIDE.md` bez wyjątków.
