import joblib
from fastapi import FastAPI
from pydantic import BaseModel

from text_utils import clean_text

app = FastAPI()
model = joblib.load("model.pkl")
vectorizer = joblib.load("vectorizer.pkl")


class Query(BaseModel):
    text: str


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/predict")
def predict(query: Query):
    features = vectorizer.transform([clean_text(query.text)])
    probs = model.predict_proba(features)[0]
    idx = probs.argmax()
    return {
        "priority": str(model.classes_[idx]),
        "confidence": round(float(probs[idx]), 4),
    }
