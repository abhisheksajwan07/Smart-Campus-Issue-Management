import os
import joblib
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
)

print("Loading vectorizer and models...")

vectorizer = joblib.load("models/tfidf_vectorizer.pkl")
best_model = joblib.load("models/best_model.pkl")
category_model = joblib.load("models/best_category_model.pkl")

test_path = "data/raw/clean_test_final.csv"

if not os.path.exists(test_path):
    test_path = "data/raw/test_noisy.csv"

if not os.path.exists(test_path):
    test_path = "test_noisy.csv"

test_df = pd.read_csv(test_path)

print(f"Loaded test dataset with {len(test_df)} rows.")


test_df["Cleaned_Query"] = (
    test_df["Query"]
    .fillna("")
    .astype(str)
    .str.lower()
    .str.strip()
)

X_test_tfidf = vectorizer.transform(test_df["Cleaned_Query"])

test_df["Predicted_Priority"] = best_model.predict(X_test_tfidf)
test_df["Predicted_Category"] = category_model.predict(X_test_tfidf)

if hasattr(best_model, "predict_proba"):
    priority_probabilities = best_model.predict_proba(
        X_test_tfidf
    )

    test_df["Priority_Confidence"] = (
        priority_probabilities.max(axis=1).round(4)
    )
else:
    test_df["Priority_Confidence"] = None


if hasattr(category_model, "predict_proba"):
    category_probabilities = category_model.predict_proba(
        X_test_tfidf
    )

    test_df["Category_Confidence"] = (
        category_probabilities.max(axis=1).round(4)
    )
else:
    test_df["Category_Confidence"] = None


os.makedirs("preprocessed", exist_ok=True)

output_file = "preprocessed/test_predictions.csv"

test_df.to_csv(
    output_file,
    index=False,
)

print(f"Predictions saved successfully to: {output_file}")


if "Priority" in test_df.columns:
    y_priority_true = test_df["Priority"]
    y_priority_pred = test_df["Predicted_Priority"]

    priority_accuracy = accuracy_score(y_priority_true, y_priority_pred)

    print("\n" + "=" * 45)
    print(f"PRIORITY TEST ACCURACY: {priority_accuracy * 100:.2f}%")
    print("=" * 45)

    print("\n--- Priority Classification Report ---")
    print(classification_report(y_priority_true, y_priority_pred, digits=4, zero_division=0))

    print("--- Priority Confusion Matrix ---")
    priority_labels = ["High", "Medium", "Low"]
    priority_cm = confusion_matrix(y_priority_true, y_priority_pred, labels=priority_labels)

    priority_cm_df = pd.DataFrame(
        priority_cm,
        index=[f"True_{label}" for label in priority_labels],
        columns=[f"Pred_{label}" for label in priority_labels],
    )
    print(priority_cm_df)

if "Category" in test_df.columns:
    y_category_true = test_df["Category"]
    y_category_pred = test_df["Predicted_Category"]

    category_accuracy = accuracy_score(y_category_true, y_category_pred)

    print("\n" + "=" * 45)
    print(f"CATEGORY TEST ACCURACY: {category_accuracy * 100:.2f}%")
    print("=" * 45)

    print("\n--- Category Classification Report ---")
    print(classification_report(y_category_true, y_category_pred, digits=4, zero_division=0))

    print("--- Category Confusion Matrix ---")
    # FIXED 4: Took the union of true AND predicted labels using set union (`|`) 
    # to avoid matrix dimension mismatches if the model predicts an unseen class or misses a ground truth class
    category_labels = sorted(list(set(y_category_true) | set(y_category_pred)))
    category_cm = confusion_matrix(y_category_true, y_category_pred, labels=category_labels)

    category_cm_df = pd.DataFrame(
        category_cm,
        index=[f"True_{label}" for label in category_labels],
        columns=[f"Pred_{label}" for label in category_labels],
    )
    print(category_cm_df)

print("\n--- Sample Predictions ---")

sample_columns = [
    "ID",
    "Query",
    "Priority",
    "Category",
    "Predicted_Priority",
    "Predicted_Category",
    "Priority_Confidence",
    "Category_Confidence",
]

existing_sample_cols = [col for col in sample_columns if col in test_df.columns]
print(test_df[existing_sample_cols].head(10))