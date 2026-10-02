import os
import joblib
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.svm import SVC

clean_train = pd.read_csv("preprocessed/clean_train.csv")
test_noisy = pd.read_csv("data/raw/test_noisy.csv" if os.path.exists("data/raw/test_noisy.csv") else "test_noisy.csv")

X = clean_train["Query"].astype(str)
y = clean_train["Priority"]

X_train, X_val, y_train, y_val = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

vectorizer = TfidfVectorizer(ngram_range=(1, 2), sublinear_tf=True)
X_train_tfidf = vectorizer.fit_transform(X_train)
X_val_tfidf = vectorizer.transform(X_val)
X_test_tfidf = vectorizer.transform(
    test_noisy["Query"].astype(str).str.lower().str.strip()
)
y_test_noisy = test_noisy["Priority"]
os.makedirs("models", exist_ok=True)
joblib.dump(vectorizer, "models/tfidf_vectorizer.pkl")

models = {
    "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
    "Multinomial Naive Bayes": MultinomialNB(),
    "Support Vector Machine (Linear)": SVC(kernel="linear", random_state=42),
    "Support Vector Machine (RBF)": SVC(kernel="rbf", random_state=42),
    "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
    "K-Nearest Neighbors": KNeighborsClassifier(n_neighbors=5),
    "MLP Neural Network": MLPClassifier(
        hidden_layer_sizes=(100, 50), max_iter=1000, random_state=42
    ),
}

val_results = []
test_results = []

for name, model in models.items():
  model.fit(X_train_tfidf, y_train)

  y_val_pred = model.predict(X_val_tfidf)
  val_results.append({
      "Model": name,
      "Accuracy (%)": round(accuracy_score(y_val, y_val_pred) * 100, 2),
      "Precision (Macro)": round(
          precision_score(y_val, y_val_pred, average="macro") * 100, 2
      ),
      "Recall (Macro)": round(
          recall_score(y_val, y_val_pred, average="macro") * 100, 2
      ),
      "F1-Score (Macro)": round(
          f1_score(y_val, y_val_pred, average="macro") * 100, 2
      ),
      "F1-Score (Weighted)": round(
          f1_score(y_val, y_val_pred, average="weighted") * 100, 2
      ),
  })

  y_test_pred = model.predict(X_test_tfidf)
  test_results.append({
      "Model": name,
      "Accuracy (%)": round(
          accuracy_score(y_test_noisy, y_test_pred) * 100, 2
      ),
      "Precision (Macro)": round(
          precision_score(y_test_noisy, y_test_pred, average="macro") * 100, 2
      ),
      "Recall (Macro)": round(
          recall_score(y_test_noisy, y_test_pred, average="macro") * 100, 2
      ),
      "F1-Score (Macro)": round(
          f1_score(y_test_noisy, y_test_pred, average="macro") * 100, 2
      ),
      "F1-Score (Weighted)": round(
          f1_score(y_test_noisy, y_test_pred, average="weighted") * 100, 2
      ),
  })

val_df = pd.DataFrame(val_results).sort_values(
    by="F1-Score (Macro)", ascending=False
)
test_df = pd.DataFrame(test_results).sort_values(
    by="F1-Score (Macro)", ascending=False
)

best_model_name = val_df.iloc[0]["Model"]
joblib.dump(models[best_model_name], "models/best_model.pkl")

print("\n" + "=" * 80)
print("TABLE 1: Validation Set Performance (clean_train.csv 80/20 Split)")
print("=" * 80)
print(val_df.to_string(index=False))

print("\n" + "=" * 80)
print("TABLE 2: Test Set Performance (test_noisy.csv with ~13.9% Noise)")
print("=" * 80)
print(test_df.to_string(index=False))

val_df.to_csv("preprocessed/validation_metrics.csv", index=False)
test_df.to_csv("preprocessed/test_metrics.csv", index=False)
print(
    "\nSaved metrics to preprocessed/validation_metrics.csv and preprocessed/test_metrics.csv"
)