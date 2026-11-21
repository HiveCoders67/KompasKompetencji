"""
Converts knowledge/sources/model/model-kompetencji.xlsx (MC competency model) into
packages/domain/data/competencies.json — the single source of truth for UI, Firestore seed and RAG index
(docs/02 § 3.1). Standard library only.

Usage: python3 knowledge/scripts/build_competencies.py
"""
import html
import json
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "knowledge" / "sources" / "model" / "model-kompetencji.xlsx"
OUT = ROOT / "packages" / "domain" / "data" / "competencies.json"

# Sheet title (uppercase, as in the model) → stable code used in data.
CODES = {
    "RZETELNOŚĆ": "RZETELNOSC",
    "KOMUNIKACJA": "KOMUNIKACJA",
    "WYKORZYSTYWANIE WIEDZY I DOSKONALENIE ZAWODOWE": "WYKORZYSTYWANIE_WIEDZY",
    "ORGANIZACJA PRACY I ORIENTACJA NA OSIĄGANIE CELÓW": "ORGANIZACJA_PRACY",
    "KREATYWNOŚĆ": "KREATYWNOSC",
    "WSPÓŁPRACA": "WSPOLPRACA",
    "MYŚLENIE ANALITYCZNE": "MYSLENIE_ANALITYCZNE",
    "NEGOCJOWANIE": "NEGOCJOWANIE",
    "WYSTĄPIENIA PUBLICZNE": "WYSTAPIENIA_PUBLICZNE",
    "ORIENTACJA NA KLIENTA/INTERESANTA": "ORIENTACJA_NA_KLIENTA",
    "RADZENIE SOBIE W SYTUACJACH KRYZYSOWYCH": "SYTUACJE_KRYZYSOWE",
    "ZARZĄDZANIE STRATEGICZNE": "ZARZADZANIE_STRATEGICZNE",
    "ZARZĄDZANIE LUDŹMI": "ZARZADZANIE_LUDZMI",
    "PODEJMOWANIE DECYZJI I ODPOWIEDZIALNOŚĆ": "PODEJMOWANIE_DECYZJI",
}

# docs/02 § 1.3 and § 2.2
MANDATORY = {
    "FIRST": ["RZETELNOSC", "WYKORZYSTYWANIE_WIEDZY", "ORGANIZACJA_PRACY", "KOMUNIKACJA", "WSPOLPRACA"],
    "FORM_B": ["ZARZADZANIE_LUDZMI", "PODEJMOWANIE_DECYZJI", "ORGANIZACJA_PRACY", "WSPOLPRACA", "KOMUNIKACJA"],
    "FORM_C": ["WYKORZYSTYWANIE_WIEDZY", "RZETELNOSC", "ORGANIZACJA_PRACY", "WSPOLPRACA", "KOMUNIKACJA"],
}

LEVELS = {"B": 1, "C": 3, "D": 5, "E": 7, "F": 9}
NS = r"(?:\w+:)?"


def text_of(fragment: str) -> str:
    return html.unescape("".join(re.findall(rf"<{NS}t[^>]*>(.*?)</{NS}t>", fragment, re.S)))


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def read_workbook(path: Path):
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        xml = z.read("xl/sharedStrings.xml").decode()
        shared = [text_of(si) for si in re.findall(rf"<{NS}si>(.*?)</{NS}si>", xml, re.S)]
    rels_xml = z.read("xl/_rels/workbook.xml.rels").decode()
    rels = {}
    for rel in re.findall(r"<Relationship [^>]*/>", rels_xml):
        rid = re.search(r'Id="([^"]+)"', rel).group(1)
        target = re.search(r'Target="([^"]+)"', rel).group(1)
        rels[rid] = target.lstrip("/").removeprefix("xl/")
    wb = z.read("xl/workbook.xml").decode()
    sheets = []
    for attrs in re.findall(rf"<{NS}sheet ([^>]*)/?>", wb):
        name = html.unescape(re.search(r'name="([^"]+)"', attrs).group(1))
        rid = re.search(r'r:id="([^"]+)"', attrs).group(1)
        xml = z.read("xl/" + rels[rid]).decode()
        rows = []
        for row in re.findall(rf"<{NS}row[^>]*>(.*?)</{NS}row>", xml, re.S):
            cells = {}
            for cattrs, body in re.findall(rf"<{NS}c ([^>]*?)(?:/>|>(.*?)</{NS}c>)", row, re.S):
                col = re.search(r'r="([A-Z]+)\d+"', cattrs).group(1)
                ctype = re.search(r't="(\w+)"', cattrs)
                v = re.search(rf"<{NS}v>(.*?)</{NS}v>", body or "", re.S)
                if ctype and ctype.group(1) == "s" and v:
                    val = shared[int(v.group(1))]
                elif ctype and ctype.group(1) == "inlineStr":
                    val = text_of(body)
                else:
                    val = html.unescape(v.group(1)) if v else ""
                if val.strip():
                    cells[col] = clean(val)
            rows.append(cells)
        sheets.append((name, rows))
    return sheets


def main():
    sheets = read_workbook(SRC)
    overview = sheets[0][1]
    guidance = [r["A"] for r in overview[2:5] if "A" in r]
    competencies = []
    for _, rows in sheets[1:]:
        title = rows[0]["A"].upper()
        code = CODES[title]
        indicators = []
        for r in rows[2:]:
            if not r.get("A"):
                continue
            n = len(indicators) + 1
            indicators.append(
                {
                    "id": f"{code}_{n}",
                    "label": r["A"],
                    "behaviors": [{"level": lvl, "description": r[col]} for col, lvl in LEVELS.items()],
                }
            )
        name = rows[0]["A"]
        name = name[0] + name[1:].lower()
        name = name.replace("/interesanta", "/interesanta")
        competencies.append(
            {
                "code": code,
                "name": name,
                "mandatoryFor": [f for f, codes in MANDATORY.items() if code in codes],
                "indicators": indicators,
            }
        )
    total = sum(len(c["indicators"]) for c in competencies)
    assert len(competencies) == 14, len(competencies)
    assert total == 49, total
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {"source": "knowledge/sources/model/model-kompetencji.xlsx", "guidance": guidance, "competencies": competencies},
            ensure_ascii=False,
            indent=2,
        )
        + "\n"
    )
    print(f"{len(competencies)} kompetencji, {total} wskaźników → {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
