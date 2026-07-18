# Hujra backend: FastAPI + Whisper ASR. Pair with docker-compose.yml (Postgres).
FROM python:3.12-slim

# ffmpeg decodes uploaded recordings (m4a/aac/wav)
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/hujra

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app

# The ASR model (~150MB) downloads to this volume on first start, then is
# cached; set HF_HUB_OFFLINE=1 after the first successful boot if desired.
ENV HF_HOME=/srv/hujra/.hf-cache
VOLUME /srv/hujra/.hf-cache

EXPOSE 8000
CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
