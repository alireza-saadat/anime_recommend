(() => {
'use strict';
const CATS = {movies:'Movies', series:'TV Series', games:'Video Games', anime:'Anime'};
const SHORT = {movies:'Movies', series:'Series', games:'Games', anime:'Anime'};
const KEYS = Object.keys(CATS);
const VIEWS = ['discover','collection','achievements'];
const STORE = 'nexus.progress.v1';
const ACH = [
  {id:'first',  n:'First Discovery',  i:'🌱', d:'Discover your first title',              t:s=>s.titles>=1},
  {id:'curious',n:'Curious Mind',     i:'🔎', d:'Discover 5 different titles',            t:s=>s.titles>=5},
  {id:'explore',n:'Explorer',         i:'🧭', d:'Discover 25 different titles',           t:s=>s.titles>=25},
  {id:'master', n:'Master Explorer',  i:'👑', d:'Discover 100 different titles',          t:s=>s.titles>=100},
  {id:'seeker', n:'Fact Seeker',      i:'💡', d:'Discover 20 facts',                      t:s=>s.facts>=20},
  {id:'hunter', n:'Fact Hunter',      i:'💎', d:'Discover 100 facts',                     t:s=>s.facts>=100},
  {id:'multi',  n:'Multiverse',       i:'🌌', d:'Discover a title in all four categories',t:s=>s.cats===4},
  {id:'deep',   n:'Deep Diver',       i:'📚', d:'Reveal all 10 facts of one title',       t:s=>s.deep},
  {id:'collect',n:'Collector',        i:'🏆', d:'Discover 50 different titles',           t:s=>s.titles>=50}
];
const $ = (s,r=document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const el = (tag,cls,html) => { const e=document.createElement(tag); if(cls) e.className=cls; if(html!=null) e.innerHTML=html; return e; };
const rnd = n => { const a=new Uint32Array(1); crypto.getRandomValues(a); return a[0]%n; };
const pad = n => String(n).padStart(2,'0');
const day = d => `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today = () => day(new Date());
const yesterday = () => { const d=new Date(); d.setDate(d.getDate()-1); return day(d); };

/* ---------- state (progress only; the catalog is never stored) ---------- */
const blank = () => ({seen:{}, ach:{}, streak:{count:0,last:null}, daily:{date:null,done:false}, last:null});
function clean(raw){
  const s = blank();
  if(!raw || typeof raw!=='object') return s;
  const seen = raw.seen && typeof raw.seen==='object' ? raw.seen : {};
  for(const [id,r] of Object.entries(seen)){
    if(!r || !KEYS.includes(r.cat) || typeof r.t!=='string') continue;
    s.seen[id] = {cat:r.cat, t:r.t.slice(0,200), y:r.y|0,
      s:Math.min(5,Math.max(0,r.s|0)), u:Math.min(10,Math.max(0,r.u|0)), n:Math.max(1,r.n|0)};
  }
  if(raw.ach && typeof raw.ach==='object')
    for(const [k,v] of Object.entries(raw.ach)) if(ACH.some(a=>a.id===k)) s.ach[k] = +v || Date.now();
  const st = raw.streak;
  if(st && Number.isInteger(st.count) && st.count>=0) s.streak = {count:st.count, last:typeof st.last==='string'?st.last:null};
  const d = raw.daily;
  if(d && typeof d.date==='string') s.daily = {date:d.date, done:!!d.done};
  s.last = typeof raw.last==='string' ? raw.last : null;
  return s;
}
let S;
try { S = clean(JSON.parse(localStorage.getItem(STORE))); } catch { S = blank(); }
function save(){ try { localStorage.setItem(STORE, JSON.stringify(S)); } catch { toast('Could not save progress. Browser storage may be blocked.','warn'); } }

function stats(){
  const per = {movies:0,series:0,games:0,anime:0}; let facts=0, deep=false;
  const v = Object.values(S.seen);
  v.forEach(r => { per[r.cat]++; facts+=r.u; if(r.u>=10) deep=true; });
  return {titles:v.length, facts, per, cats:KEYS.filter(k=>per[k]).length, deep, ach:Object.keys(S.ach).length};
}
function checkAch(){
  const st = stats(), out = [];
  for(const a of ACH) if(!S.ach[a.id] && a.t(st)){ S.ach[a.id]=Date.now(); out.push(a); }
  return out;
}

/* ---------- data (one JSON per category, loaded on demand, no external APIs) ---------- */
const DATA = {}, PEND = {}, TOTAL = {movies:0,series:0,games:0,anime:0};
function loadCat(k){
  if(DATA[k]) return Promise.resolve(DATA[k]);
  return PEND[k] || (PEND[k] = fetch(`data/${k}.json`)
    .then(r => { if(!r.ok) throw new Error(`HTTP ${r.status} for data/${k}.json`); return r.json(); })
    .then(j => { if(!Array.isArray(j) || !j.length) throw new Error(`data/${k}.json is empty`); DATA[k]=j; if(!TOTAL[k]) TOTAL[k]=j.length; return j; })
    .catch(e => { delete PEND[k]; throw e; }));
}
async function loadManifest(){
  try { const r = await fetch('data/manifest.json'); if(r.ok){ const m = await r.json(); KEYS.forEach(k => TOTAL[k] = m[k]|0); } } catch {}
}

/* ---------- discovery ---------- */
let filter = 'all', busy = false;
async function discover(){
  if(busy) return; busy = true;
  const btn = $('#surprise'); btn.disabled = true; btn.textContent = 'Picking…';
  try {
    const order = filter==='all' ? KEYS.map(k=>[Math.random(),k]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]) : [filter];
    let list = null, cat = null, failed = null;
    for(const k of order){ try { list = await loadCat(k); cat = k; break; } catch(e){ failed = e; } }
    if(!list) throw failed;
    let t = list[rnd(list.length)];
    if(list.length>1) while(t.id===S.last) t = list[rnd(list.length)];
    if(!Array.isArray(t.facts) || t.facts.length!==10) throw new Error(`"${t.title}" does not have exactly 10 facts`);

    let r = S.seen[t.id]; const isNew = !r;
    if(!r) r = S.seen[t.id] = {cat, t:t.title, y:t.year, s:0, u:0, n:0};
    if(r.s>=5) r.s = 0;                         // all 10 facts were shown before: start again at facts 1 and 2
    const prev = r.s*20;
    const facts = [t.facts[r.s*2], t.facts[r.s*2+1]];
    r.s++; r.n++; r.u = Math.max(r.u, r.s*2);
    S.last = t.id;

    const td = today(); let dailyDone = false;
    if(S.streak.last !== td){ S.streak.count = S.streak.last===yesterday() ? S.streak.count+1 : 1; S.streak.last = td; }
    if(S.daily.date !== td) S.daily = {date:td, done:false};
    if(isNew && !S.daily.done){ S.daily.done = true; dailyDone = true; }
    const got = checkAch();
    save();

    renderStage(t, r, prev, facts, isNew, cat);
    renderStats(); renderDaily(); renderCollection(); renderAch();
    if(isNew) toast(`New title discovered: ${t.title}`);
    if(r.s===5) toast(`All 10 facts revealed for ${t.title}`,'gold');
    if(dailyDone) toast('Daily Discovery complete','gold');
    got.forEach(a => toast(`Achievement unlocked: ${a.i} ${a.n}`,'gold'));
  } catch(e){
    $('#stage').innerHTML = `<div class="err"><p><b>Couldn't load the database.</b></p><p class="mute">${esc((e && e.message) || 'Unknown error')}. Check your connection, or serve the site over http instead of opening the file directly, then press Surprise Me again.</p></div>`;
  } finally { busy = false; btn.disabled = false; btn.textContent = 'Surprise Me'; }
}

function cover(t){
  const d = el('div','cover'); d.dataset.l = (t.title||'?').trim().charAt(0).toUpperCase();
  if(t.cover){
    const i = new Image(); i.alt = `${t.title} cover`; i.loading = 'lazy'; i.decoding = 'async'; i.referrerPolicy = 'no-referrer';
    i.onerror = () => i.remove(); i.src = t.cover; d.append(i);
  }
  return d;
}
function renderStage(t, r, prev, facts, isNew, cat){
  const pct = r.s*20, st = $('#stage'); st.innerHTML = '';
  const card = el('article','hero-card'); card.append(cover(t));
  const info = el('div','info');
  info.innerHTML = `<div class="meta"><span class="pill">${esc(CATS[cat])}</span><span>${esc(t.year)}</span><span class="rate">★ ${esc(t.rating)}</span>${isNew?'<span class="new">New</span>':''}</div>
    <h2>${esc(t.title)}</h2><p class="genres">${t.genres.map(esc).join(' · ')}</p><p class="desc">${esc(t.description)}</p>
    <h3>Two new facts</h3><ul class="facts">${facts.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
    <div class="prog"><div class="row"><span>Facts discovered</span><strong>${r.s*2} / 10</strong></div>
    <div class="bar${pct===100?' done':''}"><i style="width:${prev}%"></i></div>
    <p class="rem">${pct===100?'All facts found. Discover this title again to start a new round.':`${10-r.s*2} facts still hidden`}</p></div>`;
  card.append(info); st.append(card);
  const fill = $('.bar i', info);
  requestAnimationFrame(() => requestAnimationFrame(() => fill.style.width = pct+'%'));
  st.scrollIntoView({block:'nearest', behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'auto' : 'smooth'});
}

/* ---------- rendering ---------- */
function renderStats(){
  const st = stats(), all = KEYS.reduce((a,k)=>a+TOTAL[k],0), pct = all ? st.titles/all*100 : 0;
  $('#stats').innerHTML = `<div class="tiles4">
    <div class="tile"><b>${st.titles}</b><span>Titles discovered</span></div>
    <div class="tile"><b>${st.facts}</b><span>Facts revealed</span></div>
    <div class="tile gold"><b>${st.ach} / ${ACH.length}</b><span>Achievements</span></div>
    <div class="tile"><b>${pct>0&&pct<10?pct.toFixed(1):Math.round(pct)}%</b><span>Catalog discovered</span></div></div>
    <div class="cats">${KEYS.map(k=>{const p=TOTAL[k]?st.per[k]/TOTAL[k]*100:0;
      return `<div class="cat"><div class="row"><span>${CATS[k]}</span><strong>${st.per[k]} / ${TOTAL[k]}</strong></div><div class="bar"><i style="width:${p}%"></i></div></div>`;}).join('')}</div>`;
}
function renderDaily(){
  const td = today(), done = S.daily.date===td && S.daily.done;
  const live = S.streak.last===td || S.streak.last===yesterday() ? S.streak.count : 0;
  $('#daily').innerHTML = `<div class="tile ${done?'gold':''}"><b>${done?'Complete ✓':'Daily Discovery'}</b><span>${done?'You found a new title today. Come back tomorrow.':'Discover one new title today to complete it.'}</span></div>
    <div class="tile"><b>${live} ${live===1?'day':'days'}</b><span>${live?'Discovery streak. Discover something every day to keep it going.':'Discovery streak. Discover a title to start one.'}</span></div>`;
}
let colCat = 'movies', colLimit = 24;
function renderCollection(){
  const st = stats(), tabs = $('#col-tabs'); tabs.innerHTML = '';
  KEYS.forEach(k => { const b = el('button','tab'+(k===colCat?' on':''), `${SHORT[k]}<span>${st.per[k]}</span>`);
    b.onclick = () => { colCat = k; colLimit = 24; renderCollection(); }; tabs.append(b); });
  const items = Object.values(S.seen).filter(r=>r.cat===colCat).reverse(), box = $('#col-list'); box.innerHTML = '';
  if(!items.length){ box.innerHTML = `<div class="empty">Nothing in ${esc(SHORT[colCat])} yet. Press Surprise Me and your first discovery will be added here automatically.</div>`; return; }
  const list = el('div','list');
  items.slice(0,colLimit).forEach(r => list.append(el('div','item',
    `<h4>${esc(r.t)}</h4><p>${esc(SHORT[r.cat])} · ${r.y||'n/a'} · seen ${r.n}×</p>
     <div class="row"><span>Facts</span><strong>${r.u} / 10</strong></div><div class="bar${r.u===10?' done':''}"><i style="width:${r.u*10}%"></i></div>`)));
  box.append(list);
  if(items.length>colLimit){ const m = el('button','btn more',`Show more (${items.length-colLimit} left)`); m.onclick = () => { colLimit += 24; renderCollection(); }; box.append(m); }
}
function renderAch(){
  $('#ach-count').textContent = `${Object.keys(S.ach).length} of ${ACH.length} unlocked`;
  $('#ach-grid').innerHTML = ACH.map(a => { const got = S.ach[a.id];
    return `<div class="ach ${got?'got':'lock'}"><div class="ic">${got?a.i:'🔒'}</div><div><h4>${esc(a.n)}</h4><p>${esc(a.d)}</p>${got?`<div class="st">Unlocked ${new Date(got).toLocaleDateString()}</div>`:''}</div></div>`; }).join('');
}
function renderAll(){ renderStats(); renderDaily(); renderCollection(); renderAch(); }

function toast(msg, kind=''){
  const box = $('#toasts'); while(box.children.length>=4) box.firstChild.remove();
  const t = el('div','toast '+kind); t.textContent = msg; box.append(t);
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 300); }, 3800);
}

/* ---------- navigation, backup, init ---------- */
function show(v){
  if(!VIEWS.includes(v)) v = 'discover';
  VIEWS.forEach(n => $('#v-'+n).hidden = n!==v);
  document.querySelectorAll('#tabs button').forEach(b => b.setAttribute('aria-current', b.dataset.view===v ? 'page' : 'false'));
  if(location.hash.slice(1)!==v) history.replaceState(null,'','#'+v);
}
function exportBackup(){
  const blob = new Blob([JSON.stringify({app:'nexus', version:1, exportedAt:new Date().toISOString(), data:S}, null, 2)], {type:'application/json'});
  const a = el('a'); a.href = URL.createObjectURL(blob); a.download = `nexus-progress-${today()}.json`;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  toast('Backup downloaded');
}
async function importBackup(e){
  const f = e.target.files[0]; e.target.value = ''; if(!f) return;
  try {
    const j = JSON.parse(await f.text());
    if(j.app!=='nexus' || !j.data) throw new Error('bad file');
    const n = clean(j.data);
    if(!confirm(`Replace your current progress with this backup (${Object.keys(n.seen).length} titles)?`)) return;
    S = n; checkAch(); save(); renderAll(); toast('Progress restored');
  } catch { toast('That file is not a valid NEXUS backup.','warn'); }
}
function init(){
  document.querySelectorAll('#tabs button').forEach(b => b.onclick = () => show(b.dataset.view));
  $('.logo').onclick = e => { e.preventDefault(); show('discover'); };
  window.addEventListener('hashchange', () => show(location.hash.slice(1)));
  $('#surprise').onclick = discover;
  document.querySelectorAll('#chips button').forEach(b => b.onclick = () => {
    filter = b.dataset.f;
    document.querySelectorAll('#chips button').forEach(x => x.setAttribute('aria-pressed', x===b));
    discover();
  });
  $('#export').onclick = exportBackup; $('#import').onchange = importBackup;
  renderAll(); show(location.hash.slice(1));
  loadManifest().then(renderAll);
  (window.requestIdleCallback || (f => setTimeout(f,1500)))(() => KEYS.forEach(k => loadCat(k).catch(()=>{})));
}
init();
})();
