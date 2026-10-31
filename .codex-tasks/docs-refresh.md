Repo: /Users/adnan/Documents/expert. The product is now called HireXpert (codename Understudy). Update documentation only: FLOWS.html and DEMO.md. Do NOT touch README.md (another agent owns it), web/, bridge/, actor/, agents/, seed/, deploy/. Do not commit.

Read STATUS.md (especially the "HireXpert, business workspace VMs" section), README.md, DEMO.md, FLOWS.html, bridge/workspace.ts and web/src/pages/Onboard.tsx to understand the real current flow:
1. A business onboards at /onboard. The bridge provisions a Superserve VM for that business (bridge/workspace.ts): installs Codex CLI + the Agent Relay MCP server, copies the business documents (agents/docs) and the three bench agent prompts, logs Codex in with the OpenAI API key. The VM persists; its id/slug are stored on each Case actor as `workspace`.
2. The business posts a job (/post). Board.post creates the Case actor and the #case-<id> Relay channel; the job carries the workspace slug.
3. A worker claims it (/board -> /case/<id>). Board.claim is atomic; the bridge grants the worker access to the business VM (grantWorkspace).
4. The worker clicks "Start bench": the three Codex agents start INSIDE the business VM (startBench) and answer in #case-<id>, citing the documents that live in that VM; their Codex session logs stay in the VM and are listed on the Worker screen.
5. Recommendation -> votes (reactions) -> worker approves/overrides -> poster reviews -> pay.
6. Terse alarms escalate to the Supervisor; durability: state lives in Terse Durable Actors.

Live URLs: web https://hirexpert-eta.vercel.app ; bridge + web https://8788-5975fada-698b-4c43-8ec3-1e554ae9d97c.sandbox.superserve.ai ; actors https://api.useterse.ai/cmvwuohyf00zwjy2a2dm8cjel/actors.

Tasks:
A. (skip README.md entirely)
A-old. README.md: rename to HireXpert everywhere (keep "codename Understudy" once), replace the "How one case flows" section and the architecture block to include the business workspace VM (Superserve) as a fourth component, update the Live section with the URLs above, update Repo layout (bridge/workspace.ts, deploy/superserve.sh, deploy/vercel.sh, web/src/pages/Onboard.tsx), and the Run it section (add: `deploy/superserve.sh`, `deploy/vercel.sh`, and that agents can run on laptops via agents/launch.sh OR inside the business VM via POST /api/case/:id/startBench).
B. FLOWS.html: rename to HireXpert; add a new section "0. Business onboarding and its VM" before the poster flow describing step 1 above with a screenshot docs/screens/onboard.png (capture it with headless Chrome: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu --window-size=1440,1200 --virtual-time-budget=12000 --screenshot=/Users/adnan/Documents/expert/docs/screens/onboard.png "https://hirexpert-eta.vercel.app/onboard"); update the architecture diagram text to add the "Business VM (Superserve): Codex agents + documents + session logs" box; update the worker flow to mention Start bench and VM access; fix any "three laptops/three machines" wording to "inside the business VM".
C. DEMO.md: add a step 0 "Show onboarding -> VM provisioned (biz-cedar-street-clinic)" and replace the laptop agent launch with: on the Worker screen click "Start bench" (or `curl -X POST <bridge>/api/case/4471/startBench -d '[]'`), wait ~40 s for the three Codex processes in the VM, then Ask. Keep the laptop launch as fallback.
Finish by printing a 5-line summary of what changed.


Also add to FLOWS.html: each business VM now runs code-server (VS Code in the browser) published on a preview URL with a per-workspace password, shown as 'Open workstation' on the onboarding and workspace cards; real file uploads go into the VM at agents/docs/business with PDF text extraction; the VM is connected to Agent Relay via `agent-relay init --key` during provisioning.
