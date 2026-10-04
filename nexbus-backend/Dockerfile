FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# Cloud Run supplies PORT and the service account; credentials and secrets come from env / Secret Manager,
# and Cloud Scheduler replaces the built-in timers.
ENV ENABLE_JOBS=false
EXPOSE 8080
CMD ["node", "index.js"]
