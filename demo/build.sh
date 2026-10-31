#!/usr/bin/env bash
# Assemble demo.mp4 from shots/*.png + vo-*.mp3 (one scene per narration segment, soft zoom, caption).
set -euo pipefail
cd "$(dirname "$0")"
FONT="/System/Library/Fonts/Supplemental/Arial Bold.ttf"; [ -f "$FONT" ] || FONT="/System/Library/Fonts/Helvetica.ttc"
rm -rf parts && mkdir -p parts
i=0
python3 - <<'PY' > scenes.txt
import json
for s in json.load(open('script.json')): print(s['id'], s['shot'], s['text'].replace("'", "’"))
PY
while read -r id shot text; do
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "vo-$id.mp3")
  dur=$(python3 -c "print(round(float('$dur')+0.35,2))")
  frames=$(python3 -c "print(int(float('$dur')*30))")
  cap=$(python3 -c "import textwrap,sys; print('\\n'.join(textwrap.wrap(sys.argv[1], 70)))" "$text")
  printf '%s' "$cap" > "parts/cap-$id.txt"
  ffmpeg -nostdin -loglevel error -y -loop 1 -framerate 30 -i "shots/$shot.png" -loop 1 -framerate 30 -i "caps/$id.png" -i "vo-$id.mp3" \
    -filter_complex "[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080,zoompan=z='min(zoom+0.0006,1.08)':d=$frames:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=1920x1080:fps=30[bg];[1:v]format=rgba,colorchannelmixer=aa=0.88[cap];[bg][cap]overlay=0:930:shortest=1,format=yuv420p[v]" \
    -map "[v]" -map 2:a -t "$dur" -c:v libx264 -preset veryfast -crf 20 -c:a aac -b:a 160k -ar 44100 -shortest "parts/$id.mp4"
  echo "file '$id.mp4'" >> parts/list.txt
  i=$((i+1))
done < scenes.txt
ffmpeg -nostdin -loglevel error -y -f concat -safe 0 -i parts/list.txt -c copy demo-raw.mp4
# title card + end card baked by caption; final re-encode for clean concat
ffmpeg -nostdin -loglevel error -y -i demo-raw.mp4 -c:v libx264 -crf 20 -c:a aac -movflags +faststart demo.mp4
ffprobe -v error -show_entries format=duration -of csv=p=0 demo.mp4
