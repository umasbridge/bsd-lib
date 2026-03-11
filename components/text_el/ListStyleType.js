import { Extension } from '@tiptap/core';

/**
 * ListStyleType — Tiptap extension that adds a `listStyleType` attribute
 * to bulletList and orderedList nodes, allowing users to choose styles like
 * disc/circle/square/dash for bullets and decimal/lower-alpha/upper-alpha/
 * lower-roman/upper-roman for ordered lists.
 */
export const ListStyleType = Extension.create({
  name: 'listStyleType',

  addGlobalAttributes() {
    return [
      {
        types: ['bulletList', 'orderedList'],
        attributes: {
          listStyleType: {
            default: null,
            parseHTML: (element) => element.style.listStyleType || null,
            renderHTML: (attributes) => {
              if (!attributes.listStyleType) return {};
              return { style: `list-style-type: ${attributes.listStyleType}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setListStyleType:
        (styleType) =>
        ({ editor }) => {
          // Update listStyleType on the innermost list node only
          const { $from } = editor.state.selection;
          for (let d = $from.depth; d > 0; d--) {
            const node = $from.node(d);
            const name = node.type.name;
            if (name === 'bulletList' || name === 'orderedList') {
              const pos = $from.before(d);
              const tr = editor.state.tr.setNodeMarkup(pos, null, {
                ...node.attrs,
                listStyleType: styleType,
              });
              editor.view.dispatch(tr);
              return true;
            }
          }
          return false;
        },
    };
  },
});

/**
 * Available bullet styles for UI dropdowns.
 */
export const BULLET_STYLES = [
  { value: 'disc', label: '\u2022', title: 'Round Bullet' },
  { value: '"–  "', label: '\u2013', title: 'Dash' },
  { value: '"➢  "', label: '\u27A2', title: 'Arrow' },
  { value: '"✓  "', label: '\u2713', title: 'Tick Mark' },
];

/**
 * Available ordered list styles for UI dropdowns.
 */
export const NUMBER_STYLES = [
  { value: 'decimal', label: '1, 2, 3', title: 'Numbers' },
  { value: 'lower-alpha', label: 'a, b, c', title: 'Lowercase Letters' },
  { value: 'upper-alpha', label: 'A, B, C', title: 'Uppercase Letters' },
  { value: 'lower-roman', label: 'i, ii, iii', title: 'Lowercase Roman' },
  { value: 'upper-roman', label: 'I, II, III', title: 'Uppercase Roman' },
];
