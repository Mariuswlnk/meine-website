from flask import Flask, render_template, request
import requests

app = Flask(__name__)


@app.route('/', methods=['GET', 'POST'])
def home(): # Ich habe den Funktionsnamen von 'index' zu 'home' geändert, um deinem Original zu entsprechen
    result = None
    if request.method == 'POST':
        text = request.form.get('text', '')
        length = len(text)
        result = f"Der eingegebene Text ist {length} Zeichen lang."
    return render_template('index.html', result=result)

if __name__ == '__main__':
    # Stelle sicher, dass du 'requests' installiert hast: pip install requests
    app.run(debug=True)