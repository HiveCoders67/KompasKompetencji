# Kompas Kompetencji — instrukcje dla Claude

Prototyp aplikacji webowej (HackNation 2026, Ministerstwo Cyfryzacji) wspierającej przełożonych w służbie cywilnej w pierwszej ocenie i ocenie okresowej pracowników. Backend: Firebase / Cloud Firestore.

## Źródła prawdy — czytaj przed każdą zmianą

Wszystkie zmiany opieraj na dokumentach w `.claude/`. Przed implementacją funkcji przeczytaj właściwy plik:

| Plik | Kiedy czytać |
| --- | --- |
| `.claude/01_context_and_requirements.md` | Zakres, role, ścieżki użytkownika, wymagania MUST-HAVE, kryteria jury |
| `.claude/02_domain_logic_and_rules.md` | Reguły prawne, wzory punktacji, walidacje wyniku, terminy — **każda logika oceny** |
| `.claude/03_ai_assistants_and_rag_spec.md` | Asystent Formalny (RAG), Asystent Rozmowy, analiza OSP |
| `.claude/04_test_data_osp_and_forms.md` | Dane demo (3 OSP), układ arkuszy do eksportu PDF |
| `.claude/firebase/firestore_structure.md` | Kolekcje, schematy, indeksy, reguły bezpieczeństwa |
| `.claude/STYLE_GUIDE.md` | Cały wygląd UI: kolory, typografia, komponenty, motion |

Jeśli dokumenty są ze sobą sprzeczne — zgłoś to, nie wybieraj po cichu.

## Konwencje nazewnicze

- **Ścieżka A** = Pierwsza ocena (`FIRST_EVALUATION`, arkusz `FIRST`, skala 3/5/7).
- **Ścieżka B** = Ocena okresowa (`PERIODIC_EVALUATION`, arkusz `FORM_B` lub `FORM_C`, skala 1/3/5/7/9).
- Teksty UI po polsku; identyfikatory w kodzie i pola Firestore po angielsku (zgodnie ze schematem).

## Zasady nienegocjowalne

- **Tylko desktop** — bez widoków mobilnych / responsywności pod smartfony.
- **Human-in-the-loop** — system wylicza `suggestedScore`, ale `finalScore` zawsze zatwierdza przełożony. AI nigdy nie wystawia oceny.
- **Logika wyniku deterministyczna w kodzie** (nie w LLM), pokryta testami jednostkowymi — w tym przypadki brzegowe z `03_...` (np. średnia 5,8 + jedna „1” → NEGATYWNA; pierwsza ocena 3,5,5,5,7 → POZYTYWNA).
- **Wyłącznie darmowe modele/API AI.** Do LLM nie wysyłamy danych osobowych pracowników (pseudonimizacja).
- **RAG ze ścisłym ugruntowaniem** — zawsze cytuj źródło; brak informacji w bazie wiedzy → odmowa zamiast zgadywania.
- **RODO** — `HR_ADMIN` widzi tylko `evaluation_tracking`, nigdy treści ocen.

## Odstępstwa od STYLE_GUIDE.md (specyficzne dla projektu)

- **App shell:** zamiast dolnego paska nawigacji używamy **lewego sidebara** (nawigacja główna) oraz **steppera** w procesie oceny — aplikacja jest desktopowym narzędziem krokowym, na co guide wprost pozwala („unless the project clearly needs a different one”).
- Widoki procesu oceny i panel HR traktujemy jako „dense tools”: tytuł strony `h2`, wyższa gęstość informacji niż domyślna.
- Poza powyższym obowiązują tokeny i reguły z `STYLE_GUIDE.md` bez wyjątków.

## Znane braki

- Brak pliku `Model_kompetencji.xlsx` (wskaźniki behawioralne). Do czasu dostarczenia: schemat `competencies` oparty na 14 kryteriach z `02_...`, z możliwością wgrania docelowego JSON-a ze wskaźnikami.
