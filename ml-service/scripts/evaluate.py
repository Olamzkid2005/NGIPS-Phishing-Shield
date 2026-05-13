#!/usr/bin/env python3
"""
Model Evaluation Script for NGIPS Phishing Shield
Called by backend/src/utils/retrain.js via child_process

Usage:
    python evaluate.py --data <test_data.csv> --model <model.onnx>

Loads a trained model and evaluates it against test data,
outputting precision, recall, F1, accuracy, and confusion matrix as JSON.
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
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
    roc_auc_score,
)


def load_model(model_path):
    if not os.path.exists(model_path):
        # Try the .pkl path
        pkl_path = model_path.replace('.onnx', '_pipeline.pkl')
        if os.path.exists(pkl_path):
            model_path = pkl_path
        else:
            return None
    return joblib.load(model_path)


def load_test_data(data_path):
    if not os.path.exists(data_path):
        return None
    df = pd.read_csv(data_path)
    url_col = 'url' if 'url' in df.columns else 'URL'
    label_col = 'Label' if 'Label' in df.columns else 'label'
    if url_col not in df.columns or label_col not in df.columns:
        return None
    df = df.dropna(subset=[url_col, label_col])
    df[url_col] = df[url_col].astype(str)
    df = df[df[url_col].str.strip() != '']
    return (df[url_col], df[label_col])


def evaluate(model, X_test, y_test):
    preds = model.predict(X_test)

    # Determine pos_label once (supports both string and integer labels)
    unique_labels = set(y_test.unique()) if hasattr(y_test, 'unique') else set(y_test)
    if 'bad' in unique_labels:
        pos_label = 'bad'
    else:
        pos_label = 1

    acc = accuracy_score(y_test, preds)

    try:
        proba = model.predict_proba(X_test)
        classes = list(model.classes_)
        bad_idx = classes.index(pos_label)
        roc_auc = roc_auc_score(y_test, proba[:, bad_idx], multi_class='ovr')
    except Exception:
        roc_auc = None

    precision, recall, f1, _ = precision_recall_fscore_support(
        y_test, preds, average='binary', pos_label=pos_label
    )

    cm = confusion_matrix(y_test, preds).tolist()

    class_report = classification_report(y_test, preds, output_dict=True)

    return {
        'accuracy': round(float(acc), 4),
        'precision': round(float(precision), 4),
        'recall': round(float(recall), 4),
        'f1': round(float(f1), 4),
        'roc_auc': round(float(roc_auc), 4) if roc_auc is not None else None,
        'confusion_matrix': cm,
        'classification_report': class_report,
        'total_samples': int(len(y_test)),
    }


def main():
    parser = argparse.ArgumentParser(description='Evaluate phishing detection model')
    parser.add_argument('--data', required=True, help='Path to test dataset CSV')
    parser.add_argument('--model', required=True, help='Path to model file (.pkl or .onnx)')
    args = parser.parse_args()

    model = load_model(args.model)
    if model is None:
        print(json.dumps({'success': False, 'error': f'Model not found at {args.model}'}), flush=True)
        sys.exit(1)

    test_result = load_test_data(args.data)
    if test_result is None:
        print(json.dumps({'success': False, 'error': f'Test data not found at {args.data}'}), flush=True)
        sys.exit(1)
    X_test, y_test = test_result

    try:
        metrics = evaluate(model, X_test, y_test)
        output = {'success': True, **metrics}
        print(json.dumps(output), flush=True)
    except Exception as e:
        print(json.dumps({'success': False, 'error': str(e)}), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
