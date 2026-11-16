"""The daily pipeline as a LangGraph graph: Scout -> Engager -> Creator.
The Analyst runs on its own at night (see scheduler.py)."""
from __future__ import annotations

from typing import TypedDict

from langgraph.graph import END, START, StateGraph

from .agents import creator, engager, scout
from .config import Config


class DailyState(TypedDict, total=False):
    scout: dict
    engager: dict
    creator: dict


def build_daily_graph(cfg: Config, conn, llm):
    g = StateGraph(DailyState)
    g.add_node("scout", lambda s: {"scout": scout.run(cfg, conn, llm)})
    g.add_node("engager", lambda s: {"engager": engager.run(cfg, conn, llm)})
    g.add_node("creator", lambda s: {"creator": creator.run(cfg, conn, llm)})
    g.add_edge(START, "scout")
    g.add_edge("scout", "engager")
    g.add_edge("engager", "creator")
    g.add_edge("creator", END)
    return g.compile()


def run_daily(cfg: Config, conn, llm) -> dict:
    return build_daily_graph(cfg, conn, llm).invoke({})
