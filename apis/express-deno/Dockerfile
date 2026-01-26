FROM denoland/deno:alpine

WORKDIR /app

COPY deno.json ./
COPY index.ts ./

# Cache dependencies
RUN deno cache index.ts

EXPOSE 3000

CMD ["deno", "task", "start"]
