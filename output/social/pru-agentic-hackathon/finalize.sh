#!/usr/bin/env bash
# Mux the rendered picture with the soundtrack into the two delivery files.
# usage: ./finalize.sh <build-dir>   (expects video-h.mp4, video-v.mp4, soundtrack.wav)
set -euo pipefail
B=${1:-build}
D=$(cd "$(dirname "$0")" && pwd)
enc() {
  ffmpeg -y -loglevel error -i "$B/$1" -i "$B/soundtrack.wav" \
    -map 0:v -map 1:a -c:v libx264 -profile:v high -preset slow -crf 19 \
    -maxrate 8M -bufsize 16M -pix_fmt yuv420p -colorspace bt709 -color_primaries bt709 -color_trc bt709 \
    -af "loudnorm=I=-14:TP=-1.5:LRA=11" -c:a aac -b:a 256k -ar 48000 \
    -movflags +faststart -shortest "$D/$2"
  echo "$D/$2"
}
enc video-h.mp4 PRU-Agentic-Hackathon-Partner-X-16x9.mp4
enc video-v.mp4 PRU-Agentic-Hackathon-Partner-Story-9x16.mp4
