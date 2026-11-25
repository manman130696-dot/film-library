/* Visual resources are independent of the film archive. */
(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let entries = [], use = 'all', timer, opener;
  const clock = t => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  function render() {
    const query = $('#style-search').value.trim().toLowerCase();
    const visible = entries.filter(e => (use === 'all' || e.uses.includes(use)) && (!query || [e.title,e.summary,e.prompt,e.broll,...e.uses,...e.samples.map(s=>s.title+' '+s.description)].join(' ').toLowerCase().includes(query)));
    $('#reference-count').textContent = `${visible.length} 组风格 · ${visible.reduce((sum,e)=>sum+e.samples.length,0)} 张参考图`;
    $('#reference-empty').hidden = visible.length > 0;
    $('#reference-list').innerHTML = visible.map(e => `<article class="style-collection" id="${esc(e.id)}">
      <header class="collection-heading"><div><p class="tools-kicker">${esc(e.sourceType)} · 风格图集</p><h2>${esc(e.title)}</h2></div><div class="usage-tags">${e.uses.map(t=>`<span>${esc(t === 'B镜'?'B 镜':t)}</span>`).join('')}</div></header>
      <section class="collection-description" aria-label="风格简介与提示词"><div class="description-lead"><div><h3>简介</h3><p>${esc(e.summary)}</p><a class="source-time" href="#gallery-${esc(e.id)}">查看 ${e.samples.length} 张风格画面</a></div><img src="${esc(e.samples[0].image)}" alt="地标冰箱贴与实景配对的风格示例"></div>
        <div class="prompt-heading"><h4>图片制作提示词</h4><button type="button" class="button button-outline" data-copy="${esc(e.id)}" data-kind="prompt">复制图片提示词</button></div><p class="reference-prompt" data-prompt="${esc(e.id)}">${esc(e.prompt)}</p>
        <div class="borrow-notes"><section><h4>B 镜怎么借用</h4><p>${esc(e.broll)}</p></section><section><h4>综艺动效怎么借用</h4><p>${esc(e.variety)}</p></section></div>
        <div class="prompt-heading"><h4>B 镜制作提示词 · 新作建议</h4><button type="button" class="button button-outline" data-copy="${esc(e.id)}" data-kind="brollPrompt">复制 B 镜提示词</button></div><p class="reference-prompt">${esc(e.brollPrompt)}</p>
      </section>
      <div class="gallery-heading" id="gallery-${esc(e.id)}"><h3>风格画面</h3><p>点击图片放大 · 同一版式的不同配色</p></div><div class="style-gallery">${e.samples.map(s=>`<figure><button type="button" class="sample-image" data-image="${esc(e.id)}" data-sample="${esc(s.id)}" aria-label="放大${esc(s.title)}"><img loading="lazy" src="${esc(s.image)}" alt="${esc(s.title)}：上部地标贴纸，下部实景照片"></button><figcaption><h4>${esc(s.title)}</h4><p>${esc(s.description)}</p><button type="button" class="source-time" data-seek="${s.time}" data-entry="${esc(e.id)}">回看来源 ${clock(s.time)}</button></figcaption></figure>`).join('')}</div>
      <details class="source-details"><summary>查看技巧视频与拉片记录</summary><p>${esc(e.note)}</p><video id="video-${esc(e.id)}" controls playsinline preload="none" poster="${esc(e.samples[0].image)}" src="${esc(e.video)}" aria-label="${esc(e.title)}完整技巧视频"></video><p><a class="button button-outline" href="${esc(e.report)}" target="_blank" rel="noopener">打开详细拉片</a></p><p class="source-note">原混音保留，声音未实际听辨。成品以静态卡片为主，B 镜和贴纸入场为新增设计建议。</p></details>
    </article>`).join('');
  }
  function toast(message) { $('#reference-toast').textContent = message; $('#reference-toast').classList.add('visible'); clearTimeout(timer); timer = setTimeout(()=>$('#reference-toast').classList.remove('visible'),2600); }
  async function copy(text, button) {
    try { await navigator.clipboard.writeText(text); toast('提示词已复制'); }
    catch {
      const area = document.createElement('textarea'); area.value = text; area.style.cssText = 'position:fixed;left:-9999px'; document.body.append(area); area.select();
      const ok = document.execCommand('copy'); area.remove(); button.focus(); toast(ok?'提示词已复制':'复制未成功，请选择简介中的文字复制');
    }
  }
  $('#style-search').addEventListener('input',render);
  document.querySelectorAll('[data-use]').forEach(button=>button.addEventListener('click',()=>{use=button.dataset.use;document.querySelectorAll('[data-use]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));render();}));
  $('#reset-references').addEventListener('click',()=>{use='all';$('#style-search').value='';document.querySelectorAll('[data-use]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.use==='all')));render();});
  $('#reference-list').addEventListener('click',event=>{
    const button=event.target.closest('button'); if(!button)return;
    if(button.dataset.copy){const e=entries.find(e=>e.id===button.dataset.copy);copy(e[button.dataset.kind],button);}
    if(button.dataset.image){const e=entries.find(e=>e.id===button.dataset.image),s=e.samples.find(s=>s.id===button.dataset.sample);opener=button;$('#image-title').textContent=s.title;$('#image-full').src=s.image;$('#image-full').alt=s.title+'教程原画面';$('#image-caption').textContent=s.description+' · '+e.note;$('#image-dialog').showModal();}
    if(button.dataset.seek){const video=$('#video-'+button.dataset.entry);video.closest('details').open=true;const seek=()=>{video.currentTime=Number(button.dataset.seek);video.play().catch(()=>toast('请点击视频播放按钮'));};if(video.readyState)seek();else{video.addEventListener('loadedmetadata',seek,{once:true});video.load();}video.scrollIntoView({behavior:'smooth',block:'center'});}
  });
  $('#close-image').addEventListener('click',()=>$('#image-dialog').close());
  $('#image-dialog').addEventListener('click',e=>{if(e.target===$('#image-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close();}});
  $('#image-dialog').addEventListener('close',()=>opener?.focus());
  window.STYLE_REFERENCES_READY = fetch('style-references/references.json').then(r=>{if(!r.ok)throw Error('HTTP '+r.status);return r.json();}).then(data=>{entries=data.entries;render();return data;}).catch(()=>{$('#reference-count').textContent='风格参考暂时无法载入';$('#reference-error').hidden=false;$('#reference-error').textContent='请刷新页面重试。';});
})();
