import {
  calculate,
  formatWhatsApp,
  parseChatText,
  toTableRows,
  type CalculationResult,
  type TableRow,
} from '@share-calculator/core';
import {
  applyParsedEntries,
  createEmptyState,
  expenseTotalCents,
  loadState,
  saveState,
  toCalculationInput,
  type AppState,
  type ExceptionKind,
  type StatePayment,
} from './state.js';
import { icon, type IconName } from './icons.js';
import {
  applyTheme,
  loadStoredTheme,
  oppositeTheme,
  persistTheme,
  resolveInitialTheme,
  type Theme,
} from './theme.js';

function generateId(): string {
  return crypto.randomUUID();
}

let state: AppState = loadState() ?? createEmptyState();

let currentTheme: Theme = resolveInitialTheme(
  loadStoredTheme(),
  window.matchMedia('(prefers-color-scheme: dark)').matches,
);

// Transient (not persisted) in-progress state for the "add expense" form, kept
// outside `state` so an unrelated re-render (e.g. editing an exception) doesn't
// wipe out payer rows the user is still filling in.
let pendingDescription = '';
let pendingPayerRows: Array<{ participantId: string; amountText: string }> = [
  { participantId: '', amountText: '' },
];
let pasteText = '';
let pasteMessage = '';
let isPasteModalOpen = false;

const app: HTMLElement =
  document.getElementById('app') ??
  (() => {
    throw new Error('Missing #app root element.');
  })();

function persistAndRender(): void {
  saveState(state);
  render();
}

type ElementProps<K extends keyof HTMLElementTagNameMap> = Partial<HTMLElementTagNameMap[K]> & {
  text?: string;
};

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: ElementProps<K> = {},
  children: Node[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  const { text, ...rest } = props;
  Object.assign(node, rest);
  if (text !== undefined) {
    node.textContent = text;
  }
  for (const child of children) {
    node.appendChild(child);
  }
  return node;
}

function iconButton(
  name: IconName,
  label: string,
  className = 'btn btn-icon btn-ghost',
): HTMLButtonElement {
  const btn = el('button', { type: 'button', className });
  btn.setAttribute('aria-label', label);
  btn.appendChild(icon(name));
  return btn;
}

function findExceptionKind(participantId: string): { kind: ExceptionKind; amountCents?: number } {
  const exception = state.exceptions.find((e) => e.participantId === participantId);
  if (!exception) return { kind: 'none' };
  return exception.amountCents !== undefined
    ? { kind: exception.kind, amountCents: exception.amountCents }
    : { kind: exception.kind };
}

function setExceptionKind(participantId: string, kind: ExceptionKind, amountCents?: number): void {
  const others = state.exceptions.filter((e) => e.participantId !== participantId);
  if (kind === 'none') {
    state = { ...state, exceptions: others };
    return;
  }
  state = {
    ...state,
    exceptions: [
      ...others,
      { participantId, kind, ...(amountCents !== undefined ? { amountCents } : {}) },
    ],
  };
}

function dollarsToCents(text: string): number | undefined {
  if (text.trim() === '') return undefined;
  const value = Math.round(parseFloat(text) * 100);
  return Number.isFinite(value) ? value : undefined;
}

function centsToDollarsText(cents: number | undefined): string {
  return cents === undefined ? '' : (cents / 100).toFixed(2);
}

/* ---------- Theme ---------- */

function renderThemeToggle(): HTMLElement {
  const isDark = currentTheme === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';
  const btn = iconButton(isDark ? 'sun' : 'moon', label);
  btn.title = label;
  btn.addEventListener('click', () => {
    currentTheme = oppositeTheme(currentTheme);
    applyTheme(currentTheme);
    persistTheme(currentTheme);
    render();
  });
  return btn;
}

/* ---------- Header ---------- */

function renderHeader(): HTMLElement {
  const brand = el('div', { className: 'brand' }, [
    el('div', { className: 'brand-icon' }, [icon('calculator')]),
    el('div', {}, [
      el('h1', { text: 'Share Calculator' }),
      el('p', {
        className: 'subtitle',
        text: 'Split a shared cost across a group, with exceptions for caps or exclusions.',
      }),
    ]),
  ]);
  return el('header', { className: 'app-header' }, [brand, renderThemeToggle()]);
}

/* ---------- Paste-from-chat modal ---------- */

function openPasteModal(): void {
  isPasteModalOpen = true;
  render();
  app.querySelector<HTMLTextAreaElement>('.paste-textarea')?.focus();
}

function closePasteModal(): void {
  isPasteModalOpen = false;
  render();
  app.querySelector<HTMLButtonElement>('.paste-trigger')?.focus();
}

function trapFocus(ev: KeyboardEvent, container: HTMLElement): void {
  const focusable = container.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
  );
  if (focusable.length === 0) return;
  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  if (ev.shiftKey && document.activeElement === first) {
    ev.preventDefault();
    last.focus();
  } else if (!ev.shiftKey && document.activeElement === last) {
    ev.preventDefault();
    first.focus();
  }
}

function renderPasteTriggerButton(): HTMLElement {
  const btn = el('button', { type: 'button', className: 'btn btn-sm paste-trigger' }, [
    icon('clipboard'),
    el('span', { text: 'Paste from chat' }),
  ]);
  btn.addEventListener('click', openPasteModal);
  return btn;
}

function renderPasteModal(): HTMLElement {
  const textarea = el('textarea', {
    className: 'paste-textarea',
    rows: 5,
    placeholder: 'e.g. "Jenny: 10.4, Paul: 20, Linda: 11.5"',
  });
  textarea.setAttribute('aria-label', 'Pasted chat text');
  textarea.value = pasteText;
  textarea.addEventListener('input', () => {
    pasteText = textarea.value;
  });

  const message = el('p', { className: 'paste-message', text: pasteMessage });

  const parseBtn = el('button', { type: 'button', className: 'btn btn-primary' }, [
    icon('check'),
    el('span', { text: 'Parse & add as expense' }),
  ]);
  parseBtn.addEventListener('click', () => {
    const parsed = parseChatText(pasteText);
    if (parsed.entries.length === 0) {
      pasteMessage = 'No name:amount pairs found in that text.';
      render();
      app.querySelector<HTMLTextAreaElement>('.paste-textarea')?.focus();
      return;
    }
    const { state: nextState, expense, addedParticipants } = applyParsedEntries(
      state,
      parsed.entries,
      generateId,
      'Pasted expense',
    );
    state = nextState;
    pasteText = '';
    const parts = [`Added an expense with ${expense.paidBy.length} payer(s).`];
    if (addedParticipants.length > 0) {
      parts.push(`New participant(s): ${addedParticipants.map((p) => p.name).join(', ')}.`);
    }
    if (parsed.unparsedLines.length > 0) {
      parts.push(`Could not parse: ${parsed.unparsedLines.join(' | ')}`);
    }
    pasteMessage = parts.join(' ');
    saveState(state);
    closePasteModal();
  });

  const closeBtn = iconButton('x', 'Close');
  closeBtn.addEventListener('click', closePasteModal);

  const heading = el('h2', { id: 'paste-modal-title' }, [
    icon('clipboard'),
    el('span', { text: 'Paste from chat' }),
  ]);

  const modal = el('div', { className: 'modal' });
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'paste-modal-title');
  modal.append(
    el('div', { className: 'modal-header' }, [heading, closeBtn]),
    el('p', {
      className: 'modal-hint',
      text: 'Supports commas, new lines, semicolons, or bullet points — paste straight from a chat.',
    }),
    textarea,
    parseBtn,
    message,
  );

  const backdrop = el('div', { className: 'modal-backdrop' }, [modal]);
  backdrop.addEventListener('mousedown', (ev) => {
    if (ev.target === backdrop) closePasteModal();
  });
  backdrop.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      closePasteModal();
    } else if (ev.key === 'Tab') {
      trapFocus(ev, modal);
    }
  });

  return backdrop;
}

/* ---------- Participants ---------- */

function renderParticipantsSection(): HTMLElement {
  const list = el('ul', { className: 'participant-list' });

  for (const p of state.participants) {
    const current = findExceptionKind(p.id);

    const kindSelect = el('select', { className: 'exception-kind' });
    kindSelect.setAttribute('aria-label', `Payment exception for ${p.name}`);
    const kindLabels: Record<ExceptionKind, string> = {
      none: 'No exception',
      excluded: "Can't pay",
      capped: 'Capped at',
      fixed: 'Fixed at',
    };
    for (const kind of Object.keys(kindLabels) as ExceptionKind[]) {
      const opt = el('option', { text: kindLabels[kind], value: kind });
      if (kind === current.kind) opt.selected = true;
      kindSelect.appendChild(opt);
    }

    const amountInput = el('input', {
      type: 'number',
      step: '0.01',
      min: '0',
      className: 'exception-amount',
      placeholder: '0.00',
    });
    amountInput.setAttribute('aria-label', `Exception amount for ${p.name}`);
    amountInput.value = centsToDollarsText(current.amountCents);
    amountInput.style.display = current.kind === 'capped' || current.kind === 'fixed' ? '' : 'none';

    kindSelect.addEventListener('change', () => {
      const kind = kindSelect.value as ExceptionKind;
      amountInput.style.display = kind === 'capped' || kind === 'fixed' ? '' : 'none';
      setExceptionKind(p.id, kind, dollarsToCents(amountInput.value));
      persistAndRender();
    });
    amountInput.addEventListener('change', () => {
      setExceptionKind(p.id, kindSelect.value as ExceptionKind, dollarsToCents(amountInput.value));
      persistAndRender();
    });

    const removeBtn = iconButton('trash', `Remove ${p.name}`, 'btn btn-icon btn-danger-ghost');
    removeBtn.addEventListener('click', () => {
      state = {
        ...state,
        participants: state.participants.filter((x) => x.id !== p.id),
        expenses: state.expenses.map((e) => ({
          ...e,
          paidBy: e.paidBy.filter((pay) => pay.participantId !== p.id),
        })),
        exceptions: state.exceptions.filter((x) => x.participantId !== p.id),
      };
      persistAndRender();
    });

    list.appendChild(
      el('li', { className: 'participant-row' }, [
        el('span', { text: p.name, className: 'participant-name' }),
        kindSelect,
        amountInput,
        removeBtn,
      ]),
    );
  }

  const nameInput = el('input', {
    type: 'text',
    id: 'new-participant-name',
    placeholder: 'e.g. Jenny',
    className: 'new-participant-name',
  });
  const nameLabel = el('label', {
    text: 'Participant name',
    className: 'visually-hidden',
    htmlFor: 'new-participant-name',
  });
  const addForm = el('form', { className: 'add-participant-form' }, [
    nameLabel,
    nameInput,
    el('button', { type: 'submit', className: 'btn btn-primary btn-sm' }, [
      icon('plus'),
      el('span', { text: 'Add' }),
    ]),
  ]);
  addForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    state = { ...state, participants: [...state.participants, { id: generateId(), name }] };
    nameInput.value = '';
    persistAndRender();
  });

  const card = el('section', { className: 'card' });
  card.append(
    el('div', { className: 'card-header' }, [
      el('h2', { className: 'card-title' }, [
        icon('users'),
        el('span', { text: 'Participants' }),
        el('span', { className: 'count', text: `(${state.participants.length})` }),
      ]),
    ]),
    state.participants.length > 0
      ? list
      : el('p', {
          className: 'empty-state',
          text: 'No participants yet — add the people sharing this cost below.',
        }),
    addForm,
  );
  return card;
}

/* ---------- Expenses ---------- */

function renderAddExpenseForm(): HTMLElement {
  const descInput = el('input', {
    type: 'text',
    id: 'expense-description',
    placeholder: 'Description (optional)',
    className: 'expense-description',
  });
  const descLabel = el('label', {
    text: 'Expense description',
    className: 'visually-hidden',
    htmlFor: 'expense-description',
  });
  descInput.value = pendingDescription;
  descInput.addEventListener('input', () => {
    pendingDescription = descInput.value;
  });

  const rowsContainer = el('div', { className: 'payer-rows' });
  pendingPayerRows.forEach((row, index) => {
    const select = el('select', { className: 'payer-select' });
    select.setAttribute('aria-label', `Payer ${index + 1}`);
    select.appendChild(el('option', { text: '-- choose participant --', value: '' }));
    for (const p of state.participants) {
      const opt = el('option', { text: p.name, value: p.id });
      if (p.id === row.participantId) opt.selected = true;
      select.appendChild(opt);
    }
    select.addEventListener('change', () => {
      row.participantId = select.value;
    });

    const amountInput = el('input', {
      type: 'number',
      step: '0.01',
      min: '0',
      placeholder: 'Amount paid',
      className: 'payer-amount',
    });
    amountInput.setAttribute('aria-label', `Amount paid by payer ${index + 1}`);
    amountInput.value = row.amountText;
    amountInput.addEventListener('input', () => {
      row.amountText = amountInput.value;
    });

    const removeRowBtn = iconButton('x', `Remove payer ${index + 1}`, 'btn btn-icon btn-ghost btn-sm');
    removeRowBtn.addEventListener('click', () => {
      pendingPayerRows.splice(index, 1);
      if (pendingPayerRows.length === 0) {
        pendingPayerRows.push({ participantId: '', amountText: '' });
      }
      render();
    });

    rowsContainer.appendChild(el('div', { className: 'payer-row' }, [select, amountInput, removeRowBtn]));
  });

  const addRowBtn = el('button', { type: 'button', className: 'btn btn-ghost btn-sm' }, [
    icon('plus'),
    el('span', { text: 'Add payer' }),
  ]);
  addRowBtn.addEventListener('click', () => {
    pendingPayerRows.push({ participantId: '', amountText: '' });
    render();
  });

  const errorBox = el('p', { className: 'form-error' });
  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary' }, [
    icon('plus'),
    el('span', { text: 'Add expense' }),
  ]);

  const form = el('form', { className: 'add-expense-form' }, [
    descLabel,
    descInput,
    rowsContainer,
    el('div', { className: 'expense-form-actions' }, [addRowBtn, submitBtn]),
    errorBox,
  ]);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const paidBy: StatePayment[] = [];
    for (const row of pendingPayerRows) {
      const amountCents = dollarsToCents(row.amountText);
      if (!row.participantId || amountCents === undefined || amountCents <= 0) continue;
      paidBy.push({ participantId: row.participantId, amountCents });
    }
    if (paidBy.length === 0) {
      errorBox.textContent = 'Add at least one payer with a participant and a positive amount.';
      return;
    }
    state = {
      ...state,
      expenses: [
        ...state.expenses,
        { id: generateId(), description: pendingDescription.trim(), paidBy },
      ],
    };
    pendingDescription = '';
    pendingPayerRows = [{ participantId: '', amountText: '' }];
    persistAndRender();
  });

  return form;
}

function renderExpensesSection(): HTMLElement {
  const list = el('ul', { className: 'expense-list' });

  for (const e of state.expenses) {
    const total = expenseTotalCents(e);
    const payerText = e.paidBy
      .map((p) => {
        const participant = state.participants.find((x) => x.id === p.participantId);
        return `${participant?.name ?? 'Unknown'}: $${centsToDollarsText(p.amountCents)}`;
      })
      .join(', ');

    const removeBtn = iconButton(
      'trash',
      `Remove expense ${e.description || '(no description)'}`,
      'btn btn-icon btn-danger-ghost',
    );
    removeBtn.addEventListener('click', () => {
      state = { ...state, expenses: state.expenses.filter((x) => x.id !== e.id) };
      persistAndRender();
    });

    list.appendChild(
      el('li', { className: 'expense-row' }, [
        el('div', { className: 'expense-details' }, [
          el('div', { className: 'expense-summary' }, [
            el('strong', { text: e.description || '(no description)' }),
            el('span', { className: 'expense-total', text: `$${centsToDollarsText(total)}` }),
          ]),
          el('div', { className: 'expense-payers', text: `Paid by: ${payerText}` }),
        ]),
        removeBtn,
      ]),
    );
  }

  const card = el('section', { className: 'card' });
  card.append(
    el('div', { className: 'card-header' }, [
      el('h2', { className: 'card-title' }, [
        icon('file'),
        el('span', { text: 'Expenses' }),
        el('span', { className: 'count', text: `(${state.expenses.length})` }),
      ]),
      el('div', { className: 'card-actions' }, [renderPasteTriggerButton()]),
    ]),
    state.expenses.length > 0
      ? list
      : el('p', {
          className: 'empty-state',
          text: 'No expenses yet — add one below, or paste from a chat.',
        }),
    renderAddExpenseForm(),
  );
  return card;
}

/* ---------- Results ---------- */

function statusIconName(status: TableRow['status']): IconName {
  if (status === 'is owed') return 'arrowUpRight';
  if (status === 'owes') return 'arrowDownRight';
  return 'check';
}

function renderResultsSection(): HTMLElement {
  const card = el('section', { className: 'card' });
  const header = el('div', { className: 'card-header' }, [
    el('h2', { className: 'card-title' }, [icon('barChart'), el('span', { text: 'Results' })]),
  ]);

  if (state.participants.length === 0) {
    card.append(
      header,
      el('p', {
        className: 'empty-state',
        text: 'Add at least one participant to see a share breakdown.',
      }),
    );
    return card;
  }

  let result: CalculationResult;
  try {
    result = calculate(toCalculationInput(state));
  } catch (err) {
    card.append(header, el('p', { className: 'error', text: (err as Error).message }));
    return card;
  }

  const summary = el('div', { className: 'results-summary' }, [
    el('span', { className: 'total-label', text: 'Total cost' }),
    el('span', { className: 'total-value', text: `$${centsToDollarsText(result.totalAmountCents)}` }),
  ]);

  const table = el('table', { className: 'results-table' });
  table.appendChild(
    el('thead', {}, [
      el(
        'tr',
        {},
        ['Name', 'Paid', 'Share', 'Net', 'Status'].map((h) => el('th', { text: h })),
      ),
    ]),
  );
  const tbody = el('tbody');
  for (const row of toTableRows(result)) {
    const pill = el('span', { className: 'status-pill' }, [
      icon(statusIconName(row.status)),
      el('span', { text: row.status }),
    ]);
    tbody.appendChild(
      el('tr', { className: `status-${row.status.replace(' ', '-')}` }, [
        el('td', { text: row.name }),
        el('td', { text: row.paid }),
        el('td', { text: row.share }),
        el('td', { text: row.net }),
        el('td', {}, [pill]),
      ]),
    );
  }
  table.appendChild(tbody);

  const whatsappText = formatWhatsApp(result);
  const whatsappBox = el('textarea', {
    className: 'whatsapp-box',
    readOnly: true,
    rows: Math.min(result.participants.length + 4, 12),
  });
  whatsappBox.setAttribute('aria-label', 'WhatsApp-ready summary text');
  whatsappBox.value = whatsappText;

  const copyStatus = el('span', { className: 'copy-status' });
  copyStatus.setAttribute('role', 'status');
  const copyBtn = el('button', { type: 'button', className: 'btn' }, [
    icon('copy'),
    el('span', { text: 'Copy WhatsApp text' }),
  ]);
  copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(whatsappText).then(
      () => {
        copyStatus.textContent = 'Copied!';
        setTimeout(() => {
          copyStatus.textContent = '';
        }, 2000);
      },
      () => {
        copyStatus.textContent = 'Could not copy automatically — select the text above manually.';
      },
    );
  });

  card.append(
    header,
    summary,
    el('div', { className: 'table-wrap' }, [table]),
    el('div', { className: 'whatsapp-output' }, [
      el('h3', {}, [icon('clipboard'), el('span', { text: 'WhatsApp-ready summary' })]),
      whatsappBox,
      el('div', { className: 'whatsapp-actions' }, [copyBtn, copyStatus]),
    ]),
  );
  return card;
}

/* ---------- Root render ---------- */

function render(): void {
  const children: Node[] = [
    renderHeader(),
    renderParticipantsSection(),
    renderExpensesSection(),
    renderResultsSection(),
  ];
  if (isPasteModalOpen) {
    children.push(renderPasteModal());
  }
  app.replaceChildren(...children);
}

render();
