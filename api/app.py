from googleapiclient.discovery import build
import re
import emoji
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from flask_socketio import SocketIO, emit
from flask import Flask, request, render_template, jsonify ,make_response
from flask_cors import CORS, cross_origin
import os
from dotenv import load_dotenv


app = Flask(__name__)
cors = CORS(app)
app.config['SECRET_KEY'] = 'secret!'




load_dotenv()



def sentiment_scores(comment, polarity):

  sentiment_object = SentimentIntensityAnalyzer()

  sentiment_dict = sentiment_object.polarity_scores(comment)
  polarity.append(sentiment_dict['compound'])

  return polarity




@app.route('/get-analyzed-comment', methods=['POST'])
@cross_origin()


def analyzed():

    print("Hello, world!")
    API_KEY = os.getenv("API_KEY")

    youtube = build('youtube', 'v3', developerKey=API_KEY)

    req_data = request.get_json()  # Move this line here
    response_data = {}
    try:
        if req_data:  # Check if request data exists
            print("Received POST request")
            regular_pattern = re.compile(r'(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]+)(?:&\S+)?')
            shorts_pattern = re.compile(r'(?:https?://)?(?:www\.)?youtube\.com/shorts/([\w-]+)(?:&\S+)?')
            videoUrl = req_data.get('videoUrl')
            user = req_data.get('userName')


            match_regular = regular_pattern.match(videoUrl)
            match_shorts = shorts_pattern.match(videoUrl)
            if match_regular:
                video_id= match_regular.group(1)
            elif match_shorts:
                video_id= match_shorts.group(1)
            else:
                video_id= "invalid"

            response_data['videoId'] = video_id

            video_response = youtube.videos().list(
                part='snippet',
                id=video_id
            ).execute()

            video_snippet = video_response['items'][0]['snippet']
            uploader_channel_id = video_snippet['channelId']

            response_data['channelId'] = uploader_channel_id
            response_data['status'] = "Fetching comments..."

            comments = []
            nextPageToken = None
            while len(comments) < 600:
                comment = youtube.commentThreads().list(
                    part='snippet',
                    videoId=video_id,
                    maxResults=100,  
                    pageToken=nextPageToken
                )
                response = comment.execute()
                for item in response['items']:
                    comment = item['snippet']['topLevelComment']['snippet']
          
                    if comment['authorChannelId']['value'] != uploader_channel_id:
                        comments.append(comment['textDisplay'])
                nextPageToken = response.get('nextPageToken')

                if not nextPageToken:
                    break
            hyperlink_pattern = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')

            threshold_ratio = 0.65

            relevant_comments = []


            for comment_text in comments:

                comment_text = comment_text.lower().strip()

                emojis = emoji.emoji_count(comment_text)

                # Count text characters (excluding spaces)
                text_characters = len(re.sub(r'\s', '', comment_text))

                if (any(char.isalnum() for char in comment_text)) and not hyperlink_pattern.search(comment_text):
                    if emojis == 0 or (text_characters / (text_characters + emojis)) > threshold_ratio:
                        relevant_comments.append(comment_text)

            with open(f"./comment/ytcomments_{user}.txt", 'w', encoding='utf-8') as f:
                for comment in relevant_comments:
                    f.write(str(comment) + "\n")

            response_data['status'] = "Comments stored successfully!"

            polarity = []
            positive_comments = []
            negative_comments = []
            neutral_comments = []

            with open(f"./comment/ytcomments_{user}.txt", 'r', encoding='utf-8') as f:
                response_data['status'] = "Reading Comments..."
                comments = f.readlines()

            response_data['status'] = "Analysing Comments..."
            for items in comments:
                polarity = sentiment_scores(items, polarity)

                if polarity[-1] > 0.05:
                    positive_comments.append(items)
                elif polarity[-1] < -0.05:
                    negative_comments.append(items)
                else:
                    neutral_comments.append(items)

            avg_polarity = sum(polarity) / len(polarity)
            response_data['averagePolarity'] = avg_polarity
            
            if avg_polarity > 0.05:
                response_data['status'] = "The Video has got a Positive response"
            elif avg_polarity < -0.05:
                response_data['status'] = "The Video has got a Negative response"
            else:
                response_data['status'] = "The Video has got a Negative response"

            positive_count = len(positive_comments)
            negative_count = len(negative_comments)
            neutral_count = len(neutral_comments)

            response_data['positiveComments'] = positive_count
            response_data['negativeComments'] = negative_count
            response_data['neutralComments'] = neutral_count
            return jsonify(response_data)

      
    except Exception as e:
        print(e)
        response_data['Error'] = "Invalid videoId or username"
        return jsonify(response_data)
if __name__ == '__main__':

    app.run(debug=True)
    socketio.run(app)