from __future__ import annotations

import importlib.util
import sys
import os

from flask import Flask, redirect, render_template, send_from_directory

APP_PATH = "/dianping-review"
WEB_GAME_PATH = "/web-game-egg"
WEB_GAME_DIR = os.path.join(os.path.dirname(__file__), "web-game-egg")
DIANPING_APP_PATH = os.path.join(os.path.dirname(__file__), "dianping-review", "app.py")

app = Flask(__name__)


def load_dianping_blueprint():
    spec = importlib.util.spec_from_file_location("dianping_review_app", DIANPING_APP_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to load Dianping app from {DIANPING_APP_PATH}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module.bp


def get_links() -> list[dict]:
    return [
        {"name": "Dianping Review Generator", "path": APP_PATH},
        {"name": "Web Game Egg", "path": f"{WEB_GAME_PATH}/"},
    ]


dianping_bp = load_dianping_blueprint()
app.register_blueprint(dianping_bp, url_prefix=APP_PATH)


@app.route("/")
def root():
    return render_template("home.html", links=get_links())


@app.route(WEB_GAME_PATH)
def web_game_root():
    return redirect(f"{WEB_GAME_PATH}/", code=302)


@app.route(f"{WEB_GAME_PATH}/")
def web_game_index():
    return send_from_directory(WEB_GAME_DIR, "index.html")


@app.route(f"{WEB_GAME_PATH}/<path:filename>")
def web_game_assets(filename: str):
    return send_from_directory(WEB_GAME_DIR, filename)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
