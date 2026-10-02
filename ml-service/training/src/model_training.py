from preprocessing import (x_train_tfidf,y_train,x_val_tfidf,y_val,y_category_train,y_category_val,)
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.svm import SVC
from sklearn.ensemble import RandomForestClassifier
from sklearn.neighbors import KNeighborsClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import classification_report, confusion_matrix,ConfusionMatrixDisplay,accuracy_score
import matplotlib.pyplot as plt

def evaluation_matrix(model,x_val_tfidf,y_val):
    model.fit(x_train_tfidf,y_train)
    y_pred=model.predict(x_val_tfidf)
    print("Classification Report:",classification_report(y_val,y_pred,zero_division=0,))
    cm=confusion_matrix(y_val,y_pred,labels=["High","Medium","Low"])
    disp=ConfusionMatrixDisplay(confusion_matrix=cm,display_labels=["High","Medium","Low"])
    disp.plot(cmap="Blues")
    plt.title(f"{model.__class__.__name__} - Priority")
    plt.show()
    print("Accuracy:",accuracy_score(y_val,y_pred))
def category_evalution_matrix(model, x_val_tfidf, y_category_val):
    model.fit(x_train_tfidf, y_category_train)
    y_pred = model.predict(x_val_tfidf)
    print("Category Classification Report:")
    print(classification_report(y_category_val,y_pred,zero_division=0,))
    print("Category Accuracy:",accuracy_score(y_category_val, y_pred),)

evaluation_matrix(LogisticRegression(max_iter=1000),x_val_tfidf,y_val)
evaluation_matrix(MultinomialNB(),x_val_tfidf,y_val)
evaluation_matrix(SVC(),x_val_tfidf,y_val)
evaluation_matrix(RandomForestClassifier(n_estimators=100,random_state=42),x_val_tfidf,y_val)
evaluation_matrix(KNeighborsClassifier(n_neighbors=5),x_val_tfidf,y_val)
evaluation_matrix(MLPClassifier(hidden_layer_sizes=(100, 50), max_iter=1000),x_val_tfidf,y_val)

category_evalution_matrix(LogisticRegression(max_iter=1000),x_val_tfidf,y_category_val,)
category_evalution_matrix(MultinomialNB(),x_val_tfidf,y_category_val,)
category_evalution_matrix(SVC(),x_val_tfidf,y_category_val,)
category_evalution_matrix(RandomForestClassifier(n_estimators=100,random_state=42,),x_val_tfidf,y_category_val,)
category_evalution_matrix(KNeighborsClassifier(n_neighbors=5),x_val_tfidf,y_category_val,)
category_evalution_matrix(MLPClassifier(hidden_layer_sizes=(100, 50),max_iter=1000,),x_val_tfidf,y_category_val,)