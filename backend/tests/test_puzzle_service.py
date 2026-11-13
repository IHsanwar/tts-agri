from __future__ import annotations

import json
from pathlib import Path

import pytest

from app.services.puzzle import mask_for_participant, parse_puzzle, validate_puzzle


def test_school_v1_fixture():
    fixture_path = Path(__file__).resolve().parent.parent.parent / "content" / "puzzles" / "school-v1.json"
    assert fixture_path.exists(), f"Fixture not found at {fixture_path}"

    with open(fixture_path, encoding="utf-8") as f:
        data = json.load(f)

    errors, warnings = validate_puzzle(data)
    assert errors == [], f"Unexpected errors in sample puzzle: {errors}"

    parsed = parse_puzzle(data)
    assert parsed.title == "School Life"
    assert len(parsed.entries) == 5
    assert parsed.rows == 10
    assert parsed.cols == 10

    # Test participant mask
    mask = mask_for_participant(parsed)
    assert mask["rows"] == 10
    assert mask["cols"] == 10
    assert len(mask["entries"]) == 5

    # CRITICAL: Verify NO answer string is present in masked entries or cells
    mask_json = json.dumps(mask)
    for entry in parsed.entries:
        assert entry.answer not in mask_json, f"Answer {entry.answer} leaked into participant mask!"


def test_invalid_puzzles():
    # 1. Invalid schema version
    errs, _ = validate_puzzle({"schema_version": 2, "version": "v1", "title": "T", "grid": ["AAA"], "entries": []})
    assert any("schema_version" in e for e in errs)

    # 2. Grid dimension out of bounds (< 5)
    errs, _ = validate_puzzle({
        "schema_version": 1,
        "version": "v1",
        "title": "T",
        "grid": ["ABCD", "ABCD", "ABCD", "ABCD"],
        "entries": [],
    })
    assert any("Lebar grid" in e or "Tinggi grid" in e for e in errs)

    # 3. Illegal characters in grid
    errs, _ = validate_puzzle({
        "schema_version": 1,
        "version": "v1",
        "title": "T",
        "grid": ["ABCDE", "ABCD1", "ABCDE", "ABCDE", "ABCDE"],
        "entries": [],
    })
    assert any("Grid hanya boleh huruf" in e for e in errs)

