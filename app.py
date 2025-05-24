from flask import Flask, render_template, request
import requests # Wird benötigt, um API-Anfragen zu senden

app = Flask(__name__)

# Ersetze 'DEIN_NEUER_PERSOENLICHER_NASA_KEY_HIER' durch den Schlüssel, den du mir gerade gegeben hast.
# Das ist dein persönlicher NASA API-Schlüssel.
NASA_API_KEY = 'lvRhFuI604z72sB3RfqeQh3OF7Ar4zRt1K2nv1YE'
NASA_APOD_URL = 'https://api.nasa.gov/planetary/apod' # Endpunkt für Astronomy Picture of the Day

@app.route('/', methods=['GET', 'POST'])
def home():
    result = None
    if request.method == 'POST':
        text = request.form.get('text', '')
        length = len(text)
        result = f"Der eingegebene Text ist {length} Zeichen lang."

    # Daten vom Astronomy Picture of the Day (APOD) abrufen
    apod_data = None
    try:
        params = {
            'api_key': NASA_API_KEY # Der Parameter heißt 'api_key' bei NASA
        }
        response = requests.get(NASA_APOD_URL, params=params)
        response.raise_for_status() # Löst einen Fehler für 4xx/5xx Statuscodes aus
        apod_data = response.json()
        print(f"DEBUG: APOD-Antwort von NASA API: {apod_data}") # Zum Debuggen

    except requests.exceptions.RequestException as e:
        print(f"Fehler bei der HTTP-Anfrage an die NASA APOD API: {e}")
    except Exception as e:
        print(f"Ein unerwarteter Fehler ist aufgetreten beim Abrufen von APOD: {e}")

    # Das apod_data Objekt wird an das Template übergeben
    return render_template('index.html', result=result, apod_data=apod_data)

if __name__ == '__main__':
    app.run(debug=True)