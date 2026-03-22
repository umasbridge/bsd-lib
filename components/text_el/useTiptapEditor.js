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
  const { mode, initialHtml, onChange, onFocus, onBlur, readOnly, pageId } = options;
  const { onHyperlinkClick, onCreatePage, onCreateDiscussion, onAddToDiscussion, onDiscussionHighlightClick, documentDiscussions, onAfterDiscussionApply } = useEditorContext();
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
        style: 'font-size: 14px',
      },
      transformPastedHTML(html) {
        // Strip font-size from pasted content so it inherits the 14px default
        let cleaned = html.replace(/font-size:\s*[^;"']+;?/gi, '');
        // Strip trailing empty paragraphs from pasted content
        while (cleaned.endsWith('<p></p>') || cleaned.endsWith('<p><br></p>')) {
          cleaned = cleaned.replace(/<p>(<br>)?<\/p>$/, '').trimEnd();
        }
        return cleaned;
      },
      handleKeyDown(view, event) {
        // Allow deleting trailing empty paragraph with Backspace
        if (event.key === 'Backspace') {
          const { state } = view;
          const { $from, empty: selEmpty } = state.selection;
          // Check if cursor is in an empty paragraph at the end of the doc
          if (selEmpty && $from.parent.type.name === 'paragraph' && $from.parent.content.size === 0) {
            const pos = $from.before();
            const docSize = state.doc.content.size;
            const isLast = pos + $from.parent.nodeSize >= docSize;
            const isNotOnly = state.doc.childCount > 1;
            if (isLast && isNotOnly) {
              // Delete the trailing empty paragraph
              const tr = state.tr.delete(pos, pos + $from.parent.nodeSize);
              view.dispatch(tr);
              return true;
            }
          }
        }
        return false;
      },
    },
    onUpdate({ editor: ed }) {
      // Strip trailing empty paragraphs so they don't add extra height
      let html = ed.getHTML();
      while (html.endsWith('<p></p>') || html.endsWith('<p><br></p>')) {
        html = html.replace(/<p>(<br>)?<\/p>$/, '').trimEnd();
      }
      // Ensure at least one empty paragraph if everything was stripped
      if (!html) html = '<p></p>';
      onChangeRef.current?.(ed.getText(), html);
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

      if (isNested && targetType && innermostType) {
        if (innermostType === targetType) return;
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
        editor.chain().focus().sinkListItem('listItem').run();
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

    // Create new page if requested (optionally with source elements from Conventions)
    if (target.isNewPage && onCreatePage) {
      pageId = onCreatePage(target.pageName, target.sourceElements || undefined);
      if (!pageId) {
        alert('A page with that name already exists. Use a different name.');
        return;
      }
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

  // Apply discussion highlight — replaces selected text with an atomic highlight node
  // Works in both edit and view mode (temporarily enables editing if needed)
  const applyDiscussionHighlight = useCallback(async (target) => {
    if (!editor) return;

    let discussionId;

    if (target.action === 'create') {
      if (!onCreateDiscussion) return;
      discussionId = await onCreateDiscussion(target.name, target.highlightedText, pageId);
    } else if (target.action === 'add') {
      if (!onAddToDiscussion) return;
      discussionId = await onAddToDiscussion(target.discussionId, target.highlightedText, pageId);
      if (!discussionId) discussionId = target.discussionId;
    }

    if (!discussionId) return;

    // Temporarily enable editing if in read-only mode
    const wasReadOnly = !editor.isEditable;
    if (wasReadOnly) editor.setEditable(true);

    // In view mode, Tiptap doesn't track the native selection.
    // Resolve DOM selection to ProseMirror positions before replacing.
    const domSel = window.getSelection();
    if (domSel && domSel.rangeCount > 0 && !domSel.isCollapsed) {
      try {
        const range = domSel.getRangeAt(0);
        const from = editor.view.posAtDOM(range.startContainer, range.startOffset);
        const to = editor.view.posAtDOM(range.endContainer, range.endOffset);
        if (from != null && to != null && from !== to) {
          editor.chain().focus().setTextSelection({ from, to }).deleteSelection().insertDiscussionHighlight({
            'data-discussion-id': discussionId,
            text: target.highlightedText,
          }).run();
        }
      } catch {
        // Fallback: try with current Tiptap selection
        editor.chain().focus().deleteSelection().insertDiscussionHighlight({
          'data-discussion-id': discussionId,
          text: target.highlightedText,
        }).run();
      }
    } else {
      // Edit mode: Tiptap selection is already correct
      editor.chain().focus().deleteSelection().insertDiscussionHighlight({
        'data-discussion-id': discussionId,
        text: target.highlightedText,
      }).run();
    }

    if (wasReadOnly) editor.setEditable(false);

    setShowDiscussionMenu(false);
    onAfterDiscussionApply?.();
  }, [editor, onCreateDiscussion, onAddToDiscussion, onAfterDiscussionApply, pageId]);

  const openFormatPanel = useCallback(() => setShowFormatPanel(true), []);
  const openHyperlinkMenu = useCallback(() => {
    setShowFormatPanel(false);
    setShowHyperlinkMenu(true);
    setShowDiscussionMenu(false);
  }, []);
  const openDiscussionMenu = useCallback(() => {
    setShowFormatPanel(false);
    setShowHyperlinkMenu(false);
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

  // DOM-level click listener for discussion highlights — needed because ProseMirror's
  // handleClick doesn't fire when the editor is non-editable (view mode).
  useEffect(() => {
    const dom = editor?.view?.dom;
    if (!dom) return;

    const handleClick = (e) => {
      const span = e.target.closest('span[data-discussion-id]');
      if (!span) return;
      const discussionId = span.getAttribute('data-discussion-id');
      if (!discussionId) return;
      const cb = onDiscussionHighlightClickRef.current;
      if (!cb) return;
      e.preventDefault();
      e.stopPropagation();
      cb({ discussionId, position: { x: e.clientX, y: e.clientY } });
    };

    dom.addEventListener('click', handleClick);
    return () => dom.removeEventListener('click', handleClick);
  }, [editor]);

  // Listen for discussion-deleted / discussion-unlinked events to remove highlight nodes
  useEffect(() => {
    const handleRemove = (e) => {
      if (!editor) return;
      const { discussionId } = e.detail || {};
      if (!discussionId) return;
      editor.commands.removeDiscussionHighlight(discussionId);
    };

    window.addEventListener('discussion-deleted', handleRemove);
    window.addEventListener('discussion-unlinked', handleRemove);
    return () => {
      window.removeEventListener('discussion-deleted', handleRemove);
      window.removeEventListener('discussion-unlinked', handleRemove);
    };
  }, [editor]);

  // Stale highlight cleanup — remove highlight nodes for discussions no longer in documentDiscussions
  useEffect(() => {
    if (!editor || documentDiscussions === null) return;
    const validIds = new Set(documentDiscussions.map(d => d.id));
    const { doc, tr } = editor.state;
    const toRemove = [];
    doc.descendants((node, pos) => {
      if (
        node.type.name === 'discussionHighlight' &&
        !validIds.has(node.attrs['data-discussion-id'])
      ) {
        toRemove.push({ from: pos, to: pos + node.nodeSize });
      }
    });
    if (toRemove.length > 0) {
      for (let i = toRemove.length - 1; i >= 0; i--) {
        tr.delete(toRemove[i].from, toRemove[i].to);
      }
      editor.view.dispatch(tr);
    }
  }, [editor, documentDiscussions]);

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
    handlers: {},
  };
}
