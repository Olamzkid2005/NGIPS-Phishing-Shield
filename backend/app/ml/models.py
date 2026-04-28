"""
NGIPS Phishing Shield - ML Model Loading and Management

This module handles loading, validation, and management of machine learning models
for phishing detection. It supports multiple model types and provides versioning
metadata for model tracking.

Requirements: 1.2, 3.7, 3.9
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List, Tuple
from datetime import datetime
from pathlib import Path
import joblib
import numpy as np
from sklearn.base import BaseEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.feature_extraction.text import TfidfVectorizer

from app.core.config import settings

logger = logging.getLogger(__name__)


class ModelMetadata:
    """
    Model metadata container for versioning and tracking
    """
    
    def __init__(
        self,
        name: str,
        version: str,
        model_type: str,
        file_path: str,
        accuracy: Optional[float] = None,
        precision: Optional[float] = None,
        recall: Optional[float] = None,
        f1_score: Optional[float] = None,
        training_date: Optional[str] = None,
        feature_count: Optional[int] = None
    ):
        self.name = name
        self.version = version
        self.model_type = model_type
        self.file_path = file_path
        self.accuracy = accuracy
        self.precision = precision
        self.recall = recall
        self.f1_score = f1_score
        self.training_date = training_date
        self.feature_count = feature_count
        self.loaded_at = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert metadata to dictionary"""
        return {
            "name": self.name,
            "version": self.version,
            "model_type": self.model_type,
            "file_path": self.file_path,
            "accuracy": self.accuracy,
            "precision": self.precision,
            "recall": self.recall,
            "f1_score": self.f1_score,
            "training_date": self.training_date,
            "feature_count": self.feature_count,
            "loaded_at": self.loaded_at
        }


class ModelLoader:
    """
    ML Model loader and manager for phishing detection models
    """
    
    def __init__(self, model_dir: str = None):
        self.model_dir = Path(model_dir or settings.MODEL_DIR)
        self.models: Dict[str, BaseEstimator] = {}
        self.metadata: Dict[str, ModelMetadata] = {}
        self.training_report: Optional[Dict[str, Any]] = None
        self._is_loaded = False
    
    def load_training_report(self) -> Optional[Dict[str, Any]]:
        """
        Load training report with model performance metrics
        """
        try:
            # Look for training report files
            report_files = list(self.model_dir.glob("training_report_*.json"))
            if not report_files:
                logger.warning("No training report found in model directory")
                return None
            
            # Use the most recent report
            latest_report = max(report_files, key=os.path.getctime)
            logger.info(f"Loading training report: {latest_report}")
            
            with open(latest_report, 'r') as f:
                report = json.load(f)
            
            logger.info(f"Training report loaded with {len(report.get('models', {}))} model metrics")
            return report
            
        except Exception as e:
            logger.error(f"Failed to load training report: {e}")
            return None
    
    def _extract_model_info_from_filename(self, file_path: Path) -> Tuple[str, str, str]:
        """
        Extract model information from filename
        Returns: (model_name, model_type, training_date)
        """
        filename = file_path.stem
        
        # Parse filename pattern: model_type_YYYYMMDD_HHMMSS
        parts = filename.split('_')
        if len(parts) >= 3:
            model_type = '_'.join(parts[:-2])  # Handle multi-word model types
            training_date = '_'.join(parts[-2:])  # YYYYMMDD_HHMMSS
        else:
            model_type = filename
            training_date = "unknown"
        
        # Map model types to display names
        model_name_mapping = {
            "logistic_regression": "Logistic Regression",
            "naive_bayes": "Naive Bayes", 
            "random_forest": "Random Forest",
            "gradient_boosting": "Gradient Boosting",
            "xgboost": "XGBoost",
            "lightgbm": "LightGBM",
            "catboost": "CatBoost",
            "ensemble": "Ensemble"
        }
        
        model_name = model_name_mapping.get(model_type, model_type.replace('_', ' ').title())
        
        return model_name, model_type, training_date
    
    def _validate_model(self, model: BaseEstimator, model_name: str) -> bool:
        """
        Validate that a loaded model is functional
        """
        try:
            # Check if model has required methods
            if not hasattr(model, 'predict'):
                logger.error(f"Model {model_name} missing predict method")
                return False
            
            if not hasattr(model, 'predict_proba'):
                logger.warning(f"Model {model_name} missing predict_proba method")
            
            # Test with dummy data (59 features based on training report)
            test_features = np.random.rand(1, 59)
            
            try:
                prediction = model.predict(test_features)
                if hasattr(model, 'predict_proba'):
                    probabilities = model.predict_proba(test_features)
                    logger.debug(f"Model {model_name} validation: prediction={prediction}, proba_shape={probabilities.shape}")
                else:
                    logger.debug(f"Model {model_name} validation: prediction={prediction}")
                
                return True
                
            except Exception as e:
                logger.error(f"Model {model_name} failed prediction test: {e}")
                return False
                
        except Exception as e:
            logger.error(f"Model {model_name} validation failed: {e}")
            return False
    
    def load_model(self, file_path: Path) -> Optional[Tuple[BaseEstimator, ModelMetadata]]:
        """
        Load a single model from file with metadata
        """
        try:
            logger.info(f"Loading model from: {file_path}")
            
            # Load model using joblib
            model_data = joblib.load(file_path)
            
            # Handle different model storage formats
            if isinstance(model_data, dict):
                # Model stored as dictionary with 'model', 'scaler', etc.
                if 'model' not in model_data:
                    logger.error(f"Model file {file_path} missing 'model' key")
                    return None
                
                model = model_data['model']
                scaler = model_data.get('scaler')
                feature_names = model_data.get('feature_names', [])
                stored_metrics = model_data.get('metrics', {})
                
                logger.info(f"Loaded model with scaler: {scaler is not None}, features: {len(feature_names)}")
                
            else:
                # Model stored directly
                model = model_data
                scaler = None
                feature_names = []
                stored_metrics = {}
            
            # Extract model information
            model_name, model_type, training_date = self._extract_model_info_from_filename(file_path)
            
            # Get metrics from training report if available, otherwise use stored metrics
            metrics = {}
            if self.training_report and 'models' in self.training_report:
                model_metrics = self.training_report['models'].get(model_name, {})
                metrics = {
                    'accuracy': model_metrics.get('accuracy'),
                    'precision': model_metrics.get('precision'),
                    'recall': model_metrics.get('recall'),
                    'f1_score': model_metrics.get('f1_score')
                }
            else:
                # Use stored metrics if available
                metrics = {
                    'accuracy': stored_metrics.get('accuracy'),
                    'precision': stored_metrics.get('precision'),
                    'recall': stored_metrics.get('recall'),
                    'f1_score': stored_metrics.get('f1_score')
                }
            
            # Get feature count from training report or stored data
            feature_count = None
            if self.training_report and 'features' in self.training_report:
                feature_count = self.training_report['features'].get('count')
            elif feature_names:
                feature_count = len(feature_names)
            
            # Create metadata
            metadata = ModelMetadata(
                name=model_name,
                version=settings.MODEL_VERSION,
                model_type=model_type,
                file_path=str(file_path),
                training_date=training_date,
                feature_count=feature_count,
                **metrics
            )
            
            # Store additional data in metadata for later use
            metadata.scaler = scaler
            metadata.feature_names = feature_names
            
            # Validate model
            if not self._validate_model(model, model_name):
                logger.error(f"Model validation failed for {model_name}")
                return None
            
            logger.info(f"Successfully loaded model: {model_name} (accuracy: {metrics.get('accuracy', 'N/A')})")
            return model, metadata
            
        except Exception as e:
            logger.error(f"Failed to load model from {file_path}: {e}")
            return None
    
    def load_all_models(self) -> bool:
        """
        Load all available models from the model directory
        """
        try:
            logger.info(f"Loading models from directory: {self.model_dir}")
            
            # Check if model directory exists
            if not self.model_dir.exists():
                logger.error(f"Model directory does not exist: {self.model_dir}")
                return False
            
            # Load training report first
            self.training_report = self.load_training_report()
            
            # Find all .pkl files
            model_files = list(self.model_dir.glob("*.pkl"))
            if not model_files:
                logger.error(f"No .pkl model files found in {self.model_dir}")
                return False
            
            logger.info(f"Found {len(model_files)} model files")
            
            # Load each model
            loaded_count = 0
            for model_file in model_files:
                result = self.load_model(model_file)
                if result:
                    model, metadata = result
                    self.models[metadata.name] = model
                    self.metadata[metadata.name] = metadata
                    loaded_count += 1
                else:
                    logger.warning(f"Skipped loading model: {model_file}")
            
            if loaded_count == 0:
                logger.error("No models were successfully loaded")
                return False
            
            self._is_loaded = True
            logger.info(f"Successfully loaded {loaded_count}/{len(model_files)} models")
            
            # Log loaded models
            for name, metadata in self.metadata.items():
                logger.info(f"  - {name}: {metadata.model_type} (accuracy: {metadata.accuracy or 'N/A'})")
            
            return True
            
        except Exception as e:
            logger.error(f"Failed to load models: {e}")
            return False
    
    def get_model(self, model_name: str) -> Optional[BaseEstimator]:
        """
        Get a specific model by name
        """
        if not self._is_loaded:
            logger.error("Models not loaded. Call load_all_models() first.")
            return None
        
        return self.models.get(model_name)
    
    def get_metadata(self, model_name: str) -> Optional[ModelMetadata]:
        """
        Get metadata for a specific model
        """
        return self.metadata.get(model_name)
    
    def get_all_models(self) -> Dict[str, BaseEstimator]:
        """
        Get all loaded models
        """
        if not self._is_loaded:
            logger.error("Models not loaded. Call load_all_models() first.")
            return {}
        
        return self.models.copy()
    
    def get_all_metadata(self) -> Dict[str, ModelMetadata]:
        """
        Get metadata for all loaded models
        """
        return self.metadata.copy()
    
    def get_model_names(self) -> List[str]:
        """
        Get list of all loaded model names
        """
        return list(self.models.keys())
    
    def is_loaded(self) -> bool:
        """
        Check if models are loaded
        """
        return self._is_loaded
    
    def get_best_models(self, metric: str = "accuracy", top_k: int = 2) -> List[str]:
        """
        Get the best performing models based on a metric
        
        Args:
            metric: Metric to sort by ('accuracy', 'precision', 'recall', 'f1_score')
            top_k: Number of top models to return
        
        Returns:
            List of model names sorted by performance
        """
        if not self._is_loaded:
            return []
        
        # Filter models that have the requested metric
        models_with_metric = []
        for name, metadata in self.metadata.items():
            metric_value = getattr(metadata, metric, None)
            if metric_value is not None:
                models_with_metric.append((name, metric_value))
        
        # Sort by metric (descending)
        models_with_metric.sort(key=lambda x: x[1], reverse=True)
        
        # Return top k model names
        return [name for name, _ in models_with_metric[:top_k]]
    
    def get_ensemble_models(self) -> List[str]:
        """
        Get models suitable for ensemble prediction
        Prioritizes Logistic Regression and Naive Bayes as specified in requirements
        """
        if not self._is_loaded:
            return []
        
        # Priority order: Logistic Regression, Naive Bayes, then best performers
        priority_models = ["Logistic Regression", "Naive Bayes"]
        available_models = []
        
        # Add priority models if available
        for model_name in priority_models:
            if model_name in self.models:
                available_models.append(model_name)
        
        # Add other high-performing models
        other_models = self.get_best_models(metric="accuracy", top_k=5)
        for model_name in other_models:
            if model_name not in available_models:
                available_models.append(model_name)
        
        return available_models[:3]  # Limit to top 3 for ensemble
    
    def get_system_info(self) -> Dict[str, Any]:
        """
        Get system information about loaded models
        """
        if not self._is_loaded:
            return {"status": "not_loaded", "models": []}
        
        return {
            "status": "loaded",
            "model_count": len(self.models),
            "model_version": settings.MODEL_VERSION,
            "model_directory": str(self.model_dir),
            "models": [metadata.to_dict() for metadata in self.metadata.values()],
            "training_report_available": self.training_report is not None,
            "best_models": self.get_best_models(metric="accuracy", top_k=3),
            "ensemble_models": self.get_ensemble_models()
        }


# Global model loader instance
model_loader = ModelLoader()


def load_models() -> bool:
    """
    Load all ML models - called during application startup
    """
    logger.info("Initializing ML model loading...")
    success = model_loader.load_all_models()
    
    if success:
        logger.info("✓ ML models loaded successfully")
        
        # Log system info
        system_info = model_loader.get_system_info()
        logger.info(f"Model system status: {system_info['status']}")
        logger.info(f"Loaded {system_info['model_count']} models")
        logger.info(f"Best models: {', '.join(system_info['best_models'])}")
        logger.info(f"Ensemble models: {', '.join(system_info['ensemble_models'])}")
        
    else:
        logger.error("✗ Failed to load ML models")
    
    return success


def get_model_loader() -> ModelLoader:
    """
    Get the global model loader instance
    """
    return model_loader


def validate_models_on_startup() -> None:
    """
    Validate that models are loaded and functional on startup
    Raises exception if validation fails
    """
    if not model_loader.is_loaded():
        raise RuntimeError("ML models are not loaded")
    
    model_count = len(model_loader.get_all_models())
    if model_count == 0:
        raise RuntimeError("No ML models are available")
    
    # Check that we have at least the required models for ensemble
    ensemble_models = model_loader.get_ensemble_models()
    if len(ensemble_models) < 2:
        logger.warning(f"Only {len(ensemble_models)} models available for ensemble (recommended: 2+)")
    
    logger.info(f"✓ Model validation passed: {model_count} models loaded")


if __name__ == "__main__":
    # Test model loading
    print("Testing model loading...")
    
    loader = ModelLoader()
    success = loader.load_all_models()
    
    if success:
        print(f"✓ Successfully loaded {len(loader.get_all_models())} models")
        
        # Print model info
        for name, metadata in loader.get_all_metadata().items():
            print(f"  - {name}: {metadata.accuracy:.4f} accuracy" if metadata.accuracy else f"  - {name}: No accuracy data")
        
        # Test system info
        system_info = loader.get_system_info()
        print(f"\nSystem Info:")
        print(f"  Status: {system_info['status']}")
        print(f"  Model Count: {system_info['model_count']}")
        print(f"  Best Models: {', '.join(system_info['best_models'])}")
        print(f"  Ensemble Models: {', '.join(system_info['ensemble_models'])}")
        
    else:
        print("✗ Failed to load models")