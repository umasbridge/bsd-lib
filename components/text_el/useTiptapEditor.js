import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { BridgeLink } from './BridgeLink';
import { DiscussionHighlight } from './DiscussionHighlight';
import { FontSize } from './FontSize';
import { ListStyleType } from './ListStyleType';
import { ParagraphIndent } from './ParagraphIndent';
import { SmartLift } from './SmartLift';
import { MODE_FEATURES } from './types';
import { useEditorContext } from '../EditorContext';

/**
 * Tiptap-based rich text editing hook — drop-in replacement for useRichText.
 *
 * Exposes the same external API so TextEl.jsx changes are minimal:
 *   { contentEditableRef, selection, showFormatPanel, showHyperlinkMenu,
 *     isFocused, openFormatPanel, openHyperlinkMenu, closePanels,
 *     applyFormat, applyHyperlink, removeHyperlink, handlers, editor }
 */
export function useTiptapEditor(options) {
  const { mode, initialHtml, onChange, onFocus, onBlur, readOnly } = options;
  const { onHyperlinkClick, onCreatePage, onCreateDiscussion, onAddToDiscussion, documentDiscussions, onDiscussionHighlightClick, onAfterDiscussionApply } = useEditorContext();
  const features = MODE_FEATURES[mode];

  // State matching useRichText's API
  const [selection, setSelection] = useState({
    hasSelection: false,
    selectedText: '',
    position: { x: 0, y: 0, bottom: 0 },
    isHyperlinkSelected: false,
    currentHyperlinkHref: undefined,
  });
  const [showFormatPanel, setShowFormatPanel] = useState(false);
  const [showHyperlinkMenu, setShowHyperlinkMenu] = useState(false);
  const [showDiscussionMenu, setShowDiscussionMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const panelInteractionRef = useRef(false);
  const onHyperlinkClickRef = useRef(onHyperlinkClick);
  onHyperlinkClickRef.current = onHyperlinkClick;
  const onDiscussionHighlightClickRef = useRef(onDiscussionHighlightClick);
  onDiscussionHighlightClickRef.current = onDiscussionHighlightClick;

  // Refs for callbacks passed to useEditor — avoids stale closures since
  // useEditor({...}, []) captures callbacks only once at creation time.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const onBlurRef = useRef(onBlur);
  onBlurRef.current = onBlur;

  // Configure Tiptap extensions
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
        blockquote: false,
        link: false, // We use BridgeLink instead
      }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({
        types: ['paragraph', 'listItem'],
      }),
      Subscript,
      Superscript,
      TaskList,
      TaskItem.configure({ nested: true }),
      BridgeLink.configure({
        onBridgeLinkClick: onHyperlinkClickRef,
      }),
      DiscussionHighlight.configure({
        onDiscussionHighlightClick: onDiscussionHighlightClickRef,
      }),
      FontSize,
      ListStyleType,
      ParagraphIndent,
      SmartLift,
    ],
    content: initialHtml || '',
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: '',
        spellcheck: 'false',
      },
    },
    onUpdate({ editor: ed }) {
      onChangeRef.current?.(ed.getText(), ed.getHTML());
    },
    onFocus() {
      setIsFocused(true);
      onFocusRef.current?.();
    },
    onBlur({ event }) {
      // Check if blur is going to a format panel — if so, refocus
      setTimeout(() => {
        if (panelInteractionRef.current) {
          panelInteractionRef.current = false;
          return;
        }
        if (document.querySelector('[data-hyperlink-menu]') || document.querySelector('[data-discussion-menu]')) {
          return;
        }
        setIsFocused(false);
      }, 150);
      onBlurRef.current?.();
    },
    onSelectionUpdate({ editor: ed }) {
      updateSelectionFromEditor(ed);
    },
  }, []);

  // Sync readOnly changes
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [editor, readOnly]);

  // On load: remove stale discussion highlights (deleted while on mobile/offline)
  useEffect(() => {
    if (!editor || !documentDiscussions) return;
    // Small delay to let editor content settle
    const timer = setTimeout(() => {
      const activeIds = new Set(documentDiscussions.map(d => d.id));
      const { doc } = editor.state;
      const removals = [];
      doc.descendants((node, pos) => {
        node.marks.forEach(mark => {
          if (mark.type.name === 'discussionHighlight') {
            const discId = mark.attrs['data-discussion-id'];
            if (discId && !activeIds.has(discId)) {
              removals.push({ from: pos, to: pos + node.nodeSize });
            }
          }
        });
      });
      if (removals.length > 0) {
        const wasEditable = editor.isEditable;
        if (!wasEditable) editor.setEditable(true);
        let chain = editor.chain();
        for (const { from, to } of removals) {
          chain = chain.setTextSelection({ from, to }).unsetMark('discussionHighlight');
        }
        chain.run();
        if (!wasEditable) editor.setEditable(false);
        if (onAfterDiscussionApply) onAfterDiscussionApply();
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [editor, documentDiscussions]);

  // Update selection state from Tiptap editor
  const updateSelectionFromEditor = useCallback((ed) => {
    if (!ed) return;

    const { from, to, empty } = ed.state.selection;
    const selectedText = empty ? '' : ed.state.doc.textBetween(from, to, ' ');
    const hasSelection = selectedText.length > 0;

    // Get position from DOM selection
    const domSel = window.getSelection();
    let position = { x: 0, y: 0, bottom: 0 };
    if (domSel && domSel.rangeCount > 0) {
      const range = domSel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      position = {
        x: rect.left + rect.width / 2,
        y: rect.top,
        bottom: rect.bottom,
      };
    }

    // Check if cursor is inside a link
    const isHyperlinkSelected = ed.isActive('bridgeLink');
    const linkAttrs = isHyperlinkSelected ? ed.getAttributes('bridgeLink') : {};

    setSelection({
      hasSelection,
      selectedText,
      position,
      isHyperlinkSelected,
      currentHyperlinkHref: linkAttrs.href,
    });

    if (hasSelection && !showHyperlinkMenu && !showDiscussionMenu) {
      setShowFormatPanel(true);
    }
  }, [showHyperlinkMenu, showDiscussionMenu]);

  // Apply text formatting — matches the old applyFormat API
  const applyFormat = useCallback((format) => {
    if (readOnly || !editor) return;

    // Text alignment
    if (format.textAlign) {
      editor.chain().focus().setTextAlign(format.textAlign).run();
      return;
    }

    // List types — handle switching between list types
    if (format.listType !== undefined && features.allowBullets) {
      // Check if we're in a nested list — if so, change only the innermost list type
      // using setNodeMarkup instead of toggle (which affects the whole hierarchy)
      const { $from } = editor.state.selection;
      let listDepths = [];
      for (let d = $from.depth; d > 0; d--) {
        const name = $from.node(d).type.name;
        if (name === 'bulletList' || name === 'orderedList') {
          listDepths.push(d);
        }
      }
      const isNested = listDepths.length > 1;
      const innermostDepth = listDepths[0];
      const innermostType = innermostDepth ? $from.node(innermostDepth).type.name : null;

      const targetType = format.listType === 'bullet' ? 'bulletList'
        : format.listType === 'number' ? 'orderedList' : null;

      // Nested list: change just the innermost list node type, or no-op if already correct
      if (isNested && targetType && innermostType) {
        if (innermostType === targetType) return; // already the right type
      }
      if (isNested && targetType && innermostType && innermostType !== targetType) {
        const pos = $from.before(innermostDepth);
        const newType = editor.state.schema.nodes[targetType];
        if (newType) {
          const tr = editor.state.tr.setNodeMarkup(pos, newType, $from.node(innermostDepth).attrs);
          editor.view.dispatch(tr);
        }
        return;
      }

      // Top-level list or not in a list — use toggle approach
      if (format.listType === 'bullet') {
        if (editor.isActive('bulletList')) {
          editor.chain().focus().toggleBulletList().run();
        } else if (editor.isActive('orderedList')) {
          editor.chain().focus().toggleOrderedList().toggleBulletList().run();
        } else if (editor.isActive('taskList')) {
          editor.chain().focus().toggleTaskList().toggleBulletList().run();
        } else {
          editor.chain().focus().toggleBulletList().run();
        }
      } else if (format.listType === 'number') {
        if (editor.isActive('orderedList')) {
          editor.chain().focus().toggleOrderedList().run();
        } else if (editor.isActive('bulletList')) {
          editor.chain().focus().toggleBulletList().toggleOrderedList().run();
        } else if (editor.isActive('taskList')) {
          editor.chain().focus().toggleTaskList().toggleOrderedList().run();
        } else {
          editor.chain().focus().toggleOrderedList().run();
        }
      } else if (format.listType === 'task') {
        if (editor.isActive('taskList')) {
          editor.chain().focus().toggleTaskList().run();
        } else if (editor.isActive('bulletList')) {
          editor.chain().focus().toggleBulletList().toggleTaskList().run();
        } else if (editor.isActive('orderedList')) {
          editor.chain().focus().toggleOrderedList().toggleTaskList().run();
        } else {
          editor.chain().focus().toggleTaskList().run();
        }
      } else if (format.listType === null) {
        if (editor.isActive('bulletList')) {
          editor.chain().focus().toggleBulletList().run();
        } else if (editor.isActive('orderedList')) {
          editor.chain().focus().toggleOrderedList().run();
        } else if (editor.isActive('taskList')) {
          editor.chain().focus().toggleTaskList().run();
        }
      }
      return;
    }

    // Sub-list: indent current item and switch to opposite list type
    if (format.subList) {
      if (editor.isActive('orderedList') || editor.isActive('bulletList')) {
        // Indent first
        editor.chain().focus().sinkListItem('listItem').run();
        // Now switch the innermost list to the opposite type
        const { $from } = editor.state.selection;
        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          const name = node.type.name;
          if (name === 'bulletList' || name === 'orderedList') {
            const targetType = name === 'bulletList' ? 'orderedList' : 'bulletList';
            const newType = editor.state.schema.nodes[targetType];
            if (newType) {
              const pos = $from.before(d);
              editor.view.dispatch(editor.state.tr.setNodeMarkup(pos, newType, node.attrs));
            }
            break;
          }
        }
      } else {
        // Not in a list → create a bullet list
        editor.chain().focus().toggleBulletList().run();
      }
      return;
    }

    // List style type (bullet/number style)
    if (format.listStyleType !== undefined) {
      editor.chain().focus().setListStyleType(format.listStyleType).run();
      return;
    }

    // Indent / outdent
    if (format.indent !== undefined) {
      if (format.indent === 'increase') {
        editor.chain().focus().sinkListItem('listItem').run()
          || editor.chain().focus().sinkListItem('taskItem').run();
      } else if (format.indent === 'decrease') {
        // Smart lift: adopt parent list type when dedenting
        const inBullet = editor.isActive('bulletList');
        const inOrdered = editor.isActive('orderedList');
        if (inBullet || inOrdered) {
          const { $from } = editor.state.selection;
          let parentListType = null;
          let foundFirst = false;
          for (let d = $from.depth; d > 0; d--) {
            const nodeName = $from.node(d).type.name;
            if (nodeName === 'bulletList' || nodeName === 'orderedList') {
              if (!foundFirst) { foundFirst = true; continue; }
              parentListType = nodeName;
              break;
            }
          }
          editor.chain().focus().liftListItem('listItem').run();
          // Check state AFTER lifting
          const nowInBullet = editor.isActive('bulletList');
          const nowInOrdered = editor.isActive('orderedList');
          if (parentListType === 'orderedList' && !nowInOrdered) {
            if (nowInBullet) {
              editor.chain().focus().toggleBulletList().toggleOrderedList().run();
            } else {
              editor.chain().focus().toggleOrderedList().run();
            }
          } else if (parentListType === 'bulletList' && !nowInBullet) {
            if (nowInOrdered) {
              editor.chain().focus().toggleOrderedList().toggleBulletList().run();
            } else {
              editor.chain().focus().toggleBulletList().run();
            }
          }
        } else {
          editor.chain().focus().liftListItem('listItem').run()
            || editor.chain().focus().liftListItem('taskItem').run();
        }
      }
      return;
    }

    // Inline formatting
    const chain = editor.chain().focus();

    if (format.bold !== undefined) chain.toggleBold().run();
    else if (format.italic !== undefined) chain.toggleItalic().run();
    else if (format.underline !== undefined) chain.toggleUnderline().run();
    else if (format.strikethrough !== undefined) chain.toggleStrike().run();
    else if (format.subscript !== undefined) chain.toggleSubscript().run();
    else if (format.superscript !== undefined) chain.toggleSuperscript().run();
    else if (format.color) chain.setColor(format.color).run();
    else if (format.backgroundColor) {
      if (format.backgroundColor === 'transparent') {
        chain.unsetHighlight().run();
      } else {
        chain.toggleHighlight({ color: format.backgroundColor }).run();
      }
    }
    else if (format.fontSize) chain.setFontSize(format.fontSize).run();
    else if (format.fontFamily) {
      // fontFamily could be added as another TextStyle attribute if needed
      chain.run();
    }
    else {
      chain.run();
    }
  }, [readOnly, editor, features.allowBullets]);

  // Apply hyperlink to selected text
  const applyHyperlink = useCallback((target) => {
    if (readOnly || !features.allowHyperlinks || !editor) return;

    // URL mode: external link, opens in new tab
    if (target.mode === 'url' && target.url) {
      let url = target.url;
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      editor.chain().focus().setLink({
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
      }).run();
      setShowHyperlinkMenu(false);
      return;
    }

    let pageId = target.pageId;

    // Create new page if requested
    if (target.isNewPage && onCreatePage) {
      pageId = onCreatePage(target.pageName);
      if (!pageId) return; // creation failed
    }

    const href = `bridge://${pageId}/${target.mode}`;
    editor.chain().focus().setLink({
      href,
      'data-page-id': pageId,
      'data-link-mode': target.mode,
    }).run();

    setShowHyperlinkMenu(false);
  }, [readOnly, features.allowHyperlinks, editor, onCreatePage]);

  // Remove hyperlink at cursor
  const removeHyperlink = useCallback(() => {
    if (readOnly || !features.allowHyperlinks || !editor) return;
    editor.chain().focus().unsetLink().run();
  }, [readOnly, features.allowHyperlinks, editor]);

  // Apply discussion highlight to selected text (edit mode only — readOnly uses its own handler)
  const applyDiscussionHighlight = useCallback(async (target) => {
    if (!editor) return;

    // Capture selection range BEFORE any async work (it may be lost during await)
    const { from, to } = editor.state.selection;
    const highlightText = target.selectedText || selection.selectedText;

    let discussionId;
    if (target.isNew) {
      if (!onCreateDiscussion) return;
      discussionId = await onCreateDiscussion(target.discussionName, highlightText);
      if (!discussionId) return;
    } else {
      discussionId = target.discussionId;
      if (onAddToDiscussion) onAddToDiscussion(discussionId, highlightText);
    }

    // Restore selection (may have been lost during async), then apply mark
    editor.chain().focus().setTextSelection({ from, to }).setMark('discussionHighlight', { 'data-discussion-id': discussionId }).run();
    setShowDiscussionMenu(false);

    // Auto-save so the highlight persists
    if (onAfterDiscussionApply) onAfterDiscussionApply();
  }, [editor, onCreateDiscussion, onAddToDiscussion, selection.selectedText, onAfterDiscussionApply]);

  const openFormatPanel = useCallback(() => setShowFormatPanel(true), []);
  const openHyperlinkMenu = useCallback(() => {
    setShowFormatPanel(false);
    setShowHyperlinkMenu(true);
  }, []);
  const openDiscussionMenu = useCallback(() => {
    setShowFormatPanel(false);
    setShowDiscussionMenu(true);
  }, []);
  const closePanels = useCallback(() => {
    setShowFormatPanel(false);
    setShowHyperlinkMenu(false);
    setShowDiscussionMenu(false);
  }, []);

  // Global click handler to close panels when clicking outside
  useEffect(() => {
    const handleGlobalMouseDown = (e) => {
      const target = e.target;
      if (
        target.closest('[data-format-panel]') ||
        target.closest('[data-hyperlink-menu]') ||
        target.closest('[data-discussion-menu]') ||
        target.closest('[data-block-format-bar]')
      ) {
        panelInteractionRef.current = true;
        return;
      }
      // If clicking inside the editor, don't close
      if (editor?.view?.dom?.contains(target)) {
        return;
      }
      setShowFormatPanel(false);
      setShowHyperlinkMenu(false);
      setShowDiscussionMenu(false);
    };

    document.addEventListener('mousedown', handleGlobalMouseDown);
    return () => document.removeEventListener('mousedown', handleGlobalMouseDown);
  }, [editor]);

  // Listen for discussion deletions and remove marks
  useEffect(() => {
    if (!editor) return;
    const handleDiscussionDeleted = (e) => {
      const { discussionId } = e.detail;
      if (!discussionId) return;
      // Walk the entire document and remove discussionHighlight marks with this ID
      const { doc } = editor.state;
      const removals = [];
      doc.descendants((node, pos) => {
        node.marks.forEach(mark => {
          if (mark.type.name === 'discussionHighlight' && mark.attrs['data-discussion-id'] === discussionId) {
            removals.push({ from: pos, to: pos + node.nodeSize });
          }
        });
      });
      if (removals.length > 0) {
        const markType = editor.schema.marks.discussionHighlight;
        if (markType) {
          const wasEditable = editor.isEditable;
          if (!wasEditable) editor.setEditable(true);
          let chain = editor.chain();
          for (const { from, to } of removals) {
            chain = chain.setTextSelection({ from, to }).unsetMark('discussionHighlight');
          }
          chain.run();
          if (!wasEditable) editor.setEditable(false);
          // Auto-save so the removal persists
          if (onAfterDiscussionApply) onAfterDiscussionApply();
        }
      }
    };
    window.addEventListener('discussion-deleted', handleDiscussionDeleted);
    return () => window.removeEventListener('discussion-deleted', handleDiscussionDeleted);
  }, [editor]);

  return {
    editor,
    // Backward compat: contentEditableRef points to the Tiptap DOM element
    contentEditableRef: { current: editor?.view?.dom || null },
    selection,
    showFormatPanel,
    showHyperlinkMenu,
    showDiscussionMenu,
    isFocused,
    openFormatPanel,
    openHyperlinkMenu,
    openDiscussionMenu,
    closePanels,
    applyFormat,
    applyHyperlink,
    removeHyperlink,
    applyDiscussionHighlight,
    // handlers are no longer needed — Tiptap manages its own event listeners.
    // Keeping the shape for backward compat with any code that spreads handlers.
    handlers: {},
  };
}
