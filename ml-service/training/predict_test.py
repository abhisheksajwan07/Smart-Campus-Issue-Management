import os
import joblib
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

print("Loading vectorizer and model...")
vectorizer = joblib.load("models/tfidf_vectorizer.pkl")
best_model = joblib.load("models/best_model.pkl")

test_path = "data/raw/test_noisy.csv"
if not os.path.exists(test_path):
  test_path = "test_noisy.csv" 
test_df = pd.read_csv(test_path)
print(f"Loaded test dataset with {len(test_df)} rows.")

test_df["Cleaned_Query"] = test_df["Query"].astype(str).str.lower().str.strip()

X_test_tfidf = vectorizer.transform(test_df["Cleaned_Query"])

test_df["Predicted_Priority"] = best_model.predict(X_test_tfidf)

if hasattr(best_model, "predict_proba"):
  probabilities = best_model.predict_proba(X_test_tfidf)
  test_df["Confidence"] = probabilities.max(axis=1).round(4)

os.makedirs("preprocessed", exist_ok=True)
output_file = "preprocessed/test_predictions.csv"
test_df.to_csv(output_file, index=False)
print(f"Predictions saved successfully to: {output_file}")

if "Priority" in test_df.columns:
  y_true = test_df["Priority"]
  y_pred = test_df["Predicted_Priority"]

  acc = accuracy_score(y_true, y_pred)
  print("\n" + "=" * 45)
  print(f"TEST ACCURACY: {acc * 100:.2f}%")
  print("=" * 45)

  print("\n--- Detailed Classification Report ---")
  print(classification_report(y_true, y_pred, digits=4))

  print("--- Confusion Matrix ---")
  labels = ["High", "Medium", "Low"]
  cm = confusion_matrix(y_true, y_pred, labels=labels)
  cm_df = pd.DataFrame(
      cm, index=[f"True_{l}" for l in labels], columns=[f"Pred_{l}" for l in labels]
  )
  print(cm_df)

print("\n--- Sample Predictions ---")
print(
    test_df[
        ["ID", "Query", "Priority", "Predicted_Priority", "Confidence"]
    ].head(10)
)