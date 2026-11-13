export type Direction = 'across' | 'down';
export type EntryStatus = 'unsolved' | 'solved' | 'assisted';

export interface GridCell {
  row: number;
  col: number;
  block: boolean;
  number?: number | null;
  letter: string;
  locked: boolean;
  isWrong?: boolean;
  isCorrectAnim?: boolean;
  animDelayMs?: number;
}

export interface CrosswordEntry {
  id: string;
  number: number;
  direction: Direction;
  row: number;
  col: number;
  length: number;
  clue_en: string;
  clue_id: string;
  status: EntryStatus;
  attempts: number;
  hints_used: number;
}

export interface CrosswordState {
  rows: number;
  cols: number;
  cells: GridCell[][];
  entries: CrosswordEntry[];
  activeCell: { row: number; col: number } | null;
  activeDirection: Direction;
  activeEntryId: string | null;
  score: number;
  gameStatus: string;
}

export type CrosswordAction =
  | { type: 'INIT_STATE'; payload: { puzzle: any; score: number; status: string } }
  | { type: 'SYNC_STATE'; payload: { puzzle: any; score: number; status: string } }
  | { type: 'SELECT_CELL'; row: number; col: number }
  | { type: 'SELECT_ENTRY'; entryId: string }
  | { type: 'TYPE_LETTER'; letter: string; onWordFilled?: (entryId: string, letters: string) => void }
  | { type: 'BACKSPACE' }
  | { type: 'MOVE_CURSOR'; key: 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' }
  | { type: 'TOGGLE_DIRECTION' }
  | { type: 'CYCLE_ENTRY'; reverse?: boolean }
  | { type: 'APPLY_WORD_RESULT'; entryId: string; correct: boolean; answer?: string }
  | { type: 'APPLY_HINT_LETTER'; entryId: string; cellIndex: number; letter: string }
  | { type: 'APPLY_HINT_WORD'; entryId: string; answer: string }
  | { type: 'UPDATE_SCORE_STATUS'; score: number; status: string }
  | { type: 'CLEAR_ANIMATIONS' };

export function getEntryCells(entry: CrosswordEntry): Array<{ row: number; col: number }> {
  const dr = entry.direction === 'down' ? 1 : 0;
  const dc = entry.direction === 'across' ? 1 : 0;
  return Array.from({ length: entry.length }, (_, i) => ({
    row: entry.row + dr * i,
    col: entry.col + dc * i,
  }));
}

export function findEntryForCell(
  entries: CrosswordEntry[],
  row: number,
  col: number,
  preferredDirection: Direction
): CrosswordEntry | null {
  // Try preferred direction first
  const matchPreferred = entries.find((e) => {
    if (e.direction !== preferredDirection) return false;
    const cells = getEntryCells(e);
    return cells.some((c) => c.row === row && c.col === col);
  });
  if (matchPreferred) return matchPreferred;

  // Fallback to opposite direction
  return (
    entries.find((e) => {
      const cells = getEntryCells(e);
      return cells.some((c) => c.row === row && c.col === col);
    }) || null
  );
}

export function ttsReducer(state: CrosswordState, action: CrosswordAction): CrosswordState {
  switch (action.type) {
    case 'INIT_STATE': {
      const { puzzle, score, status } = action.payload;
      const rows = puzzle.rows;
      const cols = puzzle.cols;

      // Build grid matrix
      const matrix: GridCell[][] = Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => ({
          row: r,
          col: c,
          block: true,
          number: null,
          letter: '',
          locked: false,
          isWrong: false,
          isCorrectAnim: false,
        }))
      );

      for (const rawCell of puzzle.cells) {
        matrix[rawCell.row][rawCell.col] = {
          row: rawCell.row,
          col: rawCell.col,
          block: !!rawCell.block,
          number: rawCell.number || null,
          letter: rawCell.letter || '',
          locked: !!rawCell.locked,
          isWrong: false,
          isCorrectAnim: false,
        };
      }

      const entries: CrosswordEntry[] = puzzle.entries.map((e: any) => ({
        id: e.id,
        number: e.number,
        direction: e.direction as Direction,
        row: e.row,
        col: e.col,
        length: e.length,
        clue_en: e.clue_en,
        clue_id: e.clue_id,
        status: e.status,
        attempts: e.attempts || 0,
        hints_used: e.hints_used || 0,
      }));

      // Pick initial cell
      let firstCell: { row: number; col: number } | null = null;
      let firstEntryId: string | null = null;
      let firstDirection: Direction = 'across';

      if (entries.length > 0) {
        const sorted = [...entries].sort((a, b) => a.number - b.number);
        firstEntryId = sorted[0].id;
        firstDirection = sorted[0].direction;
        const entryCells = getEntryCells(sorted[0]);
        const firstUnlocked = entryCells.find((pos) => !matrix[pos.row][pos.col].locked);
        firstCell = firstUnlocked || { row: sorted[0].row, col: sorted[0].col };
      }

      return {
        rows,
        cols,
        cells: matrix,
        entries,
        activeCell: firstCell,
        activeDirection: firstDirection,
        activeEntryId: firstEntryId,
        score,
        gameStatus: status,
      };
    }

    case 'SYNC_STATE': {
      const { puzzle, score, status } = action.payload;
      if (!puzzle || !puzzle.cells || state.rows === 0) return state;

      // Update cells that are locked on the server, while strictly preserving user's typed letters in unlocked cells and local locks
      const newCells = state.cells.map((r) => r.map((c) => ({ ...c })));
      for (const rawCell of puzzle.cells) {
        const curCell = newCells[rawCell.row]?.[rawCell.col];
        if (!curCell) continue;
        if (rawCell.locked && rawCell.letter) {
          curCell.letter = rawCell.letter;
          curCell.locked = true;
          curCell.isWrong = false;
        }
      }

      // Update entries status & attempts without downgrading local solves or resetting cursor
      const newEntries = state.entries.map((entry) => {
        const remoteEntry = puzzle.entries.find((e: any) => e.id === entry.id);
        if (!remoteEntry) return entry;
        const isLocallySolved = entry.status === 'solved' || entry.status === 'assisted';
        const finalStatus = isLocallySolved ? entry.status : remoteEntry.status;
        return {
          ...entry,
          status: finalStatus,
          attempts: Math.max(entry.attempts, remoteEntry.attempts ?? 0),
          hints_used: Math.max(entry.hints_used, remoteEntry.hints_used ?? 0),
        };
      });

      return {
        ...state,
        cells: newCells,
        entries: newEntries,
        score,
        gameStatus: status,
      };
    }

    case 'SELECT_CELL': {
      const { row, col } = action;
      const cell = state.cells[row]?.[col];
      if (!cell || cell.block) return state;

      // If clicking already active cell, toggle direction if cell has intersecting entry
      let newDirection = state.activeDirection;
      if (state.activeCell && state.activeCell.row === row && state.activeCell.col === col) {
        const otherDir: Direction = state.activeDirection === 'across' ? 'down' : 'across';
        const otherEntry = findEntryForCell(state.entries, row, col, otherDir);
        if (otherEntry && otherEntry.direction === otherDir) {
          newDirection = otherDir;
        }
      }

      const entry = findEntryForCell(state.entries, row, col, newDirection);

      return {
        ...state,
        activeCell: { row, col },
        activeDirection: entry ? entry.direction : newDirection,
        activeEntryId: entry ? entry.id : state.activeEntryId,
      };
    }

    case 'SELECT_ENTRY': {
      const entry = state.entries.find((e) => e.id === action.entryId);
      if (!entry) return state;
      const cells = getEntryCells(entry);
      const firstUnlocked = cells.find((pos) => !state.cells[pos.row][pos.col].locked);
      const activeCell = firstUnlocked || { row: entry.row, col: entry.col };
      return {
        ...state,
        activeCell,
        activeDirection: entry.direction,
        activeEntryId: entry.id,
      };
    }

    case 'TYPE_LETTER': {
      if (!state.activeCell) return state;
      const { row, col } = state.activeCell;
      const currentCell = state.cells[row][col];
      if (currentCell.block) return state;

      const currentEntry = state.entries.find((e) => e.id === state.activeEntryId);
      let targetRow = row;
      let targetCol = col;

      // If current cell is locked, do not overwrite it — route to the next unlocked cell in the active clue
      if (currentCell.locked) {
        if (!currentEntry) return state;
        const entryCells = getEntryCells(currentEntry);
        const idx = entryCells.findIndex((c) => c.row === row && c.col === col);
        const candidate =
          entryCells.slice(idx).find((pos) => !state.cells[pos.row][pos.col].locked) ||
          entryCells.find((pos) => !state.cells[pos.row][pos.col].locked);
        if (!candidate) return state; // All cells in entry are locked!
        targetRow = candidate.row;
        targetCol = candidate.col;
      }

      const letter = action.letter.toUpperCase();
      const newCells = state.cells.map((r) => r.map((c) => ({ ...c })));
      newCells[targetRow][targetCol].letter = letter;
      newCells[targetRow][targetCol].isWrong = false; // clear wrong state on edit

      // Advance cursor to next unlocked cell in current entry
      let nextCell: { row: number; col: number } = { row: targetRow, col: targetCol };
      if (currentEntry) {
        const cells = getEntryCells(currentEntry);
        const idx = cells.findIndex((c) => c.row === targetRow && c.col === targetCol);

        // Look for next cell in entry that is not locked
        let nextUnlocked: { row: number; col: number } | null = null;
        for (let i = idx + 1; i < cells.length; i++) {
          if (!newCells[cells[i].row][cells[i].col].locked) {
            nextUnlocked = cells[i];
            break;
          }
        }

        if (nextUnlocked) {
          nextCell = nextUnlocked;
        } else if (idx < cells.length - 1) {
          nextCell = cells[idx + 1];
        }

        // Check if all cells in current entry are filled
        const cellLetters = cells.map((c) => newCells[c.row][c.col].letter || '');
        const isAllFilled = cellLetters.every((l) => l.length === 1 && l.trim() !== '');
        if (isAllFilled && cellLetters.length === currentEntry.length) {
          const filledWord = cellLetters.join('');
          if (action.onWordFilled && currentEntry.status === 'unsolved') {
            action.onWordFilled(currentEntry.id, filledWord);
          }
        }
      }

      return {
        ...state,
        cells: newCells,
        activeCell: nextCell,
      };
    }

    case 'BACKSPACE': {
      if (!state.activeCell) return state;
      const { row, col } = state.activeCell;
      const currentCell = state.cells[row][col];

      const currentEntry = state.entries.find((e) => e.id === state.activeEntryId);
      if (!currentEntry) return state;
      const cells = getEntryCells(currentEntry);
      const idx = cells.findIndex((c) => c.row === row && c.col === col);

      const newCells = state.cells.map((r) => r.map((c) => ({ ...c })));

      // If current cell has an unlocked letter, clear it
      if (currentCell.letter && !currentCell.locked) {
        newCells[row][col].letter = '';
        newCells[row][col].isWrong = false;
        return { ...state, cells: newCells };
      }

      // If current cell is empty or locked, skip back to previous unlocked cell and clear it
      for (let prevIdx = idx - 1; prevIdx >= 0; prevIdx--) {
        const prevPos = cells[prevIdx];
        if (!newCells[prevPos.row][prevPos.col].locked) {
          newCells[prevPos.row][prevPos.col].letter = '';
          newCells[prevPos.row][prevPos.col].isWrong = false;
          return {
            ...state,
            cells: newCells,
            activeCell: prevPos,
          };
        }
      }

      return state;
    }

    case 'MOVE_CURSOR': {
      if (!state.activeCell) return state;
      const { row, col } = state.activeCell;
      let dr = 0;
      let dc = 0;
      if (action.key === 'ArrowUp') dr = -1;
      if (action.key === 'ArrowDown') dr = 1;
      if (action.key === 'ArrowLeft') dc = -1;
      if (action.key === 'ArrowRight') dc = 1;

      let r = row + dr;
      let c = col + dc;
      // Skip blocks in direction
      while (r >= 0 && r < state.rows && c >= 0 && c < state.cols) {
        if (!state.cells[r][c].block) {
          const entry = findEntryForCell(state.entries, r, c, state.activeDirection);
          return {
            ...state,
            activeCell: { row: r, col: c },
            activeEntryId: entry ? entry.id : state.activeEntryId,
          };
        }
        r += dr;
        c += dc;
      }
      return state;
    }

    case 'TOGGLE_DIRECTION': {
      if (!state.activeCell) return state;
      const otherDir: Direction = state.activeDirection === 'across' ? 'down' : 'across';
      const otherEntry = findEntryForCell(state.entries, state.activeCell.row, state.activeCell.col, otherDir);
      if (otherEntry) {
        return {
          ...state,
          activeDirection: otherDir,
          activeEntryId: otherEntry.id,
        };
      }
      return state;
    }

    case 'CYCLE_ENTRY': {
      if (state.entries.length === 0) return state;
      const sorted = [...state.entries].sort((a, b) => a.number - b.number);
      const currIdx = sorted.findIndex((e) => e.id === state.activeEntryId);
      const delta = action.reverse ? -1 : 1;
      const nextIdx = (currIdx + delta + sorted.length) % sorted.length;
      const nextEntry = sorted[nextIdx];
      return {
        ...state,
        activeCell: { row: nextEntry.row, col: nextEntry.col },
        activeDirection: nextEntry.direction,
        activeEntryId: nextEntry.id,
      };
    }

    case 'APPLY_WORD_RESULT': {
      const { entryId, correct, answer } = action;
      const entry = state.entries.find((e) => e.id === entryId);
      if (!entry) return state;

      const cells = getEntryCells(entry);
      const newCells = state.cells.map((r) => r.map((c) => ({ ...c })));
      const newEntries = state.entries.map((e) => {
        if (e.id !== entryId) return e;
        return {
          ...e,
          status: correct ? ('solved' as EntryStatus) : e.status,
          attempts: e.attempts + (correct ? 0 : 1),
        };
      });

      if (correct && answer) {
        cells.forEach((pos, idx) => {
          newCells[pos.row][pos.col].letter = answer[idx];
          newCells[pos.row][pos.col].locked = true;
          newCells[pos.row][pos.col].isWrong = false;
          newCells[pos.row][pos.col].isCorrectAnim = true;
          newCells[pos.row][pos.col].animDelayMs = idx * 60;
        });
      } else if (!correct) {
        cells.forEach((pos) => {
          if (!newCells[pos.row][pos.col].locked) {
            newCells[pos.row][pos.col].isWrong = true;
          }
        });
      }

      // If correct, advance cursor to the first unlocked cell of the next unsolved clue
      let nextActiveEntryId = state.activeEntryId;
      let nextActiveCell = state.activeCell;
      let nextActiveDirection = state.activeDirection;

      if (correct) {
        const remainingUnsolved = newEntries.filter((e) => e.status === 'unsolved');
        if (remainingUnsolved.length > 0) {
          const nextEntry = remainingUnsolved.find((e) => e.number > entry.number) || remainingUnsolved[0];
          nextActiveEntryId = nextEntry.id;
          nextActiveDirection = nextEntry.direction;
          const nextCells = getEntryCells(nextEntry);
          const firstUnlocked = nextCells.find((pos) => !newCells[pos.row][pos.col].locked);
          nextActiveCell = firstUnlocked || { row: nextEntry.row, col: nextEntry.col };
        }
      }

      return {
        ...state,
        cells: newCells,
        entries: newEntries,
        activeEntryId: nextActiveEntryId,
        activeCell: nextActiveCell,
        activeDirection: nextActiveDirection,
      };
    }

    case 'CLEAR_ANIMATIONS': {
      const newCells = state.cells.map((r) =>
        r.map((c) =>
          c.isCorrectAnim || c.isWrong
            ? { ...c, isCorrectAnim: false, animDelayMs: undefined, isWrong: false }
            : c
        )
      );
      return {
        ...state,
        cells: newCells,
      };
    }

    case 'APPLY_HINT_LETTER': {
      const { entryId, cellIndex, letter } = action;
      const entry = state.entries.find((e) => e.id === entryId);
      if (!entry) return state;

      const cells = getEntryCells(entry);
      const pos = cells[cellIndex];
      if (!pos) return state;

      const newCells = state.cells.map((r) => r.map((c) => ({ ...c })));
      newCells[pos.row][pos.col].letter = letter.toUpperCase();
      newCells[pos.row][pos.col].locked = true;
      newCells[pos.row][pos.col].isWrong = false;

      const newEntries = state.entries.map((e) => {
        if (e.id !== entryId) return e;
        return { ...e, hints_used: e.hints_used + 1 };
      });

      return { ...state, cells: newCells, entries: newEntries };
    }

    case 'APPLY_HINT_WORD': {
      const { entryId, answer } = action;
      const entry = state.entries.find((e) => e.id === entryId);
      if (!entry) return state;

      const cells = getEntryCells(entry);
      const newCells = state.cells.map((r) => r.map((c) => ({ ...c })));
      cells.forEach((pos, idx) => {
        newCells[pos.row][pos.col].letter = answer[idx];
        newCells[pos.row][pos.col].locked = true;
        newCells[pos.row][pos.col].isWrong = false;
      });

      const newEntries = state.entries.map((e) => {
        if (e.id !== entryId) return e;
        return { ...e, status: 'assisted' as EntryStatus };
      });

      return { ...state, cells: newCells, entries: newEntries };
    }

    case 'UPDATE_SCORE_STATUS': {
      return {
        ...state,
        score: action.score,
        gameStatus: action.status,
      };
    }

    default:
      return state;
  }
}

