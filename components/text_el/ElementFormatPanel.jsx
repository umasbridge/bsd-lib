import { useState } from 'react';
import {
  PaintBucket,
  Square,
  Copy,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const BORDER_COLORS = [
  '#d1d5db', '#9ca3af', '#6b7280', '#374151', '#000000',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#8b5cf6',
];

const FILL_COLORS = [
  'transparent',
  '#ffffff', '#f9fafb', '#f3f4f6', '#e5e7eb',
  '#fef2f2', '#fff7ed', '#fefce8', '#f0fdf4',
  '#eff6ff', '#eef2ff', '#faf5ff', '#fdf2f8',
];

const BORDER_WIDTHS = [0, 1, 2, 3, 4];

/**
 * Element-level formatting panel - shown when element border is clicked (isSelected)
 * Menu 3: border color, border width, fill color, copy
 */
export function ElementFormatPanel({
  borderColor,
  borderWidth,
  fillColor,
  onStyleChange,
  onCopy,
  onDelete,
  onMoveUp,
  onMoveDown,
}) {
  const [showBorderColor, setShowBorderColor] = useState(false);
  const [showBorderWidth, setShowBorderWidth] = useState(false);
  const [showFillColor, setShowFillColor] = useState(false);

  const closeAll = () => {
    setShowBorderColor(false);
    setShowBorderWidth(false);
    setShowFillColor(false);
  };

  return (
    <div
      data-element-format-panel=""
      className="flex items-center gap-0.5 py-1 px-2 bg-gray-50 border-b border-gray-200 rounded-t sticky top-0 z-20"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
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

      {/* Fill Color */}
      <div className="relative">
        <button
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
          onClick={() => { closeAll(); setShowFillColor(!showFillColor); }}
          title="Fill Color"
        >
          <PaintBucket className="h-3.5 w-3.5" />
        </button>
        {showFillColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg p-2 z-10 grid grid-cols-4 gap-1">
            {FILL_COLORS.map(color => (
              <button
                key={color}
                className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                style={{
                  backgroundColor: color === 'transparent' ? '#ffffff' : color,
                  ...(color === 'transparent' ? {
                    backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%), linear-gradient(45deg, #ccc 25%, transparent 25%, transparent 75%, #ccc 75%)',
                    backgroundSize: '6px 6px',
                    backgroundPosition: '0 0, 3px 3px',
                  } : {}),
                }}
                onClick={() => {
                  onStyleChange?.({ fillColor: color });
                  setShowFillColor(false);
                }}
                title={color === 'transparent' ? 'No fill' : color}
              />
            ))}
          </div>
        )}
      </div>

      <div className="w-px h-5 bg-gray-300 mx-1" />

      {/* Copy */}
      <button
        className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
        onClick={() => onCopy?.()}
        title="Copy Element"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>

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
