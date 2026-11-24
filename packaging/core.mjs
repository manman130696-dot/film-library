const packagingPattern = /包装|花字|图形|字幕|贴纸|拼贴|抠像|字卡|标题|版式|边框|动效|MG|标注|图解|界面|视窗|窗口|照片墙|动态图/i;
const textFields = ['title','understanding','fun','elements','placement','motion','application'];
export function buildCatalog(data, assets={}) {
  if (!Array.isArray(data?.videos)||!Array.isArray(data?.cases)) throw Error('片库数据不完整，请重新加载。');
  const videos = new Map(data.videos.map(v=>[v.id,v]));
  const cases=[];let unavailable=0;
  const seen=new Set();
  for(const c of data.cases){
    if(!c||!packagingPattern.test([c.title,...(c.tags||[])].join(' ')))continue;
    const v=videos.get(c.videoId);
    const limit=Number(v?.previewDuration)||(v?.fullPreview?Number(v.duration):10);
    if(!v?.preview||!Number.isFinite(c.start)||!Number.isFinite(c.end)||c.start<0||c.end<=c.start||c.end>limit+0.02){unavailable++;continue;}
    if(typeof c.id!=='string'||seen.has(c.id))continue;
    const preview=assets[v.preview]||v.preview;
    if(typeof preview!=='string'||!(/^(data:video\/|https?:|[./\w-])/.test(preview))){unavailable++;continue;}
    seen.add(c.id);
    cases.push({...c,videoTitle:v.title,preview,previewDuration:limit,image:assets[c.image||v.poster]||c.image||v.poster||'',searchText:[c.title,c.structure,c.typography,c.motion,c.why,c.apply].filter(Boolean).join(' ').slice(0,1800)});
  }
  return {cases,unavailable,total:data.cases.length};
}
export function rankVectors(query,vectors){
  return vectors.map((v,index)=>({index,score:v.reduce((sum,x,i)=>sum+x*(query[i]||0),0)})).sort((a,b)=>b.score-a.score);
}
export function validateDirections(text,candidates,range){
  let value;
  try{
    const raw=String(text).replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^\s*```(?:json)?\s*/,'').replace(/\s*```\s*$/,'').trim();
    const first=raw.indexOf('{'),last=raw.lastIndexOf('}');
    value=JSON.parse(raw.slice(first,last+1));
  }catch{throw Error('本机模型没有返回可验证的方案格式，请重试或补充说明。');}
  if(!Array.isArray(value?.directions)||value.directions.length>3)throw Error('本机方案格式不正确。');
  const allowed=new Set(candidates.map(c=>c.id)),seen=new Set();
  return value.directions.map(d=>{
    if(!allowed.has(d.caseId))throw Error('方案引用了片库中不存在的案例，已停止展示。');
    if(seen.has(d.caseId))throw Error('方案重复引用了同一个案例，请重试。');
    seen.add(d.caseId);
    const start=Number(d.start),end=Number(d.end);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start<range.start||end>range.end||end<=start)throw Error('方案落点超出投入片段的范围，请重试。');
    const clean={caseId:d.caseId,start,end,copy:typeof d.copy==='string'?d.copy.slice(0,300):''};
    for(const key of textFields){if(typeof d[key]!=='string'||d[key].trim().length<3)throw Error('本机方案缺少可核验的设计内容，请重试。');clean[key]=d[key].trim().slice(0,1400);}
    return clean;
  });
}
export class Session{
  constructor(){this.reset();}
  reset(){this.directions=[];this.selected=null;this.revision=0;this.confirmedRevision=null;}
  setDirections(directions){this.reset();this.directions=directions;}
  select(index){if(!this.directions[index])throw Error('请选择一个有效方向。');this.selected=index;this.revision++;this.confirmedRevision=null;}
  get current(){return this.selected===null?null:this.directions[this.selected];}
  edit(patch){if(!this.current)throw Error('请先选择方向。');Object.assign(this.current,patch);this.revision++;this.confirmedRevision=null;}
  confirm(){if(!this.current)throw Error('请先选择方向。');for(const k of textFields)if(!String(this.current[k]||'').trim())throw Error('请补全方向中的必要内容。');this.confirmedRevision=this.revision;}
  isConfirmed(){return this.selected!==null&&this.confirmedRevision===this.revision;}
}
export const clock=n=>{n=Math.max(0,Number(n)||0);return String(Math.floor(n/60)).padStart(2,'0')+':'+String(Math.floor(n%60)).padStart(2,'0')+'.'+String(Math.floor(n*10)%10);};
export function makePrompt(d,c,tool='通用制作描述'){
  return `制作目标：${tool||'通用制作描述'}\n包装方向：${d.title}\n本片落点：${clock(d.start)}—${clock(d.end)}，时长 ${(d.end-d.start).toFixed(1)} 秒。\n\n表达目的：${d.understanding}\n趣味方式：${d.fun}\n视觉元素：${d.elements}\n精确文案：${d.copy||'不额外添加文字；如需文字由制作前另行确定。'}\n布局与主体保护：${d.placement}\n动作顺序与节奏：${d.motion}\n当前画面适配：${d.application}\n\n片库参考：${c.videoTitle||''}｜${c.title}｜${clock(c.start)}—${clock(c.end)}\n可借鉴的原片做法：${c.motion||c.structure||''}\n\n制作限制：保持当前画面主体、动作和构图可辨认，不遮挡人物面部或原有重要信息；文案保持原样。先准备需要的独立元素，再制作动画；复杂文字建议独立图层排版。仅制作所选片段内的视觉包装，不生成声音，不处理前后镜头衔接。`;
}
