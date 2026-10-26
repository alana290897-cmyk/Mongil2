/* MONGIL Atlas VN — giao diện thuần HTML/CSS/JS. Dữ liệu thật được tải và lưu trên Netlify Blobs qua API. */
(() => {
'use strict';
const $=s=>document.querySelector(s);
const app=$('#app');
const TABS=[['home','Tổng quan'],['characters','Nhân vật'],['builds','Build nhân vật'],['teams','Đội hình'],['news','Tin chính thức'],['leaks','Leak & sắp ra mắt'],['equipment','Trang bị'],['monsterlings','Monsterling'],['legends','Monster Legend'],['saved','Đã lưu']];
const ADMIN_TYPES=[['characters','Nhân vật'],['builds','Build nhân vật'],['teams','Đội hình'],['news','Tin chính thức'],['leaks','Leak'],['equipment','Trang bị'],['monsterlings','Monsterling'],['legends','Monster Legend'],['sources','Nguồn cập nhật']];
const labels=Object.fromEntries(ADMIN_TYPES); const state={data:{},admin:false,defaultCredential:false,page:'home',adminType:'characters',filter:'',element:'',role:'',saved:new Set(),pick:{},editing:null};
try{state.saved=new Set(JSON.parse(localStorage.getItem('atlas-favorites')||'[]'));}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sanitizeUrl=s=>{try{let u=new URL(s);return u.protocol==='https:'||u.protocol==='http:'?u.href:'';}catch{return''}};
const fmtDate=s=>{if(!s)return 'Chưa rõ ngày';const d=new Date(s);return isNaN(d)?esc(s):d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'})};
const items=type=>state.data[type]||[];
const lookup=(type,id)=>items(type).find(x=>x.id===id);
const first=s=>String(s||'?').trim().slice(0,2).toUpperCase();
const genId=type=>`${type.slice(0,4)}-${(self.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2)).slice(0,38)}`;
const truncate=(s,n=140)=>{const v=String(s||'');return v.length>n?v.slice(0,n).trim()+'…':v};
const portrait=(item,klass='cardimg')=>{const img=sanitizeUrl(item?.image);return `<div class="${klass}">${img?`<img data-avatar src="${esc(img)}" alt="${esc(item?.name||item?.title)}" loading="lazy">`:''}<span class="fallback-art" ${img?'hidden':''}>${esc(first(item?.name||item?.title))}</span></div>`;};
const external=(url,label='Xem nguồn')=>{const safe=sanitizeUrl(url);return safe?`<a class="info-link" href="${esc(safe)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`:''};
function toast(message,error=false){const el=$('#toast');el.textContent=message;el.className='toast show'+(error?' error':'');setTimeout(()=>{if(el.textContent===message)el.className='toast'},4300)}
async function api(path,body=null,method=null){
 const res=await fetch('/api/'+path,{method:method||(body?'POST':'GET'),headers:body?{'Content-Type':'application/json'}:{},credentials:'same-origin',body:body?JSON.stringify(body):undefined,cache:'no-store'});
 const payload=await res.json().catch(()=>({error:`API trả về HTTP ${res.status}`}));
 if(!res.ok)throw Error(payload.error||'Không kết nối được dịch vụ');return payload;
}
async function refresh(silent=false){try{const out=await api('data');state.data=out.data;state.admin=out.admin;render();if(!silent)toast('Dữ liệu đã được tải mới từ máy chủ');}catch(e){if(!silent)toast(e.message,true);throw e}}
function navigate(page){if(page==='admin'&&!state.admin){loginModal();return}state.page=page;state.filter='';state.element='';state.role='';location.hash=page;window.scrollTo({top:0,behavior:'instant'});render()}
function heading(kicker,title,description=''){return `<div class="pagehead"><div class="eyebrow">${esc(kicker)}</div><h2>${esc(title)}</h2>${description?`<p>${esc(description)}</p>`:''}</div>`}
function header(){const current=state.page;const nav=TABS.map(([k,n])=>`<button class="navitem ${current===k?'active':''}" data-go="${k}">${esc(n)}${k==='saved'?` (${state.saved.size})`:''}</button>`).join('');return `<div class="topline"><div class="container"><span>✦ CẨM NANG CỘNG ĐỒNG · VIỆT NAM</span><span>MONGIL: STAR DIVE</span></div></div><header class="navbar"><div class="container navin"><button class="brand navitem" data-go="home" style="border:0;background:transparent;text-align:left;padding:0"><span>✦</span> MONGIL ATLAS<small>VIETNAM · STAR DIVE</small></button><nav class="navscroll">${nav}${state.admin?`<button class="navitem ${current==='admin'?'active':''}" data-go="admin">⚙ Quản trị</button>`:''}</nav><div class="navright"><button class="mini-btn" data-action="${state.admin?'logout':'open-login'}">${state.admin?'Đăng xuất':'Đăng nhập'}</button></div></div></header>`}
function footer(){return `<footer class="footer"><div class="container footergrid"><span>✦ MONGIL ATLAS VIETNAM · Cẩm nang cộng đồng, không phải trang chính thức của Netmarble.</span><span>${external('https://stardive.netmarble.com/','Trang chủ')} · ${external('https://forum.netmarble.com/stardive_gl','Forum')} · ${external('https://www.kaiden.gg/mongil/','Wiki')}</span></div></footer>`}
const filters=type=>`<div class="toolbar"><input id="list-search" placeholder="Tìm ${esc(labels[type]||'nội dung')} theo tên hoặc mô tả..." autocomplete="off" value="${esc(state.filter)}" aria-label="Tìm kiếm">${type==='characters'?`<select id="filter-element"><option value="">Tất cả nguyên tố</option>${[...new Set(items('characters').map(x=>x.element).filter(Boolean))].map(x=>`<option ${state.element===x?'selected':''}>${esc(x)}</option>`).join('')}</select><select id="filter-role"><option value="">Tất cả vai trò</option>${[...new Set(items('characters').map(x=>x.role).filter(Boolean))].map(x=>`<option ${state.role===x?'selected':''}>${esc(x)}</option>`).join('')}</select>`:''}<button class="mini-btn" data-action="clear-filter">Xóa lọc</button></div>`;
function selectedRows(type){let arr=items(type).filter(x=>{
 const content=[x.name,x.title,x.summary,x.description,x.element,x.role,x.sourceName,x.skills,x.set2,x.set4,x.rank,x.link].join(' ').toLowerCase();
 return (!state.filter||content.includes(state.filter.toLowerCase()))&&(!state.element||x.element===state.element)&&(!state.role||x.role===state.role);
}); if(type==='news'||type==='leaks')arr=arr.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||''));return arr}
function favorite(id){return `<button class="fav ${state.saved.has(id)?'active':''}" data-action="fav" data-id="${esc(id)}" title="${state.saved.has(id)?'Bỏ lưu':'Lưu mục này'}">${state.saved.has(id)?'♥':'♡'}</button>`}
function card(type,item){
 const name=item.title||item.name||'Chưa đặt tên';const desc=item.summary||item.description||item.role||item.set2||item.rank||'';
 if(['news','leaks'].includes(type))return `<article class="newsline"><div><div class="pills"><span class="pill">${type==='leaks'?'Tin chưa xác nhận':esc(item.sourceName||'Tin tức')}</span><span class="news-date">${fmtDate(item.date)}</span></div><h3>${esc(name)}</h3><p>${esc(truncate(desc,240))}</p><div style="margin-top:12px;display:flex;gap:15px"> <button class="linkish navitem" data-action="view" data-type="${type}" data-id="${esc(item.id)}">Tóm tắt chi tiết →</button>${external(item.url)}</div></div>${favorite(item.id)}</article>`;
 if(type==='builds'){
  const ch=lookup('characters',item.characterId)||{name:'Chưa chọn nhân vật'};
  const gear=(item.gearIds||[]).map(id=>lookup('equipment',id)?.name).filter(Boolean).join(' · ');
  return `<article class="card">${portrait(ch)}<div class="cardbody"><div class="pills"><span class="pill">BUILD</span>${item.published===false?'<span class="pill">Bản nháp</span>':''}</div><h3>${esc(name)}</h3><p>${esc(ch.name)} · ${esc(truncate(gear||item.description||'Chưa khai báo trang bị',80))}</p><div class="cardfoot"><button class="linkish navitem" data-action="view" data-type="builds" data-id="${esc(item.id)}">Xem hướng build →</button></div></div></article>`;
 }
 if(type==='teams'){
  const members=(item.characterIds||[]).map(x=>lookup('characters',x)?.name||'?').join(' · ');
  return `<article class="card"><div class="widecard"><div class="eyebrow">Đội hình 3 nhân vật</div><h3>${esc(name)}</h3><p>${esc(members)}</p><p>${esc(truncate(desc,100))}</p><div class="cardfoot"><button class="linkish navitem" data-action="view" data-type="teams" data-id="${esc(item.id)}">Xem đội hình →</button></div></div></article>`;
 }
 return `<article class="card"><div style="position:relative">${portrait(item)}${favorite(item.id)}</div><div class="cardbody"><div class="pills">${item.rarity?`<span class="pill">${'★'.repeat(Math.min(5,Number(item.rarity)))}</span>`:''}<span class="pill">${esc(item.element||item.type||'Thông tin')}</span></div><h3>${esc(name)}</h3><p>${esc(truncate(desc||(type==='characters'?'Hồ sơ nhân vật — đang cập nhật kỹ năng':'Nhấn để xem thông tin chi tiết'),90))}</p><div class="cardfoot"><span class="small">${esc(type==='characters'?item.role||'':type==='monsterlings'?'MONSTERLING':type==='equipment'?'EQUIPMENT':'LEGEND')}</span><button class="linkish navitem" data-action="view" data-type="${type}" data-id="${esc(item.id)}">Chi tiết →</button></div></div></article>`;
}
function empties(type){return `<div class="empty"><div class="glyph">✧</div><h3>${state.filter?'Không có kết quả phù hợp':`Chưa có ${esc(labels[type]||'nội dung')} được công bố`}</h3><p>${state.filter?'Thử điều chỉnh bộ lọc hoặc từ khóa khác.':'Nội dung sẽ xuất hiện sau khi quản trị tạo và xuất bản trên hệ thống.'}</p>${state.admin?`<button class="btn primary" data-action="add" data-type="${type}">+ Thêm dữ liệu</button>`:''}</div>`}
function listArea(type){const arr=selectedRows(type);return arr.length?`<div class="${['news','leaks'].includes(type)?'content-card':['teams'].includes(type)?'grid grid-3':'grid'}">${arr.map(x=>card(type,x)).join('')}</div>`:empties(type)}
function listPage(type){const descriptions={characters:'Tra cứu nguyên tố, vai trò, kỹ năng và hướng build của từng nhân vật.',builds:'Build được quản trị biên tập, hiển thị đầy đủ trang bị, Monsterling và Monster Legend.',teams:'Đội hình 3 nhân vật, vai trò và cách phối hợp chiến đấu.',news:'Tin tức từ nguồn chính thức, có tóm tắt và liên kết bài gốc.',leaks:'Tin rò rỉ và nội dung sắp ra mắt, luôn kiểm tra tình trạng xác thực trước khi sử dụng.',equipment:'Tra cứu các bộ trang bị và hiệu ứng theo bộ.',monsterlings:'Danh mục Monsterling, Link Skill, Rank Effect và Traits.',legends:'Danh mục Monster Legend và hiệu ứng do quản trị cập nhật.'};return `${heading('THƯ VIỆN MONGIL',`${labels[type]} · ${items(type).length}`,descriptions[type])}${filters(type)}<div id="list-area">${listArea(type)}</div>${type==='monsterlings'||type==='equipment'?`<p class="notice" style="margin-top:20px">Danh mục ban đầu chỉ gồm tên tham chiếu. Hiệu ứng kỹ năng, ảnh và chỉ số phải được cập nhật hoặc kiểm chứng từ nguồn ngoài. ${external(type==='monsterlings'?'https://www.kaiden.gg/mongil/monsterlings/':'https://www.kaiden.gg/mongil/equipment/','Tra cứu dữ liệu đầy đủ')}</p>`:''}`}
function home(){const chars=items('characters'),builds=items('builds'),teams=items('teams'),news=items('news');const featured=chars.find(x=>x.name==='Chloe')||chars[0]||{name:'Chloe'};
 return `<section class="hero"><div class="herogrid"><div><div class="eyebrow">✦ MONGIL: STAR DIVE · CẨM NANG VIỆT NAM</div><h1>Khám phá nhân vật.<br><span class="gradient-text">Tạo build của bạn.</span></h1><p>Khám phá nhân vật, tìm hướng build và kết hợp đội hình theo cách chơi của bạn. Dữ liệu công khai được biên tập và cập nhật từ trang quản trị.</p><div class="actions"><button class="btn primary" data-go="characters">Khám phá nhân vật →</button><button class="btn ghost" data-go="teams">Tìm đội hình</button></div></div><div class="hero-visual">${sanitizeUrl(featured.image)?`<img class="feature-img" data-avatar src="${esc(sanitizeUrl(featured.image))}" alt="${esc(featured.name)}">`:''}<div class="visual-fallback" ${sanitizeUrl(featured.image)?'hidden':''}>✦</div><div class="featured-chip"><span class="eyebrow">NHÂN VẬT MỚI</span><div><strong>${esc(featured.name)}</strong><div class="small">${esc(featured.element||'')} · ${esc(featured.role||'')}</div></div></div></div></div><div class="stats"><div class="stat"><span class="num">${chars.length.toString().padStart(2,'0')}</span><label>Hồ sơ nhân vật</label></div><div class="stat"><span class="num">${builds.length.toString().padStart(2,'0')}</span><label>Build cộng đồng</label></div><div class="stat"><span class="num">${teams.length.toString().padStart(2,'0')}</span><label>Đội hình chia sẻ</label></div><div class="stat"><span class="num">${items('monsterlings').length.toString().padStart(2,'0')}</span><label>Monsterling tham khảo</label></div></div></section>
 <section class="section"><div class="sectionhead"><div><div class="eyebrow">✦ NHÂN VẬT</div><h2>Khám phá nhân vật</h2></div><button class="mini-btn" data-go="characters">Tất cả nhân vật →</button></div><div class="grid">${[...chars].sort((a,b)=>(a.order??999)-(b.order??999)).filter(c=>['Chloe','Isabella','Vivian','Mabel','Mina','Esther'].includes(c.name)).slice(0,6).map(x=>card('characters',x)).join('')}</div></section>
 <section class="section"><div class="sectionhead"><div><div class="eyebrow">✦ CHIẾN THUẬT</div><h2>Build & đội hình</h2></div><button class="mini-btn" data-go="builds">Khám phá build →</button></div>${builds.length?`<div class="grid grid-3">${builds.slice(0,3).map(x=>card('builds',x)).join('')}</div>`:`<div class="banner"><h3>Build đầu tiên có thể là của bạn.</h3><p>Trang bị, chỉ số, Monsterling, Monster Legend và đội hình 3 nhân vật.</p><button class="btn primary" data-go="builds">Khám phá hướng build</button></div>`}</section>
 <section class="section"><div class="sectionhead"><div><div class="eyebrow">✦ CẬP NHẬT</div><h2>Tin mới</h2></div><button class="mini-btn" data-go="news">Xem tất cả →</button></div><div class="content-card">${news.slice().sort((a,b)=>(b.date||'').localeCompare(a.date||'')).slice(0,3).map(x=>card('news',x)).join('')||empties('news')}</div></section>
 <section class="section"><div class="sectionhead"><div><div class="eyebrow">✦ LIÊN KẾT</div><h2>Kênh tham khảo</h2></div></div><div class="grid grid-3"><div class="card widecard"><div class="eyebrow">CHÍNH THỨC</div><h3>Trang chủ MONGIL</h3><p>Thế giới và hồ sơ nhân vật.</p>${external('https://stardive.netmarble.com/')}</div><div class="card widecard"><div class="eyebrow">CẬP NHẬT</div><h3>Forum Netmarble</h3><p>Thông báo và nội dung trò chơi.</p>${external('https://forum.netmarble.com/stardive_gl')}</div><div class="card widecard"><div class="eyebrow">HƯỚNG DẪN</div><h3>Kaiden.gg</h3><p>Tham khảo nhân vật, trang bị và Monsterling.</p>${external('https://www.kaiden.gg/mongil/')}</div></div></section>`;
}
function savedPage(){const selected=[];for(const type of ['characters','builds','teams','equipment','monsterlings','legends','news','leaks'])for(const item of items(type))if(state.saved.has(item.id))selected.push({type,item});return `${heading('CÁ NHÂN','Mục bạn đã lưu','Danh sách này chỉ lưu trên trình duyệt của bạn; quản trị không nhìn thấy mục yêu thích.')}${selected.length?`<div class="grid">${selected.map(({type,item})=>card(type,item)).join('')}</div>`:empties('saved')}`}
function render(){const content=state.page==='home'?home():state.page==='admin'?adminPage():state.page==='saved'?savedPage():listPage(state.page in labels?state.page:'characters');app.innerHTML=header()+`<main class="container">${content}</main>`+footer();}
const currentModal=()=>$('#modal-overlay');
function showModal(content,cls=''){currentModal()?.remove();document.body.insertAdjacentHTML('beforeend',`<div class="overlay" id="modal-overlay"><div class="dialog ${cls}" role="dialog" aria-modal="true">${content}</div></div>`);}
function closeModal(){currentModal()?.remove();state.editing=null;state.pick={};}
function loginModal(){showModal(`<div class="dialog-top"><h2>Đăng nhập quản trị</h2><button class="close" data-action="close">×</button></div><form id="login-form" class="loginbox"><div class="form-group"><label>Tên đăng nhập</label><input name="username" value="admin" autocomplete="username" required></div><div class="form-group"><label>Mật khẩu</label><input name="password" type="password" autocomplete="current-password" required></div><button class="btn primary" style="width:100%">Đăng nhập</button><p class="notice" style="margin-top:13px">Mặc định lần đầu: admin / admin. Hãy thay mật khẩu ngay sau khi triển khai.</p></form>`,'narrow')}
function details(type,id){const item=lookup(type,id);if(!item)return toast('Không tìm thấy nội dung',true);const name=item.name||item.title;let parts='';
 if(type==='characters'){
  const related=items('builds').filter(b=>b.characterId===item.id);
  parts=`<div class="pills"><span class="pill">${esc(item.element||'Chưa rõ nguyên tố')}</span><span class="pill">${esc(item.role||'Chưa rõ vai trò')}</span>${item.rarity?`<span class="pill">${'★'.repeat(Math.min(5,Number(item.rarity)))}</span>`:''}</div><h3>Giới thiệu</h3><pre>${esc(item.summary||'Chưa có mô tả được xác minh.')}</pre><h3>Kỹ năng nhân vật</h3><pre>${esc(item.skills||'Chưa cập nhật kỹ năng. Quản trị có thể bổ sung từng kỹ năng tại CMS.')}</pre><h3>Build đề xuất</h3>${related.length?related.map(x=>`<p><button class="linkish navitem" data-action="view" data-type="builds" data-id="${esc(x.id)}">${esc(x.title)} →</button></p>`).join(''):'<p>Chưa có build được công bố cho nhân vật này.</p>'}`;
 } else if(type==='builds'){
  const ch=lookup('characters',item.characterId);const gear=(item.gearIds||[]).map(x=>lookup('equipment',x)).filter(Boolean);const mon=(item.monsterlingIds||[]).map(x=>lookup('monsterlings',x)).filter(Boolean);const legend=lookup('legends',item.legendId);
  parts=`<h3>Nhân vật</h3><p>${esc(ch?.name||'Chưa xác định')} · ${esc(ch?.element||'')}</p><h3>Trang bị đề xuất</h3>${attachments(gear)}<h3>Monsterling đề xuất</h3>${attachments(mon)}<h3>Monster Legend</h3>${legend?attachments([legend]):'<p>Chưa chỉ định Monster Legend.</p>'}<h3>Chỉ số ưu tiên</h3><pre>${esc(item.stats||'Chưa cập nhật')}</pre><h3>Hướng dẫn lối chơi</h3><pre>${esc(item.description||'Chưa có mô tả')}</pre>`;
 } else if(type==='teams'){
  const chars=(item.characterIds||[]).map(x=>lookup('characters',x)).filter(Boolean);
  parts=`<h3>Thành viên đội hình (${chars.length}/3)</h3>${attachments(chars)}<h3>Vai trò và cách phối hợp</h3><pre>${esc(item.description||'Chưa cập nhật')}</pre>`;
 } else if(type==='equipment')parts=`<h3>Hiệu ứng 2 món</h3><pre>${esc(item.set2||'Chưa cập nhật')}</pre><h3>Hiệu ứng 4 món</h3><pre>${esc(item.set4||'Chưa cập nhật')}</pre><h3>Ghi chú</h3><pre>${esc(item.description||'Chưa có')}</pre>`;
 else if(type==='monsterlings')parts=`<h3>Link Skill</h3><pre>${esc(item.link||'Chưa cập nhật')}</pre><h3>Rank Effect</h3><pre>${esc(item.rank||'Chưa cập nhật')}</pre><h3>Traits</h3><pre>${esc(item.traits||'Chưa cập nhật')}</pre><h3>Ghi chú</h3><pre>${esc(item.description||'Chưa có')}</pre>`;
 else parts=`${item.date?`<p class="news-date">${fmtDate(item.date)} · ${esc(item.sourceName||'')}</p>`:''}<h3>${type==='leaks'?'Thông tin chưa xác nhận':'Tóm tắt'}</h3><pre>${esc(item.summary||item.description||'Chưa cập nhật nội dung')}</pre>${item.content?`<h3>Nội dung chi tiết</h3><pre>${esc(item.content)}</pre>`:''}`;
 const image=(type==='builds'&&lookup('characters',item.characterId))||item;
 showModal(`<div class="dialog-top"><h2>${esc(name)}</h2><button class="close" data-action="close">×</button></div><div class="detailgrid">${portrait(image,'detailvisual')}<div class="detailcontent">${parts}<p style="margin-top:22px">${external(item.source||item.url,'Nguồn tham khảo')}</p>${state.admin?`<div class="dialog-actions"><button class="btn primary" data-action="edit" data-type="${type}" data-id="${esc(id)}">Sửa mục này</button></div>`:''}</div></div>`);
}
function attachments(list){return list.length?`<div class="attached">${list.map(x=>`<div class="attach">${sanitizeUrl(x.image)?`<img data-avatar src="${esc(sanitizeUrl(x.image))}" alt="">`:`<span class="fallback-art" style="font-size:23px;letter-spacing:0">${esc(first(x.name))}</span>`}<div><b>${esc(x.name)}</b><div class="small">${esc(truncate(x.role||x.type||x.element||'',35))}</div></div></div>`).join('')}</div>`:'<p>Chưa chọn dữ liệu.</p>'}
const editorFields={
 characters:[['name','Tên nhân vật','text'],['element','Nguyên tố','text'],['role','Vai trò','text'],['rarity','Độ hiếm (số sao)','number'],['image','URL ảnh nhân vật','url'],['summary','Giới thiệu','textarea'],['skills','Kỹ năng — mỗi dòng một kỹ năng','textarea'],['source','URL nguồn tham khảo','url']],
 builds:[['title','Tên bản build','text'],['characterId','Nhân vật','charselect'],['stats','Chỉ số ưu tiên','textarea'],['description','Hướng dẫn xây dựng / rotation','textarea'],['gearIds','Chọn bộ trang bị','equipment',4],['monsterlingIds','Chọn Monsterling','monsterlings',3],['legendId','Chọn Monster Legend','legends',1],['source','URL nguồn tham khảo','url']],
 teams:[['title','Tên đội hình','text'],['characterIds','Chọn đúng 3 nhân vật','characters',3],['description','Vai trò / combo / hướng dẫn đội hình','textarea'],['source','URL nguồn','url']],
 equipment:[['name','Tên bộ trang bị','text'],['type','Loại','text'],['image','URL ảnh trang bị','url'],['set2','Hiệu ứng 2 món','textarea'],['set4','Hiệu ứng 4 món','textarea'],['description','Ghi chú','textarea'],['source','URL nguồn','url']],
 monsterlings:[['name','Tên Monsterling','text'],['image','URL ảnh Monsterling','url'],['link','Link Skill','textarea'],['rank','Rank Effect','textarea'],['traits','Traits / thuộc tính','textarea'],['description','Ghi chú','textarea'],['source','URL nguồn','url']],
 legends:[['name','Tên Monster Legend','text'],['image','URL ảnh Monster Legend','url'],['description','Hiệu ứng và mô tả','textarea'],['source','URL nguồn','url']],
 news:[['title','Tiêu đề','text'],['date','Ngày công bố','date'],['sourceName','Tên nguồn','text'],['url','URL bài gốc','url'],['image','URL ảnh đại diện','url'],['summary','Tóm tắt tiếng Việt','textarea'],['content','Nội dung chi tiết','textarea']],
 leaks:[['title','Tiêu đề leak','text'],['date','Ngày ghi nhận','date'],['sourceName','Nguồn leak','text'],['url','URL nguồn','url'],['image','URL ảnh','url'],['summary','Tóm tắt nội dung leak','textarea'],['content','Chi tiết / mức độ xác thực','textarea']],
 sources:[['name','Tên nguồn','text'],['url','URL nguồn HTTPS','url'],['type','Kiểu dữ liệu','source-type'],['target','Nhập vào danh mục','source-target'],['selector','CSS Selector (HTML)','text'],['sourceName','Tên hiển thị nguồn','text'],['limit','Số mục tối đa/lượt (1-50)','number'],['enabled','Tự đồng bộ hàng ngày','checkbox'],['autoPublish','Tự động công bố (nên tắt)','checkbox'],['allowUpdate','Cho phép nguồn ghi đè bản ghi đã có','checkbox']]
};
function pickGrid(type,selected,max=3){const list=items(type);const values=Array.isArray(selected)?selected:selected?[selected]:[];
 return `<div class="selected-count">Đã chọn ${values.length}/${max}${type==='legends'?' (tối đa 1)':''} · nhấn ảnh để chọn/bỏ chọn</div><div class="items-picks" data-picker="${type}">${list.length?list.map(x=>`<button type="button" class="pick ${values.includes(x.id)?'selected':''}" data-action="pick" data-type="${type}" data-id="${esc(x.id)}" data-max="${max}" aria-pressed="${values.includes(x.id)}">${sanitizeUrl(x.image)?`<img data-avatar src="${esc(sanitizeUrl(x.image))}" alt="">`:`<span class="fallback-art">${esc(first(x.name))}</span>`}<span>${esc(truncate(x.name,40))}</span></button>`).join(''):`<div class="notice">Chưa có dữ liệu ${esc(labels[type])}. Hãy thêm trong quản trị trước.</div>`}</div>`;
}
function fieldHTML([key,label,type,max],row){const value=row[key]??'';const required=['name','title'].includes(key)?'required':'';
 if(type==='checkbox')return `<div class="form-group span"><label class="check"><input name="${key}" type="checkbox" ${value?'checked':''}> ${esc(label)}</label></div>`;
 if(['equipment','monsterlings','characters','legends'].includes(type)){
   const selected=key==='legendId'?value||'':Array.isArray(value)?value:[];
   state.pick[key]=selected;
   return `<div class="form-group span"><label>${esc(label)}</label><div data-pick-key="${key}" data-pick-type="${type}" data-pick-max="${max||3}">${pickGrid(type,selected,max||3)}</div></div>`;
 }
 if(type==='charselect')return `<div class="form-group"><label>${esc(label)}</label><select name="${key}" required><option value="">Chọn nhân vật</option>${items('characters').map(x=>`<option value="${esc(x.id)}" ${value===x.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></div>`;
 if(type==='source-type')return `<div class="form-group"><label>${esc(label)}</label><select name="${key}">${['rss','atom','json','html'].map(x=>`<option value="${x}" ${value===x?'selected':''}>${x.toUpperCase()}</option>`).join('')}</select></div>`;
 if(type==='source-target')return `<div class="form-group"><label>${esc(label)}</label><select name="${key}">${ADMIN_TYPES.filter(x=>x[0]!=='sources').map(([k,n])=>`<option value="${k}" ${value===k?'selected':''}>${esc(n)}</option>`).join('')}</select></div>`;
 if(type==='textarea')return `<div class="form-group span"><label>${esc(label)}</label><textarea name="${key}" rows="4" ${required}>${esc(value)}</textarea></div>`;
 return `<div class="form-group ${key==='image'||key==='source'||key==='url'?'span':''}"><label>${esc(label)}</label><input name="${key}" type="${type}" value="${esc(value)}" ${required} ${type==='number'?'min="0" max="50"':''} placeholder="${esc(label)}"></div>`;
}
function openEditor(type,id=''){if(!state.admin)return loginModal();const row=id?lookup(type,id):null;state.editing={type,id};state.pick={};
 const seed=type==='sources'?{type:'rss',target:'news',limit:20,enabled:false,autoPublish:false,published:true}:type==='teams'?{characterIds:[],published:true}:type==='builds'?{gearIds:[],monsterlingIds:[],published:true}:{published:true};
 const data={...seed,...(row||{})};const fields=editorFields[type]||[];
 showModal(`<div class="dialog-top"><h2>${id?'Sửa':'Thêm'} ${esc(labels[type])}</h2><button class="close" data-action="close">×</button></div><form id="editor-form"><div class="formgrid">${fields.map(f=>fieldHTML(f,data)).join('')}${type!=='sources'?`<div class="form-group span"><label class="check"><input name="published" type="checkbox" ${data.published!==false?'checked':''}> Công bố nội dung cho người xem</label></div>`:''}</div><div class="dialog-actions"><button type="button" class="btn ghost" data-action="close">Hủy</button><button type="submit" class="btn primary">Lưu vào dữ liệu chung</button></div></form>`);
 // fieldHTML sets pick, but showModal only clears prior state at entry; recover selections here
 for(const [k] of fields)if(['characterIds','gearIds','monsterlingIds','legendId'].includes(k))state.pick[k]=data[k]??(k==='legendId'?'':[]);
}
function adminPage(){const type=state.adminType;const side=ADMIN_TYPES.map(([k,n])=>`<button class="${type===k?'active':''}" data-action="admin-tab" data-type="${k}">${esc(n)} <span class="small">${items(k).length}</span></button>`).join('')+`<button class="${type==='settings'?'active':''}" data-action="admin-tab" data-type="settings">⚙ Sao lưu & bảo mật</button>`;
 const body=type==='settings'?settingsPage():`<div class="admintop"><div><h2 style="margin:0">${esc(labels[type])}</h2><div class="small">${items(type).length} bản ghi · Lưu trực tiếp tại Netlify</div></div><button class="btn primary" data-action="add" data-type="${type}">+ Thêm mới</button></div>${type==='sources'?'<div class="alert">Chỉ bật đồng bộ tự động sau khi đã thử nguồn. RSS/Atom hoặc API JSON ổn định nhất; trang HTML có thể đổi cấu trúc hoặc chặn truy cập.</div>':''}<div class="adminlist"><table class="admingrid"><thead><tr><th>Nội dung</th><th>Trạng thái</th><th>Cập nhật / nguồn</th><th>Thao tác</th></tr></thead><tbody>${items(type).length?items(type).map(x=>`<tr><td><b>${esc(truncate(x.name||x.title,70))}</b>${x.lastError?`<div class="small" style="color:#f8aabb">${esc(truncate(x.lastError,100))}</div>`:''}</td><td><span class="status ${x.published===false||type==='sources'&&!x.enabled?'off':''}">${type==='sources'?(x.enabled?'Đã bật':'Tắt'):(x.published===false?'Bản nháp':'Công khai')}</span></td><td class="small">${esc(type==='sources'?x.lastSync||'Chưa đồng bộ':x.updatedAt?.slice(0,10)||x.date||x.sourceName||'—')}</td><td><div class="source-action"><button class="mini-btn" data-action="edit" data-type="${type}" data-id="${esc(x.id)}">Sửa</button>${type==='sources'?`<button class="mini-btn" data-action="source-preview" data-id="${esc(x.id)}">Thử</button><button class="mini-btn" data-action="source-sync" data-id="${esc(x.id)}">Đồng bộ</button>`:''}<button class="mini-btn" style="color:#ffb5bd" data-action="delete" data-type="${type}" data-id="${esc(x.id)}">Xóa</button></div></td></tr>`).join(''):'<tr><td colspan="4" class="muted">Chưa có bản ghi</td></tr>'}</tbody></table></div>`;
 return `<div class="pagehead"><div class="eyebrow">CONTROL PANEL</div><h2>Quản trị MONGIL Atlas</h2><p>Chỉ người đăng nhập mới có quyền thêm, sửa, xóa, xuất bản và cập nhật nguồn dữ liệu.</p>${state.defaultCredential?'<div class="alert">Đang dùng mật khẩu mặc định admin/admin. Vui lòng đổi mật khẩu trong mục Bảo mật trước khi chia sẻ website.</div>':''}</div><div class="adminlayout"><aside class="adminside">${side}</aside><section>${body}</section></div>`;
}
function settingsPage(){return `<h2>Sao lưu & bảo mật</h2><div class="pane" style="padding:23px;margin-bottom:18px"><h3>Đổi mật khẩu quản trị</h3><p class="notice">Mật khẩu mới tối thiểu 10 ký tự. Tất cả phiên đăng nhập cũ sẽ bị vô hiệu hóa.</p><form id="password-form" class="formgrid"><div class="form-group"><label>Mật khẩu hiện tại</label><input name="oldPassword" type="password" required></div><div class="form-group"><label>Mật khẩu mới</label><input name="newPassword" type="password" minlength="10" required></div><div class="form-group span"><button class="btn primary">Đổi mật khẩu</button></div></form></div><div class="pane" style="padding:23px"><h3>Sao lưu / phục hồi dữ liệu</h3><p>Xuất toàn bộ nhân vật, build, đội hình, tin tức, Monsterling, trang bị, Monster Legend, nguồn lấy tin và cả bản nháp thành JSON. Mật khẩu không được xuất.</p><div class="actions"><button class="btn" data-action="export">↓ Tải sao lưu JSON</button></div><form id="import-form"><div class="form-group"><label>Chọn file sao lưu .json</label><input type="file" name="file" class="inputfile" accept=".json,application/json" required></div><div class="form-group" style="margin-top:10px"><label class="check"><input type="checkbox" name="replace"> Ghi đè toàn bộ danh mục có trong tệp (cẩn trọng)</label></div><button class="btn primary" style="margin-top:15px">Nhập bản sao lưu</button></form></div><div class="pane" style="padding:23px;margin-top:18px"><h3>Đồng bộ các nguồn đang bật</h3><p>Kiểm tra các nguồn RSS/Atom/JSON/HTML đã khai báo; mục nhập mới sẽ ở trạng thái nháp nếu nguồn không bật tự công bố.</p><button class="btn" data-action="sync-all">↻ Đồng bộ ngay</button><div id="sync-result"></div></div>`}
async function submitEditor(form){if(!state.editing)return;const {type,id}=state.editing;const fd=new FormData(form);const rec={id:id||genId(type)};
 for(const [name,,field] of editorFields[type]){
   if(field==='checkbox')rec[name]=fd.has(name);
   else if(['equipment','monsterlings','characters','legends'].includes(field))rec[name]=state.pick[name]??(name==='legendId'?'':[]);
   else if(field==='number')rec[name]=Number(fd.get(name)||0);
   else rec[name]=String(fd.get(name)||'').trim();
 }
 if(type!=='sources')rec.published=fd.has('published');
 if(type==='teams'&&rec.characterIds.length!==3)throw Error('Đội hình phải chọn đúng 3 nhân vật');
 if(type==='builds'&&!rec.characterId)throw Error('Build phải chọn một nhân vật');
 const button=form.querySelector('button[type="submit"]');button.disabled=true;
 try{await api('record',{action:'save',type,record:rec});closeModal();await refresh(true);toast('Đã lưu dữ liệu lên máy chủ, mọi người có thể xem nội dung đã công bố.');}finally{button.disabled=false}
}
function updatePicker(root){const key=root.dataset.pickKey,type=root.dataset.pickType,max=Number(root.dataset.pickMax||3);root.innerHTML=pickGrid(type,state.pick[key],max)}
function updateListArea(){if($('#list-area'))$('#list-area').innerHTML=listArea(state.page)}
async function downloadBackup(){const response=await api('export');const blob=new Blob([JSON.stringify(response,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='mongil-atlas-backup-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1200);toast('Đã tạo tệp sao lưu JSON')}
async function sync(id){toast('Đang đọc nguồn bên ngoài...');const result=await api('sync',id?{id}:{});await refresh(true);const message=result.results?.map(x=>`${x.name}: ${x.error?'Lỗi '+x.error:`${x.added||0} mục mới, ${x.updated||0} cập nhật`}`).join(' | ')||'Không có nguồn nào đang bật';toast(message);if($('#sync-result'))$('#sync-result').textContent=message}
async function preview(id){toast('Đang thử đọc nguồn bên ngoài...');const result=await api('preview',{id});const text=result.items.length?JSON.stringify(result.items.slice(0,8).map(x=>({title:x.title||x.name,url:x.url,published:x.published})),null,2):'Nguồn không trả về mục dữ liệu phù hợp. Hãy kiểm tra URL, định dạng và CSS selector.';showModal(`<div class="dialog-top"><h2>Xem thử dữ liệu ngoài (${result.items.length} mục)</h2><button class="close" data-action="close">×</button></div><p>Đây là bản xem thử; chưa ghi dữ liệu vào hệ thống.</p><pre class="source-out">${esc(text)}</pre><div class="dialog-actions"><button class="btn ghost" data-action="close">Đóng</button><button class="btn primary" data-action="source-sync" data-id="${esc(id)}">Đồng bộ dữ liệu này</button></div>`)}
// Xử lý tập trung để các thẻ HTML sinh động không bị mất sự kiện sau render.
document.addEventListener('click',async e=>{
 const el=e.target.closest('[data-action],[data-go]');if(!el)return;
 const action=el.dataset.action;
 if(el.dataset.go){navigate(el.dataset.go);return}
 try{
  if(action==='close'){closeModal();return}
  if(action==='open-login'){loginModal();return}
  if(action==='logout'){await api('logout',{});state.admin=false;state.defaultCredential=false;state.page='home';location.hash='home';await refresh(true);toast('Đã đăng xuất');return}
  if(action==='fav'){const id=el.dataset.id;state.saved.has(id)?state.saved.delete(id):state.saved.add(id);try{localStorage.setItem('atlas-favorites',JSON.stringify([...state.saved]))}catch{}render();return}
  if(action==='view'){details(el.dataset.type,el.dataset.id);return}
  if(action==='clear-filter'){state.filter='';state.element='';state.role='';render();return}
  if(action==='admin-tab'){state.adminType=el.dataset.type;render();return}
  if(action==='add'){openEditor(el.dataset.type);return}
  if(action==='edit'){openEditor(el.dataset.type,el.dataset.id);return}
  if(action==='delete'){
   const row=lookup(el.dataset.type,el.dataset.id);
   if(!confirm(`Xóa vĩnh viễn "${row?.name||row?.title||'bản ghi'}"? Hành động này ảnh hưởng đến tất cả người xem.`))return;
   await api('record',{action:'delete',type:el.dataset.type,id:el.dataset.id});await refresh(true);toast('Đã xóa bản ghi');return;
  }
  if(action==='pick'){
   const root=el.closest('[data-pick-key]');if(!root)return;
   const key=root.dataset.pickKey,max=Number(root.dataset.pickMax||3);
   let value=state.pick[key];let arr=Array.isArray(value)?value.slice():value?[value]:[];
   if(arr.includes(el.dataset.id))arr=arr.filter(x=>x!==el.dataset.id);
   else{if(arr.length>=max){toast(`Chỉ được chọn tối đa ${max} mục`,true);return}arr.push(el.dataset.id)}
   state.pick[key]=key==='legendId'?arr[0]||'':arr;updatePicker(root);return;
  }
  if(action==='export'){await downloadBackup();return}
  if(action==='sync-all'){await sync();return}
  if(action==='source-sync'){const id=el.dataset.id;closeModal();await sync(id);return}
  if(action==='source-preview'){await preview(el.dataset.id);return}
 }catch(error){toast(error.message||'Thao tác không thành công',true);console.error(error)}
});
document.addEventListener('input',e=>{if(e.target.id==='list-search'){state.filter=e.target.value;updateListArea()}});
document.addEventListener('change',e=>{if(e.target.id==='filter-element'){state.element=e.target.value;updateListArea()}if(e.target.id==='filter-role'){state.role=e.target.value;updateListArea()}});
document.addEventListener('submit',async e=>{
 const form=e.target;if(!['login-form','editor-form','password-form','import-form'].includes(form.id))return;e.preventDefault();
 const submit=form.querySelector('[type="submit"],button:not([type])');if(submit)submit.disabled=true;
 try{
  if(form.id==='login-form'){
   const f=new FormData(form);const result=await api('login',{username:f.get('username'),password:f.get('password')});state.admin=true;state.defaultCredential=result.defaultCredential;closeModal();state.page='admin';location.hash='admin';await refresh(true);toast('Đăng nhập quản trị thành công');
  }
  if(form.id==='editor-form')await submitEditor(form);
  if(form.id==='password-form'){
   const f=new FormData(form);await api('password',{oldPassword:f.get('oldPassword'),newPassword:f.get('newPassword')});state.defaultCredential=false;form.reset();toast('Đổi mật khẩu thành công; phiên đăng nhập cũ đã bị vô hiệu hóa');render();
  }
  if(form.id==='import-form'){
   const file=new FormData(form).get('file');if(!(file instanceof File)||!file.size)throw Error('Chọn tệp sao lưu hợp lệ');
   if(file.size>1000000)throw Error('Tệp sao lưu quá lớn (trên 1MB)');
   const contents=JSON.parse(await file.text());const data=contents.data||contents;
   const replace=form.querySelector('[name="replace"]').checked;
   if(!confirm(replace?'GHI ĐÈ dữ liệu các danh mục trong tệp? Hãy sao lưu trước khi tiếp tục.':'Nhập bản ghi từ tệp và cập nhật bản ghi có cùng ID?'))return;
   const res=await api('import',{data,replace});await refresh(true);toast(`Đã nhập ${res.count} bản ghi`);
  }
 }catch(error){toast(error.message||'Thao tác không thành công',true);console.error(error)}finally{if(submit&&submit.isConnected)submit.disabled=false}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
document.addEventListener('click',e=>{if(e.target.id==='modal-overlay')closeModal()});
document.addEventListener('error',e=>{if(e.target.matches?.('img[data-avatar]')){const img=e.target;const parent=img.parentElement;img.remove();const fallback=parent?.querySelector('.fallback-art,.visual-fallback');if(fallback)fallback.hidden=false}},true);
window.addEventListener('hashchange',()=>{const page=location.hash.slice(1);if(page&&page!==state.page){if(page==='admin'&&!state.admin){loginModal();return}state.page=TABS.some(x=>x[0]===page)||page==='admin'?page:'home';render()}});
async function start(){
 try{
  const result=await api('data');state.data=result.data;state.admin=result.admin;
  state.page=location.hash.slice(1)||'home';if(!TABS.some(x=>x[0]===state.page)&&state.page!=='admin')state.page='home';
  if(state.page==='admin'&&!state.admin)state.page='home';
  if(state.admin){const session=await api('session');state.defaultCredential=!!session.defaultCredential;}
  render();
 }catch(e){app.innerHTML=`<div class="container" style="padding-top:90px"><div class="banner"><h1 style="font-size:32px">Chưa kết nối được máy chủ dữ liệu</h1><p>${esc(e.message)}</p><p>Website cần được triển khai đầy đủ Netlify Functions và Netlify Blobs. Không thể chạy đầy đủ nếu chỉ kéo thư mục HTML vào Netlify Drop.</p><button class="btn primary" onclick="location.reload()">Thử lại</button></div></div>`;}
}
start();
})();
