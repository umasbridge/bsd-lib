import { useState, useRef, useLayoutEffect } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Link,
  Unlink,
  ChevronDown,
  Subscript,
  Superscript,
  MessageSquare,
} from 'lucide-react';

const FONT_SIZES = ['10px', '12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

const TEXT_COLORS = [
  '#000000', '#374151', '#6b7280', '#9ca3af',
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

const HIGHLIGHT_COLORS = [
  '#fef08a', '#bbf7d0', '#fecaca', '#bfdbfe',
  '#e9d5ff', '#fed7aa', '#99f6e4', '#fce7f3',
];

/**
 * Inline text formatting panel - shown when text is selected
 * Menu 1: bold, italic, underline, strikethrough, sub/superscript, font size, colors, hyperlinks
 */
export function TextFormatPanel({
  mode,
  onFormat,
  onOpenHyperlink,
  onRemoveHyperlink,
  isHyperlinkSelected,
  onOpenDiscussion,
  position,
}) {
  const [showFontSize, setShowFontSize] = useState(false);
  const [showTextColor, setShowTextColor] = useState(false);
  const [showBgColor, setShowBgColor] = useState(false);

  const allowHyperlinks = mode !== 'title';
  const panelRef = useRef(null);

  useLayoutEffect(() => {
    if (!panelRef.current) return;
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const panelHeight = 44;
    const gap = 6;
    const placeAbove = rect.top - panelHeight - gap > 0;
    const topPos = placeAbove ? rect.top - panelHeight - gap : rect.bottom + gap;
    const leftPos = Math.max(10, rect.left + rect.width / 2 - 160);
    panelRef.current.style.top = topPos + 'px';
    panelRef.current.style.left = leftPos + 'px';
  });

  return (
    <div
      ref={panelRef}
      data-format-panel=""
      className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1 flex items-center gap-0.5"
      style={{
        left: Math.max(10, position.x - 160),
        top: Math.max(10, position.y - 50),
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Bold */}
      <button
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => onFormat({ bold: true })}
        title="Bold (Cmd+B)"
      >
        <Bold className="h-4 w-4" />
      </button>

      {/* Italic */}
      <button
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => onFormat({ italic: true })}
        title="Italic (Cmd+I)"
      >
        <Italic className="h-4 w-4" />
      </button>

      {/* Underline */}
      <button
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => onFormat({ underline: true })}
        title="Underline (Cmd+U)"
      >
        <Underline className="h-4 w-4" />
      </button>

      {/* Strikethrough */}
      <button
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => onFormat({ strikethrough: true })}
        title="Strikethrough"
      >
        <Strikethrough className="h-4 w-4" />
      </button>

      <div className="w-px h-6 bg-gray-200 mx-0.5" />

      {/* Subscript */}
      <button
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => onFormat({ subscript: true })}
        title="Subscript"
      >
        <Subscript className="h-4 w-4" />
      </button>

      {/* Superscript */}
      <button
        className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
        onClick={() => onFormat({ superscript: true })}
        title="Superscript"
      >
        <Superscript className="h-4 w-4" />
      </button>

      <div className="w-px h-6 bg-gray-200 mx-0.5" />

      {/* Font Size Dropdown */}
      <div className="relative">
        <button
          className="h-8 px-2 text-xs flex items-center rounded hover:bg-gray-100"
          onClick={() => {
            setShowFontSize(!showFontSize);
            setShowTextColor(false);
            setShowBgColor(false);
          }}
        >
          Size
          <ChevronDown className="h-3 w-3 ml-1" />
        </button>
        {showFontSize && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg py-1 z-10">
            {FONT_SIZES.map(size => (
              <button
                key={size}
                className="block w-full px-3 py-1 text-left text-sm hover:bg-gray-100"
                onClick={() => {
                  onFormat({ fontSize: size });
                  setShowFontSize(false);
                }}
              >
                {size}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Text Color */}
      <div className="relative">
        <button
          className="h-8 px-2 flex items-center rounded hover:bg-gray-100"
          onClick={() => {
            setShowTextColor(!showTextColor);
            setShowFontSize(false);
            setShowBgColor(false);
          }}
          title="Text Color"
        >
          <span
            className="w-4 h-4 border border-gray-300 rounded"
            style={{ background: 'linear-gradient(to bottom right, #ef4444, #3b82f6)' }}
          />
        </button>
        {showTextColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg p-2 z-10 grid grid-cols-4 gap-1">
            {TEXT_COLORS.map(color => (
              <button
                key={color}
                className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                style={{ backgroundColor: color }}
                onClick={() => {
                  onFormat({ color });
                  setShowTextColor(false);
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Highlight Color */}
      <div className="relative">
        <button
          className="h-8 px-2 flex items-center rounded hover:bg-gray-100"
          onClick={() => {
            setShowBgColor(!showBgColor);
            setShowFontSize(false);
            setShowTextColor(false);
          }}
          title="Highlight Color"
        >
          <span className="w-4 h-4 border border-gray-300 rounded bg-yellow-200" />
        </button>
        {showBgColor && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg p-2 z-10 w-max">
            <div className="grid grid-cols-4 gap-1">
              {HIGHLIGHT_COLORS.map(color => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-gray-200 hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => {
                    onFormat({ backgroundColor: color });
                    setShowBgColor(false);
                  }}
                />
              ))}
            </div>
            <button
              className="w-full mt-1 px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100 rounded flex items-center gap-1"
              onClick={() => {
                onFormat({ backgroundColor: 'transparent' });
                setShowBgColor(false);
              }}
            >
              <span className="w-4 h-4 rounded border border-gray-300 bg-white flex items-center justify-center text-[10px] text-gray-400">✕</span>
              No highlight
            </button>
          </div>
        )}
      </div>

      {/* Hyperlink */}
      {allowHyperlinks && (
        <>
          <div className="w-px h-6 bg-gray-200 mx-0.5" />
          {isHyperlinkSelected ? (
            <button
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100 text-red-500"
              onClick={onRemoveHyperlink}
              title="Remove Link"
            >
              <Unlink className="h-4 w-4" />
            </button>
          ) : (
            <button
              className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
              onClick={onOpenHyperlink}
              title="Add Link"
            >
              <Link className="h-4 w-4" />
            </button>
          )}
        </>
      )}

      {/* Discussion */}
      {allowHyperlinks && onOpenDiscussion && (
        <button
          className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100 text-yellow-600"
          onClick={onOpenDiscussion}
          title="Discussion"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
