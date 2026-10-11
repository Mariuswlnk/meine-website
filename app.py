import os
import re
import xml.etree.ElementTree as ET
from html import unescape
from pathlib import Path
from email.utils import parsedate_to_datetime

from flask import Flask, jsonify, render_template, request, send_from_directory
import requests # Wird benötigt, um API-Anfragen zu senden

app = Flask(__name__)


def get_env_value(name):
    if os.environ.get(name):
        return os.environ[name]

    env_path = Path(__file__).with_name('.env')
    if not env_path.exists():
        return None

    for line in env_path.read_text(encoding='utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        key, value = line.split('=', 1)
        if key.strip() == name:
            return value.strip().strip('"').strip("'")
    return None

# Ersetze 'DEIN_NEUER_PERSOENLICHER_NASA_KEY_HIER' durch den Schlüssel, den du mir gerade gegeben hast.
# Das ist dein persönlicher NASA API-Schlüssel.
NASA_API_KEY = 'lvRhFuI604z72sB3RfqeQh3OF7Ar4zRt1K2nv1YE'
NASA_APOD_URL = 'https://api.nasa.gov/planetary/apod' # Endpunkt für Astronomy Picture of the Day
OPENWEATHER_API_KEY = get_env_value('OPENWEATHER_API_KEY')
OPENWEATHER_CURRENT_URL = 'https://api.openweathermap.org/data/2.5/weather'
OPENMETEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast'
OPENMETEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search'
GOOGLE_NEWS_RSS_URL = 'https://news.google.com/rss/search'

AI_NEWS_QUERIES = {
    'all': 'kuenstliche intelligenz OR artificial intelligence',
    'products': 'AI model OR AI product OR generative AI',
    'research': 'AI research OR machine learning research',
    'business': 'AI business OR AI startup OR AI investment',
    'policy': 'AI regulation OR AI policy OR AI safety',
}

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


@app.route('/digital-cafe')
def digital_cafe():
    return render_template('digital_cafe.html')


@app.route('/health')
def health_check():
    return jsonify({'status': 'ok'})


@app.route('/ai-news')
def ai_news():
    return render_template('ai_news.html')


@app.route('/api/ai-news')
def get_ai_news():
    category = request.args.get('category', 'all')
    query = AI_NEWS_QUERIES.get(category, AI_NEWS_QUERIES['all'])

    try:
        response = requests.get(
            GOOGLE_NEWS_RSS_URL,
            params={'q': query, 'hl': 'de', 'gl': 'DE', 'ceid': 'DE:de'},
            headers={'User-Agent': 'Mozilla/5.0 (compatible; MeineWebsite/1.0)'},
            timeout=10,
        )
        response.raise_for_status()
        root = ET.fromstring(response.content)
        articles = []

        for item in root.findall('./channel/item')[:18]:
            title = item.findtext('title', '').strip()
            source = item.findtext('source', 'Google News').strip()
            published = item.findtext('pubDate', '').strip()
            link = item.findtext('link', '').strip()
            description = unescape(re.sub(r'<[^>]+>', '', item.findtext('description', '')).strip())

            source_suffix = f' - {source}'
            if title.endswith(source_suffix):
                title = title[:-len(source_suffix)].strip()

            if not title or not link:
                continue

            try:
                published_at = parsedate_to_datetime(published).isoformat()
            except (TypeError, ValueError):
                published_at = None

            articles.append({
                'title': title,
                'source': source,
                'published_at': published_at,
                'link': link,
                'description': description[:260],
            })

        return jsonify({'articles': articles, 'category': category})
    except (requests.exceptions.RequestException, ET.ParseError):
        return jsonify({
            'articles': [],
            'category': category,
            'error': 'Der News-Feed ist gerade nicht erreichbar.'
        }), 502


@app.route('/api/weather')
def weather():
    units = request.args.get('units', 'metric')
    normalized_units = units if units in ('metric', 'imperial') else 'metric'

    lat = request.args.get('lat')
    lon = request.args.get('lon')
    city = request.args.get('city', 'Berlin')

    if OPENWEATHER_API_KEY:
        params = {
            'appid': OPENWEATHER_API_KEY,
            'units': normalized_units,
            'lang': 'de',
        }

        if lat and lon:
            params.update({'lat': lat, 'lon': lon})
        else:
            params['q'] = city

        try:
            response = requests.get(OPENWEATHER_CURRENT_URL, params=params, timeout=8)
            response.raise_for_status()
            data = response.json()
            weather_info = data.get('weather', [{}])[0]

            return jsonify({
                'configured': True,
                'city': data.get('name', city),
                'country': data.get('sys', {}).get('country'),
                'temperature': data.get('main', {}).get('temp'),
                'high': data.get('main', {}).get('temp_max'),
                'low': data.get('main', {}).get('temp_min'),
                'humidity': data.get('main', {}).get('humidity'),
                'description': weather_info.get('description'),
                'condition': weather_info.get('main'),
                'icon': weather_info.get('icon'),
                'provider': 'openweather',
            })
        except requests.exceptions.RequestException:
            pass

    try:
        meteo_lat = lat
        meteo_lon = lon
        place_name = city
        country = None

        if not (meteo_lat and meteo_lon):
            geo_response = requests.get(
                OPENMETEO_GEOCODING_URL,
                params={'name': city, 'count': 1, 'language': 'de', 'format': 'json'},
                timeout=8,
            )
            geo_response.raise_for_status()
            geo_data = geo_response.json()
            result = (geo_data.get('results') or [None])[0]
            if not result:
                return jsonify({'configured': True, 'error': 'Ort wurde nicht gefunden.'}), 404

            meteo_lat = result.get('latitude')
            meteo_lon = result.get('longitude')
            place_name = result.get('name') or city
            country = result.get('country_code')

        forecast_response = requests.get(
            OPENMETEO_FORECAST_URL,
            params={
                'latitude': meteo_lat,
                'longitude': meteo_lon,
                'current': 'temperature_2m,relative_humidity_2m,weather_code',
                'daily': 'temperature_2m_max,temperature_2m_min,weather_code',
                'forecast_days': 1,
                'timezone': 'auto',
                'temperature_unit': 'fahrenheit' if normalized_units == 'imperial' else 'celsius',
            },
            timeout=8,
        )
        forecast_response.raise_for_status()
        data = forecast_response.json()
        current = data.get('current', {})
        daily = data.get('daily', {})
        condition = weather_code_to_condition(current.get('weather_code'))

        return jsonify({
            'configured': True,
            'city': place_name,
            'country': country,
            'temperature': current.get('temperature_2m'),
            'high': first_or_none(daily.get('temperature_2m_max')),
            'low': first_or_none(daily.get('temperature_2m_min')),
            'humidity': current.get('relative_humidity_2m'),
            'description': condition['description'],
            'condition': condition['condition'],
            'icon': condition['icon'],
            'provider': 'openmeteo',
        })
    except requests.exceptions.RequestException:
        return jsonify({
            'configured': True,
            'error': 'Wetter konnte gerade nicht geladen werden.',
        }), 502


def first_or_none(values):
    return values[0] if isinstance(values, list) and values else None


def weather_code_to_condition(code):
    try:
        code = int(code)
    except (TypeError, ValueError):
        code = 0

    weather_codes = {
        0: ('Klar', 'Clear', '01d'),
        1: ('Ueberwiegend klar', 'Clear', '02d'),
        2: ('Teilweise bewoelkt', 'Clouds', '03d'),
        3: ('Bedeckt', 'Clouds', '04d'),
        45: ('Nebel', 'Fog', '50d'),
        48: ('Reifnebel', 'Fog', '50d'),
        51: ('Leichter Nieselregen', 'Drizzle', '09d'),
        53: ('Nieselregen', 'Drizzle', '09d'),
        55: ('Starker Nieselregen', 'Drizzle', '09d'),
        56: ('Gefrierender Nieselregen', 'Drizzle', '09d'),
        57: ('Starker gefrierender Nieselregen', 'Drizzle', '09d'),
        61: ('Leichter Regen', 'Rain', '10d'),
        63: ('Regen', 'Rain', '10d'),
        65: ('Starker Regen', 'Rain', '10d'),
        66: ('Gefrierender Regen', 'Rain', '10d'),
        67: ('Starker gefrierender Regen', 'Rain', '10d'),
        71: ('Leichter Schneefall', 'Snow', '13d'),
        73: ('Schneefall', 'Snow', '13d'),
        75: ('Starker Schneefall', 'Snow', '13d'),
        77: ('Schneekoerner', 'Snow', '13d'),
        80: ('Leichte Regenschauer', 'Rain', '09d'),
        81: ('Regenschauer', 'Rain', '09d'),
        82: ('Starke Regenschauer', 'Rain', '09d'),
        85: ('Leichte Schneeschauer', 'Snow', '13d'),
        86: ('Starke Schneeschauer', 'Snow', '13d'),
        95: ('Gewitter', 'Thunderstorm', '11d'),
        96: ('Gewitter mit Hagel', 'Thunderstorm', '11d'),
        99: ('Starkes Gewitter mit Hagel', 'Thunderstorm', '11d'),
    }
    description, condition, icon = weather_codes.get(code, weather_codes[0])
    return {'description': description, 'condition': condition, 'icon': icon}


@app.route('/digital-cafe-sw.js')
def digital_cafe_service_worker():
    response = send_from_directory('static', 'digital-cafe-sw.js')
    response.headers['Service-Worker-Allowed'] = '/'
    return response


if __name__ == '__main__':
    app.run(debug=True)
