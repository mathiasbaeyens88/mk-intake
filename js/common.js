/* Shared helpers: text safety, messages, dialogs, form fields, dates. */
const APP_VERSION = 'gh-2026-10-26';
const $app = document.getElementById('app');
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const MONTHS_NL = ['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
const DAYS_NL = ['ma','di','wo','do','vr','za','zo'];

function escapeHtml(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600); }

function openModal(inner, maxWidth) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `<div class="modal-box" style="max-width:${maxWidth || 440}px;">${inner}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
  return overlay;
}
function choiceModal(message, choices) {            // choices: [{key,label,cls}] -> Promise of the chosen key (null when dismissed)
  return new Promise(resolve => {
    const ov = openModal(`<div class="modal-head"><h3>Even opletten</h3><button class="modal-close" data-k="">&times;</button></div>
      <div class="modal-body"><p style="margin-top:0;">${escapeHtml(message)}</p></div>
      <div class="modal-foot" style="gap:8px;flex-wrap:wrap;">${choices.map(c => `<button class="btn ${c.cls || 'btn-ghost'}" data-k="${c.key}">${escapeHtml(c.label)}</button>`).join('')}</div>`, 460);
    const done = v => { ov.remove(); resolve(v); };
    ov.querySelectorAll('[data-k]').forEach(b => b.onclick = () => done(b.dataset.k || null));
    ov.addEventListener('click', e => { if (e.target === ov) done(null); });
  });
}
const confirmModal = (message, okLabel) => choiceModal(message, [{ key: 'no', label: 'Annuleren' }, { key: 'yes', label: okLabel || 'Bevestigen', cls: 'btn-danger' }]).then(k => k === 'yes');

async function copyText(text, okMsg) {
  try { await navigator.clipboard.writeText(text); toast(okMsg || 'Gekopieerd'); return true; } catch (e) {}
  try { const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.focus(); ta.select();
    const ok = document.execCommand('copy'); document.body.removeChild(ta); if (ok) { toast(okMsg || 'Gekopieerd'); return true; } } catch (e) {}
  const ov = openModal(`<div class="modal-head"><h3>Kopiëren</h3><button class="modal-close">&times;</button></div><div class="modal-body"><p style="margin-top:0;">Kopieer hieronder (Ctrl+C / Cmd+C).</p><textarea readonly style="width:100%;min-height:90px;">${escapeHtml(text)}</textarea></div>`);
  ov.querySelector('.modal-close').onclick = () => ov.remove(); ov.querySelector('textarea').select();
  return false;
}

/* ---- form fields ---- */
function fieldValue(d, owner, id) { return ((owner === 'dj' ? d.dj : d.client) || {})[id] || ''; }
function fieldHTML(f, value, disabled, owner) {
  const dis = disabled ? 'disabled' : '', common = `autocomplete="off" data-owner="${owner}" data-id="${f.id}" ${dis}`;
  let control;
  if (f.type === 'select') control = `<select ${common}>${f.options.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o) || '—'}</option>`).join('')}</select>`;
  else if (f.type === 'textarea') control = `<textarea ${common} placeholder="${escapeHtml(f.placeholder || '')}">${escapeHtml(value)}</textarea>`;
  else control = `<input ${common} type="${f.type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(f.placeholder || '')}">`;
  return `<div class="field ${f.full ? 'full' : ''}"><label class="field-label">${f.label}</label>${control}</div>`;
}
function collect(container) {                         // reads every field on screen: { dj:{...}, client:{...} }
  const out = { dj: {}, client: {} };
  container.querySelectorAll('[data-owner]').forEach(el => { out[el.dataset.owner][el.dataset.id] = el.value; });
  return out;
}
function completion(d) { const c = d.client || {}; return Math.round(CLIENT_FIELDS.filter(f => String(c[f.id] || '').trim() !== '').length / CLIENT_FIELDS.length * 100); }
function renderMeter(pct, id) {
  const segs = 16, lit = Math.round(pct / 100 * segs);
  return `<div class="meter-row"${id ? ` id="${id}"` : ''}><div class="meter">${Array.from({ length: segs }, (_, i) => `<i class="${i < lit ? 'on' : ''}"></i>`).join('')}</div><span class="pct mono">${pct}%</span></div>`;
}

/* ---- dates (day keys are plain "YYYY-MM-DD" text, never time-zone dependent) ---- */
const parseKey = k => k.split('-').map(Number);
function longDate(k) { const [y, m, d] = parseKey(k); return new Date(y, m - 1, d).toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }
function shortDate(k) { const [y, m, d] = parseKey(k); return new Date(y, m - 1, d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' }); }
function todayKey() { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; }
function dateKeyRange(from, to) {
  const out = [], [fy, fm, fd] = parseKey(from), [ty, tm, td] = parseKey(to), end = Date.UTC(ty, tm - 1, td);
  for (let t = Date.UTC(fy, fm - 1, fd); t <= end && out.length < 400; t += 86400000) { const d = new Date(t); out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`); }
  return out;
}
function dateTile(k) {
  if (!ISO_DAY.test(k || '')) return `<div class="date-tile none"><div class="day">?</div><div class="month">geen datum</div></div>`;
  const [y, m, d] = parseKey(k);
  return `<div class="date-tile"><div class="day">${String(d).padStart(2, '0')}</div><div class="month">${MONTHS_NL[m - 1].slice(0, 3)}</div></div>`;
}
function isPastForm(f) { const d = f.dj && f.dj.eventDate; return ISO_DAY.test(d || '') && d < todayKey(); }
function splitForms(forms) {                          // upcoming: soonest first, undated last. past: most recent first.
  const upcoming = [], past = [];
  forms.forEach(f => (isPastForm(f) ? past : upcoming).push(f));
  const t = f => ISO_DAY.test((f.dj || {}).eventDate || '') ? new Date(f.dj.eventDate).getTime() : Infinity;
  upcoming.sort((a, b) => (t(a) - t(b)) || (new Date(b.updatedAt) - new Date(a.updatedAt)));
  past.sort((a, b) => b.dj.eventDate.localeCompare(a.dj.eventDate) || (new Date(b.updatedAt) - new Date(a.updatedAt)));
  return { upcoming, past };
}
function clientLink(token) { return location.origin + location.pathname + '#/k/' + token; }
