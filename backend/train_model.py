"""
NGIPS Phishing Shield - Model Training Script
Train ML models for phishing detection with improved feature engineering
"""

import pandas as pd
import numpy as np
import pickle
import json
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
import re
from typing import Dict, List, Tuple
import warnings
warnings.filterwarnings('ignore')

# ML imports
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.naive_bayes import GaussianNB
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    confusion_matrix, classification_report, roc_auc_score, roc_curve
)
import matplotlib.pyplot as plt
import seaborn as sns


class URLFeatureExtractor:
    """
    Extract features from URLs for phishing detection
    """
    
    @staticmethod
    def extract_features(url: str) -> Dict[str, float]:
        """
        Extract comprehensive features from a URL
        
        Args:
            url: URL string to extract features from
            
        Returns:
            Dictionary of feature values
        """
        features = {}
        
        try:
            # Parse URL
            parsed = urlparse(url)
            domain = parsed.netloc
            path = parsed.path
            
            # Basic URL features
            features['url_length'] = len(url)
            features['domain_length'] = len(domain)
            features['path_length'] = len(path)
            
            # Count special characters
            features['num_dots'] = url.count('.')
            features['num_hyphens'] = url.count('-')
            features['num_underscores'] = url.count('_')
            features['num_slashes'] = url.count('/')
            features['num_question_marks'] = url.count('?')
            features['num_equals'] = url.count('=')
            features['num_at'] = url.count('@')
            features['num_ampersand'] = url.count('&')
            features['num_percent'] = url.count('%')
            
            # Count digits
            features['num_digits'] = sum(c.isdigit() for c in url)
            features['digit_ratio'] = features['num_digits'] / max(len(url), 1)
            
            # Subdomain count
            features['subdomain_count'] = domain.count('.') - 1 if domain.count('.') > 0 else 0
            
            # Check for IP address in domain
            features['has_ip'] = 1.0 if re.match(r'\d+\.\d+\.\d+\.\d+', domain) else 0.0
            
            # Check for suspicious keywords
            suspicious_keywords = [
                'login', 'signin', 'account', 'update', 'verify', 'secure',
                'banking', 'paypal', 'ebay', 'amazon', 'confirm', 'password'
            ]
            url_lower = url.lower()
            features['suspicious_keyword_count'] = sum(
                1 for keyword in suspicious_keywords if keyword in url_lower
            )
            
            # Check for HTTPS
            features['is_https'] = 1.0 if parsed.scheme == 'https' else 0.0
            
            # URL entropy (measure of randomness)
            features['entropy'] = URLFeatureExtractor._calculate_entropy(url)
            
            # Check for shortened URL patterns
            shorteners = ['bit.ly', 'goo.gl', 'tinyurl', 't.co', 'ow.ly']
            features['is_shortened'] = 1.0 if any(s in domain for s in shorteners) else 0.0
            
            # Path depth
            features['path_depth'] = path.count('/') if path else 0
            
            # Check for double slashes in path
            features['has_double_slash'] = 1.0 if '//' in path else 0.0
            
            # TLD features
            tld = domain.split('.')[-1] if '.' in domain else ''
            suspicious_tlds = ['tk', 'ml', 'ga', 'cf', 'gq', 'xyz', 'top']
            features['suspicious_tld'] = 1.0 if tld in suspicious_tlds else 0.0
            
            # Check for multiple subdomains
            features['has_multiple_subdomains'] = 1.0 if features['subdomain_count'] > 2 else 0.0
            
            # Ratio of special characters to length
            special_chars = features['num_dots'] + features['num_hyphens'] + features['num_underscores']
            features['special_char_ratio'] = special_chars / max(len(url), 1)
            
        except Exception as e:
            print(f"Error extracting features from URL: {url[:50]}... - {e}")
            # Return default features on error
            features = {f'feature_{i}': 0.0 for i in range(25)}
        
        return features
    
    @staticmethod
    def _calculate_entropy(text: str) -> float:
        """
        Calculate Shannon entropy of text
        """
        if not text:
            return 0.0
        
        # Count character frequencies
        freq = {}
        for char in text:
            freq[char] = freq.get(char, 0) + 1
        
        # Calculate entropy
        entropy = 0.0
        text_len = len(text)
        for count in freq.values():
            p = count / text_len
            entropy -= p * np.log2(p)
        
        return entropy


class PhishingModelTrainer:
    """
    Train and evaluate phishing detection models
    """
    
    def __init__(self, dataset_path: str, output_dir: str = "./models"):
        """
        Initialize trainer
        
        Args:
            dataset_path: Path to CSV dataset
            output_dir: Directory to save trained models
        """
        self.dataset_path = dataset_path
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
    
    def load_data(self):
        """
        Load and preprocess dataset
        """
        print("Loading dataset...")
        self.df = pd.read_csv(self.dataset_path)
        
        # Drop NaN values
        self.df = self.df.dropna(subset=['URL', 'Label'])
        
        # Convert labels to binary (1 = phishing, 0 = legitimate)
        self.df['Label'] = self.df['Label'].map({'bad': 1, 'good': 0})
        
        # Remove any rows with invalid labels
        self.df = self.df[self.df['Label'].isin([0, 1])]
        
        print(f"Dataset loaded: {len(self.df)} samples")
        print(f"  Phishing: {(self.df['Label'] == 1).sum()}")
        print(f"  Legitimate: {(self.df['Label'] == 0).sum()}")
    
    def extract_features(self):
        """
        Extract features from URLs
        """
        print("\nExtracting features from URLs...")
        
        extractor = URLFeatureExtractor()
        
        # Extract features for each URL
        features_list = []
        for idx, url in enumerate(self.df['URL']):
            if idx % 10000 == 0:
                print(f"  Processed {idx}/{len(self.df)} URLs...")
            
            features = extractor.extract_features(url)
            features_list.append(features)
        
        # Convert to DataFrame
        features_df = pd.DataFrame(features_list)
        self.feature_names = features_df.columns.tolist()
        
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
        
        print(f"Features extracted: {len(self.feature_names)} features")
        print(f"Training set: {len(self.X_train)} samples")
        print(f"Test set: {len(self.X_test)} samples")
    
    def train_models(self):
        """
        Train multiple ML models
        """
        print("\nTraining models...")
        
        # Define models
        models_to_train = {
            'Logistic Regression': LogisticRegression(
                max_iter=1000,
                random_state=42,
                class_weight='balanced'
            ),
            'Random Forest': RandomForestClassifier(
                n_estimators=100,
                max_depth=20,
                random_state=42,
                class_weight='balanced',
                n_jobs=-1
            ),
            'Gradient Boosting': GradientBoostingClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42
            ),
            'Naive Bayes': GaussianNB()
        }
        
        # Train each model
        for name, model in models_to_train.items():
            print(f"\n  Training {name}...")
            start_time = datetime.now()
            
            model.fit(self.X_train, self.y_train)
            
            training_time = (datetime.now() - start_time).total_seconds()
            
            # Make predictions
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
            
            # Calculate confusion matrix
            cm = confusion_matrix(self.y_test, y_pred)
            tn, fp, fn, tp = cm.ravel()
            
            metrics['true_negatives'] = int(tn)
            metrics['false_positives'] = int(fp)
            metrics['false_negatives'] = int(fn)
            metrics['true_positives'] = int(tp)
            metrics['false_positive_rate'] = fp / (fp + tn) if (fp + tn) > 0 else 0
            
            # Store model and results
            self.models[name] = model
            self.results[name] = metrics
            
            print(f"    Accuracy: {metrics['accuracy']:.4f}")
            print(f"    Precision: {metrics['precision']:.4f}")
            print(f"    Recall: {metrics['recall']:.4f}")
            print(f"    F1 Score: {metrics['f1_score']:.4f}")
            print(f"    ROC AUC: {metrics['roc_auc']:.4f}")
            print(f"    False Positive Rate: {metrics['false_positive_rate']:.4f}")
            print(f"    Training Time: {training_time:.2f}s")
    
    def save_models(self):
        """
        Save trained models and metadata
        """
        print("\nSaving models...")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save each model
        for name, model in self.models.items():
            # Create safe filename
            safe_name = name.lower().replace(' ', '_')
            model_path = self.output_dir / f"{safe_name}_{timestamp}.pkl"
            
            # Save model with metadata
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
            
            print(f"  Saved: {model_path}")
        
        # Save training report
        report_path = self.output_dir / f"training_report_{timestamp}.json"
        report = {
            'timestamp': timestamp,
            'dataset': {
                'path': self.dataset_path,
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
        
        print(f"  Saved training report: {report_path}")
    
    def generate_visualizations(self):
        """
        Generate visualization plots
        """
        print("\nGenerating visualizations...")
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # 1. Model comparison plot
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        
        # Accuracy comparison
        models = list(self.results.keys())
        accuracies = [self.results[m]['accuracy'] for m in models]
        axes[0, 0].bar(models, accuracies, color='skyblue')
        axes[0, 0].set_title('Model Accuracy Comparison')
        axes[0, 0].set_ylabel('Accuracy')
        axes[0, 0].set_ylim([0.8, 1.0])
        axes[0, 0].tick_params(axis='x', rotation=45)
        
        # F1 Score comparison
        f1_scores = [self.results[m]['f1_score'] for m in models]
        axes[0, 1].bar(models, f1_scores, color='lightgreen')
        axes[0, 1].set_title('Model F1 Score Comparison')
        axes[0, 1].set_ylabel('F1 Score')
        axes[0, 1].set_ylim([0.8, 1.0])
        axes[0, 1].tick_params(axis='x', rotation=45)
        
        # False Positive Rate comparison
        fpr = [self.results[m]['false_positive_rate'] for m in models]
        axes[1, 0].bar(models, fpr, color='salmon')
        axes[1, 0].set_title('False Positive Rate Comparison')
        axes[1, 0].set_ylabel('False Positive Rate')
        axes[1, 0].tick_params(axis='x', rotation=45)
        
        # Training Time comparison
        times = [self.results[m]['training_time'] for m in models]
        axes[1, 1].bar(models, times, color='gold')
        axes[1, 1].set_title('Training Time Comparison')
        axes[1, 1].set_ylabel('Time (seconds)')
        axes[1, 1].tick_params(axis='x', rotation=45)
        
        plt.tight_layout()
        plot_path = self.output_dir / f"model_comparison_{timestamp}.png"
        plt.savefig(plot_path, dpi=300, bbox_inches='tight')
        print(f"  Saved comparison plot: {plot_path}")
        plt.close()
        
        # 2. Confusion matrices
        fig, axes = plt.subplots(2, 2, figsize=(15, 12))
        axes = axes.ravel()
        
        for idx, (name, model) in enumerate(self.models.items()):
            y_pred = model.predict(self.X_test)
            cm = confusion_matrix(self.y_test, y_pred)
            
            sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', ax=axes[idx])
            axes[idx].set_title(f'{name} - Confusion Matrix')
            axes[idx].set_ylabel('True Label')
            axes[idx].set_xlabel('Predicted Label')
        
        plt.tight_layout()
        cm_path = self.output_dir / f"confusion_matrices_{timestamp}.png"
        plt.savefig(cm_path, dpi=300, bbox_inches='tight')
        print(f"  Saved confusion matrices: {cm_path}")
        plt.close()
    
    def run(self):
        """
        Run complete training pipeline
        """
        print("=" * 60)
        print("NGIPS Phishing Shield - Model Training")
        print("=" * 60)
        
        self.load_data()
        self.extract_features()
        self.train_models()
        self.save_models()
        self.generate_visualizations()
        
        print("\n" + "=" * 60)
        print("Training Complete!")
        print("=" * 60)
        
        # Print best model
        best_model = max(self.results.items(), key=lambda x: x[1]['f1_score'])
        print(f"\nBest Model: {best_model[0]}")
        print(f"  F1 Score: {best_model[1]['f1_score']:.4f}")
        print(f"  Accuracy: {best_model[1]['accuracy']:.4f}")
        print(f"  False Positive Rate: {best_model[1]['false_positive_rate']:.4f}")


if __name__ == "__main__":
    # Train models
    trainer = PhishingModelTrainer(
        dataset_path="../Dataset/phishing_site_urls Combined.csv",
        output_dir="./models"
    )
    trainer.run()
