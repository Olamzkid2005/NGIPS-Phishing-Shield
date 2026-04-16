from flask import Flask, render_template, request, redirect, url_for, flash
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import joblib
import os

app = Flask(__name__)
app.secret_key = 'a70b0a5597a558b0093fc19328d91b50'  

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

@app.route('/about')
def about():
    return render_template('about.html')

@app.route('/feedback', methods=['POST'])
def feedback():
    feedback_content = request.form.get('feedback')

    # Email setup
    sender_email = "glitchb3atz5002@gmail.com"  # Replace with your sender email
    sender_password = "Iyenagbon5002"  # Replace with your email password
    receiver_email = "glitchb3atz5002@gmail.com"  
    subject = "Phishing Detection Feedback"

    # Create email
    msg = MIMEMultipart()
    msg['From'] = sender_email
    msg['To'] = receiver_email
    msg['Subject'] = subject

    # Add feedback content to the email body
    body = f"User feedback:\n\n{feedback_content}"
    msg.attach(MIMEText(body, 'plain'))

    # Send the email
    try:
        server = smtplib.SMTP('smtp.gmail.com', 587)
        server.starttls()
        server.login(sender_email, sender_password)
        text = msg.as_string()
        server.sendmail(sender_email, receiver_email, text)
        server.quit()

        flash('Feedback sent successfully!', 'success')
    except Exception as e:
        flash(f'Failed to send feedback: {str(e)}', 'danger')

    return redirect(url_for('home'))

if __name__ == '__main__':
    app.run(debug=True)
