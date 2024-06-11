import re
import emoji
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv
from pydantic import BaseModel
from googleapiclient.discovery import build

app = FastAPI()
load_dotenv()
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
API_KEY = os.getenv("API_KEY")
youtube = build('youtube', 'v3', developerKey=API_KEY)
response_data = {}

class CommentRequest(BaseModel):
    videoUrl: str
    userName: str

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

@app.post('/get-analyzed-comment')
async def analyzed(comment_request: CommentRequest, background_tasks: BackgroundTasks):
    try:
        video_url = comment_request.videoUrl
        user = comment_request.userName

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
            raise HTTPException(status_code=400, detail="Invalid video URL")

        def process_comments():
            video_response = youtube.videos().list(
                part='snippet',
                id=video_id
            ).execute()

            video_snippet = video_response['items'][0]['snippet']
            uploader_channel_id = video_snippet['channelId']
            response_data['channelId'] = uploader_channel_id

            comments = fetch_comments(video_id, uploader_channel_id)

            relevant_comments = filter_comments(comments)
            if not relevant_comments:
                raise HTTPException(status_code=404, detail="No relevant comments found")

            with open(f"./comment/ytcomments_{user}.txt", 'w', encoding='utf-8') as f:
                for comment in relevant_comments:
                    f.write(comment + "\n")

            polarity, positive_comments, negative_comments, neutral_comments = analyze_comments(relevant_comments)

            if len(polarity) == 0:
                raise HTTPException(status_code=404, detail="No comments to analyze")

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
            # response_data['positiveCommentsList'] = positive_comments
            # response_data['negativeCommentsList'] = negative_comments
            # response_data['neutralCommentsList'] = neutral_comments
            print("Positive comments",len(positive_comments),"Negative comments",len(negative_comments),"Neutral comments",len(neutral_comments))
        background_tasks.add_task(process_comments)
        return response_data

    except Exception as e:
        print(e)
        return {"Error": str(e)}

# if __name__ == '__main__':
#     import uvicorn
#     uvicorn.run(app, host="0.0.0.0", port=8000)
