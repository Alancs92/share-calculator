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
  type StateExpense,
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

let pasteText = '';
let pasteMessage = '';

type ActiveModal =
  | { kind: 'paste' }
  | { kind: 'participant'; participantId: string }
  | { kind: 'expense'; expenseId: string | null }
  | null;

let activeModal: ActiveModal = null;

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

function exceptionSummaryText(exception: { kind: ExceptionKind; amountCents?: number }): string {
  switch (exception.kind) {
    case 'excluded':
      return "Can't pay";
    case 'capped':
      return `Capped at $${centsToDollarsText(exception.amountCents)}`;
    case 'fixed':
      return `Fixed at $${centsToDollarsText(exception.amountCents)}`;
    default:
      return '';
  }
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

/* ---------- Generic modal ---------- */

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

function closeModal(restoreFocusSelector?: string): void {
  activeModal = null;
  render();
  if (restoreFocusSelector) {
    app.querySelector<HTMLElement>(restoreFocusSelector)?.focus();
  }
}

function createModal(opts: {
  titleId: string;
  titleIcon: IconName;
  titleText: string;
  body: Node[];
  onClose: () => void;
}): HTMLElement {
  const closeBtn = iconButton('x', 'Close');
  closeBtn.addEventListener('click', opts.onClose);

  const heading = el('h2', { id: opts.titleId }, [
    icon(opts.titleIcon),
    el('span', { text: opts.titleText }),
  ]);

  const modal = el('div', { className: 'modal' });
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', opts.titleId);
  modal.append(el('div', { className: 'modal-header' }, [heading, closeBtn]), ...opts.body);

  const backdrop = el('div', { className: 'modal-backdrop' }, [modal]);
  backdrop.addEventListener('mousedown', (ev) => {
    if (ev.target === backdrop) opts.onClose();
  });
  backdrop.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape') {
      ev.stopPropagation();
      opts.onClose();
    } else if (ev.key === 'Tab') {
      trapFocus(ev, modal);
    }
  });

  return backdrop;
}

/* ---------- Paste-from-chat modal ---------- */

function openPasteModal(): void {
  activeModal = { kind: 'paste' };
  render();
  app.querySelector<HTMLTextAreaElement>('.paste-textarea')?.focus();
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
  const onClose = () => closeModal('.paste-trigger');

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
    onClose();
  });

  return createModal({
    titleId: 'paste-modal-title',
    titleIcon: 'clipboard',
    titleText: 'Paste from chat',
    body: [
      el('p', {
        className: 'modal-hint',
        text: 'Supports commas, new lines, semicolons, or bullet points — paste straight from a chat.',
      }),
      textarea,
      parseBtn,
      message,
    ],
    onClose,
  });
}

/* ---------- Participants ---------- */

function openParticipantModal(participantId: string): void {
  activeModal = { kind: 'participant', participantId };
  render();
  app.querySelector<HTMLInputElement>('.edit-participant-name')?.focus();
}

function renderEditParticipantModal(participantId: string): HTMLElement {
  const restoreSelector = `[data-edit-participant-btn="${participantId}"]`;
  const onClose = () => closeModal(restoreSelector);
  const participant = state.participants.find((p) => p.id === participantId);

  if (!participant) {
    return createModal({
      titleId: 'edit-participant-title',
      titleIcon: 'users',
      titleText: 'Edit participant',
      body: [el('p', { text: 'This participant no longer exists.' })],
      onClose,
    });
  }

  const nameInput = el('input', {
    type: 'text',
    id: 'edit-participant-name',
    className: 'edit-participant-name',
  });
  nameInput.value = participant.name;
  const nameLabel = el('label', { text: 'Name', htmlFor: 'edit-participant-name' });

  const current = findExceptionKind(participantId);
  const kindSelect = el('select', { id: 'edit-participant-kind' });
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
  const kindLabel = el('label', { text: 'Payment exception', htmlFor: 'edit-participant-kind' });

  const showAmount = current.kind === 'capped' || current.kind === 'fixed';
  const amountInput = el('input', {
    type: 'number',
    step: '0.01',
    min: '0',
    id: 'edit-participant-amount',
    placeholder: '0.00',
  });
  amountInput.value = centsToDollarsText(current.amountCents);
  amountInput.style.display = showAmount ? '' : 'none';
  const amountLabel = el('label', { text: 'Amount', htmlFor: 'edit-participant-amount' });
  amountLabel.style.display = showAmount ? '' : 'none';

  kindSelect.addEventListener('change', () => {
    const show = kindSelect.value === 'capped' || kindSelect.value === 'fixed';
    amountInput.style.display = show ? '' : 'none';
    amountLabel.style.display = show ? '' : 'none';
  });

  const saveBtn = el('button', { type: 'submit', className: 'btn btn-primary' }, [
    icon('check'),
    el('span', { text: 'Save' }),
  ]);

  const form = el('form', { className: 'edit-form' }, [
    nameLabel,
    nameInput,
    kindLabel,
    kindSelect,
    amountLabel,
    amountInput,
    saveBtn,
  ]);
  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const newName = nameInput.value.trim();
    state = {
      ...state,
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, name: newName || p.name } : p,
      ),
    };
    setExceptionKind(participantId, kindSelect.value as ExceptionKind, dollarsToCents(amountInput.value));
    saveState(state);
    onClose();
  });

  return createModal({
    titleId: 'edit-participant-title',
    titleIcon: 'users',
    titleText: `Edit ${participant.name}`,
    body: [form],
    onClose,
  });
}

function renderParticipantsSection(): HTMLElement {
  const grid = el('ul', { className: 'people-grid' });

  for (const p of state.participants) {
    const current = findExceptionKind(p.id);
    const note = exceptionSummaryText(current);

    const editBtn = iconButton('pencil', `Edit ${p.name}`, 'btn btn-icon btn-ghost btn-sm');
    editBtn.dataset.editParticipantBtn = p.id;
    editBtn.addEventListener('click', () => openParticipantModal(p.id));

    const removeBtn = iconButton('trash', `Remove ${p.name}`, 'btn btn-icon btn-danger-ghost btn-sm');
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

    grid.appendChild(
      el('li', { className: 'person-card' }, [
        el('div', { className: 'person-info' }, [
          el('span', { className: 'person-name', text: p.name }),
          ...(note ? [el('span', { className: 'person-note', text: note })] : []),
        ]),
        el('div', { className: 'person-actions' }, [editBtn, removeBtn]),
      ]),
    );
  }

  const nameInput = el('input', {
    type: 'text',
    id: 'new-participant-name',
    placeholder: 'e.g. Jenny, Paul, Linda',
    className: 'new-participant-name',
  });
  const nameLabel = el('label', {
    text: 'Participant name(s)',
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
    const names = nameInput.value
      .split(/[,;]/)
      .map((n) => n.trim())
      .filter((n) => n.length > 0);
    if (names.length === 0) return;
    state = {
      ...state,
      participants: [...state.participants, ...names.map((name) => ({ id: generateId(), name }))],
    };
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
      ? grid
      : el('p', {
          className: 'empty-state',
          text: 'No participants yet — add the people sharing this cost below.',
        }),
    addForm,
    el('p', {
      className: 'field-hint',
      text: 'Tip: separate multiple names with a comma or semicolon to add them all at once.',
    }),
  );
  return card;
}

/* ---------- Expenses ---------- */

function openExpenseModal(expenseId: string | null): void {
  activeModal = { kind: 'expense', expenseId };
  render();
  app.querySelector<HTMLInputElement>('.expense-description')?.focus();
}

function renderExpenseForm(existing: StateExpense | undefined, onDone: () => void): HTMLElement {
  if (state.participants.length === 0) {
    return el('p', {
      className: 'empty-state',
      text: 'Add at least one participant before adding an expense.',
    });
  }

  const isEdit = existing !== undefined;
  const descInput = el('input', {
    type: 'text',
    id: 'expense-description',
    placeholder: 'Description (optional)',
    className: 'expense-description',
  });
  descInput.value = existing?.description ?? '';
  const descLabel = el('label', {
    text: 'Expense description',
    className: 'visually-hidden',
    htmlFor: 'expense-description',
  });

  const existingAmounts = new Map(
    (existing?.paidBy ?? []).map((p) => [p.participantId, centsToDollarsText(p.amountCents)]),
  );

  const rows = el('div', { className: 'payer-fields' });
  for (const p of state.participants) {
    const inputId = `payer-amount-${p.id}`;
    const amountInput = el('input', {
      type: 'number',
      step: '0.01',
      min: '0',
      id: inputId,
      placeholder: '0.00',
      className: 'payer-amount-field',
    });
    amountInput.dataset.participantId = p.id;
    amountInput.value = existingAmounts.get(p.id) ?? '';
    const label = el('label', { text: p.name, htmlFor: inputId, className: 'payer-field-label' });
    rows.appendChild(el('div', { className: 'payer-field-row' }, [label, amountInput]));
  }

  const errorBox = el('p', { className: 'form-error' });
  const submitBtn = el('button', { type: 'submit', className: 'btn btn-primary' }, [
    icon(isEdit ? 'check' : 'plus'),
    el('span', { text: isEdit ? 'Save changes' : 'Add expense' }),
  ]);

  const form = el('form', { className: 'expense-form' }, [
    descLabel,
    descInput,
    el('p', {
      className: 'field-hint',
      text: "Enter how much each person paid toward this expense. Leave blank for anyone who didn't pay.",
    }),
    rows,
    el('div', { className: 'expense-form-actions' }, [submitBtn]),
    errorBox,
  ]);

  form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const paidBy: StatePayment[] = [];
    form.querySelectorAll<HTMLInputElement>('.payer-amount-field').forEach((input) => {
      const participantId = input.dataset.participantId;
      const amountCents = dollarsToCents(input.value);
      if (participantId && amountCents !== undefined && amountCents > 0) {
        paidBy.push({ participantId, amountCents });
      }
    });
    if (paidBy.length === 0) {
      errorBox.textContent = 'Enter an amount for at least one payer.';
      return;
    }
    const description = descInput.value.trim();
    if (isEdit) {
      state = {
        ...state,
        expenses: state.expenses.map((e) =>
          e.id === existing.id ? { ...e, description, paidBy } : e,
        ),
      };
    } else {
      state = {
        ...state,
        expenses: [...state.expenses, { id: generateId(), description, paidBy }],
      };
    }
    saveState(state);
    onDone();
  });

  return form;
}

function renderAddOrEditExpenseModal(expenseId: string | null): HTMLElement {
  const existing = expenseId ? state.expenses.find((e) => e.id === expenseId) : undefined;
  const restoreSelector = expenseId
    ? `[data-edit-expense-btn="${expenseId}"]`
    : '.add-expense-trigger';
  const onClose = () => closeModal(restoreSelector);
  const form = renderExpenseForm(existing, onClose);

  return createModal({
    titleId: 'expense-modal-title',
    titleIcon: 'file',
    titleText: existing ? 'Edit expense' : 'Add expense',
    body: [form],
    onClose,
  });
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

    const editBtn = iconButton(
      'pencil',
      `Edit expense ${e.description || '(no description)'}`,
      'btn btn-icon btn-ghost btn-sm',
    );
    editBtn.dataset.editExpenseBtn = e.id;
    editBtn.addEventListener('click', () => openExpenseModal(e.id));

    const removeBtn = iconButton(
      'trash',
      `Remove expense ${e.description || '(no description)'}`,
      'btn btn-icon btn-danger-ghost btn-sm',
    );
    removeBtn.addEventListener('click', () => {
      state = { ...state, expenses: state.expenses.filter((x) => x.id !== e.id) };
      persistAndRender();
    });

    list.appendChild(
      el('li', { className: 'expense-card' }, [
        el('div', { className: 'expense-info' }, [
          el('div', { className: 'expense-title-row' }, [
            el('strong', { text: e.description || '(no description)' }),
            el('span', { className: 'expense-total', text: `$${centsToDollarsText(total)}` }),
          ]),
          el('div', { className: 'expense-payers', text: `Paid by: ${payerText}` }),
        ]),
        el('div', { className: 'expense-actions' }, [editBtn, removeBtn]),
      ]),
    );
  }

  const addExpenseBtn = el(
    'button',
    { type: 'button', className: 'btn btn-primary btn-sm add-expense-trigger' },
    [icon('plus'), el('span', { text: 'Add expense' })],
  );
  addExpenseBtn.addEventListener('click', () => openExpenseModal(null));

  const card = el('section', { className: 'card' });
  card.append(
    el('div', { className: 'card-header' }, [
      el('h2', { className: 'card-title' }, [
        icon('file'),
        el('span', { text: 'Expenses' }),
        el('span', { className: 'count', text: `(${state.expenses.length})` }),
      ]),
      el('div', { className: 'card-actions' }, [renderPasteTriggerButton(), addExpenseBtn]),
    ]),
    state.expenses.length > 0
      ? list
      : el('p', {
          className: 'empty-state',
          text: 'No expenses yet — add one, or paste from a chat.',
        }),
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
  if (activeModal?.kind === 'paste') {
    children.push(renderPasteModal());
  } else if (activeModal?.kind === 'participant') {
    children.push(renderEditParticipantModal(activeModal.participantId));
  } else if (activeModal?.kind === 'expense') {
    children.push(renderAddOrEditExpenseModal(activeModal.expenseId));
  }
  app.replaceChildren(...children);
}

render();
