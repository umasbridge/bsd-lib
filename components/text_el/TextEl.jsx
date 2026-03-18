import { useEffect, useRef, useState, useCallback, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Resizable } from 're-resizable';
import { EditorContent } from '@tiptap/react';
import { MessageSquare } from 'lucide-react';
import { useTiptapEditor } from './useTiptapEditor';
import { BlockFormatBar } from './BlockFormatBar';
import { TextFormatPanel } from './TextFormatPanel';
import { HyperlinkMenu } from './HyperlinkMenu';
import { DiscussionMenu } from './DiscussionMenu';
import { ElementFormatPanel } from './ElementFormatPanel';
import { Ruler } from './Ruler';
import { getCurrentIndent } from './ParagraphIndent';
import { useEditorContext } from '../EditorContext';
import { LAYOUT } from './types';

/**
 * TextEl - Rich text component with two modes (powered by Tiptap)
 *
 * Modes:
 * - default: Full features (formatting, hyperlinks, resize, element styling)
 * - cell: For BidTable cells (no resize, no element border/fill, but hyperlinks + formatting)
 *
 * Three context-sensitive menus (default mode):
 * - Menu 1 (TextFormatPanel): text selected -> bold, italic, color, hyperlink
 * - Menu 2 (BlockFormatBar): cursor inside, no selection -> alignment, lists
 * - Menu 3 (ElementFormatPanel): border clicked (isSelected) -> border, fill, copy
 *
 * Cell mode only has Menu 1 and Menu 2 (no Menu 3).
 */
export function TextEl({
  mode,
  pageId,
  value,
  htmlValue,
  onChange,
  readOnly = false,
  placeholder,
  minHeight,
  onFocus,
  onBlur,
  className = '',
  // Element styling (default mode only)
  borderColor = '#d1d5db',
  borderWidth = 2,
  fillColor = 'transparent',
  onStyleChange,
  isSelected = false,
  onSelect,
  onCopy,
  onDelete,
  onMoveUp,
  onMoveDown,
  width,
  maxWidth,
  onWidthChange,
}) {
  const { onCreateDiscussion, onAddToDiscussion, onAfterDiscussionApply } = useEditorContext();
  const effectiveMinHeight = minHeight ?? (mode === 'cell' ? 20 : LAYOUT.MIN_ELEMENT_HEIGHT);

  const wrapperRef = useRef(null);
  const floatingBarRef = useRef(null);

  // Ruler reads/writes per-paragraph indent via the editor (default mode only).
  // State tracks current paragraph's indent for the ruler display; updated on selection change.
  const [rulerIndent, setRulerIndent] = useState({ left: 0, right: 0 });

  const {
    editor,
    selection,
    showFormatPanel,
    showHyperlinkMenu,
    showDiscussionMenu,
    isFocused,
    openHyperlinkMenu,
    openDiscussionMenu,
    closePanels,
    applyFormat,
    applyHyperlink,
    removeHyperlink,
    applyDiscussionHighlight,
  } = useTiptapEditor({
    mode,
    initialHtml: htmlValue || value,
    onChange,
    onFocus,
    onBlur,
    readOnly,
  });

  // Sync external htmlValue changes (but not while focused, to avoid cursor reset)
  useEffect(() => {
    if (editor && htmlValue !== undefined && !isFocused) {
      const currentHtml = editor.getHTML();
      if (currentHtml !== htmlValue) {
        editor.commands.setContent(htmlValue, false);
      }
    }
  }, [editor, htmlValue, isFocused]);

  // Position floating block format bar for cell mode (avoid clipping in narrow cells)
  useLayoutEffect(() => {
    if (mode !== 'cell' || !floatingBarRef.current || !editor?.view?.dom) return;
    const rect = editor.view.dom.getBoundingClientRect();
    floatingBarRef.current.style.left = rect.left + 'px';
    floatingBarRef.current.style.top = rect.top + 'px';
  });

  // Handle click on element border (default mode) - selects element for Menu 3
  const handleWrapperClick = (e) => {
    if (mode !== 'default' || readOnly) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const edge = 10;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const isOnBorder = x <= edge || x >= rect.width - edge || y <= edge || y >= rect.height - edge;
    if (isOnBorder) {
      e.stopPropagation();
      e.preventDefault();
      // Clear text selection and blur so menus 1/2 dismiss
      window.getSelection()?.removeAllRanges();
      editor?.commands.blur();
      onSelect?.();
      closePanels();
    }
  };

  // Prevent focus when mousedown is on the border area
  const handleWrapperMouseDown = (e) => {
    if (mode !== 'default' || readOnly) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const edge = 10;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const isOnBorder = x <= edge || x >= rect.width - edge || y <= edge || y >= rect.height - edge;
    if (isOnBorder) {
      e.preventDefault();
    }
  };

  // Tiptap editor classes
  const modeClasses = {
    default: 'p-3 min-w-[100px]',
    cell: 'px-2 text-sm',
  };

  const editorClassName = `outline-none whitespace-pre-wrap break-words leading-relaxed ${modeClasses[mode] || ''} ${className}`.trim();

  // Apply classes and styles to Tiptap's editor DOM
  useEffect(() => {
    if (!editor?.view?.dom) return;
    const dom = editor.view.dom;
    dom.className = `tiptap ${editorClassName}`;
    dom.style.minHeight = effectiveMinHeight + 'px';
    dom.style.cursor = readOnly ? 'default' : 'text';
    if (mode === 'cell') {
      // Vertically center text within the cell.
      dom.style.display = 'flex';
      dom.style.flexDirection = 'column';
      dom.style.justifyContent = 'center';
      dom.style.paddingTop = '1px';
      dom.style.paddingBottom = '1px';
      dom.style.lineHeight = '1.3';
    }
    if (placeholder) {
      dom.setAttribute('data-placeholder', placeholder);
    }
  }, [editor, editorClassName, effectiveMinHeight, mode, readOnly, placeholder]);

  // Sync ruler display from the current paragraph's indent attributes
  useEffect(() => {
    if (mode !== 'default' || !editor) return;
    const updateRuler = () => {
      const indent = getCurrentIndent(editor);
      setRulerIndent(prev => {
        if (prev.left === indent.left && prev.right === indent.right) return prev;
        return indent;
      });
    };
    editor.on('selectionUpdate', updateRuler);
    editor.on('transaction', updateRuler);
    return () => {
      editor.off('selectionUpdate', updateRuler);
      editor.off('transaction', updateRuler);
    };
  }, [mode, editor]);

  // Ruler drag handlers — update the current paragraph's indent via Tiptap commands
  const handleRulerLeftChange = useCallback((value) => {
    if (!editor) return;
    editor.chain().focus().setIndentLeft(value).run();
  }, [editor]);

  const handleRulerRightChange = useCallback((value) => {
    if (!editor) return;
    editor.chain().focus().setIndentRight(value).run();
  }, [editor]);

  // ReadOnly mode: detect native text selection for discussion button
  const [readOnlySelection, setReadOnlySelection] = useState(null); // { text, position, pmRange }
  const [readOnlyDiscussionMenu, setReadOnlyDiscussionMenu] = useState(false);

  useEffect(() => {
    if (!readOnly || !editor?.view?.dom) return;
    const dom = editor.view.dom;

    const handleMouseUp = () => {
      // Small delay to let browser finalize selection
      setTimeout(() => {
        const sel = window.getSelection();
        if (!sel || sel.isCollapsed || !dom.contains(sel.anchorNode)) {
          if (!readOnlyDiscussionMenu) setReadOnlySelection(null);
          return;
        }
        const text = sel.toString().trim();
        if (!text) {
          if (!readOnlyDiscussionMenu) setReadOnlySelection(null);
          return;
        }
        const range = sel.getRangeAt(0);
        const rect = range.getBoundingClientRect();

        // Capture ProseMirror positions NOW while native selection exists
        let pmRange = null;
        try {
          const { view } = editor;
          const anchor = view.posAtDOM(sel.anchorNode, sel.anchorOffset);
          const head = view.posAtDOM(sel.focusNode, sel.focusOffset);
          pmRange = { from: Math.min(anchor, head), to: Math.max(anchor, head) };
        } catch {
          // posAtDOM can fail if selection is outside editor
        }

        setReadOnlySelection({
          text,
          position: { x: rect.left + rect.width / 2, y: rect.top, bottom: rect.bottom },
          pmRange,
        });
      }, 10);
    };

    const handleMouseDown = (e) => {
      if (e.target.closest('[data-discussion-menu]')) return;
      if (readOnlyDiscussionMenu) {
        setReadOnlyDiscussionMenu(false);
        setReadOnlySelection(null);
      }
    };

    dom.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      dom.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [readOnly, editor, readOnlyDiscussionMenu]);

  const handleReadOnlyDiscussionApply = useCallback(async (target) => {
    if (!editor || !readOnlySelection?.pmRange) return;

    const { from, to } = readOnlySelection.pmRange;
    const highlightText = readOnlySelection.text;

    // Create discussion first (before toggling editable, to avoid triggering onChange)
    let discussionId;
    if (target.isNew) {
      if (!onCreateDiscussion) return;
      discussionId = await onCreateDiscussion(target.discussionName, highlightText);
      if (!discussionId) return;
    } else {
      discussionId = target.discussionId;
      if (onAddToDiscussion) onAddToDiscussion(discussionId, highlightText);
    }

    // Temporarily enable editing, set selection, apply mark, restore
    editor.setEditable(true);
    editor.chain().setTextSelection({ from, to }).setMark('discussionHighlight', { 'data-discussion-id': discussionId }).run();
    editor.setEditable(false);

    setReadOnlyDiscussionMenu(false);
    setReadOnlySelection(null);

    // Auto-save so the highlight persists
    if (onAfterDiscussionApply) onAfterDiscussionApply();
  }, [editor, readOnlySelection, onCreateDiscussion, onAddToDiscussion, onAfterDiscussionApply]);

  // Menus are mutually exclusive. isSelected (border click) takes priority.
  const showMenu3 = isSelected && !readOnly;
  const showMenu2 = !readOnly && isFocused && !showHyperlinkMenu && !showDiscussionMenu && !isSelected && !selection.hasSelection;
  const showMenu1 = !readOnly && showFormatPanel && !showHyperlinkMenu && !showDiscussionMenu && selection.hasSelection && !isSelected;

  // Default mode: full wrapper with border, fill, resize
  if (mode === 'default') {
    const resizeEnabled = !readOnly && isSelected;

    return (
      <div className="relative" onClick={(e) => e.stopPropagation()}>
        <Resizable
          size={{ width: width || '100%', height: 'auto' }}
          minWidth={100}
          maxWidth={maxWidth}
          enable={{
            right: resizeEnabled,
            top: false, bottom: false, left: false,
            topRight: false, bottomRight: false, bottomLeft: false, topLeft: false,
          }}
          onResizeStop={(_e, _direction, _ref, d) => {
            if (onWidthChange) {
              const currentW = width || _ref.offsetWidth - d.width;
              let newWidth = currentW + d.width;
              if (maxWidth && newWidth > maxWidth) newWidth = maxWidth;
              onWidthChange(Math.max(100, newWidth));
            }
          }}
          handleStyles={{
            right: { width: '6px', right: '-3px', cursor: 'col-resize' },
          }}
          handleClasses={{
            right: resizeEnabled ? 'hover:bg-blue-400 rounded' : '',
          }}
        >
          {/* Element wrapper with border and fill */}
          <div
            ref={wrapperRef}
            className="rounded transition-shadow"
            style={{
              border: `${borderWidth}px solid ${borderColor}`,
              backgroundColor: fillColor === 'transparent' ? 'white' : fillColor,
              ...(isSelected ? { boxShadow: '0 0 0 2px white, 0 0 0 4px #3b82f6' } : {}),
            }}
            onMouseDown={handleWrapperMouseDown}
            onClick={handleWrapperClick}
          >
            {/* Menu 3: Element Format Panel */}
            {showMenu3 && (
              <ElementFormatPanel
                borderColor={borderColor}
                borderWidth={borderWidth}
                fillColor={fillColor}
                onStyleChange={onStyleChange}
                onCopy={onCopy}
                onDelete={onDelete}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
            )}

            {/* Menu 2: Block Format Bar */}
            {showMenu2 && (
              <BlockFormatBar mode={mode} onFormat={applyFormat} />
            )}

            {/* Ruler - shown when focused in edit mode */}
            {!readOnly && isFocused && (
              <Ruler
                width={width || 500}
                leftIndent={rulerIndent.left}
                rightIndent={rulerIndent.right}
                onLeftIndentChange={handleRulerLeftChange}
                onRightIndentChange={handleRulerRightChange}
              />
            )}

            {/* Tiptap editor */}
            <EditorContent editor={editor} />
          </div>

          {/* Menu 1: Text Format Panel */}
          {showMenu1 && (
            <TextFormatPanel
              mode={mode}
              position={selection.position}
              onFormat={applyFormat}
              onOpenHyperlink={openHyperlinkMenu}
              onRemoveHyperlink={removeHyperlink}
              isHyperlinkSelected={selection.isHyperlinkSelected}
              onOpenDiscussion={openDiscussionMenu}
            />
          )}

          {/* Hyperlink Menu */}
          {!readOnly && showHyperlinkMenu && (
            <HyperlinkMenu
              pageId={pageId}
              selectedText={selection.selectedText}
              position={selection.position}
              onApply={applyHyperlink}
              onClose={closePanels}
            />
          )}

          {/* Discussion Menu */}
          {!readOnly && showDiscussionMenu && (
            <DiscussionMenu
              selectedText={selection.selectedText}
              position={selection.position}
              onApply={applyDiscussionHighlight}
              onClose={closePanels}
            />
          )}

          {/* ReadOnly: floating discussion button on text selection */}
          {readOnly && readOnlySelection && !readOnlyDiscussionMenu && (
            <div
              data-discussion-menu=""
              className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1"
              style={{
                left: readOnlySelection.position.x - 20,
                top: readOnlySelection.position.y - 44,
              }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              <button
                className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
                onClick={() => setReadOnlyDiscussionMenu(true)}
                title="Discussion"
              >
                <MessageSquare className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* ReadOnly: discussion menu */}
          {readOnly && readOnlyDiscussionMenu && readOnlySelection && (
            <DiscussionMenu
              selectedText={readOnlySelection.text}
              position={readOnlySelection.position}
              onApply={handleReadOnlyDiscussionApply}
              onClose={() => { setReadOnlyDiscussionMenu(false); setReadOnlySelection(null); }}
            />
          )}
        </Resizable>
      </div>
    );
  }

  // Cell mode: simpler rendering, no border/fill/resize, no Menu 3
  return (
    <div className="relative flex-1 min-w-0">
      {/* Menu 2: Block Format Bar - via portal to avoid clipping in narrow cells */}
      {!readOnly && isFocused && !showHyperlinkMenu && !selection.hasSelection && createPortal(
        <div
          ref={floatingBarRef}
          style={{
            position: 'fixed',
            transform: 'translateY(-100%)',
            zIndex: 50,
          }}
        >
          <BlockFormatBar mode={mode} onFormat={applyFormat} />
        </div>,
        document.body
      )}

      {/* Tiptap editor */}
      <EditorContent editor={editor} />

      {/* Menu 1: Text Format Panel */}
      {!readOnly && showFormatPanel && !showHyperlinkMenu && !showDiscussionMenu && selection.hasSelection && (
        <TextFormatPanel
          mode={mode}
          position={selection.position}
          onFormat={applyFormat}
          onOpenHyperlink={openHyperlinkMenu}
          onRemoveHyperlink={removeHyperlink}
          isHyperlinkSelected={selection.isHyperlinkSelected}
          onOpenDiscussion={openDiscussionMenu}
        />
      )}

      {/* Hyperlink Menu */}
      {!readOnly && showHyperlinkMenu && (
        <HyperlinkMenu
          pageId={pageId}
          selectedText={selection.selectedText}
          position={selection.position}
          onApply={applyHyperlink}
          onClose={closePanels}
        />
      )}

      {/* Discussion Menu */}
      {!readOnly && showDiscussionMenu && (
        <DiscussionMenu
          selectedText={selection.selectedText}
          position={selection.position}
          onApply={applyDiscussionHighlight}
          onClose={closePanels}
        />
      )}

      {/* ReadOnly: floating discussion button on text selection */}
      {readOnly && readOnlySelection && !readOnlyDiscussionMenu && (
        <div
          data-discussion-menu=""
          className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg p-1"
          style={{
            left: readOnlySelection.position.x - 20,
            top: readOnlySelection.position.y - 44,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <button
            className="h-8 w-8 flex items-center justify-center rounded hover:bg-gray-100"
            onClick={() => setReadOnlyDiscussionMenu(true)}
            title="Discussion"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ReadOnly: discussion menu */}
      {readOnly && readOnlyDiscussionMenu && readOnlySelection && (
        <DiscussionMenu
          selectedText={readOnlySelection.text}
          position={readOnlySelection.position}
          onApply={handleReadOnlyDiscussionApply}
          onClose={() => { setReadOnlyDiscussionMenu(false); setReadOnlySelection(null); }}
        />
      )}
    </div>
  );
}

export default TextEl;
