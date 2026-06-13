import json
import os
import re
import urllib.error
import urllib.request
from io import BytesIO

from pypdf import PdfReader

USER_AGENT = "Studious/1.0 (education app; local hackathon project)"
STOPWORDS = {
    "about", "after", "also", "been", "being", "between", "during", "first",
    "from", "have", "into", "more", "most", "other", "some", "such", "than",
    "that", "their", "there", "these", "they", "this", "those", "through",
    "under", "used", "using", "which", "while", "with", "within", "would",
    "often", "usually", "commonly", "generally", "typically", "however",
}


def _clamp_count(count):
    try:
        count = int(count)
    except (TypeError, ValueError):
        count = 5
    return max(1, min(count, 15))


def _shorten_question(text, limit=140):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text
    clipped = text[:limit].rsplit(" ", 1)[0]
    return clipped.rstrip(" ,;") + "..."


def _truncate_answer(text, limit=180):
    text = re.sub(r"\s+", " ", text).strip()
    if len(text) <= limit:
        return text

    clipped = text[:limit]
    period = clipped.rfind(". ")
    if period > 60:
        return clipped[: period + 1]
    return clipped.rstrip(" ,;") + "..."


def _clean_label(filename):
    label = re.sub(r"\.pdf$", "", filename or "your notes", flags=re.I)
    label = re.sub(r"[_\-]+", " ", label).strip()
    return label or "your notes"


def _parse_cards_payload(text):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)

    data = json.loads(text)
    if isinstance(data, list):
        cards = data
    elif isinstance(data, dict):
        cards = data.get("cards", [])
    else:
        raise ValueError("Unexpected AI response format.")

    normalized = []
    for card in cards:
        if not isinstance(card, dict):
            continue
        question = str(card.get("question", "")).strip()
        answer = _truncate_answer(str(card.get("answer", "")).strip())
        if question and answer:
            normalized.append({"question": question, "answer": answer})

    if not normalized:
        raise ValueError("AI returned no valid flashcards.")
    return normalized


def extract_pdf_text(file_bytes):
    if not file_bytes:
        raise ValueError("Upload a PDF of your notes.")

    try:
        reader = PdfReader(BytesIO(file_bytes))
    except Exception as exc:
        raise ValueError("Could not read that PDF. Try a different file.") from exc

    pages = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            pages.append(text)

    notes = re.sub(r"\s+", " ", " ".join(pages)).strip()
    if len(notes) < 80:
        raise ValueError(
            "Could not read enough text from that PDF. Use a text-based PDF, not a scanned image."
        )
    return notes


def _openai_request(body, api_key):
    request = urllib.request.Request(
        "https://api.openai.com/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def _generate_openai_from_notes(notes_text, count, api_key, label):
    notes_excerpt = notes_text[:12000]
    system_prompt = (
        "You write concise exam-style flashcards from student notes. "
        "Each card tests one specific fact from the notes. "
        "Questions must be clear and standalone. Answers must be short (under 25 words). "
        "Only use information from the provided notes. Respond with valid JSON only."
    )
    user_prompt = (
        f'Create exactly {count} flashcards from these notes ("{label}").\n\n'
        f"NOTES:\n{notes_excerpt}\n\n"
        "Rules:\n"
        "- One fact per card.\n"
        "- Questions under 120 characters.\n"
        "- Answers under 25 words.\n"
        "- Mix definitions, process steps, comparisons, and fill-in-the-blank.\n"
        "- No vague or repetitive cards.\n\n"
        'Return JSON only: {"cards":[{"question":"...","answer":"..."}]}'
    )
    body = {
        "model": "gpt-4o-mini",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "temperature": 0.35,
        "response_format": {"type": "json_object"},
    }

    payload = _openai_request(body, api_key)
    content = payload["choices"][0]["message"]["content"]
    return _parse_cards_payload(content)


def _normalize_sentence(sentence):
    sentence = re.sub(r"\([^)]*\/[^)]*\)", "", sentence)
    sentence = re.sub(r"\(\s*\)", "", sentence)
    sentence = re.sub(r"\[[^\]]+\]", "", sentence)
    return re.sub(r"\s+", " ", sentence).strip()


def _split_sentences(text):
    chunks = re.split(r"(?<=[.!?])\s+", text)
    sentences = []
    for chunk in chunks:
        sentence = _normalize_sentence(chunk)
        if 35 <= len(sentence) <= 320:
            sentences.append(sentence)
    return sentences


def _topic_terms(topic):
    return {
        word.lower()
        for word in re.findall(r"[A-Za-z]{3,}", topic)
        if word.lower() not in STOPWORDS
    }


def _definition_card(sentence, label):
    patterns = [
        (r"^(.{3,70}?)\s+is\s+(?:a|an|the)\s+(.+)$", "Define {}.", "{}"),
        (r"^(.{3,70}?)\s+is\s+(.+)$", "What is {}?", "{}"),
        (r"^(.{3,70}?)\s+are\s+(.+)$", "What are {}?", "{}"),
        (r"^(.{3,70}?)\s+was\s+(.+)$", "What was {}?", "{}"),
        (r"^(.{3,70}?)\s+were\s+(.+)$", "What were {}?", "{}"),
    ]
    for pattern, question_fmt, answer_fmt in patterns:
        match = re.match(pattern, sentence, re.I)
        if not match:
            continue
        subject = match.group(1).strip(" ,")
        answer = _truncate_answer(match.group(2).strip())
        if len(subject) > 70 or len(answer) < 15:
            continue
        question = question_fmt.format(subject)
        return {"question": question, "answer": answer_fmt.format(answer)}
    return None


def _process_card(sentence, label):
    match = re.search(r"\b(1[0-9]{3}|20[0-9]{2})\b", sentence)
    if match:
        year = match.group(1)
        context = _shorten_question(sentence.replace(year, "______", 1))
        return {
            "question": f"In what year did this happen? {context}",
            "answer": year,
        }

    words = [
        word
        for word in re.findall(r"\b[A-Za-z]{6,}\b", sentence)
        if word.lower() not in STOPWORDS
    ]
    if words:
        key_word = max(words, key=len)
        if key_word.lower() not in _topic_terms(label):
            cloze = re.sub(rf"\b{re.escape(key_word)}\b", "______", sentence, count=1)
            if cloze != sentence:
                return {
                    "question": _shorten_question(f"Fill in the blank: {cloze}"),
                    "answer": key_word,
                }

    definition = _definition_card(sentence, label)
    if definition:
        return definition

    return None


def _score_card(card, topic_terms):
    question = card["question"]
    answer = card["answer"]
    score = 0

    if question.startswith("Define ") or question.startswith("What is"):
        score += 4
    if question.startswith("Fill in the blank"):
        score += 3
    if question.startswith("In what year"):
        score += 3
    if 12 <= len(answer) <= 120:
        score += 3
    if len(answer) > 180:
        score -= 4
    if answer.lower() in topic_terms:
        score -= 5
    if "..." in question and len(question) > 140:
        score -= 2
    return score


def _is_duplicate(card, existing):
    answer_key = re.sub(r"\W+", " ", card["answer"].lower()).strip()
    for other in existing:
        other_key = re.sub(r"\W+", " ", other["answer"].lower()).strip()
        if answer_key == other_key:
            return True
        if answer_key in other_key or other_key in answer_key:
            if min(len(answer_key), len(other_key)) / max(len(answer_key), len(other_key)) > 0.7:
                return True
    return False


def _generate_from_text(text, count, label):
    topic_terms = _topic_terms(label)
    candidates = []
    sentences = _split_sentences(text)

    if sentences:
        candidates.append(
            (
                6,
                {
                    "question": f"What is a key idea from {label}?",
                    "answer": _truncate_answer(sentences[0]),
                },
            )
        )

    for sentence in sentences:
        card = _process_card(sentence, label)
        if not card:
            continue
        card["answer"] = _truncate_answer(card["answer"])
        score = _score_card(card, topic_terms)
        if score < 1:
            continue
        candidates.append((score, card))

    candidates.sort(key=lambda item: item[0], reverse=True)

    cards = []
    for _, card in candidates:
        if _is_duplicate(card, cards):
            continue
        cards.append(card)
        if len(cards) >= count:
            return cards[:count]

    if not cards:
        raise RuntimeError("Could not build flashcards from those notes. Try a longer PDF.")

    return cards[:count]


def generate_flashcards_from_pdf(file_bytes, filename, count=5):
    notes_text = extract_pdf_text(file_bytes)
    label = _clean_label(filename)
    count = _clamp_count(count)
    api_key = os.environ.get("OPENAI_API_KEY", "").strip()

    if api_key:
        try:
            cards = _generate_openai_from_notes(notes_text, count, api_key, label)
            return {"cards": cards[:count], "source": "openai", "filename": filename}
        except urllib.error.HTTPError as exc:
            exc.read()
            raise RuntimeError(f"OpenAI request failed ({exc.code}). Check your API key.") from exc
        except (urllib.error.URLError, TimeoutError, KeyError, json.JSONDecodeError, ValueError) as exc:
            raise RuntimeError("Could not parse AI flashcards. Try again.") from exc

    cards = _generate_from_text(notes_text, count, label)
    return {"cards": cards, "source": "notes", "filename": filename}
