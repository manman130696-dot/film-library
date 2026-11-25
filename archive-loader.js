/* Read the original bundled archive without executing its scripts. */
window.FILM_LIBRARY_READY = (async () => {
  const config = {"categories":[{"name":"Vlog","description":"生活、旅行与日常记录","color":"#8baf88"},{"name":"视觉动效","description":"动态图形、动画、创意转场与合成","color":"#aa9ec4"},{"name":"纪录片","description":"人物、社会、自然与真实生活","color":"#8ba3b5"},{"name":"剧情短片","description":"故事、微电影与实验叙事","color":"#c79584"},{"name":"审美短片","description":"光影、氛围、摄影与情绪表达","color":"#c4a272"},{"name":"综艺包装","description":"花字、贴纸、节目片头与人物反应","color":"#c69bb1"},{"name":"商业与音乐影像","description":"产品、时尚、品牌广告、MV、舞蹈与节奏剪辑","color":"#98a77a"},{"name":"知识解说","description":"知识、评论、科技与操作演示","color":"#d8bb7a"}],"assignments":{"autumn":["Vlog","综艺包装","视觉动效","商业与音乐影像"],"appads":["知识解说","视觉动效"],"songmont":["商业与音乐影像","审美短片"],"whale":["知识解说","视觉动效"],"sapeur":["纪录片"],"home":["知识解说","视觉动效"],"capital":["知识解说"],"sail":["Vlog"],"harbin":["Vlog","纪录片"],"gold":["纪录片"],"africa":["Vlog","纪录片"],"deepseek":["知识解说"]}};
  const response = await fetch(new URL('film-library-public/index.html', document.baseURI));
  if (!response.ok) throw new Error('Archive HTTP ' + response.status);
  const source = await response.text();
  function read(variable) {
    const start = source.indexOf('window.' + variable + '=');
    if (start < 0) throw new Error('Missing archive data: ' + variable);
    const from = start + variable.length + 8;
    const end = source.indexOf(';</script>', from);
    if (end < 0) throw new Error('Incomplete archive data: ' + variable);
    return JSON.parse(source.slice(from, end));
  }
  const data = read('FILM_LIBRARY');
  const prompts = read('FILM_PROMPTS');
  const assets = read('FILM_ASSETS');
  for (const video of data.videos) {
    video.subjects = [...video.categories];
    if (config.assignments[video.id]) video.categories = config.assignments[video.id];
  }
  const entryPaths = ['entries/cityride.json', 'entries/cognition-gap.json', 'entries/casetify.json'];
  const additions = await Promise.all(entryPaths.map(async path => {
    const addition = await fetch(new URL(path, document.baseURI));
    if (!addition.ok) throw new Error('Film entry HTTP ' + addition.status + ': ' + path);
    return addition.json();
  }));
  for (const {cases: entryCases = [], prompts: entryPrompts = [], ...video} of additions) {
    const existing = data.videos.findIndex(item => item.id === video.id);
    if (existing >= 0) data.videos.splice(existing, 1);
    data.videos.unshift(video);
    data.cases = [...entryCases, ...data.cases.filter(item => item.videoId !== video.id)];
    prompts[video.id] = entryPrompts;
  }
  // Add one palette reference per film without replacing its original cases or prompts.
  const paletteResponse = await fetch(new URL('entries/palette-references.json', document.baseURI));
  if (!paletteResponse.ok) throw new Error('Palette references HTTP ' + paletteResponse.status);
  const paletteData = await paletteResponse.json();
  for (const reference of paletteData.references) {
    const video = data.videos.find(item => item.id === reference.videoId);
    if (!video) throw new Error('Missing palette film: ' + reference.videoId);
    const groups = reference.groups.map(group => {
      const original = data.cases.find(item => item.videoId === video.id && item.title === group.sourceTitle);
      if (!original) throw new Error('Missing palette source: ' + video.id + ': ' + group.sourceTitle);
      return {...group, sourceCaseId: original.id, image: original.image || video.poster, start: original.start, end: original.end};
    });
    const first = groups[0];
    const apply = groups.map(group => `${group.name}\n对标：${group.sourceTitle}（${group.start}–${group.end}秒）\n近似参考色：${group.colors.map(color => `${color.role} ${color.hex}（${color.use}）`).join('；')}\n${group.proportions}\nB镜用法：${group.broll}\n制作提示词：${group.prompt}`).join('\n\n');
    const palette = {
      id: video.id + '-palette', videoId: video.id, kind: 'palette', title: reference.title,
      tags: ['配色参考', '包装配色', 'B镜'], start: first.start, end: first.end, image: first.image,
      structure: reference.summary, typography: groups.map(group => group.colors.map(color => color.role + ' ' + color.hex).join('；')).join(' / '),
      motion: '本条整理配色；动作方法参照各组对应的原包装案例。', why: reference.summary,
      apply: paletteData.note + '\n\n' + apply, palette: {note: paletteData.note, groups}
    };
    data.cases = [palette, ...data.cases.filter(item => item.id !== palette.id)];
  }
  data.categories = config.categories;
  data.updatedAt = '2026-11-25';
  window.FILM_LIBRARY = data;
  window.FILM_PROMPTS = prompts;
  window.FILM_ASSETS = assets;
  window.FILM_LOCAL = {};
})();


