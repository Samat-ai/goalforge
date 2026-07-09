FROM python:3.12-slim

RUN groupadd --system appuser && useradd --system --gid appuser appuser

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# --proxy-headers so request.client reflects the real client IP from Caddy's
# X-Forwarded-For (rate limiting keys on it). Safe only because the container
# port is not internet-reachable (loopback-only binding in docker-compose.yml).
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--proxy-headers", "--forwarded-allow-ips", "*"]
