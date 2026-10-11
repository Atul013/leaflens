FROM node:22-slim AS ui
WORKDIR /ui
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir torch==2.11.0 torchvision==0.26.0 --index-url https://download.pytorch.org/whl/cpu && pip install --no-cache-dir -r requirements.txt
COPY backend/ backend/
COPY ml/ ml/
COPY docs/results/ docs/results/
COPY --from=ui /ui/dist frontend/dist
COPY --from=ui /ui/public/samples frontend/public/samples
EXPOSE 8000
CMD ["uvicorn", "backend.app:app", "--host", "0.0.0.0", "--port", "8000"]
