import { Node } from '@tiptap/core';
import { Plugin } from '@tiptap/pm/state';

/**
 * DiscussionHighlight — atomic inline Tiptap node for discussion highlights.
 *
 * Renders as: <span data-discussion-id="..." class="disc-hl">highlighted text</span>
 *
 * Properties:
 * - Atomic: cannot be split or partially edited
 * - Visual: yellow background + 💬 emoji (via CSS ::after)
 * - Clickable: fires onDiscussionHighlightClick callback
 *
 * Uses <span> (NOT <mark>) to avoid conflicts with Tiptap's Highlight extension.
 */
export const DiscussionHighlight = Node.create({
  name: 'discussionHighlight',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

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
        renderHTML: () => ({}), // text is rendered as content, not as an attribute
      },
    };
  },

  addOptions() {
    return {
      onDiscussionHighlightClick: null, // ref object: { current: ({ discussionId, position }) => void }
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-discussion-id]',
        getAttrs: (el) => ({
          'data-discussion-id': el.getAttribute('data-discussion-id'),
          text: el.textContent || '',
        }),
      },
    ];
  },

  renderHTML({ node }) {
    return [
      'span',
      {
        'data-discussion-id': node.attrs['data-discussion-id'],
        class: 'disc-hl',
      },
      node.attrs.text,
    ];
  },

  addNodeView() {
    return ({ node }) => {
      const span = document.createElement('span');
      span.setAttribute('data-discussion-id', node.attrs['data-discussion-id']);
      span.className = 'disc-hl';
      span.textContent = node.attrs.text;
      span.contentEditable = 'false';
      return { dom: span };
    };
  },

  addProseMirrorPlugins() {
    const clickRef = this.options.onDiscussionHighlightClick;

    return [
      new Plugin({
        props: {
          handleClick: (view, pos, event) => {
            const span = event.target.closest('span[data-discussion-id]');
            if (!span) return false;

            const discussionId = span.getAttribute('data-discussion-id');
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
      }),
    ];
  },

  addCommands() {
    return {
      insertDiscussionHighlight: (attrs) => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs,
        });
      },
      removeDiscussionHighlight: (discussionId) => ({ tr, state }) => {
        const { doc } = state;
        const positions = [];
        doc.descendants((node, pos) => {
          if (
            node.type.name === this.name &&
            node.attrs['data-discussion-id'] === discussionId
          ) {
            positions.push({ from: pos, to: pos + node.nodeSize });
          }
        });
        // Delete in reverse order so positions remain valid
        for (let i = positions.length - 1; i >= 0; i--) {
          tr.delete(positions[i].from, positions[i].to);
        }
        return positions.length > 0;
      },
    };
  },
});
