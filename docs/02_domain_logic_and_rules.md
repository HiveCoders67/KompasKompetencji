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

### 1.6. Terminy i formalności (Ocena Okresowa)
* **Cykl podstawowy:** Co **24 miesiące** od poprzedniej oceny lub zatrudnienia na czas nieokreślony.
* **Rozmowa rozpoczynająca (Część I arkusza):** Do **30 dni** od poprzedniej oceny / zatrudnienia. Okres podlegania ocenie biegnie od daty zapoznania pracownika z kryteriami (Część I) do daty sporządzenia oceny na piśmie (Część II).
* **Po ocenie negatywnej (art. 81 ust. 9):** Ponowna ocena po upływie **6 miesięcy** od zapoznania się z oceną negatywną; rozmowa rozpoczynająca i wybór kryteriów w ciągu **7 dni** od sporządzenia negatywnej oceny. (Ten 6-miesięczny termin nie przedłuża się o nieobecność i nie skraca fakultatywnie).
* **Przedłużenie o nieobecność (art. 81 ust. 7):** Nieprzerwana usprawiedliwiona nieobecność **dłuższa niż 1 miesiąc** wydłuża 24-miesięczny termin o czas tej nieobecności.
* **Zmiana stanowiska z istotną zmianą obowiązków (art. 81 ust. 6):**
  * Jeśli minęło **> 6 miesięcy** od ostatniej oceny / zapoznania z kryteriami: obowiązkowa wcześniejsza ocena (nie wcześniej niż 7 dni przed zmianą i nie później niż 30 dni po zmianie).
  * Jeśli minęło **$\le$ 6 miesięcy**: ponowna rozmowa i wybór kryteriów w ciągu 30 dni, termin oceny bez zmian.
* **Uzasadnienie oceny:** **Obowiązkowe** przy ocenie negatywnej; fakultatywne (ale zalecane) przy pozytywnej.
* **Wnioski do IPRZ:** Obowiązkowe (niezależnie od wyniku oceny).
* **Część III (Wniosek o kolejny stopień służbowy):** Wypełniana i drukowana **tylko** dla urzędnika służby cywilnej (mianowanego) przy ocenie pozytywnej, gdy przełożony wnioskuje na podstawie art. 89 ust. 1. (Uwaga: dwie kolejne oceny na poziomie „powyżej” lub „znacznie powyżej oczekiwań” dają stopień z mocy prawa — art. 89 ust. 2).
* **Sprzeciw (art. 83):** Oceniany ma **7 dni** od zapoznania się z oceną na sprzeciw do Dyrektora Generalnego. Rozpatrzenie w ciągu **14 dni**. Odwołanie do sądu pracy: 14 dni.
* **Konsekwencja 2 negatywnych ocen z rzędu (urzędnik mianowany):** Rozwiązanie stosunku pracy (art. 71 ust. 1 pkt 1).

---

## 2. ŚCIEŻKA A: Pierwsza Ocena w Służbie Cywilnej
**Podstawa prawna:**
* Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (art. 35–38).
* Rozporządzenie Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych warunków i sposobu dokonywania pierwszej oceny w służbie cywilnej (Dz. U. poz. 1144).

### 2.1. Kto podlega i kto ocenia
* **Podlegają obligatoryjnie:** Osoby podejmujące po raz pierwszy pracę w służbie cywilnej na umowie na czas określony **12 miesięcy** (art. 35 ust. 3).
* **Mogą podlegać (za porozumieniem stron):** Osoby zatrudnione na zastępstwo (jeśli zastępstwo trwa > 8 miesięcy).
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

### 2.4. Terminy i formalności (Pierwsza Ocena)
* **Rozmowa wstępna (Część II arkusza):** Do **21 dni** od dnia nawiązania stosunku pracy (lub ustalenia objęcia oceną przy zastępstwie). Ustala się wtedy okno na złożenie sprawozdania i okno na ocenę.
* **Służba przygotowawcza:** Trwa max **4 miesiące** i musi się skończyć nie później niż po **8 miesiącach** od zatrudnienia.
* **Okno dokonania pierwszej oceny:** Nie wcześniej niż **po upływie 8 miesięcy** od nawiązania stosunku pracy i nie później niż **miesiąc przed upływem umowy** (tj. między 8. a 11. miesiącem umowy 12-miesięcznej).
* **Nieobecność > 3 miesiące (art. 35 ust. 4):** Na wniosek pracownika Dyrektor Generalny *może* przedłużyć umowę o czas tej nieobecności (łącznej lub ciągłej) — wtedy wyznacza się nowy termin sprawozdania.
* **Uzasadnienie oceny:** **Obowiązkowe** przy ocenie negatywnej; fakultatywne przy pozytywnej.
* **Wnioski dotyczące rozwoju zawodowego (Część VI):** Sporządzane fakultatywnie **tylko w przypadku oceny pozytywnej**.

---

## 3. Mechanizm Modelu Kompetencyjnego (Human-in-the-loop)
* Każde kryterium/kompetencja składa się ze **wskaźników behawioralnych** opisujących konkretne, obserwowalne zachowania na różnych poziomach spełnienia.
* Przełożony dla każdego wskaźnika wybiera zachowanie najlepiej odpowiadające obserwacjom z okresu oceny.
* System agreguje wybrane wskaźniki i wylicza **sugerowany poziom kompetencji** (np. 1 / 3 / 5 / 7 / 9 pkt dla oceny okresowej lub 3 / 5 / 7 pkt dla pierwszej oceny).
* **Kluczowa zasada UX:** Sugestia jest wyraźnie oznaczona jako pomocnicza (np. badge „Sugestia systemu na podstawie wskaźników”), a przełożony ręcznie zatwierdza lub koryguje ostateczny poziom oceny cząstkowej (z opcją dodania notatki, jeśli odbiega od sugestii).