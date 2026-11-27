import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadLibrary, makeReadingFiles, page, SITE } from '../scripts/build-reading-index.mjs';
import { VISUAL_DIMENSIONS, annotationSearchText, renderVisualAnnotations } from '../visual-reference.mjs';

const source = await loadLibrary();
const result = makeReadingFiles(source);
const text = p => String(result.files.get(p));

test('reading output includes all current films, cases and tutorial samples without duplicating ids', () => {
  assert.equal(result.index.film_count, source.data.videos.length);
  assert.equal(result.index.case_count, source.data.cases.length);
  const ids = result.index.films.flatMap(v => v.cases.map(c => c.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(new Set(ids), new Set(source.data.cases.map(c => c.id)));
  assert.equal(result.index.resources[0].sample_count, source.resources.entries[0].samples.length);
});

test('existing observations remain exact, suggestions stay separate and annotations are not invented', () => {
  const film = JSON.parse(text('read/films/cognition-gap.json'));
  const c = film.cases.find(c => c.id === 'cognition-gap-c04');
  const original = source.data.cases.find(originalCase => originalCase.id === c.id);
  assert.equal(c.existing_record.motion, original.motion);
  assert.equal(c.adaptation_suggestion, original.apply);
  assert.equal(c.visual_annotations, null);
  assert.equal(c.evidence_status, 'existing_archive_record_not_reverified_by_this_build');
  assert.equal(c.preview_covers_range, true);
  const resource = JSON.parse(text('read/resources/landmark-postcards.json'));
  assert.equal(resource.broll_status, 'existing_new_work_suggestion_not_original_motion');
});

test('a screenshot beyond the public preview does not claim playable video coverage', () => {
  const film = JSON.parse(text('read/films/songmont.json'));
  const c = film.cases.find(c => c.id === 'SO02');
  assert.equal(c.preview_covers_range, false);
  assert.equal(film.preview_access, 'existing_library_viewer');
  assert.equal(film.preview_url, null);
  assert.ok(c.image_url.startsWith(SITE + 'read/images/'));
  assert.ok(c.viewer_url.includes('video=songmont&case=SO02'));
});

test('machine output is compact and contains no embedded video, image data or local paths', () => {
  assert.ok(Buffer.byteLength(text('read/index.json')) < 200_000);
  for (const [p, content] of result.files) {
    if (!/\.(json|html)$/.test(p)) continue;
    assert.doesNotMatch(String(content), /data:(?:video|image)\//, p);
    assert.doesNotMatch(String(content), /file:\/\/|\/Users\/sun\//, p);
  }
  assert.ok([...result.files.keys()].filter(p => p.startsWith('read/images/') && p.endsWith('.svg')).length > 0);
});

test('all generated internal destinations and original image files exist', async () => {
  const documents = [...result.files].filter(([p]) => /\.(html|json)$/.test(p));
  for (const [p, content] of documents) {
    const urls = [...String(content).matchAll(/https:\/\/manman130696-dot\.github\.io\/film-library\/([^"\s<>]+)/g)].map(m => m[1].replaceAll('&amp;', '&'));
    for (const url of urls) {
      const relative = decodeURI(url.split(/[?#]/)[0]);
      if (relative.startsWith('read/')) assert.ok(result.files.has(relative), p + ': ' + relative);
    }
  }
  for (const film of result.index.films) {
    const details = JSON.parse(text(`read/films/${film.id}.json`));
    for (const c of details.cases) {
      if (!c.image_url || c.image_url.includes('/read/images/')) continue;
      const relative = c.image_url.slice(SITE.length);
      assert.ok((await readFile(new URL('../' + relative, import.meta.url))).length > 0, relative);
    }
  }
});

test('static HTML is readable without JavaScript and escapes source text', () => {
  assert.ok(text('read/index.html').includes('人物图组'));
  assert.ok(text('read/films/autumn.html').includes('公路'));
  assert.doesNotMatch(text('read/index.html'), /<script/i);
  const html = page('<img src=x onerror=alert(1)>', '<p>safe body</p>');
  assert.ok(html.includes('&lt;img'));
  assert.doesNotMatch(html, /<title><img/);
});

test('the selected river-to-logo reference keeps all dimensions, evidence and unverified scope', () => {
  const film = JSON.parse(text('read/films/amazonia.json'));
  const c = film.cases.find(c => c.id === 'amazonia-broll-01');
  const annotation = c.visual_annotations;
  assert.equal(result.index.visual_annotation_count, 1);
  assert.equal(film.visual_annotation_count, 1);
  assert.equal(annotation.source.caseId, c.id);
  assert.equal(annotation.source.start, c.start);
  assert.equal(annotation.source.end, c.end);
  assert.deepEqual(annotation.dimensions.map(d => d.key), VISUAL_DIMENSIONS.map(([key]) => key));
  assert.equal(annotation.dimensions.find(d => d.key === 'subjects').status, 'archived_frames');
  assert.equal(annotation.dimensions.find(d => d.key === 'aesthetic').status, 'interpretation');
  assert.ok(annotation.evidenceFrames.every(f => f.time >= c.start && f.time < c.end));
  assert.match(annotation.evidenceBasis, /没有重新连续播放/);
  assert.match(c.existing_record.typography, /本段没有地名粗体标题/);
  assert.equal(film.cases.filter(c => c.visual_annotations).length, 1);
});

test('annotation search and static details carry visual evidence without needing JavaScript', () => {
  const c = JSON.parse(text('read/films/amazonia.json')).cases.find(c => c.id === 'amazonia-broll-01');
  assert.match(annotationSearchText(c.visual_annotations), /卫星影像/);
  assert.match(annotationSearchText(c.visual_annotations), /深棕/);
  const indexed = result.index.films.find(v => v.id === 'amazonia').cases.find(x => x.id === c.id);
  assert.equal(indexed.visual_annotation_available, true);
  assert.ok(indexed.visual_tags.includes('轮廓描线'));
  const html = text('read/films/amazonia.html');
  assert.equal([...html.matchAll(/data-visual-dimension=/g)].length, 12);
  assert.match(html, /标注依据与待核对项/);
  assert.doesNotMatch(html, /<script/i);
});

test('visual descriptions and labels are escaped before rendering', () => {
  const annotation = structuredClone(JSON.parse(text('read/films/amazonia.json')).cases.find(c => c.visual_annotations).visual_annotations);
  annotation.summary = '<script>alert(1)</script>';
  annotation.dimensions[0].description = '<img src=x onerror=alert(1)>';
  const html = renderVisualAnnotations(annotation);
  assert.doesNotMatch(html, /<script|<img src=x/i);
  assert.match(html, /&lt;script&gt;/);
});
