/* Start-up and routing. Addresses: #/ (overview)  #/d/<id> (dossier)  #/k/<secret code> (client form) */
function route() { S.gen++; window.onbeforeunload = null; S.dirty = false; return routeInner(S.gen); }
async function routeInner(gen) {
  if (!api.configured()) return renderSetupNeeded();
  const h = location.hash.replace(/^#/, ''); let m;
  if ((m = h.match(/^\/k\/([0-9a-fA-F]{20,64})$/))) return renderClient(m[1].toLowerCase(), gen);
  let session = null; try { session = await api.session(); } catch (e) {}
  if (gen !== S.gen) return;
  if (!session) { S.admin = null; return renderLogin(); }
  if (S.admin == null) {
    try { await api.ping(); S.admin = true; }
    catch (e) { if (e.code === 'no_access') S.admin = false; else { if (gen !== S.gen) return; return messageScreen('Verbinden mislukt', 'Controleer je verbinding en <a href="#/" onclick="route();return false;">probeer opnieuw</a>.'); } }
  }
  if (gen !== S.gen) return;
  if (!S.admin) return renderNoAccess();
  if ((m = h.match(/^\/d\/([0-9a-fA-F-]{36})$/))) return renderEdit(m[1], gen);
  return renderDashboard(gen);
}
window.addEventListener('hashchange', route);
route();
