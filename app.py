from flask import Flask, render_template, jsonify, request
from datetime import date
import calendar
import json

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flashcard_ai import generate_flashcards_from_pdf

app = Flask(__name__)

SAMPLE_EVENTS = {
    3: [
        {"title": "Math quiz — Algebra II", "startTime": "09:00", "endTime": "09:45", "isAssessment": True},
        {"title": "Soccer practice", "startTime": "15:30", "endTime": "17:00"},
    ],
    5: [
        {"title": "English essay due", "startTime": "08:00", "endTime": "08:50", "isAssessment": True},
        {"title": "Drama club", "startTime": "16:00", "endTime": "17:30"},
    ],
    8: [{"title": "Science lab report due", "startTime": "14:00", "endTime": "15:00", "isAssessment": True}],
    10: [
        {"title": "History presentation", "startTime": "10:00", "endTime": "11:00", "isAssessment": True},
        {"title": "Student council meeting", "startTime": "12:30", "endTime": "13:15"},
    ],
    12: [{"title": "PSAT prep session", "startTime": "14:00", "endTime": "16:00", "isAssessment": True}],
    15: [
        {"title": "Midterm: Biology", "startTime": "09:00", "endTime": "10:30", "isAssessment": True},
        {"title": "Yearbook committee", "startTime": "15:00", "endTime": "16:00"},
    ],
    17: [
        {"title": "Spanish oral exam", "startTime": "11:00", "endTime": "11:45", "isAssessment": True},
        {"title": "Homework night — no clubs", "startTime": "18:00", "endTime": "20:00"},
    ],
    19: [{"title": "College fair", "startTime": "18:00", "endTime": "20:00"}],
    22: [
        {"title": "Math test — Pre-calculus", "startTime": "09:00", "endTime": "10:00", "isAssessment": True},
        {"title": "Varsity game", "startTime": "17:00", "endTime": "19:00"},
    ],
    24: [{"title": "Group project: World History", "startTime": "13:00", "endTime": "14:30", "isAssessment": True}],
    26: [
        {"title": "AP English reading due", "startTime": "08:00", "endTime": "08:50", "isAssessment": True},
        {"title": "Chess club", "startTime": "15:45", "endTime": "17:00"},
    ],
    28: [
        {"title": "End-of-month review", "startTime": "12:00", "endTime": "12:40", "isAssessment": True},
        {"title": "Study session", "startTime": "19:00", "endTime": "21:00"},
    ],
}


def get_high_school_calendar():
    today = date.today()
    year, month = today.year, today.month
    cal = calendar.Calendar(firstweekday=0)

    return {
        "month": month,
        "month_name": calendar.month_name[month],
        "year": year,
        "weeks": cal.monthdayscalendar(year, month),
        "events": SAMPLE_EVENTS,
        "today": today.day if today.month == month and today.year == year else None,
        "today_month": today.month,
        "today_year": today.year,
    }


def calendar_json_for_template():
    data = get_high_school_calendar()
    return json.dumps({
        "year": data["year"],
        "month": data["month"],
        "today": data["today"],
        "today_month": data["today_month"],
        "today_year": data["today_year"],
        "events": {str(day): events for day, events in data["events"].items()},
    })


@app.route("/")
def landing():
    return render_template("landing.html")


@app.route("/login")
def login():
    return render_template("login.html")


@app.route("/signup")
def signup():
    return render_template("signup.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html", calendar_json=calendar_json_for_template())


@app.route("/education")
def education():
    return render_template("education.html")


@app.route("/focus")
def focus():
    return render_template("focus.html")


@app.route("/study")
def study():
    return render_template("study.html")


@app.route("/grades")
def grades():
    return render_template("grades.html", calendar_json=calendar_json_for_template())


@app.route("/health")
def health():
    return render_template("health.html")


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


@app.route("/api/flashcards/generate", methods=["POST"])
def generate_flashcards_api():
    """Generate flashcards from an uploaded PDF of notes."""
    upload = request.files.get("notes")
    if not upload or not upload.filename:
        return jsonify({"error": "Upload a PDF of your notes."}), 400

    if not upload.filename.lower().endswith(".pdf"):
        return jsonify({"error": "Please upload a PDF file."}), 400

    file_bytes = upload.read()
    max_size = 10 * 1024 * 1024
    if len(file_bytes) > max_size:
        return jsonify({"error": "PDF must be under 10 MB."}), 400

    count = request.form.get("count", 5)

    try:
        result = generate_flashcards_from_pdf(file_bytes, upload.filename, count)
        return jsonify(result)
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except RuntimeError as exc:
        return jsonify({"error": str(exc)}), 502


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


@app.route("/calendar")
def calendar_page():
    return render_template("calendar.html", calendar_json=calendar_json_for_template())


if __name__ == "__main__":
    app.run(debug=True, port=5000)


