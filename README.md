# 大众点评评论生成器

一个基于 Flask 和 AI 的餐厅评论生成工具，可以自动生成风格多样的餐厅评论。

## 功能特点

- 🎨 **6种评论风格**：细节路线、接地气、路线指引、简洁实用、新品打卡、总结推荐
- 🤖 **AI 驱动**：使用智谱 AI GLM 模型生成自然真实的评论
- 🌐 **Web 界面**：简洁易用的 Flask Web 应用
- ⚙️ **灵活配置**：支持自定义餐厅名称和评论要求
- 📝 **一键生成**：快速生成符合要求的餐厅评论

## 安装

### 1. 克隆仓库

```bash
git clone https://github.com/cba542/dianping_review_generator.git
cd dianping_review_generator
```

### 2. 创建虚拟环境

```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate
```

### 3. 安装依赖

```bash
pip install -r requirements.txt
```

### 4. 配置

创建 `config.json` 文件：

```json
{
  "AI_API_KEY": "你的智谱AI API密钥",
  "AI_BASE_URL": "https://open.bigmodel.cn/api/coding/paas/v4",
  "AI_MODEL": "glm-4.7",
  "DEFAULT_RESTAURANT": "Restaurant Name",
  "DEFAULT_NOTES": "Length 120-180 words.\nTone should feel natural and real.\nMention:\n- Easy to find\n- Serving speed\n- Allow one small downside\nAvoid ad-like phrases."
}
```

### 5. 启动应用

```bash
python app.py
```

访问 http://127.0.0.1:5000

## 使用方法

1. 输入餐厅名称
2. （可选）调整评论要求
3. 点击"生成评论"按钮
4. 等待 AI 生成评论
5. 复制生成的评论到大众点评

## 评论风格说明

| 风格 | 特点 |
|------|------|
| 细节路线 | 详细描述位置和路线 |
| 接地气 | 朴实自然，注重性价比 |
| 路线指引 | 强调交通和门牌信息 |
| 简洁实用 | 言简意赅，突出重点 |
| 新品打卡 | 新店体验风格 |
| 总结推荐 | 给出明确评价和推荐 |

## 部署到云端

### 使用 Render 部署（推荐）

1. 将代码上传到 GitHub（config.json 和 styles.json 会被自动忽略）
2. 登录 [Render](https://dashboard.render.com)
3. 创建新的 Web Service
4. 连接 GitHub 仓库
5. 配置：
   - **Runtime**: Python 3
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `gunicorn app:app`
6. 使用 Secret Files 添加 config.json
7. 部署完成，获得公网 URL

### 使用 Railway 部署

1. 访问 [Railway](https://railway.app)
2. 创建新项目，连接 GitHub
3. 选择 `dianping_review_generator` 仓库
4. 自动部署（$5/月，不休眠）

### 使用自己的服务器

推荐设备：
- **树莓派 4**：月电费约 ¥1-2，性能足够
- **旧笔记本**：月电费约 ¥5-10，零设备成本

部署命令：
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

## 文件说明

```
dianping_review_generator/
├── app.py                 # Flask 主应用
├── config.json           # 配置文件（不提交到 Git）
├── styles.json          # 评论风格模板（不提交到 Git）
├── requirements.txt     # Python 依赖
├── templates/
│   └── index.html      # Web 界面
├── .gitignore          # Git 忽略文件
└── README.md           # 说明文档
```

## 配置文件

### config.json

```json
{
  "AI_API_KEY": "智谱AI API密钥",
  "AI_BASE_URL": "API基础URL",
  "AI_MODEL": "模型名称（glm-4.7）",
  "DEFAULT_RESTAURANT": "默认餐厅名称",
  "DEFAULT_NOTES": "默认评论要求"
}
```

### styles.json

包含6种评论风格的模板，可以自由添加或修改风格。

## 技术栈

- **后端**: Flask 3.0.3
- **AI 模型**: 智谱 AI GLM-4.7
- **Web 服务器**: Gunicorn 21.2.0
- **部署**: Render / Railway / 自建服务器

## 注意事项

- ⚠️ **不要将 config.json 和 styles.json 上传到公开仓库**
- ⚠️ **Render 免费版会休眠，首次访问可能有 50 秒延迟**
- ⚠️ **API 密钥需要到[智谱AI开放平台](https://open.bigmodel.cn/)申请**

## 常见问题

### Q: 如何获取智谱 AI API 密钥？
A: 访问 [智谱AI开放平台](https://open.bigmodel.cn/) 注册账号并申请 API 密钥。

### Q: 免费版可以一直用吗？
A: 是的，但会有休眠延迟。如需24/7在线，建议升级到付费版或使用自己的服务器。

### Q: 可以添加新的评论风格吗？
A: 可以，在 `styles.json` 中添加新的风格对象即可。

### Q: 如何修改评论长度？
A: 在 `config.json` 的 `DEFAULT_NOTES` 中修改字数要求。

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 联系方式

如有问题，请在 GitHub 上提 Issue。

---

**Made with ❤️ by CBA542**
