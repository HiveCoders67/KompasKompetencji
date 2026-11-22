# Logika Biznesowa i Przepisy Prawne (Służba Cywilna)

Ten dokument zawiera twarde reguły biznesowe, wzory obliczeniowe i walidacje prawne, które muszą zostać zaimplementowane w kodzie aplikacji oraz w systemie walidacji formularzy.

---

## 1. ŚCIEŻKA B: Ocena Okresowa w Służbie Cywilnej
**Podstawa prawna:**
* Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (m.in. art. 71, 81–83, 89, 108).
* Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej (Dz. U. poz. 470).

### 1.1. Kto podlega i kto ocenia
* **Podlegają:** Urzędnicy służby cywilnej oraz pracownicy służby cywilnej zatrudnieni na czas nieokreślony.
* **Nie podlegają:** Osoby na wyższych stanowiskach w służbie cywilnej, pracownicy na umowie 12-miesięcznej (art. 35 ust. 3 — podlegają pierwszej ocenie), osoby na zastępstwo.
* **Oceniający:** Wyłącznie bezpośredni przełożony (wskazany w OSP w polu „Stanowisko pracy bezpośrednio nadzorujące”).

### 1.2. Dobór właściwego Arkusza Oceny (na podstawie OSP)
* **Arkusz A** (Załącznik nr 2) — kierownik urzędu będący stanowiskiem w służbie cywilnej (poza głównym zakresem grafiki MC, ale warto znać w bazie wiedzy AI).
* **Arkusz B** (Załącznik nr 3) — stanowisko, na którym praca polega na **bezpośrednim kierowaniu pracownikami** (np. naczelnik wydziału, kierownik zespołu; w OSP pole „Liczba podległych pracowników” $\neq$ „brak podległych pracowników”).
* **Arkusz C** (Załącznik nr 4) — **inne stanowisko pracy** niż A i B (brak bezpośredniego kierowania pracownikami, np. starszy specjalista, radca).

**Reguła doboru arkusza w aplikacji (deterministyczna, w kodzie):**
* OSP zaznacza „brak podległych pracowników” $\rightarrow$ system wskazuje **Arkusz C**.
* OSP zaznacza dowolne z pól „bezpośrednio kieruje **lub koordynuje** pracę …” / „bezpośrednio podlegają osoby kierujące pracą innych pracowników” $\rightarrow$ system **sugeruje Arkusz B** i wyświetla ostrzeżenie: *„Pole OSP obejmuje także koordynowanie. Arkusz B dotyczy wyłącznie stanowisk, na których praca polega na bezpośrednim kierowaniu pracownikami (§ 3 ust. 3 rozp. z 2016 r.). Potwierdź.”* Przełożony zatwierdza B albo zmienia na C. Samo koordynowanie bez kierowania $\rightarrow$ Arkusz C.
* Poradnik KPRM: „Wszystkie osoby zajmujące stanowisko pracy, bez względu na jego nazwę, na którym praca polega na bezpośrednim kierowaniu pracownikami, oceniane są na arkuszu B (np. kierownik sekcji, kierownik zespołu, naczelnik wydziału)”.

### 1.3. Kryteria obowiązkowe i dodatkowe
**Arkusz B — 5 kryteriów obowiązkowych:**
1. Zarządzanie ludźmi
2. Podejmowanie decyzji i odpowiedzialność
3. Organizacja pracy i orientacja na osiąganie celów
4. Współpraca
5. Komunikacja

**Arkusz C — 5 kryteriów obowiązkowych:**
1. Wykorzystywanie wiedzy i doskonalenie zawodowe
2. Rzetelność
3. Organizacja pracy i orientacja na osiąganie celów
4. Współpraca
5. Komunikacja

**Kryteria dodatkowe (dla B i C):**
* Oceniający może wybrać od **0 do maksymalnie 3** kryteriów dodatkowych z pełnego wykazu 14 kryteriów (nie można powielać kryteriów już będących obowiązkowymi dla danego arkusza).
* Dobór powinien wynikać z zadań i kompetencji zapisanych w Opisie Stanowiska Pracy (OSP).

### 1.4. Pełny wykaz 14 kryteriów oceny (Załącznik nr 1 do rozporządzenia z 2016 r.)
1. **Komunikacja:** Koncentrowanie się na wypowiedzi rozmówcy i dbanie o wzajemne zrozumienie; wypowiadanie się ustne i pisemne w sposób jasny i precyzyjny dostosowany do sytuacji i odbiorcy; przedstawianie przekonujących argumentów.
2. **Kreatywność:** Proponowanie lub tworzenie nowych rozwiązań; nieschematyczne podejście do zadań.
3. **Negocjowanie:** Przygotowywanie się do negocjacji (projekt stanowiska, zakres ustępstw, argumentacja); stosowanie technik i strategii negocjacyjnych; osiągnięcie efektu akceptowanego przez przełożonych.
4. **Organizacja pracy i orientacja na osiąganie celów:** Określanie sposobu realizacji zadań/celów; ustalanie priorytetów (waga i pilność); dobieranie zasobów; dostosowywanie się do zmian; wytrwałość i zaangażowanie.
5. **Orientacja na klienta/interesanta:** Taktowne zachowanie wyrażające szacunek i zrozumienie; rozpoznawanie potrzeb klienta/interesanta i proponowanie rozwiązań.
6. **Podejmowanie decyzji i odpowiedzialność:** Wypracowywanie alternatywnych rozwiązań na podstawie analizy informacji i ryzyka; decyzyjność; przyjmowanie odpowiedzialności za efekty decyzji.
7. **Radzenie sobie w sytuacjach kryzysowych:** Rozpoznawanie sytuacji kryzysowych i informowanie zainteresowanych; podejmowanie działań rozwiązujących kryzys; wyciąganie wniosków.
8. **Rzetelność:** Wykonywanie zadań zgodnie ze standardami (przepisami, zasadami, procedurami) oraz dbałość o jakość rezultatów; dotrzymywanie zobowiązań w wyznaczonym czasie.
9. **Myślenie analityczne:** Rozróżnianie informacji istotnych i nieistotnych; dostrzeganie zależności między informacjami; formułowanie wniosków.
10. **Wykorzystywanie wiedzy i doskonalenie zawodowe:** Wykorzystywanie wiedzy przy realizacji zadań; doskonalenie wiedzy i umiejętności (wyszukiwanie wiedzy, dobre praktyki); korzystanie z dostępnych źródeł, rozwiązań i technologii.
11. **Współpraca:** Włączanie się w działania wspólne; dbanie o przepływ informacji; dbanie o dobrą atmosferę i otwartość; dostrzeganie wkładu innych; branie pod uwagę zdania innych; dzielenie się wiedzą i doświadczeniem.
12. **Wystąpienia publiczne:** Wykorzystywanie różnych środków przekazu i dbałość o prezentację/autoprezentację; kontakt z audytorium; zarządzanie czasem wystąpienia i elastyczne reagowanie; radzenie sobie ze stresem, krytyką i trudnymi pytaniami.
13. **Zarządzanie ludźmi:** Delegowanie zadań, odpowiedzialności i uprawnień; monitorowanie realizacji i działania korygujące; motywowanie; udzielanie informacji zwrotnej; rozwiązywanie konfliktów; wspieranie rozwoju zawodowego.
14. **Zarządzanie strategiczne:** Tworzenie wizji i celów strategicznych; formułowanie celów operacyjnych na podstawie strategicznych; analiza ryzyka działań strategicznych.

### 1.5. Algorytm punktacji i wyznaczania wyniku (Ocena Okresowa)
**Skala ocen cząstkowych (5 poziomów):**
* `1 punkt` — znacznie poniżej oczekiwań
* `3 punkty` — poniżej oczekiwań
* `5 punktów` — na poziomie oczekiwań *(punkt wyjścia oznaczający optymalną realizację zadań)*
* `7 punktów` — powyżej oczekiwań
* `9 punktów` — znacznie powyżej oczekiwań

**Średnia arytmetyczna ($\bar{x}$) ze wszystkich ocenianych kryteriów (5 obowiązkowych + 0..3 dodatkowe):**
$$\bar{x} = \frac{\sum_{i=1}^{n} p_i}{n}, \quad n \in \{5, 6, 7, 8\}$$

**Mapowanie średniej na ogólny poziom spełnienia kryteriów:**
* $1 \le \bar{x} \le 2$ $\rightarrow$ **znacznie poniżej oczekiwań**
* $2 < \bar{x} \le 4$ $\rightarrow$ **poniżej oczekiwań**
* $4 < \bar{x} \le 6$ $\rightarrow$ **na poziomie oczekiwań**
* $6 < \bar{x} \le 8$ $\rightarrow$ **powyżej oczekiwań**
* $8 < \bar{x} \le 9$ $\rightarrow$ **znacznie powyżej oczekiwań**

**Reguła oceny POZYTYWNEJ vs NEGATYWNEJ (KRYTYCZNA WALIDACJA):**
* **POZYTYWNA:** $\bar{x} > 4$ **ORAZ** żadna ocena cząstkowa nie wynosi `1 punkt` (`znacznie poniżej oczekiwań`).
* **NEGATYWNA:** $\bar{x} \le 4$ **LUB** co najmniej jedna ocena cząstkowa wynosi `1 punkt` (`znacznie poniżej oczekiwań`) — *nawet jeśli średnia przekracza 4 punkty!*
* Podstawa: § 11 ust. 1 pkt 1–4 rozp. z 2016 r. (zweryfikowane z tekstem źródłowym).

**Implementacja (obowiązkowa):**
* Klasyfikacja na liczbach całkowitych, bez zaokrąglania średniej przed porównaniem: dla sumy $S$ i liczby kryteriów $n$ — `S <= 2n` → znacznie poniżej; `S <= 4n` → poniżej; `S <= 6n` → na poziomie; `S <= 8n` → powyżej; w pozostałych przypadkach → znacznie powyżej. Pozytywna ⇔ `S > 4n` i brak oceny `1`.
* Wartości `overallLevel` w danych: `FAR_BELOW_EXPECTATIONS | BELOW_EXPECTATIONS | MEETS_EXPECTATIONS | ABOVE_EXPECTATIONS | FAR_ABOVE_EXPECTATIONS`; `finalResult`: `POSITIVE | NEGATIVE`.
* Średnia wyświetlana w UI i PDF z dokładnością do **2 miejsc po przecinku** (przecinek dziesiętny, np. „5,83”).
* Wynik końcowy wylicza i zapisuje Cloud Function `completeEvaluation` (ta sama funkcja z `packages/domain`, co w UI).

### 1.6. Terminy i formalności (Ocena Okresowa)
* **Cykl podstawowy:** Co **24 miesiące** (art. 81 ust. 4) od dnia sporządzenia na piśmie poprzedniej oceny, a przy pierwszej ocenie okresowej — od dnia zatrudnienia na czas nieokreślony (§ 7 pkt 1 rozp.). Ta data **nie jest** datą nawiązania stosunku pracy (`hireDate`), jeśli pracownik zaczynał od umowy 12-miesięcznej (art. 35 ust. 3) — dlatego przechowujemy ją osobno w `employees.indefiniteEmploymentDate`.
* **Rozmowa rozpoczynająca (Część I arkusza):** Do **30 dni** od poprzedniej oceny / zatrudnienia. Okres podlegania ocenie biegnie od daty zapoznania pracownika z kryteriami (Część I) do daty sporządzenia oceny na piśmie (Część II).
* **Po ocenie negatywnej (art. 81 ust. 9):** Ponowna ocena po upływie **6 miesięcy** od zapoznania się z oceną negatywną (niezwłocznie po dniu, w którym mija 6 miesięcy — np. zapoznanie 15.02 → ocena 16.08); rozmowa rozpoczynająca i wybór kryteriów w ciągu **7 dni** od sporządzenia negatywnej oceny (§ 7 pkt 2 rozp.). Ponowna ocena jest nową oceną (mogą być nowe kryteria). Ten 6-miesięczny termin **nie przedłuża się** o nieobecność (art. 81 ust. 7) i **nie zmienia** na podstawie art. 81 ust. 8 — oba przepisy dotyczą wyłącznie terminu 24-miesięcznego (Poradnik KPRM – Oceny okresowe, s. 13).
* **Przedłużenie o nieobecność (art. 81 ust. 7):** Nieprzerwana usprawiedliwiona nieobecność **dłuższa niż 1 miesiąc** wydłuża 24-miesięczny termin o czas tej nieobecności. W danych przechowujemy wyłącznie okresy nieobecności (`absences: [{from, to}]`), bez przyczyny.
* **Zmiana terminu przez oceniającego (art. 81 ust. 8):** oceniający może zmienić termin 24-miesięczny w razie: 1) zmiany na stanowisku oceniającego, 2) przewidywanej dłuższej usprawiedliwionej nieobecności ocenianego, 3) przewidywanej dłuższej usprawiedliwionej nieobecności oceniającego, 4) wniosku ocenianego — jeżeli od ostatniej oceny minęło > 6 miesięcy (przy pierwszej ocenie okresowej: okres podlegania ocenie > 6 miesięcy). O nowym terminie oceniający niezwłocznie zawiadamia pisemnie ocenianego (§ 8 rozp.).
* **Zmiana stanowiska z istotną zmianą obowiązków (art. 81 ust. 6, § 9 rozp.):**
  * Jeśli minęło **> 6 miesięcy** od ostatniej oceny (przy osobach ocenianych po raz pierwszy: okres podlegający ocenie > 6 miesięcy): obowiązkowa wcześniejsza ocena (nie wcześniej niż 7 dni przed zmianą i nie później niż 30 dni po zmianie).
  * Jeśli minęło **$\le$ 6 miesięcy**: ponowna rozmowa i wybór kryteriów w ciągu 30 dni, termin oceny bez zmian.
* **Zmiana oceniającego w trakcie okresu (§ 9 ust. 3 rozp.):** ocena jest sporządzana na podstawie wybranych wcześniej kryteriów. W danych: nowy `supervisorId` + historia `previousSupervisors[]` (bez osobnego ekranu w prototypie).
* **Uzasadnienie oceny:** **Obowiązkowe** przy ocenie negatywnej; fakultatywne (ale zalecane) przy pozytywnej.
* **Wnioski do IPRZ:** Obowiązkowe (niezależnie od wyniku oceny).
* **Część III (Wniosek o kolejny stopień służbowy):** Wypełniana i drukowana **tylko** dla urzędnika służby cywilnej (mianowanego) przy ocenie pozytywnej, gdy przełożony wnioskuje na podstawie art. 89 ust. 1. (Uwaga: dwie kolejne oceny na poziomie „powyżej” lub „znacznie powyżej oczekiwań” dają stopień z mocy prawa — art. 89 ust. 2).
* **Sprzeciw (art. 83):** Oceniany ma **7 dni** od zapoznania się z oceną na sprzeciw do Dyrektora Generalnego urzędu (w urzędzie, w którym przepisy nie przewidują stanowiska dyrektora generalnego — do **kierownika urzędu**; przypis do wzoru arkusza). Rozpatrzenie w ciągu **14 dni**. Odwołanie do sądu pracy: 14 dni. Obsługa sprzeciwu jest poza zakresem prototypu; system wylicza jedynie `objectionDeadline` = data zapoznania + 7 dni.
* **Konsekwencja 2 negatywnych ocen z rzędu (urzędnik mianowany):** Rozwiązanie stosunku pracy (art. 71 ust. 1 pkt 1).

---

## 2. ŚCIEŻKA A: Pierwsza Ocena w Służbie Cywilnej
**Podstawa prawna:**
* Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (art. 35–38).
* Rozporządzenie Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych warunków i sposobu dokonywania pierwszej oceny w służbie cywilnej (Dz. U. poz. 1144).

### 2.1. Kto podlega i kto ocenia
* **Podlegają obligatoryjnie:** Osoby podejmujące po raz pierwszy pracę w służbie cywilnej na umowie na czas określony **12 miesięcy** (art. 35 ust. 3).
* **Mogą podlegać (za porozumieniem stron):** Osoby zatrudnione na zastępstwo (jeśli zastępstwo trwa > 8 miesięcy) — art. 37 ust. 2.
* **Nie podlega:** absolwent KSAP, który złożył wniosek o mianowanie w służbie cywilnej (art. 37 ust. 3).
* **Oceniający:** Bezpośredni przełożony **w porozumieniu z kierującym komórką organizacyjną** (oboje podpisują arkusz; kierujący komórką składa wniosek do Dyrektora Generalnego o umowę na czas nieokreślony lub rozwiązanie/niezawieranie umowy).

### 2.2. Stały zestaw 5 elementów oceny (brak kryteriów dodatkowych)
1. Rzetelność
2. Wykorzystywanie wiedzy i doskonalenie zawodowe
3. Organizacja pracy i orientacja na osiąganie celów
4. Komunikacja
5. Współpraca

### 2.3. Algorytm punktacji i wyznaczania wyniku (Pierwsza Ocena)
**Skala ocen cząstkowych (3 poziomy):**
* `3 punkty` — poniżej oczekiwań
* `5 punktów` — na poziomie oczekiwań
* `7 punktów` — powyżej oczekiwań

**Ocena łączna ($\bar{x}$):** Średnia arytmetyczna z 5 elementów:
$$\bar{x} = \frac{\sum_{i=1}^{5} p_i}{5}$$

**Reguła oceny POZYTYWNEJ (wszystkie 4 warunki muszą być spełnione ŁĄCZNIE):**
1. **Egzamin ze służby przygotowawczej:** Zaliczony (`TAK`) albo `NIE DOTYCZY` (dotyczy m.in. absolwentów KSAP bez wniosku o mianowanie, osób na zastępstwo, wyższych stanowisk). *Uwaga: indywidualne zwolnienie ze służby przygotowawczej (art. 36 ust. 7) NIE zwalnia z egzaminu!*
2. **Sprawozdanie pracownika:** Złożone w wyznaczonym terminie (`TAK`). Sprawozdanie musi obejmować okres **nie krótszy niż 7 miesięcy** pracy.
3. **Limit ocen niskich:** Maksymalnie **jedna** ocena cząstkowa w wysokości `3 punkty` (`count(p == 3) <= 1`).
4. **Minimalna średnia:** Ocena łączna $\bar{x} \ge 5,0$.

**Reguła oceny NEGATYWNEJ:** Niespełnienie któregokolwiek z powyższych 4 warunków automatycznie skutkuje oceną negatywną.

**Implementacja:** warunek 4 sprawdzany na liczbach całkowitych: `suma ocen >= 25` (⇔ $\bar{x} \ge 5$ przy 5 elementach). Podstawa: § 10 ust. 1–3 rozp. z 2015 r. Wartości w danych: `examPassed: YES | NO | NOT_APPLICABLE`, `reportSubmittedOnTime: YES | NO`.

### 2.4. Terminy i formalności (Pierwsza Ocena)
* **Rozmowa wstępna (Część II arkusza):** Do **21 dni** od dnia nawiązania stosunku pracy (lub ustalenia objęcia oceną przy zastępstwie). Ustala się wtedy okno na złożenie sprawozdania i okno na ocenę.
* **Służba przygotowawcza:** Trwa max **4 miesiące** i musi się skończyć nie później niż po **8 miesiącach** od zatrudnienia.
* **Okno dokonania pierwszej oceny:** Nie wcześniej niż **po upływie 8 miesięcy** od nawiązania stosunku pracy i nie później niż **miesiąc przed upływem umowy** (tj. między 8. a 11. miesiącem umowy 12-miesięcznej).
* **Termin sprawozdania (§ 4 ust. 1 rozp. z 2015 r.):** ustalany tak, aby przypadał po upływie 8 miesięcy od nawiązania stosunku pracy i aby ocena mogła nastąpić w terminie z art. 38 ust. 1. Sprawozdanie obejmuje okres nie krótszy niż 7 miesięcy (§ 6 ust. 1).
* **Walidacja dat w kroku „Rozmowa wstępna” (`firstDeadlineIssues` w `packages/domain`):**
  * **Blokuje** potwierdzenie rozmowy (i zatwierdzenie oceny na serwerze): data rozmowy przed nawiązaniem stosunku pracy lub w przyszłości; odwrócony zakres („od” > „do”) sprawozdania lub okresu oceny; sprawozdanie zaczynające się przed upływem 8 miesięcy albo kończące się po ostatnim dniu, w którym można dokonać oceny (§ 4 ust. 1); okres oceny poza oknem z art. 38 ust. 1; sprawozdanie lub okres oceny zaczynające się przed rozmową wstępną (termin wyznacza się na tej rozmowie — § 3 pkt 4); sprawozdanie kończące się po okresie oceny (ocena po sprawozdaniu — § 8 ust. 1).
  * **Ostrzega** (nie blokuje): rozmowa wstępna po terminie 21 dni — spóźnienia nie da się cofnąć, a rozmowę i tak trzeba udokumentować.
  * Granice liczone od daty nawiązania stosunku pracy; przedłużenie umowy z art. 35 ust. 4 nie jest modelowane w prototypie.
  * UI: komunikat pokazuje się w dymku przy polu, którego dotyczy (pole podświetlone). Brakujące wartości — dopiero po edycji pola lub próbie potwierdzenia. W zakresach „od – do” data końcowa nie może być wcześniejsza niż początkowa (kalendarz ją blokuje, wpisana ręcznie jest korygowana), a kalendarze podpowiadają granice z przepisów.
* **Nowy termin sprawozdania przy nieobecności (§ 5 ust. 1 rozp. z 2015 r.):** w uzasadnionych przypadkach przełożony wyznacza nowy termin w związku z **każdą** usprawiedliwioną nieobecnością albo wykonywaniem obowiązków służbowych poza miejscem pracy, przedłużając termin o okres tej nieobecności — tak, aby ocena mogła nastąpić nie później niż miesiąc przed końcem stosunku pracy (§ 5 ust. 3). O nowym terminie przełożony zawiadamia pisemnie (§ 5 ust. 4).
* **Nieobecność > 3 miesiące (art. 35 ust. 4):** Na wniosek pracownika Dyrektor Generalny *może* przedłużyć umowę o czas tej nieobecności — wtedy wyznacza się nowy termin sprawozdania (§ 5 ust. 2 rozp. z 2015 r.).
* **Rozmowa oceniająca (§ 8):** niezwłocznie po złożeniu sprawozdania albo po upływie terminu na jego złożenie; może w niej uczestniczyć kierujący komórką.
* **Uzasadnienie oceny:** **Obowiązkowe** przy ocenie negatywnej; fakultatywne przy pozytywnej.
* **Wnioski dotyczące rozwoju zawodowego (Część VI):** Sporządzane fakultatywnie **tylko w przypadku oceny pozytywnej**.

---

## 3. Model Kompetencji i Sugestia Poziomu (Human-in-the-loop)

### 3.1. Źródło danych
* Plik `knowledge/sources/model/model-kompetencji.xlsx` (model MC): **14 kompetencji, 49 wskaźników behawioralnych, 5 poziomów** (znacznie poniżej / poniżej / na poziomie / powyżej / znacznie powyżej oczekiwań). Dla każdego wskaźnika i poziomu model zawiera opis obserwowalnego zachowania.
* Nazwy wskaźników to dosłownie opisy kryteriów z Załącznika nr 1 do rozp. z 2016 r. (i odpowiadających im elementów z Załącznika nr 1 do rozp. z 2015 r.).
* Liczba wskaźników: Rzetelność 2, Komunikacja 4, Wykorzystywanie wiedzy i doskonalenie zawodowe 3, Organizacja pracy i orientacja na osiąganie celów 5, Kreatywność 2, Współpraca 6, Myślenie analityczne 3, Negocjowanie 3, Wystąpienia publiczne 4, Orientacja na klienta/interesanta 2, Radzenie sobie w sytuacjach kryzysowych 3, Zarządzanie strategiczne 3, Zarządzanie ludźmi 6, Podejmowanie decyzji i odpowiedzialność 3.
* Skrypt konwertuje xlsx do `packages/domain/data/competencies.json` — **jedyne źródło prawdy** dla UI, seeda Firestore i indeksu RAG.
* Wskazówki z arkusza wprowadzającego modelu wyświetlamy w UI jako instrukcję przy ocenie wskaźników:
  * „Dobierz wskaźniki do zadań i zakresu odpowiedzialności na stanowisku. Poziom »na poziomie oczekiwań« opisuje standard wykonania w tym zakresie.”
  * „Oprzyj ocenę na konkretnych przykładach z ocenianego okresu. Zapisz sytuację, działanie i jego rezultat. Uwzględnij powtarzalność zachowania, złożoność sytuacji i dostępne uprawnienia.”
  * „Jeśli brak było okazji do zaobserwowania zachowania, odnotuj brak podstaw do oceny danego wskaźnika.”

### 3.2. Dwa etapy użycia wskaźników (zgodnie z grafiką MC: model stosowany przy „Zakończ ocenę”)
1. **Rozpocznij ocenę** (rozmowa rozpoczynająca / wstępna): przy każdym kryterium UI pokazuje nazwy jego wskaźników jako **tematy rozmowy o oczekiwaniach** (§ 5 ust. 1 pkt 3 rozp. z 2016 r.; § 3 pkt 3 rozp. z 2015 r.). Nic nie jest zaznaczane ani zapisywane jako wybór.
2. **Zakończ ocenę** (z zastosowaniem modelu kompetencji): dla każdego kryterium przełożony:
   * dobiera wskaźniki adekwatne do stanowiska (domyślnie wszystkie, **minimum 1** na kryterium),
   * przy każdym dobranym wskaźniku wybiera opis zachowania najlepiej odpowiadający obserwacjom **albo** zaznacza „brak podstaw do oceny”,
   * opcjonalnie dodaje notatkę `evidence` (sytuacja – działanie – rezultat); pole nie blokuje przejścia dalej,
   * widzi sugestię systemu i **sam wybiera** ocenę cząstkową (bez obowiązku uzasadniania odstępstwa od sugestii).

### 3.3. Skala w ścieżkach
* **Ścieżka B:** wszystkie 5 kolumn modelu (1 / 3 / 5 / 7 / 9 pkt).
* **Ścieżka A:** wyłącznie kolumny „poniżej” / „na poziomie” / „powyżej oczekiwań” (3 / 5 / 7 pkt) — kolumny skrajne są ukryte.

### 3.4. Wzór sugestii (deterministyczny, `packages/domain`)
* `suggestedMean` = średnia arytmetyczna poziomów zaznaczonych wskaźników (wskaźniki „brak podstaw do oceny” pomijane).
* `suggestedScore` = wartość ze skali ścieżki najbliższa `suggestedMean`; **remis rozstrzygany w dół** (np. 5 i 7 → 6,0 → sugestia 5).
* Gdy wszystkie dobrane wskaźniki mają „brak podstaw do oceny” → brak sugestii (`suggestedScore = null`), przełożony wybiera ocenę samodzielnie.
* Brak reguł specjalnych: pojedynczy wskaźnik na poziomie 1 nie wymusza sugestii 1. Jeśli jednak którykolwiek wskaźnik ma poziom 1 (ścieżka B), UI pokazuje ostrzeżenie: *„Ocena cząstkowa 1 pkt oznacza ocenę negatywną (§ 11 ust. 1 pkt 4 rozp. z 2016 r.)”*.
* UI pokazuje obie wartości, np. *„Średnia wskaźników 6,00 → sugestia 5 pkt”*, z badge „Sugestia systemu na podstawie wskaźników”.

---

## 4. Statusy, wersja robocza i zatwierdzanie

### 4.1. Ścieżka B (ocena okresowa)
`DRAFT` → `INITIAL_TALK_DONE` (§ 5–6: rozmowa, kryteria, termin; Część I podpisana) → `IN_PROGRESS` (ocena wskaźników) → `FINAL_TALK_DONE` (§ 10: rozmowa oceniająca) → `COMPLETED` (§ 11: ocena sporządzona na piśmie) → `ACKNOWLEDGED` (§ 12: oceniany zapoznał się z oceną; od tej daty `objectionDeadline` = +7 dni, a po ocenie negatywnej termin ponownej oceny = +6 miesięcy).

### 4.2. Ścieżka A (pierwsza ocena)
`DRAFT` → `INITIAL_TALK_DONE` (§ 3–4: rozmowa wstępna, Części I–II) → `REPORT_SUBMITTED` (sprawozdanie złożone albo termin upłynął; zapisujemy datę złożenia i flagę „w terminie”; treści sprawozdania nie przechowujemy) → `FINAL_TALK_DONE` (§ 8) → `COMPLETED` (ocena sporządzona; wymaga `departmentHeadApprovedAt` — arkusz podpisuje także kierujący komórką) → `ACKNOWLEDGED` (§ 11).

### 4.3. Wersja robocza
* **Autozapis** do Firestore w tle (debounce kilka sekund po zmianie), wskaźnik „Zapisano HH:MM” w nagłówku.
* Osobny przycisk zapisu nie jest potrzebny: nad nazwiskiem ocenianego jest link powrotu **„‹ Moje oceny”** (kierujący komórką: „‹ Zatwierdzenia”). Przed wyjściem czeka na zapis bieżących zmian; jeśli zapis się nie uda, użytkownik zostaje na stronie, a błąd z przyciskiem „Spróbuj ponownie” widać przy statusie zapisu. Zamknięcie karty z niezapisanymi zmianami wywołuje ostrzeżenie przeglądarki.
* Lista ocen przełożonego pokazuje oceny w toku z przyciskiem „Kontynuuj” (otwiera ostatni krok).

### 4.4. Zatwierdzenie
* Przejście do `COMPLETED` wyłącznie przez Cloud Function `completeEvaluation`: przelicza wynik funkcjami z `packages/domain`, zapisuje `summary`, synchronizuje `evaluation_tracking`.
* Reguły Firestore blokują klientowi zapis `summary` oraz jakąkolwiek edycję treści oceny po `COMPLETED` (dozwolone tylko przejście do `ACKNOWLEDGED` z datą zapoznania).
