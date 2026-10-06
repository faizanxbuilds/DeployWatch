"""DeployWatch — zero-touch GitOps deployment pipeline with live observability.

Serves a status dashboard at `/` and a small JSON API used by the
Kubernetes probes (`/health`), the dashboard (`/api/status`) and
integrations (`/info`, `/metrics` via prometheus_flask_exporter).
"""

import time

from flask import Flask, jsonify, render_template
from flask_cors import CORS
from prometheus_flask_exporter import PrometheusMetrics

APP_NAME = "DeployWatch"
APP_VERSION = "4.0.0"
APP_DESCRIPTION = "Zero-touch GitOps deployment pipeline with live observability"
TECH_STACK = ["Flask", "Kubernetes", "ArgoCD", "Prometheus", "Grafana"]

START_TIME = time.monotonic()

app = Flask(__name__)
# Let the public project page (faizanxbuilds.github.io, a different origin)
# query the JSON API directly from visitors' browsers. Tight origin list,
# not a wildcard — the API stays closed to everyone else.
CORS(app, origins=["https://faizanxbuilds.github.io"])
metrics = PrometheusMetrics(app)


def _uptime_seconds() -> int:
    """Seconds since the process started (monotonic, unaffected by clock changes)."""
    return int(time.monotonic() - START_TIME)


@app.route("/")
def dashboard():
    """Render the DeployWatch status dashboard."""
    return render_template(
        "dashboard.html",
        app_name=APP_NAME,
        version=APP_VERSION,
        uptime_seconds=_uptime_seconds(),
    )


@app.route("/health")
def health():
    """Liveness/readiness probe endpoint (used by the Helm chart)."""
    return jsonify({"status": "healthy"})


@app.route("/info")
def info():
    """Static metadata about this deployment."""
    return jsonify(
        {
            "app": APP_NAME,
            "version": APP_VERSION,
            "description": APP_DESCRIPTION,
            "uptime_seconds": _uptime_seconds(),
            "tech_stack": TECH_STACK,
        }
    )


@app.route("/api/status")
def api_status():
    """Lightweight status payload polled by the dashboard."""
    return jsonify(
        {
            "app": APP_NAME,
            "version": APP_VERSION,
            "status": "running",
            "uptime_seconds": _uptime_seconds(),
        }
    )


@app.errorhandler(404)
def not_found(_error):
    return render_template("404.html", app_name=APP_NAME), 404


if __name__ == "__main__":
    # Local development only — production runs under gunicorn (see Dockerfile).
    app.run(host="0.0.0.0", port=5000)
