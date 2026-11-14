/* رجعة — وضع بلا إنترنت: توقيع الكود محلياً + طابور ختم الكاشير + المزامنة */
const RJ = (() => {
  const SLOT = 30000;
  const b64u = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const available = () => !!(window.crypto && crypto.subtle);
  async function sig(seed, token, slot) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', enc.encode(seed), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    return b64u(await crypto.subtle.sign('HMAC', key, enc.encode(`card.${token}.${slot}`))).slice(0, 12);
  }
  async function makeCode(token, seed, now = Date.now()) {
    const slot = Math.floor(now / SLOT);
    return `RJ2:${token}.${slot}.${await sig(seed, token, slot)}`;
  }
  /** يتحقق من كود RJ2 أمام قائمة العملاء المحلية. يعيد {ok, customer} أو {ok:false, reason} */
  async function verify(code, roster, now = Date.now()) {
    const m = /^RJ2:([A-Za-z0-9_-]{8,40})\.(\d{1,12})\.([A-Za-z0-9_-]{12})$/.exec(String(code || '').trim());
    if (!m) return { ok: false, reason: 'bad_format' };
    const c = roster.customers.find((x) => x.token === m[1]);
    if (!c || !c.seed) return { ok: false, reason: 'unknown' };
    if ((await sig(c.seed, m[1], Number(m[2]))) !== m[3]) return { ok: false, reason: 'bad_sig' };
    if (Math.abs(Math.floor(now / SLOT) - Number(m[2])) > 2) return { ok: false, reason: 'expired' };
    return { ok: true, customer: c };
  }
  return { makeCode, verify, available };
})();

/** طابور الكاشير: قائمة العملاء محلياً + عمليات بانتظار المزامنة */
function CashierOffline(slug) {
  const RK = 'rj_roster_' + slug, QK = 'rj_q_' + slug;
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) || d; } catch { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  let roster = read(RK, null), queue = read(QK, []);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
  const normPhone = (raw) => {
    let d = String(raw || '').replace(/[٠-٩]/g, (c) => c.charCodeAt(0) - 1632).replace(/[۰-۹]/g, (c) => c.charCodeAt(0) - 1776).replace(/\D/g, '');
    if (d.startsWith('00')) d = d.slice(2);
    if (/^01\d{9}$/.test(d)) return '2' + d;
    if (/^201\d{9}$/.test(d)) return d;
    return d.length >= 8 && d.length <= 15 ? d : null;
  };
  const payload = (c) => ({ id: c.id, name: c.name, stamps: c.stamps, target: roster.shop.reward_target, redeemable: c.stamps >= roster.shop.reward_target });
  const save = () => { write(RK, roster); write(QK, queue); };

  return {
    ready: () => !!roster,
    pending: () => queue.length,
    async fetchRoster(api, session) {
      const pendingIds = new Set(queue.map((q) => q.customer_id));
      const fresh = await api('GET', '/api/roster', null, session);
      // لا نكتب فوق أرصدة عملاء لهم عمليات معلّقة حتى تُزامَن
      if (roster) fresh.customers.forEach((c) => { if (pendingIds.has(c.id)) { const old = roster.customers.find((o) => o.id === c.id); if (old) { c.stamps = old.stamps; c.last = old.last; } } });
      roster = fresh; save();
    },
    find(payload_) {
      if (!roster) return null;
      if (payload_.phone) { const p = normPhone(payload_.phone); return p ? roster.customers.find((c) => c.phone === p) || null : null; }
      return null;
    },
    verify: (code) => RJ.verify(code, roster),
    stamp(c) {
      const now = Date.now(), gap = roster.shop.min_gap_minutes * 60000;
      if (c.last && now - c.last < gap) return { added: false, wait_minutes: Math.ceil((gap - (now - c.last)) / 60000), customer: payload(c), offline: true };
      c.last = now; c.stamps += 1;
      queue.push({ key: uid(), type: 'stamp', customer_id: c.id, at: now }); save();
      return { added: true, wait_minutes: 0, customer: payload(c), offline: true };
    },
    redeem(c) {
      if (c.stamps < roster.shop.reward_target) return null;
      c.stamps -= roster.shop.reward_target;
      queue.push({ key: uid(), type: 'redeem', customer_id: c.id, at: Date.now() }); save();
      return payload(c);
    },
    redeemById(id) { const c = roster && roster.customers.find((x) => x.id === id); return c ? this.redeem(c) : null; },
    /** بعد ختم ناجح على الخادم نحدّث النسخة المحلية */
    touch(id, stamps, added) {
      const c = roster && roster.customers.find((x) => x.id === id);
      if (c) { c.stamps = stamps; if (added) c.last = Date.now(); save(); }
    },
    async sync(api, session) {
      if (!queue.length) return { sent: 0 };
      const batch = queue.slice(0, 200);
      const r = await api('POST', '/api/sync', { items: batch }, session);
      const done = new Set(r.results.map((x) => x.key));
      queue = queue.filter((q) => !done.has(q.key)); save();
      return { sent: r.results.length, skipped: r.results.filter((x) => x.status !== 'ok' && x.status !== 'done').length };
    },
  };
}
