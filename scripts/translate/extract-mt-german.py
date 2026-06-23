#!/usr/bin/env python
# One-time raw generator: extract the public-domain German *Der Mensch und die Technik*
# (Vordenker 2009 digital edition of Beck 1931) from raw/spengler_mensch-technik.pdf into a clean,
# readable, line-paragraphs German source: raw/Mensch_und_Technik_DE.txt.
#
# Char-level font filtering (the robust method): the body is TimesNewRomanPS 12pt; the rotated
# "studienTEXT" watermark is Helvetica and the running header is ArialMT (both dropped); bold 14pt
# numbers are section headings (§N); 10pt page-bottom Times lines are Spengler's footnotes. Keeps his
# {N} original-1931-page markers and reflows paragraphs by vertical gap, de-hyphenating line-wraps
# (suspended hyphens like "Pflanzen- und" preserved). Requires pdfplumber.
# Run once: python scripts/translate/extract-mt-german.py
import re
from collections import defaultdict
import pdfplumber

SRC = "raw/spengler_mensch-technik.pdf"
OUT = "raw/Mensch_und_Technik_DE.txt"
PARTS = [
    "DIE TECHNIK ALS TAKTIK DES LEBENS",
    "PFLANZENFRESSER UND RAUBTIERE",
    "DIE ENTSTEHUNG DES MENSCHEN: HAND UND WERKZEUG",
    "DIE ZWEITE STUFE: SPRECHEN UND UNTERNEHMEN",
    "DER AUSGANG: AUFSTIEG UND ENDE DER MASCHINENKULTUR",
]
SUSPENDED = {"und", "oder", "bis", "noch", "wie"}  # keep "Pflanzen- und" suspended hyphens

def norm(s):
    return re.sub(r"[ \t]+", " ", s).strip()

def part_header(s):
    s2 = norm(s).rstrip("-")
    for p in PARTS:
        if s2 == p or (len(s2) > 14 and p.startswith(s2)):
            return p
    return None

# Spengler's own footnotes are cross-references to the Decline + the Uexküll citation. Everything else
# in the 10pt band is the 2009 Vordenker editor's apparatus (Wikipedia glosses) — NOT Spengler's; dropped.
SPENGLER_FN = re.compile(r"Abendl|Untergang des Abendl|Uexk", re.I)

def page_lines(page):
    """Return body/heading lines (Times body + Arial-Bold headers), plus Spengler's footnotes."""
    L = defaultdict(list)
    for c in page.chars:
        fn = c["fontname"]
        if "Times" in fn or fn.endswith("Arial-BoldMT"):   # body+sections (Times) and chapter headers (Arial-Bold)
            L[round(c["top"])].append(c)
    out, foot = [], []
    for top in sorted(L):
        cs = sorted(L[top], key=lambda c: c["x0"])
        txt = norm("".join(c["text"] for c in cs))
        if not txt or "...." in txt:        # blank or TOC leader
            continue
        size = sorted(c["size"] for c in cs)[len(cs) // 2]
        bold = any("Bold" in c["fontname"] for c in cs)
        arial = all("Arial" in c["fontname"] for c in cs)
        if arial:                            # a sans-serif heading: keep only the 5 chapter headers
            if part_header(txt):
                out.append({"text": txt, "size": size, "bold": True, "top": top, "head": True})
            continue                         # else: title / TOC heading — drop
        if size <= 11:                       # footnote band (mix of Spengler + editorial)
            clean = re.sub(r"^[\d*]\s*", "", txt)
            if SPENGLER_FN.search(clean):
                foot.append(clean)
            continue
        out.append({"text": txt, "size": size, "bold": bold, "top": top, "head": False})
    return out, foot

def main():
    pdf = pdfplumber.open(SRC)
    chapters = []                            # (title, [para|"§N"])
    title, paras, buf = "VORWORT", [], []
    footnotes = defaultdict(list)            # title -> [footnote strings]
    seen_part = False
    prev_top = None

    def flush():
        if buf:
            paras.append(dehyphen(" ".join(buf)))
            buf.clear()

    def dehyphen(s):
        # join "wort-\nteil" → "wortteil" unless the next word is a suspended-hyphen conjunction
        def repl(m):
            nxt = m.group(2)
            return m.group(0) if nxt in SUSPENDED else m.group(1) + nxt
        s = re.sub(r"([A-Za-zÄÖÜäöüß])-\s+([a-zäöüß]+)", repl, s)
        return norm(s)

    for page in pdf.pages:
        lines, foot = page_lines(page)
        for fn in foot:
            footnotes[title].append(fn)
        new_page = True
        for ln in lines:
            s = ln["text"]
            ph = part_header(s)
            if ph:
                flush()
                if seen_part or paras:
                    chapters.append((title, paras))
                title, paras = ph, []
                seen_part = True
                prev_top = None
                continue
            if ln["bold"] and ln["size"] >= 13 and re.fullmatch(r"\d{1,2}", s):
                flush()
                paras.append(f"§{int(s)}")
                prev_top = None
                continue
            # paragraph break on a vertical gap within a page
            if prev_top is not None and not new_page and (ln["top"] - prev_top) > 17:
                flush()
            buf.append(s)
            prev_top = ln["top"]
            new_page = False
    flush()
    chapters.append((title, paras))
    pdf.close()

    head = [
        "# Der Mensch und die Technik — Oswald Spengler (C. H. Beck, München 1931; Vordenker 2009 digital ed.)",
        "# Public domain (Spengler d. 1936). Extracted by scripts/translate/extract-mt-german.py.",
        "# One paragraph per line. §N = Spengler's section number. {N} = original 1931 page. "
        "Sperrung emphasis kept as the source's own letter-spacing. — FN: = Spengler's footnotes.",
        "",
    ]
    lines = list(head)
    for t, ps in chapters:
        lines += ["", f"== {t} =="]
        lines += ps
        for fn in footnotes.get(t, []):
            lines.append(f"— FN: {fn}")
    text = "\n".join(lines) + "\n"
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {OUT}: {len(chapters)} sections, ~{len(text.split())} words")
    for t, ps in chapters:
        nfn = len(footnotes.get(t, []))
        print(f"  {t[:46]:46} {sum(1 for p in ps if not p.startswith('§')):2} paras  {nfn} fn")

if __name__ == "__main__":
    main()
