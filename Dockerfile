# syntax=docker/dockerfile:1

FROM rust:1-bookworm AS builder

WORKDIR /app

# The server binary is Rust-only at runtime, but it currently lives in the Tauri
# package, so Linux needs the native libraries required to compile that package.
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libglib2.0-dev \
    libgtk-3-dev \
    libwebkit2gtk-4.1-dev \
    libayatana-appindicator3-dev \
    librsvg2-dev \
    libsoup-3.0-dev \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY src-tauri/Cargo.toml src-tauri/Cargo.lock ./src-tauri/
COPY src ./src
COPY src-tauri/crates ./src-tauri/crates
COPY src-tauri/src ./src-tauri/src
COPY src-tauri/build.rs ./src-tauri/build.rs
COPY src-tauri/tauri.conf.json ./src-tauri/tauri.conf.json
COPY src-tauri/capabilities ./src-tauri/capabilities
COPY src-tauri/icons ./src-tauri/icons
COPY src-tauri/resources ./src-tauri/resources

RUN cargo build --manifest-path src-tauri/Cargo.toml --release --bin marinara-server

FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libgtk-3-0 \
    libwebkit2gtk-4.1-0 \
    libayatana-appindicator3-1 \
    librsvg2-2 \
    libsoup-3.0-0 \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/src-tauri/target/release/marinara-server /usr/local/bin/marinara-server
COPY --from=builder /app/src-tauri/resources /app/src-tauri/resources

ENV MARINARA_SERVER_ADDR=0.0.0.0:8787
ENV MARINARA_DATA_DIR=/data

EXPOSE 8787
VOLUME ["/data"]

CMD ["marinara-server"]
