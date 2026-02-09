from __future__ import annotations

import json
import os
import sys
from dataclasses import dataclass
from getpass import getpass
from typing import Callable

import requests


DEFAULT_BASE_URL = "https://open.bigmodel.cn/api/coding/paas/v4"
DEFAULT_MODEL = "glm-4.7"
DEFAULT_GEMINI_MODEL = "gemini-2.0-flash"


@dataclass
class AIConfig:
    provider: str
    api_key: str
    base_url: str
    model: str
    timeout_sec: int = 30


def mask(value: str) -> str:
    if not value:
        return "(empty)"
    if len(value) <= 8:
        return value[0] + "***" + value[-1]
    return value[:4] + "***" + value[-4:]


def stars(value: str, cap: int = 60) -> str:
    length = len(value)
    if length <= cap:
        return "*" * length
    return ("*" * cap) + f"(+{length - cap})"


def prompt_provider() -> str:
    print("Select provider: [1] bigmodel (default) | [2] gemini")
    try:
        choice = input("> ").strip()
    except EOFError:
        return "bigmodel"
    if choice == "2" or choice.lower() == "gemini":
        return "gemini"
    return "bigmodel"


def prompt_or_env(key: str, prompt_text: str, secret: bool = False) -> str:
    val = os.environ.get(key, "").strip()
    if val:
        return val
    if not sys.stdin.isatty():
        return ""
    if secret:
        return getpass(prompt_text).strip()
    return input(prompt_text).strip()


def build_payload_bigmodel(cfg: AIConfig) -> dict:
    messages = [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "Hello, reply with a short OK."},
    ]
    return {"model": cfg.model, "messages": messages, "temperature": 0.2}


def call_bigmodel(cfg: AIConfig) -> str:
    url = cfg.base_url.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {cfg.api_key}",
        "Content-Type": "application/json",
    }
    payload = build_payload_bigmodel(cfg)
    resp = requests.post(url, headers=headers, data=json.dumps(payload), timeout=cfg.timeout_sec)
    if resp.status_code != 200:
        raise RuntimeError(f"API Error {resp.status_code}: {resp.text}")
    data = resp.json()
    return data["choices"][0]["message"]["content"].strip()


def build_payload_gemini(cfg: AIConfig) -> dict:
    return {
        "contents": [
            {
                "role": "user",
                "parts": [{"text": "Hello, reply with a short OK."}],
            }
        ]
    }


def list_gemini_models(api_key: str, version: str) -> list[str]:
    url = f"https://generativelanguage.googleapis.com/{version}/models?key={api_key}"
    resp = requests.get(url, timeout=30)
    if resp.status_code != 200:
        raise RuntimeError(f"ListModels Error {resp.status_code}: {resp.text}")
    data = resp.json()
    out: list[str] = []
    for model in data.get("models", []) or []:
        if not isinstance(model, dict):
            continue
        methods = model.get("supportedGenerationMethods") or []
        if "generateContent" not in methods:
            continue
        name = str(model.get("name", ""))
        if name.startswith("models/"):
            name = name[len("models/") :]
        if name:
            out.append(name)
    return out


def pick_gemini_version(api_key: str) -> str:
    for version in ("v1beta", "v1"):
        try:
            list_gemini_models(api_key, version)
            return version
        except Exception:
            continue
    return "v1beta"


def call_gemini(cfg: AIConfig) -> str:
    version = pick_gemini_version(cfg.api_key)
    url = f"https://generativelanguage.googleapis.com/{version}/models/{cfg.model}:generateContent?key={cfg.api_key}"
    payload = build_payload_gemini(cfg)
    resp = requests.post(url, headers={"Content-Type": "application/json"}, data=json.dumps(payload), timeout=cfg.timeout_sec)
    if resp.status_code != 200:
        raise RuntimeError(f"API Error {resp.status_code}: {resp.text}")
    data = resp.json()
    candidates = data.get("candidates") or []
    if not candidates:
        raise RuntimeError(f"No candidates returned: {data}")
    parts = candidates[0].get("content", {}).get("parts", [])
    texts = [p.get("text", "") for p in parts if isinstance(p, dict)]
    return "\n".join(t for t in texts if t).strip()


def load_config_interactive() -> tuple[AIConfig, Callable[[AIConfig], str]]:
    if not sys.stdin.isatty():
        provider = os.environ.get("AI_PROVIDER", "bigmodel").strip().lower() or "bigmodel"
    else:
        provider = prompt_provider()

    if provider == "gemini":
        api_key = prompt_or_env("GEMINI_API_KEY", "Enter GEMINI_API_KEY (hidden): ", secret=True)
        if not api_key:
            sys.stderr.write("GEMINI_API_KEY is empty.\n")
            sys.exit(1)
        print(
            f"GEMINI_API_KEY received: {stars(api_key)} (len={len(api_key)}) "
            f"[{mask(api_key)}]"
        )

        model = os.environ.get("GEMINI_MODEL", DEFAULT_GEMINI_MODEL).strip() or DEFAULT_GEMINI_MODEL
        version = pick_gemini_version(api_key)
        try:
            available = list_gemini_models(api_key, version)
        except Exception as exc:  # noqa: BLE001
            sys.stderr.write(f"ListModels failed: {exc}\n")
            available = []
        if available and model not in available:
            sys.stderr.write(
                f"GEMINI_MODEL '{model}' not available for generateContent. "
                f"Try one of: {', '.join(available[:10])}\n"
            )
            sys.exit(1)
        cfg = AIConfig(provider=provider, api_key=api_key, base_url="https://generativelanguage.googleapis.com", model=model)
        return cfg, call_gemini

    # default: bigmodel
    api_key = prompt_or_env("AI_API_KEY", "Enter AI_API_KEY (hidden): ", secret=True)
    if not api_key:
        sys.stderr.write("AI_API_KEY is empty.\n")
        sys.exit(1)
    print(f"AI_API_KEY received: {stars(api_key)} (len={len(api_key)}) [{mask(api_key)}]")
    base_url = os.environ.get("AI_BASE_URL", DEFAULT_BASE_URL).strip() or DEFAULT_BASE_URL
    model = os.environ.get("AI_MODEL", DEFAULT_MODEL).strip() or DEFAULT_MODEL
    cfg = AIConfig(provider="bigmodel", api_key=api_key, base_url=base_url, model=model)
    return cfg, call_bigmodel


def print_tips(cfg: AIConfig) -> None:
    print("\nTips: set env for future runs")
    print("PowerShell:")
    print('  $env:AI_API_KEY="..."')
    print(f'  $env:AI_BASE_URL="{DEFAULT_BASE_URL}"')
    print(f'  $env:AI_MODEL="{DEFAULT_MODEL}"')
    print('  $env:GEMINI_API_KEY="..."')
    print(f'  $env:GEMINI_MODEL="{DEFAULT_GEMINI_MODEL}"')
    print("CMD:")
    print('  set AI_API_KEY=...')
    print(f'  set AI_BASE_URL={DEFAULT_BASE_URL}')
    print(f'  set AI_MODEL={DEFAULT_MODEL}')
    print('  set GEMINI_API_KEY=...')
    print(f'  set GEMINI_MODEL={DEFAULT_GEMINI_MODEL}')
    print("Run again:")
    print("  python test_ai_api.py")
    print("Current provider:", cfg.provider, "key:", mask(cfg.api_key))


def main() -> None:
    cfg, caller = load_config_interactive()
    try:
        result = caller(cfg)
    except Exception as exc:  # noqa: BLE001
        sys.stderr.write(f"Failed: {exc}\n")
        print_tips(cfg)
        sys.exit(1)
    print("Success, response:\n" + result)
    print_tips(cfg)


if __name__ == "__main__":
    main()
