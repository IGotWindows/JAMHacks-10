from flask import Flask, render_template

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html") # features (top right corner)

@app.route("/education")
def education():
    return render_template("education.html")

@app.route("/focus")
def focus():
    return render_template("focus.html")

@app.route("/study")
def study():
    return render_template("study.html")

if __name__ == "__main__":
    app.run(debug=True, port=5000)

# python app.py