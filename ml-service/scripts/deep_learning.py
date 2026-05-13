#!/usr/bin/env python3
"""
Character-level CNN baseline for phishing URL detection.
Compares against the sklearn ensemble to validate improvement.

Usage:
    python deep_learning.py                          # Train and evaluate
    python deep_learning.py --quick                  # Fewer epochs for testing
"""

import argparse
import json
import os
import sys
import warnings
from datetime import datetime

warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

import numpy as np
import pandas as pd
from sklearn.metrics import (
    accuracy_score, classification_report, confusion_matrix,
    precision_recall_fscore_support, roc_auc_score,
)
from sklearn.model_selection import train_test_split

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import FEATURE_NAMES, feature_matrix


def get_project_root():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

def get_models_dir():
    return os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models'))


CHAR_SET = 'abcdefghijklmnopqrstuvwxyz0123456789.-/_@?#=&%+:'
CHAR_TO_IDX = {c: i + 1 for i, c in enumerate(CHAR_SET)}
MAX_URL_LEN = 200
NUM_CHARS = len(CHAR_SET) + 1  # +1 for unknown/padding


def url_to_char_sequence(url: str, max_len: int = MAX_URL_LEN) -> np.ndarray:
    seq = np.zeros(max_len, dtype=np.int32)
    url = url.lower().strip()
    for i, ch in enumerate(url[:max_len]):
        seq[i] = CHAR_TO_IDX.get(ch, 0)
    return seq


def build_char_cnn(vocab_size: int, max_len: int, num_heuristic: int):
    try:
        import tensorflow as tf
        from tensorflow.keras import Input, Model
        from tensorflow.keras.layers import (
            Conv1D, Dense, Dropout, Embedding, Flatten,
            GlobalMaxPooling1D, MaxPooling1D, Concatenate, BatchNormalization,
        )
    except ImportError:
        print("ERROR: tensorflow not installed. Run: pip install tensorflow")
        sys.exit(1)

    # Character CNN branch
    char_input = Input(shape=(max_len,), name='char_input')
    x = Embedding(vocab_size, 64, input_length=max_len)(char_input)
    x = Conv1D(128, 5, activation='relu')(x)
    x = MaxPooling1D(2)(x)
    x = Conv1D(128, 3, activation='relu')(x)
    x = GlobalMaxPooling1D()(x)
    x = BatchNormalization()(x)
    x = Dropout(0.5)(x)
    x = Dense(64, activation='relu')(x)
    x = Dropout(0.3)(x)

    # Heuristic features branch
    heuristic_input = Input(shape=(num_heuristic,), name='heuristic_input')
    y = Dense(32, activation='relu')(heuristic_input)
    y = BatchNormalization()(y)

    # Concatenate
    combined = Concatenate()([x, y])
    z = Dense(32, activation='relu')(combined)
    z = Dropout(0.3)(z)
    output = Dense(1, activation='sigmoid')(z)

    model = Model(inputs=[char_input, heuristic_input], outputs=output)
    model.compile(
        optimizer='adam',
        loss='binary_crossentropy',
        metrics=['accuracy', tf.keras.metrics.AUC(name='auc')],
    )
    return model


def main():
    parser = argparse.ArgumentParser(description='Deep learning baseline for phishing detection')
    parser.add_argument('--quick', action='store_true', help='Fewer epochs')
    args = parser.parse_args()

    epochs = 5 if args.quick else 20
    batch_size = 128

    print("=" * 60)
    print("Deep Learning Baseline - Character-level CNN")
    print(f"Epochs: {epochs}, Batch size: {batch_size}")
    print("=" * 60)

    df = pd.read_csv(os.path.join(get_project_root(), 'Dataset', 'phishing_site_urls Combined.csv'))
    df = df.dropna(subset=['URL', 'Label'])
    df['Label'] = df['Label'].map({'bad': 1, 'good': 0}).fillna(0)

    X_text = df['URL'].values
    y = df['Label'].values.astype(np.float32)

    X_train_t, X_test_t, y_train, y_test = train_test_split(
        X_text, y, test_size=0.2, random_state=42, stratify=y,
    )

    print(f"\nPreparing {len(X_train_t):,} training sequences...")
    X_train_char = np.array([url_to_char_sequence(u) for u in X_train_t])
    X_test_char = np.array([url_to_char_sequence(u) for u in X_test_t])
    X_train_heur = feature_matrix(X_train_t.tolist())
    X_test_heur = feature_matrix(X_test_t.tolist())

    print(f"  Char sequences: {X_train_char.shape}")
    print(f"  Heuristic features: {X_train_heur.shape}")

    model = build_char_cnn(NUM_CHARS, MAX_URL_LEN, len(FEATURE_NAMES))
    model.summary()

    print(f"\nTraining CNN...")
    history = model.fit(
        [X_train_char, X_train_heur], y_train,
        validation_data=([X_test_char, X_test_heur], y_test),
        epochs=epochs,
        batch_size=batch_size,
        verbose=1,
    )

    y_pred_prob = model.predict([X_test_char, X_test_heur], verbose=0).flatten()
    y_pred = (y_pred_prob >= 0.5).astype(int)

    acc = accuracy_score(y_test, y_pred)
    prec, rec, f1, _ = precision_recall_fscore_support(y_test, y_pred, average='binary')
    auc = roc_auc_score(y_test, y_pred_prob)

    print(f"\n{'='*60}")
    print("CNN EVALUATION")
    print(f"{'='*60}")
    print(f"  Accuracy:  {acc:.4f}")
    print(f"  Precision: {prec:.4f}")
    print(f"  Recall:    {rec:.4f}")
    print(f"  F1:        {f1:.4f}")
    print(f"  ROC-AUC:   {auc:.4f}")
    print(f"\n{classification_report(y_test, y_pred, target_names=['good', 'bad'])}")

    # Save model
    try:
        models_dir = get_models_dir()
        model_path = os.path.join(models_dir, 'char_cnn.keras')
        model.save(model_path)
        print(f"Model saved: {model_path}")

        metrics = {
            'accuracy': round(float(acc), 4),
            'precision': round(float(prec), 4),
            'recall': round(float(rec), 4),
            'f1': round(float(f1), 4),
            'roc_auc': round(float(auc), 4),
            'epochs': epochs,
        }
        report_path = os.path.join(models_dir, f'cnn_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json')
        with open(report_path, 'w') as f:
            json.dump(metrics, f, indent=2)
        print(f"Report: {report_path}")
    except Exception as e:
        print(f"Save warning: {e}")

    print("=" * 60)


if __name__ == '__main__':
    main()
