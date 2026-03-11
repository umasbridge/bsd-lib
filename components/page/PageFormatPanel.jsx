import { useState, useRef, useLayoutEffect } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { DEFAULT_LEFT_MARGIN, DEFAULT_RIGHT_MARGIN, DEFAULT_ELEMENT_SPACING } from './types';

/**
 * PageFormatPanel - Floating panel for page-level formatting.
 * Opened by clicking the content area border.
 * Controls: left/right margins, element spacing.
 */
export function PageFormatPanel({ page, onUpdate, onClose, position }) {
  const [showMargins, setShowMargins] = useState(true);
  const [showSpacing, setShowSpacing] = useState(true);
  const panelRef = useRef(null);
  const [adjustedPos, setAdjustedPos] = useState({ left: position.x, top: position.y + 10 });

  // Position adjustment to stay in viewport
  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = Math.max(10, position.x);
    let top = position.y + 10;
    if (left + rect.width > vw - 10) left = vw - rect.width - 10;
    if (top + rect.height > vh - 10) top = position.y - rect.height - 10;
    left = Math.max(10, left);
    top = Math.max(10, top);
    setAdjustedPos({ left, top });
  }, [position, showMargins, showSpacing]);

  const leftMargin = page.leftMargin ?? DEFAULT_LEFT_MARGIN;
  const rightMargin = page.rightMargin ?? DEFAULT_RIGHT_MARGIN;
  const elementSpacing = page.elementSpacing ?? DEFAULT_ELEMENT_SPACING;

  return (
    <div
      ref={panelRef}
      data-page-format-panel
      style={{
        position: 'fixed',
        zIndex: 50,
        background: 'white',
        border: '1px solid #e5e7eb',
        borderRadius: '8px',
        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
        padding: '16px',
        width: '250px',
        left: adjustedPos.left,
        top: adjustedPos.top,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontWeight: 500, fontSize: '14px', margin: 0 }}>Page Format</h3>
        <button
          onClick={onClose}
          style={{ padding: '2px', border: 'none', background: 'none', cursor: 'pointer', color: '#6b7280', display: 'flex', alignItems: 'center' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Margins */}
      <div style={{ marginBottom: '16px' }}>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280', border: 'none', background: 'none', cursor: 'pointer', padding: 0, marginBottom: '8px' }}
          onClick={() => setShowMargins(!showMargins)}
        >
          <ChevronDown size={12} style={{ transform: showMargins ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
          Margins (L:{leftMargin}px / R:{rightMargin}px)
        </button>
        {showMargins && (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Left</span>
                <input
                  type="number"
                  value={leftMargin}
                  onChange={(e) => onUpdate({ leftMargin: Math.max(0, Math.min(200, Number(e.target.value))) })}
                  min="0" max="200"
                  style={{ width: '100%', height: '28px', padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: '11px', color: '#9ca3af', marginBottom: '2px' }}>Right</span>
                <input
                  type="number"
                  value={rightMargin}
                  onChange={(e) => onUpdate({ rightMargin: Math.max(0, Math.min(200, Number(e.target.value))) })}
                  min="0" max="200"
                  style={{ width: '100%', height: '28px', padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px' }}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[10, 20, 40, 60].map(m => (
                <button
                  key={m}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
                    border: leftMargin === m && rightMargin === m ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                    background: leftMargin === m && rightMargin === m ? '#eff6ff' : 'white',
                    color: leftMargin === m && rightMargin === m ? '#2563eb' : '#374151',
                  }}
                  onClick={() => onUpdate({ leftMargin: m, rightMargin: m })}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Element Spacing */}
      <div>
        <button
          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#6b7280', border: 'none', background: 'none', cursor: 'pointer', padding: 0, marginBottom: '8px' }}
          onClick={() => setShowSpacing(!showSpacing)}
        >
          <ChevronDown size={12} style={{ transform: showSpacing ? 'none' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
          Element Spacing ({elementSpacing}px)
        </button>
        {showSpacing && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input
                type="range" min="0" max="100"
                value={elementSpacing}
                onChange={(e) => onUpdate({ elementSpacing: Number(e.target.value) })}
                style={{ flex: 1, accentColor: '#3b82f6' }}
              />
              <input
                type="number"
                value={elementSpacing}
                onChange={(e) => onUpdate({ elementSpacing: Math.max(0, Math.min(100, Number(e.target.value))) })}
                min="0" max="100"
                style={{ width: '48px', height: '28px', padding: '2px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px', textAlign: 'center' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '4px' }}>
              {[20, 30, 43, 60].map(s => (
                <button
                  key={s}
                  style={{
                    flex: 1, padding: '4px 0', borderRadius: '4px', fontSize: '12px', cursor: 'pointer',
                    border: elementSpacing === s ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                    background: elementSpacing === s ? '#eff6ff' : 'white',
                    color: elementSpacing === s ? '#2563eb' : '#374151',
                  }}
                  onClick={() => onUpdate({ elementSpacing: s })}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
