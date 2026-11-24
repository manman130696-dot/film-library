const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
(async()=>{
 const server=spawn('python3',['-m','http.server','8766','--bind','127.0.0.1'],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<100;i++){try{if((await fetch('http://127.0.0.1:8766/packaging.html', {method:'HEAD'})).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  browser=await chromium.launch({headless:true});const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],uploads=[],modelRequests=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))uploads.push(r.url());if(/huggingface|jsdelivr/.test(r.url()))modelRequests.push(r.url());});
  await page.addInitScript(()=>{window.Worker=class{constructor(){throw Error('Assist mode must not create model workers');}};});
  await page.goto('http://127.0.0.1:8766/packaging.html',{waitUntil:'load'});
  await page.waitForFunction(()=>document.querySelector('#catalog-status').textContent.startsWith('可播放的包装对标'),undefined,{timeout:60000});
  assert.equal(await page.locator('#analyze').count(),0);assert.equal(await page.locator('input[type=password]').count(),0);assert.equal(await page.locator('#browse').isEnabled(),false);
  assert.ok((await page.locator('.download-note').innerText()).includes('自动分析暂未开放'));
  await page.locator('#clip').setInputFiles('reports/cityride/preview-web.mp4');await page.waitForFunction(()=>!document.querySelector('#browse').disabled);
  await page.locator('#range-end').fill('5');await page.locator('#note').fill('让观众看清画面中的重点');await page.locator('#browse').click();
  assert.ok(await page.locator('.case-option').count()>=3);
  await page.locator('#case-search').fill('zz-no-such-packaging-record');assert.equal(await page.locator('.case-option').count(),0);assert.equal(await page.locator('#case-empty').isVisible(),true);await page.locator('#case-search').fill('');
  await page.locator('#case-grid [data-reference]').first().click();await page.locator('#reference-dialog').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#reference-video').readyState>=1);assert.ok((await page.locator('#reference-range').innerText()).includes('—'));await page.locator('#close-reference').click();
  for(let i=0;i<3;i++)await page.locator('#case-grid [data-add]').nth(i).click();assert.equal(await page.locator('.direction-card').count(),3);
  await page.locator('#case-grid [data-add]').first().click();assert.equal(await page.locator('.direction-card').count(),3);
  await page.locator('[data-select]').first().click();assert.equal(await page.locator('#generate-prompt').isEnabled(),false);await page.locator('#confirm').click();assert.equal(await page.locator('#generate-prompt').isEnabled(),false);
  const fields={title:'重点提示包装',understanding:'帮助观众识别当前画面的关键信息',fun:'小图形轻微弹入，增加观看趣味',elements:'短词与简洁标注图形',copy:'看这里',placement:'放在主体右侧空白处，避开人脸和字幕',motion:'标注出现，文字停留读清，最后淡出',application:'结合本片的主体位置和时间范围调整参考做法'};
  for(const [name,value] of Object.entries(fields))await page.locator('#design-form [name='+name+']').fill(value);
  await page.locator('#feedback').fill('保留图形，文字更克制');await page.locator('#add-feedback').click();assert.ok((await page.locator('#design-form [name=application]').inputValue()).includes('保留图形，文字更克制'));
  await page.locator('#confirm').click();assert.equal(await page.locator('#generate-prompt').isEnabled(),true);await page.locator('#generate-prompt').click();assert.ok((await page.locator('#prompt').inputValue()).includes('保留图形，文字更克制'));
  await page.locator('#design-form [name=copy]').fill('重点');assert.equal(await page.locator('#generate-prompt').isEnabled(),false);assert.equal(await page.locator('#prompt-panel').isVisible(),false);
  await page.locator('#confirm').click();await page.locator('#generate-prompt').click();assert.ok((await page.locator('#prompt').inputValue()).includes('精确文案：重点'));
  await page.screenshot({path:'/tmp/packaging-desktop.png',fullPage:true});
  await page.locator('[data-select]').nth(1).click();assert.equal(await page.locator('#generate-prompt').isEnabled(),false);await page.locator('[data-remove]').first().click();assert.equal(await page.locator('.direction-card').count(),2);
  await page.locator('#finish').click();assert.equal(await page.locator('#source').getAttribute('src'),null);assert.equal(await page.locator('#note').inputValue(),'');assert.equal(await page.locator('#prompt').inputValue(),'');assert.equal(await page.locator('.direction-card').count(),0);
  assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});
  await page.locator('#note').fill('仅用于本次方案的说明');await page.reload();assert.equal(await page.locator('#note').inputValue(),'');assert.equal(await page.locator('#source').getAttribute('src'),null);
  assert.deepEqual(uploads,[]);assert.deepEqual(modelRequests,[]);assert.deepEqual(errors,[]);
  await page.goto('http://127.0.0.1:8766/');assert.equal(await page.locator('.main-nav a[href="packaging.html"]').count(),1);await page.goto('http://127.0.0.1:8766/tools.html');assert.ok(await page.locator('a[href="packaging.html"]').count());
  console.log('PASS desktop assist: real references, local video, filtering, up to three candidates, playback, manual editing, literal feedback, confirmation gating, cleanup, zero uploads/model downloads, navigation.');
 }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
