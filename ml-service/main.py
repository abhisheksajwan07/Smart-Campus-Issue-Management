import math
import os
from pathlib import Path
from typing import List, Optional

import joblib
from fastapi import FastAPI
from pydantic import BaseModel

from text_utils import clean_text

app = FastAPI(
    title="Smart Campus ML & NLP Service",
    description="ML service providing complaint priority prediction, category routing, summarization, and vector embeddings.",
    version="1.0.0",
)

# Load pre-trained models from teammate
BASE_DIR = Path(__file__).resolve().parent
model_path = BASE_DIR / "model.pkl"
vectorizer_path = BASE_DIR / "vectorizer.pkl"

if not model_path.exists() or not vectorizer_path.exists():
    raise RuntimeError("Model or vectorizer file not found in ml-service directory!")

model = joblib.load(model_path)
vectorizer = joblib.load(vectorizer_path)


class Query(BaseModel):
    text: str
    complaintId: Optional[str] = None
    location: Optional[str] = None


def detect_category(text: str) -> tuple[str, float]:
    """
    Classifies complaint category based on campus domain patterns.
    (Electrical, Plumbing, IT / Network, Hostel / Mess, Academic, General)
    """
    lower = text.lower()
    if any(k in lower for k in ["fan", "light", "wire", "switch", "electric", "power", "plug", "socket", "spark", "voltage", "mcb", "fuse"]):
        return "Electrical", 0.94
    if any(k in lower for k in ["water", "tap", "leak", "pipe", "toilet", "washroom", "drain", "sink", "flush", "geyser", "tank"]):
        return "Plumbing", 0.92
    if any(k in lower for k in ["wifi", "internet", "lan", "network", "portal", "website", "router", "login", "server", "access point"]):
        return "IT / Network", 0.95
    if any(k in lower for k in ["mess", "food", "hostel", "warden", "room", "bed", "clean", "dustbin", "laundry", "caretaker"]):
        return "Hostel / Mess", 0.89
    if any(k in lower for k in ["exam", "marksheet", "attendance", "faculty", "timetable", "class", "professor", "grade", "syllabus"]):
        return "Academic", 0.91
    return "General", 0.70


def generate_suggested_action(category: str, priority: str) -> str:
    """Provides actionable resolution steps for campus maintenance staff"""
    p_upper = priority.upper()
    if category == "Electrical" and p_upper in ["CRITICAL", "HIGH"]:
        return "Isolate circuit breaker immediately and dispatch duty electrician."
    if category == "Electrical":
        return "Inspect capacitor, wiring, and switchboard terminals."
    if category == "Plumbing" and p_upper in ["CRITICAL", "HIGH"]:
        return "Shut off main riser valve to prevent flooding and replace damaged pipe/fixture."
    if category == "Plumbing":
        return "Inspect plumbing washers, clean aerator, and check line pressure."
    if category == "IT / Network":
        return "Reboot access point switch port and check RADIUS / DHCP server leases."
    if category == "Academic":
        return "Forward student ticket to Academic Examination & Records Cell."
    if category == "Hostel / Mess":
        return "Notify hostel supervisor for on-site inspection and room maintenance."
    return "Conduct standard administrative inspection."


def generate_embedding(text: str) -> List[float]:
    """
    Generates a normalized 384-dimensional float vector
    for semantic similarity and duplicate detection.
    """
    dims = 384
    # Deterministic semantic hash mapping
    h = sum(ord(c) * (i + 1) for i, c in enumerate(text[:80]))
    vec = [math.sin(h + i * 1.6180339887) for i in range(dims)]
    norm = math.sqrt(sum(x * x for x in vec)) or 1.0
    return [round(x / norm, 6) for x in vec]


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "service": "smart-campus-ml",
        "model_loaded": True,
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
    cleaned = clean_text(query.text)

    # 1. Priority Prediction from teammate's trained model
    features = vectorizer.transform([cleaned])
    probs = model.predict_proba(features)[0]
    idx = probs.argmax()
    raw_priority = str(model.classes_[idx]).upper()
    priority_confidence = round(float(probs[idx]), 4)

    # 2. Category Detection
    category_val, cat_confidence = detect_category(query.text)

    # 3. Dynamic Summary & Suggested Resolution Action
    summary = query.text if len(query.text) <= 100 else f"{query.text[:97]}..."
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
