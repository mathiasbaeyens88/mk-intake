/* All communication with the database. Every call goes through a checked database function. */
const api = (function () {
  const cfg = window.MK_CONFIG || {};
  // Forgiving about the usual copy mistakes: spaces, a trailing slash, or the "/rest/v1/" part that Supabase shows in the Data API screen.
  const url = String(cfg.SUPABASE_URL || '').trim().replace(/\/(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '');
  const key = String(cfg.SUPABASE_ANON_KEY || '').trim();
  let sb = null;
  const client = () => (sb = sb || window.supabase.createClient(url, key,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }));
  async function rpc(name, args) {
    const { data, error } = await client().rpc(name, args || {});
    if (error) { const e = new Error(error.message || 'error'); e.code = error.message; throw e; }   // codes: no_access, not_found, conflict, locked, invalid
    return data;
  }
  return {
    configured: () => !!(url && key && !/JOUW-/i.test(url + key)),
    async login(email, password) {
      let res; try { res = await client().auth.signInWithPassword({ email, password }); } catch (e) { throw new Error('network'); }
      const error = res.error;
      if (error) {
        const bad = [400, 401, 422].includes(error.status), net = (error.status && !bad) || (!error.status && /fetch|network|load failed/i.test(error.message || ''));
        throw new Error(net ? 'network' : 'login');          // 'network' = wrong address/key or no connection, 'login' = wrong e-mail or password
      }
      return res.data;
    },
    async logout() { await client().auth.signOut(); },
    async session() { const { data } = await client().auth.getSession(); return data && data.session; },
    onAuth: (cb) => client().auth.onAuthStateChange(cb),
    ping: () => rpc('admin_ping'),
    list: () => rpc('admin_list'),
    get: (id) => rpc('admin_get', { p_id: id }),
    create: (name) => rpc('admin_create', { p_name: name }),
    save: (id, name, dj, cl, status, expectedVersion) => rpc('admin_save', { p_id: id, p_name: name, p_dj: dj, p_client: cl, p_status: status, p_expected_version: expectedVersion == null ? null : expectedVersion }),
    markSeen: (id) => rpc('admin_mark_seen', { p_id: id }),
    remove: (id) => rpc('admin_delete', { p_id: id }),
    blockedList: () => rpc('admin_blocked_list'),
    blockedAdd: (days) => rpc('admin_blocked_add', { p_days: days }),
    blockedRemove: (days) => rpc('admin_blocked_remove', { p_days: days }),
    clientGet: (token) => rpc('client_get', { p_token: token }),
    clientSave: (token, cl, confirm) => rpc('client_save', { p_token: token, p_client: cl, p_confirm: !!confirm })
  };
})();
