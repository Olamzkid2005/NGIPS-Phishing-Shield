#!/usr/bin/env python3
"""
Test the updated model loader
"""

import sys
sys.path.append('.')

from app.ml.models import ModelLoader

def main():
    print("Testing ModelLoader...")
    
    loader = ModelLoader()
    success = loader.load_all_models()
    
    print(f"Success: {success}")
    
    if success:
        models = loader.get_all_models()
        print(f"Loaded {len(models)} models:")
        
        for name, model in models.items():
            metadata = loader.get_metadata(name)
            print(f"  - {name}: {type(model)} (accuracy: {metadata.accuracy:.4f})" if metadata.accuracy else f"  - {name}: {type(model)}")
        
        # Test system info
        system_info = loader.get_system_info()
        print(f"\nSystem Info:")
        print(f"  Status: {system_info['status']}")
        print(f"  Model Count: {system_info['model_count']}")
        print(f"  Best Models: {', '.join(system_info['best_models'])}")
        print(f"  Ensemble Models: {', '.join(system_info['ensemble_models'])}")
        
        # Test a prediction
        if models:
            first_model_name = list(models.keys())[0]
            first_model = models[first_model_name]
            
            # Test with dummy data (59 features)
            import numpy as np
            test_data = np.random.rand(1, 59)
            
            try:
                prediction = first_model.predict(test_data)
                print(f"\nTest prediction with {first_model_name}: {prediction}")
                
                if hasattr(first_model, 'predict_proba'):
                    probabilities = first_model.predict_proba(test_data)
                    print(f"Test probabilities: {probabilities}")
                    
            except Exception as e:
                print(f"Prediction test failed: {e}")
    
    else:
        print("Failed to load models")

if __name__ == "__main__":
    main()