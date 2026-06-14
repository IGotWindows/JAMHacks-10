from flask import Flask, render_template, jsonify, request
from datetime import date
import calendar
import json
import os
import urllib.request
import urllib.error

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flashcard_ai import generate_flashcards_from_pdf

app = Flask(__name__)

SAMPLE_EVENTS = {}


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
    return jsonify({
        "insights": [
            {
                "condition": "sleep_7plus",
                "correlation": "38% longer focus sessions",
                "description": "On days you sleep 7+ hours, your focus sessions are X% longer."
            }
        ]
    })


def _call_anthropic(prompt_text, max_tokens=1024):
    """Call Anthropic Messages API and return the text response, or None on failure."""
    try:
        from flashcard_ai import _anthropic_request, _get_anthropic_api_key
        api_key = _get_anthropic_api_key()
        if not api_key:
            return None
        body = {
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt_text}],
        }
        payload = _anthropic_request(body, api_key)
        return payload["content"][0]["text"]
    except Exception:
        return None


# ─── Wellness API endpoints ────────────────────────────────────────────────────

FALLBACK_TIPS = [
    {"tip": "💧 Stay hydrated — aim for 8 glasses throughout the day.", "category": "water", "urgency": "medium"},
    {"tip": "😴 Consistent sleep times help your focus more than total hours.", "category": "sleep", "urgency": "medium"},
    {"tip": "🧠 Short breaks between study sessions improve long-term retention.", "category": "study", "urgency": "low"},
]


@app.route("/api/wellness/tips", methods=["POST"])
def get_wellness_tips():
    """Generate 3 Claude wellness tips based on today's health data."""
    health = (request.json or {}).get("healthData", {})
    prompt = f"""You are a student wellness coach. Based on this student's stats, give exactly 3 short, specific, actionable wellness tips.

Today's data:
- Study time: {health.get('studyHours', 0)}h ({health.get('pomodoroCount', 0)} sessions)
- Sleep last night: {health.get('sleepHours', '?')}h (target: {health.get('sleepTarget', 8)}h)
- Sleep debt this week: {health.get('sleepDebt', 0):.1f}h
- Water intake: {health.get('waterGlasses', 0)}/{health.get('waterGoal', 8)} glasses
- Mood: {health.get('mood', 'unknown')} (score: {health.get('moodScore', '?')}/10)
- Longest focus streak today: {health.get('longestSession', 0)} minutes

Rules:
- Each tip must be under 30 words
- Be warm and encouraging, not preachy
- Be specific to their numbers
- Start each tip with a relevant emoji
- Return ONLY a JSON array with no markdown, no code fences:
[{{"tip": "...", "category": "sleep|water|mood|study|general", "urgency": "low|medium|high"}}]"""

    text = _call_anthropic(prompt, max_tokens=512)
    if text:
        try:
            # Strip markdown fences if present
            text = text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            tips = json.loads(text.strip())
            if isinstance(tips, list) and tips:
                return jsonify({"tips": tips[:3]})
        except Exception:
            pass

    return jsonify({"tips": FALLBACK_TIPS})


@app.route("/api/wellness/mood-questions", methods=["POST"])
def get_mood_questions():
    """Generate 3 adaptive mood check-in questions via Anthropic."""
    stats = (request.json or {}).get("stats", {})
    prompt = f"""You are a compassionate student wellness assistant. Generate exactly 3 short, warm, conversational questions to assess a student's mood and stress.

Their current context:
- Study time today: {stats.get('studyHoursToday', 0)} hours
- Sleep last night: {stats.get('hoursSlept', '?')} hours
- Water today: {stats.get('waterGlasses', 0)}/{stats.get('waterGoal', 8)} glasses
- Current streak: {stats.get('streak', 0)} days

Rules:
- Each question under 15 words
- Casual and warm, not clinical
- Vary the topics (mood, energy, stress)
- Return ONLY a JSON array, no markdown:
["question 1", "question 2", "question 3"]"""

    text = _call_anthropic(prompt, max_tokens=256)
    if text:
        try:
            text = text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            questions = json.loads(text.strip())
            if isinstance(questions, list) and len(questions) >= 3:
                return jsonify({"questions": questions[:3]})
        except Exception:
            pass

    return jsonify({"questions": [
        "How are you feeling right now?",
        "How's your energy and focus today?",
        "Anything stressing you out lately?",
    ]})


@app.route("/api/wellness/mood-analyze", methods=["POST"])
def analyze_mood():
    """Analyze mood check-in answers using Anthropic and return a mood object."""
    qa = (request.json or {}).get("qa", [])
    pairs = "\n".join(f"Q: {item['question']}\nA: {item['answer']}" for item in qa)
    prompt = f"""You are a student wellness assistant. A student answered 3 mood check-in questions. Analyze their responses and return a mood assessment.

Conversation:
{pairs}

Return ONLY a JSON object, no markdown:
{{"mood": "happy|content|neutral|stressed|anxious|tired|overwhelmed", "score": <1-10>, "summary": "<one sentence, under 15 words>"}}"""

    text = _call_anthropic(prompt, max_tokens=128)
    if text:
        try:
            text = text.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            result = json.loads(text.strip())
            if "mood" in result and "score" in result:
                return jsonify(result)       
        except Exception:
            pass

    return jsonify({"mood": "neutral", "score": 5, "summary": "Doing okay today."})


@app.route("/calendar")
def calendar_page():
    return render_template("calendar.html", calendar_json=calendar_json_for_template())


# ── Google Calendar iCal sync ──────────────────────────────────────────────────

def _normalize_gcal_url(url):
    url = str(url or "").strip()
    if url.lower().startswith("webcal://"):
        url = "https://" + url[9:]
    elif url.lower().startswith("http://"):
        url = "https://" + url[7:]
    return url


def _ical_date_time(value):
    from datetime import datetime as dt_cls, date as date_cls

    if isinstance(value, dt_cls):
        local = value.astimezone().replace(tzinfo=None) if value.tzinfo else value
        return local.date(), local.strftime("%H:%M")
    if isinstance(value, date_cls):
        return value, ""
    return None, None


@app.route("/api/gcal/events", methods=["POST"])
def gcal_events():
    try:
        from icalendar import Calendar as ICal
    except ImportError:
        return jsonify({
            "error": "Calendar sync dependency missing — run: pip install icalendar",
        }), 503

    data = request.get_json(silent=True) or {}
    url = _normalize_gcal_url(data.get("url", ""))
    try:
        year = int(data.get("year", 0))
        month = int(data.get("month", 0))
    except (TypeError, ValueError):
        year, month = 0, 0

    if not url.startswith("https://") or not year or not month:
        return jsonify({"error": "Invalid calendar URL or date — use the secret iCal link from Google Calendar"}), 400

    if "calendar.google.com" not in url and not url.lower().endswith(".ics"):
        return jsonify({"error": "URL must be a Google Calendar iCal link ending in .ics"}), 400

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "Mozilla/5.0 (compatible; StudySpace/1.0)",
                "Accept": "text/calendar, text/plain, */*",
            },
        )
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read()
    except urllib.error.HTTPError as e:
        if e.code in (401, 403):
            msg = "Access denied — paste the secret iCal URL from Google Calendar settings (not the public link)"
        elif e.code == 404:
            msg = "Calendar not found — double-check your iCal URL"
        elif e.code == 429:
            msg = "Google rate limit — wait a minute and try again"
        else:
            msg = f"Google Calendar returned HTTP {e.code}"
        return jsonify({"error": msg}), 502
    except urllib.error.URLError as e:
        return jsonify({"error": f"Could not reach calendar: {e.reason}"}), 502
    except Exception as e:
        return jsonify({"error": str(e)}), 502

    try:
        cal = ICal.from_ical(raw)
    except Exception:
        return jsonify({"error": "Could not parse calendar data — check the URL"}), 422

    events = {}

    for comp in cal.walk():
        if comp.name != "VEVENT":
            continue
        dtstart = comp.get("DTSTART")
        if not dtstart:
            continue

        event_date, start_time = _ical_date_time(dtstart.dt)
        if not event_date:
            continue

        if event_date.year != year or event_date.month != month:
            continue

        end_time = ""
        dtend = comp.get("DTEND")
        if dtend:
            _, end_time = _ical_date_time(dtend.dt)

        day = str(event_date.day)
        events.setdefault(day, []).append({
            "title": str(comp.get("SUMMARY", "(no title)")),
            "startTime": start_time,
            "endTime": end_time,
            "isAssessment": False,
            "fromGCal": True,
        })

    return jsonify({"events": events})


if __name__ == "__main__":
    app.run(debug=True, port=5000)


