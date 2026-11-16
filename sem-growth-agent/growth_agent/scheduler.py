"""Keeps the agent running: daily pipeline in the morning, publisher every 5 minutes,
analyst at 9 PM (times in settings.yaml timezone)."""
from __future__ import annotations

import logging

from apscheduler.schedulers.blocking import BlockingScheduler

from . import db, publisher
from .agents import analyst
from .config import Config
from .graph import run_daily

log = logging.getLogger(__name__)


def start(cfg: Config, llm, daily_at: str = "08:00") -> None:
    sched = BlockingScheduler(timezone=cfg.tz)
    dh, dm = map(int, daily_at.split(":"))
    ah, am = map(int, cfg["analyst"]["run_at"].split(":"))

    def daily():
        with db.connect() as conn:
            log.info("daily run: %s", run_daily(cfg, conn, llm))

    def publish():
        with db.connect() as conn:
            result = publisher.tick(cfg, conn)
            if result:
                log.info("publisher: %s", result)

    def nightly():
        with db.connect() as conn:
            log.info("analyst: %s", analyst.run(cfg, conn))

    sched.add_job(daily, "cron", hour=dh, minute=dm, id="daily", misfire_grace_time=3600)
    sched.add_job(publish, "interval", minutes=5, jitter=60, id="publish")
    sched.add_job(nightly, "cron", hour=ah, minute=am, id="analyst", misfire_grace_time=3600)
    log.info("scheduler started (%s): daily %s, analyst %s, publisher every 5 min", cfg.tz, daily_at, cfg["analyst"]["run_at"])
    sched.start()
