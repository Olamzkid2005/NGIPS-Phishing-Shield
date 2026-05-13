#!/usr/bin/env python3
"""
Comprehensive Model Training Pipeline for NGIPS Phishing Shield
Phase 2+ implementation: hybrid features, hyperparameter tuning,
probability calibration, cross-validation, MLflow tracking, model versioning.

Usage:
    python train.py                          # Full training with all improvements
    python train.py --quick                  # Quick training (no GridSearch)
    python train.py --no-mlflow              # Skip MLflow logging
"""

import argparse
import hashlib
import json
import os
import sys
import time
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

import joblib
import numpy as np
import pandas as pd
from nltk.tokenize import RegexpTokenizer
from nltk.stem.snowball import SnowballStemmer
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import VotingClassifier
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    precision_recall_fscore_support, roc_auc_score, roc_curve,
)
from sklearn.model_selection import GridSearchCV, StratifiedKFold, cross_val_score, train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import FunctionTransformer, StandardScaler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import FEATURE_NAMES, feature_matrix


# ---------- Tokenizer ----------

class URLTokenizer:
    def __init__(self):
        self.tokenizer = RegexpTokenizer(r'[A-Za-z]+')
        self.stemmer = SnowballStemmer("english")

    def __call__(self, text):
        tokens = self.tokenizer.tokenize(text)
        return [self.stemmer.stem(word) for word in tokens]


# ---------- Paths ----------

def get_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def get_models_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))

def get_mlflow_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'mlruns'))


# ---------- Dataset ----------

def load_dataset(use_feedback: bool = True):
    project_root = get_project_root()
    csv_path = os.path.join(project_root, 'Dataset', 'phishing_site_urls Combined.csv')
    print(f"Loading dataset: {csv_path}")
    df = pd.read_csv(csv_path)
    df = df.dropna(subset=['URL', 'Label'])
    df['URL'] = df['URL'].astype(str)
    df = df[df['URL'].str.strip() != '']
    df['Label'] = df['Label'].map({'bad': 1, 'good': 0})
    print(f"  Rows: {len(df):,}")
    print(f"  Phishing: {df['Label'].sum():,}  Legitimate: {(1 - df['Label']).sum():,}")
    return df





# ---------- Hybrid Feature Pipeline ----------

def build_hybrid_pipeline(classifier, calibrate: bool = True):
    url_tokenizer = URLTokenizer()

    text_pipeline = Pipeline([
        ('vectorizer', CountVectorizer(
            tokenizer=url_tokenizer,
            stop_words='english',
            max_features=50000,
            ngram_range=(1, 2),
            min_df=2,
        )),
    ])

    heuristic_pipeline = Pipeline([
        ('extract', FunctionTransformer(feature_matrix, validate=False)),
        ('scaler', StandardScaler(with_mean=False)),
    ])

    feature_union = FeatureUnion([
        ('text', text_pipeline),
        ('heuristic', heuristic_pipeline),
    ])

    if calibrate and not isinstance(classifier, CalibratedClassifierCV):
        classifier = CalibratedClassifierCV(
            classifier,
            method='sigmoid',
            cv=3,
            ensemble=True,
        )

    return Pipeline([
        ('features', feature_union),
        ('classifier', classifier),
    ])


# ---------- Hyperparameter Grids ----------

LR_PARAM_GRID = {
    'classifier__estimator__C': [0.1, 0.5, 1.0, 5.0, 10.0],
    'classifier__estimator__penalty': ['l2'],
    'classifier__estimator__solver': ['lbfgs', 'saga'],
    'classifier__estimator__class_weight': [None, 'balanced'],
    'features__text__vectorizer__max_features': [30000, 50000],
    'features__text__vectorizer__ngram_range': [(1, 1), (1, 2)],
}

NB_PARAM_GRID = {
    'classifier__estimator__alpha': [0.01, 0.1, 0.5, 1.0, 2.0],
    'classifier__estimator__fit_prior': [True, False],
    'features__text__vectorizer__max_features': [30000, 50000],
    'features__text__vectorizer__ngram_range': [(1, 1), (1, 2)],
}


# ---------- Training ----------

def compute_model_hash(pipeline):
    h = hashlib.sha256()
    for name, step in pipeline.steps:
        h.update(name.encode())
        try:
            h.update(str(step.__class__.__name__).encode())
        except Exception:
            pass
    return h.hexdigest()[:12]


def train_model(name, clf, X_train, y_train, X_test, y_test, use_grid_search: bool, df_full):
    print(f"\n{'='*60}")
    print(f"Training: {name}")
    print(f"{'='*60}")

    pipeline = build_hybrid_pipeline(clf, calibrate=True)

    if use_grid_search:
        grid = LR_PARAM_GRID if 'logistic' in name else NB_PARAM_GRID
        cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=42)
        search = GridSearchCV(
            pipeline,
            param_grid=grid,
            cv=cv,
            scoring='roc_auc',
            n_jobs=-1,
            verbose=1,
            refit=True,
        )
        search.fit(X_train, y_train)
        best_pipeline = search.best_estimator_
        print(f"  Best params: {search.best_params_}")
        cv_score = search.best_score_
    else:
        pipeline.fit(X_train, y_train)
        best_pipeline = pipeline
        cv_scores = cross_val_score(pipeline, df_full['URL'], df_full['Label'], cv=5, scoring='roc_auc')
        cv_score = float(cv_scores.mean())
        print(f"  5-fold CV ROC-AUC: {cv_score:.4f}")

    # Predict
    y_pred = best_pipeline.predict(X_test)
    y_proba = best_pipeline.predict_proba(X_test)[:, 1]

    # Metrics
    acc = accuracy_score(y_test, y_pred)
    precision, recall, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary')
    roc_auc = roc_auc_score(y_test, y_proba)
    cm = confusion_matrix(y_test, y_pred).tolist()

    print(f"  Test Accuracy:  {acc:.4f}")
    print(f"  Precision:      {precision:.4f}")
    print(f"  Recall:         {recall:.4f}")
    print(f"  F1:             {f1:.4f}")
    print(f"  ROC-AUC:        {roc_auc:.4f}")
    print(f"  CV ROC-AUC:     {cv_score:.4f}")
    print(f"\n  Classification Report:")
    print(classification_report(y_test, y_pred, target_names=['good', 'bad']))

    return best_pipeline, {
        'accuracy': round(float(acc), 4),
        'precision': round(float(precision), 4),
        'recall': round(float(recall), 4),
        'f1': round(float(f1), 4),
        'roc_auc': round(float(roc_auc), 4),
        'cv_score': round(float(cv_score), 4),
        'confusion_matrix': cm,
    }, y_pred, y_proba


# ---------- Ensemble ----------

def build_ensemble(lr_pipeline, nb_pipeline, X_train, y_train):
    ensemble = VotingClassifier(
        estimators=[
            ('lr', lr_pipeline),
            ('nb', nb_pipeline),
        ],
        voting='soft',
        weights=[0.6, 0.4],
    )
    ensemble.fit(X_train, y_train)
    return ensemble


# ---------- MLflow ----------

def try_mlflow():
    try:
        import mlflow
        from mlflow.models import infer_signature
        mlflow.set_tracking_uri(f'file:{get_mlflow_dir()}')
        mlflow.set_experiment('ngips-phishing-shield')
        return mlflow
    except ImportError:
        return None


def log_to_mlflow(mlflow, name, metrics, pipeline, model_hash, X_sample, use_grid_search: bool):
    if mlflow is None:
        return
    with mlflow.start_run(run_name=f"{name}_{model_hash}"):
        mlflow.log_param('model_name', name)
        mlflow.log_param('model_hash', model_hash)
        mlflow.log_param('use_grid_search', use_grid_search)
        mlflow.log_param('feature_count', len(FEATURE_NAMES))
        mlflow.log_param('hybrid_features', True)
        mlflow.log_param('calibration', 'platt_sigmoid')
        for k, v in metrics.items():
            if isinstance(v, (int, float)):
                mlflow.log_metric(k, v)
        try:
            signature = infer_signature(X_sample, pipeline.predict(X_sample[:1]))
            mlflow.sklearn.log_model(pipeline, f'model_{name}', signature=signature)
        except Exception:
            mlflow.sklearn.log_model(pipeline, f'model_{name}')


# ---------- Export ----------

def export_model(pipeline, name, model_hash, metadata):
    models_dir = get_models_dir()
    os.makedirs(models_dir, exist_ok=True)

    pkl_path = os.path.join(models_dir, f'{name}_pipeline.pkl')
    versioned_path = os.path.join(models_dir, f'{name}_pipeline_{model_hash}.pkl')

    joblib.dump(pipeline, pkl_path)

    metadata_path = os.path.join(models_dir, f'{name}_metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    size_kb = os.path.getsize(pkl_path) / 1024
    print(f"\n  Exported: {pkl_path} ({size_kb:.1f} KB)")
    print(f"  Metadata: {metadata_path}")

    return pkl_path


# ---------- Main ----------

def main():
    parser = argparse.ArgumentParser(description='NGIPS Phishing Shield - Model Training')
    parser.add_argument('--quick', action='store_true', help='Skip GridSearch, use default params')
    parser.add_argument('--no-mlflow', action='store_true', help='Disable MLflow logging')
    parser.add_argument('--no-calibrate', action='store_true', help='Skip probability calibration')
    args = parser.parse_args()

    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

    print("=" * 60)
    print("NGIPS Phishing Shield - Comprehensive Model Training")
    print(f"Timestamp: {timestamp}")
    print(f"Quick mode: {args.quick}")
    print(f"MLflow: {'disabled' if args.no_mlflow else 'enabled'}")
    print(f"Calibration: {'disabled' if args.no_calibrate else 'enabled'}")
    print("=" * 60)

    # Load data
    df = load_dataset()
    X = df['URL'].values
    y = df['Label'].values

    # Split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y,
    )
    print(f"\nTrain: {len(X_train):,}  Test: {len(X_test):,}")

    # MLflow
    mlflow = None if args.no_mlflow else try_mlflow()
    if mlflow:
        print("MLflow tracking: ENABLED")
    else:
        print("MLflow tracking: disabled (install with: pip install mlflow)")

    # Train models
    models = {}
    all_metrics = {}

    for name, clf in [
        ('logistic_regression', LogisticRegression(max_iter=2000, random_state=42)),
        ('multinomial_nb', MultinomialNB()),
    ]:
        pipeline, metrics, y_pred, y_proba = train_model(
            name, clf, X_train, y_train, X_test, y_test,
            use_grid_search=not args.quick,
            df_full=df,
        )
        if args.no_calibrate and hasattr(pipeline.named_steps['classifier'], 'base_estimator'):
            pipeline.named_steps['classifier'] = pipeline.named_steps['classifier'].base_estimator
        model_hash = compute_model_hash(pipeline)
        models[name] = pipeline
        all_metrics[name] = metrics

        export_model(pipeline, name, model_hash, {
            'model': name,
            'timestamp': timestamp,
            'hash': model_hash,
            'metrics': metrics,
            'features': FEATURE_NAMES,
            'grid_search': not args.quick,
            'calibrated': not args.no_calibrate,
            'hybrid': True,
        })

        log_to_mlflow(mlflow, name, metrics, pipeline, model_hash, X_test[:5], not args.quick)

    # Build ensemble
    print(f"\n{'='*60}")
    print("Building ensemble (soft voting: LR 0.6 + NB 0.4)")
    print(f"{'='*60}")

    ensemble = build_ensemble(models['logistic_regression'], models['multinomial_nb'], X_train, y_train)
    y_pred_ens = ensemble.predict(X_test)
    y_proba_ens = ensemble.predict_proba(X_test)[:, 1]

    ens_acc = accuracy_score(y_test, y_pred_ens)
    ens_prec, ens_rec, ens_f1, _ = precision_recall_fscore_support(y_test, y_pred_ens, average='binary')
    ens_auc = roc_auc_score(y_test, y_proba_ens)

    ensemble_metrics = {
        'accuracy': round(float(ens_acc), 4),
        'precision': round(float(ens_prec), 4),
        'recall': round(float(ens_rec), 4),
        'f1': round(float(ens_f1), 4),
        'roc_auc': round(float(ens_auc), 4),
    }
    all_metrics['ensemble'] = ensemble_metrics

    print(f"  Ensemble Accuracy: {ens_acc:.4f}")
    print(f"  Precision: {ens_prec:.4f}")
    print(f"  Recall:    {ens_rec:.4f}")
    print(f"  F1:        {ens_f1:.4f}")
    print(f"  ROC-AUC:   {ens_auc:.4f}")

    model_hash = compute_model_hash(ensemble)
    export_model(ensemble, 'ensemble', model_hash, {
        'model': 'ensemble',
        'timestamp': timestamp,
        'hash': model_hash,
        'metrics': ensemble_metrics,
        'weights': {'logistic_regression': 0.6, 'multinomial_nb': 0.4},
        'hybrid': True,
        'calibrated': not args.no_calibrate,
    })

    log_to_mlflow(mlflow, 'ensemble', ensemble_metrics, ensemble, model_hash, X_test[:5], not args.quick)

    # Summary
    print(f"\n{'='*60}")
    print("TRAINING SUMMARY")
    print(f"{'='*60}")
    for name, m in all_metrics.items():
        print(f"  {name:25s}  Acc={m['accuracy']:.4f}  F1={m['f1']:.4f}  AUC={m['roc_auc']:.4f}")
    print(f"\n  Feature count: {len(FEATURE_NAMES)} heuristic + bag-of-words")
    print(f"  Calibration: {'Platt sigmoid (CalibratedClassifierCV)' if not args.no_calibrate else 'None'}")
    print(f"  Grid search: {'enabled' if not args.quick else 'disabled'}")
    print(f"  Total training samples: {len(X):,}")
    print(f"{'='*60}")

    # Save combined report
    report_path = os.path.join(get_models_dir(), f'training_report_{timestamp}.json')
    with open(report_path, 'w') as f:
        json.dump(all_metrics, f, indent=2)
    print(f"Report saved: {report_path}")


if __name__ == '__main__':
    main()
