# Stage 1 — install dependencies
FROM python:3.11-slim AS builder

WORKDIR /app

COPY src/requirements.txt .

RUN pip install --no-cache-dir --user -r requirements.txt

# Stage 2 — final lightweight image
FROM python:3.11-slim

WORKDIR /app

# Copy only the installed packages from the builder stage
COPY --from=builder /root/.local /root/.local

# Copy the application code
COPY src/ .

ENV PATH=/root/.local/bin:$PATH
ENV PYTHONUNBUFFERED=1

EXPOSE 5000

# Serve with gunicorn (production WSGI server) instead of Flask's dev server
# ${PORT:-5000} honors the $PORT convention on PaaS hosts (Render) while
# keeping port 5000 for local Docker / Minikube runs.
CMD ["sh", "-c", "gunicorn --bind 0.0.0.0:${PORT:-5000} --workers 2 --timeout 60 app:app"]
