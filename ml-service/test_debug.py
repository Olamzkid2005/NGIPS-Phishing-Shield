import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from predict import URLTokenizer, load_models

models = load_models()
url = "http://paypal-login-verify.xyz/secure"

for name, model in models.items():
    print(f"{name} classes: {model.classes_}")
    proba = model.predict_proba([url])[0]
    print(f"{name} proba: {proba}")
    pred = model.predict([url])[0]
    print(f"{name} predict: {pred}")
    print()
