from flask import Flask, render_template, request, redirect, url_for
import os
import sqlite3
import requests # Wird benötigt, um API-Anfragen zu senden

app = Flask(__name__)

# Ersetze 'DEIN_NEUER_PERSOENLICHER_NASA_KEY_HIER' durch den Schlüssel, den du mir gerade gegeben hast.
# Das ist dein persönlicher NASA API-Schlüssel.
NASA_API_KEY = 'lvRhFuI604z72sB3RfqeQh3OF7Ar4zRt1K2nv1YE'
NASA_APOD_URL = 'https://api.nasa.gov/planetary/apod' # Endpunkt für Astronomy Picture of the Day
DB_PATH = os.path.join(app.root_path, 'favorites.db')

WEBCAM_LOCATIONS = [
    {
        'id': 'webcam1',
        'name': 'Kulturpalast, Warschau',
        'lat': 52.2317,
        'lon': 21.0067,
        'timezone': 'Europe/Warsaw',
    },
    {
        'id': 'webcam2',
        'name': 'Jastarnia Augustyna',
        'lat': 54.6960,
        'lon': 18.6720,
        'timezone': 'Europe/Warsaw',
    },
    {
        'id': 'webcam5',
        'name': 'Jastarnia Molo',
        'lat': 54.6960,
        'lon': 18.6720,
        'timezone': 'Europe/Warsaw',
    },
    {
        'id': 'webcam4',
        'name': 'Jastarnia Strand',
        'lat': 54.6960,
        'lon': 18.6720,
        'timezone': 'Europe/Warsaw',
    },
    {
        'id': 'webcam3',
        'name': 'Krakau',
        'lat': 50.0647,
        'lon': 19.9450,
        'timezone': 'Europe/Warsaw',
    },
    {
        'id': 'webcam6',
        'name': 'Danzig',
        'lat': 54.3520,
        'lon': 18.6466,
        'timezone': 'Europe/Warsaw',
    },
]


def init_db():
    with sqlite3.connect(DB_PATH) as connection:
        connection.execute(
            '''
            CREATE TABLE IF NOT EXISTS favorites (
                apod_date TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                url TEXT NOT NULL,
                media_type TEXT NOT NULL,
                explanation TEXT,
                copyright TEXT
            )
            '''
        )


def get_favorites():
    with sqlite3.connect(DB_PATH) as connection:
        connection.row_factory = sqlite3.Row
        rows = connection.execute(
            'SELECT * FROM favorites ORDER BY apod_date DESC'
        ).fetchall()
        return [dict(row) for row in rows]


def is_favorite(apod_date):
    if not apod_date:
        return False
    with sqlite3.connect(DB_PATH) as connection:
        row = connection.execute(
            'SELECT 1 FROM favorites WHERE apod_date = ?',
            (apod_date,),
        ).fetchone()
        return row is not None

@app.route('/', methods=['GET', 'POST'])
def home():
    init_db()
    result = None
    feedback_message = None
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'analyze':
            text = request.form.get('text', '')
            length = len(text)
            result = f"Der eingegebene Text ist {length} Zeichen lang."
        elif action == 'favorite':
            favorite_action = request.form.get('favorite_action')
            apod_date = request.form.get('apod_date')
            title = request.form.get('title')
            url = request.form.get('url')
            media_type = request.form.get('media_type')
            explanation = request.form.get('explanation')
            copyright_text = request.form.get('copyright')
            with sqlite3.connect(DB_PATH) as connection:
                if favorite_action == 'add':
                    connection.execute(
                        '''
                        INSERT OR REPLACE INTO favorites (
                            apod_date,
                            title,
                            url,
                            media_type,
                            explanation,
                            copyright
                        )
                        VALUES (?, ?, ?, ?, ?, ?)
                        ''',
                        (
                            apod_date,
                            title,
                            url,
                            media_type,
                            explanation,
                            copyright_text,
                        ),
                    )
                    feedback_message = 'APOD wurde zu deinen Favoriten hinzugefügt.'
                elif favorite_action == 'remove':
                    connection.execute(
                        'DELETE FROM favorites WHERE apod_date = ?',
                        (apod_date,),
                    )
                    feedback_message = 'APOD wurde aus deinen Favoriten entfernt.'
            return redirect(url_for('home', feedback=feedback_message))

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

    favorites = get_favorites()
    current_apod_date = apod_data.get('date') if apod_data else None
    current_is_favorite = is_favorite(current_apod_date)

    # Das apod_data Objekt wird an das Template übergeben
    return render_template(
        'index.html',
        result=result,
        apod_data=apod_data,
        favorites=favorites,
        is_favorite=current_is_favorite,
        webcam_locations=WEBCAM_LOCATIONS,
        feedback_message=request.args.get('feedback'),
    )

if __name__ == '__main__':
    app.run(debug=True)
