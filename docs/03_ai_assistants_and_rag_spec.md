# Specyfikacja Asystentów AI, RAG i Bezpieczeństwa (20% oceny Jury)

## 1. Wymagania ogólne wobec AI
* **Model:** wyłącznie **Gemini 3.5 Flash-Lite** (`gemini-3.5-flash-lite`) przez Gemini API, płatny tier, `thinkingLevel: minimal`, odpowiedzi w trybie JSON (`responseMimeType`, dla Asystenta Formalnego z pełnym `responseSchema`). Świadome odstępstwo od wymogu darmowych narzędzi AI (uzasadnienie: `01_context_and_requirements.md` § 5 pkt 2). Pomiar 21.11.2026: ok. 1 s na odpowiedź, zestaw testów asystenta 30/30 w trzech przebiegach (wcześniej Gemma 4 31B: 55–80 s). Model i poziom myślenia ustawiane parametrami `GEMINI_MODEL` / `GEMINI_THINKING_LEVEL` (domyślnie powyższe).
* **Wywołania wyłącznie z Cloud Functions** — klucz API nigdy nie trafia do przeglądarki. Dostawca schowany za interfejsem `LlmProvider` (w produkcji: model on-premise, np. Bielik / PLLuM).
* **Brak przełączania na inne modele.** Gdy API zwróci błąd limitu (HTTP 429) lub wyczerpanie zasobów (także brak środków na koncie, HTTP 402), UI wyświetla komunikat: *„Wyczerpano dostępne zasoby asystenta AI. Spróbuj ponownie później.”* — bez fallbacku.
* **Rola wyłącznie doradcza i wspierająca:** AI **nigdy** nie wystawia oceny pracownika ani nie podejmuje decyzji kadrowych.
* **Dane osobowe:** prototyp działa na danych fikcyjnych i **nie stosuje pseudonimizacji**. W dokumentacji dla jury wskazujemy wymóg produkcyjny: pseudonimizacja promptów lub model on-premise + umowa powierzenia.

---

## 2. Dwa tryby / Dwóch Asystentów AI

### A. Asystent Formalny Oceny (RAG — Strict Grounding)
**Cel:** Odpowiada na pytania przełożonego dotyczące zasad prawnych, terminów, doboru arkusza, wyjątków (np. nieobecności, zmiana stanowiska, sprzeciw) oraz poprawności formalnej dokumentacji.

**Wymagania krytyczne (Testowane na żywo przez Jury!):**
1. **Ścisłe oparcie na bazie wiedzy (RAG):** Odpowiedzi generowane wyłącznie na podstawie zaindeksowanych dokumentów z `knowledge/sources/`:
   * Ustawa o służbie cywilnej — tekst jednolity Dz. U. z 2026 r. poz. 590 (`legal/ustawa-o-sluzbie-cywilnej-tj-2026-poz-590.pdf`),
   * Rozporządzenie PRM z 4 kwietnia 2016 r. (Dz. U. poz. 470) — oceny okresowe + załączniki (`legal/rozporzadzenie-2016-oceny-okresowe.pdf`),
   * Rozporządzenie PRM z 23 lipca 2015 r. (Dz. U. poz. 1144) — pierwsza ocena + załączniki (`legal/rozporzadzenie-2015-pierwsza-ocena.pdf`),
   * Poradnik KPRM „Oceny okresowe w służbie cywilnej” (2016) (`guides/poradnik-kprm-oceny-okresowe-2016.pdf`),
   * Poradnik KPRM „Pierwsza ocena w służbie cywilnej” (2016) (`guides/poradnik-kprm-pierwsza-ocena-2016.pdf`),
   * Wzory arkuszy B, C i pierwszej oceny wraz z przypisami (`forms/`),
   * Model kompetencji MC (`model/model-kompetencji.xlsx`).
   * *Nie tworzymy własnego FAQ* — asystent cytowałby nasz tekst jak źródło prawa. Praktyczne wyjaśnienia i przykłady (np. obliczanie terminów) czerpiemy z poradników KPRM.
2. **Cytowanie źródeł (Obowiązkowe):** Każda odpowiedź musi zawierać precyzyjną identyfikację źródła (np. *„Źródło: § 11 ust. 1 pkt 4 Rozporządzenia PRM z 4 kwietnia 2016 r. (Dz. U. poz. 470)”* lub *„Źródło: Poradnik KPRM – Oceny okresowe, s. 13”*).
3. **Walidacja cytatów w kodzie:** model zwraca odpowiedź wraz z listą cytatów `{fragment, unit, page, quote}` w schemacie JSON (`responseSchema`); Cloud Function sprawdza każdy cytat względem fragmentów faktycznie pobranych z indeksu:
   * fragment musi być na liście pobranych,
   * `quote` musi występować we fragmencie (nagłówek + treść, czyli dokładnie to, co widział model) **dosłownie, słowo po słowie**. Dopasowanie ignoruje wielkość liter, cudzysłowy, myślniki, interpunkcję i oznaczenia punktów („a)”, „1)”); toleruje jedną literówkę w słowie 6+ liter oraz słowa porozrywane spacjami przez ekstrakcję PDF („u rzędu”) — wtedy litery muszą zgadzać się co do joty. Pominięcia `[...]` / `…` są dozwolone, ale każda część musi wystąpić w źródle w tej samej kolejności,
   * cytat bez `quote` musi mieć `unit` i `page` zgodne z metadanymi fragmentu.
   Jednostka i strona pokazywane użytkownikowi **zawsze pochodzą z metadanych indeksu** (model może jedynie doprecyzować punkt, np. „§ 11 ust. 1 pkt 4” we fragmencie „§ 11 ust. 1”). Jeśli model błędnie opisze jednostkę, ale cytat jest dosłowny — przyjmujemy cytat z jednostką z indeksu. Każda inna niezgodność → odpowiedź odrzucona i zastąpiona komunikatem odmowy.
4. **Polityka anty-halucynacyjna (Fallback):** Jeśli wynik wyszukiwania jest poniżej progu trafności albo w pobranych fragmentach nie ma odpowiedzi, asystent **musi wprost odpowiedzieć**, że brakuje informacji w udostępnionej bazie wiedzy (np. *„W udostępnionej bazie wiedzy nie znalazłem informacji na ten temat. Proszę skonsultować tę kwestię z komórką kadr (HR).”*) — zakaz zgadywania i dopowiadania!
5. **Kontekstowość:** do każdego pytania funkcja dołącza krótki kontekst ekranu: ścieżka (A/B), arkusz (B/C), bieżący krok steppera, status oceny — **bez ocen cząstkowych**. Kontekst trafia do promptu, nie do zapytania wyszukiwania.

**Indeks RAG:**
* Akty prawne dzielone wg jednostek redakcyjnych (artykuł / paragraf → ustęp → punkt); poradniki wg sekcji z numerem strony; arkusze wraz z przypisami; model kompetencji wg kompetencji i wskaźnika.
* Każdy fragment ma metadane `{ source, unit, page }`, z których budowany jest cytat.
* Wyszukiwanie BM25 (`minisearch`) po statycznym pliku JSON budowanym skryptem z `knowledge/sources/` i ładowanym do pamięci funkcji. Embeddingi dopiero, jeśli zestaw testów pokaże luki.
* **Zestaw testów asystenta:** pytania poniżej (oraz kolejne) zapisane jako przypadki testowe z oczekiwaną odpowiedzią, źródłem lub odmową — uruchamiane po każdej zmianie promptu lub indeksu.

**Przykładowe pytania testowe, które mogą zadać jurorzy:**
* *„Pracownik ma średnią 5,8 z oceny okresowej, ale dostał 1 punkt za komunikację. Czy ocena jest pozytywna?”* $\rightarrow$ **NIE**, ocena jest negatywna (§ 11 ust. 1 pkt 4 rozp. z 2016 r.).
* *„Nowy pracownik został zwolniony ze służby przygotowawczej przez Dyrektora Generalnego. Czy musi zdawać egzamin?”* $\rightarrow$ **TAK**, zwolnienie z art. 36 ust. 7 nie wyłącza stosowania art. 36 ust. 5 (egzamin) — art. 36 ust. 8 ustawy; Poradnik Pierwsza Ocena.
* *„Pracownik w pierwszej ocenie dostał jedną trójkę, trzy piątki i jedną siódemkę. Zdał egzamin i złożył sprawozdanie w terminie. Jaki będzie wynik?”* $\rightarrow$ **POZYTYWNA**, bo średnia to 5,0, a limit ocen 3-punktowych to maks. 1 (§ 10 ust. 1 rozp. z 2015 r.).
* *„Pracownik na ocenie okresowej był na L4 przez 44 dni bez przerwy. Co z terminem oceny?”* $\rightarrow$ Termin 24-miesięczny wydłuża się o 44 dni (art. 81 ust. 7 ustawy).
* *„Pracownik dostał ocenę negatywną i był potem 2 miesiące na zwolnieniu. Czy termin ponownej oceny się wydłuża?”* $\rightarrow$ **NIE** — art. 81 ust. 7 dotyczy tylko terminu 24-miesięcznego (Poradnik KPRM – Oceny okresowe, s. 13).
* *„Ile dni ma pracownik na złożenie sprzeciwu od oceny okresowej i do kogo?”* $\rightarrow$ 7 dni od zapoznania się z oceną, do dyrektora generalnego urzędu (art. 83 ust. 1 ustawy).
* *„Jaki jest wymiar urlopu na żądanie w Kodeksie pracy?”* (pytanie spoza bazy) $\rightarrow$ **Odmowa odpowiedzi** z komunikatem o braku danych w bazie wiedzy.

---

### B. Asystent Rozmowy (Coaching / Mentoring / Przygotowanie)
**Cel:** Praktyczne wsparcie przełożonego w przygotowaniu się do rozmowy rozpoczynającej lub rozmowy oceniającej oraz w formułowaniu uzasadnień i planu rozwoju (IPRZ).

**Funkcjonalności:**
1. **Generowanie agendy i pytań do rozmowy:** Na podstawie OSP, wybranych kryteriów, wskaźników (z opisami poziomów z modelu kompetencji) i notatek `evidence` proponuje konkretne pytania otwarte i tematy do omówienia — zgodnie z zakresem rozmowy z § 5 ust. 1 / § 10 rozp. z 2016 r. lub § 3 / § 7 pkt 1 rozp. z 2015 r.
2. **Porządkowanie argumentacji (Feedback oparty na faktach):** Pomaga przełożyć wybrane wskaźniki behawioralne i notatki `evidence` na konstruktywną, neutralną emocjonalnie informację zwrotną (np. model FUKO: Fakty – Ustosunkowanie – Konsekwencje – Oczekiwania).
3. **Szkic uzasadnienia i wniosków do IPRZ / rozwoju zawodowego:** Generuje *propozycję* tekstu. Szkic trafia do pola formularza **wyłącznie po kliknięciu „Wstaw do formularza”**; wstawiony tekst jest w pełni edytowalny, a nad polem widnieje etykieta *„Szkic wygenerowany przez AI — wymaga weryfikacji”*, która znika po pierwszej ręcznej edycji. Nic nie wypełnia się automatycznie.
4. **Symulacja trudnych sytuacji:** Podpowiada, jak przeprowadzić trudną rozmowę (np. przy ocenie negatywnej lub rozbieżności w samoocenie pracownika).

---

### C. Analiza OSP (Wartość dodana dla Kryterium „Innowacyjność”)
* W Kroku 1 Oceny Okresowej użytkownik wybiera jeden z 3 profili demo albo **wgrywa plik OSP w formacie DOCX** (szablon MC). PDF i skany są poza zakresem prototypu.
* **Parser w kodzie (deterministyczny)** wyciąga z DOCX pola strukturalne: nazwa stanowiska, symbol, komórka, stanowisko bezpośrednio nadzorujące, liczba podległych pracowników (checkboxy ☒/☐), cel stanowiska, zadania (dominujące i pozostałe), kompetencje miękkie, upoważnienia, czynniki utrudniające. Przełożony zatwierdza wynik parsowania.
* **Arkusz B / C** wskazuje reguła w kodzie (patrz `02_...` § 1.2, w tym ostrzeżenie dla „kieruje lub koordynuje”).
* **AI** dostaje gotową strukturę OSP i wyłącznie sugeruje **do 3 kryteriów dodatkowych** z katalogu 14 (z wyłączeniem obowiązkowych dla arkusza), uzasadniając każdy wybór konkretnymi zadaniami z OSP (np. dla starszego specjalisty w DC: *Radzenie sobie w sytuacjach kryzysowych* — dyżury i reagowanie na incydenty).
* Ostateczny wybór zawsze zatwierdza przełożony.
