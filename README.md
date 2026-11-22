# Kompas Kompetencji

Aplikacja webowa, która prowadzi przełożonego w służbie cywilnej krok po kroku przez **pierwszą ocenę** i **ocenę okresową** pracownika: od doboru kryteriów, przez ocenę konkretnych zachowań i sugestię poziomu, po rozmowę, zatwierdzenie i arkusz PDF. Asystent AI wyjaśnia przepisy (zawsze z cytatem źródła) i pomaga przygotować rozmowę — ale **ocenę zawsze wystawia przełożony**.

Projekt na HackNation 2026 — wyzwanie Ministerstwa Cyfryzacji. Wszystkie dane są fikcyjne.

## 🌐 Wersja online

**https://kompaskompetencji.web.app**

Bez instalacji i bez zakładania konta — działa w przeglądarce na komputerze (aplikacja nie jest przeznaczona na smartfony).

## Jak przetestować

1. Otwórz aplikację i kliknij **„Wejście dla jury”**.
2. Wybierz rolę:

| Rola | Osoba | Co warto sprawdzić |
| --- | --- | --- |
| **Przełożony** | Marta Zielińska | pełna ścieżka oceny: ocena okresowa (arkusz C), pierwsza ocena w toku, nowy pracownik do rozpoczęcia oceny; asystent AI (przycisk w prawym dolnym rogu oceny i „Asystent formalny” w menu); eksport PDF |
| **Kierujący komórką** | Paweł Kamiński | zatwierdzanie pierwszej oceny |
| **HR** | Joanna Dąbrowska | statusy i terminy ustawowe, wysyłanie przypomnień — bez dostępu do treści ocen (RODO) |

3. Przy pierwszym wejściu na każde konto krótki **samouczek** pokazuje najważniejsze miejsca (można go pominąć i uruchomić ponownie przyciskiem „Samouczek” w menu).
4. **„Przywróć dane demo”** na ekranie logowania przywraca scenariusz do stanu początkowego.

**Przykładowe pytania do asystenta formalnego:** „Pracownik ma średnią 5,8 z oceny okresowej, ale dostał 1 punkt za komunikację. Czy ocena jest pozytywna?” · „Ile dni ma pracownik na złożenie sprzeciwu od oceny okresowej i do kogo?” · „W jakim terminie przełożony przeprowadza rozmowę wstępną z nowym pracownikiem?”

## Uruchomienie lokalne (opcjonalnie)

Wymagania: **Node.js 22** i **Java 21+** (do emulatorów Firebase).

```bash
npm install
npm run emulators     # terminal 1: lokalne Auth, Firestore i Cloud Functions
npm run dev           # terminal 2: aplikacja → http://localhost:5173
```

Następnie: **„Wejście dla jury”** → **„Przywróć dane demo”** → wybór roli. Podgląd danych w emulatorach: http://127.0.0.1:4000.

Asystenci AI lokalnie wymagają własnego klucza Gemini API w pliku `functions/.secret.local` (`GEMINI_API_KEY=…`); bez klucza działa wszystko poza asystentami — dlatego do testów AI polecamy wersję online.

## Opis techniczny

- **Frontend:** React + TypeScript (Vite), Tailwind, Radix UI; dostępność WCAG 2.1 AA, jasny i ciemny motyw; arkusze PDF generowane w przeglądarce w układzie urzędowych wzorów.
- **Backend:** Firebase — logowanie i role (Auth), baza danych (Firestore z regułami dostępu per rola i urząd), logika serwerowa (Cloud Functions), hosting.
- **Logika oceny:** wynik (pozytywna / negatywna), sugestia poziomu i terminy ustawowe liczone deterministycznie w kodzie (`packages/domain`), pokryte testami — nie przez AI. Wynik zatwierdza wyłącznie serwer.
- **AI:** model Gemini 3.5 Flash-Lite wywoływany tylko z serwera. Asystent formalny działa w trybie RAG: wyszukuje fragmenty ustawy, rozporządzeń, poradników KPRM i modelu kompetencji, a kod sprawdza, czy każdy cytat rzeczywiście w nich występuje; brak podstawy w źródłach → odmowa zamiast zgadywania.
- **Prywatność:** HR widzi wyłącznie statusy i terminy, nigdy treści ocen (osobna kolekcja danych).

```
Przeglądarka (React) ──► Firebase Auth (role)
        │              ──► Firestore (oceny, terminy, przypomnienia)
        └──► Cloud Functions ──► zatwierdzenie wyniku · asystenci AI ──► Gemini API
                                                        └─► indeks źródeł prawnych (RAG)
```

Architektura jest przygotowana pod przyszłe integracje z systemami klasy EZD i kadrowymi (np. QNT) — szczegóły w dokumentacji.

## Dokumentacja

| Dokument | Zawartość |
| --- | --- |
| [Kontekst i wymagania](docs/01_context_and_requirements.md) | zakres, role, ścieżki, decyzje projektowe, wymogi przed wdrożeniem produkcyjnym |
| [Logika domenowa i przepisy](docs/02_domain_logic_and_rules.md) | reguły prawne, model kompetencji, wzór sugestii, terminy |
| [Asystenci AI i RAG](docs/03_ai_assistants_and_rag_spec.md) | jak działa AI i jakie ma zabezpieczenia |
| [Dane demo i formularze](docs/04_test_data_osp_and_forms.md) | scenariusze testowe, opisy stanowisk, arkusze |
| [Struktura bazy danych](docs/firebase/firestore_structure.md) | kolekcje, uprawnienia, reguły bezpieczeństwa |
| [Film prezentujący projekt](docs/05_film_prezentacja.md) | scenariusz, lektor (ElevenLabs), automatyczny montaż |

<details>
<summary>Dla zespołu: testy i wdrożenie</summary>

| Polecenie | Co robi |
| --- | --- |
| `npm test` | testy domeny, funkcji (RAG, walidacja cytatów) i UI |
| `npm run typecheck` | TypeScript we wszystkich pakietach |
| `npm run test:rules` | testy reguł Firestore na emulatorze |
| `npx tsx functions/scripts/smoke-emulator.ts` | test end-to-end na emulatorach |
| `GEMINI_API_KEY=… npm run eval:assistant -w functions` | zestaw testów asystenta na żywym modelu |
| `npm run kb:build` | przebudowa modelu kompetencji i indeksu RAG z `knowledge/sources/` (Python 3 + `pypdf`) |

Wdrożenie: push do `main` uruchamia GitHub Actions (`npm run deploy`). Ręcznie: `npx firebase functions:secrets:set GEMINI_API_KEY`, potem `npm run deploy`.

</details>

## Bezpieczeństwo i RODO

Prototyp działa na danych fikcyjnych. Przed wdrożeniem produkcyjnym wymagane są m.in.: pseudonimizacja treści wysyłanych do modelu językowego lub model uruchamiany w infrastrukturze urzędu (np. Bielik / PLLuM), umowa powierzenia przetwarzania oraz integracja logowania z systemami urzędu. Szczegóły: [01 § 9.2](docs/01_context_and_requirements.md).
