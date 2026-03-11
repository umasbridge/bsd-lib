import { Link } from '@tiptap/extension-link';
import { Plugin } from '@tiptap/pm/state';

/**
 * Custom Tiptap Link extension for internal page links.
 * Stores data-page-id, data-link-mode, and bridge:// href.
 *
 * Handles link clicks via ProseMirror's handleClick plugin (reliable for
 * real mouse clicks in editable mode, unlike document-level mouseup listeners
 * which ProseMirror can interfere with).
 *
 * Pass an `onBridgeLinkClick` ref via options to receive click callbacks.
 */
export const BridgeLink = Link.extend({
  name: 'bridgeLink',

  addAttributes() {
    return {
      ...this.parent?.(),
      'data-page-id': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-page-id'),
        renderHTML: (attrs) => {
          if (!attrs['data-page-id']) return {};
          return { 'data-page-id': attrs['data-page-id'] };
        },
      },
      'data-link-mode': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-link-mode'),
        renderHTML: (attrs) => {
          if (!attrs['data-link-mode']) return {};
          return { 'data-link-mode': attrs['data-link-mode'] };
        },
      },
      'data-workspace': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-workspace'),
        renderHTML: (attrs) => {
          if (!attrs['data-workspace']) return {};
          return { 'data-workspace': attrs['data-workspace'] };
        },
      },
      'data-workspace-link': {
        default: null,
        parseHTML: (el) => el.getAttribute('data-workspace-link'),
        renderHTML: (attrs) => {
          if (!attrs['data-workspace-link']) return {};
          return { 'data-workspace-link': attrs['data-workspace-link'] };
        },
      },
    };
  },

  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: false,
      autolink: false,
      linkOnPaste: false,
      protocols: ['bridge'],
      validate: () => true,
      onBridgeLinkClick: null, // ref object: { current: (target) => void }
      HTMLAttributes: {
        style: 'color: #2563eb; text-decoration: underline; cursor: pointer;',
      },
    };
  },

  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() || [];
    const clickRef = this.options.onBridgeLinkClick;

    return [
      ...parentPlugins,
      new Plugin({
        props: {
          handleClick: (view, pos, event) => {
            const anchor = event.target.closest('a');
            if (!anchor) return false;

            const href = anchor.getAttribute('href') || '';
            const pageId = anchor.getAttribute('data-page-id');
            const linkMode = anchor.getAttribute('data-link-mode') || '';
            const wsLink = anchor.getAttribute('data-workspace') || anchor.getAttribute('data-workspace-link');

            // External URLs (http/https): open in new tab
            if (/^https?:\/\//i.test(href) && !pageId && !wsLink) {
              event.preventDefault();
              window.open(href, '_blank', 'noopener,noreferrer');
              return true;
            }

            const isBridgeLink = href.startsWith('bridge://') || pageId || wsLink || (href.startsWith('#') && href.length > 1);
            if (!isBridgeLink) return false;

            // newtab mode: open page in new browser tab via URL parameters
            if (pageId && linkMode === 'newtab') {
              event.preventDefault();
              const cb = clickRef?.current;
              if (cb) cb({ pageId, mode: 'newtab', position: { x: event.clientX, y: event.clientY } });
              return true;
            }

            const cb = clickRef?.current;
            if (!cb) return false;

            event.preventDefault();

            if (pageId) {
              cb({ pageId, pageName: anchor.textContent || '', mode: linkMode || 'popup', position: { x: event.clientX, y: event.clientY } });
              return true;
            }

            if (wsLink) {
              cb({ wsLink, pageName: anchor.textContent || '', mode: 'scroll', position: { x: event.clientX, y: event.clientY } });
              return true;
            }

            if (href.startsWith('bridge://')) {
              const parts = href.replace('bridge://', '').split('/');
              const mode = parts[1] || 'popup';
              cb({ pageId: parts[0], pageName: anchor.textContent || '', mode, position: { x: event.clientX, y: event.clientY } });
              return true;
            }

            if (href.startsWith('#') && href.length > 1) {
              const fragment = decodeURIComponent(href.slice(1)).replace(/_/g, ' ').trim();
              cb({ wsLink: fragment, pageName: anchor.textContent || '', mode: 'scroll', position: { x: event.clientX, y: event.clientY } });
              return true;
            }

            return false;
          },
        },
      }),
    ];
  },
});
