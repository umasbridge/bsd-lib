import { useState, useEffect, useCallback } from 'react';
import { Resizable } from 're-resizable';
import { Undo } from 'lucide-react';
import { BidTableRow } from './BidTableRow';
import { BidTableNameHeader } from './BidTableNameHeader';
import { BidTableFormatPanel } from './BidTableFormatPanel';

// Helper function to recursively collapse all rows that have children
const collapseAllRows = (rows) => {
  return rows.map(row => {
    if (row.children.length > 0) {
      return {
        ...row,
        collapsed: true,
        children: collapseAllRows(row.children)
      };
    }
    return row;
  });
};

// Migrate legacy row data (meaning/meaningHtml/isMerged) to columns[]
const migrateRowData = (row, columnCount) => {
  if (row.columns) {
    // Already new format — ensure correct column count
    const cols = [...row.columns];
    while (cols.length < columnCount) {
      cols.push({ value: '', mergedWithPrevious: false });
    }
    return {
      ...row,
      columns: cols.slice(0, columnCount),
      children: row.children.map(c => migrateRowData(c, columnCount)),
    };
  }
  // Legacy format: convert meaning/meaningHtml/isMerged to columns[0]
  const columns = [
    { value: row.meaning || '', html: row.meaningHtml, mergedWithPrevious: row.isMerged || false },
  ];
  while (columns.length < columnCount) {
    columns.push({ value: '', mergedWithPrevious: false });
  }
  const { meaning, meaningHtml, isMerged, ...rest } = row;
  return {
    ...rest,
    columns,
    children: row.children.map(c => migrateRowData(c, columnCount)),
  };
};

// Create empty columns array of given length
const makeEmptyColumns = (count) =>
  Array.from({ length: count }, () => ({ value: '', mergedWithPrevious: false }));

export function BidTable({
  pageId,
  initialRows,
  gridlines,
  initialLevelWidths,
  initialColumnWidths,
  width: widthProp,
  initialName,
  initialNameHtml,
  initialShowName = true,
  onRowsChange,
  onLevelWidthsChange,
  onColumnWidthsChange,
  onWidthChange,
  onNameChange,
  onNameHtmlChange,
  onShowNameChange,
  isViewMode = false,
  isActive = true,
  maxWidth,
  defaultRowHeight,
  onDefaultRowHeightChange,
  isSelected = false,
  onSelect,
  onFocus,
  onMoveUp,
  onMoveDown,
  onCopy,
  onDelete,
  borderColor = '#d1d5db',
  borderWidth: borderWidthProp = 1,
  onStyleChange,
  onGridlinesChange,
  startExpanded = false,
  tocTable = false,
}) {
  // Width is controlled by parent (like TextEl). Default to 680 if not provided.
  const effectiveWidth = widthProp || 680;

  const [levelWidths, setLevelWidths] = useState(
    initialLevelWidths || { 0: 80 }
  );

  // Column widths for non-bid columns. Length = number of non-bid columns.
  const [columnWidths, setColumnWidths] = useState(() => {
    if (initialColumnWidths) return initialColumnWidths;
    // Default: 1 non-bid column taking remaining space
    return [effectiveWidth - (initialLevelWidths?.[0] || 80)];
  });

  const columnCount = columnWidths.length;

  const [rows, setRows] = useState(() => {
    if (initialRows) {
      const migrated = initialRows.map(r => migrateRowData(r, columnCount));
      return startExpanded ? migrated : collapseAllRows(migrated);
    }
    return [{
      id: '1',
      bid: '',
      bidFillColor: undefined,
      columns: makeEmptyColumns(columnCount),
      children: []
    }];
  });

  const [history, setHistory] = useState([]);
  const [showUndoHighlight, setShowUndoHighlight] = useState(false);
  const [undoTimeoutId, setUndoTimeoutId] = useState(null);

  const [name, setName] = useState(initialName || '');
  const [nameHtml, setNameHtml] = useState(initialNameHtml);
  const [showName, setShowName] = useState(initialShowName);

  // Copy/paste state
  const [focusedRowId, setFocusedRowId] = useState(null);
  const [copyVersion, setCopyVersion] = useState(0);

  // Listen for copy events from other tables
  useEffect(() => {
    const handler = () => setCopyVersion(v => v + 1);
    window.addEventListener('bidTableRowCopied', handler);
    return () => window.removeEventListener('bidTableRowCopied', handler);
  }, []);

  const generateId = () => Math.random().toString(36).substring(7);

  // Helper to find a row by ID
  const findRowById = (rows, id) => {
    for (const row of rows) {
      if (row.id === id) return row;
      if (row.children.length > 0) {
        const found = findRowById(row.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // Deep clone a row with new IDs
  const cloneRowWithNewIds = (row) => {
    return {
      ...row,
      id: generateId(),
      children: row.children.map(child => cloneRowWithNewIds(child))
    };
  };

  // Copy the focused row - stores in sessionStorage for cross-table pasting
  const copyRow = (rowId) => {
    const row = findRowById(rows, rowId);
    if (row) {
      const rowCopy = JSON.parse(JSON.stringify(row));
      const copyData = { row: rowCopy, columnCount };
      sessionStorage.setItem('copiedTableRow', JSON.stringify(copyData));
      setCopyVersion(v => v + 1);
      // Notify other tables so they can re-evaluate canPaste
      window.dispatchEvent(new Event('bidTableRowCopied'));
    }
  };

  // Get copied row from sessionStorage
  const getCopiedRow = () => {
    const stored = sessionStorage.getItem('copiedTableRow');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Support new format { row, columnCount } and legacy format (bare row)
        if (parsed.row && parsed.columnCount !== undefined) {
          return parsed;
        }
        return { row: parsed, columnCount: null };
      } catch {
        return null;
      }
    }
    return null;
  };

  // Helper to check if a row is blank
  const isRowBlank = (row) => {
    const bidEmpty = !row.bid && !row.bidHtml;
    const columnsEmpty = row.columns.every(col => !col.value && !col.html);
    return bidEmpty && columnsEmpty && row.children.length === 0;
  };

  // Paste copied row - replaces target if blank, otherwise inserts below
  const pasteRow = (targetRowId) => {
    const copyData = getCopiedRow();
    if (!copyData) return;

    const { row: copiedRow, columnCount: copiedColumnCount } = copyData;

    // Validate column count
    if (copiedColumnCount !== null && copiedColumnCount !== columnCount) {
      return;
    }

    // Clear undo history on paste action
    setHistory([]);
    setShowUndoHighlight(false);
    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      setUndoTimeoutId(null);
    }

    const targetRow = findRowById(rows, targetRowId);
    const shouldReplace = targetRow && isRowBlank(targetRow);

    const clonedRow = cloneRowWithNewIds(copiedRow);

    const pasteRecursive = (rows) => {
      const index = rows.findIndex(row => row.id === targetRowId);
      if (index !== -1) {
        if (shouldReplace) {
          const replacementRow = { ...clonedRow, id: targetRowId };
          return [...rows.slice(0, index), replacementRow, ...rows.slice(index + 1)];
        } else {
          return [...rows.slice(0, index + 1), clonedRow, ...rows.slice(index + 1)];
        }
      }
      return rows.map(row => ({
        ...row,
        children: pasteRecursive(row.children)
      }));
    };

    const updatedRows = pasteRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  // eslint-disable-next-line no-unused-vars -- copyVersion triggers re-render after copy
  const canPaste = (() => {
    void copyVersion;
    const copyData = getCopiedRow();
    return copyData && (copyData.columnCount === null || copyData.columnCount === columnCount);
  })();

  const saveToHistory = (currentRows) => {
    setHistory(prev => [...prev, JSON.parse(JSON.stringify(currentRows))]);

    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
    }

    const timeoutId = setTimeout(() => {
      setHistory([]);
      setShowUndoHighlight(false);
    }, 60000);

    setUndoTimeoutId(timeoutId);
  };

  const undo = () => {
    setHistory(prev => {
      if (prev.length === 0) return prev;

      const previousState = prev[prev.length - 1];
      setRows(previousState);
      return prev.slice(0, -1);
    });
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Undo: Ctrl/Cmd + Z
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        undo();
      }
      // Copy row: Ctrl/Cmd + Shift + C
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'C') {
        if (focusedRowId) {
          e.preventDefault();
          copyRow(focusedRowId);
        }
      }
      // Paste row: Ctrl/Cmd + Shift + V
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'V') {
        if (focusedRowId) {
          const copyData = getCopiedRow();
          if (copyData && (copyData.columnCount === null || copyData.columnCount === columnCount)) {
            e.preventDefault();
            pasteRow(focusedRowId);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedRowId, columnCount]);

  const updateRow = (id, updates) => {
    // Clear undo history on any edit action
    setHistory([]);
    setShowUndoHighlight(false);

    if (undoTimeoutId) {
      clearTimeout(undoTimeoutId);
      setUndoTimeoutId(null);
    }

    const updateRecursive = (rows) => {
      return rows.map(row => {
        if (row.id === id) {
          return { ...row, ...updates };
        }
        if (row.children.length > 0) {
          return { ...row, children: updateRecursive(row.children) };
        }
        return row;
      });
    };
    const updatedRows = updateRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  const updateLevelWidth = (level, width) => {
    const newLevelWidths = { ...levelWidths, [level]: width };
    setLevelWidths(newLevelWidths);
    onLevelWidthsChange?.(newLevelWidths);
  };

  const updateColumnWidths = (updates) => {
    const newColumnWidths = [...columnWidths];
    for (const [idx, width] of Object.entries(updates)) {
      newColumnWidths[Number(idx)] = width;
    }
    setColumnWidths(newColumnWidths);
    onColumnWidthsChange?.(newColumnWidths);
  };

  const updateWidth = (newWidth) => {
    onWidthChange?.(newWidth);
  };

  const updateName = (newName, newHtmlContent) => {
    setName(newName);
    onNameChange?.(newName);
    if (newHtmlContent !== undefined) {
      setNameHtml(newHtmlContent);
      onNameHtmlChange?.(newHtmlContent);
    }
  };

  const deleteName = () => {
    setShowName(false);
    onShowNameChange?.(false);
  };

  const getLevelWidth = (level) => {
    return levelWidths[level] || 80;
  };

  const getIndentWidth = (level) => {
    let total = 0;
    for (let i = 0; i < level; i++) {
      total += getLevelWidth(i);
    }
    return total;
  };

  // --- Row operations ---

  const addSiblingRow = (id) => {
    setHistory([]);
    setShowUndoHighlight(false);
    if (undoTimeoutId) { clearTimeout(undoTimeoutId); setUndoTimeoutId(null); }

    const addRecursive = (rows) => {
      const index = rows.findIndex(row => row.id === id);
      if (index !== -1) {
        const newRow = {
          id: generateId(),
          bid: '',
          bidFillColor: rows[index].bidFillColor,
          columns: makeEmptyColumns(columnCount),
          children: []
        };
        return [...rows.slice(0, index + 1), newRow, ...rows.slice(index + 1)];
      }
      return rows.map(row => ({ ...row, children: addRecursive(row.children) }));
    };
    const updatedRows = addRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  const addSiblingAboveRow = (id) => {
    setHistory([]);
    setShowUndoHighlight(false);
    if (undoTimeoutId) { clearTimeout(undoTimeoutId); setUndoTimeoutId(null); }

    const addRecursive = (rows) => {
      const index = rows.findIndex(row => row.id === id);
      if (index !== -1) {
        const newRow = {
          id: generateId(),
          bid: '',
          bidFillColor: rows[index].bidFillColor,
          columns: makeEmptyColumns(columnCount),
          children: []
        };
        return [...rows.slice(0, index), newRow, ...rows.slice(index)];
      }
      return rows.map(row => ({ ...row, children: addRecursive(row.children) }));
    };
    const updatedRows = addRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  const addChildRow = (id) => {
    setHistory([]);
    setShowUndoHighlight(false);
    if (undoTimeoutId) { clearTimeout(undoTimeoutId); setUndoTimeoutId(null); }

    const addRecursive = (rows) => {
      return rows.map(row => {
        if (row.id === id) {
          const inheritedColor = row.children.length > 0
            ? row.children[row.children.length - 1].bidFillColor
            : undefined;
          const newChild = {
            id: generateId(),
            bid: '',
            bidFillColor: inheritedColor,
            columns: makeEmptyColumns(columnCount),
            children: []
          };
          return { ...row, collapsed: false, children: [...row.children, newChild] };
        }
        if (row.children.length > 0) {
          return { ...row, children: addRecursive(row.children) };
        }
        return row;
      });
    };
    const updatedRows = addRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  const addParentSiblingRow = (id) => {
    setHistory([]);
    setShowUndoHighlight(false);
    if (undoTimeoutId) { clearTimeout(undoTimeoutId); setUndoTimeoutId(null); }

    const addRecursive = (rows, level = 0) => {
      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        const childIndex = row.children.findIndex(child => child.id === id);
        if (childIndex !== -1) {
          const newRow = {
            id: generateId(),
            bid: '',
            bidFillColor: row.bidFillColor,
            columns: makeEmptyColumns(columnCount),
            children: []
          };
          const newRows = [...rows.slice(0, i + 1), newRow, ...rows.slice(i + 1)];
          return { rows: newRows, found: true };
        }
      }
      const newRows = rows.map(row => {
        if (row.children.length > 0) {
          const result = addRecursive(row.children, level + 1);
          if (result.found) {
            return { ...row, children: result.rows };
          }
        }
        return row;
      });
      const found = newRows.some(row => row !== rows.find(r => r.id === row.id));
      return { rows: newRows, found };
    };

    const result = addRecursive(rows);
    if (result.found) {
      setRows(result.rows);
      onRowsChange?.(result.rows);
    }
  };

  const deleteRow = (id) => {
    saveToHistory(rows);
    const deleteRecursive = (rows) => {
      return rows
        .filter(row => row.id !== id)
        .map(row => ({
          ...row,
          children: deleteRecursive(row.children)
        }));
    };
    const updatedRows = deleteRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);

    setShowUndoHighlight(true);
    setTimeout(() => setShowUndoHighlight(false), 2000);
  };

  const toggleCollapsed = (id) => {
    const toggleRecursive = (rows) => {
      return rows.map(row => {
        if (row.id === id) {
          const newCollapsedState = !row.collapsed;
          if (newCollapsedState === false && row.children.length > 0) {
            const updatedChildren = row.children.map(child => {
              if (child.children.length > 0 && !child.collapsed) {
                return { ...child, collapsed: true };
              }
              return child;
            });
            return { ...row, collapsed: newCollapsedState, children: updatedChildren };
          }
          return { ...row, collapsed: newCollapsedState };
        }
        if (row.children.length > 0) {
          return { ...row, children: toggleRecursive(row.children) };
        }
        return row;
      });
    };
    const updatedRows = toggleRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  const toggleMerge = (id, colIndex) => {
    const toggleRecursive = (rows) => {
      return rows.map(row => {
        if (row.id === id) {
          const newColumns = [...row.columns];
          newColumns[colIndex] = {
            ...newColumns[colIndex],
            mergedWithPrevious: !newColumns[colIndex].mergedWithPrevious,
          };
          return { ...row, columns: newColumns };
        }
        if (row.children.length > 0) {
          return { ...row, children: toggleRecursive(row.children) };
        }
        return row;
      });
    };
    const updatedRows = toggleRecursive(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  // --- Column operations (table-wide) ---

  const addColumn = (afterColIndex) => {
    const insertIndex = afterColIndex + 1;

    // Split the current column's stored width
    const currentWidth = columnWidths[afterColIndex];
    const halfWidth = Math.max(50, Math.floor(currentWidth / 2));
    const newColWidths = [...columnWidths];
    newColWidths[afterColIndex] = currentWidth - halfWidth;
    newColWidths.splice(insertIndex, 0, halfWidth);
    setColumnWidths(newColWidths);
    onColumnWidthsChange?.(newColWidths);

    // Recursively add empty column to every row
    const addColToRows = (rows) => {
      return rows.map(row => {
        const newColumns = [...row.columns];
        newColumns.splice(insertIndex, 0, { value: '', mergedWithPrevious: false });
        return { ...row, columns: newColumns, children: addColToRows(row.children) };
      });
    };
    const updatedRows = addColToRows(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  const deleteColumn = (colIndex) => {
    if (columnWidths.length <= 1) return;

    const deletedWidth = columnWidths[colIndex];
    const newColWidths = [...columnWidths];
    newColWidths.splice(colIndex, 1);
    // Give deleted width to left neighbor, or right if deleting index 0
    if (colIndex > 0) {
      newColWidths[colIndex - 1] += deletedWidth;
    } else if (newColWidths.length > 0) {
      newColWidths[0] += deletedWidth;
    }
    setColumnWidths(newColWidths);
    onColumnWidthsChange?.(newColWidths);

    // Recursively remove column from every row
    const removeColFromRows = (rows) => {
      return rows.map(row => {
        const newColumns = [...row.columns];
        newColumns.splice(colIndex, 1);
        // If the column after deleted had mergedWithPrevious, clear it
        if (colIndex < newColumns.length && newColumns[colIndex].mergedWithPrevious) {
          newColumns[colIndex] = { ...newColumns[colIndex], mergedWithPrevious: false };
        }
        return { ...row, columns: newColumns, children: removeColFromRows(row.children) };
      });
    };
    const updatedRows = removeColFromRows(rows);
    setRows(updatedRows);
    onRowsChange?.(updatedRows);
  };

  // Total table width = element width + right border
  const level0BidWidth = levelWidths[0] || 80;
  const effectiveBorderWidth = borderWidthProp ?? 1;
  const totalTableWidth = effectiveWidth + effectiveBorderWidth;

  const resizeEnabled = !isViewMode && isSelected;

  return (
    <Resizable
      size={{ width: totalTableWidth, height: 'auto' }}
      minWidth={level0BidWidth + 40}
      maxWidth={maxWidth}
      enable={{
        right: resizeEnabled,
        top: false,
        bottom: false,
        left: false,
        topRight: false,
        bottomRight: false,
        bottomLeft: false,
        topLeft: false,
      }}
      onResizeStop={(_e, _direction, _ref, d) => {
        let newWidth = effectiveWidth + d.width;
        newWidth = Math.max(level0BidWidth + 40, newWidth);
        if (maxWidth) newWidth = Math.min(newWidth, maxWidth);
        updateWidth(newWidth);
      }}
      handleStyles={{
        right: {
          width: '6px',
          right: '-3px',
          cursor: 'col-resize',
        },
      }}
      handleClasses={{
        right: resizeEnabled ? 'hover:bg-blue-400 rounded' : '',
      }}
      style={{
        display: 'inline-block',
        ...(isSelected ? { boxShadow: '0 0 0 2px white, 0 0 0 4px #3b82f6', borderRadius: '4px' } : {}),
      }}
      onClick={(e) => {
        if (!onSelect) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const edge = 6;
        if (x < edge || x > rect.width - edge || y < edge || y > rect.height - edge) {
          onSelect();
        }
      }}
    >
      {/* Element Format Panel - shown when selected */}
      {isSelected && !isViewMode && (
        <BidTableFormatPanel
          borderColor={borderColor}
          borderWidth={effectiveBorderWidth}
          onStyleChange={onStyleChange}
          gridlines={gridlines}
          onGridlinesChange={onGridlinesChange}
          defaultRowHeight={defaultRowHeight}
          onDefaultRowHeightChange={onDefaultRowHeightChange}
          onCopy={onCopy}
          onDelete={onDelete}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
      )}

      <div style={{
        borderTop: `${effectiveBorderWidth}px solid ${borderColor}`,
        borderRight: `${effectiveBorderWidth}px solid ${borderColor}`,
      }}>
        {/* Name Header Row */}
        {name && showName && (
          <BidTableNameHeader
            name={name}
            htmlContent={nameHtml}
            onUpdate={updateName}
            onDelete={deleteName}
            tableWidth={totalTableWidth}
            gridlines={gridlines}
            isViewMode={isViewMode}
            rowMinHeight={defaultRowHeight}
            onFocus={onFocus}
          />
        )}

        {(() => {
          // Build flat row index map (depth-first, matches extractRowHtml order)
          let flatIdx = 0;
          const rowIndexMap = {};
          const buildIndexMap = (list) => {
            for (const r of list) {
              rowIndexMap[r.id] = flatIdx++;
              if (r.children?.length > 0) buildIndexMap(r.children);
            }
          };
          buildIndexMap(rows);
          return rows.map(row => (
          <BidTableRow
            key={row.id}
            pageId={pageId}
            row={row}
            level={0}
            rowIndexMap={rowIndexMap}
            getLevelWidth={getLevelWidth}
            getIndentWidth={getIndentWidth}
            onUpdateLevelWidth={updateLevelWidth}
            onUpdate={updateRow}
            onAddSibling={addSiblingRow}
            onAddSiblingAbove={addSiblingAboveRow}
            onAddChild={addChildRow}
            onAddParentSibling={addParentSiblingRow}
            onDelete={deleteRow}
            onToggleCollapsed={toggleCollapsed}
            onToggleMerge={toggleMerge}
            tableWidth={effectiveWidth}
            gridlines={gridlines}
            isViewMode={isViewMode}
            isActive={isActive}
            onRowFocus={(rowId) => { setFocusedRowId(rowId); onFocus?.(); }}
            onCopyRow={copyRow}
            onPasteRow={pasteRow}
            canPaste={canPaste}
            maxWidth={maxWidth}
            rowMinHeight={defaultRowHeight}
            columnWidths={columnWidths}
            columnCount={columnCount}
            onUpdateColumnWidths={updateColumnWidths}
            onAddColumn={addColumn}
            onDeleteColumn={deleteColumn}
            tocTable={tocTable}
          />
        ));
        })()}
      </div>

      {/* Undo Button */}
      {history.length > 0 && (
        <div className="mt-2 flex justify-end">
          <button
            onClick={undo}
            className={`flex items-center gap-1 px-3 py-1.5 text-sm border rounded transition-all ${
              showUndoHighlight
                ? 'border-blue-500 bg-blue-50 text-blue-700 shadow-md'
                : 'border-gray-300 hover:bg-gray-50'
            }`}
            title="Undo Delete (Ctrl+Z or Cmd+Z)"
          >
            <Undo className="h-3.5 w-3.5" />
            Undo
          </button>
        </div>
      )}
    </Resizable>
  );
}
