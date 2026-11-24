// Real browser/WASM smoke test. No worker or model responses are stubbed.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
 const server=spawn('python3',['-m','http.server','8767','--bind','127.0.0.1'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8767/packaging.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});const page=await browser.newPage();const uploads=[];
  page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))uploads.push(r.url());});
  page.on('console',m=>{if(m.text().startsWith('MODEL_STAGE:'))console.log(m.text());});
  await page.goto('http://127.0.0.1:8767/packaging.html',{waitUntil:'load'});
  const result=await page.evaluate(async()=>{
   await window.FILM_LIBRARY_READY;
   const {buildCatalog}=await import('./packaging/core.mjs');
   const {cases}=buildCatalog(window.FILM_LIBRARY,window.FILM_ASSETS);
   const c=cases.find(c=>c.image.startsWith('data:image/'));if(!c)throw Error('No public frame for browser model smoke test');
   const compact=Object.fromEntries(['id','title','structure','typography','motion','why','apply','searchText'].map(k=>[k,c[k]||'']));
   const started=performance.now();
   return new Promise((resolve,reject)=>{
    const worker=new Worker('./packaging/worker.mjs',{type:'module'});let phase='';
    const timer=setTimeout(()=>{worker.terminate();reject(Error('Real browser model test exceeded 12 minutes'));},720000);
    worker.onerror=e=>{clearTimeout(timer);worker.terminate();reject(Error('Browser model worker failed: '+e.message));};
    worker.onmessage=({data})=>{if(data.type==='progress'){const current=data.message.split('：')[0];if(current!==phase){console.log('MODEL_STAGE:'+current);phase=current;}return;}clearTimeout(timer);worker.terminate();if(data.type==='error')reject(Error(data.message));else resolve({...data.result,seconds:(performance.now()-started)/1000});};
    worker.postMessage({id:1,type:'analyze',input:{frames:[{time:1,image:c.image}],range:{start:0,end:5},note:'请参考这个包装案例来做当前片段：'+c.title+'。表达目的：'+c.why,catalog:[compact]}});
   });
  });
  assert.ok(result.observations[0].text.length>8);assert.ok(Array.isArray(result.directions));assert.deepEqual(uploads,[]);
  console.log('REAL BROWSER VISION:',result.observations[0].text);console.log('REAL BROWSER DIRECTIONS:',JSON.stringify(result.directions));
  console.log('PASS real browser/WASM models with public frame; no media upload; seconds='+result.seconds.toFixed(1));
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
