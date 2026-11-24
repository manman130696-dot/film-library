// UI-only fixtures exercise controls; real inference is checked separately.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8766/packaging.html')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],uploads=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))uploads.push(r.url());});
  await page.route('**/packaging/worker.mjs',route=>route.fulfill({contentType:'application/javascript',body:`self.onmessage=({data})=>{const {id,type,input}=data;if(input.note==='fixture-error'){self.postMessage({id,type:'error',message:'测试分析失败'});return;}if(input.note==='fixture-empty'){self.postMessage({id,type:'result',result:{observations:input.frames.map(f=>({time:f.time,text:'UI test fixture — not model inference'})),directions:[]}});return;}const c=type==='revise'?input.caseRecord:input.catalog[0];const d={caseId:c.id,title:type==='revise'?'调整后的测试方向':'测试方向',start:input.range.start,end:input.range.end,understanding:'强调用户提供的具体重点',fun:'用轻微动作增加观看趣味',elements:'简洁文字和图形',copy:'测试文案',placement:'利用主体旁空白，不遮挡重点',motion:'依次出现，停留后淡出',application:'根据当前画面安排文字和图形'};self.postMessage({id,type:'result',result:type==='revise'?d:{observations:input.frames.map(f=>({time:f.time,text:'UI test fixture — not model inference'})),directions:[d]}});};` }));
  await page.goto('http://127.0.0.1:8766/packaging.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#catalog-status').textContent.startsWith('可对标的包装案例'),{timeout:60000});
  assert.equal(await page.locator('input[type=password]').count(),0);
  assert.equal(await page.locator('#generate-prompt').isEnabled(),false);
  await page.locator('#clip').setInputFiles('reports/cityride/preview-web.mp4');
  await page.waitForFunction(()=>!document.querySelector('#analyze').disabled);
  await page.locator('#range-end').fill('5');await page.locator('#note').fill('测试片段');await page.locator('#analyze').click();
  await page.locator('.direction-card').waitFor({state:'visible',timeout:60000});
  assert.equal(await page.locator('.direction-card').count(),1);
  assert.equal(await page.locator('#prompt-panel').isVisible(),false);
  await page.locator('[data-reference]').click();await page.locator('#reference-dialog').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.querySelector('#reference-video').readyState>=1);
  assert.ok((await page.locator('#reference-range').innerText()).includes('—'));
  await page.locator('#close-reference').click();await page.locator('[data-select]').click();
  assert.equal(await page.locator('#generate-prompt').isEnabled(),false);
  await page.locator('#confirm').click();assert.equal(await page.locator('#generate-prompt').isEnabled(),true);
  await page.locator('#generate-prompt').click();assert.ok((await page.locator('#prompt').inputValue()).includes('测试方向'));
  await page.locator('#design-form [name=copy]').fill('新的精确文案');assert.equal(await page.locator('#generate-prompt').isEnabled(),false);assert.equal(await page.locator('#prompt-panel').isVisible(),false);
  await page.locator('#feedback').fill('文字收敛一点');await page.locator('#revise').click();await page.waitForFunction(()=>document.querySelector('#design-form [name=title]').value==='调整后的测试方向');
  await page.locator('#confirm').click();await page.locator('#generate-prompt').click();assert.ok((await page.locator('#prompt').inputValue()).includes('调整后的测试方向'));
  await page.screenshot({path:'/tmp/packaging-desktop.png',fullPage:true});
  await page.locator('#note').fill('fixture-empty');await page.locator('#analyze').click();await page.waitForFunction(()=>document.querySelector('#message-title').textContent==='没有找到合适的包装案例');assert.equal(await page.locator('.direction-card').count(),0);
  await page.locator('#note').fill('fixture-error');await page.locator('#analyze').click();await page.waitForFunction(()=>document.querySelector('#message-title').textContent==='本次分析没有完成');assert.match(await page.locator('#message-text').innerText(),/测试分析失败/);
  await page.locator('#finish').click();assert.equal(await page.locator('#source').getAttribute('src'),null);assert.equal(await page.locator('#note').inputValue(),'');assert.equal(await page.locator('#frames img').count(),0);assert.equal(await page.locator('#prompt').inputValue(),'');
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  assert.deepEqual(uploads,[]);assert.deepEqual(errors,[]);
  await page.goto('http://127.0.0.1:8766/');assert.equal(await page.locator('.main-nav a[href="packaging.html"]').count(),1);
  await page.goto('http://127.0.0.1:8766/tools.html');assert.ok(await page.locator('a[href="packaging.html"]').count());
  console.log('PASS desktop UI: real catalog coverage, local video, reference playback, selection, edits, revision, prompt gating, empty/error, session cleanup, zero uploads, navigation. UI worker uses explicit fixtures; not an inference-quality test.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
