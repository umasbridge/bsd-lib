import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { X } from 'lucide-react';
import { TextEl } from '../text_el';
import { BidTable } from '../bid_table';
import { TitleBar } from './TitleBar';
import { PageFormatPanel } from './PageFormatPanel';
import {
  DEFAULT_LEFT_MARGIN,
  DEFAULT_RIGHT_MARGIN,
  DEFAULT_ELEMENT_SPACING,
  MIN_PAGE_WIDTH,
  MAX_ELEMENT_WIDTH,
} from './types';

const TITLE_ID = '__title__';

/**
 * Page - Self-contained page component.
 *
 * Modes:
 * - 'main': Save button, view/edit toggle. Full persistence control.
 * - 'split': X at top right, no save. Changes stay in memory. Opens adjacent to caller.
 * - 'popup': Like split, but height adjusts to content (up to maxHeight). Opens as floating popup.
 * - 'newpage': Like split, but opens in a new tab.
 *
 * Layout: Title (+ X for sub-pages) → line → content → line → bottom buttons
 *
 * Interactions with parent:
 * - Main: onSave(pageData), onPageChange(pageData) for live sync
 * - Sub-pages: onClose(), onPageChange(pageData) for live sync
 */
export function Page({
  initialPage,
  mode = 'main',
  onSave,
  onClose,
  onExit,
  onPageChange,
  mainPageId,
  startInEditMode = false,
  editMode,
  onEditModeChange,
  externalDirty = false,
  maxHeight,
}) {
  const isMain = mode === 'main';
  const isPopup = mode === 'popup';
  const isSubPage = !isMain; // split, popup, newpage

  // --- State ---
  const [page, setPage] = useState(() => JSON.parse(JSON.stringify(initialPage)));
  const pageRef = useRef(page);
  const [isViewMode, setIsViewMode] = useState(isMain ? !startInEditMode : !editMode);
  const [isDirty, setIsDirty] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Sub-pages sync view mode when main page toggles edit/view
  useEffect(() => {
    if (isSubPage && editMode !== undefined) {
      setIsViewMode(!editMode);
    }
  }, [isSubPage, editMode]);

  const [selectedElementId, setSelectedElementId] = useState(null);
  const [pageFormatPosition, setPageFormatPosition] = useState(null);
  const [showInsertMenu, setShowInsertMenu] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [copiedElement, setCopiedElement] = useState(null);

  const containerRef = useRef(null);
  const contentAreaRef = useRef(null);

  // --- Notify parent of page changes (for sub-pages: live sync to main) ---
  const notifyParent = useCallback((updatedPage) => {
    onPageChange?.(updatedPage);
  }, [onPageChange]);

  // --- Copied element from sessionStorage ---
  useEffect(() => {
    const check = () => {
      const data = sessionStorage.getItem('copiedPageElement');
      if (data) {
        try { setCopiedElement(JSON.parse(data)); } catch { setCopiedElement(null); }
      } else {
        setCopiedElement(null);
      }
    };
    check();
    window.addEventListener('storage', check);
    const interval = setInterval(check, 500);
    return () => { window.removeEventListener('storage', check); clearInterval(interval); };
  }, []);

  // --- Page & element mutations ---
  // All mutations use pageRef to compute updates synchronously.
  // This avoids relying on React's eager state computation (which may
  // defer the updater if the fiber has pending work from child components),
  // ensuring notifyParent always receives the correct data.

  const updatePage = useCallback((updates) => {
    const updatedPage = { ...pageRef.current, ...updates };
    pageRef.current = updatedPage;
    setPage(updatedPage);
    notifyParent(updatedPage);
    setIsDirty(true);
  }, [notifyParent]);

  const updateElement = useCallback((elementId, updates) => {
    const updatedPage = {
      ...pageRef.current,
      elements: pageRef.current.elements.map(el =>
        el.id === elementId ? { ...el, ...updates } : el
      ),
    };
    pageRef.current = updatedPage;
    setPage(updatedPage);
    notifyParent(updatedPage);
    setIsDirty(true);
  }, [notifyParent]);

  const addElement = useCallback((type) => {
    const cur = pageRef.current;
    const maxOrder = cur.elements.length > 0
      ? Math.max(...cur.elements.map(e => e.order))
      : 0;
    const id = `el-${Date.now()}`;
    const newEl = type === 'text'
      ? {
          id, type: 'text', order: maxOrder + 1,
          content: '', htmlContent: '', width: 400,
          borderColor: '#d1d5db', borderWidth: 2, fillColor: 'transparent',
        }
      : {
          id, type: 'bidtable', order: maxOrder + 1,
          rows: [{ id: '1', bid: '', columns: [{ value: '' }], children: [] }],
          name: '', showName: true, width: 600,
          columnWidths: [450], levelWidths: { 0: 80 },
          gridlines: { enabled: true, color: '#D1D5DB', width: 1 },
          borderColor: '#d1d5db', borderWidth: 1,
        };
    const updatedPage = { ...cur, elements: [...cur.elements, newEl] };
    pageRef.current = updatedPage;
    setPage(updatedPage);
    notifyParent(updatedPage);
    setIsDirty(true);
    setShowInsertMenu(false);
  }, [notifyParent]);

  const deleteElement = useCallback((elementId) => {
    const updatedPage = {
      ...pageRef.current,
      elements: pageRef.current.elements.filter(el => el.id !== elementId),
    };
    pageRef.current = updatedPage;
    setPage(updatedPage);
    notifyParent(updatedPage);
    setSelectedElementId(null);
    setIsDirty(true);
  }, [notifyParent]);

  const moveElement = useCallback((elementId, direction) => {
    const cur = pageRef.current;
    const sorted = [...cur.elements].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(e => e.id === elementId);
    if (idx === -1) return;
    if (direction === 'up' && idx > 0) {
      const tmp = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[idx - 1].order };
      sorted[idx - 1] = { ...sorted[idx - 1], order: tmp };
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const tmp = sorted[idx].order;
      sorted[idx] = { ...sorted[idx], order: sorted[idx + 1].order };
      sorted[idx + 1] = { ...sorted[idx + 1], order: tmp };
    }
    const updatedPage = { ...cur, elements: sorted };
    pageRef.current = updatedPage;
    setPage(updatedPage);
    notifyParent(updatedPage);
    setIsDirty(true);
  }, [notifyParent]);

  // --- Copy / Paste ---
  const copyElement = useCallback((element) => {
    const copy = JSON.parse(JSON.stringify(element));
    sessionStorage.setItem('copiedPageElement', JSON.stringify(copy));
    setCopiedElement(copy);
  }, []);

  const pasteElement = useCallback(() => {
    if (!copiedElement) return;
    const cur = pageRef.current;
    const maxOrder = cur.elements.length > 0
      ? Math.max(...cur.elements.map(e => e.order))
      : 0;
    const pasted = {
      ...JSON.parse(JSON.stringify(copiedElement)),
      id: `el-${Date.now()}`,
      order: maxOrder + 1,
    };
    if (pasted.type === 'bidtable' && pasted.rows) {
      let counter = 1;
      const reId = (rows) => rows.map(r => ({
        ...r,
        id: `p${Date.now()}-${counter++}`,
        children: r.children ? reId(r.children) : [],
      }));
      pasted.rows = reId(pasted.rows);
    }
    const updatedPage = { ...cur, elements: [...cur.elements, pasted] };
    pageRef.current = updatedPage;
    setPage(updatedPage);
    notifyParent(updatedPage);
    setIsDirty(true);
  }, [copiedElement, notifyParent]);

  // --- Save / Discard / Exit (main page only) ---
  const handleSave = useCallback(async () => {
    await onSave?.(pageRef.current);
    setIsDirty(false);
    setIsViewMode(true);
    onEditModeChange?.(false);
  }, [onSave, onEditModeChange]);

  const handleDiscard = useCallback(() => {
    const fresh = JSON.parse(JSON.stringify(initialPage));
    pageRef.current = fresh;
    setPage(fresh);
    setIsDirty(false);
    setIsViewMode(true);
    onEditModeChange?.(false);
    setResetKey(k => k + 1);
    setSelectedElementId(null);
  }, [initialPage, onEditModeChange]);

  const handleViewSaveToggle = useCallback(() => {
    if (!isViewMode && (isDirty || externalDirty)) {
      setShowSaveDialog(true);
    } else if (onExit) {
      onExit();
    }
  }, [isViewMode, isDirty, externalDirty, onExit]);

  // --- Click-outside handlers ---
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setSelectedElementId(null);
      }
      const insertMenu = document.querySelector('[data-insert-menu]');
      if (!insertMenu || !insertMenu.contains(e.target)) {
        setShowInsertMenu(false);
      }
      const panel = document.querySelector('[data-page-format-panel]');
      if (panel && !panel.contains(e.target)) {
        setPageFormatPosition(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // --- Content area border click → page format panel ---
  const handleContentAreaClick = useCallback((e) => {
    if (isViewMode) return;
    const area = contentAreaRef.current;
    if (!area) return;
    const rect = area.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width;
    const h = rect.height;
    const edge = 8;
    if (x < edge || x > w - edge || y < edge || y > h - edge) {
      e.stopPropagation();
      setPageFormatPosition({ x: e.clientX, y: e.clientY });
      setSelectedElementId(null);
    } else {
      const target = e.target;
      if (target === e.currentTarget || target.parentElement === e.currentTarget) {
        setSelectedElementId(null);
      }
    }
  }, [isViewMode]);

  // --- Hyperlink click ---
  // (onHyperlinkClick + onCreatePage are provided via EditorContext, not props)

  // --- Derived values ---
  const sortedElements = useMemo(() =>
    [...page.elements].filter(el => !el.popupOnly).sort((a, b) => a.order - b.order),
    [page.elements]
  );

  const leftMargin = page.leftMargin ?? DEFAULT_LEFT_MARGIN;
  const rightMargin = page.rightMargin ?? DEFAULT_RIGHT_MARGIN;
  const elementSpacing = page.elementSpacing ?? DEFAULT_ELEMENT_SPACING;

  // Dynamic page width: tracks widest element + margins
  const dynamicPageWidth = useMemo(() => {
    let widest = 0;
    for (const el of page.elements) {
      if (el.type === 'bidtable') {
        const bidW = (el.levelWidths?.[0] || 80);
        const totalW = Math.max(el.width || 400, bidW + 20) + 8;
        widest = Math.max(widest, totalW);
      } else if (el.type === 'text') {
        if (el.width) widest = Math.max(widest, el.width);
      } else if (el.type === 'html') {
        widest = Math.max(widest, el.width || MAX_ELEMENT_WIDTH);
      }
    }
    if (widest === 0) return MIN_PAGE_WIDTH;
    return Math.max(widest + leftMargin + rightMargin, MIN_PAGE_WIDTH);
  }, [page.elements, leftMargin, rightMargin]);

  // --- Render element ---
  const renderElement = (element, index) => {
    const total = sortedElements.length;
    const isFirst = index === 0;
    const isLast = index === total - 1;
    const isSelected = selectedElementId === element.id;
    const key = `${element.id}-${resetKey}`;

    const selectProps = {
      isSelected,
      onSelect: () => setSelectedElementId(element.id),
      onFocus: () => setSelectedElementId(null),
    };

    if (element.type === 'text') {
      return (
        <div key={key}>
          <TextEl
            mode="default"
            pageId={page.id}
            value={element.content}
            htmlValue={element.htmlContent}
            onChange={(text, html) => updateElement(element.id, { content: text, htmlContent: html })}
            readOnly={isViewMode}
            borderColor={element.borderColor}
            borderWidth={element.borderWidth}
            fillColor={element.fillColor}
            onStyleChange={(style) => updateElement(element.id, style)}
            width={element.width}
            maxWidth={MAX_ELEMENT_WIDTH}
            onWidthChange={(w) => updateElement(element.id, { width: w })}
            onCopy={() => copyElement(element)}
            onDelete={() => deleteElement(element.id)}
            onMoveUp={!isFirst ? () => moveElement(element.id, 'up') : undefined}
            onMoveDown={!isLast ? () => moveElement(element.id, 'down') : undefined}
            {...selectProps}
          />
        </div>
      );
    }

    if (element.type === 'html') {
      return (
        <div key={key} style={{ width: '100%' }}>
          <iframe
            srcDoc={element.content}
            style={{ width: '100%', border: 'none', minHeight: 400 }}
            title="HTML content"
            onLoad={(e) => {
              const doc = e.target.contentDocument;
              if (doc && doc.body) {
                // Remove default body margin/background for seamless embedding
                doc.body.style.margin = '0';
                doc.body.style.background = 'transparent';
                e.target.style.height = doc.body.scrollHeight + 40 + 'px';
              }
            }}
          />
        </div>
      );
    }

    if (element.type === 'bidtable') {
      return (
        <div key={key} data-table-name={element.name || ''}>
          <BidTable
            pageId={page.id}
            initialRows={element.rows}
            initialColumnWidths={element.columnWidths}
            initialLevelWidths={element.levelWidths}
            initialName={element.name}
            initialNameHtml={element.nameHtml}
            initialShowName={element.showName}
            width={element.width}
            maxWidth={MAX_ELEMENT_WIDTH}
            onWidthChange={(w) => updateElement(element.id, { width: w })}
            onRowsChange={(rows) => updateElement(element.id, { rows })}
            onColumnWidthsChange={(cw) => updateElement(element.id, { columnWidths: cw })}
            onLevelWidthsChange={(lw) => updateElement(element.id, { levelWidths: lw })}
            onNameChange={(name) => updateElement(element.id, { name })}
            onNameHtmlChange={(nameHtml) => updateElement(element.id, { nameHtml })}
            onShowNameChange={(showName) => updateElement(element.id, { showName })}
            isViewMode={isViewMode}
            borderColor={element.borderColor}
            borderWidth={element.borderWidth}
            onStyleChange={(style) => updateElement(element.id, style)}
            gridlines={element.gridlines}
            onGridlinesChange={(gl) => updateElement(element.id, { gridlines: gl })}
            startExpanded={element.startExpanded}
            defaultRowHeight={element.defaultRowHeight}
            onDefaultRowHeightChange={(h) => updateElement(element.id, { defaultRowHeight: h })}
            onCopy={() => copyElement(element)}
            onDelete={() => deleteElement(element.id)}
            onMoveUp={!isFirst ? () => moveElement(element.id, 'up') : undefined}
            onMoveDown={!isLast ? () => moveElement(element.id, 'down') : undefined}
            {...selectProps}
          />
        </div>
      );
    }

    return null;
  };

  // --- Container style ---
  // Popup mode: height fits content up to maxHeight, then scrolls
  // All other modes: fills available height
  const containerStyle = {
    width: dynamicPageWidth,
    backgroundColor: 'white',
    border: '2px solid #d1d5db',
    borderRadius: '2px',
    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  if (isPopup) {
    // Popup: fit content, cap at maxHeight
    containerStyle.maxHeight = maxHeight || '80vh';
  } else {
    // Main / split / newpage: fill parent height so content area scrolls
    containerStyle.height = '100%';
  }

  // --- Render ---
  return (
    <div
      ref={containerRef}
      style={containerStyle}
      onClick={(e) => { if (e.target === e.currentTarget) setSelectedElementId(null); }}
    >
      {/* Title row + X close button for sub-pages */}
      <div data-popup-header style={{ position: 'relative', flexShrink: 0 }}>
        <TitleBar
          title={page.title}
          titleHtml={page.titleHtml}
          onChange={(title, titleHtml) => updatePage({ title, titleHtml })}
          readOnly={isViewMode}
          isSelected={selectedElementId === TITLE_ID}
          onSelect={() => setSelectedElementId(TITLE_ID)}
          onFocus={() => setSelectedElementId(null)}
          width={page.titleWidth}
          maxWidth={dynamicPageWidth - leftMargin - rightMargin}
          onWidthChange={(w) => updatePage({ titleWidth: w })}
          paddingLeft={leftMargin}
          paddingRight={isSubPage ? leftMargin + 28 : rightMargin}
        />
        {/* X close button for split / popup / newpage */}
        {isSubPage && onClose && (
          <button
            onClick={onClose}
            style={{
              position: 'absolute', top: '10px', right: '10px',
              width: '24px', height: '24px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: 'none', background: 'none', cursor: 'pointer',
              color: '#6b7280', borderRadius: '4px',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; e.currentTarget.style.color = '#111827'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#6b7280'; }}
            title="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Content area — between the two lines */}
      <div
        ref={contentAreaRef}
        className={isPopup ? '' : 'flex-1'}
        style={{
          borderTop: '1px solid #e5e7eb',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: page.backgroundColor || 'white',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
        onClick={handleContentAreaClick}
      >
        <div
          style={{
            paddingTop: '20px',
            paddingLeft: `${leftMargin}px`,
            paddingRight: `${rightMargin}px`,
            paddingBottom: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: `${elementSpacing}px`,
          }}
        >
          {sortedElements.map((el, i) => renderElement(el, i))}
        </div>
      </div>

      {/* Bottom button bar */}
      <div
        style={{ background: 'white', flexShrink: 0, padding: `12px ${leftMargin}px` }}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left: Insert + Paste (edit mode only) */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {!isViewMode && (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setShowInsertMenu(prev => !prev)}
                  style={{
                    padding: '6px 12px', fontSize: '14px', border: '1px solid #d1d5db',
                    borderRadius: '6px', background: 'white', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                >
                  Insert
                </button>
                {showInsertMenu && (
                  <div
                    data-insert-menu
                    style={{
                      position: 'absolute', bottom: '100%', left: 0, marginBottom: '4px',
                      background: 'white', border: '1px solid #d1d5db', borderRadius: '6px',
                      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', zIndex: 30,
                      minWidth: '120px', overflow: 'hidden',
                    }}
                  >
                    <button
                      onClick={() => addElement('bidtable')}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', fontSize: '14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Table
                    </button>
                    <button
                      onClick={() => addElement('text')}
                      style={{ display: 'block', width: '100%', padding: '8px 12px', fontSize: '14px', textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer' }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                    >
                      Text
                    </button>
                  </div>
                )}
              </div>
            )}
            {!isViewMode && copiedElement && (
              <button
                onClick={pasteElement}
                style={{
                  padding: '6px 12px', fontSize: '14px', borderRadius: '6px', cursor: 'pointer',
                  border: '1px solid #86efac', background: 'white', color: '#15803d',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f0fdf4'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
              >
                Paste
              </button>
            )}
          </div>

          {/* Right: Edit (view mode only) + Exit (always) */}
          {isMain && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {isViewMode && (
                <button
                  onClick={() => { setIsViewMode(false); onEditModeChange?.(true); }}
                  style={{
                    padding: '6px 12px', fontSize: '14px', border: '1px solid #d1d5db',
                    borderRadius: '6px', background: 'white', cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
                >
                  Edit
                </button>
              )}
              <button
                onClick={handleViewSaveToggle}
                style={{
                  padding: '6px 12px', fontSize: '14px', borderRadius: '6px', cursor: 'pointer',
                  border: '1px solid #d1d5db', background: 'white',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#f9fafb'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'white'; }}
              >
                Exit
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Save/Discard Dialog (main only) */}
      {isMain && showSaveDialog && (
        <div
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          }}
          onClick={() => setShowSaveDialog(false)}
        >
          <div
            style={{
              background: 'white', borderRadius: '8px', padding: '24px',
              minWidth: '300px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p style={{ fontSize: '15px', color: '#374151', marginBottom: '20px' }}>
              You have unsaved changes.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => { setShowSaveDialog(false); handleDiscard(); onExit?.(); }}
                style={{
                  padding: '6px 14px', fontSize: '14px', border: '1px solid #d1d5db',
                  borderRadius: '6px', background: 'white', cursor: 'pointer',
                }}
              >
                Discard changes
              </button>
              <button
                onClick={async () => { setShowSaveDialog(false); await handleSave(); onExit?.(); }}
                style={{
                  padding: '6px 14px', fontSize: '14px', borderRadius: '6px', cursor: 'pointer',
                  border: '1px solid #93c5fd', background: '#eff6ff', color: '#1d4ed8', fontWeight: 500,
                }}
              >
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Format Panel */}
      {pageFormatPosition && !isViewMode && (
        <PageFormatPanel
          page={page}
          onUpdate={updatePage}
          onClose={() => setPageFormatPosition(null)}
          position={pageFormatPosition}
        />
      )}
    </div>
  );
}
