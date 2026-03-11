import { Extension } from '@tiptap/core';

/**
 * After converting bullet → ordered, fix numbering to continue from previous <ol>.
 * Counts items in all preceding <ol> siblings and sets `start` attribute.
 */
function fixOrderedListNumbering(editor) {
  const { state } = editor;
  const { $from } = state.selection;

  // Find the orderedList node we're currently in
  for (let d = $from.depth; d > 0; d--) {
    if ($from.node(d).type.name === 'orderedList') {
      const parent = $from.node(d - 1);
      const olIndex = $from.index(d - 1);

      // Try to join with immediately preceding <ol> if adjacent
      if (olIndex > 0) {
        const prevSibling = parent.child(olIndex - 1);
        if (prevSibling.type.name === 'orderedList') {
          // Adjacent ordered lists — join them
          const pos = $from.before(d);
          try {
            editor.view.dispatch(state.tr.join(pos));
            return;
          } catch (e) {
            // join failed, fall through to start attribute approach
          }
        }
      }

      // Not adjacent — count items in all preceding <ol> nodes
      let totalItems = 0;
      for (let i = 0; i < olIndex; i++) {
        const sibling = parent.child(i);
        if (sibling.type.name === 'orderedList') {
          totalItems += sibling.childCount;
        }
      }
      if (totalItems > 0) {
        const olPos = $from.before(d);
        const tr = state.tr.setNodeMarkup(olPos, null, {
          ...$from.node(d).attrs,
          start: totalItems + 1,
        });
        editor.view.dispatch(tr);
      }
      break;
    }
  }
}

/**
 * SmartLift — When Shift+Tab lifts a list item out of a nested list,
 * convert it to match the parent list type (bullet → numbered or vice versa).
 *
 * When at top level (no parent list):
 * - Bullet list → convert to ordered list and continue numbering from preceding <ol>
 * - Ordered list → lift out of list entirely (become paragraph)
 */
export const SmartLift = Extension.create({
  name: 'smartLift',

  addKeyboardShortcuts() {
    return {
      'Shift-Tab': ({ editor }) => {
        const { state } = editor;
        const { $from } = state.selection;

        // Walk up to find the immediate list and parent list
        let immediateList = null;
        let parentList = null;

        for (let d = $from.depth; d > 0; d--) {
          const node = $from.node(d);
          const name = node.type.name;
          if (name === 'bulletList' || name === 'orderedList') {
            if (!immediateList) {
              immediateList = node;
            } else {
              parentList = node;
              break;
            }
          }
        }

        // Not in a list at all — let default handle it
        if (!immediateList) return false;

        // Not nested (no parent list)
        if (!parentList) {
          const currentType = immediateList.type.name;
          if (currentType === 'bulletList') {
            // Convert bullet → ordered list, then fix numbering
            editor.chain().focus().toggleBulletList().toggleOrderedList().run();
            fixOrderedListNumbering(editor);
            return true;
          }
          // Ordered list at top level — lift out to paragraph
          return editor.chain().focus().liftListItem('listItem').run();
        }

        const parentType = parentList.type.name;

        // Lift the item first
        const lifted = editor.chain().focus().liftListItem('listItem').run();
        if (!lifted) return false;

        // After lifting, check if we need to convert the list type
        const new$from = editor.state.selection.$from;

        let currentListType = null;
        for (let d = new$from.depth; d > 0; d--) {
          const name = new$from.node(d).type.name;
          if (name === 'bulletList' || name === 'orderedList') {
            currentListType = name;
            break;
          }
        }

        // If already in the correct list type, nothing to do
        if (currentListType === parentType) return true;

        // Need to convert: use toggle approach
        if (currentListType === 'bulletList' && parentType === 'orderedList') {
          editor.chain().focus().toggleBulletList().toggleOrderedList().run();
        } else if (currentListType === 'orderedList' && parentType === 'bulletList') {
          editor.chain().focus().toggleOrderedList().toggleBulletList().run();
        } else if (!currentListType) {
          // Lifted out of all lists — wrap in parent type
          if (parentType === 'orderedList') {
            editor.chain().focus().toggleOrderedList().run();
          } else {
            editor.chain().focus().toggleBulletList().run();
          }
        }

        return true;
      },
    };
  },
});
