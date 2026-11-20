/* Pure accounting functions. All monetary values use integer minor units. */
(function (root) {
  'use strict';
  const MAX = 100000000000;
  const fail = m => { throw new Error(m); };
  function cents(text) {
    const s = String(text).trim().replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace('٫', '.');
    if (!/^\d{1,10}(\.\d{1,2})?$/.test(s)) fail('اكتب مبلغ صحيح بحد أقصى رقمين بعد العلامة.');
    const [a, b = ''] = s.split('.');
    const n = Number(a) * 100 + Number(b.padEnd(2, '0'));
    if (!Number.isSafeInteger(n) || n <= 0 || n > MAX) fail('المبلغ لازم يكون أكبر من صفر وفي حدود مليار.');
    return n;
  }
  function split(amount, ids) {
    if (!Number.isSafeInteger(amount) || amount <= 0 || !ids.length || new Set(ids).size !== ids.length) fail('تقسيم غير صالح.');
    const base = Math.floor(amount / ids.length), remainder = amount % ids.length;
    return ids.map((id, i) => ({ id, amount: base + (i < remainder ? 1 : 0) }));
  }
  function balances(state) {
    const net = Object.fromEntries(state.members.map(m => [m.id, 0]));
    for (const e of state.expenses) {
      net[e.payer] += e.amount;
      for (const share of split(e.amount, e.participants)) net[share.id] -= share.amount;
    }
    for (const t of state.transfers) { net[t.from] += t.amount; net[t.to] -= t.amount; }
    return net;
  }
  function settlements(state) {
    const net = balances(state);
    const debt = Object.entries(net).filter(([, n]) => n < 0).map(([id, n]) => ({ id, n: -n })).sort((a,b) => b.n-a.n);
    const credit = Object.entries(net).filter(([, n]) => n > 0).map(([id, n]) => ({ id, n })).sort((a,b) => b.n-a.n);
    const result = []; let i = 0, j = 0;
    while (i < debt.length && j < credit.length) {
      const amount = Math.min(debt[i].n, credit[j].n);
      result.push({ from: debt[i].id, to: credit[j].id, amount });
      debt[i].n -= amount; credit[j].n -= amount;
      if (!debt[i].n) i++; if (!credit[j].n) j++;
    }
    return result;
  }
  function validate(s) {
    if (!s || s.version !== 1 || !['EGP','USD','EUR','SAR','AED'].includes(s.currency)) fail('صيغة النسخة الاحتياطية غير مدعومة.');
    for (const key of ['members','expenses','transfers']) if (!Array.isArray(s[key])) fail('ملف غير صالح.');
    if (s.members.length > 50 || s.expenses.length + s.transfers.length > 5000) fail('حجم البيانات أكبر من الحد المسموح.');
    const text = (v, max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
    const ids = new Set(); const names = new Set();
    for (const m of s.members) {
      if (!m || !text(m.id,80) || !/^[a-zA-Z0-9_-]+$/.test(m.id) || ids.has(m.id) || !text(m.name,40) || names.has(m.name.trim())) fail('بيانات السكان غير صالحة أو مكررة.');
      ids.add(m.id); names.add(m.name.trim());
    }
    const recordIds = new Set();
    const base = r => {
      if (!r || !text(r.id,80) || !/^[a-zA-Z0-9_-]+$/.test(r.id) || recordIds.has(r.id) || !Number.isSafeInteger(r.amount) || r.amount <= 0 || r.amount > MAX || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10) !== r.date) fail('سجل مالي غير صالح.');
      recordIds.add(r.id);
    };
    for (const e of s.expenses) {
      base(e);
      if (!text(e.title,100) || !['rent','bills','food','other'].includes(e.category) || !ids.has(e.payer) || !Array.isArray(e.participants) || !e.participants.length || new Set(e.participants).size !== e.participants.length || e.participants.some(id => !ids.has(id))) fail('بيانات مصروف غير صالحة.');
    }
    for (const t of s.transfers) { base(t); if (!ids.has(t.from) || !ids.has(t.to) || t.from === t.to) fail('تحويل غير صالح.'); }
    // Copy only documented fields, never retain foreign properties from imports.
    return { version:1, currency:s.currency, members:s.members.map(({id,name})=>({id,name:name.trim()})), expenses:s.expenses.map(({id,title,amount,payer,participants,category,date})=>({id,title:title.trim(),amount,payer,participants:[...participants],category,date})), transfers:s.transfers.map(({id,from,to,amount,date})=>({id,from,to,amount,date})) };
  }
  const api = { cents, split, balances, settlements, validate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SplitCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
