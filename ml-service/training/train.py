import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score

sys.path.append(str(Path(__file__).resolve().parent.parent))
from text_utils import clean_text

here = Path(__file__).resolve().parent
train = pd.read_csv(here / "train_noisy.csv")
test = pd.read_csv(here / "test_noisy.csv")

vectorizer = TfidfVectorizer(stop_words="english", max_features=3000)
X_train = vectorizer.fit_transform(train["Query"].map(clean_text))
X_test = vectorizer.transform(test["Query"].map(clean_text))

model = LogisticRegression(max_iter=1000, C=0.1)
model.fit(X_train, train["Priority"])
print("test accuracy:", accuracy_score(test["Priority"], model.predict(X_test)))

joblib.dump(model, here.parent / "model.pkl")
joblib.dump(vectorizer, here.parent / "vectorizer.pkl")
