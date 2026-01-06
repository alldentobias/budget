FROM denoland/deno:2.0.0

WORKDIR /app

# Copy dependency files
COPY deno.json deno.lock* ./

# Cache dependencies
RUN deno cache --reload src/main.ts || true

# Copy source code
COPY . .

# Cache the main application
RUN deno cache src/main.ts

EXPOSE 8000

CMD ["deno", "run", "--allow-net", "--allow-env", "--allow-read", "--allow-write", "src/main.ts"]


