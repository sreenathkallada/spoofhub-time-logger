import { useEffect, useRef, useState } from 'react';
import { Bold, Italic, List, ListOrdered, CheckSquare, Link as LinkIcon, RemoveFormatting } from 'lucide-react';
import { sanitizeHtml } from '../utils/html.js';
import { tips } from '../utils/tips.js';

/**
 * Small contenteditable editor that round-trips the vendor's description HTML.
 * value: HTML string. onChange(html) fires with the live editor HTML (sanitize on save).
 */
export default function RichEditor({ value, onChange, disabled, placeholder = 'Details, optional' }) {
  const ref = useRef(null);
  const lastEmitted = useRef(null);
  const [focused, setFocused] = useState(false);

  // Load value into the editor only when it changed from outside.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value === lastEmitted.current) return;
    el.innerHTML = sanitizeHtml(value || '');
    // checkboxes are stored disabled; make them clickable while editing
    for (const cb of el.querySelectorAll('input[type="checkbox"]')) { cb.removeAttribute('disabled'); cb.checked = cb.hasAttribute('checked'); }
    lastEmitted.current = value;
  }, [value]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    // reflect live checkbox state into attributes so innerHTML carries it
    for (const cb of el.querySelectorAll('input[type="checkbox"]')) { if (cb.checked) cb.setAttribute('checked', 'checked'); else cb.removeAttribute('checked'); }
    const html = el.innerHTML;
    lastEmitted.current = html;
    onChange(html);
  }

  function cmd(name, arg) {
    ref.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  }

  function insertChecklist() {
    ref.current?.focus();
    const sel = window.getSelection();
    const li = sel?.anchorNode ? (sel.anchorNode.nodeType === 1 ? sel.anchorNode : sel.anchorNode.parentElement)?.closest('li') : null;
    if (li && ref.current.contains(li)) {
      if (li.querySelector('input[type="checkbox"]')) { li.querySelector('input[type="checkbox"]').remove(); emit(); return; }
      const cb = document.createElement('input'); cb.type = 'checkbox';
      li.insertBefore(document.createTextNode(' '), li.firstChild); li.insertBefore(cb, li.firstChild);
      emit(); return;
    }
    document.execCommand('insertHTML', false, '<ul><li><input type="checkbox" />&nbsp;</li></ul>');
    emit();
  }

  function addLink() {
    const url = window.prompt('Link address (https://…)');
    if (!url) return;
    cmd('createLink', /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`);
  }

  function onKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
      if (e.key.toLowerCase() === 'b') { e.preventDefault(); cmd('bold'); }
      if (e.key.toLowerCase() === 'i') { e.preventDefault(); cmd('italic'); }
    }
    if (e.key === 'Enter') {
      // New checklist item inherits a checkbox
      const sel = window.getSelection();
      const node = sel?.anchorNode; const li = node ? (node.nodeType === 1 ? node : node.parentElement)?.closest('li') : null;
      if (li && li.querySelector('input[type="checkbox"]') && li.textContent.trim()) {
        setTimeout(() => {
          const s2 = window.getSelection(); const n2 = s2?.anchorNode; const li2 = n2 ? (n2.nodeType === 1 ? n2 : n2.parentElement)?.closest('li') : null;
          if (li2 && li2 !== li && !li2.querySelector('input[type="checkbox"]')) {
            const cb = document.createElement('input'); cb.type = 'checkbox';
            li2.insertBefore(document.createTextNode(' '), li2.firstChild); li2.insertBefore(cb, li2.firstChild);
            const r = document.createRange(); r.setStartAfter(li2.childNodes[1]); r.collapse(true); s2.removeAllRanges(); s2.addRange(r);
            emit();
          }
        }, 0);
      }
    }
  }

  function onPaste(e) {
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    document.execCommand('insertHTML', false, html ? sanitizeHtml(html) : text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\n/g, '<br>'));
    emit();
  }

  const empty = !value || !value.replace(/<[^>]+>|&nbsp;|\s/g, '');
  const btn = (title, Icon, onClick, label) => (
    <button type="button" className="rt-btn" title={title} aria-label={label} disabled={disabled} onMouseDown={(e) => e.preventDefault()} onClick={onClick}><Icon size={14} /></button>
  );

  return (
    <div className={`rich ${focused ? 'focused' : ''} ${disabled ? 'disabled' : ''}`}>
      <div className="rt-toolbar" role="toolbar" aria-label="Formatting">
        {btn(tips.rtBold, Bold, () => cmd('bold'), 'Bold')}
        {btn(tips.rtItalic, Italic, () => cmd('italic'), 'Italic')}
        {btn(tips.rtBullets, List, () => cmd('insertUnorderedList'), 'Bulleted list')}
        {btn(tips.rtNumbers, ListOrdered, () => cmd('insertOrderedList'), 'Numbered list')}
        {btn(tips.rtCheck, CheckSquare, insertChecklist, 'Checklist item')}
        {btn(tips.rtLink, LinkIcon, addLink, 'Link')}
        {btn(tips.rtClear, RemoveFormatting, () => cmd('removeFormat'), 'Clear formatting')}
      </div>
      <div className="rt-wrap">
        {empty && !focused && <div className="rt-placeholder">{placeholder}</div>}
        <div
          ref={ref} className="rt-area" contentEditable={!disabled} suppressContentEditableWarning
          title={tips.rtArea} role="textbox" aria-multiline="true" aria-label="Description"
          onInput={emit} onClick={(e) => { if (e.target.type === 'checkbox') setTimeout(emit, 0); }}
          onKeyDown={onKeyDown} onPaste={onPaste} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); emit(); }}
        />
      </div>
    </div>
  );
}
