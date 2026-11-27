import math
import os
import re
from pathlib import Path
from typing import List, Optional

import joblib
from fastapi import FastAPI
from pydantic import BaseModel

from text_utils import clean_text

CONCEPT_CLUSTERS = {
    "FAN_ELECTRICAL": [
        "fan", "ceiling", "buzzing", "humming", "spinning", "rotating", "halted", "regulator",
        "sound", "noise", "blade", "tube", "light", "bulb", "flickering",
    ],
    "ELECTRICAL_HAZARD": [
        "spark", "sparking", "socket", "plug", "switchboard", "switch", "shock",
        "wire", "voltage", "mcb", "fuse", "short", "burning",
    ],
    "PLUMBING_LEAK": [
        "leak", "leaking", "leakage", "pipe", "basin", "sink", "washroom",
        "bathroom", "dripping", "drainage", "drain", "valve", "tap", "water", "flooding",
    ],
    "PLUMBING_FIXTURE": [
        "geyser", "heating", "clogged", "flush", "button", "tank", "toilet", "dispenser", "filter",
    ],
    "WIFI_INTERNET": [
        "wifi", "wi-fi", "internet", "network", "access", "connection", "router", "signal", "ssid",
    ],
    "ERP_PORTAL": [
        "erp", "portal", "lms", "login", "server", "crash", "error", "credentials", "timeout", "500",
    ],
    "MESS_FOOD": [
        "mess", "dinner", "lunch", "food", "chapatis", "cooked", "undercooked", "quality", "taste", "meal",
    ],
    "HOSTEL_HYGIENE": [
        "dustbin", "trash", "cans", "corridor", "cleaning", "cleaned", "overflowing", "smell", "waste", "hostel",
    ],
    "ACADEMIC_EXAMS": [
        "marksheet", "grade", "marks", "semester", "sem", "exam", "admit", "revaluation", "result", "score",
    ],
    "ADMIN_DOCS": [
        "bonafide", "certificate", "passport", "application", "document", "migration", "transcript", "leave", "visa",
    ],
    "HOSTEL_HARDWARE": [
        "lock", "key", "door", "jam", "turning", "window", "glass", "cracked", "frame", "room", "bed",
    ],
    "CAMPUS_SERVICES": [
        "library", "book", "auditorium", "bus", "transport", "parking", "internship", "placement", "fest", "club", "gym",
    ],
}

app = FastAPI(
    title="Smart Campus ML & NLP Service",
    description="ML service providing complaint priority prediction, category routing, summarization, and vector embeddings.",
    version="1.0.0",
)

# Load pre-trained models from teammate
BASE_DIR = Path(__file__).resolve().parent
model_path = BASE_DIR / "model.pkl"
if not model_path.exists():
    model_path = BASE_DIR / "training" / "models" / "best_model.pkl"

category_model_path = BASE_DIR / "category_model.pkl"
if not category_model_path.exists():
    category_model_path = BASE_DIR / "training" / "models" / "best_category_model.pkl"

vectorizer_path = BASE_DIR / "vectorizer.pkl"
if not vectorizer_path.exists():
    vectorizer_path = BASE_DIR / "training" / "models" / "tfidf_vectorizer.pkl"

if not model_path.exists() or not vectorizer_path.exists():
    raise RuntimeError("Model or vectorizer file not found in ml-service directory!")

model = joblib.load(model_path)
category_model = joblib.load(category_model_path) if category_model_path.exists() else None
vectorizer = joblib.load(vectorizer_path)


# Try loading SentenceTransformer for SBERT embeddings if available
sbert_model = None
try:
    from sentence_transformers import SentenceTransformer
    sbert_model = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    sbert_model = None


class Query(BaseModel):
    text: str
    complaintId: Optional[str] = None
    location: Optional[str] = None


def detect_category(text: str) -> tuple[str, float]:
    """
    Classifies complaint category using the trained ML model,
    with smart fallbacks for campus infrastructure issues (electrical, plumbing).
    """
    lower = text.lower()

    # 1. Immediate priority for unambiguous physical maintenance hazards
    if any(k in lower for k in ["fan", "light", "wire", "switch", "electric", "power", "plug", "socket", "spark", "voltage", "mcb", "fuse"]):
        return "Electrical Maintenance", 0.95
    if any(k in lower for k in ["water", "tap", "leak", "pipe", "toilet", "washroom", "drain", "sink", "flush", "geyser", "tank"]):
        return "Plumbing & Sanitation", 0.95

    # 2. ML Classifier for academic, IT, hostel, administrative, and student complaints
    if category_model is not None and vectorizer is not None:
        try:
            cleaned = clean_text(text)
            features = vectorizer.transform([cleaned])
            if hasattr(category_model, "predict_proba"):
                probs = category_model.predict_proba(features)[0]
                idx = probs.argmax()
                confidence = float(probs[idx])
                if confidence >= 0.40:
                    return str(category_model.classes_[idx]), round(confidence, 4)
            else:
                pred = category_model.predict(features)[0]
                return str(pred), 0.95
        except Exception:
            pass

    # 3. Domain keyword fallback
    if any(k in lower for k in ["wifi", "internet", "lan", "network", "portal", "website", "router", "login", "server", "access point"]):
        return "IT & Digital Services", 0.95
    if any(k in lower for k in ["mess", "food", "hostel", "warden", "room", "bed", "clean", "dustbin", "laundry", "caretaker"]):
        return "Hostel & Accommodation", 0.89
    if any(k in lower for k in ["exam", "marksheet", "admit", "revaluation", "grade"]):
        return "Exams & Assessment", 0.95
    if any(k in lower for k in ["attendance", "faculty", "timetable", "class", "professor", "syllabus", "degree", "branch"]):
        return "Academic & Courses", 0.91
    return "Campus Facilities & Maintenance", 0.70



def generate_suggested_action(category: str, priority: str) -> str:
    """Provides actionable resolution steps for campus maintenance and support staff"""
    p_upper = priority.upper()
    cat_lower = category.lower()

    if "electr" in cat_lower and p_upper in ["CRITICAL", "HIGH"]:
        return "Isolate circuit breaker immediately and dispatch duty electrician."
    if "electr" in cat_lower:
        return "Inspect capacitor, wiring, and switchboard terminals."
    if "plumb" in cat_lower and p_upper in ["CRITICAL", "HIGH"]:
        return "Shut off main riser valve to prevent flooding and replace damaged pipe/fixture."
    if "plumb" in cat_lower:
        return "Inspect plumbing washers, clean aerator, and check line pressure."
    if "it" in cat_lower or "digital" in cat_lower:
        return "Check network switches/AP DHCP leases and verify student LMS portal credentials."
    if "exam" in cat_lower:
        return "Forward ticket with urgency to Examination & Evaluation Controller Office."
    if "acad" in cat_lower:
        return "Forward student ticket to Academic Dean / Department Course Coordinator."
    if "hostel" in cat_lower or "accomm" in cat_lower:
        return "Notify hostel warden and caretaking staff for on-site room inspection."
    if "intern" in cat_lower or "placement" in cat_lower:
        return "Route application to Corporate Relations & Training/Placement Cell."
    if "librar" in cat_lower:
        return "Refer query to Central Library circulation and digital access desk."
    if "transport" in cat_lower or "parking" in cat_lower:
        return "Notify campus transport officer for parking/bus schedule review."
    if "admin" in cat_lower or "document" in cat_lower:
        return "Forward request to Registrar Office for student verification and document issuance."
    return "Dispatch campus duty staff for standard on-site inspection and verification."


def generate_embedding(text: str) -> List[float]:
    """
    Generates a normalized 384-dimensional float vector
    for semantic similarity and duplicate detection.
    Uses SBERT all-MiniLM-L6-v2 if installed, or semantic concept + room + trigram projection.
    """
    if sbert_model is not None:
        try:
            vec = sbert_model.encode(text, normalize_embeddings=True).tolist()
            return [round(float(x), 6) for x in vec]
        except Exception:
            pass

    dims = 384
    vector = [0.0] * dims
    clean = re.sub(r"[^a-z0-9\s]", " ", (text or "").lower())
    words = [w for w in clean.split() if w]

    # 1. Concept projections (dimensions 0 - 239)
    for cluster_idx, keywords in enumerate(CONCEPT_CLUSTERS.values()):
        match_count = sum(1 for w in words if w in keywords)
        if match_count > 0:
            start_dim = (cluster_idx * 20) % 240
            for k in range(18):
                angle = (cluster_idx + 1) * 1.6180339887 + k
                vector[start_dim + k] += match_count * math.cos(angle)

    # 2. Location & room identifier projection (dimensions 240 - 319)
    for token in re.findall(r"\b[a-z]?\d{3,4}[a-z]?\b", clean):
        digits = re.sub(r"\D", "", token)
        numeric_part = int(digits) if digits else 0
        for k in range(15):
            vector[240 + ((numeric_part * 7 + k) % 80)] += 3.5

    if "library" in clean:
        for k in range(10):
            vector[300 + k] += 2.5
    if any(h in clean for h in ("tagore", "birsa", "mahamaya")):
        for k in range(10):
            vector[310 + k] += 2.5

    # 3. Character trigram texture (dimensions 320 - 383)
    for w in words:
        for i in range(len(w) - 2):
            trigram_hash = (ord(w[i]) * 31 + ord(w[i + 1]) * 7 + ord(w[i + 2])) % 64
            vector[320 + trigram_hash] += 0.25

    norm = math.sqrt(sum(x * x for x in vector))
    if norm <= 1e-12:
        h = sum(ord(c) * (i + 1) for i, c in enumerate(text[:80]))
        vector = [math.sin(h + i * 1.6180339887) for i in range(dims)]
        norm = math.sqrt(sum(x * x for x in vector)) or 1.0

    return [round(x / norm, 6) for x in vector]


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "smart-campus-ml",
        "model_loaded": True,
        "category_model_loaded": category_model is not None,
        "sbert_loaded": sbert_model is not None,
        "classes": [str(c) for c in model.classes_],
    }


# Backward-compatible endpoint for teammate's ML testing
@app.post("/predict")
def predict(query: Query):
    cleaned = clean_text(query.text)
    features = vectorizer.transform([cleaned])
    probs = model.predict_proba(features)[0]
    idx = probs.argmax()
    return {
        "priority": str(model.classes_[idx]),
        "confidence": round(float(probs[idx]), 4),
    }


# MAIN API CONTRACT FOR NODE.JS BACKEND
@app.post("/analyze")
def analyze(query: Query):
    # Strip trailing ". Location: ..." for classification/summary so location names
    # do not bias category prediction, while keeping full query.text for embeddings.
    issue_text = re.sub(r"\.\s*Location:\s*.*$", "", query.text, flags=re.IGNORECASE | re.DOTALL).strip() or query.text
    cleaned = clean_text(issue_text)

    # 1. Priority Prediction from teammate's trained model
    features = vectorizer.transform([cleaned])
    probs = model.predict_proba(features)[0]
    idx = probs.argmax()
    raw_priority = str(model.classes_[idx]).upper()
    priority_confidence = round(float(probs[idx]), 4)

    # 2. Category Detection
    category_val, cat_confidence = detect_category(issue_text)

    # 3. Dynamic Summary & Suggested Resolution Action
    summary = issue_text if len(issue_text) <= 100 else f"{issue_text[:97]}..."
    suggested_action = generate_suggested_action(category_val, raw_priority)

    # 4. 384-dim Embedding Vector for Duplicate Search
    embedding = generate_embedding(query.text)

    return {
        "category": {
            "value": category_val,
            "confidence": cat_confidence,
        },
        "priority": {
            "value": raw_priority,
            "confidence": priority_confidence,
        },
        "summary": summary,
        "suggestedAction": suggested_action,
        "embedding": embedding,
    }
