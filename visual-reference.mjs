export const VISUAL_DIMENSIONS = [
  ['style', '视觉风格'], ['subjects', '人物与物件造型'], ['texture', '材质与纹理'],
  ['color', '配色'], ['composition', '构图与空间'], ['animation', '动效方式'],
  ['rhythm', '运动节奏'], ['aesthetic', '整体审美气质'], ['typography', '文字与图形设计'],
  ['lighting', '光影处理'], ['camera', '镜头运动'], ['transition', '转场与画面衔接']
];

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const statusLabels = {
  archived_frames: '归档原帧核对', sequence_and_record: '连续采样与既有分析',
  interpretation: '审美归纳', not_applicable: '不适用', pending: '待核对'
};

export function annotationSearchText(annotation) {
  if (!annotation) return '';
  return [annotation.summary, ...(annotation.borrowScope || []), ...(annotation.searchTags || []),
    ...(annotation.dimensions || []).flatMap(d => [d.description, ...(d.tags || [])])].join(' ');
}

export function renderVisualAnnotations(annotation, { imageURL = p => p, seek = false } = {}) {
  if (!annotation) return '';
  const esc = escapeHTML;
  const dimensions = new Map(annotation.dimensions.map(d => [d.key, d]));
  const rows = list => `<dl class="visual-dimensions">${list.map(([key, label]) => {
    const d = dimensions.get(key);
    if (!d) return '';
    return `<div data-visual-dimension="${key}"><dt>${esc(label)}<span class="visual-status">${esc(statusLabels[d.status] || '待核对')}</span></dt><dd>${esc(d.description)}</dd></div>`;
  }).join('')}</dl>`;
  return `<section class="visual-annotation">
    <p class="visual-summary">${esc(annotation.summary)}</p>
    <div class="visual-tags" aria-label="视觉检索标签">${annotation.searchTags.map(t => `<span>${esc(t)}</span>`).join('')}</div>
    <p class="visual-borrow"><strong>可借鉴范围</strong>${esc(annotation.borrowScope.join(' · '))}</p>
    <div class="visual-evidence">${annotation.evidenceFrames.map(f => `<figure><img loading="lazy" src="${esc(imageURL(f.image))}" alt="${esc(f.caption)}"><figcaption>${Number(f.time).toFixed(2)} 秒 · ${esc(f.caption)}${seek ? `<button class="time-button" data-jump="${Number(f.time)}">回看此处</button>` : ''}</figcaption></figure>`).join('')}</div>
    <h4>主要视觉维度</h4>${rows(VISUAL_DIMENSIONS.slice(0, 8))}
    <details class="visual-extra"><summary>文字、光影、镜头与转场</summary>${rows(VISUAL_DIMENSIONS.slice(8))}</details>
    <details class="visual-basis"><summary>查看标注依据与待核对项</summary><p>${esc(annotation.evidenceBasis)}</p><p>${esc(annotation.pending.join('；'))}</p></details>
  </section>`;
}
