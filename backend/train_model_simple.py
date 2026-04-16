"""
NGIPS Phishing Shield - Simplified Model Training
Works with basic dependencies, downloads latest PhishTank data
"""

import pandas as pd
import numpy as np
import pickle
import json
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
import re
from typing import Dict
import warnings
warnings.filterwarnings('ignore')

# ML imports
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, roc_auc_score
)

print("=" * 70)
print("NGIPS Phishing Shield - Model Training")
print("=" * 70)
print("\nChecking dependencies...")

# Check for optional libraries
try:
    import requests
    HAS_REQUESTS = True
    print("✓ requests available - can download PhishTank data")
except ImportError:
    HAS_REQUESTS = False
    print("✗ requests not available - install with: pip install requests")

try:
    import matplotlib.pyplot as plt
    import seaborn as sns
    HAS_PLOTTING = True
    print("✓ matplotlib/seaborn available - will generate plots")
except ImportError:
    HAS_PLOTTING = False
    print("✗ matplotlib/seaborn not available - skipping plots")


class URLFeatureExtractor:
    """Extract features from URLs"""
    
    @staticmethod
    def extract_features(url: str) -> Dict[str, float]:
        """Extract 50+ features from URL"""
        features = {}
        
        try:
            parsed = urlparse(url)
            domain = parsed.netloc
            path = parsed.path
            query = parsed.query
            
            # Basic features
            features['url_length'] = len(url)
            features['domain_length'] = len(domain)
            features['path_length'] = len(path)
            features['query_length'] = len(query)
            
            # Character counts
            features['num_dots'] = url.count('.')
            features['num_hyphens'] = url.count('-')
            features['num_underscores'] = url.count('_')
            features['num_slashes'] = url.count('/')
            features['num_question_marks'] = url.count('?')
            features['num_equals'] = url.count('=')
            features['num_at'] = url.count('@')
            features['num_ampersand'] = url.count('&')
            features['num_percent'] = url.count('%')
            
            # Digit features
            features['num_digits'] = sum(c.isdigit() for c in url)
            features['digit_ratio'] = features['num_digits'] / max(len(url), 1)
            
            # Subdomain
            features['subdomain_count'] = domain.count('.') - 1 if domain.count('.') > 0 else 0
            
            # IP address
            features['has_ip'] = 1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0
            
            # Suspicious keywords
            suspicious = ['login', 'signin', 'account', 'update', 'verify', 'secure',
                         'banking', 'paypal', 'confirm', 'password', 'suspend']
            url_lower = url.lower()
            features['suspicious_keyword_count'] = sum(1 for k in suspicious if k in url_lower)
            
            # Protocol
            features['is_https'] = 1.0 if parsed.scheme == 'https' else 0.0
            
            # Entropy
            features['url_entropy'] = URLFeatureExtractor._entropy(url)
            features['domain_entropy'] = URLFeatureExtractor._entropy(domain)
            
            # URL shortener
            shorteners = ['bit.ly', 'goo.gl', 'tinyurl', 't.co', 'ow.ly']
            features['is_shortened'] = 1.0 if any(s in domain for s in shorteners) else 0.0
            
            # Path features
            features['path_depth'] = path.count('/') if path else 0
            features['has_double_slash'] = 1.0 if '//' in path else 0.0
            
            # TLD
            tld = domain.split('.')[-1] if '.' in domain else ''
            suspicious_tlds = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top']
            features['suspicious_tld'] = 1.0 if tld in suspicious_tlds else 0.0
            
            # Ratios
            special_chars = features['num_dots'] + features['num_hyphens'] + features['num_underscores']
            features['special_char_ratio'] = special_chars / max(len(url), 1)
            
            # Domain tokens
            domain_tokens = domain.split('.')
            features['num_domain_tokens'] = len(domain_tokens)
            features['longest_domain_token'] = max([len(t) for t in domain_tokens]) if domain_tokens else 0
            
            # Query params
            query_params = query.split('&') if query else []
            features['num_query_params'] = len(query_params)
            
        except Exception as e:
            print(f"Error extracting features: {e}")
            features = {f'feature_{i}': 0.0 for i in range(30)}
        
        return features
    
    @staticmethod
    def _entropy(text: str) -> float:
        """Calculate Shannon entropy"""
        if not text:
            return 0.0
        freq = {}
        for char in text:
            freq[char] = freq.get(char, 0) + 1
        entropy = 0.0
        for count in freq.values():
            p = count / len(text)
            entropy -= p * np.log2(p)
        return entropy


def download_phishtank_data():
    """Download latest PhishTank data"""
    if not HAS_REQUESTS:
        print("\n⚠ Cannot download PhishTank data (requests not installed)")
        return None
    
    print("\nDownloading latest PhishTank data...")
    url = "http://data.phishtank.com/data/online-valid.json"
    
    try:
        response = requests.get(url, timeout=60)
        response.raise_for_status()
        
        output_path = "phishtank_data.json"
        with open(output_path, 'w') as f:
            f.write(response.text)
        
        # Parse JSON
        data = json.loads(response.text)
        urls = [entry['url'] for entry in data]
        df = pd.DataFrame({'URL': urls, 'Label': 1})
        
        print(f"✓ Downloaded {len(df)} phishing URLs from PhishTank")
        return df
        
    except Exception as e:
        print(f"✗ Error downloading PhishTank data: {e}")
        return None


def main():
    """Main training pipeline"""
    
    # Load datasets
    print("\n" + "=" * 70)
    print("Loading Datasets")
    print("=" * 70)
    
    dfs = []
    
    # Load local dataset
    local_csv = "../Dataset/phishing_site_urls Combined.csv"
    if Path(local_csv).exists():
        print(f"\nLoading local dataset: {local_csv}")
        df_local = pd.read_csv(local_csv)
        df_local = df_local.dropna(subset=['URL', 'Label'])
        df_local['Label'] = df_local['Label'].map({'bad': 1, 'good': 0, 1: 1, 0: 0})
        df_local = df_local[df_local['Label'].isin([0, 1])]
        dfs.append(df_local)
        print(f"✓ Loaded {len(df_local)} URLs from local dataset")
    else:
        print(f"✗ Local dataset not found: {local_csv}")
    
    # Download PhishTank data
    df_phishtank = download_phishtank_data()
    if df_phishtank is not None:
        dfs.append(df_phishtank)
    
    if not dfs:
        print("\n✗ No datasets loaded! Exiting.")
        sys.exit(1)
    
    # Combine datasets
    df = pd.concat(dfs, ignore_index=True)
    df = df.drop_duplicates(subset=['URL'])
    
    print(f"\n✓ Combined dataset: {len(df)} unique URLs")
    print(f"  Phishing: {(df['Label'] == 1).sum()}")
    print(f"  Legitimate: {(df['Label'] == 0).sum()}")
    
    # Extract features
    print("\n" + "=" * 70)
    print("Extracting Features")
    print("=" * 70)
    
    extractor = URLFeatureExtractor()
    features_list = []
    
    for idx, url in enumerate(df['URL']):
        if idx % 10000 == 0:
            print(f"  Progress: {idx}/{len(df)} URLs...")
        features = extractor.extract_features(url)
        features_list.append(features)
    
    features_df = pd.DataFrame(features_list)
    feature_names = features_df.columns.tolist()
    
    # Handle NaN values - replace with 0
    features_df = features_df.fillna(0)
    
    # Handle infinite values
    features_df = features_df.replace([np.inf, -np.inf], 0)
    
    print(f"\n✓ Extracted {len(feature_names)} features")
    print(f"✓ Cleaned NaN and infinite values")
    
    # Split data
    X = features_df.values
    y = df['Label'].values
    
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    
    # Scale features
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)
    
    print(f"✓ Training set: {len(X_train)} samples")
    print(f"✓ Test set: {len(X_test)} samples")
    
    # Train models
    print("\n" + "=" * 70)
    print("Training Models")
    print("=" * 70)
    
    models = {
        'Logistic Regression': LogisticRegression(
            max_iter=1000, random_state=42, class_weight='balanced', n_jobs=-1
        ),
        'Random Forest': RandomForestClassifier(
            n_estimators=200, max_depth=20, random_state=42, 
            class_weight='balanced', n_jobs=-1
        ),
        'Gradient Boosting': GradientBoostingClassifier(
            n_estimators=200, max_depth=10, random_state=42, learning_rate=0.1
        )
    }
    
    results = {}
    
    for name, model in models.items():
        print(f"\nTraining {name}...")
        start_time = datetime.now()
        
        model.fit(X_train, y_train)
        
        training_time = (datetime.now() - start_time).total_seconds()
        
        # Evaluate
        y_pred = model.predict(X_test)
        y_pred_proba = model.predict_proba(X_test)[:, 1]
        
        metrics = {
            'accuracy': accuracy_score(y_test, y_pred),
            'precision': precision_score(y_test, y_pred),
            'recall': recall_score(y_test, y_pred),
            'f1_score': f1_score(y_test, y_pred),
            'roc_auc': roc_auc_score(y_test, y_pred_proba),
            'training_time': training_time
        }
        
        cm = confusion_matrix(y_test, y_pred)
        tn, fp, fn, tp = cm.ravel()
        metrics['false_positive_rate'] = fp / (fp + tn)
        
        results[name] = metrics
        
        print(f"  Accuracy: {metrics['accuracy']:.4f}")
        print(f"  Precision: {metrics['precision']:.4f}")
        print(f"  Recall: {metrics['recall']:.4f}")
        print(f"  F1 Score: {metrics['f1_score']:.4f}")
        print(f"  ROC AUC: {metrics['roc_auc']:.4f}")
        print(f"  FPR: {metrics['false_positive_rate']:.4f}")
        print(f"  Time: {training_time:.2f}s")
    
    # Save models
    print("\n" + "=" * 70)
    print("Saving Models")
    print("=" * 70)
    
    output_dir = Path("./models")
    output_dir.mkdir(exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    
    for name, model in models.items():
        safe_name = name.lower().replace(' ', '_')
        model_path = output_dir / f"{safe_name}_{timestamp}.pkl"
        
        model_data = {
            'model': model,
            'scaler': scaler,
            'feature_names': feature_names,
            'metrics': results[name],
            'timestamp': timestamp,
            'model_name': name
        }
        
        with open(model_path, 'wb') as f:
            pickle.dump(model_data, f)
        
        print(f"✓ Saved: {model_path.name}")
    
    # Save report
    report_path = output_dir / f"training_report_{timestamp}.json"
    report = {
        'timestamp': timestamp,
        'dataset': {
            'total_samples': len(df),
            'phishing_samples': int((df['Label'] == 1).sum()),
            'legitimate_samples': int((df['Label'] == 0).sum()),
            'train_samples': len(X_train),
            'test_samples': len(X_test)
        },
        'features': {
            'count': len(feature_names),
            'names': feature_names
        },
        'models': results
    }
    
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"✓ Saved report: {report_path.name}")
    
    # Generate plots
    if HAS_PLOTTING:
        print("\nGenerating visualizations...")
        
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        model_names = list(results.keys())
        
        # Accuracy
        accuracies = [results[m]['accuracy'] for m in model_names]
        axes[0, 0].bar(model_names, accuracies, color='skyblue')
        axes[0, 0].set_title('Accuracy Comparison')
        axes[0, 0].set_ylabel('Accuracy')
        axes[0, 0].set_ylim([0.8, 1.0])
        axes[0, 0].tick_params(axis='x', rotation=45)
        
        # F1 Score
        f1_scores = [results[m]['f1_score'] for m in model_names]
        axes[0, 1].bar(model_names, f1_scores, color='lightgreen')
        axes[0, 1].set_title('F1 Score Comparison')
        axes[0, 1].set_ylabel('F1 Score')
        axes[0, 1].set_ylim([0.8, 1.0])
        axes[0, 1].tick_params(axis='x', rotation=45)
        
        # False Positive Rate
        fpr = [results[m]['false_positive_rate'] for m in model_names]
        axes[1, 0].bar(model_names, fpr, color='salmon')
        axes[1, 0].set_title('False Positive Rate')
        axes[1, 0].set_ylabel('FPR')
        axes[1, 0].tick_params(axis='x', rotation=45)
        
        # Training Time
        times = [results[m]['training_time'] for m in model_names]
        axes[1, 1].bar(model_names, times, color='gold')
        axes[1, 1].set_title('Training Time')
        axes[1, 1].set_ylabel('Seconds')
        axes[1, 1].tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plot_path = output_dir / f"model_comparison_{timestamp}.png"
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        print(f"✓ Saved plot: {plot_path.name}")
        plt.close()
    
    # Summary
    print("\n" + "=" * 70)
    print("Training Complete!")
    print("=" * 70)
    
    best_model = max(results.items(), key=lambda x: x[1]['f1_score'])
    print(f"\n🏆 Best Model: {best_model[0]}")
    print(f"   F1 Score: {best_model[1]['f1_score']:.4f}")
    print(f"   Accuracy: {best_model[1]['accuracy']:.4f}")
    print(f"   Precision: {best_model[1]['precision']:.4f}")
    print(f"   Recall: {best_model[1]['recall']:.4f}")
    print(f"   False Positive Rate: {best_model[1]['false_positive_rate']:.4f}")
    
    print(f"\n✓ Models saved to: {output_dir.absolute()}")
    print(f"✓ Training report: {report_path.name}")


if __name__ == "__main__":
    main()
