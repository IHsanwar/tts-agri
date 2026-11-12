from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.core.errors import ValidationError

GRID_MAX = 20
GRID_MIN = 5
MAX_CELL = 400
ALLOWED_GRID_RE = re.compile(r"^[A-Z#]+$")


@dataclass
class Entry:
    entry_id: str
    number: int
    row: int
    col: int
    direction: str
    answer: str
    clue_en: str
    clue_id: str
    cells: list[tuple[int, int]] = field(default_factory=list)


@dataclass
class ParsedPuzzle:
    schema_version: int
    version: str
    title: str
    language: str
    grid: list[str]
    entries: list[Entry]
    cell_numbers: dict[tuple[int, int], int] = field(default_factory=dict)

    @property
    def rows(self) -> int:
        return len(self.grid)

    @property
    def cols(self) -> int:
        return len(self.grid[0]) if self.grid else 0

    def entry_by_id(self, entry_id: str) -> Entry | None:
        for e in self.entries:
            if e.entry_id == entry_id:
                return e
        return None


def validate_puzzle(content: dict) -> tuple[list[str], list[str]]:
    """Return (errors, warnings). Errors block publishing."""
    errors: list[str] = []
    warnings: list[str] = []

    if not isinstance(content, dict):
        return ["Konten puzzle bukan objek JSON."], warnings

    schema_version = content.get("schema_version")
    if schema_version != 1:
        errors.append("schema_version harus 1.")

    version = content.get("version")
    if not isinstance(version, str) or not re.match(r"^[a-z0-9-]{1,60}$", version or "", re.I):
        errors.append("version harus slug 1-60 karakter (huruf, angka, strip).")

    title = content.get("title")
    if not isinstance(title, str) or not (1 <= len(title) <= 120):
        errors.append("title harus 1-120 karakter.")

    language = content.get("language", "en")
    if not isinstance(language, str) or not (1 <= len(language) <= 10):
        errors.append("language harus 1-10 karakter.")

    grid = content.get("grid")
    if not isinstance(grid, list) or not grid:
        errors.append("grid harus array string non-kosong.")
        return errors, warnings

    if not all(isinstance(r, str) for r in grid):
        errors.append("Setiap baris grid harus string.")
        return errors, warnings

    cols = len(grid[0])
    if cols < GRID_MIN or cols > GRID_MAX:
        errors.append(f"Lebar grid harus {GRID_MIN}-{GRID_MAX}.")
    rows = len(grid)
    if rows < GRID_MIN or rows > GRID_MAX:
        errors.append(f"Tinggi grid harus {GRID_MIN}-{GRID_MAX}.")
    if rows * cols > MAX_CELL:
        errors.append("Total cell melebihi 400.")
    if not all(len(r) == cols for r in grid):
        errors.append("Semua baris grid harus sama panjang.")
    for r in grid:
        if not ALLOWED_GRID_RE.match(r):
            errors.append("Grid hanya boleh huruf A-Z dan '#' untuk blok.")
            break

    entries = content.get("entries")
    if not isinstance(entries, list) or not entries:
        errors.append("entries harus array non-kosong.")
        return errors, warnings

    has_across = has_down = False
    seen_ids: set[str] = set()
    seen_starts: set[tuple[int, int, str]] = set()
    white_cells: set[tuple[int, int]] = set()

    for i, raw in enumerate(entries):
        prefix = f"entry[{i}]"
        if not isinstance(raw, dict):
            errors.append(f"{prefix} bukan objek.")
            continue
        eid = raw.get("id")
        if not isinstance(eid, str) or not (1 <= len(eid) <= 80):
            errors.append(f"{prefix}.id harus 1-80 karakter.")
            continue
        if eid in seen_ids:
            errors.append(f"{prefix}.id '{eid}' duplikat.")
            continue
        seen_ids.add(eid)

        row = raw.get("row")
        col = raw.get("col")
        if not isinstance(row, int) or not isinstance(col, int):
            errors.append(f"{prefix}.row/col harus integer.")
            continue
        direction = raw.get("direction")
        if direction not in ("across", "down"):
            errors.append(f"{prefix}.direction harus 'across' atau 'down'.")
            continue
        if direction == "across":
            has_across = True
        else:
            has_down = True
        key = (row, col, direction)
        if key in seen_starts:
            errors.append(f"{prefix} duplikat posisi/arah dengan entry lain.")
            continue
        seen_starts.add(key)

        answer = raw.get("answer")
        if not isinstance(answer, str) or not re.match(r"^[A-Z]{2,}$", answer or ""):
            errors.append(f"{prefix}.answer harus A-Z minimal 2 huruf.")
            continue

        clue_en = raw.get("clue_en")
        clue_id = raw.get("clue_id")
        if not isinstance(clue_en, str) or not (1 <= len(clue_en) <= 300):
            errors.append(f"{prefix}.clue_en harus 1-300 karakter.")
        if not isinstance(clue_id, str) or not (1 <= len(clue_id) <= 300):
            errors.append(f"{prefix}.clue_id harus 1-300 karakter.")

        # Bounds and grid match
        if errors:
            continue
        if not (0 <= row < rows and 0 <= col < cols):
            errors.append(f"{prefix} posisi di luar grid.")
            continue
        dr, dc = (0, 1) if direction == "across" else (1, 0)
        for k, ch in enumerate(answer):
            rr = row + dr * k
            cc = col + dc * k
            if not (0 <= rr < rows and 0 <= cc < cols):
                errors.append(f"{prefix} answer keluar grid.")
                break
            grid_ch = grid[rr][cc]
            if grid_ch == "#":
                errors.append(f"{prefix} answer menabrak blok di ({rr},{cc}).")
                break
            if grid_ch.upper() != ch:
                errors.append(f"{prefix} answer tidak cocok dengan grid di ({rr},{cc}).")
                break
        else:
            # ensure entry doesn't continue beyond answer (no longer word at end)
            end_r = row + dr * len(answer)
            end_c = col + dc * len(answer)
            if 0 <= end_r < rows and 0 <= end_c < cols and grid[end_r][end_c] != "#":
                errors.append(f"{prefix} entry lebih panjang dari answer di grid.")
            # cell before start must be block or edge
            prev_r = row - dr
            prev_c = col - dc
            if 0 <= prev_r < rows and 0 <= prev_c < cols and grid[prev_r][prev_c] != "#":
                errors.append(f"{prefix} entry dimulai di tengah kata lain.")

        if clue_en and clue_id and answer and answer.lower() in clue_en.lower():
            warnings.append(f"{prefix}.clue_en mengandung kata jawaban (warning).")

    if not has_across:
        errors.append("Puzzle harus punya minimal satu entry across.")
    if not has_down:
        errors.append("Puzzle harus punya minimal satu entry down.")

    if not errors:
        # white cells coverage & numbering
        for r in range(rows):
            for c in range(cols):
                if grid[r][c] != "#":
                    white_cells.add((r, c))
        covered: set[tuple[int, int]] = set()
        for raw in entries:
            if not isinstance(raw, dict):
                continue
            row = raw.get("row")
            col = raw.get("col")
            direction = raw.get("direction")
            answer = raw.get("answer")
            if not isinstance(row, int) or not isinstance(col, int):
                continue
            dr, dc = (0, 1) if direction == "across" else (1, 0)
            for k in range(len(answer or "")):
                covered.add((row + dr * k, col + dc * k))
        uncovered = white_cells - covered
        if uncovered:
            errors.append(
                f"Terdapat {len(uncovered)} cell putih yang bukan milik entry mana pun."
            )
        for (r, c) in white_cells:
            across_start = c == 0 or grid[r][c - 1] == "#"
            across_len = 0
            if across_start:
                cc = c
                while cc < cols and grid[r][cc] != "#":
                    across_len += 1
                    cc += 1
            down_start = r == 0 or grid[r - 1][c] == "#"
            down_len = 0
            if down_start:
                rr = r
                while rr < rows and grid[rr][c] != "#":
                    down_len += 1
                    rr += 1
            if across_len < 2 and down_len < 2:
                warnings.append(f"Cell ({r},{c}) tidak menjadi bagian entry valid (unchecked).")

    return errors, warnings


def parse_puzzle(content: dict) -> ParsedPuzzle:
    errors, _ = validate_puzzle(content)
    if errors:
        raise ValidationError("Puzzle tidak valid.", details={"errors": errors})
    grid = [r.upper() for r in content["grid"]]
    rows = len(grid)
    cols = len(grid[0])

    # numbering row-major
    numbers: dict[tuple[int, int], int] = {}
    num = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] == "#":
                continue
            across_start = c == 0 or grid[r][c - 1] == "#"
            across_len = 0
            if across_start:
                cc = c
                while cc < cols and grid[r][cc] != "#":
                    across_len += 1
                    cc += 1
            down_start = r == 0 or grid[r - 1][c] == "#"
            down_len = 0
            if down_start:
                rr = r
                while rr < rows and grid[rr][c] != "#":
                    down_len += 1
                    rr += 1
            if across_len >= 2 or down_len >= 2:
                num += 1
                numbers[(r, c)] = num

    entries: list[Entry] = []
    for raw in content["entries"]:
        row = raw["row"]
        col = raw["col"]
        direction = raw["direction"]
        answer = raw["answer"].upper()
        dr, dc = (0, 1) if direction == "across" else (1, 0)
        cells = [(row + dr * k, col + dc * k) for k in range(len(answer))]
        entries.append(
            Entry(
                entry_id=raw["id"],
                number=numbers.get((row, col), 0),
                row=row,
                col=col,
                direction=direction,
                answer=answer,
                clue_en=raw["clue_en"],
                clue_id=raw["clue_id"],
                cells=cells,
            )
        )
    entries.sort(key=lambda e: (e.number, 0 if e.direction == "across" else 1))

    return ParsedPuzzle(
        schema_version=content.get("schema_version", 1),
        version=content["version"],
        title=content["title"],
        language=content.get("language", "en"),
        grid=grid,
        entries=entries,
        cell_numbers=numbers,
    )


def mask_for_participant(parsed: ParsedPuzzle) -> dict:
    """Return puzzle data WITHOUT answers for participant state."""
    cells = []
    rows = parsed.rows
    cols = parsed.cols
    for r in range(rows):
        for c in range(cols):
            ch = parsed.grid[r][c]
            cells.append(
                {
                    "row": r,
                    "col": c,
                    "block": ch == "#",
                    "number": parsed.cell_numbers.get((r, c)),
                }
            )
    return {
        "rows": rows,
        "cols": cols,
        "cells": cells,
        "entries": [
            {
                "id": e.entry_id,
                "number": e.number,
                "direction": e.direction,
                "row": e.row,
                "col": e.col,
                "length": len(e.answer),
                "clue_en": e.clue_en,
                "clue_id": e.clue_id,
            }
            for e in parsed.entries
        ],
    }
