const { chromium } = require('playwright');
const { spawn } = require('node:child_process');
const assert = require('node:assert/strict');
const fs = require('node:fs');

(async () => {
  const config = JSON.parse(fs.readFileSync('categories.json', 'utf8'));
  const html = fs.readFileSync('index.html', 'utf8');
  for (const [, source] of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)) new Function(source);
  new Function(fs.readFileSync('archive-loader.js', 'utf8'));
  const server = spawn('python3', ['.github/scripts/serve_preview.py'], { stdio: 'ignore' });
  let browser;
  try {
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch('http://127.0.0.1:8765/', {method:'HEAD'})).ok) break; } catch {}
      await new Promise(r => setTimeout(r, 100));
    }
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('http://127.0.0.1:8765/', { waitUntil: 'load' });
    await page.evaluate(() => window.FILM_LIBRARY_READY);
    await page.waitForFunction(() => document.querySelectorAll('#video-grid .video-card').length === 16);
    const cards = page.locator('#video-grid .video-card');
    assert.equal(await cards.count(), 16);
    const integrity = await page.evaluate(() => ({
      assets: Object.keys(window.FILM_ASSETS).length,
      validAssets: Object.values(window.FILM_ASSETS).every(v => v.startsWith('data:') && v.length > 1000 && !v.includes('[embedded-media]')),
      cases: window.FILM_LIBRARY.cases.length,
      prompts: window.FILM_PROMPTS.songmont.length,
    }));
    assert.equal(integrity.assets, 107);
    assert.equal(integrity.validAssets, true);
    assert.equal(integrity.prompts, 3);
    assert.ok(integrity.cases > 50);
    const metadata = await page.evaluate(() => window.FILM_LIBRARY.videos.map(v => ({ id: v.id, categories: v.categories })));
    for (const category of config.categories) {
      const button = page.locator('.category-nav button').filter({ hasText: category.name });
      await button.click();
      const expected = metadata.filter(v => v.categories.includes(category.name)).length;
      assert.equal(await cards.count(), expected, category.name);
      assert.equal(await button.getAttribute('aria-pressed'), 'true');
      assert.equal(await page.locator('#empty-state').isVisible(), expected === 0);
    }
    await page.locator('.category-nav button[data-direction="商业与音乐影像"]').click();
    assert.deepEqual((await page.locator('#video-grid [data-open]').evaluateAll(nodes => nodes.map(n => n.dataset.open))).sort(), ['autumn', 'casetify', 'cityride', 'songmont']);
    await page.locator('#search').fill('Songmont');
    assert.equal(await cards.count(), 1);
    await page.locator('#video-grid [data-open="songmont"]').click();
    assert.equal(await page.locator('#detail-dialog').isVisible(), true);
    assert.match(await page.locator('#detail-categories').innerText(), /商业与音乐影像.*审美短片/);
    assert.ok((await page.locator('#detail-panel').innerText()).length > 100);
    await page.locator('#tab-prompts').click();
    assert.ok((await page.locator('#prompt-content').inputValue()).length > 100);
    assert.ok((await page.locator('#detail-video').getAttribute('src')).startsWith('data:video/'));
    await page.locator('#detail-close').click();
    await page.locator('#clear-filters').click();
    assert.equal(await cards.count(), 16);
    await page.locator('#search').fill('旅行');
    assert.ok((await cards.count()) >= 3, 'original subject terms remain searchable');
    await page.locator('#clear-filters').click();
    await page.locator('.main-nav [data-view="cases"]').click();
    await page.locator('.category-nav button[data-direction="商业与音乐影像"]').click();
    assert.ok((await cards.count()) > 0, 'category applies to packaging cases');
    await page.locator('.main-nav [data-view="videos"]').click();
    assert.equal(await cards.count(), 16);
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = page.locator('.category-tabs');
    assert.equal(await mobile.isVisible(), true);
    await mobile.locator('[data-direction="商业与音乐影像"]').click();
    assert.equal(await cards.count(), 4);
    await mobile.locator('[data-direction="剧情短片"]').click();
    assert.equal(await page.locator('#empty-state').isVisible(), true);
    await page.locator('#empty-clear').click();
    assert.equal(await cards.count(), 16);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'mobile page should not overflow');
    assert.deepEqual(errors, []);
    await page.locator('#search').fill('拳击机');
    assert.equal(await cards.count(), 1);
    await page.locator('[data-open="five-digit-rhythm"]').click();
    assert.equal(await page.locator('#tab-cases').isVisible(), false);
    assert.equal(await page.locator('#tab-prompts').isVisible(), false);
    assert.match(await page.locator('#detail-preference').innerText(), /剪辑节奏/);
    await page.waitForFunction(() => document.querySelector('#detail-video').readyState >= 1);
    assert.ok(Math.abs(await page.locator('#detail-video').evaluate(v => v.duration) - 77.177177) < .2);
    await page.locator('[data-analysis="shots"]').click();
    assert.equal(await page.locator('#detail-panel .shot-item').count(), 43);
    await page.locator('#detail-close').click();
    await page.locator('#clear-filters').click();
    await page.locator('[data-open="casetify"]').click();
    assert.equal(await page.locator('#tab-cases').isVisible(), true);
    assert.equal(await page.locator('#tab-prompts').isVisible(), true);
    await page.locator('#detail-close').click();
    await page.goto('http://127.0.0.1:8765/reports/five-digit-rhythm/online-report.html');
    assert.equal(await page.locator('#shots .shot').count(), 43);
    await page.locator('#phase-list button').nth(6).click();
    await page.waitForFunction(() => document.querySelector('#video').currentTime > 61);
    assert.ok(await page.locator('#now').innerText());
    await page.goto('http://127.0.0.1:8765/');
    await page.evaluate(() => window.FILM_LIBRARY_READY);
    await require('./check_palettes.cjs')(page);
    await require('./check_cityride.cjs')(page);
    await require('./check_cognition.cjs')(page);
    await require('./check_style_references.cjs')(page);
    assert.deepEqual(errors, []);
    console.log('PASS: all categories, counts, combined search, detail notes, prompts, bundled previews, case filters and mobile layout');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });


