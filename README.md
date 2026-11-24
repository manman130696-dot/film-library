# 满的公开片库

[打开片库](https://manman130696-dot.github.io/film-library/)

影像片段、拉片分析、包装动效设计和制作提示词。

支持 Vlog、视觉动效、纪录片、剧情短片、审美短片、综艺包装、商业与音乐影像、知识解说。品牌广告和音乐影像合并为「商业与音乐影像」。一部作品可属于多个分类，分类筛选可与搜索、用途标签和分析状态组合使用，手机端也可筛选。

## 部署

GitHub Pages 选择 Deploy from a branch、main、/(root)。

请同时保留根目录的 `index.html`、`archive-loader.js`、`categories.json` 与 `film-library-public/index.html`，不能只上传单个首页。首页从原始归档读取预览、封面、分析与提示词，再应用新的分类。

`archive-loader.js` 内的分类配置与 `categories.json` 应同步修改；后者也用于自动检查。检查只读取仓库，不提交或推送内容。

秋游为完整轻量预览，其余 11 部为前 10 秒预览；完整原片未全部上传。未完成的分析和声音听辨保留原状态。公开版不含本机原片路径或私人联系信息。

## 创作资源

桌面侧栏和手机导航新增独立的「动效工具」入口：[`tools.html`](https://manman130696-dot.github.io/film-library/tools.html)。

目前收录「开场实验室」可替换动效模板及使用说明。模板下载链接指向 ChatGPT 中的文件，需要登录有访问权限的账号；不改变文件的原有权限。工具页面不加载影片归档，不计入视频或案例数量。
