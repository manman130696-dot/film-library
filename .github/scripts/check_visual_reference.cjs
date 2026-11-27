const assert = require('node:assert/strict');

module.exports = async function checkVisualReference(page) {
  const base = 'http://127.0.0.1:8765';
  await page.setViewportSize({width:1440,height:1000});
  await page.goto(base + '/');
  await page.waitForFunction(() => document.querySelectorAll('#video-grid .video-card').length === 17);
  await page.locator('#search').fill('卫星影像');
  assert.equal(await page.locator('#video-grid .video-card').count(), 1);
  await page.locator('#video-grid [data-open="amazonia"]').click();
  assert.match(await page.locator('#detail-facts').innerText(), /1 段视觉标注/);
  await page.locator('#detail-reference-summary [data-show-visual]').click();
  assert.equal(await page.locator('#tab-visuals').getAttribute('aria-selected'), 'true');
  assert.equal(await page.locator('[data-visual-dimension]').count(), 12);
  assert.match(await page.locator('[data-visual-dimension="rhythm"]').innerText(), /连续采样与既有分析/);
  assert.match(await page.locator('[data-visual-dimension="subjects"]').innerText(), /不适用/);
  await page.waitForFunction(() => [...document.querySelectorAll('.visual-evidence img')].every(i => i.complete && i.naturalWidth > 0));
  await page.locator('#detail-panel').evaluate(p => p.scrollTop = 0);
  await page.locator('#detail-dialog').screenshot({path:'/tmp/visual-reference-desktop.png'});
  await page.locator('.visual-extra summary').click();
  assert.equal(await page.locator('[data-visual-dimension="transition"]').isVisible(), true);
  await page.locator('[data-visual-dimension="transition"]').scrollIntoViewIfNeeded();
  await page.locator('#detail-dialog').screenshot({path:'/tmp/visual-reference-dimensions.png'});
  assert.ok(await page.locator('#detail-dialog').evaluate(e => e.scrollWidth <= e.clientWidth + 1));
  await page.locator('[data-jump="6.2"]').click();
  await page.waitForFunction(() => document.querySelector('#detail-video').currentTime >= 6.1);
  await page.locator('#detail-video').evaluate(v => v.pause());
  await page.context().grantPermissions(['clipboard-read','clipboard-write']);
  await page.locator('[data-copy-visual]').click();
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  for (const phrase of ['河道描线','视觉风格','转场与画面衔接','标注依据','待核对']) assert.ok(copied.includes(phrase), phrase);
  await page.locator('#tab-cases').click();
  assert.equal(await page.locator('.case-index button').count(), 11);
  await page.locator('[data-focus-case="amazonia-broll-01"]').click();
  assert.equal(await page.locator('#case-amazonia-broll-01 .motion-plan').getAttribute('open'), null);
  await page.locator('#case-amazonia-broll-01 [data-show-visual]').click();
  assert.equal(await page.locator('#tab-visuals').getAttribute('aria-selected'), 'true');
  await page.locator('#detail-close').click();
  await page.goto(base + '/index.html?video=amazonia&case=amazonia-broll-01');
  await page.waitForSelector('#case-amazonia-broll-01');
  assert.equal(await page.locator('#tab-cases').getAttribute('aria-selected'), 'true');
  await page.locator('#detail-close').click();
  await page.goto(base + '/read/films/amazonia.html');
  assert.equal(await page.locator('[data-visual-dimension]').count(), 12);
  assert.ok((await page.locator('.visual-tags').innerText()).includes('卫星影像'));
  console.log('PASS: visual annotation search, dimensions, evidence frames, time seek, clipboard, case navigation and direct reading');
};

if (require.main === module) {
  const {chromium} = require('playwright');
  const {spawn} = require('node:child_process');
  (async () => {
    const server = spawn('python3',['.github/scripts/serve_preview.py'],{stdio:'ignore'});
    let browser;
    try {
      for (let i=0;i<100;i++) {
        try {if((await fetch('http://127.0.0.1:8765/')).ok)break;}catch{}
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      browser=await chromium.launch({headless:true});
      const page=await browser.newPage(); const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      await module.exports(page); assert.deepEqual(errors,[]);
    } finally {if(browser)await browser.close();server.kill();}
  })().catch(error=>{console.error(error);process.exitCode=1;});
}
