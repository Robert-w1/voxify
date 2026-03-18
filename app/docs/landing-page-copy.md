# Voxify Landing Page — Final Copy Package

## Design System
- Primary: #0D7377 (deep teal)
- Background: #F7F5F0 (warm off-white)
- Secondary: #E8E4DD (light warm gray)
- Accent: #E8913A (burnt orange)
- Fonts: Inter (body/UI), Bebas Neue (display/headings)

## Brand Essence
The website must embody what Voxify stands for. Every design choice, word, and interaction should inspire articulation, clarity, confident communication, and trust. The page should feel like talking to someone who knows exactly what they're saying and why. No filler, no vagueness, no visual clutter.

Framing principle: "Level up," never "fix what's broken." The best athletes in the world still have coaches. This is aspiration and mastery, not remediation.

## Constraints
- Navbar structure should not change
- Existing links continue pointing to the same destinations
- Everything else is fair game

---

## Section 1: HERO

**Headline:**
SPEAK WITH CONFIDENCE. ALWAYS.

**Subheadline:**
Practice your next big moment. Get feedback that's specific, honest, and private — so when you walk in the room, you already know you're ready.

**Primary CTA:** Start for free
**Secondary link:** See how it works
**Trust line:** No credit card required · Free to get started

**Visual note:** Hero should include an animated product mockup — feedback scores filling in as if an analysis just completed. This is the "aha moment" preview.

---

## Section 2: BEFORE/AFTER TRANSFORMATION

**Caption:**
Same speaker. Same material. One session apart.

**Visual note:** Side-by-side showing a "before" recording with flagged filler words, rushed pacing, and a lower score vs. an "after" recording with clean delivery and high scores. This is the centerpiece of the page. The visual IS the argument. (Asset to be created in Figma.)

---

## Section 3: ASPIRATION HOOK

**Body:**
**You've done the hard part.** You know your material cold. You've rewritten the deck. You've anticipated every question. But here's what nobody talks about: *how you say it matters more than what you say.* The same pitch, delivered with confidence and clarity, gets a completely different result. You know this. You've seen it in the room. Voxify helps you make sure that person is you.

**Humor callout (standalone line):**
*Your mirror can't tell you that you said "basically" fourteen times.*

---

## Section 4: HOW IT WORKS

**Section header:**
From zero to feedback in four steps.
No setup. No downloads. Just hit record.

**Step 1: SET YOUR CONTEXT**
Pick your audience and what you want to sharpen. The AI adjusts its lens to match.

**Step 2: DELIVER IT**
Hit record and give your talk. Pause, restart, go again. This is your practice room.

**Step 3: GET YOUR ANALYSIS**
Pacing, filler words, tone, clarity — broken down with specifics, not vague encouragement.

**Step 4: LEVEL UP AND GO AGAIN**
Review your report. Record another attempt. Watch your scores climb.

---

## Section 5: FEATURES

**Section header:**
Built for the way you actually prepare.

**Feature 1: PRACTICE LIKE IT'S REAL**
Record yourself right in the browser. No apps, no setup. Just you and the mic.

**Feature 2: TUNED TO YOUR AUDIENCE**
Pitching VCs? Presenting to your team? The AI adjusts what it listens for.

**Feature 3: PINPOINT WHAT TO SHARPEN**
Tone, pace, filler words, storytelling — choose your focus, get deep feedback on each.

**Feature 4: EVERY WORD, CAPTURED**
Whisper-powered transcription shows exactly what you said, when you said it.

**Feature 5: TRACK YOUR PROGRESS**
Multiple attempts, side by side. See the improvement happen in real time.

**Feature 6: TAKE IT WITH YOU**
Downloadable PDF report. Review it later, share it with a coach, keep it as a benchmark.

---

## Section 6: MID-PAGE CTA

**Headline:**
See what your delivery score looks like.

**Subtext:**
Record your first session — it takes 2 minutes.

**CTA button:** Start for free

---

## Section 7: TRUST & SOCIAL PROOF

**Section header:**
You're in good company.

**Testimonial placeholders (replace with real beta user quotes):**

> "I didn't realize how much I was rushing until I saw my pacing score. My next pitch went completely differently."
> — Name, Title, Company

> [Add 2-3 more beta testimonials here]

**Founder credibility block:**

> **Why I built this.**
> I kept watching smart people lose rooms — not because their ideas were weak, but because their delivery didn't match their expertise. The tools that existed were either built for enterprise teams or required a long-term commitment. I wanted something you could use in 2 minutes before the meeting that actually matters. That's Voxify.
> — [Your name, your title]

**Trust signals (small, icon-sized elements in a row):**
- 🔒 Your recordings are private. Always. We never share, sell, or store your audio beyond your session.
- ⚡ Powered by OpenAI Whisper for precise, reliable transcription.
- 📊 Feedback based on research, not guesswork.

---

## Section 8: OBJECTION HANDLING

**Section header:**
Questions you might be asking.

**Q: "I'm already a decent speaker."**
Good. This isn't remedial. The best presenters in the world still rehearse, still get coached, still refine. Voxify is how good speakers find their next gear.

**Q: "Is AI feedback actually useful?"**
It's not a replacement for a human coach — it's the practice reps between high-stakes moments. Specific, measurable feedback on exactly the areas you choose, every time you record. No scheduling, no judgment, no waiting.

**Q: "Is my recording private?"**
Completely. Your audio is processed for analysis and never shared, sold, or stored beyond your session. This is your private practice room.

**Q: "How is this different from practicing in front of a mirror?"**
Your mirror can't measure your pacing, count your filler words, or tell you that your energy dropped in the second half. Voxify gives you the data behind the feeling.

---

## Section 9: FINAL CTA

**Headline:**
Your next big moment is coming.

**Body:**
A board meeting. A pitch. A keynote. A conversation that could change everything. You've prepared the content. Now prepare the delivery.

**CTA buttons:** Start for free · Sign in

---

## Section 10: FOOTER

Minimal, clean, brand-aligned. Keep existing structure.

---

## Implementation Notes

### Visual assets needed (not code — create separately):
1. **Before/after transformation mockup** — Figma. Side-by-side or stacked showing messy vs. clean delivery with scores.
2. **Product screenshots** — recording interface and completed feedback report. Capture from live app, clean up in Figma.
3. **Hero product demo** — screen record a real session (record → processing → scores appearing), 15-20 seconds, looping MP4 or GIF.
4. **Feature icons** — simple, consistent icon set (Phosphor, Heroicons, or custom).
5. **Optional: transformation video** — Veo 3.1 or similar. Person fumbling through a presentation → same person delivering confidently.

### CSS/design priorities:
- Navbar "Sign up" button should use accent color (#E8913A) as filled button
- Bebas Neue used more deliberately — section headers, callout stats, pull quotes
- Whitespace used like strategic pauses — intentional, not empty
- Visual hierarchy should feel confident and decisive
- Before/after visual should be the most visually striking element on the page

### SEO:
- Page title: "Voxify — AI Presentation Coach | Practice and Get Instant Feedback"
- Add meta description
- Add Open Graph tags (title, description, image) for LinkedIn/Slack sharing
- Add schema.org SoftwareApplication structured data
- Add favicon and Apple touch icon
