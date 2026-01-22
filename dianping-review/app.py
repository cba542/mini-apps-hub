from __future__ import annotations

import json
import os
import random
from dataclasses import dataclass
from typing import List

import requests
from flask import Blueprint, render_template, request


bp = Blueprint("dianping_review", __name__, template_folder="templates")


# ----------------------------
# Config
# ----------------------------
CONFIG_PATH = os.environ.get(
    "CONFIG_PATH",
    os.path.join(os.path.dirname(__file__), "config.json"),
)
STYLES_PATH = os.environ.get(
    "STYLES_PATH",
    os.path.join(os.path.dirname(__file__), "styles.json"),
)


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
        raise ValueError("STYLE_SAMPLES ???? 2 ???")
    return random.choice(styles)


def build_messages(restaurant: str, notes: str, style: dict) -> list[dict]:
    system = (
        "\u4f60\u662f\u4e00\u4f4d\u5728\u5927\u4f17\u70b9\u8bc4/\u7f8e\u56e2\u5e73\u53f0\u5199\u9910\u5385\u8bc4\u8bba\u7684\u666e\u901a\u7528\u6237\u3002"
        "\u8bf7\u4e25\u683c\u6a21\u4eff\u7ed9\u5b9a\u6837\u4f8b\u7684\u8bed\u6c14\u548c\u98ce\u683c\u3002"
        "\u8f93\u51fa\u5fc5\u987b\u50cf\u771f\u4eba\u53e3\u543b\uff0c\u4e0d\u8981\u6a21\u677f\u5316\u3001\u4e0d\u8981\u5e7f\u544a\u611f\u3002"
    )

    user = f"""
\u8bf7\u4e3a\u9910\u5385《{restaurant}》\u751f\u6210\u4e00\u6761\u8bc4\u8bba\u3002\n
\u3010\u6a21\u4eff\u98ce\u683c\u6837\u4f8b\u3011\n{style["sample"]}\n
\u3010\u6ce8\u610f\u4e8b\u9879\u3011\n{notes}\n
\u3010\u989d\u5916\u8981\u6c42\u3011\n- \u53ea\u8f93\u51fa\u8bc4\u8bba\u6b63\u6587\n- \u4e0d\u8981\u63d0\u5230 AI/\u6a21\u578b/\u63d0\u793a\u8bcd\n- \u5141\u8bb8\u4e00\u70b9\u5c0f\u7f3a\u70b9
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


@bp.route("", methods=["GET", "POST"])
@bp.route("/", methods=["GET", "POST"])
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
            error = "????????"
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
