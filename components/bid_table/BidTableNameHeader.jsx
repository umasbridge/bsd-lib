import { useState } from 'react';
import { X } from 'lucide-react';
import { TextEl } from '../text_el';
import { DEFAULT_ROW_MIN_HEIGHT } from './types';

export function BidTableNameHeader({
  name,
  htmlContent,
  onUpdate,
  onDelete,
  tableWidth,
  gridlines,
  isViewMode,
  rowMinHeight,
  onFocus,
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: '100%',
        backgroundColor: 'white',
        borderBottom: gridlines?.enabled
          ? `${gridlines.width}px ${gridlines.style || 'solid'} ${gridlines.color}`
          : '1px solid #D1D5DB',
        borderLeft: gridlines?.enabled
          ? `${gridlines.width}px ${gridlines.style || 'solid'} ${gridlines.color}`
          : '1px solid #D1D5DB',
        borderTop: gridlines?.enabled
          ? `${gridlines.width}px ${gridlines.style || 'solid'} ${gridlines.color}`
          : '1px solid #D1D5DB',
      }}
    >
      <div className="px-2" style={{ minHeight: (rowMinHeight ?? DEFAULT_ROW_MIN_HEIGHT) + 'px' }}>
        <TextEl
          mode="cell"
          value={name}
          htmlValue={htmlContent}
          onChange={(text, html) => onUpdate(text, html)}
          placeholder="Table name"
          minHeight={rowMinHeight ?? DEFAULT_ROW_MIN_HEIGHT}
          readOnly={isViewMode}
          onFocus={onFocus}
        />
      </div>

      {/* Delete Button - Shows on hover (hidden in view mode) */}
      {isHovered && !isViewMode && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-white/90 border border-red-300 text-red-600 rounded hover:bg-red-50 shadow-sm"
          title="Delete name row"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
