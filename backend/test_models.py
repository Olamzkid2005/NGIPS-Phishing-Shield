#!/usr/bin/env python3
"""
Test script to examine model structure
"""

import joblib
import os
from pathlib import Path

def examine_model(model_path):
    """Examine a single model file"""
    print(f"\n=== Examining {model_path} ===")
    try:
        model_data = joblib.load(model_path)
        print(f"Type: {type(model_data)}")
        
        if isinstance(model_data, dict):
            print(f"Dict keys: {list(model_data.keys())}")
            
            # Examine the actual model
            if 'model' in model_data:
                actual_model = model_data['model']
                print(f"Actual model type: {type(actual_model)}")
                print(f"Model has predict: {hasattr(actual_model, 'predict')}")
                print(f"Model has predict_proba: {hasattr(actual_model, 'predict_proba')}")
                
                # Show model attributes
                model_attrs = [attr for attr in dir(actual_model) if not attr.startswith('_')][:10]
                print(f"Model attributes: {model_attrs}")
                
            # Show other info
            if 'feature_names' in model_data:
                feature_names = model_data['feature_names']
                print(f"Feature count: {len(feature_names) if feature_names else 0}")
                
            if 'metrics' in model_data:
                metrics = model_data['metrics']
                print(f"Stored metrics: {metrics}")
                
        else:
            print(f"Has predict: {hasattr(model_data, 'predict')}")
            print(f"Has predict_proba: {hasattr(model_data, 'predict_proba')}")
            
            # Show first 10 non-private attributes
            attrs = [attr for attr in dir(model_data) if not attr.startswith('_')][:15]
            print(f"Attributes: {attrs}")
            
        return model_data
        
    except Exception as e:
        print(f"Error loading {model_path}: {e}")
        return None

def main():
    models_dir = Path("models")
    
    if not models_dir.exists():
        print(f"Models directory not found: {models_dir}")
        return
    
    # Find all .pkl files
    model_files = list(models_dir.glob("*.pkl"))
    print(f"Found {len(model_files)} model files")
    
    # Examine first few models
    for model_file in model_files[:3]:  # Just examine first 3
        examine_model(model_file)

if __name__ == "__main__":
    main()