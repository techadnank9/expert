#!/usr/bin/env bash
# Burn subtitles (from NARRATION.md, one block per clip) into demo-live.mp4 using the real clip durations.
# Produces demo-live-subtitled.mp4 and demo-live.srt; also rewrites the time ranges in NARRATION.md.
set -euo pipefail
cd "$(dirname "$0")"
CH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
rm -rf subs && mkdir -p subs
python3 - <<'PY'
import re, html, json, subprocess, glob
clips = sorted(glob.glob('recorder/out/0*.mp4'))
durs = [float(subprocess.run(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',c],capture_output=True,text=True).stdout.strip()) for c in clips]
starts=[0.0]
for d in durs[:-1]: starts.append(starts[-1]+d)
total=sum(durs)
s=open('NARRATION.md').read()
blocks=re.findall(r'\n(\*\*Opener|## 0\d[^\n]*|\*\*Closer)[^\n]*\n"([^"]+)"', s)
texts=[b[1] for b in blocks]            # opener, 7 clips, closer
opener, clipTexts, closer = texts[0], texts[1:1+len(clips)], texts[-1]
cues=[]
def add(a,b,t):
    parts=re.split(r'(?<=[.!?])\s+', t); chunks=[]; cur=''
    for p in parts:
        if len(cur)+len(p)>150 and cur: chunks.append(cur.strip()); cur=p
        else: cur=(cur+' '+p)
    if cur.strip(): chunks.append(cur.strip())
    d=(b-a)/len(chunks)
    for i,c in enumerate(chunks): cues.append((round(a+i*d,2), round(a+(i+1)*d,2), c))
# opener shares the first 4 s of clip 1
add(0, 4.0, opener)
for i,(st,du,t) in enumerate(zip(starts,durs,clipTexts)):
    a = st + (4.0 if i==0 else 0.3); b = st+du - (4.5 if i==len(clips)-1 else 0.3)
    add(a, b, t)
add(total-4.5, total-0.2, closer)
json.dump(cues, open('subs/cues.json','w'))
for i,(a,b,t) in enumerate(cues):
    open(f'subs/{i:02d}.html','w').write(f"""<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1920px;height:130px;background:#000;font-family:Inter,-apple-system,Helvetica,Arial,sans-serif}}
.bar{{display:flex;align-items:center;justify-content:center;height:130px;padding:0 200px;box-sizing:border-box}}
p{{margin:0;color:#fff;font-size:34px;line-height:1.3;text-align:center;font-weight:500}}
</style></head><body><div class="bar"><p>{html.escape(t)}</p></div></body></html>""")
def ts(x): h=int(x//3600); m=int(x%3600//60); s=x%60; return f"{h:02d}:{m:02d}:{s:06.3f}".replace('.',',')
open('demo-live.srt','w').write(''.join(f"{i+1}\n{ts(a)} --> {ts(b)}\n{t}\n\n" for i,(a,b,t) in enumerate(cues)))
# rewrite NARRATION time ranges
def mmss(x): return f"{int(x//60)}:{int(x%60):02d}"
ranges=[(0,4.0)]+[(st,st+du) for st,du in zip(starts,durs)]+[(total-4.5,total)]
heads=re.findall(r'\n((?:\*\*Opener|## 0\d[^\n(]*|\*\*Closer)[^\n]*)\n', s)
for h,(a,b) in zip(heads, ranges):
    nh=re.sub(r'\(\d+:\d+-\d+:\d+\)', f'({mmss(a)}-{mmss(b)})', h)
    s=s.replace(h, nh, 1)
s=re.sub(r'\(video is [^)]*\)|\(~90 s, read aloud\)', f'(video is {mmss(total)}, read aloud; times match the cut)', s)
open('NARRATION.md','w').write(s)
inputs=' '.join(f'-loop 1 -framerate 30 -i subs/{i:02d}.png' for i in range(len(cues)))
chain='[0:v]format=rgba[v0]'; prev='v0'
for i,(a,b,t) in enumerate(cues):
    chain+=f";[{i+1}:v]format=rgba,colorchannelmixer=aa=0.82[s{i}];[{prev}][s{i}]overlay=0:950:shortest=1:enable='between(t,{a},{b})'[v{i+1}]"; prev=f'v{i+1}'
chain+=f";[{prev}]format=yuv420p[out]"
open('subs/filter.txt','w').write(chain)
open('subs/cmd.sh','w').write(f"ffmpeg -nostdin -loglevel error -y -i demo-live.mp4 {inputs} -filter_complex_script subs/filter.txt -map '[out]' -c:v libx264 -crf 20 -preset veryfast -movflags +faststart -t {total:.2f} demo-live-subtitled.mp4\n")
print(len(cues),'cues, total', round(total,1),'s')
PY
for f in subs/*.html; do id=$(basename "$f" .html); "$CH" --headless=new --disable-gpu --hide-scrollbars --window-size=1920,130 --virtual-time-budget=600 --screenshot="subs/$id.png" "file://$PWD/$f" 2>/dev/null; done
bash subs/cmd.sh
ffprobe -v error -show_entries format=duration -of csv=p=0 demo-live-subtitled.mp4
