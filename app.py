from flask import Flask, render_template, request

app = Flask(__name__)

@app.route('/', methods=['GET', 'POST'])
def home():
    result = None
    if request.method == 'POST':
        text = request.form.get('text', '')
        length = len(text)
        result = f"Der eingegebene Text ist {length} Zeichen lang."
    return render_template('index.html', result=result)

if __name__ == '__main__':
    app.run(debug=True)
