const assert = require('node:assert/strict');
module.exports = async function checkPalettes(page) {
  await page.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:'http://127.0.0.1:8765'});
  await page.setViewportSize({width:1440,height:1000});
  await page.goto('http://127.0.0.1:8765/');
  await page.evaluate(() => window.FILM_LIBRARY_READY);
  await page.waitForSelector('#video-grid [data-open]');
  const references = await page.evaluate(() => window.FILM_LIBRARY.cases.filter(c=>c.kind==='palette'));
  assert.deepEqual(references.map(c=>c.videoId).sort(),['africa','amazonia','casetify','cityride','home','songmont','whale']);
  assert.equal(await page.locator('#video-grid .video-card').count(),17,'adding palettes does not duplicate films');
  for (const c of references) {
    assert.ok(c.palette.groups.length>0);
    for (const g of c.palette.groups) {
      if (g.sourceShotId) {
        const shot=await page.evaluate(({videoId,shotId})=>window.FILM_LIBRARY.videos.find(v=>v.id===videoId).shots.find(s=>s.id===shotId),{videoId:c.videoId,shotId:g.sourceShotId});
        assert.ok(shot,'palette resolves to an inspected source shot');
        assert.equal(g.start,shot.start); assert.equal(g.end,shot.end);
        assert.ok(Object.values(shot.frames).some(f=>g.image==='reports/'+c.videoId+'/'+f.src));
        assert.ok(g.colors.every(color=>/^#[0-9A-F]{6}$/i.test(color.hex)));
        assert.ok(g.broll && g.prompt && g.proportions);
        continue;
      }
      const source=await page.evaluate(id=>window.FILM_LIBRARY.cases.find(c=>c.id===id),g.sourceCaseId);
      assert.ok(source && source.kind!=='palette','reference resolves to an existing film case');
      assert.equal(source.videoId,c.videoId);
      assert.equal(g.image,source.image);
      assert.equal(g.start,source.start);
      assert.ok(g.colors.every(color=>/^#[0-9A-F]{6}$/i.test(color.hex)));
      assert.ok(g.broll && g.prompt && g.proportions);
    }
  }
  await page.locator('.main-nav [data-view="cases"]').click();
  await page.locator('#search').fill('配色参考');
  const renderedIds = await page.locator('#video-grid [data-case]').evaluateAll(nodes => nodes.map(node => node.dataset.case));
  const paletteIds = new Set(references.map(reference => reference.id));
  assert.deepEqual(renderedIds.filter(id => paletteIds.has(id)).sort(), [...paletteIds].sort(), 'one palette card per film; search may also match film-level tags');
  for (const c of references) {
    await page.locator(`#video-grid [data-case="${c.id}"]`).click();
    const reference=page.locator(`#case-${c.id}`);
    await reference.waitFor();
    assert.equal(await page.locator('#detail-panel .palette-reference').count(),1);
    assert.equal(await reference.locator('.palette-group').count(),c.palette.groups.length);
    assert.match(await reference.innerText(),/近似参考色/);
    await reference.locator('[data-copy-case]').click();
    const copied=await page.evaluate(()=>navigator.clipboard.readText());
    assert.ok(copied.includes(c.palette.groups[0].colors[0].hex));
    assert.match(copied,/B镜用法/);
    assert.match(copied,/设计建议/);
    await page.locator('#detail-close').click();
  }
  console.log('PASS: seven grouped palette references, original source images/times, existing navigation and usable copied B-roll prompts');
};
