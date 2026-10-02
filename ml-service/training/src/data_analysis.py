import pandas as pd
import numpy as np
import os

train_data=pd.read_csv("data/raw/train_noisy.csv")
test_data=pd.read_csv("data/raw/test_noisy.csv")

train_data["Query"] = train_data["Query"].str.lower().str.strip()
test_data["Query"] = test_data["Query"].str.lower().str.strip()

print("Training Shape:",train_data.shape)
print("Test Shape:",test_data.shape)

print(train_data.head())
print(train_data.info())

print("Missing in Training Data:",train_data.isnull().sum())
print("Missing in Test Data:",test_data.isnull().sum())


print("Length of Training Data:",len(train_data))
print("unique Queries in Training Data:",train_data["Query"].nunique())
duplicates=train_data[train_data["Query"].duplicated(keep=False)]
print(duplicates.sort_values("Query").head())

print("Duplicate in Training Data:",train_data.duplicated().sum())
print("Duplicate in Test Data:",test_data.duplicated().sum())

print(train_data["Priority"].value_counts())
print(train_data["Priority"].value_counts(normalize=True))

label_counts=(train_data.groupby("Query")["Priority"].nunique())
conflicting_queries=label_counts[label_counts>1]
print(conflicting_queries,"\nLength of Conflicting Queries:",len(conflicting_queries))
for query in conflicting_queries.index:
    print("Query:",query)
    print("Labels:",train_data[train_data["Query"]==query]["Priority"].value_counts())

clean_data=(train_data.groupby("Query")["Priority"].agg(lambda x: x.mode()[0]).reset_index()) #using the most frequent value of the conflicting queries
print(clean_data.shape)
print(clean_data.head())

os.makedirs("preprocessed", exist_ok=True)
clean_data.to_csv("preprocessed/clean_train.csv",index=False)
print("Cleaned Data saved to preprocessed/clean_train.csv")