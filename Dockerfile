# syntax=docker/dockerfile:1
FROM python:3.12-slim AS runtime

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Pillow deps (jpeg/webp) + tini for sane signal handling
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    libwebp7 \
    zlib1g \
    tini \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY backend/requirements.txt /app/requirements.txt
RUN pip install -r /app/requirements.txt

COPY backend /app/backend

EXPOSE 8080

ENTRYPOINT ["/usr/bin/tini","--"]
CMD ["uvicorn","backend.main:app","--host","0.0.0.0","--port","8080"]
