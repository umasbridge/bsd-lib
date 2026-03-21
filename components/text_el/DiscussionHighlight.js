import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/**
 * Tiptap Node extension for discussion highlights.
 * Renders highlighted text linked to a discussion via data-discussion-id.
 *
 * This is an inline atomic node — the highlighted text is a single unit
 * that cannot be partially edited. It can be deleted or unlinked as a whole.
 *
 * Backward-compatible: parses old <span data-discussion-id> marks from
 * existing HTML and converts them to nodes on load.
 */
export const DiscussionHighlight = Node.create({
  name: 'discussionHighlight',
  group: 'inline',
  inline: true,
  atom: true,

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
      text: {
        default: '',
        parseHTML: (el) => el.textContent || '',
        renderHTML: () => ({}), // text is rendered as content, not as attribute
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'disc-hl[data-discussion-id]' },
      { tag: 'span[data-discussion-id]' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        style: 'background-color: #fef08a; cursor: pointer; border-radius: 2px; position: relative; display: inline;',
      }),
      node.attrs.text || '',
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const wrapper = document.createElement('disc-hl');
      wrapper.setAttribute('data-discussion-id', node.attrs['data-discussion-id'] || '');
      wrapper.style.cssText = 'background-color: #fef08a; cursor: pointer; border-radius: 2px; position: relative; display: inline-block;';
      wrapper.textContent = node.attrs.text || '';

      // Emoji indicator
      const emojiSpan = document.createElement('span');
      emojiSpan.textContent = '💬';
      emojiSpan.style.cssText = 'position: absolute; top: -10px; right: -6px; z-index: 30; font-size: 10px; line-height: 1; pointer-events: none;';
      wrapper.appendChild(emojiSpan);

      return {
        dom: wrapper,
        update(updatedNode) {
          if (updatedNode.type.name !== 'discussionHighlight') return false;
          wrapper.setAttribute('data-discussion-id', updatedNode.attrs['data-discussion-id'] || '');
          // Update text but keep unlinkBtn
          const textNode = wrapper.firstChild;
          if (textNode && textNode.nodeType === 3) {
            textNode.textContent = updatedNode.attrs.text || '';
          }
          return true;
        },
        destroy() {},
      };
    };
  },

  addCommands() {
    return {
      setDiscussionHighlight: (attrs) => ({ chain, state }) => {
        const { from, to } = state.selection;
        const text = state.doc.textBetween(from, to, '');
        return chain()
          .deleteRange({ from, to })
          .insertContentAt(from, {
            type: 'discussionHighlight',
            attrs: { ...attrs, text },
          })
          .run();
      },
      unsetDiscussionHighlight: (discussionId) => ({ state, chain }) => {
        const removals = [];
        state.doc.descendants((node, pos) => {
          if (node.type.name === 'discussionHighlight' && node.attrs['data-discussion-id'] === discussionId) {
            removals.push({ pos, text: node.attrs.text || '', size: node.nodeSize });
          }
        });
        if (removals.length === 0) return false;
        // Process in reverse order to maintain positions
        let c = chain();
        for (let i = removals.length - 1; i >= 0; i--) {
          const { pos, text, size } = removals[i];
          c = c.command(({ tr }) => {
            tr.replaceWith(pos, pos + size, state.schema.text(text));
            return true;
          });
        }
        return c.run();
      },
    };
  },

  addProseMirrorPlugins() {
    const clickRef = this.options.onDiscussionHighlightClick;
    const editorView = this.editor.view;

    // DOM click listener for both editable and readOnly modes
    const handleDomClick = (event) => {
      const el = event.target.closest('disc-hl[data-discussion-id]');
      if (!el) return;
      // Don't trigger on unlink button click
      if (event.target.title === 'Remove highlight') return;
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
            const el = event.target.closest('disc-hl[data-discussion-id]');
            if (!el) return false;
            if (event.target.title === 'Remove highlight') return true;
            const discussionId = el.getAttribute('data-discussion-id');
            if (!discussionId) return false;
            const cb = clickRef?.current;
            if (!cb) return false;
            event.preventDefault();
            cb({ discussionId, position: { x: event.clientX, y: event.clientY } });
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
