# 片库直接读取入口

- 总目录：https://manman130696-dot.github.io/film-library/read/
- 结构化索引：https://manman130696-dot.github.io/film-library/read/index.json
- 按索引中的 details_json / details_html 读取单片资料；网页文字无需运行 JavaScript。
- 图片为原有归档截图。影片内的 viewer_url 定位到既有片库的影片和案例；旧归档视频继续由原播放器提供，不复制视频到索引。
- 无需登录、付费服务或手动导出。读取方仍需有访问这些公开网址的能力；入口存在不等于每次会话均可联网。
- 视觉标注按片段补充，核验依据随项保留。existing_record 与 adaptation_suggestion 分开；空的 visual_annotations 表示待补。
- preview_covers_range 明确该范围是否在公开预览内；图片有档案不代表视频范围可播放。
- 维护：在仓库根目录运行 node scripts/build-reading-index.mjs；源资料变动后重建，并提交生成的 read/。
- 检查：node --test tests/reading-index.test.mjs，然后 node scripts/build-reading-index.mjs --check。
- 更新依据：source_digest 为实际输入文件摘要，更新时间沿用片库记录，不用构建时间冒充审看时间。
