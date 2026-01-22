from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass
from typing import List

import requests
from flask import Flask, redirect, render_template, request, url_for

app = Flask(__name__)

APP_PATH = "/dianping-review"


def get_links() -> list[dict]:
    return [
        {"name": "Dianping Review Generator", "path": APP_PATH},
    ]


# ----------------------------
# Config
# ----------------------------
CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.json")
STYLES_PATH = os.path.join(os.path.dirname(__file__), "styles.json")


def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def load_styles(path: str) -> List[dict]:
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


STYLE_SAMPLES: List[dict] = []
STYLES_ERROR = ""
try:
    STYLE_SAMPLES = load_styles(STYLES_PATH)
except FileNotFoundError:
    STYLES_ERROR = f"Styles file not found: {STYLES_PATH}"
except Exception as exc:  # noqa: BLE001
    STYLES_ERROR = f"Failed to read styles file: {exc}"


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


@app.route("/")
def root():
    return render_template("home.html", links=get_links())


@app.route(APP_PATH, methods=["GET", "POST"])
@app.route(f"{APP_PATH}/", methods=["GET", "POST"])
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
