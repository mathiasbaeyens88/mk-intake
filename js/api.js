/* All communication with the database. Every call goes through a checked database function. */
const api = (function () {
  const cfg = window.MK_CONFIG || {};
  let sb = null;
  const client = () => (sb = sb || window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY,
    { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }));
  async function rpc(name, args) {
    const { data, error } = await client().rpc(name, args || {});
    if (error) { const e = new Error(error.message || 'error'); e.code = error.message; throw e; }   // codes: no_access, not_found, conflict, locked, invalid
    return data;
  }
  return {
    configured: () => !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && !/JOUW-/i.test(cfg.SUPABASE_URL + cfg.SUPABASE_ANON_KEY)),
    async login(email, password) { const { data, error } = await client().auth.signInWithPassword({ email, password }); if (error) throw new Error('login'); return data; },
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
