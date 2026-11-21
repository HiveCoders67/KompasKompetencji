# Kompas Kompetencji — Kontekst Zadania i Wymagania (HackNation 2026)

## 1. Informacje ogólne
* **Nazwa projektu:** Kompas kompetencji
* **Organizator wyzwania:** Ministerstwo Cyfryzacji (Biuro Dyrektora Generalnego / Departament GovTech)
* **Wydarzenie:** HackNation 2026
* **Cel nadrzędny:** Stworzenie funkcjonalnego prototypu aplikacji webowej wspierającej przełożonych w administracji rządowej (służbie cywilnej) w przygotowaniu i przeprowadzeniu procesu oceny pracowników (pierwszej oceny oraz oceny okresowej) w oparciu o model kompetencyjny, konkretne obserwowalne zachowania oraz wsparcie asystenta AI.
* **Kontekst wdrożeniowy:** Zwycięski zespół ma szansę na podpisanie umowy na rozwinięcie prototypu do aplikacji produkcyjnej w Ministerstwie Cyfryzacji, z perspektywą udostępnienia narzędzia innym urzędom administracji publicznej.

---

## 2. Problem biznesowy (Stan aktualny)
Przełożony w służbie cywilnej musi obecnie łączyć rozproszoną wiedzę z ustaw, rozporządzeń, formularzy i poradników KPRM:
1. Znać zasady formalne i pilnować terminów ustawowych.
2. Prawidłowo dobierać kryteria oceny na podstawie Opisu Stanowiska Pracy (OSP).
3. Oceniać szerokie kompetencje (np. komunikacja, współpraca, zarządzanie ludźmi) na podstawie **konkretnych, obserwowalnych zachowań**, a nie ogólnego wrażenia (co dziś powoduje niespójność między różnymi przełożonymi).
4. Przygotować się do wartościowej rozmowy oceniającej i poprawnie udokumentować cały proces.

---

## 3. Użytkownicy systemu (Role)
1. **Przełożony (Główny użytkownik):** Przechodzi krok po kroku przez proces pierwszej oceny lub oceny okresowej, analizuje OSP, dobiera kryteria, ocenia wskaźniki behawioralne, podejmuje ostateczną decyzję o ocenie, korzysta z asystentów AI oraz generuje dokumentację PDF.
2. **Pracownik HR / Administrator (Dodatkowy użytkownik):** Monitoruje statusy trwających procesów ocen, śledzi terminy ustawowe oraz wysyła przypomnienia o konieczności wykonania określonych czynności.

---

## 4. Architektura ścieżek użytkownika (wg grafiki koncepcyjnej MC)
Aplikacja musi obejmować **dwie odrębne ścieżki oceny**:

### Ścieżka A: Pierwsza ocena w służbie cywilnej
* **Rozpocznij ocenę** (rozmowa wstępna, wyznaczenie terminu sprawozdania i okna oceny).
* **Zakończ ocenę** — *z zastosowaniem modelu kompetencji* (ocena wskaźników behawioralnych, ocena 5 stałych elementów, wynik egzaminu ze służby przygotowawczej, terminowość sprawozdania, wyliczenie wyniku, uzasadnienie, wnioski rozwojowe).
* **Asystent formalny oceny** (wsparcie w przepisach i procedurze pierwszej oceny).
* **Asystent rozmowy** (rozmowa oceniająca i plan rozwoju).

### Ścieżka B: Ocena okresowa w służbie cywilnej
* **Krok 1: Analiza opisu stanowiska pracy (OSP)** — pomaga zweryfikować obowiązki, podległość i dobrać właściwy arkusz oraz kryteria dodatkowe.
* **Krok 2: Ocena okresowa — Wybierz właściwy formularz:**
  * **Formularz B** (stanowiska z bezpośrednim kierowaniem pracownikami): *Rozpocznij ocenę* $\rightarrow$ *Zakończ ocenę (z zastosowaniem modelu kompetencji)*.
  * **Formularz C** (pozostałe stanowiska niebędące kierownikiem urzędu): *Rozpocznij ocenę* $\rightarrow$ *Zakończ ocenę (z zastosowaniem modelu kompetencji)*.
* **Asystent formalny oceny** (wsparcie w zakresie procedury, formularzy i poprawności formalnej).
* **Asystent rozmowy** (rozmowa oceniająca, feedback i plan rozwoju zawodowego — mentoring / coaching).

---

## 5. Twarde ograniczenia i wymagania krytyczne (MUST-HAVE)
1. **BRAK WERSJI NA SMARTFONY:** W treści zadania wprost zaznaczono: *"System nie ma być dostępny na smartfonach."* Interfejs projektujemy wyłącznie pod przeglądarkę internetową (desktop / laptop).
2. **WYŁĄCZNIE DARMOWE NARZĘDZIA AI:** Zespoły na etapie hackathonu mogą korzystać wyłącznie z darmowych narzędzi i modeli AI (np. darmowe tiery API, modele open-source).
   * **Świadome odstępstwo zespołu (21.11.2026):** asystenci AI korzystają z **płatnego tieru Gemini API (Gemini 3.5 Flash-Lite)**. Powód: darmowa Gemma 4 odpowiadała 30–80 s i była często przeciążona (HTTP 503), a darmowy limit (16 tys. tokenów wejściowych na minutę) mieścił ok. 3 pytania na minutę. Flash-Lite odpowiada w ok. 1 s i przechodzi zestaw testów asystenta 30/30; koszt to poniżej 1 grosza za pytanie. Ten sam model działa też na darmowym tierze (z limitem zapytań na minutę), więc w razie potrzeby wystarczy podmienić klucz — bez zmian w kodzie.
3. **HUMAN-IN-THE-LOOP (AI nie ocenia samodzielnie):** System oblicza i prezentuje *sugerowany* poziom spełniania kompetencji na podstawie wybranych przez przełożonego zachowań, ale **ostateczną decyzję o poziomie oceny zawsze wybiera i zatwierdza przełożony**.
4. **ASYSTENT AI OPARTY O BAZĘ WIEDZY (RAG):** Odpowiedzi muszą opierać się na dostarczonych źródłach, wskazywać dokładne źródło (akt prawny, paragraf, poradnik), a w przypadku braku informacji w bazie wiedzy — jasno komunikować brak danych zamiast halucynować.
5. **DZIAŁAJĄCY PROTOTYP:** Same makiety lub prezentacja koncepcji nie wystarczą. Prototyp musi umożliwiać przejście co najmniej jednej kompletnej ścieżki (od rozpoczęcia, przez kryteria i wskaźniki behawioralne, po sugestię poziomu, decyzję przełożonego i generowanie PDF) oraz interaktywne przetestowanie asystenta AI przez jurorów.

---

## 6. Wymagania techniczne i architektoniczne
* Dowolny stack technologiczny (języki, frameworki), ale zaprojektowany z myślą o skalowaniu i dalszym rozwoju.
* **Gotowość pod przyszłe integracje** (nie wymagane w prototypie, ale uwzględnione w architekturze): systemy klasy **EZD** oraz systemy kadrowe (np. **QNT**).
* Bezpieczna wymiana danych przez udokumentowane interfejsy (**API**).
* Mechanizmy **uwierzytelniania, autoryzacji oraz zarządzania rolami i uprawnieniami (RBAC)**.
* **Ochrona danych osobowych (RODO):** poufność danych pracowników, zasada minimalizacji przetwarzanych danych (wskazanie w dokumentacji elementów wymagających dodatkowego zabezpieczenia przed wdrożeniem produkcyjnym).
* **Eksport dokumentacji do PDF** w układzie zgodnym z urzędowymi wzorami arkuszy.
* Wszystkie linki do prototypu i materiałów muszą być publicznie aktywne dla jury bez proszenia o dodatkowe uprawnienia.

---

## 7. Wymagane materiały do oddania (Deliverables)
1. **Działający prototyp rozwiązania** (min. 1 kompletna ścieżka + model kompetencyjny + działający asystent AI + panel HR/admin + eksport PDF).
2. **Krótki opis projektu** (przyjęta koncepcja i najważniejsze funkcjonalności).
3. **Prezentacja projektu** — maksymalnie **10 slajdów** (logika działania, kluczowe funkcjonalności, kierunek dalszego rozwoju).
4. **Opis wykorzystania AI** (wskazanie, w których elementach i jak użyto AI + zabezpieczenia).
5. **Krótka informacja o technologiach i architekturze** (ocena potencjału wdrożeniowego i elementów do zabezpieczenia na produkcji).
6. *(Opcjonalnie, ale zalecane)* Repozytorium kodu źródłowego, schemat architektury, dokumentacja techniczna.

---

## 8. Kryteria oceny Jury (Wagi)
| Kryterium | Waga | Na co zwracać uwagę przy projektowaniu |
| :--- | :---: | :--- |
| **Zgodność merytoryczna i realizacja założeń wyzwania** | **25%** | 100% zgodności z ustawą o służbie cywilnej, rozporządzeniami z 2015 i 2016 r., poprawny wzór wyliczeń i reguł oceny negatywnej, poprawny model kompetencyjny. |
| **Użyteczność i doświadczenie użytkownika (UX)** | **25%** | Intuicyjny, krokowy proces dla przełożonego (desktop-first), brak przytłoczenia biurokracją, czytelna prezentacja zachowań i sugestii poziomu. |
| **Jakość i użyteczność zastosowania AI** | **20%** | Jurorzy będą zadawać podchwytliwe pytania prawne asystentowi AI! Liczy się poprawność, cytowanie źródeł, odmowa halucynacji oraz praktyczna pomoc w rozmowie. |
| **Innowacyjność i jakość rozwiązania** | **20%** | Czysty kod, stabilny prototyp, mądre połączenie analizy OSP z doborem kryteriów, generowanie jakościowego PDF, przemyślany panel HR. |
| **Potencjał wdrożeniowy** | **10%** | Architektura gotowa pod EZD/QNT, RBAC, RODO, minimalizacja danych, możliwość użycia w MC i innych urzędach. |
---

## 9. Przyjęte decyzje projektowe (prototyp)
| Obszar | Decyzja |
| :--- | :--- |
| **Frontend** | React + Vite + TypeScript (SPA), Tailwind v4 na zmiennych `--sf-*`, Radix UI (dostępne prymitywy bez stylów), Firebase Hosting. |
| **Backend** | Firebase: Auth (custom claims z rolami), Cloud Firestore, Cloud Functions (plan Blaze z alertem budżetowym). |
| **Logika domenowa** | Pakiet `packages/domain` (czysty TS) współdzielony przez UI i Cloud Functions — gwarantuje identyczne wyliczenia po obu stronach. |
| **AI** | Gemini 3.5 Flash-Lite przez Gemini API (płatny tier, `thinkingLevel: minimal`; świadome odstępstwo — patrz § 5 pkt 2). Wywołania wyłącznie z Cloud Functions. Interfejs `LlmProvider` pozwala w produkcji podpiąć model on-premise (Bielik / PLLuM). |
| **RAG** | BM25 (`minisearch`) po statycznym indeksie JSON budowanym z `knowledge/sources/`; walidacja cytatów w kodzie. |
| **PDF** | `@react-pdf/renderer` w przeglądarce, układ wzorowany na urzędowych arkuszach, osadzony font z polskimi znakami. |
| **Testy** | Vitest (logika domenowa) + `@firebase/rules-unit-testing` na emulatorze (reguły Firestore). Bez E2E w prototypie. |
| **Motywy** | Jasny i ciemny (domyślnie wg `prefers-color-scheme`, ręczny przełącznik w sidebarze), oba zgodne z WCAG 2.1 AA. |
| **Dostęp jury** | Ekran logowania z przyciskami „Wejdź jako przełożony / kierujący komórką / HR” (konta demo z prawdziwymi rolami) oraz „Przywróć dane demo”. |
| **Przypomnienia** | Tylko w aplikacji (kolekcja `reminders`, licznik w sidebarze); e-mail / EZD jako przyszła integracja. |
| **Wielourzędowość** | Pole `officeId` we wszystkich dokumentach domenowych i w regułach — gotowość na udostępnienie innym urzędom. |

### 9.1. Kolejność realizacji
1. **MVP:** Ścieżka B / **Arkusz C** (analiza OSP → Rozpocznij ocenę → Zakończ ocenę z modelem kompetencji → wynik → PDF) + Asystent Formalny + panel HR.
2. Ścieżka B / Arkusz B (różni się listą kryteriów obowiązkowych).
3. Ścieżka A (pierwsza ocena) + Asystent Rozmowy w pełnym zakresie.

### 9.2. RODO — elementy do zabezpieczenia przed wdrożeniem produkcyjnym
* Prototyp działa na danych fikcyjnych i **nie pseudonimizuje** promptów. Przed produkcją: pseudonimizacja treści wysyłanych do LLM lub model on-premise (Bielik / PLLuM) oraz umowa powierzenia przetwarzania.
* Nieobecności przechowujemy wyłącznie jako okresy (bez przyczyny) — przyczyna mogłaby stanowić dane o zdrowiu (art. 9 RODO).
* Treści sprawozdania z pierwszej oceny nie przechowujemy — tylko daty.
