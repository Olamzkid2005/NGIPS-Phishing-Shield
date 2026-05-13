"""
Python-side Heuristic Feature Extraction for Phishing URLs.
Mirrors the JS featureExtraction.js logic for training-serving consistency.
Produces 20+ structural features per URL for hybrid BoW+heuristic models.
"""

import math
import re
from urllib.parse import urlparse
from typing import List, Optional

import numpy as np

SUSPICIOUS_TLDS = {
    'xyz', 'top', 'gq', 'tk', 'ml', 'cf', 'ga', 'click', 'link',
    'work', 'date', 'download', 'stream', 'win', 'review', 'country',
    'science', 'party', 'cricket', 'racing', 'accountant', 'loan',
}

SUSPICIOUS_KEYWORDS = {
    'login', 'signin', 'account', 'verify', 'secure', 'update', 'confirm',
    'banking', 'password', 'credential', 'authenticate', 'mobile', 'wallet',
    'payment', 'invoice', 'support', 'customer', 'service', 'alert', 'urgent',
    'limited', 'expired', 'suspended', 'unusual', 'activity', 'security',
}

LEGITIMATE_TLDS = {
    'com', 'org', 'net', 'edu', 'gov', 'io', 'co', 'us', 'uk',
    'ca', 'au', 'de', 'fr', 'jp', 'cn',
}

IP_PATTERN = re.compile(
    r'^((25[0-5]|2[0-4]\d|[01]?\d\d?)\.){3}(25[0-5]|2[0-4]\d|[01]?\d\d?)$'
)
SPECIAL_CHARS_SET = set('!@#$%^&*()_+[]{}|;:\'",<>?/\\`~')


def shannon_entropy(text: str) -> float:
    if not text:
        return 0.0
    counter = {}
    for ch in text:
        counter[ch] = counter.get(ch, 0) + 1
    length = len(text)
    entropy = 0.0
    for count in counter.values():
        p = count / length
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy


def extract_domain_info(url: str) -> dict:
    try:
        parsed = urlparse(url)
        host = parsed.hostname or ''
        host_lower = host.lower()

        if IP_PATTERN.match(host_lower):
            return {'domain': host_lower, 'tld': 'ip', 'subdomain_count': 0, 'has_ip': True, 'main_domain': ''}

        parts = host_lower.split('.')
        tld = parts[-1] if len(parts) >= 1 else ''
        domain = parts[-2] if len(parts) >= 2 else parts[0]
        subdomain_count = max(0, len(parts) - 2)

        return {
            'domain': host_lower,
            'tld': tld,
            'subdomain_count': subdomain_count,
            'has_ip': False,
            'main_domain': domain,
        }
    except Exception:
        return {'domain': '', 'tld': '', 'subdomain_count': 0, 'has_ip': False, 'main_domain': ''}


def count_characters(url: str) -> dict:
    special = 0
    digits = 0
    letters = 0
    uppercase = 0
    for ch in url:
        if ch in SPECIAL_CHARS_SET:
            special += 1
        if ch.isdigit():
            digits += 1
        if ch.isalpha():
            letters += 1
            if ch.isupper():
                uppercase += 1
    return {'special_char_count': special, 'digit_count': digits, 'letter_count': letters, 'uppercase_count': uppercase}


def count_patterns(url: str) -> dict:
    return {
        'slash_count': url.count('/'),
        'hyphen_count': url.count('-'),
        'underline_count': url.count('_'),
        'question_mark_count': url.count('?'),
        'encoded_char_count': url.count('%'),
    }


def detect_suspicious_keywords(url: str) -> List[str]:
    url_lower = url.lower()
    return [kw for kw in SUSPICIOUS_KEYWORDS if kw in url_lower]


def extract_features(url: str) -> Optional[dict]:
    if not url:
        return None
    url = url.strip()

    normalized = url if url.startswith(('http://', 'https://')) else 'https://' + url
    try:
        parsed = urlparse(normalized)
        if not parsed.hostname:
            normalized = url if url.startswith('http://') else 'http://' + url
            parsed = urlparse(normalized)
    except Exception:
        normalized = url if url.startswith('http://') else 'http://' + url
        try:
            parsed = urlparse(normalized)
        except Exception:
            return None

    domain_info = extract_domain_info(normalized)
    char_counts = count_characters(url)
    pats = count_patterns(url)
    found_keywords = detect_suspicious_keywords(url)

    has_port = bool(re.search(r':\d+', parsed.hostname or ''))
    entropy = shannon_entropy(parsed.hostname or '')
    path_depth = len([p for p in (parsed.path or '').split('/') if p])
    is_suspicious_tld = domain_info['tld'] in SUSPICIOUS_TLDS
    is_legitimate_tld = domain_info['tld'] in LEGITIMATE_TLDS

    return {
        'url_length': len(url),
        'domain_length': len(parsed.hostname or ''),
        'path_length': len(parsed.path or ''),
        'query_length': len(parsed.query or ''),
        'subdomain_count': domain_info['subdomain_count'],
        **char_counts,
        'has_https': 1 if (parsed.scheme or '') == 'https' else 0,
        'tld': domain_info['tld'],
        'has_ip': 1 if domain_info['has_ip'] else 0,
        'has_port': 1 if has_port else 0,
        'path_depth': path_depth,
        **pats,
        'at_symbol': 1 if (parsed.username or '') else 0,
        'double_slash': 1 if '//' in (parsed.path or '') else 0,
        'suspicious_keyword_count': len(found_keywords),
        'entropy': round(entropy, 4),
        'is_suspicious_tld': 1 if is_suspicious_tld else 0,
        'is_legitimate_tld': 1 if is_legitimate_tld else 0,
        'url_long': 1 if len(url) > 75 else 0,
        'domain_long': 1 if len(parsed.hostname or '') > 20 else 0,
        'path_long': 1 if len(parsed.path or '') > 50 else 0,
        'many_subdomains': 1 if domain_info['subdomain_count'] > 2 else 0,
        'many_special_chars': 1 if char_counts['special_char_count'] > 3 else 0,
        'many_digits': 1 if char_counts['digit_count'] > 5 else 0,
        'high_entropy': 1 if entropy > 4.0 else 0,
    }


FEATURE_NAMES = [
    'url_length', 'domain_length', 'path_length', 'query_length',
    'subdomain_count', 'special_char_count', 'digit_count', 'letter_count',
    'uppercase_count', 'has_https', 'has_ip', 'has_port', 'path_depth',
    'slash_count', 'hyphen_count', 'underline_count', 'question_mark_count',
    'encoded_char_count', 'at_symbol', 'double_slash',
    'suspicious_keyword_count', 'entropy', 'is_suspicious_tld',
    'is_legitimate_tld', 'url_long', 'domain_long', 'path_long',
    'many_subdomains', 'many_special_chars', 'many_digits', 'high_entropy',
]

NUM_FEATURES = len(FEATURE_NAMES)


def feature_vector(url: str) -> np.ndarray:
    features = extract_features(url)
    if features is None:
        return np.zeros(NUM_FEATURES, dtype=np.float32)
    return np.array([features[name] for name in FEATURE_NAMES], dtype=np.float32)


def feature_matrix(urls: List[str]) -> np.ndarray:
    return np.array([feature_vector(u) for u in urls], dtype=np.float32)
