# Importing libraries
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns  
import time 

from sklearn.metrics import classification_report
from sklearn.metrics import confusion_matrix
from nltk.tokenize import RegexpTokenizer  
from nltk.stem.snowball import SnowballStemmer
from sklearn.feature_extraction.text import CountVectorizer  
from sklearn.pipeline import make_pipeline
from sklearn.model_selection import train_test_split
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
import pickle

# Loading the dataset
df = pd.read_csv(r"C:\Users\Olamzkid\Documents\Final Year Project\Dataset\phishing_site_urls Combined.csv")

# Drop rows with NaN values in 'URL' or 'Label'
df = df.dropna(subset=['URL', 'Label'])

# Visualizing the distribution of labels
sns.countplot(x="Label", data=df)

# Tokenization
tokenizer = RegexpTokenizer(r'[A-Za-z]+')

# Convert all URLs to strings to avoid TypeError
df['URL'] = df['URL'].astype(str)

# Apply tokenization to the URLs
df['text_tokenized'] = df.URL.map(lambda t: tokenizer.tokenize(t) if isinstance(t, str) and t.strip() else [])

# Stemming
stemmer = SnowballStemmer("english")
df['text_stemmed'] = df['text_tokenized'].map(lambda l: [stemmer.stem(word) for word in l])

# Joining Stems
df['text_sent'] = df['text_stemmed'].map(lambda l: ' '.join(l))

# Drop any rows where 'text_sent' is empty after preprocessing
df = df[df['text_sent'].str.strip() != '']

# Feature Extraction with the first vectorizer (used only for exploration)
cv = CountVectorizer()
feature = cv.fit_transform(df.text_sent)
feature[:5].toarray()

# Train-Test Split
trainX, testX, trainY, testY = train_test_split(feature, df.Label, test_size=0.2, random_state=42)

# Logistic Regression (Initial Exploration)
lr = LogisticRegression()
lr.fit(trainX, trainY)
print('Training Accuracy :', lr.score(trainX, trainY))
print('Testing Accuracy :', lr.score(testX, testY))

# Multinomial Naive Bayes (Initial Exploration)
mnb = MultinomialNB()
mnb.fit(trainX, trainY)
print('Training Accuracy :', mnb.score(trainX, trainY))
print('Testing Accuracy :', mnb.score(testX, testY))

# Creating and Training the Final Pipeline
pipeline_ls = make_pipeline(CountVectorizer(tokenizer=RegexpTokenizer(r'[A-Za-z]+').tokenize, stop_words='english'), LogisticRegression())
trainX, testX, trainY, testY = train_test_split(df.URL, df.Label)
pipeline_ls.fit(trainX, trainY)
print('Training Accuracy :', pipeline_ls.score(trainX, trainY))
print('Testing Accuracy :', pipeline_ls.score(testX, testY))

# Save the final model (including vectorizer) as a pipeline
with open('phishingApp.pkl', 'wb') as model_file:
    pickle.dump(pipeline_ls, model_file)
