#!/usr/bin/env python3
"""
ML Inference Script for Phishing Detection
Called by Express backend via child_process
Usage: python predict.py <url> [threshold]
"""

import sys
import os
import warnings

# Suppress all warnings before any imports
warnings.filterwarnings("ignore")
os.environ["PYTHONWARNINGS"] = "ignore"

import json
import joblib
import time
from nltk.tokenize import RegexpTokenizer
from nltk.stem.snowball import SnowballStemmer


class URLTokenizer:
    """Must be defined at module level so joblib can unpickle pipeline objects
    that were serialized with this tokenizer as __main__.URLTokenizer."""
    def __init__(self):
        self.tokenizer = RegexpTokenizer(r'[A-Za-z]+')
        self.stemmer = SnowballStemmer("english")

    def __call__(self, text):
        tokens = self.tokenizer.tokenize(text)
        return [self.stemmer.stem(word) for word in tokens]


def verify_model_file(path):
    """Basic check that file exists and is not empty."""
    if not os.path.exists(path):
        return False
    if os.path.getsize(path) < 1000:  # Model files should be at least 1KB
        return False
    return True


def load_models():
    models_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'models')

    lr_path = os.path.join(models_dir, 'logistic_regression_pipeline.pkl')
    mnb_path = os.path.join(models_dir, 'multinomial_nb_pipeline.pkl')

    models = {}

    if verify_model_file(lr_path):
        models['logistic_regression'] = joblib.load(lr_path)

    if verify_model_file(mnb_path):
        models['multinomial_nb'] = joblib.load(mnb_path)

    return models


def get_phishing_class_index(model):
    """Find the index of 'bad' (phishing) class in the model's classes_ array."""
    classes = list(model.classes_)
    if 'bad' in classes:
        return classes.index('bad')
    elif 1 in classes:
        return classes.index(1)
    else:
        raise ValueError(f"Model classes {classes} do not contain 'bad' or 1. Cannot determine phishing class index.")


def validate_url(url):
    """Basic URL validation."""
    if not url or not isinstance(url, str):
        return False
    if len(url) > 2048:
        return False
    if not any(c.isalnum() for c in url):
        return False
    return True


def predict(url, models, threshold=0.5):
    start_time = time.time()
    results = {}

    for name, model in models.items():
        try:
            proba = model.predict_proba([url])[0]
            bad_idx = get_phishing_class_index(model)
            phishing_prob = float(proba[bad_idx])
            results[name] = round(phishing_prob, 6)
        except Exception as e:
            results[name] = {'error': 'Prediction failed'}

    valid_results = {k: v for k, v in results.items() if not isinstance(v, dict)}

    if valid_results:
        weights = {'logistic_regression': 0.6, 'multinomial_nb': 0.4}
        weighted_sum = 0.0
        total_weight = 0.0

        for name, score in valid_results.items():
            weight = weights.get(name, 1.0)
            weighted_sum += score * weight
            total_weight += weight

        ensemble_score = weighted_sum / total_weight if total_weight > 0 else 0.5
        latency_ms = round((time.time() - start_time) * 1000, 2)

        lr_score = valid_results.get('logistic_regression')
        mnb_score = valid_results.get('multinomial_nb')

        return {
            'success': True,
            'is_phishing': ensemble_score >= threshold,
            'confidence': round(ensemble_score, 4),
            'ml_confidence': round(ensemble_score, 4),
            'model_scores': {
                'logistic_regression': round(lr_score, 4) if lr_score is not None else None,
                'multinomial_nb': round(mnb_score, 4) if mnb_score is not None else None
            },
            'latency_ms': latency_ms,
            'model_version': 'ensemble-1.0.0'
        }
    else:
        return {
            'success': False,
            'error': 'All models failed',
            'details': results
        }


def main():
    if len(sys.argv) < 2:
        print(json.dumps({'success': False, 'error': 'No URL provided'}), flush=True)
        sys.exit(1)

    url = sys.argv[1]

    if not validate_url(url):
        print(json.dumps({'success': False, 'error': 'Invalid URL'}), flush=True)
        sys.exit(1)

    threshold = float(sys.argv[2]) if len(sys.argv) > 2 else 0.5

    try:
        models = load_models()
        if not models:
            print(json.dumps({'success': False, 'error': 'No models found'}), flush=True)
            sys.exit(1)

        result = predict(url, models, threshold)
        print(json.dumps(result), flush=True)
        sys.exit(0)
    except Exception as e:
        print(json.dumps({'success': False, 'error': 'Internal error'}), flush=True)
        sys.exit(1)


if __name__ == '__main__':
    main()
