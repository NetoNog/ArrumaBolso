"""Builds the ArrumaBolso logo masters (SVG) from the approved concept A.

Usage: python design/logo/build_brand.py <inter-variable.woff2>
Requires: fonttools + brotli (Inter is OFL-licensed, outlines are embedded as paths).
"""
from __future__ import annotations

import sys
from pathlib import Path

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

OUT = Path(__file__).parent / "final"

INK = "#0F172A"
BLUE = "#2563EB"
WHITE = "#FFFFFF"

# --- Symbol: pocket (U with flat, rounded base) + three ascending bars ------------------
# Grid unit = 4. Pocket stroke 22, bars 26 wide with 10 gaps, square-ish corners (r5).
SYMBOL_PATHS = [
    "M40 96 H62 V164 A30 30 0 0 0 92 194 H164 A30 30 0 0 0 194 164 V96 H216 V164 "
    "A52 52 0 0 1 164 216 H92 A52 52 0 0 1 40 164 Z",
]
SYMBOL_BARS = [(79, 108, 62), (115, 76, 94), (151, 40, 130)]  # x, y, height

# Small-size cut (<= 32 px): heavier pocket, two wide bars, bigger gaps.
SMALL_PATHS = [
    "M32 92 H62 V160 A28 28 0 0 0 90 188 H166 A28 28 0 0 0 194 160 V92 H224 V160 "
    "A58 58 0 0 1 166 218 H90 A58 58 0 0 1 32 160 Z",
]
SMALL_BARS = [(84, 104, 64, 38), (134, 38, 130, 38)]  # x, y, height, width


def rect_path(x: float, y: float, w: float, h: float, r: float) -> str:
    return (
        f"M{x + r} {y} H{x + w - r} A{r} {r} 0 0 1 {x + w} {y + r} V{y + h - r} "
        f"A{r} {r} 0 0 1 {x + w - r} {y + h} H{x + r} A{r} {r} 0 0 1 {x} {y + h - r} "
        f"V{y + r} A{r} {r} 0 0 1 {x + r} {y} Z"
    )


def symbol_d(small: bool = False) -> str:
    if small:
        bars = [rect_path(x, y, w, h, 6) for x, y, h, w in SMALL_BARS]
        return " ".join(SMALL_PATHS + bars)
    bars = [rect_path(x, y, 26, h, 5) for x, y, h in SYMBOL_BARS]
    return " ".join(SYMBOL_PATHS + bars)


# --- Wordmark from Inter Bold outlines ------------------------------------------------
def load_inter(path: str) -> TTFont:
    font = TTFont(path)
    axes = {axis.axisTag: axis for axis in font["fvar"].axes}
    location = {"wght": 700}
    if "opsz" in axes:
        location["opsz"] = axes["opsz"].maxValue
    return instantiateVariableFont(font, location)


def text_paths(font: TTFont, text: str, size: float, x: float, baseline: float, tracking: float):
    """Returns [(char, d, advance_end_x)] with glyph outlines placed on the baseline."""
    upm = font["head"].unitsPerEm
    scale = size / upm
    cmap = font.getBestCmap()
    glyphs = font.getGlyphSet()
    hmtx = font["hmtx"]
    kern = kerning_table(font)
    out = []
    cursor = x
    previous = None
    for char in text:
        name = cmap[ord(char)]
        if previous is not None:
            cursor += kern.get((previous, name), 0) * scale
        pen = SVGPathPen(glyphs)
        glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, cursor, baseline)))
        cursor += hmtx[name][0] * scale + tracking
        out.append((char, pen.getCommands(), cursor))
        previous = name
    return out


def kerning_table(font: TTFont) -> dict[tuple[str, str], int]:
    """Pair kerning from GPOS PairPos format 1 (enough for this word)."""
    pairs: dict[tuple[str, str], int] = {}
    if "GPOS" not in font:
        return pairs
    for lookup in font["GPOS"].table.LookupList.Lookup:
        for sub in lookup.SubTable:
            sub = getattr(sub, "ExtSubTable", sub)
            if getattr(sub, "LookupType", None) != 2 or sub.Format != 1:
                continue
            for first, pairset in zip(sub.Coverage.glyphs, sub.PairSet):
                for record in pairset.PairValueRecord:
                    value = getattr(record.Value1, "XAdvance", 0) or 0
                    pairs.setdefault((first, record.SecondGlyph), value)
    return pairs


def svg(view_w: float, view_h: float, body: str, title: str = "ArrumaBolso") -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {view_w:g} {view_h:g}" role="img">'
        f"<title>{title}</title>{body}</svg>\n"
    )


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    OUT.mkdir(parents=True, exist_ok=True)
    font = load_inter(sys.argv[1])

    full = symbol_d()
    small = symbol_d(small=True)
    for name, d in [("symbol", full), ("symbol-small", small)]:
        (OUT / f"{name}.svg").write_text(svg(256, 256, f'<path fill="{BLUE}" fill-rule="evenodd" d="{d}"/>'), "utf-8")
        (OUT / f"{name}-black.svg").write_text(svg(256, 256, f'<path fill="#000" fill-rule="evenodd" d="{d}"/>'), "utf-8")

    # Wordmark: cap height 96 → Inter cap height ≈ 0.727 em → size 132. Tracking −2.5%.
    size, baseline = 132.0, 176.0
    tracking = -size * 0.025
    glyphs = text_paths(font, "ArrumaBolso", size, 0, baseline, tracking)
    arruma = " ".join(d for char, d, _ in glyphs[:6])
    bolso = " ".join(d for char, d, _ in glyphs[6:])
    word_w = glyphs[-1][2] - tracking

    def wordmark(ink: str, accent: str, dx: float) -> str:
        return (
            f'<g transform="translate({dx:.2f} 0)"><path fill="{ink}" d="{arruma}"/>'
            f'<path fill="{accent}" d="{bolso}"/></g>'
        )

    (OUT / "wordmark.svg").write_text(svg(word_w, 256, wordmark(INK, BLUE, 0)), "utf-8")

    gap = 56  # ≈ one bar-and-gap module ×1.5: the clear space between symbol and word
    sym_right = 216
    lock_w = sym_right + gap + word_w
    variants = {
        "lockup-horizontal": (INK, BLUE, BLUE),
        "lockup-horizontal-black": ("#000", "#000", "#000"),
        "lockup-horizontal-white": (WHITE, WHITE, WHITE),
        "lockup-horizontal-on-dark": (WHITE, "#60A5FA", "#60A5FA"),
    }
    for name, (ink, accent, mark) in variants.items():
        body = (
            f'<g transform="translate(-40 0)"><path fill="{mark}" fill-rule="evenodd" d="{full}"/></g>'
            + wordmark(ink, accent, sym_right - 40 + gap)
        )
        (OUT / f"{name}.svg").write_text(svg(lock_w - 40, 256, body), "utf-8")

    # Stacked: symbol centred above the word.
    stack_w = max(word_w, 256)
    stack_body = (
        f'<g transform="translate({(stack_w - 256) / 2:.2f} 0)"><path fill="{BLUE}" fill-rule="evenodd" d="{full}"/></g>'
        f'<g transform="translate(0 196)">{wordmark(INK, BLUE, (stack_w - word_w) / 2)}</g>'
    )
    (OUT / "lockup-stacked.svg").write_text(svg(stack_w, 452, stack_body), "utf-8")

    # App tile: white symbol on a blue rounded square.
    tile = (
        f'<rect width="256" height="256" rx="56" fill="{BLUE}"/>'
        f'<g transform="translate(38.4 38.4) scale(0.7)"><path fill="{WHITE}" fill-rule="evenodd" d="{full}"/></g>'
    )
    (OUT / "app-icon.svg").write_text(svg(256, 256, tile), "utf-8")
    small_tile = (
        f'<rect width="256" height="256" rx="56" fill="{BLUE}"/>'
        f'<g transform="translate(25.6 25.6) scale(0.8)"><path fill="{WHITE}" fill-rule="evenodd" d="{small}"/></g>'
    )
    (OUT / "favicon.svg").write_text(svg(256, 256, small_tile), "utf-8")

    # Shared path data for the React component.
    (OUT / "paths.json").write_text(
        '{"symbol": "%s", "symbolSmall": "%s", "arruma": "%s", "bolso": "%s", "wordWidth": %.2f}\n'
        % (full, small, arruma, bolso, word_w),
        "utf-8",
    )
    print("wrote", ", ".join(sorted(p.name for p in OUT.iterdir())))


if __name__ == "__main__":
    main()
