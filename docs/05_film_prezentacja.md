# Film prezentujący projekt — scenariusz (zamiast prezentacji)

Komisja zgodziła się, aby prezentację projektu (`01_context_and_requirements.md` § 7 pkt 3: maks. 10 slajdów — logika działania, kluczowe funkcjonalności, kierunek dalszego rozwoju) zastąpić filmem. Film trwa **maksymalnie 2 minuty**: 9 krótkich scen, każda odpowiada jednemu slajdowi.

Lektor: syntezator mowy **ElevenLabs** (sekcja 4). Tekst lektora jest w tym pliku między znacznikami `<!-- lektor:NN -->` i `<!-- /lektor -->` — z nich skrypt `docs/video/generate-voiceover.mjs` generuje nagranie i wpisuje czasy scen do nagłówków poniżej. **Ten plik jest jedynym źródłem tekstu lektora**: poprawki wprowadzamy tutaj i generujemy nagranie ponownie.

---

## 1. Mapa: wymagania zadania → sceny

Film ma pokazać komisji, że spełniamy każde wymaganie z treści zadania i adresujemy każde kryterium oceny.

| Wymaganie / kryterium (treść zadania) | Scena |
| :--- | :---: |
| Problem biznesowy: rozproszona wiedza, terminy, ocena „z wrażenia” | 1 |
| Logika działania: dwie ścieżki (pierwsza ocena, ocena okresowa B/C), proces krokowy | 2, 3 |
| Analiza OSP, dobór arkusza i kryteriów dodatkowych | 3 |
| Model kompetencji, obserwowalne zachowania, sugestia poziomu, terminy ustawowe | 4 |
| **Human-in-the-loop** — decyzję zawsze podejmuje przełożony | 2, 4, 7, 9 |
| Zgodność merytoryczna (25%): rozporządzenia, wzór wyliczeń, reguła oceny negatywnej | 5 |
| Asystent formalny: RAG, cytowanie źródeł, odmowa zamiast halucynacji (20%) | 6 |
| Asystent rozmowy: rozmowa oceniająca, feedback, plan rozwoju | 7 |
| Eksport PDF zgodny z urzędowymi wzorami | 7 |
| Panel HR: statusy, terminy, przypomnienia | 8 |
| RODO i minimalizacja danych | 8 |
| UX (25%): krokowo, samouczek po pierwszym logowaniu, desktop, bez przytłoczenia biurokracją | 2–7 (nagranie ekranu) |
| Potencjał wdrożeniowy (10%) i kierunek rozwoju: role, wiele urzędów, dostępność (WCAG, dwa motywy), wymienny model AI → model lokalny | 9 |
| Świadome odstępstwo: płatny model AI (§ 5 pkt 2) — mówimy o nim otwarcie | 9 |

---

## 2. Zasady obrazu

* **Dane:** wyłącznie fikcyjne dane demo (*Wejście dla jury → Przywróć dane demo*, „dziś” = 21.11.2026).
* **Ekran:** zrzuty aplikacji w rozdzielczości 1920×1080, jasny motyw (w scenie 9 także ciemny). Nie pokazujemy telefonu — aplikacja jest tylko na desktop.
* **Tempo:** w scenie 2–3 ujęcia, każde z jednym wyraźnym „wydarzeniem” (kliknięcie, wynik, cytat, odmowa) zsynchronizowanym z konkretnym słowem lektora — widz zawsze wie, na co patrzy. Wskaźnik w lewym górnym rogu pokazuje, czyją ocenę i który krok procesu oglądamy.
* **Efekty:** każda scena ma własny środek wyrazu (np. skaner opisu stanowiska, lupa nad wskaźnikami, „stempel” wyniku, zakreślacz cytatu, zaczernienie treści przed kadrami) i własne przejście do następnej — bez powtarzania jednego efektu.
* **Styl:** film ma własną oprawę (ciemna scena, okno aplikacji jako „ekran na scenie”); **`STYLE_GUIDE.md` dotyczy aplikacji, nie filmu**. Zachowujemy logo i kroje pisma aplikacji.
* **Napisy:** z tekstu lektora, zsynchronizowane co do zdania (dostępność; komisja może oglądać bez dźwięku).
* **Plansze** (hasło w rogu ekranu, 2–5 słów) — w wierszu „Plansza”.

---

## 3. Scenariusz

Czasy w nagłówkach wpisuje skrypt na podstawie wygenerowanego nagrania (`docs/video/lektor/czasy.md`); według nich montujemy obraz.

### Scena 1 — Problem (0:00–0:12)

**Na ekranie:** igła kompasu ustawia się na północ, pojawia się tytuł „Kompas Kompetencji · HackNation 2026 · Ministerstwo Cyfryzacji”. Na słowa lektora na stos spadają kolejne źródła (ustawa, dwa rozporządzenia, arkusze, terminy); przy „na wyczucie” stos się rozmywa, a igła kompasu kręci się bez celu.
**Plansza:** „ustawa · 2 rozporządzenia · arkusze · terminy”.

<!-- lektor:01 -->
Ocena pracownika w służbie cywilnej? To ustawa, dwa rozporządzenia, urzędowe arkusze i terminy, których łatwo nie dopilnować. A kompetencje często ocenia się… na wyczucie.
<!-- /lektor -->

### Scena 2 — Rozwiązanie (0:12–0:25)

**Na ekranie:** przejście przez środek kompasu do aplikacji. „Wejście dla jury” — kursor klika „Przełożony”, pulpit wyłania się z klikniętego przycisku; samouczek „Dzień dobry, Marta!” wysuwa się do przodu. Na koniec hasła: „podpowiada · pilnuje · decyduje człowiek”.
**Plansza:** „System podpowiada — decyduje człowiek”.

<!-- lektor:02 -->
Kompas Kompetencji prowadzi przełożonego krok po kroku — przez pierwszą ocenę i ocenę okresową. System podpowiada i pilnuje przepisów. Ale ocenę zawsze wybiera człowiek.
<!-- /lektor -->

### Scena 3 — Opis stanowiska i dobór arkusza (0:25–0:37)

**Na ekranie:** ocena Michała Wójcika (krok 1/5). Plik OSP.docx wpada do okna, wiązka skanera odsłania wynik parsowania. Reguła „brak podległych pracowników → Arkusz C” — etykieta „Arkusz C” odlatuje do wskaźnika procesu. Sugestia AI kryterium dodatkowego z uzasadnieniem — kursor klika „Dodaj”.
**Plansza:** „Arkusz B / C — reguła z § 3 rozp. 2016”.

<!-- lektor:03 -->
Ocena okresowa zaczyna się od opisu stanowiska. Wgrywasz plik — i system sam wskazuje arkusz B albo C. Asystent proponuje kryteria dodatkowe, uzasadniając je zadaniami z opisu.
<!-- /lektor -->

### Scena 4 — Model kompetencji i terminy (0:37–0:49)

**Na ekranie:** ocena Agnieszki Kaczmarek, krok 3/5 „Ocena wskaźników”. Lupa przesuwa się po opisach zachowań i zatrzymuje na zaznaczonym; kamera zjeżdża do sugestii systemu („→ 7 pkt”), kursor klika 7 — decyzja przełożonego. Termin sporządzenia oceny wysuwa się z ekranu jak karta z kalendarza.
**Plansza:** „14 kompetencji · 49 wskaźników”.

<!-- lektor:04 -->
Dalej: model kompetencji ministerstwa, czyli opisane zachowania. Zaznaczasz to, co naprawdę widziałeś. System wylicza sugestię, a terminy ustawowe liczy za ciebie.
<!-- /lektor -->

### Scena 5 — Wynik zgodny z przepisami (0:49–1:01)

**Na ekranie:** krok 4/5. Obok rozmytego ekranu wyniku tablica z ośmioma ocenami cząstkowymi i średnią 6,50 (POZYTYWNA). Komunikacja przeskakuje z 7 na 1 (jak tablica odjazdów), średnia spada do 5,75, a na wynik spada stempel NEGATYWNA. Potem prawdziwy ekran aplikacji z tym samym wynikiem.
**Plansza:** „§ 11 rozp. 2016 — liczy kod, nie AI”.

<!-- lektor:05 -->
Wynik liczy kod — dokładnie według rozporządzeń. Średnia ponad pięć i pół, ale jedno kryterium na jeden punkt? Ocena negatywna. Aplikacja wie to od razu.
<!-- /lektor -->

### Scena 6 — Asystent formalny (1:01–1:12)

**Na ekranie:** pytanie o zwolnienie ze służby przygotowawczej „pisze się” w dymku i wskakuje na swoje miejsce w „Asystencie formalnym”; zakreślacz przeciąga po cytacie (art. 36 ust. 8) z dopiskiem „cytat sprawdzony w kodzie”. Pytanie o urlop na żądanie → przeszukanie źródeł bez trafień → odpowiedź „Brak informacji w bazie wiedzy” kręci „nie” jak głową.
**Plansza:** „Zawsze z cytatem · brak w bazie → odmowa”.

<!-- lektor:06 -->
Wątpliwość prawna? Asystent formalny odpowiada tylko na podstawie przepisów, zawsze z cytatem ze źródła. A gdy czegoś nie ma w bazie wiedzy — mówi wprost: nie wiem.
<!-- /lektor -->

### Scena 7 — Asystent rozmowy i PDF (1:12–1:25)

**Na ekranie:** okno „Asystent AI → Rozmowa” wysuwa się z boku; kursor klika „Szkic uzasadnienia”, potem „Wstaw do formularza”; tekst płynnie wyłania się w polu (miękka krawędź przesuwa się z góry na dół), z etykietą „Szkic wygenerowany przez AI — wymaga weryfikacji”. Na koniec strony arkusza PDF rozkładają się jak wachlarz (krok 5/5).
**Plansza:** „AI pisze szkic, nigdy ocenę”.

<!-- lektor:07 -->
Asystent rozmowy przygotuje agendę, informację zwrotną i szkic uzasadnienia. Do formularza trafi on dopiero po twoim kliknięciu. Na koniec — arkusz w PDF, zgodny z urzędowym wzorem.
<!-- /lektor -->

### Scena 8 — Panel kadr i RODO (1:25–1:36)

**Na ekranie:** „Panel HR” (rola: kadry) — po tabeli statusów przesuwa się pasek. Kursor: „Przypomnij” → „Wyślij”, koperta odlatuje, licznik wysłanych przypomnień rośnie. Przy „Treści ocen?” przed ekran wjeżdża arkusz oceny, jego treść zostaje zaczerniona, zamyka się kłódka.
**Plansza:** „Terminy tak — treści ocen nie”.

<!-- lektor:08 -->
Kadry widzą statusy i terminy wszystkich ocen i jednym kliknięciem wysyłają przypomnienie. Treści ocen? Tych nie widzą wcale. Tak działa RODO.
<!-- /lektor -->

### Scena 9 — Wdrożenie i dalszy rozwój (1:36–1:51)

**Na ekranie:** architektura budowana warstwami (przeglądarka, logowanie z rolami, wiele urzędów, logika ocen w kodzie, asystenci AI, model językowy); obok pulpit, który ukośnie przechodzi z jasnego w ciemny motyw (WCAG 2.1 AA). Klocek „Gemini · dziś” zostaje wysunięty, w jego miejsce wsuwa się „polski model · lokalnie”. Plansza końcowa: igła kompasu, hasło, link do prototypu, stopka „Prototyp · dane fikcyjne · HackNation 2026 · głos lektora: ElevenLabs” i informacja „Przy tworzeniu oprogramowania wykorzystano narzędzia AI.”
**Plansza:** „Role · wiele urzędów · WCAG · model lokalny”, na końcu „Głos lektora: ElevenLabs”.

<!-- lektor:09 -->
Role, wiele urzędów, dostępność dla każdego. Dziś — płatny, szybki Gemini. W urzędzie — polski model, uruchomiony lokalnie. Kompas Kompetencji: przepisów pilnuje system, decyzję podejmuje człowiek.
<!-- /lektor -->

---

## 4. Lektor — ElevenLabs

### 4.1. Ustawienia

| Parametr | Wartość | Uzasadnienie |
| :--- | :--- | :--- |
| Model | `eleven_v4` | najnowszy model ElevenLabs („fastest and most emotive”), obsługuje polski — nowszy od wymaganego minimum v3 |
| Głos | `Alice — Clear, Engaging Educator` (`Xb7hH8MSUJpSbSDYk0k2`) | ożywiony głos prezenterski z gotowych głosów ElevenLabs; zmiana w `ELEVENLABS_VOICE_ID` |
| Stabilność / podobieństwo | 0,35 / 0,75 | niższa stabilność = żywsza, mniej monotonna intonacja |
| Generowanie | **jedno żądanie na cały tekst**, ze znacznikami czasu (`/with-timestamps`) | intonacja płynie przez całość jak u żywego lektora; granice scen wyznaczamy z czasów znaków |
| Format | MP3 44,1 kHz, 128 kb/s | wystarczający do montażu |

**Głos polski natywny:** w bibliotece ElevenLabs są polscy lektorzy (np. *Paweł Siwek — Engaging, Warm Radio Host*, `8qCMI2ZZW5ZGwmg0lM1l`), ale **darmowy plan nie pozwala używać głosów z biblioteki przez API** (sprawdzone 22.11.2026: `paid_plan_required`). Po przejściu na płatny plan wystarczy `ELEVENLABS_VOICE_ID=8qCMI2ZZW5ZGwmg0lM1l node docs/video/generate-voiceover.mjs`.

### 4.2. Zasady pisania tekstu dla syntezatora

* **Krótko:** 2 minuty to ok. 230 słów — każda scena 20–35 słów, jedna myśl na zdanie.
* **Żywo:** pytania retoryczne („Wątpliwość prawna?”), zwroty do widza („wgrywasz”, „zaznaczasz”), myślniki i wielokropki — model zmienia na nich intonację i robi pauzy; tak unikamy monotonii.
* Liczby słownie („pięć i osiem dziesiątych”), bez symboli („§”, „art.”) — syntezator czyta je źle.
* Skróty tylko powszechne (PDF, RODO); „OSP” → „opis stanowiska”, „HR” → „kadry”.

### 4.3. Generowanie nagrania

Klucz API jest w `.env.local` (ignorowany przez git) jako `ELEVENLABS_API_KEY`. Skrypt czyta go z pliku i nigdy nie wypisuje.

```bash
node docs/video/generate-voiceover.mjs
```

Wynik: `docs/video/lektor/lektor.mp3` (całość), `docs/video/lektor/czasy.md` (początek i długość każdej sceny), `docs/video/lektor/slowa.json` (czas każdego słowa — do synchronizacji napisów i efektów) oraz czasy w nagłówkach scen w tym pliku (czasy nagrania; w filmie każda kolejna scena jest przesunięta o 0,5 s pauzy, cały film trwa 1:58). Skrypt **zgłasza błąd, jeśli nagranie przekracza 2:00** — wtedy skracamy tekst.

**Limit:** darmowy plan to 10 000 znaków miesięcznie; cały tekst lektora ma ok. 1 500 znaków; po trzech generowaniach w listopadzie 2026 zostało ok. 3 200 znaków na poprawki. Darmowy plan wymaga podania źródła głosu (plansza „Głos lektora: ElevenLabs” w scenie 9) i nie obejmuje użycia komercyjnego.

### 4.4. Montaż filmu (automatyczny)

Film powstaje bez programu do montażu — z aplikacji uruchomionej lokalnie i nagrania lektora:

```bash
npm run emulators                                   # terminal 1
VITE_FIREBASE_USE_EMULATOR=true npm run dev         # terminal 2 (http://localhost:5173)
# Chrome z --remote-debugging-port=9333 (może być --headless=new)
node docs/video/film/capture.mjs                    # kadry → docs/video/film/kadry/ (resetuje dane demo w emulatorze!)
node docs/video/film/render.mjs                     # montaż → docs/video/kompas-kompetencji-film.mp4 (+ .srt)
node docs/video/film/render.mjs --preview 50 70     # opcjonalnie: podgląd klatek w wybranych sekundach
```

* `capture.mjs` przechodzi scenariusz w aplikacji (role jury i konta demo), robi zrzuty 1920×1080 w jasnym motywie (także „przed” i „po” kliknięciu oraz ten sam pulpit w ciemnym motywie), woła prawdziwych asystentów AI i pobiera PDF arkusza (strony renderuje `pdf-to-png.swift`, macOS PDFKit). Dla każdego zrzutu zapisuje położenie elementów, na których dzieje się akcja (`kadry/boxes.json`: przycisk klikany kursorem, cytat, kafelek, okno asystenta…).
* `render.mjs` układa ujęcia według tabeli `PLAN`: każde ujęcie i każdy efekt jest przypięty do **słowa lektora** (czasy słów z `lektor/slowa.json`), więc kliknięcie, stempel czy zakreślenie cytatu pada dokładnie wtedy, gdy lektor o nim mówi. Między scenami dokłada 0,5 s ciszy (oddech dla widza); nagranie tnie w środku faktycznej pauzy lektora (wykrytej przez ffmpeg `silencedetect`), a nie na znaczniku czasu pierwszej litery — ten bywa spóźniony o ok. 0,1 s i cięcie w tym miejscu urywało pierwszą głoskę sceny. `montage.html` rysuje w Chrome każdą klatkę (1920×1080, 30 kl./s), a **ffmpeg** koduje je razem z lektorem do MP4 (H.264 + AAC). Napisy (co do zdania) są wtopione w obraz i zapisane osobno w `kompas-kompetencji-film.srt`.
* Oprawa filmu jest niezależna od `STYLE_GUIDE.md`: ciemna scena, aplikacja w oknie, nad oknem wskaźnik procesu (czyja ocena, który z 5 kroków, arkusz) i plansza sceny. Każda scena ma własny efekt i własne przejście:

| Scena | Efekt | Przejście do sceny |
| :---: | :--- | :--- |
| 1 | igła kompasu ustawia się na północ; źródła spadają na stos na słowa lektora; „na wyczucie” — stos się rozmywa, igła kręci się bez celu | wyjście z czerni |
| 2 | kursor klika „Przełożony”, pulpit wyrasta z klikniętego przycisku; karta samouczka wysuwa się; hasła wyjeżdżają spod linii | koło rozszerzające się ze środka kompasu |
| 3 | plik DOCX wpada do okna, wiązka skanera odsłania wynik parsowania; etykieta „Arkusz C” odlatuje do wskaźnika procesu; kursor dodaje kryterium | przesunięcie w bok |
| 4 | lupa nad opisami zachowań; kamera zjeżdża do sugestii, kursor wybiera 7, odręczny dopisek „decyzja przełożonego”; termin wysuwa się z kartką kalendarza 21 → 15 | wjazd od dołu |
| 5 | tablica ośmiu ocen; „Komunikacja” przeskakuje 7 → 1 jak tablica odjazdów, średnia spada 6,50 → 5,75, stempel NEGATYWNA z wstrząsem | rozmycie |
| 6 | pytanie pisze się w dymku i ląduje na miejscu; zakreślacz na cytacie; przeszukanie źródeł bez trafień, odmowa „kręci głową” | koło od miejsca stempla |
| 7 | kursor: „Szkic uzasadnienia” → AI pisze (połysk) → „Wstaw do formularza”; tekst płynnie wyłania się w polu; strony PDF jak wachlarz | obrót karty |
| 8 | pasek przebiega po statusach; kursor wysyła przypomnienie, koperta leci do licznika (+1); arkusz oceny zostaje zaczerniony, zamyka się kłódka | ukośne cięcie |
| 9 | warstwy architektury spadają jedna po drugiej; pulpit przechodzi ukośnie z jasnego w ciemny; klocek „Gemini” wysuwa się, wsuwa się „polski model lokalnie”; plansza końcowa z kompasem | oddalenie poprzedniej sceny |

* Wymaga `ffmpeg` w PATH (np. `npm i --prefix ~/.local/share/ffmpeg ffmpeg-static` i link do `~/.local/bin/ffmpeg`).
* Po zmianie tekstu lektora: `generate-voiceover.mjs` → `render.mjs` (kadry zostają; jeśli zniknie słowo, do którego przypięty jest efekt, `render.mjs` zgłosi błąd — popraw `PLAN`). Po zmianie aplikacji: `capture.mjs` → `render.mjs`. Podgląd planu: `render.mjs --plan`.

---

## 5. Lista kontrolna przed wysłaniem filmu

* [ ] Długość ≤ 2:00; każda scena pokrywa swój wiersz z sekcji 1.
* [ ] Pokazane: obie ścieżki, decyzja przełożonego, OSP, model kompetencji, wynik, oba asystenty (cytat i odmowa), PDF, panel HR.
* [ ] Odstępstwo od wymogu darmowych narzędzi AI wypowiedziane wprost (scena 9).
* [ ] Napisy zgodne z lektorem; plansza z linkiem do publicznie dostępnego prototypu (§ 6 zadania).
* [ ] Na planszy końcowej: źródło głosu (ElevenLabs) i informacja o wykorzystaniu AI przy tworzeniu oprogramowania.
* [ ] W kadrze wyłącznie dane fikcyjne z „Przywróć dane demo”.
