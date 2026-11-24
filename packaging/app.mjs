import {buildCatalog,Session,validateDirections,makePrompt,clock} from './core.mjs';
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const session=new Session();
const source=$('#source'),reference=$('#reference-video');
let catalog=[],catalogReady=false,sourceURL='',duration=0,worker=null,runId=0,busy=false,frames=[],observations=[],lastNote='',lastRange=null,referenceCase=null,toastTimer;
const workerCase=c=>Object.fromEntries(['id','title','structure','typography','motion','why','apply','searchText'].map(k=>[k,c[k]||'']));
const findCase=id=>catalog.find(c=>c.id===id);
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function message(title,text,error=false){$('#message-panel').hidden=false;$('#message-panel').classList.toggle('error',error);$('#message-title').textContent=title;$('#message-text').textContent=text;}
function steps(stage){['input','directions','design','prompt'].forEach((name,index)=>{const li=$('#step-'+name);li.classList.toggle('current',index===stage);li.classList.toggle('done',index<stage);});}
function clearPrompt(){$('#prompt').value='';$('#prompt-panel').hidden=true;$('#generate-prompt').disabled=!session.isConfirmed()||busy;$('#confirmation-status').textContent=session.isConfirmed()?'方案已确定':'待确定';$('#confirmation-status').classList.toggle('confirmed',session.isConfirmed());}
function updateButtons(){
  $('#analyze').disabled=!sourceURL||!duration||!catalogReady||!catalog.length||busy;
  $('#finish').disabled=!sourceURL;
  for(const element of document.querySelectorAll('#design-form input,#design-form textarea,#feedback,#revise,#confirm,#tool'))element.disabled=busy;
  for(const element of document.querySelectorAll('[data-select]'))element.disabled=busy;
  $('#generate-prompt').disabled=!session.isConfirmed()||busy;
}
function stopWorker(){runId++;worker?.terminate();worker=null;busy=false;$('#progress-panel').hidden=true;updateButtons();}
function clearResults(){session.reset();frames=[];observations=[];lastNote='';lastRange=null;$('#directions').replaceChildren();$('#directions-panel').hidden=true;$('#editor-panel').hidden=true;$('#observations-panel').hidden=true;$('#frames').replaceChildren();$('#feedback').value='';$('#design-form').replaceChildren();clearPrompt();steps(0);}
function clearSession(showMessage=true){
  stopWorker();clearResults();source.pause();source.removeAttribute('src');source.load();if(sourceURL)URL.revokeObjectURL(sourceURL);sourceURL='';duration=0;$('#clip').value='';$('#note').value='';$('#tool').value='';$('#source-wrap').hidden=true;$('#source-meta').textContent='';$('#file-label').textContent='仅在本机';$('#range-start').value=0;$('#range-end').value=15;
  closeReference();updateButtons();
  if(showMessage)message('本次分析已结束','片段、截图、说明和方案已从本次会话清除。需要时可以重新投入片段。');
}
function waitEvent(target,name,timeout=15000){return new Promise((resolve,reject)=>{
  const cleanup=()=>{clearTimeout(timer);target.removeEventListener(name,done);target.removeEventListener('error',fail);};
  const done=()=>{cleanup();resolve();};const fail=()=>{cleanup();reject(Error('视频无法解码，请使用浏览器可播放的 MP4（H.264）或 WebM 文件。'));};
  const timer=setTimeout(()=>{cleanup();reject(Error('视频读取超时，请检查文件是否可播放后重试。'));},timeout);
  target.addEventListener(name,done,{once:true});target.addEventListener('error',fail,{once:true});
});}
async function chooseFile(file){
  if(!file)return;
  if(!file.type.startsWith('video/')&&!/\.(mp4|mov|webm|m4v)$/i.test(file.name)){toast('请选择一个视频文件。');return;}
  clearSession(false);const token=runId;sourceURL=URL.createObjectURL(file);$('#finish').disabled=false;
  $('#file-label').textContent='本次投入';$('#source-wrap').hidden=false;$('#source-meta').textContent=file.name+' · '+(file.size/1024/1024).toFixed(1)+' MB';
  message('正在读取你的片段','文件仅在本机打开，不会上传。');
  try{
    const loaded=waitEvent(source,'loadedmetadata');source.src=sourceURL;source.load();await loaded;if(token!==runId)return;
    duration=source.duration;if(!Number.isFinite(duration)||duration<=0)throw Error('无法测量这个视频的时长，请转换为普通 MP4 后再试。');
    $('#range-start').max=duration.toFixed(2);$('#range-end').max=duration.toFixed(2);$('#range-end').value=Math.min(duration,15).toFixed(2);
    $('#source-meta').textContent+=' · '+clock(duration);
    message('片段准备好了','可选填希望观众看懂的重点，再开始找包装方向。');updateButtons();
  }catch(e){if(token===runId)message('片段未能读取',e.message,true);}
}
function getRange(){
  const start=Number($('#range-start').value),end=Number($('#range-end').value);
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end>duration+0.02||end<=start)throw Error('请填写有效的开始和结束时间，且结束时间不能超过视频时长。');
  if(end-start>30.01)throw Error('每次最多分析 30 秒，请缩小所选范围。');
  return {start,end};
}
async function seekSource(time){source.pause();if(Math.abs(source.currentTime-time)<0.02&&source.readyState>=2)return;const seeked=waitEvent(source,'seeked');source.currentTime=time;await seeked;if(source.readyState<2)await waitEvent(source,'loadeddata');}
async function sampleFrames(range,token){
  const count=range.end-range.start>15?5:3;const out=[];
  const canvas=document.createElement('canvas');const scale=Math.min(1,640/Math.max(source.videoWidth,source.videoHeight));
  canvas.width=Math.max(1,Math.round(source.videoWidth*scale));canvas.height=Math.max(1,Math.round(source.videoHeight*scale));
  const ctx=canvas.getContext('2d',{alpha:false});
  for(let i=0;i<count;i++){
    const time=range.start+(range.end-range.start)*(i+.5)/count;
    await seekSource(time);if(token!==runId)throw Error('分析已取消。');
    ctx.drawImage(source,0,0,canvas.width,canvas.height);out.push({time,image:canvas.toDataURL('image/jpeg',.82)});
  }
  canvas.width=0;canvas.height=0;return out;
}
function renderFrames(){
  $('#observations-panel').hidden=!frames.length;$('#observation-count').textContent=frames.length+' 张关键画面';
  $('#frames').innerHTML=frames.map((f,i)=>`<figure class="frame"><button type="button" data-frame="${i}" aria-label="回看原片 ${clock(f.time)}"><img src="${f.image}" alt="本次投入片段 ${clock(f.time)} 的关键画面"></button><figcaption><time>${clock(f.time)}</time>${esc(observations[i]?.text||'等待本机识别…')}</figcaption></figure>`).join('');
}
function setBusy(value){busy=value;$('#progress-panel').hidden=!value;if(value){$('#message-panel').hidden=true;$('#progress-text').textContent='准备本机分析…';}updateButtons();}
function ensureWorker(){
  if(worker)return worker;
  worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});
  worker.onerror=()=>{if(!busy)return;stopWorker();message('本机分析未能启动','模型脚本或浏览器运行环境不可用。请检查网络、释放内存后重试；这里不会切换到收费服务。',true);};
  return worker;
}
function requestWorker(type,input){
  const id=++runId;const active=ensureWorker();setBusy(true);
  return new Promise((resolve,reject)=>{
    active.onmessage=({data})=>{if(data.id!==id||id!==runId)return;
      if(data.type==='progress'){$('#progress-text').textContent=data.message;return;}
      setBusy(false);if(data.type==='error')reject(Error(String(data.message).slice(0,600)));else resolve(data.result);
    };
    active.onerror=()=>{if(id!==runId)return;active.terminate();worker=null;setBusy(false);reject(Error('本机模型运行中断，请检查浏览器支持、网络和可用内存后重试。'));};
    active.postMessage({id,type,input});
  });
}
async function startAnalysis(){
  let range;
  try{range=getRange();}catch(e){toast(e.message);return;}
  stopWorker();clearResults();let token=runId;lastNote=$('#note').value.trim();lastRange=range;setBusy(true);
  try{
    $('#progress-text').textContent='在本机抽取所选范围的关键画面…';frames=await sampleFrames(range,token);if(token!==runId)return;renderFrames();
    const pending=requestWorker('analyze',{frames,range,note:lastNote,catalog:catalog.map(workerCase)});token=runId;const result=await pending;
    // A cancelled request never resolves, and cannot render into a new session.
    observations=result.observations;renderFrames();session.setDirections(result.directions);renderDirections();steps(1);
    if(!result.directions.length)message('没有找到合适的包装案例','当前片库没有找到适合这个片段的包装案例，不凑方向。你也可以补充说明，或换一个分析范围再试。');
    else $('#message-panel').hidden=true;
  }catch(e){if(token===runId&&sourceURL){setBusy(false);message('本次分析没有完成',e.message,true);}}
}
function renderDirections(){
  $('#directions-panel').hidden=!session.directions.length;$('#direction-count').textContent=session.directions.length+' 个';
  $('#directions').innerHTML=session.directions.map((d,index)=>{
    const c=findCase(d.caseId);if(!c)return '';
    return `<article class="direction-card ${session.selected===index?'selected':''}"><header class="direction-header"><div><h3>${esc(d.title)}</h3><p>本片落点 ${clock(d.start)}—${clock(d.end)}</p></div><button type="button" class="button ${session.selected===index?'primary':'quiet'}" data-select="${index}">${session.selected===index?'已选择':'选这个方向'}</button></header><div class="direction-body"><div class="rationale"><div><span class="mini-label">帮助观众理解</span><p>${esc(d.understanding)}</p></div><div><span class="mini-label">增加一点趣味</span><p>${esc(d.fun)}</p></div></div><p class="application"><span class="mini-label">用在你的画面里 · 设计建议</span>${esc(d.application)}</p><div class="reference-card">${c.image?`<img loading="lazy" src="${esc(c.image)}" alt="${esc(c.title)}原片画面">`:''}<div class="reference-info"><span class="mini-label">片库真实对标</span><strong>${esc(c.title)}</strong><p>${esc(c.videoTitle)}<br>${clock(c.start)}—${clock(c.end)}</p></div><button class="button quiet" type="button" data-reference="${esc(c.id)}">播放对标片段</button></div><details><summary>看原片依据与具体做法</summary><p><strong>原案例画面</strong><br>${esc(c.structure)}</p><p><strong>原案例运动</strong><br>${esc(c.motion)}</p><p><strong>案例作用</strong><br>${esc(c.why)}</p><p><strong>当前片段的元素</strong><br>${esc(d.elements)}</p><p><strong>当前片段的动作设计</strong><br>${esc(d.motion)}</p><p><strong>制作准备</strong><br>按方案拆出主体、文字及图形图层。难度取决于是否需要跟踪、抠像和逐帧调整；这里不承诺具体制作耗时。</p></details></div></article>`;
  }).join('');updateButtons();
}
const editorFields=[['title','方向名称',true],['understanding','希望观众理解什么',true],['fun','趣味点',true],['elements','视觉元素',false],['copy','精确文案（可以留空）',false],['placement','构图与主体保护',true],['motion','运动顺序与节奏',true],['application','如何适配当前画面',true]];
function renderEditor(){
  const d=session.current;$('#editor-panel').hidden=!d;if(!d)return;
  $('#design-form').innerHTML=`<label>落点开始（秒）<input name="start" type="number" min="${lastRange.start}" max="${lastRange.end}" step="0.1" value="${d.start}"></label><label>落点结束（秒）<input name="end" type="number" min="${lastRange.start}" max="${lastRange.end}" step="0.1" value="${d.end}"></label>`+editorFields.map(([key,label,full])=>`<label class="${full?'full':''}">${label}${key==='title'?`<input name="${key}" maxlength="1400" value="${esc(d[key])}">`:`<textarea rows="2" name="${key}" maxlength="1400">${esc(d[key])}</textarea>`}</label>`).join('');clearPrompt();updateButtons();
}
async function reviseDesign(){
  const feedback=$('#feedback').value.trim();if(!feedback){toast('先填写你想调整的内容。');return;}
  if(!session.current)return;session.edit({});clearPrompt();
  try{
    const result=await requestWorker('revise',{direction:session.current,caseRecord:workerCase(findCase(session.current.caseId)),feedback,range:lastRange,observations,note:lastNote});
    session.edit(result);renderDirections();renderEditor();$('#feedback').value='';toast('已调整，请回看并确定方案。');
  }catch(e){message('本次调整没有完成',e.message,true);}
}
function confirmDesign(){
  try{
    validateDirections(JSON.stringify({directions:[session.current]}),[findCase(session.current.caseId)],lastRange);
    session.confirm();clearPrompt();$('#confirm-help').textContent='方案已确定，可以输出制作提示词。';steps(3);toast('这份方案已确定。');
  }catch(e){toast(e.message);}
}
async function openReference(id){
  const c=findCase(id);if(!c)return;referenceCase=c;
  $('#reference-source').textContent=c.videoTitle;$('#reference-title').textContent=c.title;$('#reference-range').textContent=clock(c.start)+'—'+clock(c.end);
  $('#reference-dialog').showModal();
  try{const loaded=waitEvent(reference,'loadedmetadata');reference.src=c.preview;reference.load();await loaded;if(referenceCase!==c)return;if(c.end>reference.duration+.05)throw Error('这个对标范围超出实际预览，暂时不能作为可播放参考。');reference.currentTime=c.start;await reference.play().catch(()=>{});}catch(e){if(referenceCase===c)toast(e.message);}
}
function closeReference(){reference.pause();reference.removeAttribute('src');reference.load();referenceCase=null;if($('#reference-dialog').open)$('#reference-dialog').close();}
async function probePreview(url){
  const video=document.createElement('video');video.muted=true;video.preload='metadata';
  try{const loaded=waitEvent(video,'loadedmetadata',20000);video.src=url;video.load();await loaded;return video.duration;}
  catch{return 0;}finally{video.removeAttribute('src');video.load();}
}
async function loadCatalog(){
  try{
    await window.FILM_LIBRARY_READY;const result=buildCatalog(window.FILM_LIBRARY,window.FILM_ASSETS);
    if(!result.cases.length)throw Error('当前片库暂时没有具备可播放对标的包装案例；部分作品只有短预览，需要补齐资料。');
    $('#catalog-status').textContent='正在核验对标片段的可播放范围…';
    const media=[...new Set(result.cases.map(c=>c.preview))],actual=new Map();
    for(let i=0;i<media.length;i+=3){const urls=media.slice(i,i+3);const lengths=await Promise.all(urls.map(probePreview));urls.forEach((u,j)=>actual.set(u,lengths[j]));}
    catalog=result.cases.filter(c=>c.end<=(actual.get(c.preview)||0)+.02);
    if(!catalog.length)throw Error('对标视频未能读取，暂时无法核验片段。请检查网络后刷新；这不代表片库里没有合适案例。');
    catalogReady=true;const excluded=result.unavailable+result.cases.length-catalog.length;
    $('#catalog-status').textContent=`可对标的包装案例：${catalog.length} 个。${excluded?`另有 ${excluded} 个因预览范围或资料不足暂不参与推荐。`:''}`;updateButtons();
  }catch(e){$('#catalog-status').textContent='片库资料暂不可用：'+e.message;message('片库资料暂时无法就绪',e.message,true);}
}
$('#clip').addEventListener('change',e=>chooseFile(e.target.files[0]));
for(const type of ['dragenter','dragover'])$('#dropzone').addEventListener(type,e=>{e.preventDefault();$('#dropzone').classList.add('dragover');});
for(const type of ['dragleave','drop'])$('#dropzone').addEventListener(type,e=>{e.preventDefault();$('#dropzone').classList.remove('dragover');if(type==='drop')chooseFile(e.dataTransfer.files[0]);});
$('#analyze').addEventListener('click',startAnalysis);
$('#finish').addEventListener('click',()=>clearSession());
$('#cancel').addEventListener('click',()=>{stopWorker();message('分析已取消','片段仍在本机。可以调整范围或补充说明后重试。');});
$('#play-range').addEventListener('click',async()=>{try{const r=getRange();await seekSource(r.start);source.play().catch(()=>{});}catch(e){toast(e.message);}});
source.addEventListener('timeupdate',()=>{const end=Number($('#range-end').value);if(!busy&&Number.isFinite(end)&&source.currentTime>=end)source.pause();});
for(const id of ['range-start','range-end','note'])$('#'+id).addEventListener('input',()=>{if(session.directions.length||busy){stopWorker();clearResults();message('片段信息已修改','请重新分析，让设计方向与当前范围和说明保持一致。');}});
$('#frames').addEventListener('click',e=>{const b=e.target.closest('[data-frame]');if(b&&frames[Number(b.dataset.frame)])seekSource(frames[Number(b.dataset.frame)].time).catch(e=>toast(e.message));});
$('#directions').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.reference)openReference(b.dataset.reference);else if(b.dataset.select!==undefined){session.select(Number(b.dataset.select));renderDirections();renderEditor();$('#confirm-help').textContent='确定后才可以出提示词。';steps(2);$('#editor-panel').scrollIntoView({behavior:'smooth',block:'start'});}});
$('#design-form').addEventListener('submit',e=>e.preventDefault());
$('#design-form').addEventListener('input',e=>{if(!e.target.name)return;session.edit({[e.target.name]:['start','end'].includes(e.target.name)?Number(e.target.value):e.target.value});clearPrompt();$('#confirm-help').textContent='方案已修改，请重新确定。';steps(2);});
$('#design-form').addEventListener('change',renderDirections);
$('#revise').addEventListener('click',reviseDesign);
$('#confirm').addEventListener('click',confirmDesign);
$('#tool').addEventListener('input',clearPrompt);
$('#generate-prompt').addEventListener('click',()=>{if(!session.isConfirmed())return;$('#prompt').value=makePrompt(session.current,findCase(session.current.caseId),$('#tool').value.trim());$('#prompt-panel').hidden=false;$('#prompt-panel').scrollIntoView({behavior:'smooth',block:'start'});});
$('#copy-prompt').addEventListener('click',async()=>{try{await navigator.clipboard.writeText($('#prompt').value);toast('提示词已复制。');}catch{$('#prompt').focus();$('#prompt').select();toast('已选中提示词，可手动复制。');}});
$('#close-reference').addEventListener('click',closeReference);
$('#reference-dialog').addEventListener('cancel',()=>{reference.pause();});
$('#reference-dialog').addEventListener('close',()=>{reference.pause();reference.removeAttribute('src');reference.load();referenceCase=null;});
$('#replay-reference').addEventListener('click',()=>{if(referenceCase){reference.currentTime=referenceCase.start;reference.play().catch(()=>{});}});
reference.addEventListener('timeupdate',()=>{if(referenceCase&&reference.currentTime>=referenceCase.end)reference.pause();});
window.addEventListener('pagehide',()=>clearSession(false));
window.addEventListener('pageshow',e=>{
  if(e.persisted){clearSession(false);message('本次分析已清除','返回页面不会恢复之前投入的片段，请重新选择。');}
  else if(!sourceURL)for(const id of ['clip','note','feedback','tool'])$('#'+id).value='';
});
clearSession(false);
loadCatalog();
