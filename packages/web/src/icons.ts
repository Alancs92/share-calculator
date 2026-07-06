const SVG_NS = 'http://www.w3.org/2000/svg';

const PATHS = {
  calculator:
    '<rect x="4" y="2" width="16" height="20" rx="2"/><line x1="8" y1="6" x2="16" y2="6"/><line x1="8" y1="10" x2="8" y2="10.01"/><line x1="12" y1="10" x2="12" y2="10.01"/><line x1="16" y1="10" x2="16" y2="10.01"/><line x1="8" y1="14" x2="8" y2="14.01"/><line x1="12" y1="14" x2="12" y2="14.01"/><line x1="16" y1="14" x2="16" y2="14.01"/><line x1="8" y1="18" x2="8" y2="18.01"/><line x1="12" y1="18" x2="12" y2="18.01"/><line x1="16" y1="18" x2="16" y2="18.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><line x1="12" y1="1.5" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22.5"/><line x1="4.2" y1="4.2" x2="5.9" y2="5.9"/><line x1="18.1" y1="18.1" x2="19.8" y2="19.8"/><line x1="1.5" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22.5" y2="12"/><line x1="4.2" y1="19.8" x2="5.9" y2="18.1"/><line x1="18.1" y1="5.9" x2="19.8" y2="4.2"/>',
  moon: '<path d="M20.5 14.5A9 9 0 1 1 9.5 3.5a7 7 0 0 0 11 11z"/>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  trash:
    '<polyline points="3.5,6.5 5,6.5 20.5,6.5"/><path d="M18.5 6.5v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-13m3 0v-2a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  x: '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>',
  clipboard:
    '<rect x="7" y="3.5" width="10" height="4" rx="1"/><path d="M7 5H5.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H17"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="16" x2="13" y2="16"/>',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5.5 15H4.5a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  arrowUpRight: '<line x1="7" y1="17" x2="17" y2="7"/><polyline points="8,7 17,7 17,16"/>',
  arrowDownRight: '<line x1="7" y1="7" x2="17" y2="17"/><polyline points="17,8 17,17 8,17"/>',
  check: '<polyline points="4,12.5 9.5,18 20,6"/>',
  users:
    '<circle cx="9" cy="8" r="3.2"/><path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0"/><circle cx="17.2" cy="9" r="2.3"/><path d="M15.6 19.5a4.2 4.2 0 0 1 6-3.6"/>',
  file: '<path d="M6.5 3h7l4 4v13a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M13.5 3v4h4"/><line x1="8.5" y1="12" x2="15.5" y2="12"/><line x1="8.5" y1="15.5" x2="13.5" y2="15.5"/>',
  barChart: '<line x1="5" y1="20.5" x2="5" y2="11"/><line x1="12" y1="20.5" x2="12" y2="5"/><line x1="19" y1="20.5" x2="19" y2="14.5"/>',
  pencil:
    '<path d="M4 16.7V20h3.3L18.4 8.9a1.7 1.7 0 0 0 0-2.4l-1.9-1.9a1.7 1.7 0 0 0-2.4 0z"/><line x1="13.5" y1="6" x2="18.4" y2="10.9"/>',
  helpCircle:
    '<circle cx="12" cy="12" r="9.25"/><path d="M9.3 9.3a2.7 2.7 0 1 1 4 2.35c-.7.4-1.3.95-1.3 1.85v.3"/><line x1="12" y1="16.7" x2="12" y2="16.71"/>',
  chevronLeft: '<polyline points="14.5,5 8,12 14.5,19"/>',
  chevronRight: '<polyline points="9.5,5 16,12 9.5,19"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName, className = 'icon'): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  svg.classList.add(className);
  svg.innerHTML = PATHS[name];
  return svg;
}
