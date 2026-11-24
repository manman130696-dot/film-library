from pathlib import Path
import json,re,copy,html
R=Path(__file__).resolve().parents[1];P=R/'reports/cityride'
def read(n):return json.loads((P/n).read_text())
d=read('shots.json');a=read('analysis.json');b=read('broll.json');prompts=read('reverse-prompts.json')
placeholder='assets/cityride-pending.svg'
cases=[]
for c in b:
 c=copy.deepcopy(c);c['image']=placeholder;cases.append(c)
for i,(time,title,why,apply) in enumerate([
 (51.484818,'篮球连拍：中央大图与周边网格','中心大图承担动作峰值，周边重复小图保留运动记忆。','用统一边框铺周边小图，再叠中央竖图；不同时移动所有图层。'),
 (72.806139,'木纹底人像照片拼贴','照片错角叠放，中央近图接手势，让成果像一本翻开的相册。','先统一色调与白边，小图先成组，主图后叠入并停读。'),
 (79.479479,'白相机锁中与背景旋转','强运动集中在背景，产品留在注意中心；实拍与合成的占比未知。','先锁产品中心，再试背景旋转与径向模糊，最后接持握人物。'),
 (114.781448,'宠物功能卡：文字左、样张右','固定文字锚点，犬猫图替换和橙红底色变化传达拍摄结果。','先定字阶、对齐和照片区，再设计照片叠入、替换与停读。'),
 (138.171505,'固定圆角窗里的日常组接','固定容器把孩子、宠物、人物与相机组成回忆，内部仍有独立剪辑。','先定外框与点线装饰，再按动作结果切换内部素材。')],1):
 s=next(x for x in d['shots'] if x['start']-1e-6<=time<x['end']);cases.append(dict(id=f'cityride-motion{i:02}',videoId='cityride',start=time,end=s['end'],title=title,tags=['包装','动效','风格参考'],image=placeholder,structure=s['frame'],typography=s.get('onscreenText') or '边框与底板保持统一，字阶以画面原有排版为依据。',motion=s['fight'],why=why,apply=apply))
entry=dict(id='cityride',title='城市中的艺术有很多面 · City Ride',subtitle='暖阳城市骑摄 · 15 组 B 镜 · 摄影与动效拆解',summary='暖阳、红砖与绿荫、低位骑行，人物发现与相机拍摄结果交替。已整理114个镜头／复合包装段、15组B镜和127个摄影时间窗。在线先提供文字报告；视频和截图待确认公开，声音仍待试听。',preference='用户原话：“我很喜欢这种风格”“这个片子有些镜头可以用作b镜”。本次归纳：暖色城市生活感、人物稳定的跟拍、低机位细节、白边照片与圆角视窗。具体维度尚未逐项获得用户确认。',categories=['Vlog','审美短片','商业与音乐影像'],subjects=['城市骑行','佳能 R50','摄影','B-roll'],tags=['喜欢的风格','B镜','摄影与剪辑','照片拼贴'],status='partial',statusLabel='画面已拆解 · 声音待试听',duration=d['meta']['durationSeconds'],previewDuration=0,fullPreview=False,preview=None,poster=placeholder,report='reports/cityride/online-report.html',audioStatus='原片有音轨；未实际听辨，未做ASR。',shots=d['shots'],topics=a['topics'],notes=[dict(title='B 镜清单',text='\n'.join(f"{c['start']:.3f}–{c['end']:.3f} 秒｜{c['title']}｜{c['why']}\n重拍：{c['apply']}" for c in b)),dict(title='观察方法与限制',text=a['method']+'\n\n'+'\n'.join(a['limits']))],cases=cases,prompts=prompts)
(R/'entries/cityride.json').write_text(json.dumps(entry,ensure_ascii=False,indent=2)+'\n')
# Derive a text-only public report without source-derived media payloads.
h=(P/'shots-report.html').read_text()
extra_css='<style id="cityride-layout">.shot-heading{display:grid!important;gap:4px!important}.shot-heading .id,.shot-heading .range{grid-column:1}.shot-heading h3{grid-column:1;grid-row:3}.timeline{overflow-x:auto;max-width:100%}.segment{flex-shrink:0}.screen-toolbar{overflow-wrap:anywhere}.source-slip .file{overflow-wrap:anywhere}.broll-table-wrap{overflow:auto}.broll-table{width:100%;border-collapse:collapse;min-width:620px}.broll-table th,.broll-table td{padding:12px;text-align:left;border-bottom:1px solid #cbd0c1;vertical-align:top;font-size:14px}</style>'
h=re.sub(r'<style id="cityride-layout">.*?</style>','',h,flags=re.S)
h=h.replace('</head>',extra_css+'</head>')
rows=''.join(f'<tr><td><button data-seek="{c["start"]}">{c["start"]:.2f}–{c["end"]:.2f}s</button></td><td><strong>{html.escape(c["title"])}</strong><br>{html.escape(c["why"])}</td><td>{html.escape(c["apply"])}</td></tr>' for c in b)
block='<!--CITYRIDE-BROLL--><section class="section" id="broll"><div class="section-heading"><div><p class="eyebrow">B-ROLL / 15 SELECTIONS</p><h2>适合做 B 镜的片段</h2></div><a href="broll.md">下载 B 镜清单</a></div><p>选段按原片时间定位；用途与重拍方法为创作建议。先选择本地原片，时间按钮即可用于回看。</p><div class="broll-table-wrap"><table class="broll-table"><thead><tr><th>原片秒数</th><th>内容与用途</th><th>重拍方法</th></tr></thead><tbody>'+rows+'</tbody></table></div></section><!--/CITYRIDE-BROLL-->'
h=re.sub(r'<!--CITYRIDE-BROLL-->.*?<!--/CITYRIDE-BROLL-->','',h,flags=re.S)
h=re.sub(r'(<section\b[^>]*\bid="prompts"[^>]*>)',lambda m:block+m.group(1),h,count=1)
if 'href="#broll"' not in h:h=h.replace('<a href="#prompts">','<a href="#broll">B 镜清单</a><a href="#prompts">',1)
(P/'shots-report.html').write_text(h)
blank='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22640%22 height=%22360%22%3E%3Crect width=%22640%22 height=%22360%22 fill=%22%2319362e%22/%3E%3Ctext x=%22320%22 y=%22180%22 text-anchor=%22middle%22 fill=%22%23f2ede2%22 font-size=%2224%22%3E%E7%94%BB%E9%9D%A2%E5%BE%85%E7%A1%AE%E8%AE%A4%E5%85%AC%E5%BC%80%3C/text%3E%3C/svg%3E'
h=re.sub(r'(?:frames|portraits)/[A-Za-z0-9]+\.svg',lambda m:blank,h)
h=h.replace(' src="preview-web.mp4"','')
h=re.sub(r'<button[^>]*data-source="[^"]*"[^>]*>.*?</button>','',h)
h=re.sub(r'<a href="(?:source-original|preview-web)\.mp4">.*?</a>','<span>视频待确认公开，可选择本地原片回看。</span>',h)
h=h.replace('完整轻量预览 · 854×480 · H.264 / AAC','在线文字报告 · 请选择本地原片回看')
h=h.replace('<body>','<body><div style="padding:12px 3.2vw;background:#dcc697;color:#19362e;font-size:16px">在线文字版：逐镜观察、B 镜位置与提示词可查看。原片和截图暂未公开；可在播放器下方选择本地原片回看。声音待实际试听。</div>')
(P/'online-report.html').write_text(h)
qa=dict(sourceRead='passed',sourceSeconds=d['meta']['durationSeconds'],shotIntervals=len(d['shots']),windows=len(read('timed-camera-prompts.json')['windows']),fullTimeDomainDecode=True,visualMethod=a['method'],audioPreserved=True,audioListened=False,asr=False,continuousVisualPlayback=False,browser='本机连接失败；备用浏览器启动和端口受环境限制。线上文字页交由仓库浏览器检查。',desktop='pending CI',mobile='pending CI',publication='Public text report only; source-derived images and videos await explicit publication approval')
(P/'frontend-qa.json').write_text(json.dumps(qa,ensure_ascii=False,indent=2)+'\n')
print('Integrated 15 B-roll + 5 motion cases; public text report prepared')
