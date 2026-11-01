#!/usr/bin/env bash
# Concatenate recorder/out/*.webm into demo-live.mp4 (1080p, silent, no captions).
set -euo pipefail
cd "$(dirname "$0")/recorder/out"
rm -f list.txt
for f in $(ls 0*.webm | sort); do ffmpeg -nostdin -loglevel error -y -i "$f" -vf "setpts=PTS/${SPEED:-1},fps=30,scale=1920:1080" -an -c:v libx264 -preset veryfast -crf 19 "${f%.webm}.mp4"; echo "file '${f%.webm}.mp4'" >> list.txt; done
ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i list.txt -c copy ../../demo-live.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 ../../demo-live.mp4
