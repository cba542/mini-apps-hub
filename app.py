from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass
from typing import List

import requests
from flask import Flask, render_template, request

app = Flask(__name__)


# ----------------------------
# Config
# ----------------------------
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


CONFIG: dict = {}
CONFIG_ERROR = ""
try:
    CONFIG = load_config(CONFIG_PATH)
except FileNotFoundError:
    CONFIG_ERROR = f"Config file not found: {CONFIG_PATH}"
except Exception as exc:  # noqa: BLE001
    CONFIG_ERROR = f"Failed to read config file: {exc}"


def get_config_value(key: str, default: str) -> str:
    value = CONFIG.get(key, default)
    return value if isinstance(value, str) else default


AI_API_KEY = get_config_value("AI_API_KEY", "")
AI_BASE_URL = get_config_value("AI_BASE_URL", "https://open.bigmodel.cn/api/coding/paas/v4")
AI_MODEL = get_config_value("AI_MODEL", "glm-4.7")

DEFAULT_RESTAURANT = get_config_value("DEFAULT_RESTAURANT", "Restaurant Name")
DEFAULT_NOTES = get_config_value(
    "DEFAULT_NOTES",
    "Length 120-180 words.\nTone should feel natural and real.\nMention:\n- Easy to find\n- Serving speed\n- Allow one small downside\nAvoid ad-like phrases.",
)


# ----------------------------
# Style samples (add 2+)
# ----------------------------
STYLE_SAMPLES = [
    {
        "name": "细节路线",
        "sample": """
上次路过就注意到这家店，这次终于来试。位置在地铁口出来不远，走几分钟就到。店里不大但挺干净，座位间距也还行。\n
点了招牌菜，分量比想象中足，口味偏家常但不寡淡。上菜速度算快，没等太久。唯一的小问题是高峰期有点吵，不过还能接受。\n
整体体验不错，下次想试试别的菜。
""".strip(),
    },
    {
        "name": "接地气",
        "sample": """
味道还可以，整体偏清爽，不会腻。店里空间挺大，适合朋友一起吃。\n
菜上得挺快，服务员也会主动问要不要加汤。小缺点是有些菜偏咸一点点，不过不影响。\n
位置挺方便，吃完顺路还能逛逛。
""".strip(),
    },
    {
        "name": "路线指引",
        "sample": """
终于实现了鳗鱼饭自由，这家店在地铁站出来的商场里。一定要看好它所在的区，从几号门过去，否则的话会走很远，找很久。店面不是很大，不过里面的氛围还挺好的。工作日的晚上感觉人比较少。\n
鳗鱼很不错，不是那种搞了很多酱却不新鲜的那种，而是真的货真价实。摆盘很有视觉冲击力，照片拍起来很好看。\n
吃完觉得很满足，整体体验很不错。
""".strip(),
    },
    {
        "name": "简洁实用",
        "sample": """
食材还可以，中规中矩，胜在价格划算环境好。每次到这边玩都会来吃这家，也不用排队，有上下两层。\n
他们家的茶挺独特，入口后有回甘，问过服务员说是特色茶。整体性价比挺高的。
""".strip(),
    },
    {
        "name": "新品打卡",
        "sample": """
新开的一家日料店，特意跑去打卡。装修不是很日式，但是还算宽敞舒适。服务员很多，所以服务还是很到位的，态度也很不错。\n
价格不算贵，三个人吃了400，有些菜还是很划算的。整体感觉菜量很足，不管是三文鱼沙拉还是黑椒牛舌，都给了好多。\n
小问题是桌上没有放酱油、调味料，连牙签也没有，感觉有点奇怪。
""".strip(),
    },
    {
        "name": "总结推荐",
        "sample": """
心目中排名前三的茶餐厅。餐厅周边交通超级方便，地铁口直达，吃完走两分钟到地铁站刚好消食，不需要排队，直接落座。\n
烧鹅一点也不柴但肉会肥一点点，份量很足。鸡排包打包回去加热后也好吃。\n
总结：出品都很好，选择也很多，烧腊真的非常好吃！下次再来试试新品。
""".strip(),
    },
]


@dataclass
class AIConfig:
    api_key: str
    base_url: str
    model: str
    timeout_sec: int = 60


def pick_random_style(styles: List[dict]) -> dict:
    if len(styles) < 2:
        raise ValueError("STYLE_SAMPLES 需要至少 2 种风格")
    return random.choice(styles)


def build_messages(restaurant: str, notes: str, style: dict) -> list[dict]:
    system = (
        "你是一位在大众点评/美团平台写餐厅评论的普通用户。"
        "请严格模仿给定样例的语气和风格。"
        "输出必须像真人口吻，不要模板化、不要广告感。"
    )

    user = f"""
请为餐厅《{restaurant}》生成一条评论。\n
【模仿风格样例】\n{style["sample"]}\n
【注意事项】\n{notes}\n
【额外要求】\n- 只输出评论正文\n- 不要提到 AI/模型/提示词\n- 允许一点小缺点
""".strip()

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def call_chat_api(cfg: AIConfig, messages: list[dict]) -> str:
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": cfg.model,
        "messages": messages,
        "temperature": 0.9,
    }

    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=cfg.timeout_sec)
    if resp.status_code != 200:
        raise RuntimeError(f"API Error {resp.status_code}: {resp.text}")

    return resp.json()["choices"][0]["message"]["content"].strip()


@app.route("/", methods=["GET", "POST"])
def index():
    error = CONFIG_ERROR
    result = ""
    style_name = ""
    prompt_preview = ""

    restaurant = DEFAULT_RESTAURANT
    notes = DEFAULT_NOTES
    dry_run = False

    if request.method == "POST" and not error:
        restaurant = request.form.get("restaurant", "").strip()
        notes = request.form.get("notes", "").strip()
        dry_run = request.form.get("dry_run") == "1"

        if not restaurant:
            error = "请输入餐厅名称。"
        else:
            style = pick_random_style(STYLE_SAMPLES)
            style_name = style["name"]
            messages = build_messages(restaurant, notes, style)
            prompt_preview = messages[1]["content"]

            if dry_run:
                result = prompt_preview
            else:
                if not AI_API_KEY:
                    error = "AI_API_KEY is empty in config.json."
                else:
                    try:
                        cfg = AIConfig(
                            api_key=AI_API_KEY,
                            base_url=AI_BASE_URL,
                            model=AI_MODEL,
                        )
                        result = call_chat_api(cfg, messages)
                    except Exception as exc:  # noqa: BLE001
                        error = str(exc)

    return render_template(
        "index.html",
        error=error,
        result=result,
        style_name=style_name,
        prompt_preview=prompt_preview,
        restaurant=restaurant,
        notes=notes,
        dry_run=dry_run,
        model=AI_MODEL,
    )


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
