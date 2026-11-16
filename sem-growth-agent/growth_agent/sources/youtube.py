"""YouTube Data API v3: public comments on SmartPLS tutorials + comments on the owner's channel.

Reading uses YOUTUBE_API_KEY. Posting a reply needs OAuth: run
`python -m growth_agent auth-youtube` once to create youtube_token.json.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from ..config import ROOT, Config

PLATFORM = "youtube"
SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]
TOKEN_FILE = ROOT / "youtube_token.json"
HELP_WORDS = ("?", "help", "how", "error", "why", "stuck", "supervisor", "viva", "reject")


def available(cfg: Config) -> bool:
    return bool(cfg.env("YOUTUBE_API_KEY"))


def can_post(cfg: Config) -> bool:
    return TOKEN_FILE.exists()


def _reader(cfg: Config):
    from googleapiclient.discovery import build

    return build("youtube", "v3", developerKey=cfg.env("YOUTUBE_API_KEY"), cache_discovery=False)


def _writer():
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def authorize(cfg: Config) -> None:
    from google_auth_oauthlib.flow import InstalledAppFlow

    flow = InstalledAppFlow.from_client_secrets_file(
        str(ROOT / cfg.env("YOUTUBE_CLIENT_SECRETS_FILE", "client_secret.json")), SCOPES)
    creds = flow.run_local_server(port=0)
    TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")


def _thread_to_lead(thread: dict, source: str, own: bool) -> dict:
    top = thread["snippet"]["topLevelComment"]
    sn = top["snippet"]
    video = thread["snippet"]["videoId"]
    return {
        "platform": PLATFORM, "source": source, "external_id": thread["id"],
        "url": f"https://www.youtube.com/watch?v={video}&lc={top['id']}",
        "author": sn.get("authorDisplayName"), "title": None, "text": sn.get("textDisplay", ""),
        "posted_at": sn.get("publishedAt"), "is_reply_to_us": 0, "is_own_channel": int(own),
    }


def fetch(cfg: Config) -> list[dict]:
    s = cfg["scout"]
    yt = _reader(cfg)
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=s["lookback_hours"])).isoformat()
    leads: list[dict] = []

    def keep(lead):
        return lead["posted_at"] >= cutoff and any(w in lead["text"].lower() for w in HELP_WORDS)

    channel = cfg.env("YOUTUBE_CHANNEL_ID")
    if channel:  # comments on the owner's own videos
        res = yt.commentThreads().list(part="snippet", allThreadsRelatedToChannelId=channel, order="time",
                                       maxResults=50, textFormat="plainText").execute()
        leads += [lead for t in res.get("items", []) if keep(lead := _thread_to_lead(t, "youtube:own", True))]

    for q in s["youtube_queries"]:
        found = yt.search().list(part="id", q=q, type="video", order="relevance",
                                 maxResults=s["youtube_videos_per_query"]).execute()
        for item in found.get("items", []):
            vid = item["id"]["videoId"]
            try:
                res = yt.commentThreads().list(part="snippet", videoId=vid, order="time", maxResults=50,
                                               textFormat="plainText").execute()
            except Exception:  # comments disabled on this video
                continue
            leads += [lead for t in res.get("items", []) if keep(lead := _thread_to_lead(t, f"youtube:{vid}", False))]
    return leads[: s["max_leads_per_source"] * 4]


def post_reply(cfg: Config, target_external_id: str, body: str, target_url: str) -> tuple[str, str]:
    yt = _writer()
    res = yt.comments().insert(part="snippet", body={
        "snippet": {"parentId": target_external_id, "textOriginal": body}}).execute()
    base = target_url.split("&lc=")[0]
    return res["id"], f"{base}&lc={res['id']}"
