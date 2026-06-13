from flask import Flask, render_template, jsonify, request
from datetime import datetime, timedelta
import json

app = Flask(__name__)

# ============ ROUTES ============

@app.route("/")
def home():
    return render_template("dashboard.html")
from datetime import date
import calendar
import json
from flask import Flask, render_template

app = Flask(__name__)

def get_high_school_calendar():
    today = date.today()
    year, month = today.year, today.month
    cal = calendar.Calendar(firstweekday=0)

    sample_events = {
        3: [
            {"title": "Math quiz — Algebra II", "startTime": "09:00", "endTime": "09:45"},
            {"title": "Soccer practice", "startTime": "15:30", "endTime": "17:00"},
        ],
        5: [
            {"title": "English essay due", "startTime": "08:00", "endTime": "08:50"},
            {"title": "Drama club", "startTime": "16:00", "endTime": "17:30"},
        ],
        8: [{"title": "Science lab report due", "startTime": "14:00", "endTime": "15:00"}],
        10: [
            {"title": "History presentation", "startTime": "10:00", "endTime": "11:00"},
            {"title": "Student council meeting", "startTime": "12:30", "endTime": "13:15"},
        ],
        12: [{"title": "PSAT prep session", "startTime": "14:00", "endTime": "16:00"}],
        15: [
            {"title": "Midterm: Biology", "startTime": "09:00", "endTime": "10:30"},
            {"title": "Yearbook committee", "startTime": "15:00", "endTime": "16:00"},
        ],
        17: [
            {"title": "Spanish oral exam", "startTime": "11:00", "endTime": "11:45"},
            {"title": "Homework night — no clubs", "startTime": "18:00", "endTime": "20:00"},
        ],
        19: [{"title": "College fair", "startTime": "18:00", "endTime": "20:00"}],
        22: [
            {"title": "Math test — Pre-calculus", "startTime": "09:00", "endTime": "10:00"},
            {"title": "Varsity game", "startTime": "17:00", "endTime": "19:00"},
        ],
        24: [{"title": "Group project: World History", "startTime": "13:00", "endTime": "14:30"}],
        26: [
            {"title": "AP English reading due", "startTime": "08:00", "endTime": "08:50"},
            {"title": "Chess club", "startTime": "15:45", "endTime": "17:00"},
        ],
        28: [
            {"title": "End-of-month review", "startTime": "12:00", "endTime": "12:40"},
            {"title": "Study session", "startTime": "19:00", "endTime": "21:00"},
        ],
    }

    return {
        "month": month,
        "month_name": calendar.month_name[month],
        "year": year,
        "weeks": cal.monthdayscalendar(year, month),
        "events": sample_events,
        "today": today.day if today.month == month and today.year == year else None,
        "today_month": today.month,
        "today_year": today.year,
    }

@app.route("/")
def home():
    calendar_data = get_high_school_calendar()
    calendar_json = json.dumps({
        "year": calendar_data["year"],
        "month": calendar_data["month"],
        "today": calendar_data["today"],
        "today_month": calendar_data["today_month"],
        "today_year": calendar_data["today_year"],
        "events": {str(day): events for day, events in calendar_data["events"].items()},
    })
    return render_template("index.html", calendar_json=calendar_json)

@app.route("/education")
def education():
    return render_template("education.html")

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
@app.route("/calendar")
def calendar_page():
    calendar_data = get_high_school_calendar()
    calendar_json = json.dumps({
        "year": calendar_data["year"],
        "month": calendar_data["month"],
        "today": calendar_data["today"],
        "today_month": calendar_data["today_month"],
        "today_year": calendar_data["today_year"],
        "events": {str(day): events for day, events in calendar_data["events"].items()},
    })
    return render_template("calendar.html", calendar_data=calendar_data, calendar_json=calendar_json)

if __name__ == "__main__":
    app.run(debug=True, port=5000)

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
    app.run(debug=True, port=5001)