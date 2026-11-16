"""Whop API through the official whop-sdk package (base URL https://api.whop.com/api/v1)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from .config import Config


def available(cfg: Config) -> bool:
    return bool(cfg.env("WHOP_API_KEY"))


def _client(cfg: Config):
    from whop_sdk import Whop

    return Whop(token=cfg.env("WHOP_API_KEY"))


def list_products(cfg: Config) -> list[dict]:
    return [{"id": p.id, "title": p.title, "route": p.route, "visibility": p.visibility}
            for p in _client(cfg).products.list()]


def _money(m) -> float:
    try:
        return float(m.amount) if m is not None else 0.0
    except (TypeError, ValueError):
        return 0.0


def list_paid_payments(cfg: Config, since: datetime, until: datetime | None = None) -> list[dict]:
    product_keys = {p["whop_product_id"]: k for k, p in cfg.products.items() if p.get("whop_product_id")}
    out = []
    for pay in _client(cfg).payments.list(created_after=since, created_before=until, statuses=["paid"], first=100):
        meta = pay.metadata or {}
        out.append({
            "payment_id": pay.id, "created_at": pay.created_at, "product_id": pay.product_id,
            "product_key": product_keys.get(pay.product_id or ""),
            "amount_usd": _money(pay.usd_total or pay.total), "promo_code_id": pay.promo_code_id,
            "checkout_origin": pay.checkout_origin,
            "utm_source": meta.get("utm_source"), "utm_campaign": meta.get("utm_campaign"),
        })
    return out


def create_single_use_code(cfg: Config, product_key: str, percent_off: float = 20,
                           valid_days: int = 14) -> tuple[str, str]:
    """A one-person discount code (stock 1, one per customer). Returns (code, whop id)."""
    product = cfg.products[product_key]
    code = f"SEM{secrets.token_hex(3).upper()}"
    kwargs = dict(
        account_id=cfg.env("WHOP_COMPANY_ID"), amount_off=percent_off, base_currency="usd", code=code,
        new_users_only=False, promo_duration_months=1, promo_type="percentage", stock=1,
        one_per_customer=True,
        expires_at=(datetime.now(timezone.utc) + timedelta(days=valid_days)).isoformat(timespec="seconds"),
    )
    if product.get("whop_product_id"):
        kwargs["product_id"] = product["whop_product_id"]
    promo = _client(cfg).promo_codes.create(**kwargs)
    return code, promo.id
