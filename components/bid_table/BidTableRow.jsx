import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Resizable } from 're-resizable';
import { TextEl } from '../text_el';
import { ColorPicker } from './ColorPicker';
import { DEFAULT_ROW_MIN_HEIGHT } from './types';

export function BidTableRow({
  pageId,
  row,
  level,
  getLevelWidth,
  getIndentWidth,
  onUpdateLevelWidth,
  onUpdate,
  onAddSibling,
  onAddSiblingAbove,
  onAddChild,
  onAddParentSibling,
  onDelete,
  onToggleCollapsed,
  onToggleMerge,
  tableWidth,
  gridlines,
  isViewMode = false,
  isActive = true,
  onRowFocus,
  onCopyRow,
  onPasteRow,
  canPaste,
  maxWidth,
  rowMinHeight,
  columnWidths,
  columnCount,
  onUpdateColumnWidths,
  onAddColumn,
  onDeleteColumn,
  rowIndexMap,
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredColumnIndex, setHoveredColumnIndex] = useState(null);
  const [isCellSelected, setIsCellSelected] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerPosition, setColorPickerPosition] = useState({ x: 0, y: 0 });
  const rowRef = useRef(null);
  const bidCellRef = useRef(null);

  const bidColumnWidth = getLevelWidth(level);
  const indentWidth = getIndentWidth(level);
  const effectiveRowHeight = rowMinHeight ?? DEFAULT_ROW_MIN_HEIGHT;

  // Width calculation for non-bid columns.
  // Extra columns (index > 0): fixed absolute width from stored columnWidths.
  // Meaning column (index 0): absorbs remaining space after bid, indent, and extra columns.
  // This ensures extra column edges align vertically across all nesting levels.
  const totalNonBidSpace = Math.max(20, tableWidth - indentWidth - bidColumnWidth);
  const extraColumnsTotal = columnWidths.slice(1).reduce((a, b) => a + b, 0);

  const getColumnRenderWidth = (colIndex) => {
    if (columnCount === 1) {
      return totalNonBidSpace;
    }
    if (colIndex > 0) {
      // Extra columns: fixed absolute width (same at every nesting level)
      return columnWidths[colIndex];
    }
    // Meaning column (col 0): remaining space after extra columns
    return Math.max(20, totalNonBidSpace - extraColumnsTotal);
  };

  // Build visible column groups (handles merge)
  const getVisibleColumnGroups = () => {
    const groups = [];
    let currentGroup = null;

    for (let i = 0; i < row.columns.length; i++) {
      const col = row.columns[i];
      if (col.mergedWithPrevious && currentGroup) {
        currentGroup.columnIndices.push(i);
      } else {
        if (currentGroup) groups.push(currentGroup);
        currentGroup = {
          startIndex: i,
          columnIndices: [i],
          absorbsBid: i === 0 && col.mergedWithPrevious,
        };
      }
    }
    if (currentGroup) groups.push(currentGroup);
    return groups;
  };

  const columnGroups = getVisibleColumnGroups();
  const col0MergesWithBid = row.columns[0]?.mergedWithPrevious;

  // Keyboard shortcuts for row operations
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isHovered) return;

      const target = e.target;
      if (target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      if (isViewMode) return;

      if (e.key === '+') {
        e.preventDefault();
        if (e.shiftKey) {
          onAddChild(row.id);
        } else {
          onAddSibling(row.id);
        }
      } else if (e.key === '-') {
        e.preventDefault();
        if (level > 0) {
          onAddParentSibling(row.id);
        }
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        onDelete(row.id);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHovered, isViewMode, row.id, level, onAddSibling, onAddChild, onAddParentSibling, onDelete]);

  const handleBidResizeStop = (_e, _direction, _ref, d) => {
    let newWidth = bidColumnWidth + d.width;
    // Ensure meaning column stays at least 20px (account for fixed extra columns)
    const maxBidWidth = tableWidth - indentWidth - extraColumnsTotal - 20;
    newWidth = Math.min(newWidth, maxBidWidth);
    onUpdateLevelWidth(level, Math.max(20, newWidth));
  };

  const handleColumnResizeStop = (colIndex, d) => {
    // Column resize: reallocate between this column and the next
    const nextColIndex = colIndex + 1;
    if (nextColIndex >= columnCount) return;

    const oldWidth = columnWidths[colIndex];
    const neighborWidth = columnWidths[nextColIndex];
    const delta = d.width;

    const newWidth = Math.max(40, oldWidth + delta);
    const newNeighborWidth = Math.max(40, neighborWidth - delta);

    onUpdateColumnWidths({
      [colIndex]: newWidth,
      [nextColIndex]: newNeighborWidth,
    });
  };

  const handleColorSelect = (color) => {
    onUpdate(row.id, { bidFillColor: color });
    setShowColorPicker(false);
    setIsCellSelected(false);
  };

  const handleCornerClick = (e) => {
    e.stopPropagation();
    e.preventDefault();

    if (!isCellSelected && bidCellRef.current) {
      const rect = bidCellRef.current.getBoundingClientRect();
      setColorPickerPosition({ x: rect.left, y: rect.bottom + 4 });
    }

    setIsCellSelected(!isCellSelected);
    setShowColorPicker(!isCellSelected);
  };

  // Close selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!isCellSelected) return;

      const target = e.target;
      const isCornerIndicator = target.closest('[title="Click to select cell for fill color"]');
      const isColorPickerEl = target.closest('[data-color-picker]');
      const isCollapseTriangle = target.closest('[title="Expand"]') || target.closest('[title="Collapse"]');

      if (isCornerIndicator || isColorPickerEl || isCollapseTriangle) {
        return;
      }

      setIsCellSelected(false);
      setShowColorPicker(false);
    };

    if (isCellSelected) {
      document.addEventListener('mousedown', handleClickOutside, true);
      return () => document.removeEventListener('mousedown', handleClickOutside, true);
    }
  }, [isCellSelected]);

  // Border style helper
  const getBorderStyle = (side) => {
    if (gridlines?.enabled) {
      return `${gridlines.width}px ${gridlines.style || 'solid'} ${gridlines.color}`;
    }
    return '1px solid #D1D5DB';
  };

  // Render the action menu for a column
  const renderActionMenu = (colIndex) => {
    if (isViewMode) return null;

    return (
      <>
        {/* Bottom Border Hover Zone */}
        <div
          className="cursor-pointer"
          style={{
            position: 'absolute',
            right: '0',
            bottom: '0',
            height: '12px',
            width: '120px',
            zIndex: 5
          }}
          onMouseEnter={() => setHoveredColumnIndex(colIndex)}
          onMouseLeave={() => setHoveredColumnIndex(null)}
        />

        {/* Action Buttons */}
        {hoveredColumnIndex === colIndex && (
          <div
            className="flex gap-1 bg-white px-1.5 py-0.5 rounded shadow-md border border-gray-200"
            style={{
              position: 'absolute',
              right: '4px',
              bottom: '0',
              transform: 'translateY(50%)',
              zIndex: 20
            }}
            onMouseEnter={() => setHoveredColumnIndex(colIndex)}
            onMouseLeave={() => setHoveredColumnIndex(null)}
          >
            {/* Row operations */}
            <button
              onClick={(e) => { e.stopPropagation(); onAddSiblingAbove(row.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-100"
              title="Add Row Above"
            >
              +↑
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddSibling(row.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-100"
              title="Add Row Below"
            >
              +↓
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(row.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-100"
              title="Add Response (Child Row)"
            >
              ++
            </button>
            {level > 0 && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddParentSibling(row.id); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-100"
                title="Add Parent Row (-)"
              >
                -
              </button>
            )}

            {/* Column operations */}
            <div className="w-px h-5 bg-gray-300 mx-0.5" />
            <button
              onClick={(e) => { e.stopPropagation(); onToggleMerge(row.id, colIndex); }}
              onMouseDown={(e) => e.stopPropagation()}
              className={`text-xs px-1.5 py-0.5 border rounded ${
                row.columns[colIndex]?.mergedWithPrevious
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:bg-gray-100'
              }`}
              title={row.columns[colIndex]?.mergedWithPrevious
                ? "Unmerge"
                : (colIndex === 0 ? "Merge with bid" : "Merge with left column")}
            >
              ⇔
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onAddColumn(colIndex); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-100"
              title="Add column to the right"
            >
              +|
            </button>
            {columnCount > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteColumn(colIndex); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-xs px-1.5 py-0.5 border border-orange-300 text-orange-600 rounded hover:bg-orange-50"
                title="Delete this column"
              >
                x|
              </button>
            )}

            <div className="w-px h-5 bg-gray-300 mx-0.5" />
            {onCopyRow && (
              <button
                onClick={(e) => { e.stopPropagation(); onCopyRow(row.id); }}
                onMouseDown={(e) => e.stopPropagation()}
                className="text-xs px-1.5 py-0.5 border border-gray-300 rounded hover:bg-gray-100"
                title="Copy row (Ctrl+Shift+C)"
              >
                Copy
              </button>
            )}
            {onPasteRow && (
              <button
                onClick={(e) => { e.stopPropagation(); onPasteRow(row.id); }}
                onMouseDown={(e) => e.stopPropagation()}
                disabled={!canPaste}
                className={`text-xs px-1.5 py-0.5 border rounded ${
                  canPaste
                    ? 'border-green-300 text-green-600 hover:bg-green-50'
                    : 'border-gray-200 text-gray-300 cursor-not-allowed'
                }`}
                title={canPaste ? "Paste row below (Ctrl+Shift+V)" : "Cannot paste: column count mismatch"}
              >
                Paste
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
              onMouseDown={(e) => e.stopPropagation()}
              className="text-xs px-1.5 py-0.5 border border-red-300 text-red-600 rounded hover:bg-red-50"
              title="Delete (x)"
            >
              x
            </button>
          </div>
        )}
      </>
    );
  };

  // Render a column group (one or more merged columns rendered as one cell)
  const renderColumnGroup = (group, groupIdx) => {
    const primaryColIndex = group.startIndex;
    const primaryCol = row.columns[primaryColIndex];
    const isLastGroup = groupIdx === columnGroups.length - 1;

    // Calculate group width: sum of all columns in the group
    let groupWidth = group.columnIndices.reduce(
      (sum, ci) => sum + getColumnRenderWidth(ci), 0
    );
    // If group absorbs bid (col 0 merged with bid), add bid width
    if (group.absorbsBid) {
      groupWidth += bidColumnWidth;
    }

    const isNotLastColumn = !isLastGroup || groupIdx < columnGroups.length - 1;

    // Determine if this group's right edge should be a column-resize handle
    // Non-last groups get Resizable for column resize; last group is a plain div
    const lastColInGroup = group.columnIndices[group.columnIndices.length - 1];
    const canColumnResize = !isLastGroup && isActive && !isViewMode && lastColInGroup < columnCount - 1;

    // If column HTML has styled divs (e.g. game analysis with bullet indents),
    // render as raw HTML to preserve inline styles that Tiptap would strip
    const hasStyledDivs = primaryCol.html && /<div\s+style=/.test(primaryCol.html);

    const columnContent = (
      <div
        className="pr-1 py-1.5 pl-2"
        data-row-index={rowIndexMap?.[row.id]}
        data-col-index={primaryColIndex}
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: 'white',
        }}
      >
        {hasStyledDivs ? (
          <div
            className="px-2 py-1 text-sm leading-relaxed outline-none flex-1 min-w-0"
            contentEditable={!isViewMode}
            suppressContentEditableWarning
            dangerouslySetInnerHTML={{ __html: primaryCol.html }}
            onBlur={(e) => {
              if (isViewMode) return;
              const newHtml = e.currentTarget.innerHTML;
              const newText = e.currentTarget.textContent || '';
              const newColumns = [...row.columns];
              newColumns[primaryColIndex] = { ...newColumns[primaryColIndex], value: newText, html: newHtml };
              onUpdate(row.id, { columns: newColumns });
            }}
          />
        ) : (
          <TextEl
            mode="cell"
            pageId={pageId}
            value={primaryCol.value}
            htmlValue={primaryCol.html}
            onChange={(text, html) => {
              const newColumns = [...row.columns];
              newColumns[primaryColIndex] = { ...newColumns[primaryColIndex], value: text, html };
              onUpdate(row.id, { columns: newColumns });
            }}
            placeholder={primaryColIndex === 0 ? "Meaning" : `Col ${primaryColIndex + 2}`}
            minHeight={rowMinHeight ?? DEFAULT_ROW_MIN_HEIGHT}

            readOnly={isViewMode}
            onFocus={() => onRowFocus?.(row.id)}
          />
        )}

        {/* Action menu - on every column group */}
        {renderActionMenu(primaryColIndex)}
      </div>
    );

    const cellStyle = {
      borderBottom: getBorderStyle('bottom'),
      borderLeft: getBorderStyle('left'),
      borderTop: getBorderStyle('top'),
    };

    if (canColumnResize) {
      return (
        <Resizable
          key={primaryColIndex}
          size={{ width: groupWidth, height: 'auto' }}
          enable={{
            right: true,
            top: false, bottom: false, left: false,
            topRight: false, bottomRight: false, bottomLeft: false, topLeft: false,
          }}
          onResizeStop={(_e, _dir, _ref, d) => {
            handleColumnResizeStop(lastColInGroup, d);
          }}
          handleStyles={{
            right: { width: '4px', right: '0', cursor: 'col-resize' },
          }}
          handleClasses={{
            right: 'hover:bg-blue-400',
          }}
          className="flex-shrink-0"
          style={cellStyle}
        >
          {columnContent}
        </Resizable>
      );
    }

    // Last column group - plain div (table resize handles the rightmost edge)
    return (
      <div
        key={primaryColIndex}
        style={{ width: groupWidth, ...cellStyle }}
      >
        {columnContent}
      </div>
    );
  };

  return (
    <div>
      {/* Main Row */}
      <div
        ref={rowRef}
        className="flex items-stretch relative"
        style={{ minHeight: (rowMinHeight ?? DEFAULT_ROW_MIN_HEIGHT) + 'px' }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {/* Indent Space */}
        {indentWidth > 0 && (
          <div
            style={{ width: `${indentWidth}px` }}
            className="flex-shrink-0"
          />
        )}

        {/* Bid Column - Resizable (hidden when col 0 merges with bid) */}
        {!col0MergesWithBid && (
          <Resizable
            size={{ width: bidColumnWidth, height: 'auto' }}
            onResizeStop={handleBidResizeStop}
            enable={{
              right: isActive && !isViewMode,
              top: false,
              bottom: false,
              left: false,
              topRight: false,
              bottomRight: false,
              bottomLeft: false,
              topLeft: false,
            }}
            handleStyles={{
              right: {
                width: '4px',
                right: '0',
                cursor: 'col-resize',
              },
            }}
            handleClasses={{
              right: 'hover:bg-blue-400',
            }}
            className="flex-shrink-0"
            style={{
              backgroundColor: row.bidFillColor || 'white',
              borderBottom: getBorderStyle('bottom'),
              borderLeft: getBorderStyle('left'),
              borderTop: getBorderStyle('top'),
              boxShadow: isCellSelected ? 'inset 0 0 0 2px #3B82F6' : 'none',
            }}
          >
            <div ref={bidCellRef} className="pl-1.5 pr-1 py-1.5 flex items-center relative" data-column-type="bid" data-row-index={rowIndexMap?.[row.id]} data-col-index={-1}>
              <div className="flex-1 relative">
                {/* Bid cell: raw HTML for images (hand diagrams), TextEl otherwise */}
                {row.bidHtml && row.bidHtml.includes('<img ') ? (
                  <div
                    className="px-2 py-1"
                    dangerouslySetInnerHTML={{ __html: row.bidHtml }}
                  />
                ) : (
                  <TextEl
                    mode="cell"
                    pageId={pageId}
                    value={row.bid}
                    htmlValue={row.bidHtml}
                    onChange={(text, html) => onUpdate(row.id, { bid: text, bidHtml: html })}
                    placeholder="Bid"
                    minHeight={rowMinHeight ?? DEFAULT_ROW_MIN_HEIGHT}
                    readOnly={isViewMode}
                    onFocus={() => onRowFocus?.(row.id)}
                  />
                )}

                {/* Collapse/Expand Triangle */}
                {row.children.length > 0 && (
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onToggleCollapsed(row.id);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="absolute cursor-pointer hover:opacity-80 transition-opacity"
                    title={row.collapsed ? "Expand" : "Collapse"}
                    data-collapse-triangle="true"
                    style={{
                      bottom: '-8px',
                      right: '-4px',
                      width: '12px',
                      height: '12px',
                      backgroundColor: '#3B82F6',
                      clipPath: row.collapsed
                        ? 'polygon(0 0, 100% 100%, 0 100%)'
                        : 'polygon(0 0, 100% 0, 100% 100%)',
                      zIndex: 10,
                      pointerEvents: 'auto',
                    }}
                  />
                )}

                {/* Corner Indicator for fill color */}
                {!isViewMode && (
                  <div
                    onClick={handleCornerClick}
                    onMouseDown={(e) => e.stopPropagation()}
                    className={`absolute top-0 right-0 w-3 h-3 cursor-pointer transition-opacity ${
                      isHovered || isCellSelected ? 'opacity-100' : 'opacity-0'
                    }`}
                    style={{
                      backgroundColor: isCellSelected ? '#3B82F6' : '#9CA3AF',
                      clipPath: 'polygon(0 0, 100% 0, 100% 100%)',
                    }}
                    title="Click to select cell for fill color"
                  />
                )}
              </div>

              {/* Color Picker Portal */}
              {showColorPicker && !isViewMode && createPortal(
                <div
                  data-color-picker
                  style={{
                    position: 'fixed',
                    left: colorPickerPosition.x,
                    top: colorPickerPosition.y,
                    zIndex: 9999
                  }}
                >
                  <ColorPicker
                    currentColor={row.bidFillColor}
                    onColorSelect={handleColorSelect}
                    onClose={() => {
                      setShowColorPicker(false);
                      setIsCellSelected(false);
                    }}
                  />
                </div>,
                document.body
              )}
            </div>
          </Resizable>
        )}

        {/* Non-Bid Columns - rendered as column groups */}
        {columnGroups.map((group, groupIdx) => renderColumnGroup(group, groupIdx))}
      </div>

      {/* Render Children - Only if not collapsed */}
      {row.children.length > 0 && !row.collapsed && (
        <div>
          {row.children.map((child) => (
            <BidTableRow
              key={child.id}
              pageId={pageId}
              row={child}
              level={level + 1}
              getLevelWidth={getLevelWidth}
              getIndentWidth={getIndentWidth}
              onUpdateLevelWidth={onUpdateLevelWidth}
              onUpdate={onUpdate}
              onAddSibling={onAddSibling}
              onAddSiblingAbove={onAddSiblingAbove}
              onAddChild={onAddChild}
              onAddParentSibling={onAddParentSibling}
              onDelete={onDelete}
              onToggleCollapsed={onToggleCollapsed}
              onToggleMerge={onToggleMerge}
              tableWidth={tableWidth}
              gridlines={gridlines}
              isViewMode={isViewMode}
              isActive={isActive}
              onRowFocus={onRowFocus}
              onCopyRow={onCopyRow}
              onPasteRow={onPasteRow}
              canPaste={canPaste}
    
    
    
              maxWidth={maxWidth}
              rowMinHeight={rowMinHeight}
              columnWidths={columnWidths}
              columnCount={columnCount}
              onUpdateColumnWidths={onUpdateColumnWidths}
              onAddColumn={onAddColumn}
              onDeleteColumn={onDeleteColumn}
              rowIndexMap={rowIndexMap}
            />
          ))}
        </div>
      )}
    </div>
  );
}
