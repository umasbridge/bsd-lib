import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Ruler — horizontal indent ruler for TextEl (default mode only).
 *
 * Two draggable markers:
 *  - Left indent (left triangle): controls margin-left
 *  - Right indent (right triangle): controls margin-right
 */

const MARKER_SIZE = 12;
const RULER_HEIGHT = 24;
const TICK_MAJOR_INTERVAL = 50;

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

function MarkerTriangle({ x, y, direction, color, onDragStart, onDragMove, title }) {
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragging.current = true;
    const startX = e.clientX;
    onDragStart?.();

    const handleMouseMove = (e2) => {
      if (!dragging.current) return;
      const delta = e2.clientX - startX;
      onDragMove(delta);
    };

    const handleMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onDragStart, onDragMove]);

  const isDown = direction === 'down';
  const half = MARKER_SIZE / 2;
  const points = isDown
    ? `${-half},0 ${half},0 0,${MARKER_SIZE}`
    : `${-half},${MARKER_SIZE} ${half},${MARKER_SIZE} 0,0`;

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseDown={handleMouseDown}
      style={{ cursor: 'ew-resize' }}
    >
      <title>{title}</title>
      {/* Invisible larger hit area for easier grabbing */}
      <rect
        x={-half - 4}
        y={-2}
        width={MARKER_SIZE + 8}
        height={MARKER_SIZE + 4}
        fill="transparent"
      />
      <polygon points={points} fill={color} stroke="#555" strokeWidth="0.7" />
    </g>
  );
}

export function Ruler({
  width = 500,
  leftIndent = 0,
  rightIndent = 0,
  onLeftIndentChange,
  onRightIndentChange,
}) {
  const rulerRef = useRef(null);
  const [rulerWidth, setRulerWidth] = useState(width);
  const dragStartRef = useRef({});

  useEffect(() => {
    if (rulerRef.current) {
      const w = rulerRef.current.getBoundingClientRect().width;
      if (w > 0) setRulerWidth(w);
    }
  }, [width]);

  // Left indent
  const handleLeftStart = useCallback(() => {
    dragStartRef.current.left = leftIndent;
  }, [leftIndent]);

  const handleLeftMove = useCallback((delta) => {
    const val = clamp(Math.round(dragStartRef.current.left + delta), 0, rulerWidth - 40);
    onLeftIndentChange?.(val);
  }, [rulerWidth, onLeftIndentChange]);

  // Right indent
  const handleRightStart = useCallback(() => {
    dragStartRef.current.right = rightIndent;
  }, [rightIndent]);

  const handleRightMove = useCallback((delta) => {
    const startRight = dragStartRef.current.right || 0;
    const val = clamp(Math.round(startRight - delta), 0, rulerWidth - 40);
    onRightIndentChange?.(val);
  }, [rulerWidth, onRightIndentChange]);

  // Generate tick marks
  const ticks = [];
  for (let x = 0; x <= rulerWidth; x += 10) {
    const isMajor = x % TICK_MAJOR_INTERVAL === 0;
    const tickH = isMajor ? 10 : 4;
    ticks.push(
      <line
        key={x}
        x1={x}
        y1={RULER_HEIGHT - tickH}
        x2={x}
        y2={RULER_HEIGHT}
        stroke="#999"
        strokeWidth={isMajor ? 1 : 0.5}
      />
    );
  }

  return (
    <div
      ref={rulerRef}
      className="relative select-none"
      style={{ width: '100%', height: RULER_HEIGHT + 2, marginBottom: 2 }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <svg
        width="100%"
        height={RULER_HEIGHT + 2}
        viewBox={`0 0 ${rulerWidth} ${RULER_HEIGHT + 2}`}
        preserveAspectRatio="none"
        style={{ display: 'block' }}
      >
        {/* Ruler background */}
        <rect x="0" y="0" width={rulerWidth} height={RULER_HEIGHT} fill="#f8f8f8" stroke="#ddd" strokeWidth="0.5" />

        {/* Tick marks */}
        {ticks}

        {/* Active area indicator */}
        <rect
          x={leftIndent}
          y={RULER_HEIGHT - 3}
          width={Math.max(0, rulerWidth - rightIndent - leftIndent)}
          height={3}
          fill="#bfdbfe"
          rx={1}
        />

        {/* Left indent marker (points down) */}
        <MarkerTriangle
          x={leftIndent}
          y={RULER_HEIGHT / 2 - MARKER_SIZE / 2}
          direction="down"
          color="#3b82f6"
          onDragStart={handleLeftStart}
          onDragMove={handleLeftMove}
          title="Left Indent"
        />

        {/* Right indent marker (points down) */}
        <MarkerTriangle
          x={rulerWidth - rightIndent}
          y={RULER_HEIGHT / 2 - MARKER_SIZE / 2}
          direction="down"
          color="#3b82f6"
          onDragStart={handleRightStart}
          onDragMove={handleRightMove}
          title="Right Indent"
        />
      </svg>
    </div>
  );
}
