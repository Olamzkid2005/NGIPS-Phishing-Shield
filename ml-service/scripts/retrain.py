#!/usr/bin/env python3
"""
Retraining Pipeline for NGIPS Phishing Shield
Hybrid features + calibration + cross-validation + MLflow tracking.
Called by backend/src/utils/retrain.js on drift detection or manually.

Usage:
    python retrain.py --data <feedback.csv> --output <model_dir>
"""

import argparse
import json
import os
import sys
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

import joblib
import numpy as np
import pandas as pd
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import VotingClassifier
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_score, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler
from nltk.tokenize import RegexpTokenizer
from nltk.stem.snowball import SnowballStemmer

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import feature_matrix


class URLTokenizer:
    def __init__(self):
        self.tokenizer = RegexpTokenizer(r'[A-Za-z]+')
        self.stemmer = SnowballStemmer("english")
    def __call__(self, text):
        return [self.stemmer.stem(w) for w in self.tokenizer.tokenize(text)]


def get_models_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))

def get_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def get_mlflow_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'mlruns'))


def build_hybrid_pipeline(clf):
    tokenizer = URLTokenizer()
    return Pipeline([
        ('features', FeatureUnion([
            ('text', Pipeline([
                ('vec', CountVectorizer(
                    tokenizer=tokenizer, stop_words='english',
                    max_features=50000, ngram_range=(1, 2), min_df=2,
                )),
            ])),
            ('heuristic', Pipeline([
                ('extract', FunctionTransformer(feature_matrix, validate=False)),
                ('scale', StandardScaler(with_mean=False)),
            ])),
        ])),
        ('classifier', CalibratedClassifierCV(clf, method='sigmoid', cv=3, ensemble=True)),
    ])


def load_data(args):
    datasets = []

    original_path = os.path.join(get_project_root(), 'Dataset', 'phishing_site_urls Combined.csv')
    if os.path.exists(original_path):
        df = pd.read_csv(original_path, usecols=['URL', 'Label'])
        df = df.dropna()
        df['URL'] = df['URL'].astype(str)
        df = df[df['URL'].str.strip() != '']
        df['Label'] = df['Label'].map({'bad': 1, 'good': 0})
        datasets.append(df)
        print(f"Original dataset: {len(df):,} rows", file=sys.stderr)

    if args.data and os.path.exists(args.data):
        fb = pd.read_csv(args.data)
        required = {'url', 'is_phishing'}
        if required.issubset(fb.columns):
            fb = fb.dropna(subset=['url', 'is_phishing'])
            fb['URL'] = fb['url'].astype(str)
            fb['Label'] = fb['is_phishing'].astype(int)
            datasets.append(fb[['URL', 'Label']])
            print(f"Feedback data: {len(fb):,} rows", file=sys.stderr)

    if not datasets:
        return None

    df = pd.concat(datasets, ignore_index=True).drop_duplicates(subset=['URL'])
    print(f"Combined: {len(df):,} rows", file=sys.stderr)
    counts = df['Label'].value_counts()
    print(f"  Phishing: {counts.get(1, 0):,}  Legitimate: {counts.get(0, 0):,}", file=sys.stderr)
    return df


def retrain(df):
    X_train, X_test, y_train, y_test = train_test_split(
        df['URL'], df['Label'], test_size=0.2, random_state=42, stratify=df['Label'],
    )

    models = {}
    results = {}

    for name, clf in [
        ('logistic_regression', LogisticRegression(max_iter=2000, random_state=42)),
        ('multinomial_nb', MultinomialNB()),
    ]:
        pipeline = build_hybrid_pipeline(clf)
        pipeline.fit(X_train, y_train)

        y_pred = pipeline.predict(X_test)
        y_proba = pipeline.predict_proba(X_test)[:, 1]

        acc = accuracy_score(y_test, y_pred)
        prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary')
        auc = roc_auc_score(y_test, y_proba)
        cv = cross_val_score(pipeline, df['URL'], df['Label'], cv=5, scoring='roc_auc')

        metrics = {
            'accuracy': round(float(acc), 4),
            'precision': round(float(prec), 4),
            'recall': round(float(rec), 4),
            'f1': round(float(f1), 4),
            'roc_auc': round(float(auc), 4),
            'cv_mean': round(float(cv.mean()), 4),
            'cv_std': round(float(cv.std()), 4),
        }
        results[name] = metrics
        models[name] = pipeline

        print(f"{name}: acc={acc:.4f} prec={prec:.4f} rec={rec:.4f} f1={f1:.4f} auc={auc:.4f} cv={cv.mean():.4f}+-{cv.std():.4f}", file=sys.stderr)

    ensemble = VotingClassifier(estimators=[
        ('lr', models['logistic_regression']),
        ('nb', models['multinomial_nb']),
    ], voting='soft', weights=[0.6, 0.4])
    ensemble.fit(X_train, y_train)

    y_pred_ens = ensemble.predict(X_test)
    y_proba_ens = ensemble.predict_proba(X_test)[:, 1]
    ens_acc = accuracy_score(y_test, y_pred_ens)
    ens_prec, ens_rec, ens_f1, _ = precision_recall_fscore_support(y_test, y_pred_ens, average='binary')
    ens_auc = roc_auc_score(y_test, y_proba_ens)

    results['ensemble'] = {
        'accuracy': round(float(ens_acc), 4),
        'precision': round(float(ens_prec), 4),
        'recall': round(float(ens_rec), 4),
        'f1': round(float(ens_f1), 4),
        'roc_auc': round(float(ens_auc), 4),
    }
    models['ensemble'] = ensemble

    models_dir = get_models_dir()
    os.makedirs(models_dir, exist_ok=True)
    for name, pipeline in models.items():
        path = os.path.join(models_dir, f'{name}_pipeline.pkl')
        joblib.dump(pipeline, path)
        size_kb = os.path.getsize(path) / 1024
        print(f"Exported {name} -> {path} ({size_kb:.1f} KB)", file=sys.stderr)

    return results


def main():
    parser = argparse.ArgumentParser(description='Retrain phishing models with feedback')
    parser.add_argument('--data', help='Feedback CSV path', default=None)
    parser.add_argument('--output', help='Legacy output path', default=None)
    args = parser.parse_args()

    df = load_data(args)
    if df is None:
        print(json.dumps({'success': False, 'error': 'No training data'}), flush=True)
        sys.exit(1)

    try:
        results = retrain(df)
        output = {
            'success': True,
            'metrics': results,
            'total_samples': len(df),
            'hybrid_features': True,
            'calibrated': True,
            'timestamp': datetime.now().isoformat(),
            'model_path': os.path.join(get_models_dir(), 'logistic_regression_pipeline.pkl'),
        }
        print(json.dumps(output), flush=True)
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
