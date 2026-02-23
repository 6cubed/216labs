from flask import Flask, render_template, jsonify
import os

app = Flask(__name__)
app.debug = os.getenv("FLASK_DEBUG", "0") == "1"

@app.route('/tasks/meme_creation')
def meme_creation():
    return 'creating memes'

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/config.json')
def config():
    return jsonify(
      {
        "news_api_key": os.getenv("NEWS_API_KEY"),
        "imgflip_username": os.getenv("IMG_FLIP_USERNAME"),
        "imgflip_pasword": os.getenv("IMG_FLIP_PASSWORD"),
      })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', 5000)))
