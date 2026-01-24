from __future__ import annotations

import importlib.util
import sys
import os
import sqlite3
import string
import random
import time

from flask import Flask, redirect, render_template, send_from_directory, jsonify, request, abort


APP_PATH = "/dianping-review"
WEB_GAME_PATH = "/web-game-egg"
MEAL_PLANNER_PATH = "/meal-time-planner"
WEB_GAME_DIR = os.path.join(os.path.dirname(__file__), "web-game-egg")
MEAL_PLANNER_DIR = os.path.join(os.path.dirname(__file__), "meal-time-planner")
DIANPING_APP_PATH = os.path.join(os.path.dirname(__file__), "dianping-review", "app.py")

app = Flask(__name__)

db_path = os.path.join(os.path.dirname(__file__), "meal-time-rooms.db")


def init_db() -> None:
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS rooms (
                room_id TEXT PRIMARY KEY,
                data TEXT NOT NULL,
                updated_at INTEGER NOT NULL
            )
            """
        )


def generate_room_id(length: int = 6) -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(random.choice(alphabet) for _ in range(length))


def get_room(room_id: str) -> tuple[str, int] | None:
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute(
            "SELECT data, updated_at FROM rooms WHERE room_id = ?",
            (room_id,),
        )
        row = cursor.fetchone()
    if row is None:
        return None
    return row[0], int(row[1])


def create_room(data: str = "{}") -> tuple[str, int]:
    room_id = generate_room_id()
    now = int(time.time())
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            "INSERT INTO rooms (room_id, data, updated_at) VALUES (?, ?, ?)",
            (room_id, data, now),
        )
    return room_id, now


def update_room(room_id: str, data: str) -> int:
    now = int(time.time())
    with sqlite3.connect(db_path) as conn:
        cursor = conn.execute(
            "UPDATE rooms SET data = ?, updated_at = ? WHERE room_id = ?",
            (data, now, room_id),
        )
        if cursor.rowcount == 0:
            raise KeyError(room_id)
    return now



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
        {"name": "Meal Time Planner", "path": f"{MEAL_PLANNER_PATH}/"},
    ]


dianping_bp = load_dianping_blueprint()
app.register_blueprint(dianping_bp, url_prefix=APP_PATH)


@app.route("/api/rooms", methods=["POST"])
def create_room_endpoint():
    init_db()
    payload = request.get_json(silent=True) or {}
    data = payload.get("data")
    if data is None:
        data = "{}"
    if not isinstance(data, str):
        abort(400, description="data must be a string")
    for _ in range(5):
        room_id = generate_room_id()
        try:
            now = int(time.time())
            with sqlite3.connect(db_path) as conn:
                conn.execute(
                    "INSERT INTO rooms (room_id, data, updated_at) VALUES (?, ?, ?)",
                    (room_id, data, now),
                )
            return jsonify({"roomId": room_id, "data": data, "updatedAt": now})
        except sqlite3.IntegrityError:
            continue
    abort(500, description="Unable to allocate room id")


@app.route("/api/rooms/<room_id>", methods=["GET"])
def get_room_endpoint(room_id: str):
    init_db()
    result = get_room(room_id)
    if result is None:
        abort(404, description="Room not found")
    data, updated_at = result
    return jsonify({"roomId": room_id, "data": data, "updatedAt": updated_at})


@app.route("/api/rooms/<room_id>", methods=["PUT"])
def update_room_endpoint(room_id: str):
    init_db()
    payload = request.get_json(silent=True) or {}
    data = payload.get("data")
    if data is None or not isinstance(data, str):
        abort(400, description="data must be a string")
    try:
        updated_at = update_room(room_id, data)
    except KeyError:
        abort(404, description="Room not found")
    return jsonify({"roomId": room_id, "data": data, "updatedAt": updated_at})



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


@app.route(MEAL_PLANNER_PATH)
def meal_planner_root():
    return redirect(f"{MEAL_PLANNER_PATH}/", code=302)


@app.route(f"{MEAL_PLANNER_PATH}/")
def meal_planner_index():
    return send_from_directory(MEAL_PLANNER_DIR, "index.html")


@app.route(f"{MEAL_PLANNER_PATH}/<path:filename>")
def meal_planner_assets(filename: str):
    return send_from_directory(MEAL_PLANNER_DIR, filename)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
