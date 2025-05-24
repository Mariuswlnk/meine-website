from flask import Flask, render_template, request
import requests # Zum Abrufen von Daten von der API

app = Flask(__name__)

# Dein News API Key (wird direkt verwendet)
NEWS_API_KEY = 'b6e750695acb452eae56f57911c5c1c7'
NEWS_API_URL = 'https://newsapi.org/v2/top-headlines' # API-Endpunkt für Top-Schlagzeilen

@app.route('/', methods=['GET', 'POST'])
def home(): # Ich habe den Funktionsnamen von 'index' zu 'home' geändert, um deinem Original zu entsprechen
    result = None
    if request.method == 'POST':
        text = request.form.get('text', '')
        length = len(text)
        result = f"Der eingegebene Text ist {length} Zeichen lang."

    # Nachrichten von der API abrufen
    news_articles = []
    try:
        params = {
            'country': 'de',  # Nachrichten aus Deutschland. Du kannst dies ändern oder weglassen für globale Schlagzeilen.
            'apiKey': NEWS_API_KEY,
            'pageSize': 5      # Anzahl der Nachrichten, die du erhalten möchtest
        }
        response = requests.get(NEWS_API_URL, params=params)
        response.raise_for_status() # Löst einen Fehler aus, wenn die Anfrage fehlschlägt (z.B. 4xx oder 5xx Statuscode)
        data = response.json()
        if data['status'] == 'ok':
            news_articles = data['articles']
        else:
            # Fehlerbehandlung für API-Antwort, wenn Status nicht 'ok' ist
            print(f"Fehler beim Abrufen der Nachrichten von News API: {data.get('message', 'Unbekannter Fehler')}")
    except requests.exceptions.RequestException as e:
        # Fehlerbehandlung für Probleme mit der HTTP-Anfrage (z.B. Netzwerkprobleme)
        print(f"Fehler bei der HTTP-Anfrage an die News API: {e}")
    except Exception as e:
        # Allgemeine Fehlerbehandlung
        print(f"Ein unerwarteter Fehler ist aufgetreten: {e}")

    # Die Nachrichten (news_articles) werden an das Template übergeben
    return render_template('index.html', result=result, news_articles=news_articles)

if __name__ == '__main__':
    # Stelle sicher, dass du 'requests' installiert hast: pip install requests
    app.run(debug=True)