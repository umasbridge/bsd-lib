import { Extension } from '@tiptap/core';

/**
 * ParagraphIndent — Tiptap extension that adds per-paragraph indent attributes.
 *
 * Adds `indentLeft` and `indentRight` (in px) to paragraph, bulletList, and orderedList nodes.
 * These render as inline margin-left/margin-right styles.
 */
export const ParagraphIndent = Extension.create({
  name: 'paragraphIndent',

  addGlobalAttributes() {
    return [
      {
        types: ['paragraph', 'bulletList', 'orderedList'],
        attributes: {
          indentLeft: {
            default: 0,
            parseHTML: (element) => {
              const ml = element.style.marginLeft;
              return ml ? parseInt(ml, 10) || 0 : 0;
            },
            renderHTML: (attributes) => {
              if (!attributes.indentLeft) return {};
              return { style: `margin-left: ${attributes.indentLeft}px` };
            },
          },
          indentRight: {
            default: 0,
            parseHTML: (element) => {
              const mr = element.style.marginRight;
              return mr ? parseInt(mr, 10) || 0 : 0;
            },
            renderHTML: (attributes) => {
              if (!attributes.indentRight) return {};
              // Merge with existing style if any
              const existing = attributes.indentLeft ? `margin-left: ${attributes.indentLeft}px; ` : '';
              return { style: `${existing}margin-right: ${attributes.indentRight}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setIndentLeft:
        (value) =>
        ({ commands, editor }) => {
          const { node } = editor.state.selection.$head.parent
            ? { node: editor.state.selection.$head.parent }
            : {};
          // Try updating whichever block type the cursor is in
          if (editor.isActive('bulletList')) {
            return commands.updateAttributes('bulletList', { indentLeft: value });
          }
          if (editor.isActive('orderedList')) {
            return commands.updateAttributes('orderedList', { indentLeft: value });
          }
          return commands.updateAttributes('paragraph', { indentLeft: value });
        },
      setIndentRight:
        (value) =>
        ({ commands, editor }) => {
          if (editor.isActive('bulletList')) {
            return commands.updateAttributes('bulletList', { indentRight: value });
          }
          if (editor.isActive('orderedList')) {
            return commands.updateAttributes('orderedList', { indentRight: value });
          }
          return commands.updateAttributes('paragraph', { indentRight: value });
        },
    };
  },
});

/**
 * Get the current paragraph/list indent values from the editor state.
 */
export function getCurrentIndent(editor) {
  if (!editor) return { left: 0, right: 0 };

  // Check list nodes first, then paragraph
  for (const type of ['bulletList', 'orderedList', 'paragraph']) {
    if (editor.isActive(type)) {
      const attrs = editor.getAttributes(type);
      return {
        left: attrs.indentLeft || 0,
        right: attrs.indentRight || 0,
      };
    }
  }
  return { left: 0, right: 0 };
}
