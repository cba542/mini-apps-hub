# Mini Apps Hub (Flask) / 迷你应用合集（Flask Hub）

A Flask hub app that mounts multiple mini apps (static apps + Flask blueprint apps).
一个用 Flask 挂载多个迷你应用的 Hub（静态页面 + Blueprint 应用）。

## Apps / 子应用

- Dianping Review Generator / 大众点评评论生成器
  Path: `/dianping-review/`

- Event Calendar (Carnival & UP Coupons) / 嘉年华 & UP券 活动月历
  Path: `/event-calendar/`

- Meal Time Planner / 用餐排成（含共享房间）
  Path: `/meal-time-planner/`

- Web Game Egg / 网页小游戏原型
  Path: `/web-game-egg/`

## Run Locally / 本地运行

1) Create venv / 创建虚拟环境

```bash
python -m venv .venv
```

2) Activate / 激活

- Windows:

```bash
.venv\Scripts\activate
```

- macOS/Linux:

```bash
source .venv/bin/activate
```

3) Install deps / 安装依赖

```bash
pip install -r requirements.txt
```

4) Run / 启动

```bash
python app.py
```

Open / 访问:

- Hub / 首页: `http://127.0.0.1:5000/`
- Dianping / 点评: `http://127.0.0.1:5000/dianping-review/`
- Event Calendar / 活动月历: `http://127.0.0.1:5000/event-calendar/`
- Meal Planner / 用餐排成: `http://127.0.0.1:5000/meal-time-planner/`
- Web Game / 小游戏: `http://127.0.0.1:5000/web-game-egg/`

## Configuration / 配置

### Dianping Review Generator / 大众点评评论生成器

Recommended: use environment variables (no `config.json` required).
推荐：使用环境变量（不需要 `config.json`）。

- `AI_API_KEY` (required / 必填)
- `AI_BASE_URL` (optional / 可选, default: `https://open.bigmodel.cn/api/coding/paas/v4`)
- `AI_MODEL` (optional / 可选, default: `glm-4.7`)

Optional (local only): you may create `dianping-review/config.json`, but it MUST NOT be committed.
可选（仅本地）：你可以创建 `dianping-review/config.json`，但不要提交到 Git。

## Deploy on Render / Render 部署

- Build Command:

```bash
pip install -r requirements.txt
```

- Start Command:

```bash
gunicorn -w 2 -b 0.0.0.0:$PORT app:app
```

Set Environment Variables / 设置环境变量:

- `AI_API_KEY`
- `AI_BASE_URL` (optional)
- `AI_MODEL` (optional)

## Test API Keys (BigModel / Gemini) / 测试 API Key（智谱 / Gemini）

Use the interactive tester / 使用交互式测试脚本：

```bash
python test_ai_api.py
```

- Choose provider: BigModel (default) or Gemini.
- It reads env vars first; if missing, it will prompt for input (hidden), and prints length + masked preview for confirmation.
- 先读环境变量；缺失时会提示输入（隐藏输入），并显示长度 + 掩码前后码便于确认。

Environment variables / 环境变量:

- BigModel: `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL`
- Gemini: `GEMINI_API_KEY`, `GEMINI_MODEL` (default: `gemini-2.0-flash`)

## Notes / 说明

- `event-calendar/` loads `html2canvas` via CDN for exporting images.
- `event-calendar/` 目前通过 CDN 加载 `html2canvas` 用于导出图片。

## Security Notes / 安全注意事项

- Do NOT commit API keys, `config.json`, `.env`, or any local DB files.
- If you deploy publicly, protect endpoints to avoid draining your API quota.
- 不要提交 API key、`config.json`、`.env`、本地数据库文件。
- 若部署到公网，请加访问保护，避免额度被刷。

## License / 许可证

MIT
