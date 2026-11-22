/* Screens: login, overview (list + calendar), dossier, client form. */
function shell(subtitle, admin) {
  const bar = admin ? `<span class="sub mono" style="display:flex;gap:10px;align-items:center;"><span style="opacity:.5">${APP_VERSION}</span>
    <button class="btn btn-ghost btn-mini" id="refreshBtn" title="Vernieuwen">↻</button><button class="btn btn-ghost btn-mini" id="logoutBtn">Uitloggen</button></span>` : '';
  return `<div class="hero"><div class="hero-waves">${'<i></i>'.repeat(40)}</div></div><div class="statusbar"><span class="sub">${escapeHtml(subtitle)}</span>${bar}</div>`;
}
function bindShell() {
  const lo = document.getElementById('logoutBtn'); if (lo) lo.onclick = async () => { await api.logout(); S.admin = null; location.hash = '#/'; route(); };
  const rf = document.getElementById('refreshBtn'); if (rf) rf.onclick = () => route();
}
const messageScreen = (title, text) => { $app.innerHTML = shell('MK Soundsystem') + `<main><div class="login-box"><h2>${escapeHtml(title)}</h2><p class="hint" style="margin-top:0;">${text}</p></div></main>`; };

function renderSetupNeeded() { messageScreen('Bijna klaar', 'De website is nog niet gekoppeld aan Supabase. Open het bestand <b>js/config.js</b> en vul je Supabase-adres en sleutel in. Het stappenplan legt uit hoe.'); }
function renderNoAccess() {
  messageScreen('Geen toegang', 'Dit account heeft geen toegang tot het beheer. Log uit en probeer met een ander account.<br><br><button class="btn btn-ghost" id="logoutBtn">Uitloggen</button>');
  document.getElementById('logoutBtn').onclick = async () => { await api.logout(); S.admin = null; route(); };
}
function renderLogin(msg) {
  $app.innerHTML = shell('Beheerder') + `<main><div class="login-box"><h2>Inloggen</h2>
    <form id="loginForm"><div class="field"><label class="field-label">E-mailadres</label><input type="email" id="loginEmail" autocomplete="username" required></div>
    <div class="field"><label class="field-label">Wachtwoord</label><input type="password" id="loginPw" autocomplete="current-password" required></div>
    <button class="btn btn-primary" id="loginBtn" style="width:100%;justify-content:center;">Inloggen</button>
    <p id="loginMsg" style="font-size:13px;margin:12px 0 0;color:var(--cue);min-height:1em;">${escapeHtml(msg || '')}</p></form>
    <p class="hint">Ben je klant? Gebruik de persoonlijke link die je van je dj kreeg.</p></div></main>`;
  document.getElementById('loginForm').onsubmit = async e => {
    e.preventDefault(); const btn = document.getElementById('loginBtn'), m = document.getElementById('loginMsg');
    btn.disabled = true; btn.textContent = 'Bezig…'; m.textContent = '';
    try { await api.login(document.getElementById('loginEmail').value.trim(), document.getElementById('loginPw').value); S.admin = null; route(); }
    catch (err) { btn.disabled = false; btn.textContent = 'Inloggen'; m.textContent = 'Onjuist e-mailadres of wachtwoord.'; }
  };
}

/* ---------- overview ---------- */
function stripHTML(f) {
  const isNew = f.status === 'submitted' && !f.adminSeen, sub = f.status === 'submitted';
  const meta = [f.dj.eventType, f.dj.eventDate, f.dj.venue].filter(Boolean).join(' · ') || 'Nog geen evenementdetails ingevuld';
  return `<div class="strip" id="strip-${f.id}"><div class="strip-row">${dateTile(f.dj.eventDate)}<div class="strip-top"><div>
      <div class="strip-name">${escapeHtml(f.clientName)}</div><div class="strip-meta">${escapeHtml(meta)}</div></div>
      <div style="display:flex;align-items:center;gap:10px;">${isNew ? '<span class="badge-new">NIEUW</span>' : ''}<span class="status-tag"><span class="led ${sub ? 'live' : 'draft'}"></span>${sub ? 'Bevestigd' : 'Concept'}</span></div></div></div>
    ${renderMeter(completion(f))}
    <div class="strip-actions"><button class="btn btn-ghost" data-edit="${f.id}">Bewerken</button><button class="btn btn-ghost" data-copylink="${f.id}">Kopieer link</button>
      <button class="btn btn-ghost" data-pdf="${f.id}">📄 PDF</button><button class="btn btn-danger" data-del="${f.id}" style="margin-left:auto;">Verwijderen</button></div></div>`;
}
function listHTML(forms) {
  if (!forms.length) return `<div class="empty">Nog geen formulieren. Maak er hierboven één aan en vul alvast in wat je al weet.</div>`;
  const { upcoming, past } = splitForms(forms), pastNew = past.some(f => f.status === 'submitted' && !f.adminSeen);
  const tab = (id, label, n, extra) => `<button type="button" class="list-tab ${S.listTab === id ? 'active' : ''}" data-tab="${id}" role="tab" aria-selected="${S.listTab === id}">${label} <span class="tab-count">${n}</span>${extra || ''}</button>`;
  const shown = S.listTab === 'past' ? past : upcoming;
  const empty = S.listTab === 'past' ? 'Nog geen afgelopen feesten.' : 'Geen komende feesten. Voorbije feesten vind je onder “Afgelopen” of via de kalender.';
  return `<div class="list-tabs" role="tablist">${tab('upcoming', 'Komend', upcoming.length)}${tab('past', 'Afgelopen', past.length, pastNew ? '<span class="badge-new tab-new">NIEUW</span>' : '')}</div>`
    + (shown.length ? shown.map(stripHTML).join('') : `<div class="empty">${empty}</div>`);
}
function redrawList(forms) {
  const root = document.querySelector('.dash-list'); if (!root) return;
  root.innerHTML = listHTML(forms);
  root.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { S.listTab = b.dataset.tab; redrawList(forms); });
  root.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => { location.hash = '#/d/' + b.dataset.edit; });
  root.querySelectorAll('[data-copylink]').forEach(b => b.onclick = () => { const f = forms.find(x => x.id === b.dataset.copylink); if (f) copyText(clientLink(f.token), 'Link gekopieerd'); });
  root.querySelectorAll('[data-pdf]').forEach(b => b.onclick = () => { const f = forms.find(x => x.id === b.dataset.pdf); if (f) exportDossierPdf(f); });
  root.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!(await confirmModal('Dit formulier definitief verwijderen? Dit kan niet ongedaan gemaakt worden.', 'Verwijderen'))) return;
    try { await api.remove(b.dataset.del); } catch (e) { return toast('Verwijderen is mislukt, probeer opnieuw.'); }
    S.dossiers = S.dossiers.filter(f => f.id !== b.dataset.del); redrawList(S.dossiers); drawCalendar(S.dossiers);
  });
}
async function exportDossierPdf(f) {                  // a normal download: works because this is a real website, not a sandbox
  let bytes; try { bytes = buildDossierPdf(f); } catch (e) { return toast('De PDF kon niet gemaakt worden.'); }
  const slug = ((f.clientName || 'klant').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')) || 'klant';
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = `MK-dossier-${slug}-${(f.dj && f.dj.eventDate) || 'zonder-datum'}.pdf`;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); toast('PDF klaar ✓');
}
async function renderDashboard(gen) {
  $app.innerHTML = shell('Beheerdersoverzicht', true) + `<main id="main"><div class="center-msg">Formulieren laden…</div></main>`; bindShell();
  let forms, blocked;
  try { [forms, blocked] = await Promise.all([api.list(), api.blockedList()]); }
  catch (e) { if (gen !== S.gen) return; return messageScreen('Laden mislukt', 'De gegevens konden niet geladen worden. Controleer je verbinding en <a href="#/" onclick="route();return false;">probeer opnieuw</a>.'); }
  if (gen !== S.gen) return;
  S.dossiers = forms; S.blocked = blocked || {};
  const main = document.getElementById('main'); main.classList.add('wide');
  main.innerHTML = `<div class="new-form-row"><input id="newClientName" autocomplete="off" placeholder="Naam van klant / koppel voor nieuw formulier"><button class="btn btn-primary" id="createBtn">+ Nieuw formulier</button></div>
    <div class="dash-layout"><div class="dash-list"></div><aside class="cal-side"><div class="cal-box" id="calBox"></div></aside></div>`;
  redrawList(S.dossiers); drawCalendar(S.dossiers); bindCalendarSwipe(document.getElementById('calBox'), S.dossiers);
  const create = async () => {
    const name = document.getElementById('newClientName').value.trim(); if (!name) return toast('Vul eerst een naam in');
    try { const d = await api.create(name); location.hash = '#/d/' + d.id; } catch (e) { toast('Aanmaken is mislukt, probeer opnieuw.'); }
  };
  document.getElementById('createBtn').onclick = create;
  document.getElementById('newClientName').onkeydown = e => { if (e.key === 'Enter') create(); };
}

/* ---------- one dossier (admin) ---------- */
async function renderEdit(id, gen) {
  $app.innerHTML = shell('Dossier bewerken', true) + `<main id="main"><div class="center-msg">Laden…</div></main>`; bindShell();
  let cur, blocked;
  try { [cur, blocked] = await Promise.all([api.get(id), api.blockedList()]); }
  catch (e) { if (gen !== S.gen) return; return messageScreen(e.code === 'not_found' ? 'Dossier niet gevonden' : 'Laden mislukt', '<a href="#/">← Terug naar het overzicht</a>'); }
  if (gen !== S.gen) return;
  S.blocked = blocked || {};
  if (cur.status === 'submitted' && !cur.adminSeen) { api.markSeen(cur.id).catch(() => {}); cur.adminSeen = true; }
  const main = document.getElementById('main'), sub = () => cur.status === 'submitted';
  main.innerHTML = `<a class="back-link" href="#/" id="backBtn">← Overzicht</a>
    <div class="strip-top" style="margin-bottom:6px;"><input id="clientNameInput" autocomplete="off" value="${escapeHtml(cur.clientName)}" style="font-size:18px;font-family:'Space Grotesk',sans-serif;font-weight:600;max-width:340px;">
      <span class="status-tag"><span class="led ${sub() ? 'live' : 'draft'}"></span>${sub() ? 'Bevestigd door klant' : 'Nog niet bevestigd'}</span></div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;flex-wrap:wrap;"><span class="chip chip-dj mono" style="font-size:12.5px;padding:6px 10px;">KLANTLINK</span>
      <button class="btn btn-ghost" id="copyLinkBtn">Kopieer link</button><button class="btn btn-ghost" id="viewClientBtn">👀 Bekijk als klant</button></div>
    ${renderMeter(completion(cur), 'liveMeter')}
    <div class="section-head"><span class="chip chip-dj">JIJ VULT IN</span><h3>Evenementgegevens</h3></div>
    <div class="grid">${DJ_FIELDS.map(f => fieldHTML(f, fieldValue(cur, 'dj', f.id), false, 'dj')).join('')}</div>
    <div class="grid" style="margin-top:14px;">${fieldHTML(INTERNAL_FIELD, fieldValue(cur, 'dj', 'internalNotes'), false, 'dj')}</div>
    <div class="section-head"><span class="chip chip-client">KLANT VULT IN</span><h3>Muziek & verloop</h3></div>
    <div class="locked-note">Je kan dit als beheerder ook zelf aanpassen.</div>
    <div class="grid">${CLIENT_FIELDS.map(f => fieldHTML(f, fieldValue(cur, 'client', f.id), false, 'client')).join('')}</div>
    <div style="margin-top:24px;text-align:right;"><button class="btn btn-primary" id="saveAllBtn" style="padding:12px 28px;font-size:14px;">💾 Opslaan</button></div>
    <div class="confirm-box"><div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div style="font-size:13.5px;color:var(--text-dim);">${sub() ? 'Bevestigd' + (cur.submittedAt ? ' op ' + new Date(cur.submittedAt).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : '') + '.' : 'Nog niet bevestigd door de klant.'}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">${sub() ? '<button class="btn btn-ghost" id="statusBtn">Heropen voor klant</button>' : '<button class="btn btn-confirm" id="statusBtn">Markeer als bevestigd</button>'}
        <button class="btn btn-ghost" id="mailBtn">✉️ Mail naar klant</button></div></div></div>
    <div style="margin-top:22px;"><button class="btn btn-ghost" id="backBtnBottom">← Terug naar overzicht</button></div>`;

  const $ = s => main.querySelector(s), nameInput = $('#clientNameInput'), dateInput = $('[data-owner="dj"][data-id="eventDate"]');
  let lastSavedDate = (cur.dj || {}).eventDate || '';
  const warn = document.createElement('div'); warn.style.cssText = 'font-size:12.5px;margin-top:6px;color:var(--cue);display:none;'; dateInput.parentElement.appendChild(warn);
  const refreshWarn = () => { const e = S.blocked[dateInput.value]; if (e) { warn.textContent = '⚠️ Deze dag is door jou geblokkeerd' + (e.reason ? ' (' + e.reason + ')' : '') + '.'; warn.style.display = 'block'; } else warn.style.display = 'none'; };
  refreshWarn();
  const touch = () => { S.dirty = true; const m = document.getElementById('liveMeter'); if (m) m.outerHTML = renderMeter(completion({ client: collect(main).client }), 'liveMeter'); refreshWarn(); };
  main.querySelectorAll('[data-owner]').forEach(el => { el.addEventListener('input', touch); el.addEventListener('change', touch); });
  nameInput.addEventListener('input', () => { S.dirty = true; });
  window.onbeforeunload = () => (S.dirty ? true : undefined);

  async function persist(newStatus) {
    const v = collect(main), name = nameInput.value.trim() || 'Naamloze klant', d = v.dj.eventDate || '', st = newStatus || cur.status;
    if (d && d !== lastSavedDate && S.blocked[d]) {
      const why = S.blocked[d].reason ? ' (' + S.blocked[d].reason + ')' : '';
      if (!(await confirmModal(`${longDate(d)} is door jou geblokkeerd${why}. Toch opslaan op deze datum?`, 'Toch opslaan'))) return false;
    }
    try { cur = await api.save(cur.id, name, v.dj, v.client, st, cur.version); }
    catch (e) {
      if (e.code === 'conflict') {
        const k = await choiceModal('Dit dossier is ondertussen gewijzigd, bijvoorbeeld doordat je klant iets invulde. Wat wil je doen?',
          [{ key: 'cancel', label: 'Annuleren' }, { key: 'force', label: 'Toch overschrijven', cls: 'btn-danger' }, { key: 'reload', label: 'Opnieuw laden', cls: 'btn-primary' }]);
        if (k === 'reload') { S.dirty = false; route(); return false; }
        if (k !== 'force') return false;
        try { cur = await api.save(cur.id, name, v.dj, v.client, st, null); } catch (e2) { toast('Opslaan is mislukt, probeer opnieuw.'); return false; }
      } else { toast(e.code === 'no_access' ? 'Je sessie is verlopen: log opnieuw in.' : 'Opslaan is mislukt, probeer opnieuw.'); return false; }
    }
    S.dirty = false; lastSavedDate = (cur.dj || {}).eventDate || ''; return true;
  }
  const leave = async e => { if (e) e.preventDefault(); if (S.dirty && !(await persist())) return; location.hash = '#/'; };
  $('#backBtn').onclick = leave; $('#backBtnBottom').onclick = leave;
  $('#saveAllBtn').onclick = async () => { const b = $('#saveAllBtn'); b.disabled = true; b.textContent = 'Opslaan…'; if (await persist()) toast('Opgeslagen ✓'); b.disabled = false; b.textContent = '💾 Opslaan'; };
  $('#statusBtn').onclick = async () => { if (await persist(sub() ? 'draft' : 'submitted')) route(); };
  $('#copyLinkBtn').onclick = () => copyText(clientLink(cur.token), 'Link gekopieerd');
  $('#viewClientBtn').onclick = async () => { if (S.dirty && !(await persist())) return; location.hash = '#/k/' + cur.token; };
  $('#mailBtn').onclick = () => {
    const email = ($('[data-owner="dj"][data-id="clientEmail"]').value || '').trim(), name = nameInput.value.trim() || 'klant';
    if (!email) return toast('Vul eerst het e-mailadres van de klant in');
    const body = `Hoi ${name},\n\nHier is de link naar jouw invulformulier voor het feest:\n${clientLink(cur.token)}\n\nVul de resterende gegevens aan, lees de voorwaarden en bevestig onderaan. Je hebt hiervoor geen account nodig.\n\nTot binnenkort!\nMK Soundsystem`;
    location.href = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Jouw dj-invulformulier — ' + name)}&body=${encodeURIComponent(body)}`;
  };
}

/* ---------- the client form (no account: the secret link is the key) ---------- */
function openTermsModal(d, onRead) {
  const ov = openModal(`<div class="modal-head"><h3>Voorwaarden DJ-boeking</h3><button class="modal-close" id="tX">&times;</button></div><div class="modal-body">${termsHTML(d)}</div>
    <div class="modal-foot"><button class="btn btn-primary" id="tRead">Ik heb dit gelezen</button></div>`, 600);
  ov.querySelector('#tX').onclick = () => ov.remove();
  ov.querySelector('#tRead').onclick = () => { ov.remove(); onRead(); };
}
async function renderClient(token, gen) {
  $app.innerHTML = shell('Invulformulier') + `<main id="main"><div class="center-msg">Formulier laden…</div></main>`;
  let d;
  try { d = await api.clientGet(token); }
  catch (e) { if (gen !== S.gen) return; return messageScreen(e.code === 'not_found' ? 'Deze link werkt niet (meer)' : 'Laden mislukt', e.code === 'not_found' ? 'Vraag je dj om een nieuwe link.' : 'Controleer je verbinding en probeer het zo opnieuw.'); }
  if (gen !== S.gen) return;
  let preview = false; try { if (await api.session()) { await api.ping(); preview = true; } } catch (e) {}
  if (gen !== S.gen) return;
  const submitted = d.status === 'submitted', main = document.getElementById('main');
  main.innerHTML = `${preview ? `<div class="banner banner-cue" style="align-items:center;justify-content:space-between;flex-wrap:wrap;"><span>👀 Je bekijkt dit als klant (testmodus). Bevestigen markeert het dossier echt als bevestigd.</span><a class="btn btn-ghost" href="#/">← Terug naar beheer</a></div>` : ''}
    ${submitted ? `<div class="banner banner-live">Bedankt! Je gegevens zijn bevestigd${d.submittedAt ? ' op ' + new Date(d.submittedAt).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}. Wil je nog iets wijzigen, neem dan rechtstreeks contact op met je dj.</div>` : ''}
    <div style="margin-bottom:22px;"><div style="font-size:20px;font-family:'Space Grotesk',sans-serif;font-weight:600;">Hey ${escapeHtml(d.clientName)} 👋</div>
      <div style="font-size:13.5px;color:var(--text-dim);margin-top:4px;">Onderstaande gegevens zijn al ingevuld door je dj. Vul de rest zo volledig mogelijk aan.</div></div>
    ${renderMeter(completion(d), 'liveMeter')}<div class="save-state" id="saveState"></div>
    <div class="section-head"><span class="chip chip-dj">AL INGEVULD DOOR JE DJ</span><h3>Evenementgegevens</h3></div>
    <div class="grid">${DJ_FIELDS.map(f => fieldHTML(f, fieldValue(d, 'dj', f.id), true, 'dj')).join('')}</div>
    <div class="section-head"><span class="chip chip-client">JOUW BEURT</span><h3>Muziek & verloop</h3></div>
    <div class="grid">${CLIENT_FIELDS.map(f => fieldHTML(f, fieldValue(d, 'client', f.id), submitted, 'client')).join('')}</div>
    ${submitted ? '' : `<div class="confirm-box"><button class="btn btn-ghost" id="termsBtn" type="button">📄 Bekijk voorwaarden</button>
      <div style="margin-top:14px;"><label id="confirmLabel" class="disabled"><input type="checkbox" id="confirmCheck" disabled><span>Ik bevestig dat bovenstaande informatie klopt en volledig is, en dat ik de voorwaarden gelezen heb. Mijn dj krijgt hiervan een melding.</span></label>
      <div class="terms-hint" id="termsHint">Bekijk eerst de voorwaarden om te kunnen bevestigen.</div></div>
      <div style="margin-top:14px;"><button class="btn btn-confirm" id="submitBtn" disabled>Bevestig invulling</button></div></div>`}`;
  if (submitted) return;

  // quiet autosave: no save button needed. Only his own fields are ever sent.
  const state = document.getElementById('saveState'), say = t => { state.textContent = t; };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  let timer = null, inflight = false, dirty = false;
  async function flush() {
    if (inflight) return; inflight = true;
    try {
      while (dirty && gen === S.gen) {
        dirty = false;
        try { await api.clientSave(token, collect(main).client, false); say('Opgeslagen ✓'); }
        catch (e) {
          if (e.code === 'locked') { inflight = false; return route(); }
          if (e.code === 'invalid') { say('Een veld is te lang of ongeldig.'); break; }
          dirty = true; say('Opslaan lukt even niet, we proberen het zo opnieuw…'); await sleep(4000);
        }
      }
    } finally { inflight = false; }
  }
  const settle = async () => { clearTimeout(timer); await flush(); while (inflight) await sleep(40); };
  main.querySelectorAll('[data-owner="client"]').forEach(el => {
    const on = () => { dirty = true; say('Wijzigingen worden bewaard…'); const m = document.getElementById('liveMeter'); if (m) m.outerHTML = renderMeter(completion({ client: collect(main).client }), 'liveMeter'); clearTimeout(timer); timer = setTimeout(flush, 800); };
    el.addEventListener('input', on); el.addEventListener('change', on);
  });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { clearTimeout(timer); flush(); } });
  window.addEventListener('pagehide', () => { clearTimeout(timer); flush(); });

  const check = document.getElementById('confirmCheck'), btn = document.getElementById('submitBtn');
  document.getElementById('termsBtn').onclick = () => openTermsModal(d, () => { check.disabled = false; document.getElementById('confirmLabel').classList.remove('disabled'); document.getElementById('termsHint').textContent = 'Bedankt voor het lezen — je kan nu bevestigen.'; });
  check.onchange = () => { btn.disabled = !check.checked; };
  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = 'Bezig…'; await settle();
    try { await api.clientSave(token, collect(main).client, true); toast('Bevestigd, bedankt!'); route(); }
    catch (e) { if (e.code === 'locked') return route(); btn.disabled = false; btn.textContent = 'Bevestig invulling'; toast('Bevestigen is niet gelukt, probeer opnieuw.'); }
  };
}
