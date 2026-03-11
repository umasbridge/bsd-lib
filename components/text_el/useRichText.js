import { useRef, useState, useCallback, useEffect } from 'react';
import {
  createHistoryController,
  saveSelectionAsBookmarks,
  restoreSelectionFromBookmarks,
  normalizeNodeTree,
  sanitizePastedHTML,
  getClipboardContent,
} from '../../utils/rte';
import { MODE_FEATURES } from './types';

/**
 * Custom hook for rich text editing functionality
 *
 * @param {{ mode: string, initialHtml?: string, onChange: (text: string, html: string) => void, onFocus?: () => void, onBlur?: () => void, onHyperlinkClick?: (target: object) => void, readOnly?: boolean }} options
 */
export function useRichText(options) {
  const { mode, initialHtml, onChange, onFocus, onBlur, onHyperlinkClick, readOnly } = options;
  const features = MODE_FEATURES[mode];

  // Refs
  const contentEditableRef = useRef(null);
  const historyController = useRef(null);
  const isInternalUpdate = useRef(false);
  const commitTimerRef = useRef(null);
  const panelInteractionRef = useRef(false);
  const savedSelectionRef = useRef(null);
  const hyperlinkRangeRef = useRef(null);

  // State
  const [selection, setSelection] = useState({
    hasSelection: false,
    selectedText: '',
    position: { x: 0, y: 0, bottom: 0 },
    isHyperlinkSelected: false,
    currentHyperlinkHref: undefined,
  });
  const [showFormatPanel, setShowFormatPanel] = useState(false);
  const [showHyperlinkMenu, setShowHyperlinkMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  // Initialize history controller
  useEffect(() => {
    historyController.current = createHistoryController();
    return () => {
      historyController.current?.clear();
    };
  }, []);

  // Initialize content on mount only
  const initialHtmlRef = useRef(initialHtml);
  useEffect(() => {
    if (contentEditableRef.current && initialHtmlRef.current) {
      contentEditableRef.current.innerHTML = initialHtmlRef.current;
    }
  }, []);

  // Global click handler to close panels when clicking outside
  useEffect(() => {
    const handleGlobalMouseDown = (e) => {
      const target = e.target;

      if (
        target.closest('[data-format-panel]') ||
        target.closest('[data-hyperlink-menu]') ||
        target.closest('[data-block-format-bar]')
      ) {
        panelInteractionRef.current = true;
        return;
      }

      if (contentEditableRef.current?.contains(target)) {
        return;
      }

      setShowFormatPanel(false);
      setShowHyperlinkMenu(false);
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown);
  }, []);

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      return sel.getRangeAt(0).cloneRange();
    }
    return null;
  }, []);

  const restoreSelection = useCallback((range) => {
    if (range) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(range);
      }
    }
  }, []);

  /**
   * Commit current state to history and notify parent
   * @param {boolean} normalize - if true, normalize the DOM tree
   */
  const commitMutation = useCallback((normalize = false) => {
    const root = contentEditableRef.current;
    if (!root) return;

    let bookmarks = null;

    if (normalize) {
      bookmarks = saveSelectionAsBookmarks(root);
      normalizeNodeTree(root);
      if (bookmarks) {
        restoreSelectionFromBookmarks(root, bookmarks);
      }
    }

    const html = root.innerHTML;
    historyController.current?.push(html, bookmarks);

    isInternalUpdate.current = true;
    onChange(root.textContent || '', html);
    isInternalUpdate.current = false;
  }, [onChange]);

  const scheduleCommit = useCallback(() => {
    if (commitTimerRef.current) {
      window.clearTimeout(commitTimerRef.current);
    }
    commitTimerRef.current = window.setTimeout(() => {
      commitMutation(false);
      commitTimerRef.current = null;
    }, 300);
  }, [commitMutation]);

  const checkHyperlinkAtCursor = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return { isLink: false };

    let node = sel.anchorNode;
    while (node && node !== contentEditableRef.current) {
      if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'A') {
        return { isLink: true, href: node.href, element: node };
      }
      node = node.parentNode;
    }
    return { isLink: false };
  }, []);

  const updateSelectionState = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !contentEditableRef.current) {
      setSelection(prev => ({ ...prev, hasSelection: false, selectedText: '' }));
      return;
    }

    const range = sel.getRangeAt(0);
    if (!contentEditableRef.current.contains(range.commonAncestorContainer)) {
      setSelection(prev => ({ ...prev, hasSelection: false, selectedText: '' }));
      return;
    }

    const selectedText = sel.toString();
    const hasSelection = selectedText.length > 0;

    const rect = range.getBoundingClientRect();
    const position = {
      x: rect.left + rect.width / 2,
      y: rect.top,
      bottom: rect.bottom,
    };

    const linkInfo = checkHyperlinkAtCursor();

    setSelection({
      hasSelection,
      selectedText,
      position,
      isHyperlinkSelected: linkInfo.isLink,
      currentHyperlinkHref: linkInfo.href,
    });

    if (hasSelection && !showHyperlinkMenu) {
      setShowFormatPanel(true);
    }
  }, [checkHyperlinkAtCursor, showHyperlinkMenu]);

  const handleInput = useCallback(() => {
    if (readOnly) return;
    scheduleCommit();
  }, [readOnly, scheduleCommit]);

  const handleKeyDown = useCallback((e) => {
    if (readOnly) return;

    const root = contentEditableRef.current;
    if (!root) return;

    // Undo: Cmd/Ctrl + Z
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      historyController.current?.undo(root, restoreSelectionFromBookmarks);
      isInternalUpdate.current = true;
      onChange(root.textContent || '', root.innerHTML);
      isInternalUpdate.current = false;
      return;
    }

    // Redo: Cmd/Ctrl + Shift + Z
    if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
      e.preventDefault();
      historyController.current?.redo(root, restoreSelectionFromBookmarks);
      isInternalUpdate.current = true;
      onChange(root.textContent || '', root.innerHTML);
      isInternalUpdate.current = false;
      return;
    }

    // Bold: Cmd/Ctrl + B
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
      e.preventDefault();
      applyFormat({ bold: true });
      return;
    }

    // Italic: Cmd/Ctrl + I
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault();
      applyFormat({ italic: true });
      return;
    }

    // Underline: Cmd/Ctrl + U
    if ((e.metaKey || e.ctrlKey) && e.key === 'u') {
      e.preventDefault();
      applyFormat({ underline: true });
      return;
    }

    // Tab / Shift+Tab: indent/outdent list items for nested lists
    if (e.key === 'Tab' && features.allowBullets) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        let node = sel.anchorNode;
        while (node && node !== root) {
          if (node.nodeType === Node.ELEMENT_NODE && node.tagName === 'LI') {
            e.preventDefault();
            if (e.shiftKey) {
              document.execCommand('outdent', false);
            } else {
              document.execCommand('indent', false);
            }
            commitMutation(false);
            return;
          }
          node = node.parentNode;
        }
      }
    }

    // Shift+Arrow selections
    if (e.shiftKey && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
      setTimeout(() => {
        updateSelectionState();
      }, 0);
    }
  }, [readOnly, onChange, updateSelectionState, features.allowBullets, commitMutation]);

  const handlePaste = useCallback((e) => {
    if (readOnly) return;

    e.preventDefault();

    const root = contentEditableRef.current;
    if (!root) return;

    const rawHtml = getClipboardContent(e.nativeEvent);
    const cleanFragment = sanitizePastedHTML(rawHtml);

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      range.deleteContents();
      range.insertNode(cleanFragment);
      range.collapse(false);
      sel.removeAllRanges();
      sel.addRange(range);
    }

    commitMutation();
  }, [readOnly, commitMutation]);

  const handleMouseUp = useCallback(() => {
    requestAnimationFrame(() => {
      updateSelectionState();
    });
  }, [updateSelectionState]);

  const handleMouseDown = useCallback((e) => {
    if (features.allowHyperlinks && onHyperlinkClick) {
      const target = e.target;
      const anchor = target.closest('a');
      if (anchor) {
        e.preventDefault();
        const pageId = anchor.getAttribute('data-page-id');
        if (pageId) {
          const linkMode = anchor.getAttribute('data-link-mode') || 'popup';
          onHyperlinkClick({ pageId, pageName: anchor.textContent || '', mode: linkMode, position: { x: e.clientX, y: e.clientY } });
        } else {
          const wsLink = anchor.getAttribute('data-workspace') || anchor.getAttribute('data-workspace-link');
          if (wsLink) {
            onHyperlinkClick({ wsLink, pageName: anchor.textContent || '', mode: 'scroll', position: { x: e.clientX, y: e.clientY } });
          } else {
            const href = anchor.getAttribute('href') || '';
            if (href.startsWith('bridge://')) {
              const parts = href.replace('bridge://', '').split('/');
              onHyperlinkClick({ pageId: parts[0], pageName: anchor.textContent || '', mode: parts[1] || 'popup', position: { x: e.clientX, y: e.clientY } });
            } else if (href.startsWith('#') && href.length > 1) {
              // Hash link — scroll to matching named table
              const fragment = decodeURIComponent(href.slice(1)).replace(/_/g, ' ').trim();
              onHyperlinkClick({ wsLink: fragment, pageName: anchor.textContent || '', mode: 'scroll', position: { x: e.clientX, y: e.clientY } });
            }
          }
        }
      }
    }
  }, [features.allowHyperlinks, onHyperlinkClick]);

  const handleClick = useCallback((e) => {
    const target = e.target;
    const anchor = target.closest('a');
    if (anchor) {
      const href = anchor.getAttribute('href') || '';
      if (href.startsWith('bridge://') || anchor.getAttribute('data-page-id') || anchor.getAttribute('data-workspace') || anchor.getAttribute('data-workspace-link') || (href.startsWith('#') && href.length > 1)) {
        e.preventDefault();
      }
    }
  }, []);

  const handleFocus = useCallback(() => {
    setIsFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && contentEditableRef.current?.contains(sel.anchorNode)) {
      savedSelectionRef.current = sel.getRangeAt(0).cloneRange();
    }

    setTimeout(() => {
      if (panelInteractionRef.current) {
        panelInteractionRef.current = false;
        contentEditableRef.current?.focus();
        if (savedSelectionRef.current) {
          const sel2 = window.getSelection();
          if (sel2) {
            sel2.removeAllRanges();
            sel2.addRange(savedSelectionRef.current);
          }
          savedSelectionRef.current = null;
        }
        return;
      }
      if (document.querySelector('[data-hyperlink-menu]')) {
        return;
      }
      setIsFocused(false);
      savedSelectionRef.current = null;
    }, 150);

    onBlur?.();
  }, [onBlur]);

  /**
   * Apply text formatting
   * @param {object} format - TextFormat object
   */
  const applyFormat = useCallback((format) => {
    if (readOnly) return;

    const root = contentEditableRef.current;
    if (!root) return;

    if (document.activeElement !== root) {
      root.focus();
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (!root.contains(range.commonAncestorContainer)) return;

    const savedRange = saveSelection();

    // Text alignment
    if (format.textAlign) {
      root.style.textAlign = format.textAlign;
      restoreSelection(savedRange);
      commitMutation(true);
      return;
    }

    // List types
    if (format.listType !== undefined && features.allowBullets) {
      if (format.listType === 'bullet') {
        document.execCommand('insertUnorderedList', false);
      } else if (format.listType === 'number') {
        document.execCommand('insertOrderedList', false);
      } else if (format.listType === null) {
        document.execCommand('insertUnorderedList', false);
      }
      commitMutation(false);
      return;
    }

    // Inline formatting requires selection
    if (range.collapsed && !format.textAlign) {
      return;
    }

    restoreSelection(savedRange);

    if (format.bold !== undefined) document.execCommand('bold', false);
    if (format.italic !== undefined) document.execCommand('italic', false);
    if (format.underline !== undefined) document.execCommand('underline', false);
    if (format.strikethrough !== undefined) document.execCommand('strikeThrough', false);
    if (format.color) document.execCommand('foreColor', false, format.color);
    if (format.backgroundColor) document.execCommand('hiliteColor', false, format.backgroundColor);

    if (format.fontSize) {
      const sel2 = window.getSelection();
      if (sel2 && sel2.rangeCount > 0) {
        const range2 = sel2.getRangeAt(0);
        const span = document.createElement('span');
        span.style.fontSize = format.fontSize;
        try {
          range2.surroundContents(span);
        } catch {
          const contents = range2.extractContents();
          span.appendChild(contents);
          range2.insertNode(span);
        }
      }
    }

    if (format.fontFamily) document.execCommand('fontName', false, format.fontFamily);

    commitMutation(true);
  }, [readOnly, features.allowBullets, saveSelection, restoreSelection, commitMutation]);

  /**
   * Apply hyperlink to selected text
   * @param {object} target - HyperlinkTarget
   */
  const applyHyperlink = useCallback((target) => {
    if (readOnly || !features.allowHyperlinks) return;

    const root = contentEditableRef.current;
    if (!root) return;

    root.focus();

    if (hyperlinkRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(hyperlinkRangeRef.current);
      }
      hyperlinkRangeRef.current = null;
    }

    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const href = `bridge://${target.pageId}/${target.mode}`;
    const link = document.createElement('a');
    link.href = href;
    link.setAttribute('data-page-id', target.pageId);
    link.setAttribute('data-link-mode', target.mode);
    link.style.color = '#2563eb';
    link.style.textDecoration = 'underline';
    link.style.cursor = 'pointer';

    try {
      range.surroundContents(link);
    } catch {
      const contents = range.extractContents();
      link.appendChild(contents);
      range.insertNode(link);
    }

    setShowHyperlinkMenu(false);
    commitMutation(true);
  }, [readOnly, features.allowHyperlinks, commitMutation]);

  const removeHyperlink = useCallback(() => {
    if (readOnly || !features.allowHyperlinks) return;

    const linkInfo = checkHyperlinkAtCursor();
    if (!linkInfo.isLink || !linkInfo.element) return;

    const link = linkInfo.element;
    const parent = link.parentNode;
    if (!parent) return;

    while (link.firstChild) {
      parent.insertBefore(link.firstChild, link);
    }
    parent.removeChild(link);

    commitMutation(true);
  }, [readOnly, features.allowHyperlinks, checkHyperlinkAtCursor, commitMutation]);

  const openFormatPanel = useCallback(() => setShowFormatPanel(true), []);
  const openHyperlinkMenu = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && contentEditableRef.current?.contains(sel.anchorNode)) {
      hyperlinkRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
    setShowFormatPanel(false);
    setShowHyperlinkMenu(true);
  }, []);
  const closePanels = useCallback(() => {
    setShowFormatPanel(false);
    setShowHyperlinkMenu(false);
  }, []);

  return {
    contentEditableRef,
    selection,
    showFormatPanel,
    showHyperlinkMenu,
    isFocused,
    openFormatPanel,
    openHyperlinkMenu,
    closePanels,
    applyFormat,
    applyHyperlink,
    removeHyperlink,
    handlers: {
      onInput: handleInput,
      onKeyDown: handleKeyDown,
      onMouseUp: handleMouseUp,
      onMouseDown: handleMouseDown,
      onClick: handleClick,
      onPaste: handlePaste,
      onFocus: handleFocus,
      onBlur: handleBlur,
    },
  };
}
