import { Mark } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/**
 * Tiptap Mark extension for discussion highlights.
 * Renders highlighted text linked to a discussion via data-discussion-id.
 *
 * Uses <span> (not <mark>) to avoid conflict with Tiptap's built-in
 * Highlight extension which claims all <mark> tags.
 *
 * Pattern follows BridgeLink.js — pass an `onDiscussionHighlightClick` ref
 * via options to receive click callbacks.
 *
 * Uses both ProseMirror handleClick (for editable mode) and a DOM click
 * listener (for readOnly mode, where ProseMirror doesn't fire handleClick).
 */
export const DiscussionHighlight = Mark.create({
  name: 'discussionHighlight',

  addAttributes() {
    return {
      'data-discussion-id': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-discussion-id'),
        renderHTML: (attrs) => {
          if (!attrs['data-discussion-id']) return {};
          return { 'data-discussion-id': attrs['data-discussion-id'] };
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-discussion-id]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      {
        ...HTMLAttributes,
        style: 'background-color: #fef08a; cursor: pointer; border-radius: 2px;',
      },
      0,
    ];
  },

  addProseMirrorPlugins() {
    const clickRef = this.options.onDiscussionHighlightClick;
    const editorView = this.editor.view;

    // DOM click listener for readOnly mode (ProseMirror handleClick doesn't fire)
    const handleDomClick = (event) => {
      if (editorView.editable) return; // let ProseMirror handle it in edit mode
      const el = event.target.closest('span[data-discussion-id]');
      if (!el) return;
      const discussionId = el.getAttribute('data-discussion-id');
      if (!discussionId) return;
      const cb = clickRef?.current;
      if (!cb) return;
      event.preventDefault();
      event.stopPropagation();
      cb({ discussionId, position: { x: event.clientX, y: event.clientY } });
    };

    editorView.dom.addEventListener('click', handleDomClick);

    return [
      new Plugin({
        props: {
          handleClick: (view, pos, event) => {
            const el = event.target.closest('span[data-discussion-id]');
            if (!el) return false;

            const discussionId = el.getAttribute('data-discussion-id');
            if (!discussionId) return false;

            const cb = clickRef?.current;
            if (!cb) return false;

            event.preventDefault();
            cb({
              discussionId,
              position: { x: event.clientX, y: event.clientY },
            });
            return true;
          },
        },
        destroy() {
          editorView.dom.removeEventListener('click', handleDomClick);
        },
      }),
    ];
  },
});
