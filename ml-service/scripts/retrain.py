#!/usr/bin/env python3
"""
Retraining Pipeline for NGIPS Phishing Shield
Called by backend/src/utils/retrain.js via child_process

Usage:
    python retrain.py --data <training_data.csv> --output <model.onnx>

Loads original dataset + feedback data, retrains LR and MNB models,
exports updated .pkl files, and outputs JSON metrics.
"""

import argparse
import json
import os
import sys
import warnings

warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

import joblib
import numpy as np
import pandas as pd
from nltk.tokenize import RegexpTokenizer
from nltk.stem.snowball import SnowballStemmer
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.pipeline import make_pipeline
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import cross_val_score, train_test_split
from sklearn.metrics import classification_report, accuracy_score, precision_recall_fscore_support


class URLTokenizer:
    def __init__(self):
        self.tokenizer = RegexpTokenizer(r'[A-Za-z]+')
        self.stemmer = SnowballStemmer("english")

    def __call__(self, text):
        tokens = self.tokenizer.tokenize(text)
        return [self.stemmer.stem(word) for word in tokens]


def get_models_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))


def load_original_dataset():
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    csv_path = os.path.join(project_root, 'Dataset', 'phishing_site_urls Combined.csv')
    if not os.path.exists(csv_path):
        print(f"WARNING: Original dataset not found at {csv_path}", file=sys.stderr)
        return None
    df = pd.read_csv(csv_path, usecols=['URL', 'Label'])
    df = df.dropna(subset=['URL', 'Label'])
    df['URL'] = df['URL'].astype(str)
    df = df[df['URL'].str.strip() != '']
    print(f"Loaded original dataset: {len(df)} rows", file=sys.stderr)
    return df


def load_feedback_data(csv_path):
    if not csv_path or not os.path.exists(csv_path):
        print("No feedback data provided, using original dataset only", file=sys.stderr)
        return None
    df = pd.read_csv(csv_path)
    required = {'url', 'is_phishing'}
    if not required.issubset(df.columns):
        print(f"Feedback CSV missing columns {required}, skipping", file=sys.stderr)
        return None
    df = df.dropna(subset=['url', 'is_phishing'])
    df['URL'] = df['url'].astype(str)
    df['Label'] = df['is_phishing'].map({1: 'bad', 0: 'good', '1': 'bad', '0': 'good'})
    print(f"Loaded feedback data: {len(df)} rows", file=sys.stderr)
    return df[['URL', 'Label']]


def retrain(df):
    tokenizer = URLTokenizer()

    trainX, testX, trainY, testY = train_test_split(
        df['URL'], df['Label'], test_size=0.2, random_state=42
    )

    models = {}
    results = {}

    for name, clf in [
        ('logistic_regression', LogisticRegression(max_iter=1000, C=1.0, penalty='l2')),
        ('multinomial_nb', MultinomialNB(alpha=1.0)),
    ]:
        pipeline = make_pipeline(
            CountVectorizer(tokenizer=tokenizer, stop_words='english'),
            clf,
        )
        pipeline.fit(trainX, trainY)

        preds = pipeline.predict(testX)
        acc = accuracy_score(testY, preds)
        precision, recall, f1, _ = precision_recall_fscore_support(testY, preds, average='binary', pos_label='bad')

        cv_scores = cross_val_score(pipeline, df['URL'], df['Label'], cv=5, scoring='accuracy')

        results[name] = {
            'accuracy': round(acc, 4),
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1': round(f1, 4),
            'cv_mean': round(float(cv_scores.mean()), 4),
            'cv_std': round(float(cv_scores.std()), 4),
        }
        models[name] = pipeline

        print(f"{name}: acc={acc:.4f} prec={precision:.4f} rec={recall:.4f} f1={f1:.4f} cv={cv_scores.mean():.4f}+-{cv_scores.std():.4f}", file=sys.stderr)

    models_dir = get_models_dir()
    os.makedirs(models_dir, exist_ok=True)
    for name, pipeline in models.items():
        path = os.path.join(models_dir, f'{name}_pipeline.pkl')
        joblib.dump(pipeline, path)
        size_kb = os.path.getsize(path) / 1024
        print(f"Exported {name} -> {path} ({size_kb:.1f} KB)", file=sys.stderr)

    return results


def main():
    parser = argparse.ArgumentParser(description='Retrain phishing detection models')
    parser.add_argument('--data', help='Path to feedback CSV file', default=None)
    parser.add_argument('--output', help='Output model path (legacy, kept for compat)', default=None)
    args = parser.parse_args()

    datasets = []
    orig = load_original_dataset()
    if orig is not None:
        datasets.append(orig)

    feedback = load_feedback_data(args.data)
    if feedback is not None:
        datasets.append(feedback)

    if not datasets:
        print(json.dumps({'success': False, 'error': 'No training data available'}), flush=True)
        sys.exit(1)

    df = pd.concat(datasets, ignore_index=True).drop_duplicates(subset=['URL'])
    print(f"Combined training data: {len(df)} rows", file=sys.stderr)
    print(f"Class distribution:\n{df['Label'].value_counts().to_string()}", file=sys.stderr)

    results = retrain(df)

    output = {
        'success': True,
        'metrics': results,
        'total_samples': len(df),
        'model_path': os.path.join(get_models_dir(), 'logistic_regression_pipeline.pkl'),
        'timestamp': __import__('datetime').datetime.now().isoformat(),
    }
    print(json.dumps(output), flush=True)


if __name__ == '__main__':
    main()
