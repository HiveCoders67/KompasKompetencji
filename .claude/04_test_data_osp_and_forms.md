# Dane Testowe (OSP), Struktury Formularzy PDF i Brakujące Zasoby

## 1. Dostarczone Opisy Stanowisk Pracy (OSP) — Gotowe Scenariusze Demo
W materiałach konkursowych Ministerstwo Cyfryzacji przekazało 3 realne szablony OSP. Warto zaszyć je w prototypie jako gotowe profile pracowników testowych (z fikcyjnymi imionami i nazwiskami), aby móc płynnie zademonstrować analizę OSP oraz obie ścieżki (Arkusz B i Arkusz C).

### Scenariusz 1: Starszy specjalista (Arkusz C)
* **Symbol:** `DC WZKSOiC 6`
* **Komórka:** Departament Cyberbezpieczeństwa, Wydział Zarządzania Kryzysowego, Spraw Obronnych i Cyberbezpieczeństwa
* **Bezpośredni przełożony:** Naczelnik wydziału (pośrednio: Dyrektor)
* **Podlegli pracownicy:** Brak $\rightarrow$ **Właściwy formularz: Arkusz C**
* **Cel stanowiska:** Zarządzanie kryzysowe w cyberprzestrzeni (zadania Ministra, współpraca NATO/UE/ONZ, CSIRT, Infrastruktura Krytyczna, kontrole podmiotów krytycznych).
* **Kompetencje miękkie wpisane w OSP:** Organizacja pracy i orientacja na osiąganie celów, Współpraca, Myślenie analityczne, Wykorzystywanie wiedzy i doskonalenie zawodowe.
* **Sugerowane kryteria dodatkowe (max 3, poza obowiązkowymi z Arkusza C):**
  1. *Radzenie sobie w sytuacjach kryzysowych* (dyżury, zarządzanie kryzysowe, reagowanie na incydenty),
  2. *Myślenie analityczne* (wprost w OSP + ocena obiektów IK i formułowanie opinii),
  3. *Podejmowanie decyzji i odpowiedzialność* (samodzielne decyzje na forum międzynarodowym i w sytuacjach kryzysowych).

### Scenariusz 2: Radca (Arkusz C)
* **Symbol:** `DSI WWI 5`
* **Komórka:** Departament Rozwoju i Bezpieczeństwa Sztucznej Inteligencji, Wydział Wspierania Innowacyjności
* **Bezpośredni przełożony:** Naczelnik wydziału (pośrednio: Zastępca dyrektora)
* **Podlegli pracownicy:** Brak $\rightarrow$ **Właściwy formularz: Arkusz C**
* **Cel stanowiska:** Wsparcie merytoryczne dla innowacji AI, analiza prawa krajowego i UE (AI Act, RODO), opinie indywidualne, identyfikacja barier prawnych.
* **Kompetencje miękkie wpisane w OSP:** Organizacja pracy i orientacja na osiąganie celów, Wykorzystywanie wiedzy i doskonalenie zawodowe, Współpraca.
* **Sugerowane kryteria dodatkowe (max 3, poza obowiązkowymi z Arkusza C):**
  1. *Myślenie analityczne* (wysoka złożoność, analiza prawa UE i orzecznictwa, decyzje uznaniowe),
  2. *Kreatywność* (opracowywanie nowych zasad działania, propozycje zmian systemowych i usprawniających),
  3. *Podejmowanie decyzji i odpowiedzialność* (pełna odpowiedzialność za rezultaty i decyzje bez konsultacji w ramach kompetencji).

### Scenariusz 3: Naczelnik wydziału (Arkusz B)
* **Symbol:** `DWM WKAM 1`
* **Komórka:** Departament Współpracy Międzynarodowej, Wydział Koordynacji Aktywności Międzynarodowych
* **Bezpośredni przełożony:** Zastępca dyrektora (pośrednio: Dyrektor)
* **Podlegli pracownicy:** Bezpośrednio kieruje pracą od 5 do 9 pracowników $\rightarrow$ **Właściwy formularz: Arkusz B**
* **Cel stanowiska:** Organizacja aktywności międzynarodowej kierownictwa MC, koordynacja budżetu/dotacji DWM, zarządzanie delegacjami zagranicznymi i zamówieniami publicznymi (wysokie ryzyko korupcyjne, częste kontakty z ambasadami i organizacjami międzynarodowymi).
* **Kompetencje miękkie wpisane w OSP:** Zarządzanie ludźmi, Podejmowanie decyzji i odpowiedzialność, Wykorzystywanie wiedzy i doskonalenie zawodowe, Organizacja pracy i orientacja na osiąganie celów, Współpraca.
* **Sugerowane kryteria dodatkowe (max 3, poza obowiązkowymi z Arkusza B):**
  1. *Wykorzystywanie wiedzy i doskonalenie zawodowe* (wprost w OSP + pełna ekspercka wiedza z protokołu dyplomatycznego i współpracy międzynarodowej),
  2. *Negocjowanie* (godzenie interesów biznesu, administracji, NGO; przekonywanie do zmiany stanowiska),
  3. *Rzetelność* (sprawy budżetowo-finansowe, dotacje, zamówienia publiczne, zagrożenie korupcją).

---

## 2. Struktura Formularzy Urzędowych (do eksportu PDF)

### A. Arkusz Oceny Okresowej (B oraz C)
* **Część I (Rozpoczęcie oceny):**
  * Nazwa urzędu (`Ministerstwo Cyfryzacji`),
  * Dane ocenianego (imię, nazwisko, komórka organizacyjna, stanowisko pracy),
  * Dane oceniającego (imię, nazwisko, komórka organizacyjna, stanowisko pracy),
  * Tabela kryteriów: 5 obowiązkowych (zależnie od B/C) + do 3 dodatkowych,
  * Termin sporządzenia oceny (`dd.mm.rrrr`),
  * Potwierdzenie przeprowadzenia rozmowy z § 5 ust. 1 i zapoznania z kryteriami (miejscowość, data, podpisy oceniającego i ocenianego).
* **Część II (Zakończenie oceny):**
  * Data przeprowadzenia rozmowy oceniającej,
  * Okres podlegania ocenie (`OD` — data zapoznania z kryteriami, `DO` — data sporządzenia oceny),
  * Tabela ocen cząstkowych (skala: 1, 3, 5, 7, 9 pkt) dla kryteriów obowiązkowych i dodatkowych,
  * Średnia arytmetyczna,
  * Tabela przyznania ogólnego poziomu spełnienia kryteriów (znak „X”),
  * Wynik: `POZYTYWNA` / `NEGATYWNA`,
  * Uzasadnienie przyznanej oceny okresowej (obowiązkowe przy negatywnej),
  * Wnioski dotyczące Indywidualnego Programu Rozwoju Zawodowego (IPRZ),
  * Dane poprzedniej oceny urzędnika SC (ocena, poziom, data) + czy dołączono wniosek o kolejny stopień służbowy (`TAK` / `NIE` / `NIE DOTYCZY`),
  * Dane i podpis oceniającego, potwierdzenie zapoznania i podpis ocenianego,
  * Pouczenie o prawie sprzeciwu w terminie 7 dni do Dyrektora Generalnego urzędu (art. 83 ust. 1).
* **Część III (Opcjonalna — tylko dla urzędnika SC przy wniosku z art. 89 ust. 1):**
  * Dane urzędnika (imię, nazwisko, rok mianowania, posiadany stopień, data przyznania),
  * Treść wniosku o kolejny stopień + umotywowanie + podpis oceniającego.

### B. Arkusz Pierwszej Oceny w Służbie Cywilnej
* **Część I (Ogólna):** Nazwa urzędu, dane ocenianego (+ data nawiązania stosunku pracy), dane bezpośredniego przełożonego, dane kierującego komórką organizacyjną.
* **Część II (Rozmowa wstępna):** Data rozmowy wstępnej, termin na złożenie sprawozdania (`od – do`), okres na dokonanie pierwszej oceny (`od – do`), potwierdzenie i podpisy przełożonego oraz ocenianego.
* **Część III (Rozmowa oceniająca):** Data rozmowy oceniającej, potwierdzenie i podpisy przełożonego oraz ocenianego.
* **Część IV (Ocena 5 elementów):** Tabela dla 5 stałych elementów (skala: 3, 5, 7 pkt) + wyliczona `OCENA ŁĄCZNA` (średnia arytmetyczna).
* **Część V (Pierwsza ocena):**
  * Zaliczenie egzaminu ze służby przygotowawczej (`TAK` / `NIE` / `NIE DOTYCZY`),
  * Sprawozdanie złożone w terminie (`TAK` / `NIE`),
  * Wynik: `POZYTYWNA` / `NEGATYWNA`,
  * Uzasadnienie przyznanej oceny (obowiązkowe przy negatywnej).
* **Część VI (Wnioski rozwojowe — tylko przy ocenie pozytywnej):** Wnioski dotyczące rozwoju zawodowego, potwierdzenie dokonania oceny (podpis bezpośredniego przełożonego ORAZ kierującego komórką organizacyjną), potwierdzenie zapoznania i podpis ocenianego.

---

## 3. UWAGA DLA AGENTÓW — Brakujący zasób do uzupełnienia
* **Plik `Model_kompetencji.xlsx`** (15 stron/arkuszy) nie został wyekstrahowany tekstowo w bieżącej sesji.
* **Akcja wymagana przed finalnym zaimplementowaniem bazy wskaźników behawioralnych:** Należy wyeksportować `Model_kompetencji.xlsx` do formatu `JSON` lub `CSV` (np. skryptem Python `pandas`/`openpyxl`) i zasilić nim bazę wskaźników behawioralnych aplikacji oraz bazę wiedzy RAG.
* Do czasu konwersji Excela agenci mogą oprzeć strukturę danych modelu kompetencyjnego na 14 kryteriach z Załącznika nr 1 (opisanych w `02_domain_logic_and_rules.md`), projektując schemat tak, aby łatwo wgrać docelowy JSON z wskaźnikami behawioralnymi i przypisanymi do nich poziomami (1–9 / 3–7).