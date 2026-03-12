import { useState, useEffect } from 'react';
import {
  Copy,
  Trash2,
  ChevronUp,
  ChevronDown,
  Square,
  Grid3X3,
} from 'lucide-react';

const BORDER_COLORS = [
  '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#000000',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#8b5cf6',
];

const BORDER_WIDTHS = [0, 1, 2, 3, 4];

const GRID_WIDTHS = [1, 2, 3];

/**
 * Element-level formatting panel for BidTable.
 * Shown when the table element is selected (border clicked).
 * Controls: border color/width, gridlines toggle/color/width, copy, delete, move up/down.
 */
export function BidTableFormatPanel({
  borderColor,
  borderWidth,
  onStyleChange,
  gridlines,
  onGridlinesChange,
  defaultRowHeight,
  onDefaultRowHeightChange,
  onCopy,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const [showBorderColor, setShowBorderColor] = useState(false);
  const [showBorderWidth, setShowBorderWidth] = useState(false);
  const [showGridColor, setShowGridColor] = useState(false);
  const [showGridWidth, setShowGridWidth] = useState(false);
  const [rowHeightInput, setRowHeightInput] = useState(String(defaultRowHeight ?? 34));

  useEffect(() => {
    setRowHeightInput(String(defaultRowHeight ?? 34));
  }, [defaultRowHeight]);

  const closeAll = () => {
    setShowBorderColor(false);
    setShowBorderWidth(false);
    setShowGridColor(false);
    setShowGridWidth(false);
  };

  return (
    <div
      data-element-format-panel=""
      className="flex items-center gap-0.5 py-1 px-2 bg-gray-50 border border-gray-200 rounded-t sticky top-0 z-20"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => { e.stopPropagation(); if (e.target.tagName !== 'INPUT') e.preventDefault(); }}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Border Color */}
      <div className="relative">
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
          onClick={() => { closeAll(); setShowBorderColor(!showBorderColor); }}
          title="Border Color"
        >
          <span
            className="w-4 h-4 rounded border border-gray-400"
            style={{ backgroundColor: borderColor || '#d1d5db' }}
          />
        </button>
        {showBorderColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg p-2 z-10 grid grid-cols-4 gap-1">
            {BORDER_COLORS.map(color => (
              <button
                key={color}
                className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => {
                  onStyleChange?.({ borderColor: color });
                  setShowBorderColor(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Border Width */}
      <div className="relative">
        <button
          className="h-7 px-1.5 flex items-center rounded hover:bg-gray-200 text-xs gap-0.5"
          onClick={() => { closeAll(); setShowBorderWidth(!showBorderWidth); }}
          title="Border Width"
        >
          <Square className="h-3.5 w-3.5" />
          <ChevronDown className="h-2.5 w-2.5" />
        </button>
        {showBorderWidth && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 z-10">
            {BORDER_WIDTHS.map(w => (
              <button
                key={w}
                className={`block w-full px-3 py-1 text-left text-xs hover:bg-gray-100 ${
                  borderWidth === w ? 'bg-blue-50 text-blue-600' : ''
                }`}
                onClick={() => {
                  onStyleChange?.({ borderWidth: w });
                  setShowBorderWidth(false);
                }}
              >
                {w === 0 ? 'None' : `${w}px`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Gridlines Toggle */}
      <button
        className={`h-7 w-7 flex items-center justify-center rounded ${
          gridlines?.enabled ? 'bg-blue-100 text-blue-700' : 'hover:bg-gray-200'
        }`}
        onClick={() => {
          closeAll();
          const current = gridlines || { enabled: false, color: '#D1D5DB', width: 1 };
          onGridlinesChange?.({ ...current, enabled: !current.enabled });
        }}
        title={gridlines?.enabled ? "Disable Gridlines" : "Enable Gridlines"}
      >
        <Grid3X3 className="h-3.5 w-3.5" />
      </button>

      {/* Gridlines Color + Width (only when enabled) */}
      {gridlines?.enabled && (
        <>
          <div className="relative">
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
              onClick={() => { closeAll(); setShowGridColor(!showGridColor); }}
              title="Gridline Color"
            >
              <span
                className="w-4 h-3 border border-gray-400"
                style={{ backgroundColor: gridlines.color || '#D1D5DB' }}
              />
            </button>
            {showGridColor && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg p-2 z-10 grid grid-cols-4 gap-1">
                {BORDER_COLORS.map(color => (
                  <button
                    key={color}
                    className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      onGridlinesChange?.({ ...gridlines, color });
                      setShowGridColor(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <button
              className="h-7 px-1.5 flex items-center rounded hover:bg-gray-200 text-xs"
              onClick={() => { closeAll(); setShowGridWidth(!showGridWidth); }}
              title="Gridline Width"
            >
              {gridlines.width}px
            </button>
            {showGridWidth && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 z-10">
                {GRID_WIDTHS.map(w => (
                  <button
                    key={w}
                    className={`block w-full px-3 py-1 text-left text-xs hover:bg-gray-100 ${
                      gridlines.width === w ? 'bg-blue-50 text-blue-600' : ''
                    }`}
                    onClick={() => {
                      onGridlinesChange?.({ ...gridlines, width: w });
                      setShowGridWidth(false);
                    }}
                  >
                    {w}px
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Row Height */}
      {onDefaultRowHeightChange && (
        <>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-gray-500 whitespace-nowrap">Row H</span>
            <input
              type="text"
              inputMode="numeric"
              value={rowHeightInput}
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9]/g, '');
                setRowHeightInput(raw);
              }}
              onBlur={() => {
                const num = Number(rowHeightInput);
                const val = num >= 20 && num <= 60 ? num : 34;
                setRowHeightInput(String(val));
                onDefaultRowHeightChange(val);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.target.blur();
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  const cur = Number(rowHeightInput) || 34;
                  const next = e.key === 'ArrowUp'
                    ? Math.min(60, cur + 1)
                    : Math.max(20, cur - 1);
                  setRowHeightInput(String(next));
                  onDefaultRowHeightChange(next);
                }
              }}
              style={{ width: '38px', height: '22px', fontSize: '11px', padding: '0 2px', border: '1px solid #D1D5DB', borderRadius: '3px', textAlign: 'center' }}
            />
          </div>
        </>
      )}

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Copy */}
      {onCopy && (
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
          onClick={() => onCopy()}
          title="Copy Element"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Delete */}
      {onDelete && (
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200 text-red-500"
          onClick={() => onDelete()}
          title="Delete Element"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}

      {/* Move Up/Down */}
      {(onMoveUp || onMoveDown) && (
        <>
          <div className="w-px h-5 bg-gray-300 mx-1" />
          {onMoveUp && (
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
              onClick={() => onMoveUp()}
              title="Move Up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
          )}
          {onMoveDown && (
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
              onClick={() => onMoveDown()}
              title="Move Down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
