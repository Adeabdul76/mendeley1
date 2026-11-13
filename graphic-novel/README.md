# Personalised AI Graphic-Novel Generator

Turns a customer's photos + a short brief into a print-ready 32-page comic book. See `CLAUDE.md` for the full spec and `docs/STATUS.md` for progress.

This folder is self-contained so it can be moved into its own repository:

```bash
git subtree split --prefix=graphic-novel -b graphic-novel-only
```

## Run the tests

```bash
pip install -r apps/worker/requirements.txt
python -m pytest apps/worker -q
```
