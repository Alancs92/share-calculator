export interface GuideHighlight {
  top: string;
  left: string;
  width: string;
  height: string;
}

export interface GuideSlide {
  title: string;
  image: string;
  alt: string;
  caption: string;
  highlight?: GuideHighlight;
}

export const GUIDE_SLIDES: GuideSlide[] = [
  {
    title: 'Add your people',
    image: 'guide/participants.png',
    alt: 'The Participants card showing three name chips and an add-participant field',
    caption:
      'Add everyone sharing the cost. Type several names separated by a comma or semicolon to add them all at once.',
    highlight: { top: '58.3%', left: '3.9%', width: '92.3%', height: '18.4%' },
  },
  {
    title: 'Set an exception (if needed)',
    image: 'guide/exception.png',
    alt: 'The edit-participant dialog with "Capped at" selected and an amount entered',
    caption:
      "Tap the pencil icon on anyone's card to rename them or set an exception — capped, fixed, or unable to pay.",
    highlight: { top: '48.8%', left: '5.7%', width: '88.6%', height: '29.9%' },
  },
  {
    title: 'Add an expense',
    image: 'guide/expense-form.png',
    alt: 'The Add expense dialog listing each participant with an amount field',
    caption:
      "Enter how much each person paid. Leave a field blank for anyone who didn't pay toward this expense.",
    highlight: { top: '42.4%', left: '5.7%', width: '88.6%', height: '34.7%' },
  },
  {
    title: 'Or paste from a chat',
    image: 'guide/paste.png',
    alt: 'The Paste from chat dialog with example WhatsApp-style text entered',
    caption:
      "Paste text copied from WhatsApp or any chat. Matching names become payers automatically, and new names are added as participants.",
    highlight: { top: '34.7%', left: '5.7%', width: '88.6%', height: '35.5%' },
  },
  {
    title: 'See who owes what',
    image: 'guide/results.png',
    alt: 'The Results card with a breakdown table and a Copy WhatsApp text button',
    caption: 'The table updates live. Copy a WhatsApp-ready summary with one tap to share it.',
    highlight: { top: '89.8%', left: '3.9%', width: '29.9%', height: '6.3%' },
  },
];

/** Wraps an index into [0, length) — e.g. -1 with length 5 becomes 4, not a negative index. */
export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}
