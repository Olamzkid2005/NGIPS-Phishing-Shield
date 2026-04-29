import sys
import os
import warnings
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
warnings.filterwarnings("ignore")

from predict import URLTokenizer, load_models

models = load_models()

urls = [
    "http://paypal-login-verify.xyz/secure",
    "https://www.google.com",
    "http://192.168.1.1/login/update-account/verify.php?id=12345"
]

for url in urls:
    print(f"\nURL: {url}")
    for name, model in models.items():
        proba = model.predict_proba([url])[0]
        pred = model.predict([url])[0]
        print(f"  {name}:")
        print(f"    classes: {model.classes_}")
        print(f"    proba: {proba}")
        print(f"    predict: {pred}")
