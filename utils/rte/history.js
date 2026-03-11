/**
 * Undo/Redo History Controller
 *
 * Manages history stack for rich text editing with selection preservation.
 * Uses innerHTML snapshots for simplicity and reliability.
 */

const MAX_HISTORY_SIZE = 50;

/**
 * Create a new history controller instance
 * @returns {{ push, undo, redo, canUndo, canRedo, clear }}
 */
export function createHistoryController() {
  let undoStack = [];
  let redoStack = [];

  function isDuplicate(html) {
    if (undoStack.length === 0) return false;
    return undoStack[undoStack.length - 1].html === html;
  }

  function push(html, selection) {
    if (isDuplicate(html)) return;

    undoStack.push({ html, selection, timestamp: Date.now() });

    if (undoStack.length > MAX_HISTORY_SIZE) {
      undoStack.shift();
    }

    redoStack = [];
  }

  function undo(root, restoreSelectionFn) {
    if (undoStack.length === 0) return;

    redoStack.push({
      html: root.innerHTML,
      selection: null,
      timestamp: Date.now(),
    });

    const entry = undoStack.pop();
    root.innerHTML = entry.html;

    if (entry.selection) {
      restoreSelectionFn(root, entry.selection);
    }
  }

  function redo(root, restoreSelectionFn) {
    if (redoStack.length === 0) return;

    undoStack.push({
      html: root.innerHTML,
      selection: null,
      timestamp: Date.now(),
    });

    const entry = redoStack.pop();
    root.innerHTML = entry.html;

    if (entry.selection) {
      restoreSelectionFn(root, entry.selection);
    }
  }

  function canUndo() {
    return undoStack.length > 0;
  }

  function canRedo() {
    return redoStack.length > 0;
  }

  function clear() {
    undoStack = [];
    redoStack = [];
  }

  return { push, undo, redo, canUndo, canRedo, clear };
}
