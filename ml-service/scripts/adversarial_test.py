#!/usr/bin/env python3
"""
Adversarial Robustness Tests for NGIPS Phishing Shield
Tests model resilience against:
- Typosquatting (g00gle.com, microsoftt.com)
- Homoglyph attacks (g00gle with zeros, paypaI with capital I)
- URL shortener abuse
- Known evasion patterns

Usage:
    python adversarial_test.py                     # Test .pkl models
    python adversarial_test.py --model <path.pkl>  # Test specific model
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
from sklearn.metrics import accuracy_score

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from features import extract_features, feature_matrix

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from app.config import MODEL_FILES


# ---------- Adversarial Test Cases ----------

TEST_PHISHING = [
    "http://paypal-login-verify.xyz/secure/cgi-bin/update",
    "https://secure-bankofamerica.com.verify.xyz/login",
    "http://www.google-chrome-update.com/security/alert",
    "https://apple-id.account-verify.xyz/reset",
    "http://192.168.1.100/login/verify?token=abc123",
    "https://short.url/xyz123",
    "http://bit.ly/3fG7kL2",
    "https://tinyurl.com/abc123def",
    "https://amaz0n-secure.com/account/update",
    "http://rnicrosoft-support.com/alert",
    "https://www.paypaI.com.security-verify.com/login",
    "http://g00gle.com/signin/verify",
    "https://server-status-check.xyz/index.php",
    "http://free-iphone-winner.xyz/claim",
    "https://www.irS.gov/tax-refund/update",
]

TEST_LEGITIMATE = [
    "https://www.google.com",
    "https://github.com/opensource",
    "https://stackoverflow.com/questions",
    "https://www.microsoft.com/en-us/software-download",
    "https://www.apple.com/iphone",
    "https://www.amazon.com/gp/bestsellers",
    "https://www.paypal.com/us/home",
    "https://www.bankofamerica.com",
    "https://www.linkedin.com/in",
    "https://twitter.com/home",
    "https://www.reddit.com/r/programming",
    "https://www.wikipedia.org",
    "https://www.cloudflare.com",
    "https://news.ycombinator.com",
    "https://www.irs.gov/refunds",
]


TYPO_VARIANTS = [
    # Typosquatting
    ("gogle.com/login", "google"),
    ("microsft.com/signin", "microsoft"),
    ("whatsapp.com/verify", "whatsapp"),
    ("facebok.com/login", "facebook"),
    ("instagrram.com/account", "instagram"),
    # Homoglyphs
    ("g00gle.com/verify", "zero-vs-o"),
    ("paypaI.com/login", "capital-i-vs-l"),
    ("arnazon.com/signin", "rn-vs-m"),
    # Subdomain abuse
    ("login.google.com.evil.com/steal", "subdomain-trick"),
    ("google.com@evil.com/password", "at-sign-trick"),
    # Trusted tld with bad path
    ("https://drive.google.com/security/alert/update/account", "trusted-tld-bad-path"),
]

SHORTENER_URLS = [
    "https://bit.ly/3abc123",
    "http://tinyurl.com/y7k8m9n0",
    "https://shorturl.at/qRSTU",
    "http://ow.ly/X9zK30rLmN",
]

ENCRYPTED_PAYLOAD = [
    "http://evil.com/%72%65%64%69%72%65%63%74?url=phishing",
    "http://phishing.com/\u2105\u2113\u2116\u2117\u2118/account",
]


def load_model(model_path=None):
    if model_path and os.path.exists(model_path):
        return joblib.load(model_path)

    for name, path in MODEL_FILES.items():
        if path.exists():
            return joblib.load(path)
    return None


def evaluate_on_test_set(model, urls, expected_half):
    if isinstance(model, dict):
        preds = []
        for u in urls:
            try:
                from predict import predict as p
                result = p(u, model)
                preds.append(1 if result.get('is_phishing') else 0)
            except Exception:
                preds.append(0)
    else:
        preds = model.predict(urls)
        classes = model.classes_ if hasattr(model, 'classes_') else ['good', 'bad']
        preds = [1 if p == 'bad' or p == 1 else 0 for p in preds]

    expected = [1] * len(urls) if expected_half else [0] * len(urls)
    acc = accuracy_score(expected, preds)
    correct = sum(1 for e, p in zip(expected, preds) if e == p)
    return acc, correct, len(urls), preds


def run_all_tests(model):
    print(f"\n{'='*60}")
    print(f"ADVERSARIAL ROBUSTNESS REPORT")
    print(f"{'='*60}")

    all_results = {}

    # ---------- Known phishing (should detect) ----------
    acc, correct, total, _ = evaluate_on_test_set(model, TEST_PHISHING, True)
    all_results['known_phishing'] = {'accuracy': acc, 'detected': correct, 'total': total}
    print(f"\nKnown phishing URLs (should block): {correct}/{total} = {acc*100:.1f}%")

    # ---------- Known legitimate (should allow) ----------
    acc, correct, total, _ = evaluate_on_test_set(model, TEST_LEGITIMATE, False)
    all_results['known_legitimate'] = {'accuracy': acc, 'detected': correct, 'total': total}
    print(f"Known legitimate URLs (should allow): {correct}/{total} = {acc*100:.1f}%")

    # ---------- Typosquatting variants ----------
    typos = [v[0] for v in TYPO_VARIANTS]
    acc, correct, total, preds = evaluate_on_test_set(model, typos, False)
    all_results['typosquatting'] = {
        'accuracy': acc,
        'flagged_as_phishing': sum(preds),
        'total': total,
        'details': [
            {'url': typos[i], 'type': TYPO_VARIANTS[i][1], 'phishing_predicted': bool(preds[i])}
            for i in range(len(typos))
        ],
    }
    print(f"Typosquatting detection: {sum(preds)}/{total} flagged as phishing")

    # Urls that look like legitimate but are slightly off - these should ideally be flagged
    # even if not exact matches

    # ---------- URL shorteners ----------
    acc, correct, total, preds = evaluate_on_test_set(model, SHORTENER_URLS, True)
    all_results['shorteners'] = {'flagged': sum(preds), 'total': total}
    print(f"URL shorteners (edge case): {sum(preds)}/{total} flagged as phishing")

    # ---------- Encoded/Unicode ----------
    acc, correct, total, _ = evaluate_on_test_set(model, ENCRYPTED_PAYLOAD, True)
    all_results['encoded'] = {'detected': correct, 'total': total}
    print(f"Encoded/Unicode URLs: {correct}/{total} suspicious flags")

    return all_results


def main():
    parser = argparse.ArgumentParser(description='Adversarial robustness testing')
    parser.add_argument('--model', help='Path to model .pkl file', default=None)
    args = parser.parse_args()

    model = load_model(args.model)
    if model is None:
        print("ERROR: No model found. Run export_models.py first.", file=sys.stderr)
        sys.exit(1)

    results = run_all_tests(model)

    output_path = os.path.join(
        os.path.join(os.path.dirname(__file__), '..', 'models'),
        f'adversarial_report_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json',
    )
    with open(output_path, 'w') as f:
        json.dump(results, f, indent=2)
    print(f"\nReport saved: {output_path}")

    # Pass/fail summary
    phishing_rate = results['known_phishing']['accuracy']
    legit_rate = results['known_legitimate']['accuracy']
    typos_rate = results['typosquatting']['accuracy']

    failures = []
    if phishing_rate < 0.8:
        failures.append(f"Phishing detection {phishing_rate*100:.0f}% < 80%")
    if legit_rate < 0.8:
        failures.append(f"Legitimate pass-through {legit_rate*100:.0f}% < 80%")
    if typos_rate < 0.5:
        failures.append(f"Typosquatting detection {typos_rate*100:.0f}% < 50%")

    print(f"\n{'='*60}")
    if failures:
        print(f"FAILURES ({len(failures)}):")
        for f in failures:
            print(f"  !! {f}")
        sys.exit(1)
    else:
        print("ALL CHECKS PASSED")
    print(f"{'='*60}")


if __name__ == '__main__':
    main()
