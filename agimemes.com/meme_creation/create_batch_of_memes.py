from meme_creation import secrets
from meme_creation import personality_prompts
from meme_creation import meme_variants_config
from meme_creation import llm_service
import requests


def caption_meme(template_id, username, password, text0, text1, text2, font=None):
    url = "https://api.imgflip.com/caption_image"
    payload = {
        'template_id': template_id,
        'username': username,
        'password': password,
        'boxes[0][text]': text0,
        'boxes[1][text]': text1,
        'boxes[2][text]': text2,
    }
    if font:
        payload['font'] = font

    response = requests.post(url, data=payload)
    if response.status_code == 200:
        result = response.json()
        if result['success']:
            return result['data']['url']
        else:
            return "Error: " + result['error_message']
    else:
        return "Failed to connect to the API."

def create_batch_of_memes(recipe):
  recipe_news_source = recipe['news_source']
  if recipe_news_source == "news_api":
    from newsapi import NewsApiClient
    # Initialize the News API client with your API key
    news_source_api = NewsApiClient(api_key=secrets.NEWS_API_KEY)
  else:
      return

  top_headlines = newsapi.get_top_headlines(language='en')

  articles = {}
  
  # Print the headlines
  for article in top_headlines['articles']:
      articles[article['title']] = article['url']

  recipe_llm = recipe['llm']
  recipe_personality_prompt = recipe['personality_prompt']

  captioned_meme_urls = []
  for healine, url in articles.items():
    for meme in meme_variants:  # one meme per article, for now
      article_url_content = requests.get(url).content
      caption_list = llm_service.prompt(headline, article_url_contents, meme, recipe_personality_prompt, recipe_llm)
      captioned_meme_url = caption_meme(meme['id'], secrets.MEME_CREATOR_API_USERNAME, secrets.MEME_CREATOR_API_PASSWORD, *caption_list)
      captioned_meme_urls.append(captioned_meme_url)
  print(captioned_meme_urls)
