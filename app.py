from flask import Flask, request, render_template
import joblib
import os

app = Flask(__name__)

# Load the phishing detection model pipeline (which includes the vectorizer)
model_path = r"C:\Users\Olamzkid\Documents\Final Year Project\phishingApp.pkl"

if os.path.exists(model_path):
    model = joblib.load(model_path)
else:
    raise FileNotFoundError("Model not found!")

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if request.method == 'POST':
        url = request.form['url']
        
        # Predict using the loaded model pipeline
        prediction = model.predict([url])
        
        return render_template('result.html', prediction=prediction[0])

if __name__ == '__main__':
    app.run(debug=True)
