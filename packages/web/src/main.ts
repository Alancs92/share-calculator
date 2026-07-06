import {
  calculate,
  formatWhatsApp,
  parseChatText,
  toTableRows,
  type CalculationResult,
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

function generateId(): string {
  return crypto.randomUUID();
}

let state: AppState = loadState() ?? createEmptyState();

// Transient (not persisted) in-progress state for the "add expense" form, kept
// outside `state` so an unrelated re-render (e.g. editing an exception) doesn't
// wipe out payer rows the user is still filling in.
let pendingDescription = '';
let pendingPayerRows: Array<{ participantId: string; amountText: string }> = [
  { participantId: '', amountText: '' },
];
let pasteText = '';
let pasteMessage = '';

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

function renderParticipantsSection(): HTMLElement {
  const list = el('ul', { className: 'participant-list' });

  for (const p of state.participants) {
    const current = findExceptionKind(p.id);

    const kindSelect = el('select', { className: 'exception-kind' });
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

    const removeBtn = el('button', { text: 'Remove', type: 'button', className: 'remove-btn' });
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
    placeholder: 'Participant name',
    className: 'new-participant-name',
  });
  const addForm = el('form', { className: 'add-participant-form' }, [
    nameInput,
    el('button', { text: 'Add participant', type: 'submit' }),
  ]);
  addForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    state = { ...state, participants: [...state.participants, { id: generateId(), name }] };
    nameInput.value = '';
    persistAndRender();
  });

  return el('section', { className: 'section' }, [
    el('h2', { text: `Participants (${state.participants.length})` }),
    list,
    addForm,
  ]);
}

function renderAddExpenseForm(): HTMLElement {
  const descInput = el('input', {
    type: 'text',
    placeholder: 'Description (optional)',
    className: 'expense-description',
  });
  descInput.value = pendingDescription;
  descInput.addEventListener('input', () => {
    pendingDescription = descInput.value;
  });

  const rowsContainer = el('div', { className: 'payer-rows' });
  pendingPayerRows.forEach((row, index) => {
    const select = el('select', { className: 'payer-select' });
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
    amountInput.value = row.amountText;
    amountInput.addEventListener('input', () => {
      row.amountText = amountInput.value;
    });

    const removeRowBtn = el('button', { text: '✕', type: 'button', className: 'remove-row-btn' });
    removeRowBtn.addEventListener('click', () => {
      pendingPayerRows.splice(index, 1);
      if (pendingPayerRows.length === 0) {
        pendingPayerRows.push({ participantId: '', amountText: '' });
      }
      render();
    });

    rowsContainer.appendChild(el('div', { className: 'payer-row' }, [select, amountInput, removeRowBtn]));
  });

  const addRowBtn = el('button', { text: '+ Add payer', type: 'button' });
  addRowBtn.addEventListener('click', () => {
    pendingPayerRows.push({ participantId: '', amountText: '' });
    render();
  });

  const errorBox = el('p', { className: 'form-error' });
  const submitBtn = el('button', { text: 'Add expense', type: 'submit' });

  const form = el('form', { className: 'add-expense-form' }, [
    descInput,
    rowsContainer,
    addRowBtn,
    submitBtn,
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

    const removeBtn = el('button', { text: 'Remove', type: 'button', className: 'remove-btn' });
    removeBtn.addEventListener('click', () => {
      state = { ...state, expenses: state.expenses.filter((x) => x.id !== e.id) };
      persistAndRender();
    });

    list.appendChild(
      el('li', { className: 'expense-row' }, [
        el('div', { className: 'expense-summary' }, [
          el('strong', { text: e.description || '(no description)' }),
          el('span', { text: ` — $${centsToDollarsText(total)} total` }),
        ]),
        el('div', { className: 'expense-payers', text: `Paid by: ${payerText}` }),
        removeBtn,
      ]),
    );
  }

  return el('section', { className: 'section' }, [
    el('h2', { text: `Expenses (${state.expenses.length})` }),
    list,
    renderAddExpenseForm(),
  ]);
}

function renderPasteSection(): HTMLElement {
  const textarea = el('textarea', {
    className: 'paste-textarea',
    rows: 4,
    placeholder: 'Paste chat text, e.g. "Jenny: 10.4, Paul: 20, Linda: 11.5"',
  });
  textarea.value = pasteText;
  textarea.addEventListener('input', () => {
    pasteText = textarea.value;
  });

  const message = el('p', { className: 'paste-message', text: pasteMessage });
  const button = el('button', { text: 'Parse & add as expense', type: 'button' });
  button.addEventListener('click', () => {
    const parsed = parseChatText(pasteText);
    if (parsed.entries.length === 0) {
      pasteMessage = 'No name:amount pairs found in that text.';
      persistAndRender();
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
    persistAndRender();
  });

  return el('section', { className: 'section' }, [
    el('h2', { text: 'Paste from chat' }),
    textarea,
    button,
    message,
  ]);
}

function renderResultsSection(): HTMLElement {
  if (state.participants.length === 0) {
    return el('section', { className: 'section' }, [
      el('h2', { text: 'Results' }),
      el('p', { text: 'Add at least one participant to see a share breakdown.' }),
    ]);
  }

  let result: CalculationResult;
  try {
    result = calculate(toCalculationInput(state));
  } catch (err) {
    return el('section', { className: 'section' }, [
      el('h2', { text: 'Results' }),
      el('p', { className: 'error', text: (err as Error).message }),
    ]);
  }

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
    tbody.appendChild(
      el('tr', { className: `status-${row.status.replace(' ', '-')}` }, [
        el('td', { text: row.name }),
        el('td', { text: row.paid }),
        el('td', { text: row.share }),
        el('td', { text: row.net }),
        el('td', { text: row.status }),
      ]),
    );
  }
  table.appendChild(tbody);

  const whatsappText = formatWhatsApp(result);
  const whatsappBox = el('textarea', {
    className: 'whatsapp-box',
    readOnly: true,
    rows: result.participants.length + 4,
  });
  whatsappBox.value = whatsappText;

  const copyStatus = el('span', { className: 'copy-status' });
  const copyBtn = el('button', { text: 'Copy WhatsApp text', type: 'button' });
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

  return el('section', { className: 'section' }, [
    el('h2', { text: 'Results' }),
    table,
    el('h3', { text: 'WhatsApp-ready summary' }),
    whatsappBox,
    copyBtn,
    copyStatus,
  ]);
}

function render(): void {
  app.replaceChildren(
    el('header', {}, [
      el('h1', { text: 'Share Calculator' }),
      el('p', {
        className: 'subtitle',
        text: 'Split a shared cost across a group, with exceptions for caps or exclusions.',
      }),
    ]),
    renderParticipantsSection(),
    renderExpensesSection(),
    renderPasteSection(),
    renderResultsSection(),
  );
}

render();
