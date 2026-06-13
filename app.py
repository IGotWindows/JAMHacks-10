from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import json

app = Flask(__name__)

# ============ ROUTES ============

@app.route("/")
def home():
    return render_template("dashboard.html")

@app.route("/focus")
def focus():
    return render_template("focus.html")

@app.route("/study")
def study():
    return render_template("study.html")

# ============ API ENDPOINTS ============

@app.route("/api/seed-data", methods=["POST"])
def seed_data():
    """Seed 7 days of FAKE historical data to localStorage (frontend handles this)."""
    return jsonify({"status": "success", "message": "Data seeding handled on frontend"})

@app.route("/api/log/session", methods=["POST"])
def log_session():
    """Log a Pomodoro study session."""
    data = request.json
    # Backend placeholder: frontend manages localStorage
    return jsonify({"status": "success", "session_id": 1})

@app.route("/api/log/wellness", methods=["POST"])
def log_wellness():
    """Log water, sleep, mood for the day."""
    data = request.json
    # Backend placeholder: frontend manages localStorage
    return jsonify({"status": "success"})

@app.route("/api/dashboard-data", methods=["GET"])
def get_dashboard_data():
    """Return today's summary: sessions, water, sleep, mood, scores."""
    # Placeholder: Frontend calculates from localStorage
    return jsonify({
        "today": {
            "study_minutes": 0,
            "water_glasses": 0,
            "sleep_hours": 0,
            "mood": 0,
            "sessions_count": 0
        },
        "scores": {
            "focus_score": 0,
            "wellness_score": 0,
            "combined_score": 0
        },
        "streak": 0
    })

@app.route("/api/insights", methods=["GET"])
def get_insights():
    """Return correlation insights between wellness and focus."""
    # Placeholder: correlation logic on frontend
    return jsonify({
        "insights": [
            {
                "condition": "sleep_7plus",
                "correlation": "38% longer focus sessions",
                "description": "On days you sleep 7+ hours, your focus sessions are X% longer."
            }
        ]
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)