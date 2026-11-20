/* No network calls. Data stays in this browser until the user exports a file. */
'use strict';
const C = window.SplitCore;
const $ = s => document.querySelector(s);
const KEY = 'bel3adl-v1';
const categories = {rent:'إيجار',bills:'فواتير',food:'أكل ومشتريات',other:'غير كده'};
const blank = () => ({version:1,currency:'EGP',members:[],expenses:[],transfers:[]});
const uid = () => 'id_' + (globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const name = id => state.members.find(m=>m.id===id)?.name || 'ساكن محذوف';
const money = n => new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n/100);
const fmt = n => `<bdi class="money">${money(n)} ${state.currency}</bdi>`;
let state = blank(), editId = null, storageWarning = '';
try { const saved=localStorage.getItem(KEY); if(saved) state=C.validate(JSON.parse(saved)); }
catch { storageWarning='تعذر تحميل البيانات المحفوظة. لم نمسحها. استرجع نسخة سليمة أو نزّل نسخة من حسابك الحالي قبل أي تغيير.'; }
function notify(message,error=false){const n=$('#notice');n.textContent=message;n.classList.toggle('error',error);n.hidden=false;}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{notify('المتصفح مش قادر يحفظ. نزّل نسخة احتياطية دلوقتي، وإلا التغييرات ممكن تضيع.',true);return false;}}
function commit(message){ state=C.validate(state); const saved=save(); render(); if(saved)notify(message); }
function options(selected){return state.members.map(m=>`<option value="${esc(m.id)}" ${m.id===selected?'selected':''}>${esc(m.name)}</option>`).join('');}
function resetExpense(){editId=null;$('#cancel-edit').hidden=true;$('#expense-form').reset();$('#expense-form [name=date]').value=today();$('#add-expense').textContent='سجّل المصروف ＋';renderPeople();}
function renderPeople(){
  const payer=$('#expense-form [name=payer]'); const prev=payer.value;
  payer.innerHTML=options(prev);
  $('#participants').innerHTML=state.members.length?state.members.map(m=>`<label class="chip"><input type="checkbox" name="participant" value="${esc(m.id)}" checked>${esc(m.name)}</label>`).join(''):'<p class="muted">ضيف سكان الشقة الأول.</p>';
  $('#add-expense').disabled=!state.members.length;
  const from=$('#transfer-form [name=from]'),to=$('#transfer-form [name=to]');
  from.innerHTML=options(from.value);to.innerHTML=options(to.value||state.members[1]?.id);
  $('#transfer-form button').disabled=state.members.length<2;
}
function render(){
  const total=state.expenses.reduce((n,e)=>n+e.amount,0);
  $('.stats').classList.toggle('large',total>=100000000);
  $('#total').textContent=money(total);
  $('#member-count').textContent=state.members.length;
  const net=C.balances(state), suggestions=C.settlements(state);
  $('#remaining').textContent=money(Object.values(net).filter(n=>n>0).reduce((a,b)=>a+b,0));
  document.querySelectorAll('.currency-label').forEach(el=>el.textContent=state.currency);
  $('#currency').value=state.currency;$('#currency').disabled=!!(state.expenses.length||state.transfers.length);
  $('#members').innerHTML=state.members.map(m=>{const used=state.expenses.some(e=>e.payer===m.id||e.participants.includes(m.id))||state.transfers.some(t=>t.from===m.id||t.to===m.id);return `<div class="member-row"><span class="avatar">${esc(m.name[0])}</span><span class="name">${esc(m.name)}</span><button class="icon-button" data-delete-member="${esc(m.id)}" aria-label="حذف ${esc(m.name)}" ${used?'disabled title="لا يمكن حذف ساكن مرتبط بحركة مالية"':''}>×</button></div>`;}).join('')||'<p class="empty">ابدأ بأسامي سكان الشقة.<br>وبعدها سجّل أول مصروف.</p>';
  $('#demo').hidden=!!(state.members.length||state.expenses.length||state.transfers.length);
  $('#balances').innerHTML=state.members.map(m=>`<div class="balance-row"><span>${esc(m.name)}</span><span class="${net[m.id]>0?'positive':net[m.id]<0?'negative':'muted'}">${fmt(net[m.id])} <small>${net[m.id]>0?'له':net[m.id]<0?'عليه':'خالص'}</small></span></div>`).join('');
  $('#settlements').innerHTML=suggestions.map((t,i)=>`<div class="settlement"><div>${esc(name(t.from))} يدفع لـ ${esc(name(t.to))}</div><strong>${fmt(t.amount)}</strong><button class="button" data-settle="${i}">الدفعة حصلت، سجّلها</button></div>`).join('')||`<p class="empty">${state.expenses.length?'الحساب متسوّي ✓':'التسويات هتظهر بعد أول مصروف.'}</p>`;
  renderHistory();renderPeople();
}
function renderHistory(){
  const q=$('#search').value.trim().toLocaleLowerCase();
  const all=[...state.expenses.map(e=>({...e,type:'expense'})),...state.transfers.map(t=>({...t,type:'transfer'}))].sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
  $('#record-count').textContent=`${all.length} حركة`;
  const filtered=all.filter(r=>[r.title||'تسوية',name(r.payer||r.from),r.to?name(r.to):'',...(r.participants||[]).map(name)].join(' ').toLocaleLowerCase().includes(q));
  $('#history').innerHTML=filtered.map(r=>`<article class="record"><div><h3>${r.type==='expense'?esc(r.title):'تسوية مسجلة'}</h3><p>${esc(r.date)} · ${r.type==='expense'?`${esc(categories[r.category])} · دفعها ${esc(name(r.payer))}`:`${esc(name(r.from))} ← إلى ${esc(name(r.to))}`}</p></div><div class="amount">${fmt(r.amount)}</div>${r.type==='expense'?`<div class="details">${C.split(r.amount,r.participants).map(s=>`${esc(name(s.id))}: ${fmt(s.amount)}`).join(' · ')}</div>`:''}<div>${r.type==='expense'?`<button class="text-button" data-edit="${esc(r.id)}">تعديل</button>`:''}</div><button class="icon-button danger" data-delete="${esc(r.id)}" data-type="${r.type}">حذف</button></article>`).join('')||`<p class="empty">${q?'مفيش نتائج للبحث ده.':'لسه مفيش مصاريف.<br>الإيجار، النت، أو أول مشوار سوبر ماركت؟'}</p>`;
}
$('#member-form').addEventListener('submit',e=>{e.preventDefault();const field=e.target.elements.name;const n=field.value.trim();if(!n)return;if(state.members.length>=50)return notify('الحد الأقصى 50 ساكن.',true);if(state.members.some(m=>m.name===n))return notify('الاسم موجود بالفعل. استخدم اسم مميز لكل ساكن.',true);state.members.push({id:uid(),name:n});field.value='';commit('الساكن اتضاف.');});
$('#expense-form').addEventListener('submit',e=>{e.preventDefault();try{
  const f=e.target.elements, participants=[...document.querySelectorAll('[name=participant]:checked')].map(el=>el.value);
  if(!participants.length)throw Error('اختار ساكن واحد على الأقل للتقسيم.');
  const expense={id:editId||uid(),title:f.title.value.trim(),amount:C.cents(f.amount.value),payer:f.payer.value,participants,category:f.category.value,date:f.date.value};
  const next={...state,expenses:editId?state.expenses.map(x=>x.id===editId?expense:x):[...state.expenses,expense]};
  state=C.validate(next);resetExpense();commit('المصروف اتسجّل والحساب اتحدّث.');
}catch(err){notify(err.message,true);}});
$('#transfer-form').addEventListener('submit',e=>{e.preventDefault();try{const f=e.target.elements;if(f.from.value===f.to.value)throw Error('اختار شخصين مختلفين.');const t={id:uid(),from:f.from.value,to:f.to.value,amount:C.cents(f.amount.value),date:f.date.value};state=C.validate({...state,transfers:[...state.transfers,t]});f.amount.value='';commit('الدفعة اتسجّلت.');}catch(err){notify(err.message,true);}});
document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.deleteMember){state.members=state.members.filter(m=>m.id!==b.dataset.deleteMember);commit('الساكن اتحذف.');}
  if(b.dataset.delete){if(!confirm('تمسح الحركة دي؟ الحساب هيتحسب من جديد.'))return;const key=b.dataset.type==='expense'?'expenses':'transfers';state[key]=state[key].filter(x=>x.id!==b.dataset.delete);if(editId===b.dataset.delete)resetExpense();commit('الحركة اتحذفت.');}
  if(b.dataset.edit){const x=state.expenses.find(x=>x.id===b.dataset.edit);if(!x)return;editId=x.id;$('#cancel-edit').hidden=false;const f=$('#expense-form').elements;f.title.value=x.title;f.amount.value=(x.amount/100).toFixed(2);f.payer.value=x.payer;f.date.value=x.date;f.category.value=x.category;document.querySelectorAll('[name=participant]').forEach(el=>el.checked=x.participants.includes(el.value));$('#add-expense').textContent='حفظ التعديل';$('#expense-form').scrollIntoView({behavior:'smooth',block:'center'});f.title.focus();notify('بتعدّل المصروف. اضغط حفظ التعديل لما تخلص.');}
  if(b.dataset.settle!==undefined){const t=C.settlements(state)[Number(b.dataset.settle)];if(!t)return;if(!confirm(`تأكيد إن ${name(t.from)} دفع ${money(t.amount)} ${state.currency} لـ ${name(t.to)} بالفعل؟`))return;state.transfers.push({...t,id:uid(),date:today()});commit('التسوية اتسجّلت. مفيش فلوس اتحوّلت من التطبيق.');}
});
$('#cancel-edit').onclick=()=>{resetExpense();notify('التعديل اتلغى.');};
$('#search').addEventListener('input',renderHistory);
$('#currency').addEventListener('change',e=>{if(state.expenses.length||state.transfers.length)return;state.currency=e.target.value;commit('العملة اتغيّرت.');});
function download(content,type,filename){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#backup').onclick=()=>download(JSON.stringify(state,null,2),'application/json',`bel3adl-backup-${today()}.json`);
$('#csv').onclick=()=>{
  const cell=v=>'"'+String(v).replace(/^[=+@\-\t\r]/,"'$&").replace(/"/g,'""')+'"';
  const rows=[['type','date','description','amount','currency','payer_or_from','to','participants']];
  state.expenses.forEach(e=>rows.push(['expense',e.date,e.title,(e.amount/100).toFixed(2),state.currency,name(e.payer),'',e.participants.map(name).join(' | ')]));
  state.transfers.forEach(t=>rows.push(['settlement',t.date,'Recorded payment',(t.amount/100).toFixed(2),state.currency,name(t.from),name(t.to),'']));
  download('\ufeff'+rows.map(r=>r.map(cell).join(',')).join('\r\n'),'text/csv;charset=utf-8',`bel3adl-ledger-${today()}.csv`);
};
$('#import').addEventListener('change',async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>2000000)throw Error('الملف أكبر من 2 MB.');const next=C.validate(JSON.parse(await file.text()));if(!confirm('الاسترجاع هيستبدل الحساب الحالي، مش هيضيف عليه. نزّلت نسخة منه؟ اضغط موافق للاستبدال.'))return;state=next;resetExpense();commit('النسخة اتسترجعت.');}catch(err){notify('تعذر الاسترجاع: '+err.message,true);}finally{e.target.value='';}});
$('#reset').onclick=()=>{if(!confirm('ده هيمسح كل السكان والمصاريف والدفعات من المتصفح ده. نزّلت نسخة احتياطية؟'))return;state=blank();resetExpense();commit('الحساب اتمسح. تقدر تبدأ من جديد.');};
$('#demo').onclick=()=>{if(state.members.length)return;state={version:1,currency:'EGP',members:[{id:'demo_a',name:'ساكن ١'},{id:'demo_b',name:'ساكن ٢'},{id:'demo_c',name:'ساكن ٣'}],expenses:[{id:'demo_rent',title:'إيجار الشقة · مثال',amount:600000,payer:'demo_a',participants:['demo_a','demo_b','demo_c'],category:'rent',date:today()},{id:'demo_food',title:'مشتريات مشتركة · مثال',amount:90000,payer:'demo_b',participants:['demo_a','demo_b','demo_c'],category:'food',date:today()}],transfers:[]};commit('دي بيانات توضيحية. امسح الحساب من قسم بياناتك لما تحب تبدأ ببياناتك.');};
$('#expense-form [name=date]').value=today();$('#transfer-form [name=date]').value=today();render();if(storageWarning)notify(storageWarning,true);
