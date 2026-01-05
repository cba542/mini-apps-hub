#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
review_style_rng.py
- 所有配置直接写在代码里
- 随机选择评论风格
- 生成大众点评/美食平台评论
"""

import json
import random
import requests
from dataclasses import dataclass
from typing import List


# ============================================================
# 🔧【配置区】—— 你平时只需要改这里
# ============================================================

AI_API_KEY = "0f7310fbc64748378b7ed20b796825b9.pfgsYeEYQc2MWrfd"          # ← 填你的 API Key
AI_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4"       # ← 第三方就换成它的
AI_MODEL = "glm-4.7"                        # ← 模型名

RESTAURANT_NAME = "桥尚复式料理（光明大街店）"

REVIEW_NOTES = """
字数 120~180 字
语气自然偏真实，不要营销感
需要提到：
- 环境或位置方便性
- 至少一道菜的口感
- 允许有一个小缺点
不要出现“强烈推荐”“必吃”这种广告词
"""

# True = 不调用 API，只打印 prompt（调试用）
# False = 正常生成评论
DRY_RUN = False


# ============================================================
# ✍️【风格范例区】—— 2~20 种都行
# ============================================================

STYLE_SAMPLES = [
    {
        "name": "13ami - 细节路线/带导航提示",
        "sample": """
终于实现了鳗鱼饭自由，这家店在港厦北地铁站出来的，深圳之眼那一个商场。一定要看好它所在的区，从几号门过去，否则会走很远。店面不算大，但氛围还不错，工作日晚上人也不多。

鳗鱼饭看图以为会很大，其实就是正常饭碗，好在鳗鱼本身分量挺足，吃完还是很满足。

鳗鱼味道很好，不是那种酱很多但不新鲜的类型，整体比较实在，摆盘也很有视觉效果，拍照很好看。
""".strip()
    },
    {
        "name": "sseeedddd - 接地气酒楼风",
        "sample": """
整体来说还可以，是一家比较接地气的酒楼，空间很大，也挺热闹，当地人来的比较多。

菜品选择很多，几道招牌味道都不错。如果大众点评等级高，有时还能碰到活动送券。

其他菜整体发挥稳定，熟度掌握得刚好，不会太柴。服务上也有一些小细节，比如中途会帮忙更换餐具，不过厕所稍微小了点。
""".strip()
    },
]


# ============================================================
# ⚙️ 内部实现（一般不用改）
# ============================================================

@dataclass
class AIConfig:
    api_key: str
    base_url: str
    model: str
    timeout_sec: int = 60


def pick_random_style(styles: List[dict]) -> dict:
    if len(styles) < 2:
        raise ValueError("STYLE_SAMPLES 至少需要 2 种风格")
    return random.choice(styles)


def build_messages(restaurant: str, notes: str, style: dict):
    system = (
        "你是一位擅长撰写大众点评/美食平台评论的用户。"
        "请严格模仿给定参考文本的语气、结构和真实感。"
        "输出必须像真人写的，不要广告感，不要模板感。"
    )

    user = f"""
请为餐厅「{restaurant}」生成一条评论。

【写作风格参考文本】：
{style["sample"]}

【写作注意事项】：
{notes}

【输出要求】
- 只输出评论正文
- 不要提到 AI、模型、生成等词
- 允许有一个小缺点
""".strip()

    return [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]


def call_chat_api(cfg: AIConfig, messages):
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

    r = requests.post(url, headers=headers, data=json.dumps(payload), timeout=cfg.timeout_sec)
    if r.status_code != 200:
        raise RuntimeError(f"API Error {r.status_code}: {r.text}")

    return r.json()["choices"][0]["message"]["content"].strip()


def main():
    cfg = AIConfig(
        api_key=AI_API_KEY,
        base_url=AI_BASE_URL,
        model=AI_MODEL,
    )

    style = pick_random_style(STYLE_SAMPLES)
    print(f"🎲 本次使用风格：{style['name']}\n")

    messages = build_messages(RESTAURANT_NAME, REVIEW_NOTES, style)

    if DRY_RUN:
        print("🧪 DRY RUN（未调用 API）\n")
        print(messages[1]["content"])
        return

    review = call_chat_api(cfg, messages)

    print("✅ 生成的评论：\n")
    print(review)


if __name__ == "__main__":
    main()
