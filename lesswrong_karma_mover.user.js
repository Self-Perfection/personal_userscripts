// ==UserScript==
// @name         LessWrong Karma Mover
// @namespace    https://github.com/Self-Perfection/gov.pt_enhancement_userscripts
// @version      1.0.2
// @icon         https://res.cloudinary.com/lesswrong-2-0/image/upload/v1497915096/favicon_lncumn.ico
// @description  Moves karma and agreement scores from the top of LessWrong / Alignment Forum comments to the bottom to reduce anchoring bias.
// @author       Self-Perfection
// @match        https://www.lesswrong.com/*
// @match        https://www.alignmentforum.org/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/gov.pt_enhancement_userscripts/refs/heads/main/lesswrong_karma_mover.user.js
// @updateURL    https://raw.githubusercontent.com/Self-Perfection/gov.pt_enhancement_userscripts/refs/heads/main/lesswrong_karma_mover.user.js
// ==/UserScript==

(async function () {
  'use strict';

  GM_addStyle(`
    .lw-signals-bottom {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      padding: 12px;
      padding-bottom: 4px;
      column-gap: 12px;
      row-gap: 4px;
    }
    .lw-readonly-karma {
      margin: 4px;
      font-size: 1.3rem;
      line-height: inherit;
      color: inherit;
    }
  `);

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  let showReadonlyKarma = await GM_getValue('showReadonlyKarma', false);
  const karmaCache = new WeakMap();

  GM_registerMenuCommand(
    showReadonlyKarma
      ? 'Karma Mover: show read-only score at top [ON] — click to disable'
      : 'Karma Mover: show read-only score at top [OFF] — click to enable',
    async () => {
      showReadonlyKarma = !showReadonlyKarma;
      await GM_setValue('showReadonlyKarma', showReadonlyKarma);
      processAllComments();
    }
  );

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function findBottomBar(root) {
    const node = root.closest('.comments-node');
    if (!node) return null;
    return node.querySelector('.CommentBottom-bottom');
  }

  function shouldSkip(root) {
    if (root.closest('.CommentFrame-isSingleLine')) return true;
    return !findBottomBar(root);
  }

  function getOrCreateContainer(bottomBar) {
    const parent = bottomBar.parentElement;
    if (!parent) return null;
    let container = parent.querySelector(':scope > .lw-signals-bottom');
    if (!container) {
      container = document.createElement('div');
      container.className = 'lw-signals-bottom';
      parent.insertBefore(container, bottomBar);
    }
    return container;
  }

  function clearContainer(container) {
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
  }

  function findVoteWidget(root) {
    const meta = root.querySelector('.CommentsItemMeta-root');
    if (meta) {
      const w = meta.querySelector('.NamesAttachedReactionsVoteOnComment-root');
      if (w) return w;
    }
    const w = root.querySelector('.NamesAttachedReactionsVoteOnComment-root');
    if (w) return w;
    const node = root.closest('.comments-node');
    if (node) {
      const w2 = node.querySelector('.NamesAttachedReactionsVoteOnComment-root');
      if (w2) return w2;
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // Mode implementations
  // ---------------------------------------------------------------------------

  function processMoveAll(root, bottom) {
    const widget = findVoteWidget(root);
    if (!widget) return false;
    const container = getOrCreateContainer(bottom);
    if (!container) return false;
    if (container.contains(widget)) return true;
    clearContainer(container);
    container.appendChild(widget);
    return true;
  }

  function processReadonlyKarma(root, bottom) {
    const widget = findVoteWidget(root);
    if (!widget) return false;

    const overall = widget.querySelector('.OverallVoteAxis-overallSection');
    const container = getOrCreateContainer(bottom);
    if (!container) return false;

    if (overall) {
      const scoreEl = overall.querySelector('.OverallVoteAxis-voteScore');
      if (scoreEl) {
        karmaCache.set(root, scoreEl.textContent);
      }
    }

    const meta = root.querySelector('.CommentsItemMeta-root');
    if (meta) {
      let readOnly = meta.querySelector('.lw-readonly-karma');
      if (!readOnly) {
        readOnly = document.createElement('span');
        readOnly.className = 'lw-readonly-karma';
        const collapse = meta.querySelector('.CommentsItemMeta-collapse');
        if (collapse && collapse.nextSibling) {
          meta.insertBefore(readOnly, collapse.nextSibling);
        } else {
          meta.appendChild(readOnly);
        }
      }
      const cached = karmaCache.get(root);
      if (cached && readOnly.textContent !== cached) {
        readOnly.textContent = cached;
      }
    }

    if (container.contains(widget)) return true;
    clearContainer(container);
    container.appendChild(widget);
    return true;
  }

  // ---------------------------------------------------------------------------
  // Core processing
  // ---------------------------------------------------------------------------

  function processComment(root) {
    if (shouldSkip(root)) return false;
    const bottom = findBottomBar(root);
    if (!bottom) return false;
    return showReadonlyKarma
      ? processReadonlyKarma(root, bottom)
      : processMoveAll(root, bottom);
  }

  function processAllComments() {
    const roots = document.querySelectorAll('.CommentsItem-root');
    for (const root of roots) {
      processComment(root);
    }
  }

  // ---------------------------------------------------------------------------
  // Scheduling
  // ---------------------------------------------------------------------------

  if (document.readyState === 'complete') {
    setTimeout(processAllComments, 2000);
  } else {
    window.addEventListener('load', () => setTimeout(processAllComments, 2000));
  }

  setInterval(processAllComments, 3000);

  let debounceTimer;
  const observer = new MutationObserver(() => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(processAllComments, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });
})();
