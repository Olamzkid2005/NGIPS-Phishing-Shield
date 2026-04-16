"""
NGIPS Phishing Shield - Advanced Model Training with Modern ML/DL Methods
Includes: XGBoost, LightGBM, CatBoost, Deep Learning, and Transformer models
"""

import pandas as pd
import numpy as np
import pickle
import json
import requests
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
import re
from typing import Dict, List, Tuple, Optional
import warnings
warnings.filterwarnings('ignore')

# ML imports
from sklearn.model_selection import train_test_split, cross_val_score, StratifiedKFold
from sklearn.preprocessing import StandardScaler, LabelEncoder
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier, VotingClassifier, StackingClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score, roc_curve
)

# Advanced ML libraries
try:
    import xgboost as xgb
    HAS_XGBOOST = True
except ImportError:
    HAS_XGBOOST = False
    print("Warning: XGBoost not installed. Install with: pip install xgboost")

try:
    import lightgbm as lgb
    HAS_LIGHTGBM = True
except ImportError:
    HAS_LIGHTGBM = False
    print("Warning: LightGBM not installed. Install with: pip install lightgbm")

try:
    import catboost as cb
    HAS_CATBOOST = True
except ImportError:
    HAS_CATBOOST = False
    print("Warning: CatBoost not installed. Install with: pip install catboost")

# Deep Learning imports
try:
    import torch
    import torch.nn as nn
    import torch.optim as optim
    from torch.utils.data import Dataset, DataLoader
    HAS_PYTORCH = True
except ImportError:
    HAS_PYTORCH = False
    print("Warning: PyTorch not installed. Install with: pip install torch")

# Visualization
try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    HAS_PLOTTING = True
except ImportError:
    HAS_PLOTTING = False
    print("Warning: matplotlib/seaborn not installed. Skipping visualizations.")


class URLFeatureExtractor:
    """
    Advanced feature extraction from URLs
    """
    
    @staticmethod
    def extract_features(url: str) -> Dict[str, float]:
        """
        Extract comprehensive features from URL
        """
        features = {}
        
        try:
            # Store original URL for analysis
            original_url = url
            
            # Handle Unicode and special characters in URLs
            try:
                # First, try to handle internationalized domain names (IDN)
                import unicodedata
                
                # Parse URL first to separate components
                parsed = urlparse(url)
                domain = parsed.netloc
                
                # Handle Unicode domains using IDN encoding
                if domain:
                    try:
                        # Try to encode Unicode domain to ASCII (Punycode)
                        ascii_domain = domain.encode('idna').decode('ascii')
                        # Reconstruct URL with ASCII domain
                        url = url.replace(domain, ascii_domain)
                    except (UnicodeError, UnicodeDecodeError, UnicodeEncodeError):
                        # If IDN encoding fails, normalize and filter Unicode
                        try:
                            normalized_domain = unicodedata.normalize('NFKD', domain)
                            # Keep only ASCII characters and common symbols
                            ascii_domain = ''.join(c for c in normalized_domain if ord(c) < 128)
                            url = url.replace(domain, ascii_domain)
                        except Exception:
                            # Last resort: remove all non-ASCII characters
                            ascii_domain = ''.join(c for c in domain if ord(c) < 128)
                            url = url.replace(domain, ascii_domain)
                
            except Exception:
                # If all Unicode handling fails, continue with original URL
                pass
            
            # Parse URL with better error handling
            parsed = None
            domain = ""
            path = ""
            query = ""
            
            try:
                parsed = urlparse(url)
                domain = parsed.netloc
                path = parsed.path
                query = parsed.query
            except Exception:
                # If URL parsing fails completely, use basic string analysis
                try:
                    url_parts = url.split('/')
                    if len(url_parts) > 2:
                        domain = url_parts[2]
                        path = '/'.join(url_parts[3:]) if len(url_parts) > 3 else ''
                    else:
                        domain = url
                        path = ''
                    query = url.split('?')[1] if '?' in url else ''
                except Exception:
                    # Ultimate fallback
                    domain = url[:50]  # Use first 50 chars as domain
                    path = ''
                    query = ''
            
            # === Basic URL Features ===
            features['url_length'] = len(url)
            features['domain_length'] = len(domain)
            features['path_length'] = len(path)
            features['query_length'] = len(query)
            
            # === Character Counts ===
            features['num_dots'] = url.count('.')
            features['num_hyphens'] = url.count('-')
            features['num_underscores'] = url.count('_')
            features['num_slashes'] = url.count('/')
            features['num_question_marks'] = url.count('?')
            features['num_equals'] = url.count('=')
            features['num_at'] = url.count('@')
            features['num_ampersand'] = url.count('&')
            features['num_percent'] = url.count('%')
            features['num_tilde'] = url.count('~')
            features['num_semicolon'] = url.count(';')
            features['num_hash'] = url.count('#')
            
            # === Digit Features ===
            features['num_digits'] = sum(c.isdigit() for c in url)
            features['digit_ratio'] = features['num_digits'] / max(len(url), 1)
            features['num_digits_domain'] = sum(c.isdigit() for c in domain)
            features['num_digits_path'] = sum(c.isdigit() for c in path)
            
            # === Letter Features ===
            features['num_letters'] = sum(c.isalpha() for c in url)
            features['letter_ratio'] = features['num_letters'] / max(len(url), 1)
            
            # === Subdomain Features ===
            features['subdomain_count'] = domain.count('.') - 1 if domain.count('.') > 0 else 0
            features['has_multiple_subdomains'] = 1.0 if features['subdomain_count'] > 2 else 0.0
            
            # === IP Address Detection ===
            features['has_ip'] = 1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0
            features['has_hex_ip'] = 1.0 if re.search(r'0x[0-9a-fA-F]+', domain) else 0.0
            
            # === Suspicious Keywords ===
            suspicious_keywords = [
                'login', 'signin', 'account', 'update', 'verify', 'secure',
                'banking', 'paypal', 'ebay', 'amazon', 'confirm', 'password',
                'suspend', 'restrict', 'hold', 'unusual', 'click', 'here',
                'urgent', 'immediately', 'expire', 'limited'
            ]
            url_lower = url.lower()
            features['suspicious_keyword_count'] = sum(
                1 for keyword in suspicious_keywords if keyword in url_lower
            )
            features['has_login'] = 1.0 if 'login' in url_lower else 0.0
            features['has_secure'] = 1.0 if 'secure' in url_lower else 0.0
            
            # === Protocol Features ===
            if parsed:
                features['is_https'] = 1.0 if parsed.scheme == 'https' else 0.0
                features['is_http'] = 1.0 if parsed.scheme == 'http' else 0.0
            else:
                features['is_https'] = 1.0 if url.startswith('https://') else 0.0
                features['is_http'] = 1.0 if url.startswith('http://') else 0.0
            
            # === Entropy (Randomness) ===
            features['url_entropy'] = URLFeatureExtractor._calculate_entropy(url)
            features['domain_entropy'] = URLFeatureExtractor._calculate_entropy(domain)
            features['path_entropy'] = URLFeatureExtractor._calculate_entropy(path)
            
            # === URL Shortener Detection ===
            shorteners = ['bit.ly', 'goo.gl', 'tinyurl', 't.co', 'ow.ly', 'is.gd', 'buff.ly']
            features['is_shortened'] = 1.0 if any(s in domain for s in shorteners) else 0.0
            
            # === Path Features ===
            features['path_depth'] = path.count('/') if path else 0
            features['has_double_slash'] = 1.0 if '//' in path else 0.0
            features['has_redirect'] = 1.0 if any(x in url_lower for x in ['redirect', 'redir', 'goto']) else 0.0
            
            # === TLD Features ===
            tld = domain.split('.')[-1] if '.' in domain else ''
            suspicious_tlds = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top', 'work', 'click']
            features['suspicious_tld'] = 1.0 if tld in suspicious_tlds else 0.0
            features['tld_length'] = len(tld)
            
            # === Special Character Ratios ===
            special_chars = features['num_dots'] + features['num_hyphens'] + features['num_underscores']
            features['special_char_ratio'] = special_chars / max(len(url), 1)
            
            # === Domain Token Features ===
            domain_tokens = domain.split('.')
            features['num_domain_tokens'] = len(domain_tokens)
            features['longest_domain_token'] = max([len(t) for t in domain_tokens]) if domain_tokens else 0
            features['avg_domain_token_length'] = np.mean([len(t) for t in domain_tokens]) if domain_tokens else 0
            
            # === Path Token Features ===
            path_tokens = [t for t in path.split('/') if t]
            features['num_path_tokens'] = len(path_tokens)
            features['longest_path_token'] = max([len(t) for t in path_tokens]) if path_tokens else 0
            
            # === Query Parameter Features ===
            query_params = query.split('&') if query else []
            features['num_query_params'] = len(query_params)
            
            # === Vowel/Consonant Ratio ===
            vowels = sum(1 for c in url_lower if c in 'aeiou')
            consonants = sum(1 for c in url_lower if c.isalpha() and c not in 'aeiou')
            features['vowel_ratio'] = vowels / max(len(url), 1)
            features['consonant_ratio'] = consonants / max(len(url), 1)
            
            # === Consecutive Character Features ===
            features['max_consecutive_digits'] = URLFeatureExtractor._max_consecutive(url, str.isdigit)
            features['max_consecutive_letters'] = URLFeatureExtractor._max_consecutive(url, str.isalpha)
            features['max_consecutive_special'] = URLFeatureExtractor._max_consecutive(url, lambda c: not c.isalnum())
            
            # === Brand Impersonation Detection ===
            brands = ['paypal', 'amazon', 'google', 'microsoft', 'apple', 'facebook', 'netflix', 'ebay']
            features['brand_in_subdomain'] = 1.0 if any(brand in domain.lower() for brand in brands) and features['subdomain_count'] > 0 else 0.0
            
            # === Unicode and Internationalization Features ===
            # Detect Unicode characters in original URL (sophisticated phishing technique)
            features['has_unicode'] = 1.0 if any(ord(c) > 127 for c in original_url) else 0.0
            features['unicode_char_count'] = sum(1 for c in original_url if ord(c) > 127)
            features['unicode_ratio'] = features['unicode_char_count'] / max(len(original_url), 1)
            
            # Detect homograph attacks (Unicode characters that look like ASCII)
            homograph_chars = ['а', 'е', 'о', 'р', 'с', 'х', 'у', 'А', 'В', 'Е', 'К', 'М', 'Н', 'О', 'Р', 'С', 'Т', 'Х']  # Cyrillic
            features['has_homograph'] = 1.0 if any(c in original_url for c in homograph_chars) else 0.0
            
            # Detect mathematical Unicode (often used in sophisticated phishing)
            math_unicode_ranges = [
                (0x1D400, 0x1D7FF),  # Mathematical symbols
                (0x2100, 0x214F),    # Letterlike symbols
                (0x1D00, 0x1D7F),    # Phonetic extensions
            ]
            features['has_math_unicode'] = 1.0 if any(
                any(start <= ord(c) <= end for start, end in math_unicode_ranges) 
                for c in original_url
            ) else 0.0
            
            # Detect mixed scripts (suspicious)
            scripts = set()
            for c in original_url:
                if c.isalpha():
                    try:
                        import unicodedata
                        script = unicodedata.name(c, '').split()[0] if unicodedata.name(c, '') else 'UNKNOWN'
                        scripts.add(script)
                    except:
                        pass
            features['mixed_scripts'] = 1.0 if len(scripts) > 2 else 0.0
            
        except Exception as e:
            # Log error but continue processing
            error_msg = str(e)[:100]  # Truncate long error messages
            print(f"Error extracting features from URL: {original_url[:50]}... - {error_msg}")
            
            # Return basic features based on string analysis to avoid stopping the process
            try:
                # Basic string-based features that don't require parsing
                basic_features = {
                    'url_length': len(original_url),
                    'num_dots': original_url.count('.'),
                    'num_hyphens': original_url.count('-'),
                    'num_slashes': original_url.count('/'),
                    'num_digits': sum(c.isdigit() for c in original_url),
                    'digit_ratio': sum(c.isdigit() for c in original_url) / max(len(original_url), 1),
                    'has_unicode': 1.0 if any(ord(c) > 127 for c in original_url) else 0.0,
                    'unicode_char_count': sum(1 for c in original_url if ord(c) > 127),
                    'is_https': 1.0 if original_url.startswith('https://') else 0.0,
                    'suspicious_keyword_count': sum(1 for kw in ['login', 'secure', 'verify', 'account'] if kw in original_url.lower()),
                }
                
                # Fill remaining features with zeros
                all_feature_names = [
                    'domain_length', 'path_length', 'query_length', 'num_underscores', 'num_question_marks',
                    'num_equals', 'num_at', 'num_ampersand', 'num_percent', 'num_tilde', 'num_semicolon',
                    'num_hash', 'num_digits_domain', 'num_digits_path', 'num_letters', 'letter_ratio',
                    'subdomain_count', 'has_multiple_subdomains', 'has_ip', 'has_hex_ip', 'has_login',
                    'has_secure', 'is_http', 'url_entropy', 'domain_entropy', 'path_entropy', 'is_shortened',
                    'path_depth', 'has_double_slash', 'has_redirect', 'suspicious_tld', 'tld_length',
                    'special_char_ratio', 'num_domain_tokens', 'longest_domain_token', 'avg_domain_token_length',
                    'num_path_tokens', 'longest_path_token', 'num_query_params', 'vowel_ratio', 'consonant_ratio',
                    'max_consecutive_digits', 'max_consecutive_letters', 'max_consecutive_special',
                    'brand_in_subdomain', 'unicode_ratio', 'has_homograph', 'has_math_unicode', 'mixed_scripts'
                ]
                
                for feature_name in all_feature_names:
                    if feature_name not in basic_features:
                        basic_features[feature_name] = 0.0
                
                return basic_features
                
            except Exception as e2:
                # Ultimate fallback - return all zeros
                print(f"Critical error in fallback feature extraction: {e2}")
                return {f'feature_{i}': 0.0 for i in range(50)}
        
        return features
    
    @staticmethod
    def _calculate_entropy(text: str) -> float:
        """Calculate Shannon entropy"""
        if not text:
            return 0.0
        
        freq = {}
        for char in text:
            freq[char] = freq.get(char, 0) + 1
        
        entropy = 0.0
        text_len = len(text)
        for count in freq.values():
            p = count / text_len
            entropy -= p * np.log2(p)
        
        return entropy
    
    @staticmethod
    def _max_consecutive(text: str, condition) -> int:
        """Find maximum consecutive characters matching condition"""
        max_count = 0
        current_count = 0
        
        for char in text:
            if condition(char):
                current_count += 1
                max_count = max(max_count, current_count)
            else:
                current_count = 0
        
        return max_count


class OnlineDatasetLoader:
    """
    Load latest phishing datasets from multiple online sources
    """
    
    @staticmethod
    def download_phishtank_data() -> Optional[pd.DataFrame]:
        """
        Download latest PhishTank data
        PhishTank now requires API key for JSON, but CSV is still available
        """
        print("\n[1/7] Downloading PhishTank data...")
        
        # Try the free CSV endpoint (no API key required)
        urls_to_try = [
            "http://data.phishtank.com/data/online-valid.csv",
            "https://data.phishtank.com/data/online-valid.csv"
        ]
        
        for url in urls_to_try:
            try:
                print(f"  Trying: {url}")
                response = requests.get(url, timeout=30)
                response.raise_for_status()
                
                # Parse CSV
                from io import StringIO
                df = pd.read_csv(StringIO(response.text))
                
                # Extract URLs (column name is 'url')
                if 'url' in df.columns:
                    urls = df['url'].dropna().tolist()
                    df_result = pd.DataFrame({'URL': urls, 'Label': 1})  # 1 = phishing
                    
                    print(f"  ✓ Downloaded {len(df_result)} phishing URLs from PhishTank")
                    return df_result
                else:
                    print(f"  ✗ No 'url' column found in PhishTank data")
                    continue
                
            except Exception as e:
                print(f"  ✗ Failed to download from {url}: {e}")
                continue
        
        # If all URLs fail, raise exception
        error_msg = "All PhishTank URLs failed"
        print(f"  ✗ {error_msg}")
        raise Exception(error_msg)
    
    @staticmethod
    def download_openphish_data() -> Optional[pd.DataFrame]:
        """
        Download OpenPhish feed
        """
        print("\n[2/7] Downloading OpenPhish data...")
        
        url = "https://openphish.com/feed.txt"
        
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            urls = response.text.strip().split('\n')
            urls = [url.strip() for url in urls if url.strip()]  # Remove empty lines
            
            if not urls:
                error_msg = "No URLs found in OpenPhish feed"
                print(f"  ✗ {error_msg}")
                raise ValueError(error_msg)
            
            df = pd.DataFrame({'URL': urls, 'Label': 1})  # 1 = phishing
            
            print(f"  ✓ Downloaded {len(df)} phishing URLs from OpenPhish")
            return df
            
        except Exception as e:
            error_msg = f"Error downloading OpenPhish data: {e}"
            print(f"  ✗ {error_msg}")
            raise Exception(error_msg)
    
    @staticmethod
    def download_urlhaus_data() -> Optional[pd.DataFrame]:
        """
        Download URLhaus malicious URLs
        """
        print("\n[3/7] Downloading URLhaus data...")
        
        url = "https://urlhaus.abuse.ch/downloads/csv_recent/"
        
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Parse CSV (skip comment lines starting with #)
            lines = [line for line in response.text.split('\n') if line and not line.startswith('#')]
            
            if len(lines) <= 1:
                error_msg = "No data found in URLhaus feed"
                print(f"  ✗ {error_msg}")
                raise ValueError(error_msg)
            
            # URLhaus CSV format: id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter
            # But the actual CSV doesn't have headers, so we need to manually assign column names
            from io import StringIO
            
            # Create proper header
            header = "id,dateadded,url,url_status,last_online,threat,tags,urlhaus_link,reporter"
            csv_content = header + "\n" + "\n".join(lines)
            
            df = pd.read_csv(StringIO(csv_content), quotechar='"')
            
            # Extract URLs from the 'url' column (3rd column)
            if 'url' not in df.columns:
                error_msg = f"No 'url' column found in URLhaus data. Available columns: {list(df.columns)}"
                print(f"  ✗ {error_msg}")
                raise ValueError(error_msg)
            
            urls = df['url'].dropna().tolist()
            
            if not urls:
                error_msg = "No URLs found in URLhaus data"
                print(f"  ✗ {error_msg}")
                raise ValueError(error_msg)
            
            df_result = pd.DataFrame({'URL': urls, 'Label': 1})  # 1 = malicious
            
            print(f"  ✓ Downloaded {len(df_result)} malicious URLs from URLhaus")
            return df_result
            
        except Exception as e:
            error_msg = f"Error downloading URLhaus data: {e}"
            print(f"  ✗ {error_msg}")
            raise Exception(error_msg)
    
    @staticmethod
    def download_phishing_army_data() -> Optional[pd.DataFrame]:
        """
        Download Phishing Army blocklist
        """
        print("\n[4/7] Downloading Phishing Army data...")
        
        url = "https://phishing.army/download/phishing_army_blocklist_extended.txt"
        
        try:
            response = requests.get(url, timeout=30)
            response.raise_for_status()
            
            # Parse text file (one URL per line, skip comments)
            lines = response.text.strip().split('\n')
            urls = [line.strip() for line in lines if line.strip() and not line.startswith('#')]
            
            if not urls:
                error_msg = "No URLs found in Phishing Army data"
                print(f"  ✗ {error_msg}")
                raise ValueError(error_msg)
            
            df = pd.DataFrame({'URL': urls, 'Label': 1})  # 1 = phishing
            print(f"  ✓ Downloaded {len(df)} phishing URLs from Phishing Army")
            return df
            
        except Exception as e:
            error_msg = f"Error downloading Phishing Army data: {e}"
            print(f"  ✗ {error_msg}")
            raise Exception(error_msg)
    
    @staticmethod
    def download_malware_bazaar_data() -> Optional[pd.DataFrame]:
        """
        Skip MalwareBazaar - only provides file hashes, not URLs
        """
        print("\n[5/7] Skipping MalwareBazaar data...")
        print("  ℹ MalwareBazaar only provides file hashes, not URLs")
        print("  ℹ This source is not suitable for URL-based phishing detection")
        
        # Return None to indicate this source should be skipped
        error_msg = "MalwareBazaar does not provide URLs (only file hashes)"
        print(f"  ✗ {error_msg}")
        raise ValueError(error_msg)
    
    @staticmethod
    def download_cybercrime_tracker_data() -> Optional[pd.DataFrame]:
        """
        Download CyberCrime Tracker URLs with better error handling
        """
        print("\n[6/7] Downloading CyberCrime Tracker data...")
        
        url = "https://cybercrime-tracker.net/all.php"
        
        try:
            # Add headers to avoid blocking
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            
            response = requests.get(url, timeout=60, headers=headers)  # Increased timeout
            response.raise_for_status()
            
            # Parse plain text response - each line is a URL path/domain
            lines = response.text.strip().split('\n')
            urls = []
            
            for line in lines[:1000]:  # Limit to first 1000 lines to avoid processing issues
                line = line.strip()
                if not line or len(line) < 10:  # Skip very short lines
                    continue
                
                # Skip obvious non-URLs
                if any(x in line.lower() for x in ['<html>', '<body>', 'script', 'style', 'DOCTYPE']):
                    continue
                
                # Add protocol if missing
                if line.startswith(('http://', 'https://')):
                    url_candidate = line
                elif '/' in line and '.' in line:
                    # Looks like a domain/path, try both http and https
                    url_candidate = f"http://{line}"
                else:
                    continue
                
                # Basic validation
                if '.' in url_candidate and len(url_candidate) > 10:
                    # Filter out obvious non-malicious domains
                    excluded_domains = [
                        'cybercrime-tracker.net', 'google.com', 'facebook.com', 'twitter.com',
                        'youtube.com', 'linkedin.com', 'github.com', 'stackoverflow.com',
                        'microsoft.com', 'apple.com', 'mozilla.org', 'w3.org'
                    ]
                    
                    if not any(domain in url_candidate.lower() for domain in excluded_domains):
                        urls.append(url_candidate)
            
            if not urls:
                error_msg = "No valid URLs found in CyberCrime Tracker data"
                print(f"  ✗ {error_msg}")
                raise ValueError(error_msg)
            
            # Remove duplicates
            urls = list(set(urls))
            
            df = pd.DataFrame({'URL': urls, 'Label': 1})  # 1 = malicious
            print(f"  ✓ Downloaded {len(df)} malicious URLs from CyberCrime Tracker")
            return df
            
        except requests.exceptions.Timeout:
            error_msg = "CyberCrime Tracker request timed out"
            print(f"  ✗ {error_msg}")
            raise Exception(error_msg)
        except requests.exceptions.ConnectionError:
            error_msg = "Could not connect to CyberCrime Tracker"
            print(f"  ✗ {error_msg}")
            raise Exception(error_msg)
        except Exception as e:
            error_msg = f"Error downloading CyberCrime Tracker data: {e}"
            print(f"  ✗ {error_msg}")
            raise Exception(error_msg)
    
    @staticmethod
    def load_local_dataset(csv_path: str) -> Optional[pd.DataFrame]:
        """
        Load local CSV dataset
        """
        print(f"\n[6/7] Loading local dataset: {csv_path}")
        
        try:
            if not Path(csv_path).exists():
                print(f"  ✗ Local dataset not found: {csv_path}")
                return None
            
            df = pd.read_csv(csv_path)
            
            # Handle different column naming - look for URL and Label columns
            url_col = None
            label_col = None
            
            # Find URL column (case insensitive)
            for col in df.columns:
                if 'url' in str(col).lower():
                    url_col = col
                    break
            
            # Find Label column (case insensitive)  
            for col in df.columns:
                col_lower = str(col).lower()
                if any(x in col_lower for x in ['label', 'class', 'type']):
                    label_col = col
                    break
            
            if url_col is None or label_col is None:
                print(f"  ✗ Required columns not found. Available: {list(df.columns)}")
                return None
            
            # Rename to standard format if needed
            if url_col != 'URL':
                df = df.rename(columns={url_col: 'URL'})
            if label_col != 'Label':
                df = df.rename(columns={label_col: 'Label'})
                
            df = df.dropna(subset=['URL', 'Label'])
            
            # Standardize labels - handle various formats
            label_mapping = {
                'bad': 1, 'good': 0, 'phishing': 1, 'legitimate': 0, 'legit': 0,
                'malicious': 1, 'benign': 0, 1: 1, 0: 0, '1': 1, '0': 0
            }
            
            df['Label'] = df['Label'].map(label_mapping)
            df = df[df['Label'].isin([0, 1])]
            
            print(f"  ✓ Loaded {len(df)} URLs from local dataset")
            print(f"    Phishing: {(df['Label'] == 1).sum()}")
            print(f"    Legitimate: {(df['Label'] == 0).sum()}")
            
            return df
            
        except Exception as e:
            print(f"  ✗ Error loading local dataset: {e}")
            return None
    
    @staticmethod
    def generate_legitimate_urls() -> pd.DataFrame:
        """
        Generate legitimate URLs from top websites
        """
        print("\n[7/7] Generating legitimate URLs from top websites...")
        
        # Top legitimate domains (Alexa/Tranco top sites)
        legitimate_domains = [
            'google.com', 'youtube.com', 'facebook.com', 'twitter.com', 'instagram.com',
            'linkedin.com', 'reddit.com', 'wikipedia.org', 'amazon.com', 'ebay.com',
            'netflix.com', 'microsoft.com', 'apple.com', 'github.com', 'stackoverflow.com',
            'medium.com', 'wordpress.com', 'blogger.com', 'tumblr.com', 'pinterest.com',
            'yahoo.com', 'bing.com', 'duckduckgo.com', 'baidu.com', 'yandex.com',
            'cnn.com', 'bbc.com', 'nytimes.com', 'theguardian.com', 'reuters.com',
            'espn.com', 'imdb.com', 'spotify.com', 'twitch.tv', 'vimeo.com',
            'dropbox.com', 'adobe.com', 'salesforce.com', 'oracle.com', 'ibm.com',
            'paypal.com', 'stripe.com', 'shopify.com', 'etsy.com', 'aliexpress.com',
            'booking.com', 'airbnb.com', 'tripadvisor.com', 'expedia.com', 'hotels.com'
        ]
        
        # Generate variations of legitimate URLs
        legitimate_urls = []
        
        for domain in legitimate_domains:
            # Main domain
            legitimate_urls.append(f'https://{domain}')
            legitimate_urls.append(f'https://www.{domain}')
            
            # Common paths
            legitimate_urls.append(f'https://{domain}/about')
            legitimate_urls.append(f'https://{domain}/contact')
            legitimate_urls.append(f'https://{domain}/help')
            legitimate_urls.append(f'https://{domain}/search')
            legitimate_urls.append(f'https://{domain}/blog')
            
            # With query parameters
            legitimate_urls.append(f'https://{domain}/search?q=test')
            legitimate_urls.append(f'https://{domain}/page?id=123')
        
        df = pd.DataFrame({'URL': legitimate_urls, 'Label': 0})  # 0 = legitimate
        
        print(f"  ✓ Generated {len(df)} legitimate URLs")
        return df


class AdvancedPhishingModelTrainer:
    """
    Train advanced ML/DL models for phishing detection
    """
    
    def __init__(self, output_dir: str = "./models"):
        """
        Initialize trainer
        """
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(exist_ok=True)
        
        self.df = None
        self.X_train = None
        self.X_test = None
        self.y_train = None
        self.y_test = None
        self.feature_names = None
        self.scaler = None
        
        self.models = {}
        self.results = {}
    
    def load_datasets(self):
        """
        Load and combine multiple online datasets + local dataset
        Allows some sources to fail while continuing with successful ones
        """
        print("=" * 70)
        print("Loading Latest Datasets from Online Sources + Local Data")
        print("=" * 70)
        
        loader = OnlineDatasetLoader()
        dfs = []
        successful_sources = []
        failed_sources = []
        
        # Try each online source - continue if some fail
        online_sources = [
            ("PhishTank", loader.download_phishtank_data),
            ("OpenPhish", loader.download_openphish_data),
            ("URLhaus", loader.download_urlhaus_data),
            ("Phishing Army", loader.download_phishing_army_data),
            ("MalwareBazaar", loader.download_malware_bazaar_data),
            ("CyberCrime Tracker", loader.download_cybercrime_tracker_data),
        ]
        
        for source_name, download_func in online_sources:
            try:
                print(f"Attempting to download {source_name} data...")
                df = download_func()
                if df is not None and len(df) > 0:
                    dfs.append(df)
                    successful_sources.append(source_name)
                    print(f"  ✓ Successfully loaded {source_name}: {len(df)} URLs")
                else:
                    failed_sources.append(f"{source_name} (no data returned)")
                    print(f"  ⚠ {source_name}: No data returned")
            except KeyboardInterrupt:
                print(f"\n❌ Training interrupted by user")
                raise SystemExit(1)
            except Exception as e:
                error_msg = str(e)[:100]  # Truncate long error messages
                print(f"  ⚠ {source_name} failed: {error_msg}")
                failed_sources.append(f"{source_name} ({error_msg})")
                # Continue with other sources - don't stop the entire process
        
        # Load local dataset (alongside online sources for robustness)
        # Local datasets are optional - don't stop if they fail
        local_dataset_paths = [
            "../Dataset/phishing_site_urls.csv",
            "../Dataset/verified_online.csv",
            "../Dataset/phishing_site_urls Combined.csv"
        ]
        
        for csv_path in local_dataset_paths:
            try:
                df_local = loader.load_local_dataset(csv_path)
                if df_local is not None and len(df_local) > 0:
                    dfs.append(df_local)
                    successful_sources.append(f"Local: {csv_path}")
                    print(f"  ✓ Successfully loaded local dataset: {csv_path}")
                else:
                    failed_sources.append(f"Local: {csv_path} (no data)")
                    print(f"  ⚠ Local dataset {csv_path}: No data returned")
            except KeyboardInterrupt:
                print(f"\n❌ Training interrupted by user")
                raise SystemExit(1)
            except Exception as e:
                error_msg = str(e)[:100]
                print(f"  ⚠ Warning: Could not load local dataset {csv_path}: {error_msg}")
                failed_sources.append(f"Local: {csv_path} ({error_msg})")
                # Continue with other datasets - don't stop
        
        # Generate legitimate URLs (REQUIRED - stop if fails)
        try:
            df_legitimate = loader.generate_legitimate_urls()
            if df_legitimate is not None and len(df_legitimate) > 0:
                dfs.append(df_legitimate)
                successful_sources.append("Generated Legitimate URLs")
                print(f"  ✓ Successfully generated legitimate URLs: {len(df_legitimate)} URLs")
            else:
                print(f"\n❌ CRITICAL ERROR: No legitimate URLs generated")
                raise SystemExit(1)
        except KeyboardInterrupt:
            print(f"\n❌ Training interrupted by user")
            raise SystemExit(1)
        except Exception as e:
            print(f"\n❌ CRITICAL ERROR generating legitimate URLs: {e}")
            raise SystemExit(1)
        
        # Check if we have enough data
        phishing_dfs = [df for df in dfs if len(df[df['Label'] == 1]) > 0]
        if len(phishing_dfs) == 0:
            print(f"\n❌ CRITICAL ERROR: No phishing datasets loaded!")
            print(f"❌ Failed sources: {failed_sources}")
            print(f"❌ Cannot train model without phishing data.")
            raise SystemExit(1)
        
        print(f"\n✅ Successfully loaded {len(successful_sources)} data sources:")
        for source in successful_sources:
            print(f"  ✓ {source}")
        
        if failed_sources:
            print(f"\n⚠ Failed to load {len(failed_sources)} data sources:")
            for source in failed_sources:
                print(f"  ✗ {source}")
        
        # Combine datasets
        self.df = pd.concat(dfs, ignore_index=True)
        self.df = self.df.drop_duplicates(subset=['URL'])
        
        # Balance dataset if needed
        phishing_count = (self.df['Label'] == 1).sum()
        legitimate_count = (self.df['Label'] == 0).sum()
        
        print(f"\n" + "=" * 70)
        print("Dataset Summary")
        print("=" * 70)
        print(f"Total unique URLs: {len(self.df)}")
        print(f"  Phishing/Malicious: {phishing_count}")
        print(f"  Legitimate: {legitimate_count}")
        
        if phishing_count > 0 and legitimate_count > 0:
            print(f"  Ratio: {phishing_count/legitimate_count:.2f}:1")
        
        # If imbalanced, balance by undersampling majority class
        if phishing_count > legitimate_count * 2:
            print(f"\n⚠ Dataset imbalanced. Balancing by undersampling...")
            df_phishing = self.df[self.df['Label'] == 1].sample(n=legitimate_count * 2, random_state=42)
            df_legitimate = self.df[self.df['Label'] == 0]
            self.df = pd.concat([df_phishing, df_legitimate], ignore_index=True)
            print(f"  Balanced dataset: {len(self.df)} URLs")
        elif legitimate_count > phishing_count * 2:
            print(f"\n⚠ Dataset imbalanced. Balancing by undersampling...")
            df_phishing = self.df[self.df['Label'] == 1]
            df_legitimate = self.df[self.df['Label'] == 0].sample(n=phishing_count * 2, random_state=42)
            self.df = pd.concat([df_phishing, df_legitimate], ignore_index=True)
            print(f"  Balanced dataset: {len(self.df)} URLs")
    
    def extract_features(self):
        """
        Extract features from URLs with improved error handling
        """
        print("\n" + "=" * 60)
        print("Extracting Features")
        print("=" * 60)
        
        extractor = URLFeatureExtractor()
        
        features_list = []
        error_count = 0
        total_urls = len(self.df)
        
        for idx, url in enumerate(self.df['URL']):
            if idx % 10000 == 0:
                print(f"Processed {idx}/{total_urls} URLs...")
                if error_count > 0:
                    print(f"  Errors encountered: {error_count} ({error_count/max(idx, 1)*100:.1f}%)")
            
            try:
                features = extractor.extract_features(url)
                features_list.append(features)
            except Exception as e:
                error_count += 1
                print(f"Failed to extract features for URL {idx}: {str(e)[:100]}")
                # Add default features for failed URLs
                default_features = {f'feature_{i}': 0.0 for i in range(50)}
                features_list.append(default_features)
                
                # If too many errors, stop processing
                if error_count > total_urls * 0.1:  # More than 10% errors
                    print(f"\n❌ Too many errors ({error_count}/{idx+1}). Stopping feature extraction.")
                    print("❌ This indicates a fundamental issue with the dataset or feature extraction.")
                    raise SystemExit(1)
        
        print(f"\nCompleted feature extraction:")
        print(f"  Total URLs processed: {total_urls}")
        print(f"  Successful extractions: {total_urls - error_count}")
        print(f"  Failed extractions: {error_count}")
        print(f"  Success rate: {(total_urls - error_count)/total_urls*100:.1f}%")
        
        # Convert to DataFrame
        features_df = pd.DataFrame(features_list)
        self.feature_names = features_df.columns.tolist()
        
        # Handle NaN and infinite values
        features_df = features_df.fillna(0)
        features_df = features_df.replace([np.inf, -np.inf], 0)
        
        print(f"\n✓ Extracted {len(self.feature_names)} features")
        print(f"✓ Cleaned NaN and infinite values")
        
        # Split data
        X = features_df.values
        y = self.df['Label'].values
        
        self.X_train, self.X_test, self.y_train, self.y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Scale features
        self.scaler = StandardScaler()
        self.X_train = self.scaler.fit_transform(self.X_train)
        self.X_test = self.scaler.transform(self.X_test)
        
        print(f"\nFeatures extracted: {len(self.feature_names)} features")
        print(f"Training set: {len(self.X_train)} samples")
        print(f"Test set: {len(self.X_test)} samples")
    
    def train_traditional_models(self):
        """
        Train traditional ML models
        """
        print("\n" + "=" * 60)
        print("Training Traditional ML Models")
        print("=" * 60)
        
        models_to_train = {
            'Logistic Regression': LogisticRegression(
                max_iter=1000,
                random_state=42,
                class_weight='balanced',
                n_jobs=-1
            ),
            'Random Forest': RandomForestClassifier(
                n_estimators=200,
                max_depth=20,
                random_state=42,
                class_weight='balanced',
                n_jobs=-1
            ),
            'Gradient Boosting': GradientBoostingClassifier(
                n_estimators=100,  # Reduced from 200
                max_depth=6,       # Reduced from 10
                random_state=42,
                learning_rate=0.1,
                subsample=0.8,     # Add subsampling for speed
                max_features='sqrt'  # Reduce feature complexity
            )
        }
        
        # Add advanced models if available
        if HAS_XGBOOST:
            models_to_train['XGBoost'] = xgb.XGBClassifier(
                n_estimators=100,  # Reduced from 200
                max_depth=6,       # Reduced from 10
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1,
                eval_metric='logloss',
                subsample=0.8,
                colsample_bytree=0.8
            )
        
        if HAS_LIGHTGBM:
            models_to_train['LightGBM'] = lgb.LGBMClassifier(
                n_estimators=100,  # Reduced from 200
                max_depth=6,       # Reduced from 10
                learning_rate=0.1,
                random_state=42,
                n_jobs=-1,
                verbose=-1,
                subsample=0.8,
                colsample_bytree=0.8
            )
        
        if HAS_CATBOOST:
            models_to_train['CatBoost'] = cb.CatBoostClassifier(
                iterations=100,    # Reduced from 200
                depth=6,          # Reduced from 10
                learning_rate=0.1,
                random_state=42,
                verbose=False
            )
        
        # Train each model
        for name, model in models_to_train.items():
            print(f"\n  Training {name}...")
            start_time = datetime.now()
            
            try:
                model.fit(self.X_train, self.y_train)
                training_time = (datetime.now() - start_time).total_seconds()
                
                # Check if training took too long (more than 30 minutes)
                if training_time > 1800:  # 30 minutes
                    print(f"    ⚠ Warning: {name} took {training_time/60:.1f} minutes to train")
                
                # Evaluate
                metrics = self._evaluate_model(model, name, training_time)
                
                # Store
                self.models[name] = model
                self.results[name] = metrics
                
            except Exception as e:
                print(f"    ✗ Error training {name}: {e}")
                print(f"    Skipping {name} and continuing with other models...")
                continue
    
    def train_ensemble_model(self):
        """
        Train ensemble model combining best performers
        """
        print("\n" + "=" * 60)
        print("Training Ensemble Model")
        print("=" * 60)
        
        if len(self.models) < 2:
            print("  Skipping ensemble (need at least 2 models)")
            return
        
        # Select top 3 models by F1 score
        top_models = sorted(
            self.results.items(),
            key=lambda x: x[1]['f1_score'],
            reverse=True
        )[:3]
        
        print(f"\n  Using top 3 models:")
        for name, metrics in top_models:
            print(f"    - {name} (F1: {metrics['f1_score']:.4f})")
        
        # Create voting ensemble
        estimators = [(name, self.models[name]) for name, _ in top_models]
        
        ensemble = VotingClassifier(
            estimators=estimators,
            voting='soft',
            n_jobs=-1
        )
        
        print("\n  Training ensemble...")
        start_time = datetime.now()
        
        ensemble.fit(self.X_train, self.y_train)
        
        training_time = (datetime.now() - start_time).total_seconds()
        
        # Evaluate
        metrics = self._evaluate_model(ensemble, 'Ensemble (Voting)', training_time)
        
        # Store
        self.models['Ensemble'] = ensemble
        self.results['Ensemble'] = metrics
    
    def _evaluate_model(self, model, name: str, training_time: float) -> Dict:
        """
        Evaluate model and return metrics
        """
        y_pred = model.predict(self.X_test)
        y_pred_proba = model.predict_proba(self.X_test)[:, 1]
        
        # Calculate metrics
        metrics = {
            'accuracy': accuracy_score(self.y_test, y_pred),
            'precision': precision_score(self.y_test, y_pred),
            'recall': recall_score(self.y_test, y_pred),
            'f1_score': f1_score(self.y_test, y_pred),
            'roc_auc': roc_auc_score(self.y_test, y_pred_proba),
            'training_time': training_time
        }
        
        # Confusion matrix
        cm = confusion_matrix(self.y_test, y_pred)
        tn, fp, fn, tp = cm.ravel()
        
        metrics['true_negatives'] = int(tn)
        metrics['false_positives'] = int(fp)
        metrics['false_negatives'] = int(fn)
        metrics['true_positives'] = int(tp)
        metrics['false_positive_rate'] = fp / (fp + tn) if (fp + tn) > 0 else 0
        
        print(f"    Accuracy: {metrics['accuracy']:.4f}")
        print(f"    Precision: {metrics['precision']:.4f}")
        print(f"    Recall: {metrics['recall']:.4f}")
        print(f"    F1 Score: {metrics['f1_score']:.4f}")
        print(f"    ROC AUC: {metrics['roc_auc']:.4f}")
        print(f"    FPR: {metrics['false_positive_rate']:.4f}")
        print(f"    Training Time: {training_time:.2f}s")
        
        return metrics
    
    def save_models(self):
        """
        Save trained models
        """
        print("\n" + "=" * 60)
        print("Saving Models")
        print("=" * 60)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save each model
        for name, model in self.models.items():
            safe_name = name.lower().replace(' ', '_').replace('(', '').replace(')', '')
            model_path = self.output_dir / f"{safe_name}_{timestamp}.pkl"
            
            model_data = {
                'model': model,
                'scaler': self.scaler,
                'feature_names': self.feature_names,
                'metrics': self.results[name],
                'timestamp': timestamp,
                'model_name': name
            }
            
            with open(model_path, 'wb') as f:
                pickle.dump(model_data, f)
            
            print(f"  Saved: {model_path.name}")
        
        # Save training report
        report_path = self.output_dir / f"training_report_{timestamp}.json"
        report = {
            'timestamp': timestamp,
            'dataset': {
                'total_samples': len(self.df),
                'phishing_samples': int((self.df['Label'] == 1).sum()),
                'legitimate_samples': int((self.df['Label'] == 0).sum()),
                'train_samples': len(self.X_train),
                'test_samples': len(self.X_test)
            },
            'features': {
                'count': len(self.feature_names),
                'names': self.feature_names
            },
            'models': self.results
        }
        
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2)
        
        print(f"  Saved training report: {report_path.name}")
    
    def generate_visualizations(self):
        """
        Generate visualization plots
        """
        if not HAS_PLOTTING:
            print("\n⚠ Skipping visualizations (matplotlib not installed)")
            return
        
        print("\n" + "=" * 60)
        print("Generating Visualizations")
        print("=" * 60)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Model comparison plot
        fig, axes = plt.subplots(2, 3, figsize=(18, 12))
        axes = axes.ravel()
        
        models = list(self.results.keys())
        
        # Metrics to plot
        metrics_to_plot = [
            ('accuracy', 'Accuracy', 'skyblue'),
            ('precision', 'Precision', 'lightgreen'),
            ('recall', 'Recall', 'lightcoral'),
            ('f1_score', 'F1 Score', 'gold'),
            ('roc_auc', 'ROC AUC', 'plum'),
            ('false_positive_rate', 'False Positive Rate', 'salmon')
        ]
        
        for idx, (metric, title, color) in enumerate(metrics_to_plot):
            values = [self.results[m][metric] for m in models]
            axes[idx].bar(models, values, color=color)
            axes[idx].set_title(title)
            axes[idx].set_ylabel(metric.replace('_', ' ').title())
            axes[idx].tick_params(axis='x', rotation=45)
            axes[idx].grid(axis='y', alpha=0.3)
        
        plt.tight_layout()
        plot_path = self.output_dir / f"model_comparison_{timestamp}.png"
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        print(f"  Saved: {plot_path.name}")
        plt.close()
    
    def run(self):
        """
        Run complete training pipeline with latest online data + local datasets
        """
        print("\n" + "=" * 70)
        print("NGIPS Phishing Shield - Advanced Model Training")
        print("Using Latest Online Datasets + Local Data for Robustness")
        print("=" * 70)
        
        self.load_datasets()
        self.extract_features()
        self.train_traditional_models()
        self.train_ensemble_model()
        self.save_models()
        self.generate_visualizations()
        
        print("\n" + "=" * 70)
        print("Training Complete!")
        print("=" * 70)
        
        # Print best model
        best_model = max(self.results.items(), key=lambda x: x[1]['f1_score'])
        print(f"\n🏆 Best Model: {best_model[0]}")
        print(f"   F1 Score: {best_model[1]['f1_score']:.4f}")
        print(f"   Accuracy: {best_model[1]['accuracy']:.4f}")
        print(f"   Precision: {best_model[1]['precision']:.4f}")
        print(f"   Recall: {best_model[1]['recall']:.4f}")
        print(f"   False Positive Rate: {best_model[1]['false_positive_rate']:.4f}")


if __name__ == "__main__":
    # Train models using only online datasets
    trainer = AdvancedPhishingModelTrainer(output_dir="./models")
    trainer.run()
