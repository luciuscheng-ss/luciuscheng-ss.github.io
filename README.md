# luciuscheng-ss.github.io

个人小工具分享站，https://luciuscheng-ss.github.io

## 怎么加新工具

1. 把文件放进 `downloads/`
2. 在 `index.html` 的 `<section class="tools">` 里复制一份 `<article class="card">...</article>`，改标题/描述/链接
3. `git add . && git commit -m "add xxx" && git push`

推送到 `main` 分支后，GitHub Pages 会自动重新部署，一般一两分钟内生效。

## 首页「小小守卫」

首页与小游戏共用 `style.css` 中的颜色、字体、边框和阴影变量，采用直角像素界面，
支持明暗主题。统一的本地图标位于 `assets/site/pixel-icons.svg`，无需加载外部字体或图标库。

在首页空白处点击或轻触，召唤像素小怪；怪物落地后，小骑士会自动追击。
地面达到 10 只怪物时，骑士蓄力清场（包含空中怪物），并暂停召唤 4 秒。
每 450 毫秒最多召唤一只，场上总上限 20 只；被限制的点击不会排队补生成。
工具卡片、链接、按钮、正文文字、选字和拖动操作不会召唤怪物。

提示条的「收起 / 开启守卫」支持键盘操作，并在本机记住开关状态。
关闭、切换到后台或窗口失焦时停止动画；支持浅色、深色和减少动态效果设置。

代码位于 `assets/knight-game/`：`core.mjs` 管理规则及可调整的 `CONFIG`，
`renderer.mjs` 绘制原创像素角色与特效，`game.mjs` 处理网页交互与生命周期，
`game.css` 管理提示条。仅首页加载，无外部依赖或构建步骤。

运行核心行为测试：`node --test tests/knight-game.test.mjs`。

本地预览（Python 3；显式设置 `.mjs` MIME，兼容 Windows 注册表默认值）：

```sh
python -c "import http.server,mimetypes; mimetypes.add_type('text/javascript','.mjs'); http.server.ThreadingHTTPServer(('127.0.0.1',8766),http.server.SimpleHTTPRequestHandler).serve_forever()"
```

浏览器打开 `http://127.0.0.1:8766/`。
