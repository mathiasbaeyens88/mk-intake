/* Month calendar next to the list, and the "blocked days" (private, not bookable). */
const S = { dossiers: [], blocked: {}, listTab: 'upcoming', calView: null, gen: 0 };

function calDateMap(forms) {
  const map = {};
  forms.forEach(f => { const d = f.dj && f.dj.eventDate; if (ISO_DAY.test(d || '')) (map[d] = map[d] || []).push(f); });
  return map;
}
function calendarHTML(forms) {
  const now = new Date();
  if (!S.calView) S.calView = { y: now.getFullYear(), m: now.getMonth() };
  const { y, m } = S.calView, map = calDateMap(forms), pad = n => String(n).padStart(2, '0');
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const offset = (new Date(y, m, 1).getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
  let cells = DAYS_NL.map(d => `<div class="cal-dow">${d}</div>`).join('') + '<div class="cal-cell empty"></div>'.repeat(offset);
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${pad(m + 1)}-${pad(d)}`, list = map[key] || [], blk = S.blocked[key], isToday = key === today ? ' today' : '';
    const cls = list.length ? (list.some(f => f.status === 'submitted') ? 'confirmed' : 'draft') : (blk ? 'blocked' : 'none');
    const names = list.map(f => f.clientName).join(', ');
    const label = list.length ? names : (blk ? 'Geblokkeerd' + (blk.reason ? ' (' + blk.reason + ')' : '') : 'Vrij, tik om te blokkeren');
    cells += `<div role="button" tabindex="0" class="cal-cell ${cls}${isToday}" data-date="${key}" title="${escapeHtml(label)}" aria-label="${d} ${MONTHS_NL[m]}: ${escapeHtml(label)}">${d}${list.length > 1 ? `<i class="cal-count">${list.length}</i>` : ''}</div>`;
  }
  const current = y === now.getFullYear() && m === now.getMonth();
  return `<div class="cal-head"><button type="button" class="cal-nav" data-nav="-1" aria-label="Vorige maand">‹</button><div class="cal-title">${MONTHS_NL[m]} ${y}</div><button type="button" class="cal-nav" data-nav="1" aria-label="Volgende maand">›</button></div>
    ${current ? '' : '<button type="button" class="cal-today-btn" data-nav="today">Terug naar vandaag</button>'}
    <div class="cal-grid" id="calGrid">${cells}</div>
    <div class="cal-legend"><span><i style="background:var(--cal-yellow)"></i>Bevestigd</span><span><i style="background:var(--cal-purple)"></i>Dossier, nog niet bevestigd</span><span><i style="background:var(--cal-gray)"></i>Geen dossier</span><span><i class="blocked-swatch"></i>Geblokkeerd (privé)</span></div>
    <p class="cal-hint">Tik op een vrije dag om hem te blokkeren.</p>`;
}
function drawCalendar(forms, dir) {
  const box = document.getElementById('calBox'); if (!box) return;
  box.innerHTML = calendarHTML(forms);
  const grid = box.querySelector('#calGrid'); if (dir && grid) grid.classList.add(dir > 0 ? 'in-next' : 'in-prev');
  box.querySelectorAll('[data-nav]').forEach(b => b.onclick = () => navCalendar(b.dataset.nav, forms));
  box.querySelectorAll('.cal-cell[data-date]').forEach(b => {
    const act = () => onCalendarDay(b.dataset.date, forms);
    b.onclick = act; b.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); act(); } };
  });
}
function navCalendar(nav, forms) {
  const now = new Date(); let dir;
  if (nav === 'today') { const t = { y: now.getFullYear(), m: now.getMonth() }; dir = (t.y * 12 + t.m) > (S.calView.y * 12 + S.calView.m) ? 1 : -1; S.calView = t; }
  else { dir = Number(nav); let m = S.calView.m + dir, y = S.calView.y; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } S.calView = { y, m }; }
  drawCalendar(forms, dir);
}
function bindCalendarSwipe(box, forms) {
  let sx = 0, sy = 0, on = false;
  box.addEventListener('touchstart', e => { const t = e.changedTouches && e.changedTouches[0]; if (!t) return; sx = t.clientX; sy = t.clientY; on = true; }, { passive: true });
  box.addEventListener('touchend', e => {
    if (!on) return; on = false; const t = e.changedTouches && e.changedTouches[0]; if (!t) return;
    const dx = t.clientX - sx, dy = t.clientY - sy;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.5) navCalendar(dx < 0 ? '1' : '-1', forms);     // clearly horizontal only: scrolling is never hijacked
  }, { passive: true });
}
function onCalendarDay(key, forms) {
  const list = calDateMap(forms)[key] || [];
  if (list.length) return jumpToDossier(list, forms);
  if (S.blocked[key]) return openBlockedDayModal(key, forms);
  return openBlockModal(key, forms);
}
function jumpToDossier(list, forms) {
  const wanted = isPastForm(list[0]) ? 'past' : 'upcoming';                // a past party lives under "Afgelopen"
  if (S.listTab !== wanted) { S.listTab = wanted; redrawList(forms); }
  list.forEach((f, i) => {
    const el = document.getElementById('strip-' + f.id); if (!el) return;
    if (i === 0 && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1600);
  });
}

function openBlockModal(dateKey, forms) {
  const ov = openModal(`<div class="modal-head"><h3>Dag(en) blokkeren</h3><button class="modal-close" id="blkX">&times;</button></div>
    <div class="modal-body"><p style="margin-top:0;">Geblokkeerde dagen zie je in de kalender als niet beschikbaar. Zet je er toch een dossier op, dan krijg je eerst een waarschuwing.</p>
      <div class="grid" style="gap:10px;"><div class="field"><label class="field-label">Van</label><input type="date" id="blkFrom" autocomplete="off" value="${dateKey}"></div>
      <div class="field"><label class="field-label">Tot en met</label><input type="date" id="blkTo" autocomplete="off" value="${dateKey}"></div>
      <div class="field full"><label class="field-label">Reden (optioneel, enkel zichtbaar voor jou)</label><input type="text" id="blkReason" maxlength="60" autocomplete="off" placeholder="Bv. privé, vakantie"></div></div>
      <p id="blkMsg" style="font-size:12.5px;margin:12px 0 0;min-height:1em;"></p></div>
    <div class="modal-foot" style="gap:8px;"><button class="btn btn-ghost" id="blkCancel">Annuleren</button><button class="btn btn-primary" id="blkGo">Blokkeren</button></div>`);
  const $ = s => ov.querySelector(s), fail = t => { $('#blkMsg').textContent = t; $('#blkMsg').style.color = 'var(--cue)'; };
  $('#blkX').onclick = $('#blkCancel').onclick = () => ov.remove();
  $('#blkGo').onclick = async () => {
    const from = $('#blkFrom').value, to = $('#blkTo').value || from, reason = $('#blkReason').value.trim();
    if (!ISO_DAY.test(from) || !ISO_DAY.test(to)) return fail('Vul een geldige datum in.');
    if (to < from) return fail('"Tot en met" mag niet vóór "Van" liggen.');
    const days = dateKeyRange(from, to); if (days.length > 366) return fail('Je kan maximaal 366 dagen in één keer blokkeren.');
    const booked = calDateMap(forms), group = 'g' + Date.now().toString(36), add = {}; let skipped = 0;
    days.forEach(d => { if (booked[d]) skipped++; else if (!S.blocked[d]) add[d] = { reason, group }; });
    const n = Object.keys(add).length;
    if (!n) return fail(skipped ? 'Op deze dag(en) staat al een dossier, of ze zijn al geblokkeerd.' : 'Deze dag(en) zijn al geblokkeerd.');
    const btn = $('#blkGo'); btn.disabled = true; btn.textContent = 'Opslaan…';
    try { await api.blockedAdd(add); } catch (e) { btn.disabled = false; btn.textContent = 'Blokkeren'; return fail('Opslaan is mislukt, probeer opnieuw.'); }
    Object.assign(S.blocked, add); ov.remove(); drawCalendar(forms);
    toast(`${n} dag${n === 1 ? '' : 'en'} geblokkeerd` + (skipped ? ` — ${skipped} overgeslagen (er staat al een dossier)` : ''));
  };
}
function openBlockedDayModal(key, forms) {
  const entry = S.blocked[key]; if (!entry) return;
  const group = entry.group ? Object.keys(S.blocked).filter(k => S.blocked[k].group === entry.group).sort() : [key];
  const ov = openModal(`<div class="modal-head"><h3>Geblokkeerde dag</h3><button class="modal-close" id="bdX">&times;</button></div>
    <div class="modal-body"><p style="margin-top:0;color:var(--text);"><strong>${escapeHtml(longDate(key))}</strong><br>${entry.reason ? escapeHtml(entry.reason) : '(geen reden opgegeven)'}</p>
      ${group.length > 1 ? `<p style="font-size:12.5px;">Deel van een blokkade van ${group.length} dagen (${escapeHtml(shortDate(group[0]))} – ${escapeHtml(shortDate(group[group.length - 1]))}).</p>` : ''}
      <div style="display:flex;flex-direction:column;gap:8px;margin-top:14px;"><button class="btn btn-primary" id="bdOne" style="justify-content:center;">Deze dag vrijgeven</button>
      ${group.length > 1 ? `<button class="btn btn-ghost" id="bdAll" style="justify-content:center;">Hele blokkade vrijgeven (${group.length} dagen)</button>` : ''}
      <button class="btn btn-ghost" id="bdClose" style="justify-content:center;">Sluiten</button></div></div>`);
  ov.querySelector('#bdX').onclick = ov.querySelector('#bdClose').onclick = () => ov.remove();
  const release = async (keys, msg) => {
    try { await api.blockedRemove(keys); } catch (e) { return toast('Vrijgeven is mislukt, probeer opnieuw.'); }
    keys.forEach(k => delete S.blocked[k]); ov.remove(); drawCalendar(forms); toast(msg);
  };
  ov.querySelector('#bdOne').onclick = () => release([key], 'Dag vrijgegeven');
  const all = ov.querySelector('#bdAll'); if (all) all.onclick = () => release(group, `${group.length} dagen vrijgegeven`);
}
