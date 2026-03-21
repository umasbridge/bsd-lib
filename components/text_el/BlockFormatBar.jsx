import { useState, useRef, useEffect } from 'react';
import {
  AlignLeft,
  AlignCenter,
  AlignRight,
  List,
  ListOrdered,
  IndentIncrease,
  IndentDecrease,
  ChevronDown,
  ListTree,
} from 'lucide-react';
import { BULLET_STYLES, NUMBER_STYLES } from './ListStyleType';

/**
 * Block-level formatting bar - shown when cursor is inside TextEl (no selection)
 * Menu 2: alignment, bullet/number lists with style picker, indent/outdent
 */
export function BlockFormatBar({ mode, onFormat }) {
  const allowBullets = mode === 'default' || mode === 'cell';

  const [bulletDropdown, setBulletDropdown] = useState(false);
  const [numberDropdown, setNumberDropdown] = useState(false);
  const bulletRef = useRef(null);
  const numberRef = useRef(null);

  // Close dropdowns on outside click
  useEffect(() => {
    if (!bulletDropdown && !numberDropdown) return;
    const handleClick = (e) => {
      if (bulletRef.current && !bulletRef.current.contains(e.target)) setBulletDropdown(false);
      if (numberRef.current && !numberRef.current.contains(e.target)) setNumberDropdown(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [bulletDropdown, numberDropdown]);

  const preventFocusLoss = (e) => {
    e.preventDefault();
  };

  return (
    <div
      data-block-format-bar=""
      className="flex items-center gap-0.5 py-1 px-2 bg-gray-50 border-b border-gray-200 rounded-t sticky top-0 z-20"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
    >
      {/* Alignment */}
      <button
        className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
        onMouseDown={preventFocusLoss}
        onClick={() => onFormat({ textAlign: 'left' })}
        title="Align Left"
      >
        <AlignLeft className="h-3.5 w-3.5" />
      </button>
      <button
        className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
        onMouseDown={preventFocusLoss}
        onClick={() => onFormat({ textAlign: 'center' })}
        title="Align Center"
      >
        <AlignCenter className="h-3.5 w-3.5" />
      </button>
      <button
        className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
        onMouseDown={preventFocusLoss}
        onClick={() => onFormat({ textAlign: 'right' })}
        title="Align Right"
      >
        <AlignRight className="h-3.5 w-3.5" />
      </button>

      {/* Lists */}
      {allowBullets && (
        <>
          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Bullet list button + dropdown */}
          <div ref={bulletRef} className="relative flex items-center">
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
              onMouseDown={preventFocusLoss}
              onClick={() => onFormat({ listType: 'bullet' })}
              title="Bullet List"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              className="h-7 w-4 flex items-center justify-center rounded hover:bg-gray-200 -ml-1"
              onMouseDown={preventFocusLoss}
              onClick={() => { setBulletDropdown(!bulletDropdown); setNumberDropdown(false); }}
              title="Bullet style"
            >
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {bulletDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 py-1 min-w-[140px]">
                {BULLET_STYLES.map((style) => (
                  <button
                    key={style.value}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      onFormat({ listType: 'bullet' });
                      // Small delay to ensure list is created first
                      setTimeout(() => onFormat({ listStyleType: style.value }), 10);
                      setBulletDropdown(false);
                    }}
                  >
                    <span className="w-5 text-center text-base">{style.label}</span>
                    <span>{style.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Numbered list button + dropdown */}
          <div ref={numberRef} className="relative flex items-center">
            <button
              className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
              onMouseDown={preventFocusLoss}
              onClick={() => onFormat({ listType: 'number' })}
              title="Numbered List"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              className="h-7 w-4 flex items-center justify-center rounded hover:bg-gray-200 -ml-1"
              onMouseDown={preventFocusLoss}
              onClick={() => { setNumberDropdown(!numberDropdown); setBulletDropdown(false); }}
              title="Number style"
            >
              <ChevronDown className="h-2.5 w-2.5" />
            </button>
            {numberDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded shadow-lg z-50 py-1 min-w-[140px]">
                {NUMBER_STYLES.map((style) => (
                  <button
                    key={style.value}
                    className="w-full px-3 py-1.5 text-left text-sm hover:bg-gray-100 flex items-center gap-2"
                    onMouseDown={preventFocusLoss}
                    onClick={() => {
                      onFormat({ listType: 'number' });
                      setTimeout(() => onFormat({ listStyleType: style.value }), 10);
                      setNumberDropdown(false);
                    }}
                  >
                    <span className="w-12 text-xs text-gray-500">{style.label}</span>
                    <span>{style.title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Sub-list: indent + switch to opposite list type */}
          <button
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
            onMouseDown={preventFocusLoss}
            onClick={() => onFormat({ subList: true })}
            title="Nest as sub-list (switch bullet/number)"
          >
            <ListTree className="h-3.5 w-3.5" />
          </button>

          <div className="w-px h-5 bg-gray-300 mx-1" />

          {/* Indent / Outdent */}
          <button
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
            onMouseDown={preventFocusLoss}
            onClick={() => onFormat({ indent: 'decrease' })}
            title="Decrease Indent (Shift+Tab)"
          >
            <IndentDecrease className="h-3.5 w-3.5" />
          </button>
          <button
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-gray-200"
            onMouseDown={preventFocusLoss}
            onClick={() => onFormat({ indent: 'increase' })}
            title="Increase Indent (Tab)"
          >
            <IndentIncrease className="h-3.5 w-3.5" />
          </button>
        </>
      )}

    </div>
  );
}
