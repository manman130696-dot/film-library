import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';

export const SITE = 'https://manman130696-dot.github.io/film-library/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIGEST = b => createHash('sha256').update(b).digest('hex');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeId = id => { if (!/^[a-zA-Z0-9_-]+$/.test(id)) throw Error('Unsafe record id: ' + id); return id; };
const clock = n => `${String(Math.floor(n / 60)).padStart(2, '0')}:${(n % 60).toFixed(2).padStart(5, '0')}`;
const absolute = relative => relative ? new URL(relative, SITE).href : null;
const json = value => JSON.stringify(value, null, 2) + '\n';

// Run only the site's trusted loader; the bundled archive is parsed as JSON by
// that loader, never executed. This keeps merging and palette rules identical.
export async function loadLibrary(root = ROOT) {
  const inputs = new Map();
  async function get(relative) {
    const target = path.resolve(root, relative);
    if (!target.startsWith(path.resolve(root) + path.sep)) throw Error('Source outside repository');
    const bytes = await readFile(target);
    inputs.set(relative.replaceAll(path.sep, '/'), DIGEST(bytes));
    return bytes.toString('utf8');
  }
  const sandbox = {
    window: {}, document: { baseURI: pathToFileURL(path.join(root, 'index.html')).href }, URL,
    fetch: async url => {
      const u = new URL(url);
      if (u.protocol !== 'file:') throw Error('Build may only read repository files');
      const text = await get(path.relative(root, fileURLToPath(u)));
      return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
    }
  };
  vm.runInNewContext(await get('archive-loader.js'), sandbox, { timeout: 10000 });
  await sandbox.window.FILM_LIBRARY_READY;
  const resources = JSON.parse(await get('style-references/references.json'));
  return {
    data: JSON.parse(JSON.stringify(sandbox.window.FILM_LIBRARY)),
    assets: sandbox.window.FILM_ASSETS, resources,
    sources: Object.fromEntries([...inputs].sort(([a], [b]) => a.localeCompare(b)))
  };
}

export function page(title, content, { stylesheet = '../styles.css', home = '../index.html' } = {}) {
  return `<!doctype html>\n<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} · 满的片库</title><link rel="stylesheet" href="${esc(stylesheet)}"></head><body><header><a href="${esc(SITE)}">满的片库</a><a href="${esc(home)}">参考目录</a></header><main>${content}</main></body></html>\n`;
}

export function makeReadingFiles({ data, assets, resources, sources }) {
  const files = new Map();
  const videos = new Map(data.videos.map(v => [safeId(v.id), v]));
  const ids = new Set();
  const image = reference => {
    if (!reference) return null;
    const embedded = assets[reference];
    if (!embedded) {
      const url = absolute(reference);
      if (!/^https?:/.test(url)) return null;
      return url;
    }
    const match = /^data:image\/(jpeg);base64,([A-Za-z0-9+/=\s]+)$/.exec(embedded);
    if (!match) throw Error('Unsupported archived image: ' + reference);
    const bytes = Buffer.from(match[2], 'base64');
    const [width, height] = jpegSize(bytes);
    const rel = `read/images/${DIGEST(bytes).slice(0, 24)}.svg`;
    // Self-contained SVG wrapper preserves the original JPEG bytes and aspect
    // ratio, matching the archive's existing portable-image convention.
    files.set(rel, `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><image width="${width}" height="${height}" href="data:image/jpeg;base64,${bytes.toString('base64')}"/></svg>\n`);
    return absolute(rel);
  };
  const viewer = (v, c) => {
    const u = new URL('index.html', SITE);
    u.searchParams.set('video', v.id);
    if (c) u.searchParams.set('case', c.id);
    return u.href;
  };
  const films = [];
  for (const v of data.videos) {
    const limit = Number(v.previewDuration) || (v.fullPreview ? Number(v.duration) : 10);
    const cases = data.cases.filter(c => c.videoId === v.id).map(c => {
      safeId(c.id);
      if (ids.has(c.id)) throw Error('Duplicate case id: ' + c.id);
      ids.add(c.id);
      if (!Number.isFinite(c.start) || !Number.isFinite(c.end) || c.start < 0 || c.end <= c.start) throw Error('Invalid range: ' + c.id);
      const source = { ...c };
      for (const k of ['image', 'structure', 'typography', 'motion', 'why', 'apply', 'palette']) delete source[k];
      const groups = c.palette?.groups?.map(g => ({
        ...g, image: image(g.image), preview_covers_range: !!v.preview && g.end <= limit + .02,
        observation: g.observation || '',
        proportions_status: 'existing_adaptation_suggestion',
        prompt_status: 'existing_adaptation_suggestion'
      }));
      return {
        ...source,
        details_url: absolute(`read/films/${v.id}.html#${c.id}`),
        viewer_url: viewer(v, c), image_url: image(c.image || v.poster),
        preview_covers_range: !!v.preview && c.end <= limit + .02,
        existing_record: { structure: c.structure || '', typography: c.typography || '', motion: c.motion || '', why: c.why || '' },
        adaptation_suggestion: c.apply || '',
        ...(groups ? { palette: { note: c.palette.note, groups } } : {}),
        evidence_status: 'existing_archive_record_not_reverified_by_this_build',
        visual_annotations: null
      };
    });
    const preview = v.preview && !assets[v.preview] ? absolute(v.preview) : null;
    const record = {
      id: v.id, title: v.title, summary: v.summary || '', subtitle: v.subtitle || '',
      categories: v.categories || [], tags: v.tags || [], preference: v.preference || '',
      duration: v.duration, preview_duration: v.preview ? limit : 0,
      viewer_url: viewer(v), report_url: v.report && !assets[v.report] ? absolute(v.report) : null,
      preview_url: preview, preview_access: preview ? 'direct_file' : v.preview ? 'existing_library_viewer' : 'unavailable',
      poster_url: image(v.poster), details_json: absolute(`read/films/${v.id}.json`),
      details_html: absolute(`read/films/${v.id}.html`), cases
    };
    films.push(record);
    files.set(`read/films/${v.id}.json`, json(record));
    files.set(`read/films/${v.id}.html`, filmPage(record));
  }
  for (const c of data.cases) if (!videos.has(c.videoId)) throw Error('Missing film for case: ' + c.id);
  const resourceRecords = resources.entries.map(r => {
    safeId(r.id);
    const record = { ...r, video: absolute(r.video), report: absolute(r.report),
      broll_status: 'existing_new_work_suggestion_not_original_motion',
      samples: r.samples.map(s => ({ ...s, image: image(s.image), time_basis: 'existing_sample_timestamp' })) };
    files.set(`read/resources/${r.id}.json`, json(record));
    files.set(`read/resources/${r.id}.html`, resourcePage(record));
    return { id: r.id, title: r.title, summary: r.summary, uses: r.uses, note: r.note, sample_count: r.samples.length,
      details_json: absolute(`read/resources/${r.id}.json`), details_html: absolute(`read/resources/${r.id}.html`) };
  });
  const index = {
    schema_version: 1, title: '满的片库 · 视觉参考读取入口', updated_at: data.updatedAt,
    source_digest: DIGEST(JSON.stringify(sources)), source_files: sources,
    scope: 'Existing film-library records and reference images; no new visual analysis or 12-dimension annotation backfill.',
    usage: ['先读本索引，根据标题、标签和已有描述选择影片，再读取对应详情。', '原片题材不必与分镜相同；对标视觉风格、包装、动效、审美和配色。', 'existing_record 是既有分析，未经本次重新审看；adaptation_suggestion 是新作建议。', 'visual_annotations 为 null 表示尚未补齐统一视觉标注，不表示没有视觉效果。', 'preview_covers_range 为 false 时仍可看截图和记录，但不能声称站内视频覆盖该段。', '技巧资源中的 B 镜动作属于新作建议，不可当作原片动效证据。'],
    film_count: films.length, case_count: data.cases.length, resource_count: resourceRecords.length,
    films: films.map(({ cases, ...v }) => ({ ...v, case_count: cases.length,
      cases: cases.map(c => ({ id: c.id, title: c.title, tags: c.tags, start: c.start, end: c.end, kind: c.kind || 'case',
        details_url: c.details_url, search_excerpt: [c.existing_record.structure, c.existing_record.typography].filter(Boolean).join(' ').slice(0, 180) })) })),
    resources: resourceRecords
  };
  files.set('read/index.json', json(index));
  files.set('read/index.html', page(index.title, `<h1>视觉参考目录</h1><p>${films.length} 部作品 · ${index.case_count} 条既有参考 · ${resourceRecords.length} 组创作资源</p><p>按影片查看包装、动效、审美与配色。这里整理已有资料，统一视觉标注尚待补齐。</p><p><a href="index.json">结构化索引 JSON</a> · <a href="README.md">读取说明</a></p>${films.map(v => `<section><h2><a href="films/${v.id}.html">${esc(v.title)}</a></h2><p>${esc(v.subtitle)}</p><p>${esc(v.summary)}</p><p class="tags">${esc([...v.categories, ...v.tags].join(' · '))}</p><p><a href="films/${v.id}.json">片段详情 JSON</a> · ${v.cases.length} 条参考</p>${v.cases.length ? `<ul>${v.cases.map(c => `<li><a href="films/${v.id}.html#${c.id}">${esc(c.title)}</a> <span>${clock(c.start)}–${clock(c.end)}</span> · ${esc((c.tags || []).join(' / '))}</li>`).join('')}</ul>` : '<p>当前条目没有独立包装案例，不据此推断不存在视觉效果。</p>'}</section>`).join('')}<h2>创作资源</h2>${resourceRecords.map(r => `<section><h3><a href="resources/${r.id}.html">${esc(r.title)}</a></h3><p>${esc(r.summary)}</p><p>${esc(r.note)}</p><a href="resources/${r.id}.json">资源详情 JSON</a></section>`).join('')}`, { stylesheet: 'styles.css', home: 'index.html' }));
  files.set('read/styles.css', 'body{margin:0;background:#f5f6f2;color:#232a25;font:16px/1.8 system-ui,"PingFang SC",sans-serif}header,main{max-width:1000px;margin:auto;padding:24px}header{display:flex;gap:28px;border-bottom:1px solid #dce3d8}a{color:#284638;text-underline-offset:3px}h1{font-size:2rem}h2{font-size:1.4rem}section,article{background:#fff;border:1px solid #dce3d8;border-radius:12px;padding:24px;margin:24px 0;scroll-margin-top:20px}p{white-space:pre-wrap;overflow-wrap:anywhere}.tags,figcaption,small{color:#53634f;font-size:.9rem}figure{margin:18px 0}img{display:block;max-width:min(100%,640px);max-height:560px;object-fit:contain}dt{font-weight:650;margin-top:14px}dd{margin-left:0;white-space:pre-wrap;overflow-wrap:anywhere}li{margin:8px 0}.notice{border-left:4px solid #8ba26e;padding-left:14px}code{overflow-wrap:anywhere}@media(max-width:700px){header,main{padding:18px}section,article{padding:18px}}\n');
  files.set('read/README.md', `# 片库直接读取入口\n\n- 总目录：${SITE}read/\n- 结构化索引：${SITE}read/index.json\n- 按索引中的 details_json / details_html 读取单片资料；网页文字无需运行 JavaScript。\n- 图片为原有归档截图。影片内的 viewer_url 定位到既有片库的影片和案例；旧归档视频继续由原播放器提供，不复制视频到索引。\n- 无需登录、付费服务或手动导出。读取方仍需有访问这些公开网址的能力；入口存在不等于每次会话均可联网。\n- 所有描述复用已有资料，本次不新增或重新核实 12 维标注。existing_record 与 adaptation_suggestion 分开；空的 visual_annotations 表示待补。\n- preview_covers_range 明确该范围是否在公开预览内；图片有档案不代表视频范围可播放。\n- 维护：在仓库根目录运行 node scripts/build-reading-index.mjs；源资料变动后重建，并提交生成的 read/。\n- 检查：node --test tests/reading-index.test.mjs，然后 node scripts/build-reading-index.mjs --check。\n- 更新依据：source_digest 为实际输入文件摘要，更新时间沿用片库记录，不用构建时间冒充审看时间。\n`);
  return { files, index };
}

function jpegSize(bytes) {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw Error('Invalid archived JPEG');
  let p = 2;
  while (p + 8 < bytes.length) {
    if (bytes[p] !== 0xff) throw Error('Invalid JPEG marker');
    while (bytes[p + 1] === 0xff) p++;
    const marker = bytes[p + 1];
    if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return [bytes.readUInt16BE(p + 7), bytes.readUInt16BE(p + 5)];
    if (marker === 0xd9 || marker === 0xda) break;
    p += 2 + bytes.readUInt16BE(p + 2);
  }
  throw Error('Missing JPEG dimensions');
}

function filmPage(v) {
  const term = (name, value) => value ? `<dt>${esc(name)}</dt><dd>${esc(value)}</dd>` : '';
  return page(v.title, `<h1>${esc(v.title)}</h1><p>${esc(v.subtitle)}</p><p>${esc(v.summary)}</p><p>${esc(v.preference)}</p><p><a href="${esc(v.details_json)}">本片 JSON</a> · <a href="${esc(v.viewer_url)}">打开片库作品</a>${v.report_url ? ` · <a href="${esc(v.report_url)}">原拉片报告</a>` : ''}</p><p class="notice">以下复用既有归档记录，本次没有重新审看或补齐 12 维视觉标注。原片观察与新作建议分别展示。</p>${v.cases.map(c => `<article id="${esc(c.id)}"><h2>${esc(c.title)}</h2><p>${clock(c.start)}–${clock(c.end)} · ${esc((c.tags || []).join(' / '))}</p>${c.image_url ? `<figure><a href="${esc(c.image_url)}"><img src="${esc(c.image_url)}" alt="${esc(c.title)}归档画面" loading="lazy"></a><figcaption>原有归档截图；单张截图不证明动态。</figcaption></figure>` : ''}<p><a href="${esc(c.viewer_url)}">在片库查看此案例</a></p><p>${c.preview_covers_range ? '该时间段在已登记的站内预览范围内。' : '该时间段未被已登记的站内预览完整覆盖；可查看截图和分析。'}</p><h3>既有原片记录</h3><dl>${term('构图与关系', c.existing_record.structure)}${term('文字与视觉描述', c.existing_record.typography)}${term('动作记录', c.existing_record.motion)}${term('既有作用解释', c.existing_record.why)}</dl>${c.adaptation_suggestion ? `<h3>新作适配建议</h3><p>${esc(c.adaptation_suggestion)}</p>` : ''}${c.palette ? `<h3>已有配色分组</h3><p>${esc(c.palette.note)}</p>${c.palette.groups.map(g => `<section><h4>${esc(g.name)}</h4><p>${esc(g.sourceTitle)} · ${clock(g.start)}–${clock(g.end)}</p><img src="${esc(g.image)}" alt="${esc(g.name)}配色画面" loading="lazy"><p>${esc(g.observation)}</p><ul>${g.colors.map(k => `<li>${esc(k.role)}：${esc(k.hex)} · ${esc(k.use)}</li>`).join('')}</ul><p>新作建议比例：${esc(g.proportions)}</p><p>新作 B 镜建议：${esc(g.broll)}</p><p>新作提示词：${esc(g.prompt)}</p></section>`).join('')}` : ''}</article>`).join('')}${v.cases.length ? '' : '<p>当前条目没有独立包装案例。</p>'}`);
}

function resourcePage(r) {
  return page(r.title, `<h1>${esc(r.title)}</h1><p>${esc(r.summary)}</p><p class="notice">${esc(r.note)}</p><p><a href="${esc(r.video)}">技巧原片</a> · <a href="${esc(r.report)}">原分析报告</a></p>${r.samples.map(s => `<article id="sample-${esc(s.id)}"><h2>${esc(s.title)}</h2><p>原有取帧位置 ${clock(s.time)}</p><img src="${esc(s.image)}" alt="${esc(s.title)}教程原画面" loading="lazy"><p>${esc(s.description)}</p><p>已有近似参考色：${esc(s.color)}</p></article>`).join('')}<h2>已有新作建议</h2><p>${esc(r.broll)}</p><p>${esc(r.variety)}</p><h3>已有图片提示词</h3><p>${esc(r.prompt)}</p><h3>已有 B 镜提示词</h3><p>${esc(r.brollPrompt)}</p>`);
}

export async function build(root = ROOT, { check = false } = {}) {
  const { files, index } = makeReadingFiles(await loadLibrary(root));
  for (const [relative, content] of files) {
    const bytes = Buffer.isBuffer(content) ? content : Buffer.from(content);
    const destination = path.join(root, relative);
    if (check) {
      let existing;
      try { existing = await readFile(destination); } catch { throw Error('Missing generated file: ' + relative); }
      if (!existing.equals(bytes)) throw Error('Reading index is stale; rebuild: ' + relative);
    } else {
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, bytes);
    }
  }
  // A build never removes existing unrelated files; flag stale generated pages.
  for (const directory of ['films', 'resources', 'images']) {
    for (const name of await readdir(path.join(root, 'read', directory))) {
      if (!files.has(`read/${directory}/${name}`)) throw Error('Obsolete generated file requires review: read/' + directory + '/' + name);
    }
  }
  return { files: files.size, films: index.film_count, cases: index.case_count, resources: index.resource_count, sourceDigest: index.source_digest };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await build(ROOT, { check: process.argv.includes('--check') }), null, 2));
}
