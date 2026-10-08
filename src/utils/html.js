// Description HTML handling. The API returns descriptions HTML-entity-escaped
// ("&lt;div&gt;&lt;ul&gt;…" with inner entities double-escaped), and the web UI stores
// rich text as HTML with checklist items as <li><input type="checkbox" …/>…</li>.

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', copy: '©', reg: '®', trade: '™', bull: '•', middot: '·', laquo: '«', raquo: '»', times: '×' };

/** Decode HTML entities once, without a DOM (so it is testable and safe on any string). */
export function decodeEntities(s) {
  return String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000 ? String.fromCodePoint(code) : m;
    }
    const v = NAMED[body.toLowerCase()];
    return v !== undefined ? v : m;
  });
}

/** True when the string contains HTML tags (after one decode). */
export const looksLikeHtml = (s) => /<[a-z][^>]*>/i.test(decodeEntities(s));

/** Raw description from the API → real HTML string (decoded once if it arrived escaped). */
export function descriptionToHtml(raw) {
  const s = String(raw ?? '');
  if (!s.trim()) return '';
  // Escaped form: no real tags but "&lt;" tags appear.
  if (!/<[a-z][^>]*>/i.test(s) && /&lt;[a-z]/i.test(s)) return decodeEntities(s);
  return s;
}

const ALLOWED = {
  div: [], p: [], br: [], ul: [], ol: [], li: [], strong: [], b: [], em: [], i: [], u: [], s: [], strike: [], code: [], pre: [], blockquote: [],
  h1: [], h2: [], h3: [], h4: [], span: [], a: ['href', 'target', 'rel'], input: ['type', 'checked', 'disabled', 'aria-label'],
};
const BLOCK = new Set(['div', 'p', 'ul', 'ol', 'li', 'pre', 'blockquote', 'h1', 'h2', 'h3', 'h4']);

/** Allow-list sanitizer. Needs a DOM (browser); returns clean HTML. */
export function sanitizeHtml(html) {
  if (typeof document === 'undefined') return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = String(html ?? '');
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) continue;
      if (child.nodeType !== 1) { child.remove(); continue; }
      const tag = child.tagName.toLowerCase();
      if (tag === 'script' || tag === 'style' || tag === 'iframe' || tag === 'object' || tag === 'embed') { child.remove(); continue; }
      if (!(tag in ALLOWED)) { // unwrap: keep children
        const frag = document.createDocumentFragment();
        while (child.firstChild) frag.appendChild(child.firstChild);
        child.replaceWith(frag);
        continue;
      }
      for (const attr of [...child.attributes]) {
        if (!ALLOWED[tag].includes(attr.name.toLowerCase())) child.removeAttribute(attr.name);
      }
      if (tag === 'a') {
        const href = child.getAttribute('href') || '';
        if (!/^(https?:|mailto:)/i.test(href)) child.removeAttribute('href');
        child.setAttribute('target', '_blank'); child.setAttribute('rel', 'noopener');
      }
      if (tag === 'input' && child.getAttribute('type') !== 'checkbox') { child.remove(); continue; }
      walk(child);
    }
  };
  walk(tpl.content);
  return tpl.innerHTML;
}

/** Editor DOM → HTML to store: checkboxes back to the vendor's disabled form with a text aria-label. */
export function serializeForSave(editorHtml) {
  if (typeof document === 'undefined') return editorHtml;
  const tpl = document.createElement('template');
  tpl.innerHTML = sanitizeHtml(editorHtml);
  for (const cb of tpl.content.querySelectorAll('input[type="checkbox"]')) {
    const li = cb.closest('li');
    const label = (li ? li.textContent : '').replace(/\s+/g, ' ').trim();
    const checked = cb.hasAttribute('checked') || cb.checked;
    cb.setAttribute('disabled', 'disabled');
    if (label) cb.setAttribute('aria-label', label); else cb.removeAttribute('aria-label');
    if (checked) cb.setAttribute('checked', 'checked'); else cb.removeAttribute('checked');
  }
  // drop empty trailing blocks the editor tends to leave
  let out = tpl.innerHTML.replace(/(<div><br><\/div>|<p><br><\/p>)+$/g, '').trim();
  if (!tpl.content.textContent.trim() && !tpl.content.querySelector('input')) out = '';
  return out;
}

/** Plain text of a description, for search/tooltips. */
export function descriptionText(raw, max = 300) {
  const html = descriptionToHtml(raw);
  const text = decodeEntities(html.replace(/<li>/gi, '\n• ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/(p|div|li|h[1-4])>/gi, '\n').replace(/<[^>]+>/g, ''));
  return text.replace(/[ \t\u00a0]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim().slice(0, max);
}

/** Normalised comparison so an untouched description is not re-sent. */
export const sameHtml = (a, b) => String(a || '').replace(/\s+/g, ' ').trim() === String(b || '').replace(/\s+/g, ' ').trim();

export const isBlockTag = (tag) => BLOCK.has(String(tag).toLowerCase());
