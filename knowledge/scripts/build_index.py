"""
Builds the static RAG index (functions/src/rag/index.json) from knowledge/sources/ (docs/03 § 2.A „Indeks RAG”).

Texts are NOT summarised or rewritten. The script only removes PDF extraction artefacts (page headers,
hyphenation, editorial footnotes of the uniform text) and splits documents into units with metadata
{ source, unit, page }, from which citations are built:
  - acts (ustawa, rozporządzenia)  → article / paragraph → ustęp (points stay inside their ustęp),
  - annex no. 1 to both regulations → one fragment per criterion / element,
  - form templates (DOCX)           → part of the form + every footnote,
  - KPRM guides                     → section × printed page,
  - MC competency model             → competency × indicator (from packages/domain/data/competencies.json).

Requires: python3 with `pypdf` (pip install pypdf). Usage: python3 knowledge/scripts/build_index.py
"""
import html
import json
import re
import zipfile
from pathlib import Path

import pypdf

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "knowledge" / "sources"
OUT = ROOT / "functions" / "src" / "rag" / "index.json"
COMPETENCIES = ROOT / "packages" / "domain" / "data" / "competencies.json"

SOURCES = {
    "USTAWA": "Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (t.j. Dz. U. z 2026 r. poz. 590)",
    "ROZP_2016": "Rozporządzenie PRM z dnia 4 kwietnia 2016 r. w sprawie ocen okresowych (Dz. U. poz. 470)",
    "ROZP_2015": "Rozporządzenie PRM z dnia 23 lipca 2015 r. w sprawie pierwszej oceny (Dz. U. poz. 1144)",
    "PORADNIK_OO": "Poradnik KPRM – Oceny okresowe w służbie cywilnej (2016)",
    "PORADNIK_PO": "Poradnik KPRM – Pierwsza ocena w służbie cywilnej (2016)",
    "MODEL": "Model kompetencji MC (14 kompetencji, 49 wskaźników)",
}

# Act metadata from the Sejm ELI API (https://api.sejm.gov.pl/eli/acts/…), fetched 2026-11-21.
METADATA = {
    "USTAWA": "Ustawa z dnia 21 listopada 2008 r. o służbie cywilnej (Dz. U. 2008 nr 227 poz. 1505), data aktu 2008-11-21, "
    "wejście w życie 2009-03-24. Tekst jednolity: obwieszczenie Marszałka Sejmu RP z dnia 17 kwietnia 2026 r. "
    "(Dz. U. z 2026 r. poz. 590), status: obowiązujący.",
    "ROZP_2016": "Rozporządzenie Prezesa Rady Ministrów z dnia 4 kwietnia 2016 r. w sprawie warunków i sposobu przeprowadzania "
    "ocen okresowych urzędników służby cywilnej i pracowników służby cywilnej (Dz. U. z 2016 r. poz. 470), data aktu "
    "2016-04-04, ogłoszono 2016-04-08, wejście w życie 2016-04-23, status: obowiązujący. Wydane na podstawie art. 82 ustawy o służbie cywilnej.",
    "ROZP_2015": "Rozporządzenie Prezesa Rady Ministrów z dnia 23 lipca 2015 r. w sprawie szczegółowych warunków i sposobu "
    "dokonywania pierwszej oceny w służbie cywilnej (Dz. U. z 2015 r. poz. 1144), data aktu 2015-07-23, ogłoszono "
    "2015-08-12, wejście w życie 2015-08-27, status: obowiązujący. Wydane na podstawie art. 38 ust. 4 ustawy o służbie cywilnej.",
}

PATHS = {"USTAWA": "BOTH", "ROZP_2016": "PERIODIC", "ROZP_2015": "FIRST", "PORADNIK_OO": "PERIODIC", "PORADNIK_PO": "FIRST", "MODEL": "BOTH"}
MAX = 1300
chunks = []


def add(source, unit, page, heading, text):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) < 25:
        return
    chunks.append(
        {
            "id": f"{source}_{len(chunks)}",
            "source": source,
            "path": PATHS[source],
            "unit": unit,
            "page": page,
            "heading": heading,
            "text": text,
        }
    )


def join_lines(lines):
    out = ""
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        if re.search(r"\w-$", out) and ln[:1].islower():
            out = out[:-1] + ln
        elif re.search(r"\w -$", out) and ln[:1].islower():
            out = out[:-2] + ln
        else:
            out = f"{out} {ln}" if out else ln
    return re.sub(r"\s+", " ", out).strip()


def split_long(text, limit=MAX):
    if len(text) <= limit * 1.3:
        return [text]
    parts = re.split(r"(?<=[;.:]) (?=\d+[a-z]?\) |[a-z]\) |[A-ZĄĆĘŁŃÓŚŹŻ])", text)
    out, cur = [], ""
    for p in parts:
        if cur and len(cur) + len(p) > limit:
            out.append(cur)
            cur = ""
        cur = f"{cur} {p}".strip()
    if cur:
        out.append(cur)
    return out


def pdf_pages(path):
    return [p.extract_text() or "" for p in pypdf.PdfReader(str(path)).pages]


# ------------------------------------------------------------------ acts
FOOTNOTE = re.compile(
    r"^\s*\d+\)\s?(W brzmieniu|Dodan|Uchylon|Zmian|Ze zmian|Utracił|Przepis|Zmienion|Niniejsz|Oznaczenie|Wszed|Wejdzie|"
    r"Z dniem|Stwierdzon|Ustawa|Zgodnie|Część|Por\.|Na podstawie|Uznany|Traci|Art\. \d+)"
)
DZU_HEADER = re.compile(r"^\s*Dziennik Ustaw\s*–\s*(\d+)\s*–\s*Poz\. \d+")


def act_lines(pages, start_marker, stop=None):
    """Lines of the act body with their printed page number; footnotes and headers removed."""
    lines = []
    for i, page in enumerate(pages):
        page_no = i + 1
        for ln in page.split("\n"):
            m = DZU_HEADER.match(ln)
            if m:
                page_no = int(m.group(1))
                continue
            if FOOTNOTE.match(ln):
                break
            lines.append((ln.rstrip(), page_no))
    start = next(i for i, (l, _) in enumerate(lines) if l.strip().startswith(start_marker))
    lines = lines[start:]
    if stop:
        end = next((i for i, (l, _) in enumerate(lines) if stop.match(l.strip())), len(lines))
        lines = lines[:end]
    return lines


def build_act(source, pages, unit_word, start_marker, stop=None):
    lines = act_lines(pages, start_marker, stop)
    unit_re = re.compile(r"^(Art\.|§) (\d+[a-z]*)\.\s*(.*)$")
    chapter = ""
    units = []  # [nr, chapter, [(line, page)]]
    i = 0
    while i < len(lines):
        ln, pg = lines[i]
        s = ln.strip()
        m_ch = re.match(r"^Rozdział (\d+[a-z]?)\s*$", s)
        if m_ch and i + 1 < len(lines):
            chapter = f"Rozdział {m_ch.group(1)}. {lines[i + 1][0].strip()}"
            i += 2
            continue
        m = unit_re.match(s)
        if m:
            units.append([m.group(2), chapter, [(m.group(3), pg)]])
        elif units:
            units[-1][2].append((s, pg))
        i += 1
    label = "art." if unit_word == "Art." else "§"
    for nr, chap, body in units:
        ust, cur_no, cur, cur_pg = [], None, [], body[0][1]
        for ln, pg in body:
            m = re.match(r"^(\d+[a-z]*)\. (.*)$", ln)
            if m and (cur_no is None or m.group(1) != cur_no):
                if cur:
                    ust.append((cur_no, join_lines(cur), cur_pg))
                cur_no, cur, cur_pg = m.group(1), [f"{m.group(1)}. {m.group(2)}"], pg
            else:
                cur.append(ln)
        if cur:
            ust.append((cur_no, join_lines(cur), cur_pg))
        ust = [u for u in ust if u[1] and u[1] not in ("(uchylony)",) and not re.fullmatch(r"\d+[a-z]*\. \(uchylony\)", u[1])]
        if not ust:
            continue
        head = f"{unit_word} {nr}."
        if len(ust) == 1 and ust[0][0] is None:
            for part in split_long(ust[0][1]):
                add(source, f"{label} {nr}", ust[0][2], chap, f"{head} {part}")
            continue
        for no, text, pg in ust:
            unit = f"{label} {nr} ust. {no}" if no else f"{label} {nr}"
            for part in split_long(text):
                add(source, unit, pg, chap, f"{head} {part}" if no is None or no == ust[0][0] else f"[{head}] {part}")


def build_annex1(source, pages, kind):
    """Annex no. 1: criteria (2016) / elements (2015) with descriptions."""
    text = "\n".join(pages)
    start = text.index("Załącznik nr 1", text.index("Załączniki"))
    end = text.index("Załącznik nr 2", start)
    lines = []
    for ln in text[start:end].split("\n"):
        s = ln.strip()
        if not s or DZU_HEADER.match(s) or re.match(r"^(Załącznik|Załączniki|z dnia|\(poz|do rozporządzenia|Prezesa Rady|KRYTERIUM|ELEMENT|WYKAZ|OPISY|WyKAZ|\d+$)", s, re.I):
            continue
        lines.append(s)
    items = []
    for s in lines:
        m = re.match(r"^(\d+)\. ([A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ /,]+?)(?: (−.*))?$", s)
        if m:
            items.append([m.group(1), m.group(2).strip(), [m.group(3)] if m.group(3) else []])
        elif items and not items[-1][2] and re.fullmatch(r"[A-ZĄĆĘŁŃÓŚŹŻ /,]+(?: −.*)?", s):
            name, _, rest = s.partition(" −")
            items[-1][1] += " " + name.strip()
            if rest:
                items[-1][2].append("−" + rest)
        elif items:
            items[-1][2].append(s)
    for nr, name, desc in items:
        body = join_lines(desc)
        add(source, f"załącznik nr 1, {kind} {nr}", None, "Załącznik nr 1", f"{nr}. {name} — {body}")


# ------------------------------------------------------------------ forms (DOCX)
def docx_paragraphs(xml):
    out = []
    for p in re.findall(r"<w:p[ >].*?</w:p>", xml, re.S):
        t = "".join(html.unescape(m) for m in re.findall(r"<w:t(?:\s[^>]*)?>(.*?)</w:t>", p, re.S))
        t = re.sub(r"\s+", " ", t).strip()
        if t:
            out.append(t)
    return out


def build_form(path, source, annex, form_name):
    z = zipfile.ZipFile(path)
    body = docx_paragraphs(z.read("word/document.xml").decode())
    part, buf = "", []

    def flush():
        if buf:
            unit = f"załącznik nr {annex} ({form_name})" + (f", {part.lower()}" if part else "")
            pieces, cur = [], ""
            for t in buf:
                if cur and len(cur) + len(t) > MAX:
                    pieces.append(cur)
                    cur = ""
                cur = f"{cur} · {t}" if cur else t
            if cur:
                pieces.append(cur)
            for piece in pieces:
                add(source, unit, None, f"Wzór: {form_name}", piece)

    for t in body:
        m = re.match(r"^(CZĘŚĆ [IVX]+|[IVX]+\. [A-ZĄĆĘŁŃÓŚŹŻ ]+)$", t)
        if m:
            flush()
            part, buf = m.group(1), []
            continue
        buf.append(t)
    flush()
    if "word/footnotes.xml" in z.namelist():
        xml = z.read("word/footnotes.xml").decode()
        n = 0
        for fid, fn in re.findall(r'<w:footnote [^>]*w:id="(-?\d+)"[^>]*>(.*?)</w:footnote>', xml, re.S):
            if int(fid) <= 0:
                continue
            text = re.sub(r"^\)\s*", "", " ".join(docx_paragraphs(fn)))
            if not text:
                continue
            n += 1
            add(source, f"załącznik nr {annex} ({form_name}), przypis {n}", None, f"Wzór: {form_name} — przypisy", text)


# ------------------------------------------------------------------ guides
def build_guide(path, source):
    pages = pdf_pages(path)
    toc = {}
    toc_pages = set()
    for pi, page in enumerate(pages[:4]):
        for m in re.finditer(r"^(\d+(?:\.\d+)*)\. (.+?)\s*\.{3,}", page, re.M):
            toc[m.group(1)] = re.sub(r"\s+", " ", m.group(2)).strip()
            toc_pages.add(pi)
    section, heading, buf, buf_pages = "", "", [], []

    def flush():
        nonlocal buf, buf_pages
        text = join_lines(buf)
        if len(text) > 80:
            for part in split_long(text):
                add(source, f"rozdz. {section}" if section else None, buf_pages[0], heading, part)
        buf, buf_pages = [], []

    for pi, page in enumerate(pages):
        if pi == 0 or pi in toc_pages:
            continue
        lines = page.split("\n")
        nonempty = [l.strip() for l in lines if l.strip()]
        if not nonempty:
            continue
        page_no = pi + 1
        if re.fullmatch(r"\d+", nonempty[0]):
            page_no = int(nonempty[0])
            lines = lines[lines.index(next(l for l in lines if l.strip())) + 1 :]
        for ln in lines:
            s = ln.strip()
            m = re.match(r"^(\d+(?:\.\d+)*)\.\s+(.+)$", s)
            if m and m.group(1) in toc and len(s) < 160 and m.group(1) != section:
                flush()
                section, heading = m.group(1), toc[m.group(1)]
                continue
            if not s:
                if sum(len(x) for x in buf) > MAX:
                    flush()
                continue
            # chunks never span pages: the citation names a single page
            if buf_pages and buf_pages[0] != page_no:
                flush()
            if not buf:
                buf_pages = [page_no]
            buf.append(s)
    flush()


# ------------------------------------------------------------------ model
def build_model():
    data = json.loads(COMPETENCIES.read_text())
    names = {1: "znacznie poniżej oczekiwań", 3: "poniżej oczekiwań", 5: "na poziomie oczekiwań", 7: "powyżej oczekiwań", 9: "znacznie powyżej oczekiwań"}
    add("MODEL", "wskazówki stosowania modelu", None, "Model kompetencji", " ".join(data["guidance"]))
    for c in data["competencies"]:
        for n, ind in enumerate(c["indicators"], 1):
            levels = " ".join(f"{names[b['level']].capitalize()} ({b['level']} pkt): {b['description']}" for b in ind["behaviors"])
            add("MODEL", f"{c['name']}, wskaźnik {n}", None, c["name"], f"Kompetencja: {c['name']}. Wskaźnik: {ind['label']} {levels}")


def main():
    for source, text in METADATA.items():
        add(source, "metryka aktu", None, "Metryka aktu prawnego (ISAP/ELI)", text)
    ustawa = pdf_pages(SRC / "legal" / "ustawa-o-sluzbie-cywilnej-tj-2026-poz-590.pdf")
    build_act("USTAWA", ustawa, "Art.", "USTAWA")
    r16 = pdf_pages(SRC / "legal" / "rozporzadzenie-2016-oceny-okresowe.pdf")
    build_act("ROZP_2016", r16, "§", "Na podstawie", re.compile(r"^Prezes Rady Ministrów:"))
    build_annex1("ROZP_2016", r16, "kryterium")
    r15 = pdf_pages(SRC / "legal" / "rozporzadzenie-2015-pierwsza-ocena.pdf")
    build_act("ROZP_2015", r15, "§", "Na podstawie", re.compile(r"^Prezes Rady Ministrów:"))
    build_annex1("ROZP_2015", r15, "element")
    build_form(SRC / "forms" / "arkusz-b-ocena-okresowa.docx", "ROZP_2016", 3, "arkusz B")
    build_form(SRC / "forms" / "arkusz-c-ocena-okresowa.docx", "ROZP_2016", 4, "arkusz C")
    build_form(SRC / "forms" / "arkusz-pierwszej-oceny.docx", "ROZP_2015", 2, "arkusz pierwszej oceny")
    build_guide(SRC / "guides" / "poradnik-kprm-oceny-okresowe-2016.pdf", "PORADNIK_OO")
    build_guide(SRC / "guides" / "poradnik-kprm-pierwsza-ocena-2016.pdf", "PORADNIK_PO")
    build_model()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"sources": SOURCES, "chunks": chunks}, ensure_ascii=False, indent=0) + "\n")
    by = {}
    for c in chunks:
        by[c["source"]] = by.get(c["source"], 0) + 1
    print(f"{len(chunks)} fragmentów → {OUT.relative_to(ROOT)}", by)


if __name__ == "__main__":
    main()
