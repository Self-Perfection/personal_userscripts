// ==UserScript==
// @name         LessWrong Karma Mover
// @namespace    https://github.com/Self-Perfection/gov.pt_enhancement_userscripts
// @version      1.0.4
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
// @downloadURL  https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/lesswrong_karma_mover.user.js
// @updateURL    https://raw.githubusercontent.com/Self-Perfection/personal_userscripts/refs/heads/main/lesswrong_karma_mover.user.js
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

  // ---------------------------------------------------------------------------
  // Settings dialog (dialog + Shadow DOM for style isolation)
  // ---------------------------------------------------------------------------

  function showSettingsDialog() {
    const dialog = document.createElement('dialog');
    dialog.style.cssText = 'background: transparent; border: none; padding: 0; max-width: 400px; width: 90vw;';

    const backdropStyle = document.createElement('style');
    backdropStyle.textContent = 'dialog[open]::backdrop { background: rgba(0,0,0,0.5); }';
    document.head.appendChild(backdropStyle);

    const shadowHost = document.createElement('div');
    dialog.appendChild(shadowHost);
    const shadow = shadowHost.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
      * { box-sizing: border-box; }
      .content {
        background: white;
        padding: 24px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        font-family: Arial, sans-serif;
        color: #333;
      }
      h3 { margin: 0 0 16px; font-size: 16px; }
      .options { display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px; }
      label { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; font-size: 14px; line-height: 1.4; }
      input[type="radio"] { margin-top: 2px; flex-shrink: 0; width: 16px; height: 16px; cursor: pointer; }
      .desc { color: #888; font-size: 12px; margin-top: 2px; }
      .buttons { display: flex; justify-content: flex-end; gap: 8px; }
      button {
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 14px;
        border: 1px solid #ddd;
      }
      button.cancel { background: white; color: #333; }
      button.save { background: #4CAF50; color: white; border-color: #4CAF50; }
    `;
    shadow.appendChild(style);

    const content = document.createElement('div');
    content.className = 'content';

    const h3 = document.createElement('h3');
    h3.textContent = 'LessWrong Karma Mover — Settings';
    content.appendChild(h3);

    const optionsDiv = document.createElement('div');
    optionsDiv.className = 'options';

    const modes = [
      {
        value: 'move-all',
        label: 'Move entire vote widget to bottom',
        desc: 'Karma score and voting buttons are hidden until you scroll to the end of the comment.',
      },
      {
        value: 'readonly',
        label: 'Show read-only karma at top, voting panel at bottom',
        desc: 'You see the score immediately, but interactive controls stay below the comment.',
      },
    ];

    for (const mode of modes) {
      const label = document.createElement('label');

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = 'mode';
      input.value = mode.value;
      input.checked = mode.value === 'readonly' ? showReadonlyKarma : !showReadonlyKarma;

      const textWrap = document.createElement('div');
      const nameSpan = document.createElement('span');
      nameSpan.textContent = mode.label;
      const descDiv = document.createElement('div');
      descDiv.className = 'desc';
      descDiv.textContent = mode.desc;
      textWrap.appendChild(nameSpan);
      textWrap.appendChild(descDiv);

      label.appendChild(input);
      label.appendChild(textWrap);
      optionsDiv.appendChild(label);
    }
    content.appendChild(optionsDiv);

    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel';
    cancelBtn.textContent = 'Cancel';

    const saveBtn = document.createElement('button');
    saveBtn.className = 'save';
    saveBtn.textContent = 'Save';

    buttonsDiv.appendChild(cancelBtn);
    buttonsDiv.appendChild(saveBtn);
    content.appendChild(buttonsDiv);

    shadow.appendChild(content);
    document.body.appendChild(dialog);
    dialog.showModal();

    function cleanup() {
      dialog.close();
      dialog.remove();
      backdropStyle.remove();
    }

    saveBtn.addEventListener('click', async () => {
      const selected = shadow.querySelector('input[name="mode"]:checked');
      const newValue = selected && selected.value === 'readonly';
      cleanup();
      if (newValue !== showReadonlyKarma) {
        showReadonlyKarma = newValue;
        await GM_setValue('showReadonlyKarma', showReadonlyKarma);
        processAllComments();
      }
    });

    cancelBtn.addEventListener('click', cleanup);
    dialog.addEventListener('cancel', (e) => { e.preventDefault(); cleanup(); });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) cleanup(); });
  }

  GM_registerMenuCommand('Karma Mover: Settings', showSettingsDialog);

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
