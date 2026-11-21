# Specyfikacja Asystentów AI, RAG i Bezpieczeństwa (20% oceny Jury)

## 1. Wymagania ogólne wobec AI
* **Wyłącznie darmowe narzędzia AI** na etapie hackathonu (np. darmowe limity Gemini API / Groq / OpenRouter / lokalne modele open-source + lekkie embeddingi lub hybrydowe wyszukiwanie BM25 + wektorowe).
* **Rola wyłącznie doradcza i wspierająca:** AI **nigdy** nie wystawia ostatecznej oceny pracownika ani nie podejmuje decyzji kadrowych.
* **Ochrona prywatności (Minimalizacja danych):** Do zewnętrznych modeli LLM nie należy wysyłać prawdziwych danych osobowych (PII) pracowników — w prototypie stosujemy dane fikcyjne oraz architektonicznie przewidujemy anonimizację/pseudonimizację przed wysłaniem promptu (lub możliwość podpięcia modelu on-premise / PLLuM / Bielik w wersji produkcyjnej MC).

---

## 2. Dwa tryby / Dwóch Asystentów AI

### A. Asystent Formalny Oceny (RAG — Strict Grounding)
**Cel:** Odpowiada na pytania przełożonego dotyczące zasad prawnych, terminów, doboru arkusza, wyjątków (np. nieobecności, zmiana stanowiska, sprzeciw) oraz poprawności formalnej dokumentacji.

**Wymagania krytyczne (Testowane na żywo przez Jury!):**
1. **Ścisłe oparcie na bazie wiedzy (RAG):** Odpowiedzi generowane wyłącznie na podstawie zaindeksowanych dokumentów:
   * Ustawa o służbie cywilnej (w zakresie ocen i służby przygotowawczej),
   * Rozporządzenie z 4 kwietnia 2016 r. (oceny okresowe + załączniki),
   * Rozporządzenie z 23 lipca 2015 r. (pierwsza ocena + załączniki),
   * Poradnik KPRM „Oceny okresowe w służbie cywilnej” (wrzesień 2016),
   * Poradnik KPRM „Pierwsza ocena w służbie cywilnej” (wrzesień 2016),
   * Model kompetencyjny,
   * Zestaw FAQ (pytania i odpowiedzi).
2. **Cytowanie źródeł (Obowiązkowe):** Każda odpowiedź musi zawierać precyzyjną identyfikację źródła (np. *„Źródło: § 11 ust. 1 pkt 4 Rozporządzenia PRM z 4 kwietnia 2016 r. (Dz. U. poz. 470)”* lub *„Źródło: Poradnik KPRM – Oceny okresowe, rozdz. 5.1, str. 11”*).
3. **Polityka anty-halucynacyjna (Fallback):** Jeśli w pobranych fragmentach bazy wiedzy nie ma odpowiedzi na pytanie użytkownika, asystent **musi wprost odpowiedzieć**, że brakuje wystarczających informacji w udostępnionej bazie wiedzy (np. *„W udostępnionej bazie wiedzy nie znalazłem informacji na ten temat. Proszę skonsultować tę kwestię z komórką kadr (HR).”*) — zakaz zgadywania i dopowiadania!
4. **Kontekstowość:** Asystent powinien znać aktualny kontekst ekranu (np. czy przełożony jest na ścieżce pierwszej oceny czy oceny okresowej, jaki arkusz wybrał), aby precyzyjniej odpowiadać.

**Przykładowe pytania testowe, które mogą zadać jurorzy:**
* *„Pracownik ma średnią 5,8 z oceny okresowej, ale dostał 1 punkt za komunikację. Czy ocena jest pozytywna?”* $\rightarrow$ **NIE**, ocena jest negatywna (§ 11 ust. 1 pkt 4 rozp. z 2016 r.).
* *„Nowy pracownik został zwolniony ze służby przygotowawczej przez Dyrektora Generalnego. Czy musi zdawać egzamin?”* $\rightarrow$ **TAK**, zwolnienie z art. 36 ust. 7 nie zwalnia z egzaminu (art. 36 ust. 8 ustawy; Poradnik Pierwsza Ocena str. 16).
* *„Pracownik w pierwszej ocenie dostał jedną trójkę, trzy piątki i jedną siódemkę. Zdał egzamin i złożył sprawozdanie w terminie. Jaki będzie wynik?”* $\rightarrow$ **POZYTYWNA**, bo średnia to 5,0, a limit ocen 3-punktowych to maks. 1 (§ 10 ust. 1 rozp. z 2015 r.).
* *„Pracownik na ocenie okresowej był na L4 przez 44 dni bez przerwy. Co z terminem oceny?”* $\rightarrow$ Termin 24-miesięczny wydłuża się o 44 dni (art. 81 ust. 7 ustawy).
* *„Ile dni ma pracownik na złożenie sprzeciwu od oceny okresowej i do kogo?”* $\rightarrow$ 7 dni od zapoznania się z oceną, do Dyrektora Generalnego urzędu (art. 83 ust. 1 ustawy).
* *„Jaki jest wymiar urlopu na żądanie w Kodeksie pracy?”* (pytanie spoza bazy) $\rightarrow$ **Odmowa odpowiedzi** z komunikatem o braku danych w bazie wiedzy.

---

### B. Asystent Rozmowy (Coaching / Mentoring / Przygotowanie)
**Cel:** Praktyczne wsparcie przełożonego w przygotowaniu się do rozmowy rozpoczynającej lub rozmowy oceniającej oraz w formułowaniu uzasadnień i planu rozwoju (IPRZ).

**Funkcjonalności:**
1. **Generowanie agendy i pytań do rozmowy:** Na podstawie ocenianego stanowiska (OSP), wybranych kryteriów oraz zaznaczonych wskaźników behawioralnych proponuje konkretne pytania otwarte i tematy do omówienia.
2. **Porządkowanie argumentacji (Feedback oparty na faktach):** Pomaga przełożyć wybrane wskaźniki behawioralne na konstruktywną, neutralną emocjonalnie informację zwrotną (np. model FUKO: Fakty – Ustosunkowanie – Konsekwencje – Oczekiwania).
3. **Wsparcie w redagowaniu roboczego szkicu uzasadnienia i wniosków do IPRZ:** Generuje *propozycję* tekstu do pola „Uzasadnienie” i „Wnioski do IPRZ” na podstawie zaznaczonych zachowań i obszarów poniżej oczekiwań — z wyraźnym komunikatem, że tekst wymaga weryfikacji i edycji przez przełożonego.
4. **Symulacja trudnych sytuacji:** Podpowiada, jak przeprowadzić trudną rozmowę (np. przy ocenie negatywnej lub rozbieżności w samoocenie pracownika).

---

### C. Dodatkowa funkcja AI (Wartość dodana dla Kryterium „Innowacyjność”): Analiza OSP
* W Kroku 1 Oceny Okresowej użytkownik może wybrać lub wgrać Opis Stanowiska Pracy (OSP).
* System (regułowo + wspomagająco AI) analizuje OSP i:
  1. Wskazuje właściwy arkusz (**B** lub **C**) na podstawie pola *Liczba podległych pracowników*.
  2. Sugeruje **do 3 kryteriów dodatkowych** z katalogu 14 kryteriów, uzasadniając wybór konkretnymi zadaniami z OSP (np. dla starszego specjalisty w DC: *Radzenie sobie w sytuacjach kryzysowych*, *Myślenie analityczne*).
  3. Ostateczny wybór zawsze zatwierdza przełożony.