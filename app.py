from googleapiclient.discovery import build
import re
import emoji
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS, cross_origin
import os
from dotenv import load_dotenv

app = Flask(__name__)
cors = CORS(app)
app.config['SECRET_KEY'] = 'secret!'
load_dotenv()

API_KEY = os.getenv("API_KEY")
youtube = build('youtube', 'v3', developerKey=API_KEY)

def sentiment_scores(comment, polarity):
    sentiment_object = SentimentIntensityAnalyzer()
    sentiment_dict = sentiment_object.polarity_scores(comment)
    polarity.append(sentiment_dict['compound'])
    return polarity

def fetch_comments(video_id, uploader_channel_id):
    comments = []
    nextPageToken = None
    while len(comments) < 600:
        comment_request = youtube.commentThreads().list(
            part='snippet',
            videoId=video_id,
            maxResults=100,
            pageToken=nextPageToken
        )
        response = comment_request.execute()
        for item in response['items']:
            comment = item['snippet']['topLevelComment']['snippet']
            if comment['authorChannelId']['value'] != uploader_channel_id:
                comments.append(comment['textDisplay'])
        nextPageToken = response.get('nextPageToken')
        if not nextPageToken:
            break
    return comments

def filter_comments(comments):
    hyperlink_pattern = re.compile(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+')
    threshold_ratio = 0.65
    relevant_comments = []
    for comment_text in comments:
        comment_text = comment_text.lower().strip()
        emojis = emoji.emoji_count(comment_text)
        text_characters = len(re.sub(r'\s', '', comment_text))
        if (any(char.isalnum() for char in comment_text)) and not hyperlink_pattern.search(comment_text):
            if emojis == 0 or (text_characters / (text_characters + emojis)) > threshold_ratio:
                relevant_comments.append(comment_text)
    return relevant_comments

def analyze_comments(comments):
    polarity = []
    positive_comments = []
    negative_comments = []
    neutral_comments = []
    for comment in comments:
        polarity = sentiment_scores(comment, polarity)
        if polarity[-1] > 0.05:
            positive_comments.append(comment)
        elif polarity[-1] < -0.05:
            negative_comments.append(comment)
        else:
            neutral_comments.append(comment)
    return polarity, positive_comments, negative_comments, neutral_comments

@app.route('/get-analyzed-comment', methods=['POST'])
@cross_origin()
def analyzed():
    req_data = request.get_json()
    response_data = {}
    try:
        if req_data:
            video_url = req_data.get('videoUrl')
            user = req_data.get('userName')

            regular_pattern = re.compile(r'(?:https?://)?(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)([\w-]+)(?:&\S+)?')
            shorts_pattern = re.compile(r'(?:https?://)?(?:www\.)?youtube\.com/shorts/([\w-]+)(?:&\S+)?')

            match_regular = regular_pattern.match(video_url)
            match_shorts = shorts_pattern.match(video_url)
            if match_regular:
                video_id = match_regular.group(1)
            elif match_shorts:
                video_id = match_shorts.group(1)
            else:
                video_id = "invalid"

            response_data['videoId'] = video_id
            if video_id == "invalid":
                raise ValueError("Invalid video URL")

            @stream_with_context
            def generate_status_updates():
                try:
                    with app.app_context():
                        video_response = youtube.videos().list(
                            part='snippet',
                            id=video_id
                        ).execute()

                        video_snippet = video_response['items'][0]['snippet']
                        uploader_channel_id = video_snippet['channelId']
                        response_data['channelId'] = uploader_channel_id
                        yield "data: Fetching comments...\n\n"

                        comments = fetch_comments(video_id, uploader_channel_id)
                        yield f"data: Fetched {len(comments)} comments\n\n"

                        relevant_comments = filter_comments(comments)
                        if not relevant_comments:
                            raise ValueError("No relevant comments found")

                        with open(f"./comment/ytcomments_{user}.txt", 'w', encoding='utf-8') as f:
                            for comment in relevant_comments:
                                f.write(comment + "\n")

                        yield "data: Comments stored successfully!\n\n"
                        yield "data: Analyzing Comments...\n\n"

                        polarity, positive_comments, negative_comments, neutral_comments = analyze_comments(relevant_comments)

                        if len(polarity) == 0:
                            raise ValueError("No comments to analyze")

                        avg_polarity = sum(polarity) / len(polarity)
                        response_data['averagePolarity'] = avg_polarity

                        if avg_polarity > 0.05:
                            response_data['status'] = "The Video has a Positive response"
                        elif avg_polarity < -0.05:
                            response_data['status'] = "The Video has a Negative response"
                        else:
                            response_data['status'] = "The Video has a Neutral response"

                        response_data['positiveComments'] = len(positive_comments)
                        response_data['negativeComments'] = len(negative_comments)
                        response_data['neutralComments'] = len(neutral_comments)
                        
                        yield "data: Analysis complete\n\n"
                        yield f"data: {jsonify(response_data).get_data(as_text=True)}\n\n"
                except Exception as e:
                    yield f"data: Error: {str(e)}\n\n"

            return Response(generate_status_updates(), mimetype='text/event-stream')

    except Exception as e:
        response_data['Error'] = str(e)
        return jsonify(response_data)

# if __name__ == '__main__':
#     app.run(debug=True)
