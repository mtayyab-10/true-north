# Pre-Submission Checklist — run at deadline minus 45 minutes

## Qualification requirements
- [ ] Repo is PUBLIC on GitHub
- [ ] LICENSE file is present and contains MIT text
- [ ] README states: what the app does, how to run it, which model and license
- [ ] No API key anywhere in the code or git history
  Run: git log -p | Select-String "AIza|gemini_api_key=[^Y]"  (should return nothing)
- [ ] Code calls Gemma through the Gemini API (judges check this)
      → src/app/api/extract/route.ts  → src/app/api/summarize/route.ts
- [ ] .env and .env.local are in .gitignore (check: git check-ignore .env.local)

## App state
- [ ] npm run dev starts without errors
- [ ] Demo mode works with no API key (click "Load demo sample")
- [ ] Live Gemma extraction works with API key (test one real photo)
- [ ] Both findings appear and can be resolved
- [ ] Export CSV downloads successfully after all findings resolved
- [ ] Urdu summary generates (select اردو from dropdown, click Generate Summary)

## Repo state
- [ ] All code committed and pushed (git status shows clean)
- [ ] git log shows at least 2 commits (initial + feature commit)
- [ ] README renders correctly on GitHub

## Submission
- [ ] OrganizerHQ submission form open
- [ ] GitHub repo link pasted in
- [ ] Project name: Tasdeeq (تصدیق)
- [ ] Description from SUBMISSION.md pasted in
- [ ] Technologies listed
- [ ] Both challenge boxes ticked:
      ✓ Best Open-Source AI Project
      ✓ Best Use of Gemma 4
- [ ] Clicked "Submit Project" with >45 minutes to deadline

## Demo readiness
- [ ] localhost:3000 is running
- [ ] Screen recording started (Win+G or OBS)
- [ ] Demo invoice photo ready OR demo mode button visible
- [ ] DEMO_SCRIPT.md open in a separate window
- [ ] Backup plan tested (demo mode button → 2 findings appear instantly)
