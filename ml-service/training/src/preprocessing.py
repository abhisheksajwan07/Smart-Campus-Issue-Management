from sklearn.model_selection import train_test_split
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
import joblib

clean_train=pd.read_csv("preprocessed/clean_train_final.csv")
x=clean_train["Query"].fillna("")
y_priority=clean_train["Priority"]
y_category=clean_train["Category"]

( x_train,x_val,y_train,y_val,y_category_train,y_category_val,) = train_test_split(x,y_priority,y_category,test_size=0.2,random_state=42,stratify=y_priority,)

vectorizer=TfidfVectorizer(ngram_range=(1,2),sublinear_tf=True)
x_train_tfidf=vectorizer.fit_transform(x_train)
x_val_tfidf=vectorizer.transform(x_val)

joblib.dump(vectorizer,"preprocessed/tfidf_vectorizer.pkl")
print("Vectorizer saved to preprocessed/tfidf_vectorizer.pkl")
