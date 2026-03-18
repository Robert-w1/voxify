# Voxify Landing Page — Implementation Guide for Claude Code

## Overview
This document contains everything needed to rebuild the landing page at voxify.ink. It includes the full copy, component code for key visuals, design system specs, and mockup content for social proof. The goal is a complete page rebuild following the section order and copy below.

---

## Design System

### Colors
- Primary: #0D7377 (deep teal)
- Background: #F7F5F0 (warm off-white)
- Secondary: #E8E4DD (light warm gray)
- Accent: #E8913A (burnt orange)

### Fonts
- Body/UI: Inter
- Display/Headings: Bebas Neue

### Design Principles
- The website must embody what Voxify stands for: articulation, clarity, confident communication, and trust
- The page should feel like talking to someone who knows exactly what they're saying. No filler, no vagueness, no visual clutter
- Use whitespace like a strategic pause — intentional, not empty
- Bebas Neue should be used for section headers, callout stats, and the main headline to create a confident typographic rhythm against Inter's clean body text
- Framing principle: "Level up," never "fix what's broken." This is aspiration and mastery, not remediation

### CSS Priorities
- Navbar "Sign up" button: use accent color (#E8913A) as a filled button with white text to distinguish from "Sign in"
- Visual hierarchy should feel confident and decisive
- Before/after transformation visual should be the most visually striking element on the page
- Feature cards need visual differentiation — icons, alternating layouts, not a flat uniform grid

### Constraints
- Navbar structure should not change
- Existing links continue pointing to the same destinations (sign_up, sign_in)
- Everything else is fair game

### SEO
- Page title: "Voxify — AI Presentation Coach | Practice and Get Instant Feedback"
- Add meta description: "Practice your next presentation and get instant AI feedback on clarity, pacing, filler words, and tone. Free to start. No credit card required."
- Add Open Graph tags (title, description, image) for LinkedIn/Slack sharing
- Add schema.org SoftwareApplication structured data

---

## Page Sections (in order)

---

### Section 1: HERO

**Headline (Bebas Neue, large):**
SPEAK WITH CONFIDENCE. ALWAYS.

**Subheadline (Inter):**
Practice your next big moment. Get feedback that's specific, honest, and private — so when you walk in the room, you already know you're ready.

**Primary CTA button:** Start for free → links to /users/sign_up
**Secondary link:** See how it works → anchor to #how-it-works
**Trust line (small, muted):** No credit card required · Free to get started

**Visual: Animated Feedback Scores**
Place this component next to or below the headline. Scores animate in on page load — bars fill and numbers count up. This is the "aha moment" preview.

```html
<div class="hero-scores">
  <div class="hero-scores-label">Feedback summary</div>
  <div class="score-row">
    <span class="score-name">Tone</span>
    <div class="score-bar-track"><div class="score-bar-fill fill-teal" data-target="88"></div></div>
    <span class="score-val" data-count="88">0</span>
  </div>
  <div class="score-row">
    <span class="score-name">Clarity</span>
    <div class="score-bar-track"><div class="score-bar-fill fill-teal" data-target="74"></div></div>
    <span class="score-val" data-count="74">0</span>
  </div>
  <div class="score-row">
    <span class="score-name">Pace</span>
    <div class="score-bar-track"><div class="score-bar-fill fill-teal" data-target="91"></div></div>
    <span class="score-val" data-count="91">0</span>
  </div>
  <div class="score-row">
    <span class="score-name">Filler words</span>
    <div class="score-bar-track"><div class="score-bar-fill fill-accent" data-target="62"></div></div>
    <span class="score-val score-val-accent" data-count="62">0</span>
  </div>
  <div class="score-row">
    <span class="score-name">Engagement</span>
    <div class="score-bar-track"><div class="score-bar-fill fill-teal" data-target="80"></div></div>
    <span class="score-val" data-count="80">0</span>
  </div>
</div>
```

```css
.hero-scores { max-width: 480px; }
.hero-scores-label { font-size: 11px; font-weight: 500; letter-spacing: 0.05em; text-transform: uppercase; color: #888; margin-bottom: 16px; }
.score-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.score-name { font-size: 13px; color: #888; width: 90px; text-align: right; flex-shrink: 0; }
.score-bar-track { flex: 1; height: 8px; background: #E8E4DD; border-radius: 4px; overflow: hidden; }
.score-bar-fill { height: 100%; border-radius: 4px; width: 0; transition: width 1.4s cubic-bezier(0.22, 1, 0.36, 1); }
.score-val { font-size: 15px; font-weight: 500; width: 32px; text-align: left; flex-shrink: 0; color: #0D7377; }
.score-val-accent { color: #E8913A; }
.fill-teal { background: #0D7377; }
.fill-accent { background: #E8913A; }
```

```javascript
// Animate scores on page load (or on scroll into view via Stimulus/IntersectionObserver)
function animateScores() {
  document.querySelectorAll('.score-bar-fill').forEach(fill => {
    fill.style.width = fill.dataset.target + '%';
  });
  document.querySelectorAll('.score-val').forEach(val => {
    const target = parseInt(val.dataset.count);
    const duration = 1200;
    const start = performance.now();
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      val.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}
// Trigger after a brief delay or on scroll
setTimeout(animateScores, 400);
```

---

### Section 2: BEFORE/AFTER TRANSFORMATION

This is the most visually striking element on the page. Two cards side by side on desktop, stacked on mobile. Orange scores and highlighted filler words on the left, clean teal scores on the right.

**Caption (below the cards, centered):**
Same speaker. Same material. One session apart.

```html
<section class="before-after-section">
  <div class="ba-grid">

    <div class="ba-card">
      <div class="ba-label">Attempt 1</div>
      <div class="ba-scores">
        <div class="ba-score"><div class="ba-score-num before-num">58</div><div class="ba-score-label">Clarity</div></div>
        <div class="ba-score"><div class="ba-score-num before-num">44</div><div class="ba-score-label">Pace</div></div>
        <div class="ba-score"><div class="ba-score-num before-num">32</div><div class="ba-score-label">Fillers</div></div>
        <div class="ba-score"><div class="ba-score-num before-num">61</div><div class="ba-score-label">Tone</div></div>
        <div class="ba-score"><div class="ba-score-num before-num">55</div><div class="ba-score-label">Engage</div></div>
      </div>
      <div class="ba-transcript">
        &ldquo;<span class="filler">So</span> what we&rsquo;ve been looking at is, <span class="filler">um</span>, <span class="filler">basically</span> how the onboarding process works today, and I think there&rsquo;s &mdash; the data <span class="filler">kind of</span> shows that there&rsquo;s a lot of room to improve there. <span class="filler">So</span> what I&rsquo;m proposing is that we <span class="filler">sort of</span> rethink the whole approach, and, <span class="filler">um</span>, I&rsquo;ll walk you through what that looks like.&rdquo;
      </div>
      <div class="ba-stat ba-stat-before">6 filler words · 52 words total</div>
    </div>

    <div class="ba-card">
      <div class="ba-label">Attempt 3</div>
      <div class="ba-scores">
        <div class="ba-score"><div class="ba-score-num after-num">87</div><div class="ba-score-label">Clarity</div></div>
        <div class="ba-score"><div class="ba-score-num after-num">91</div><div class="ba-score-label">Pace</div></div>
        <div class="ba-score"><div class="ba-score-num after-num">94</div><div class="ba-score-label">Fillers</div></div>
        <div class="ba-score"><div class="ba-score-num after-num">85</div><div class="ba-score-label">Tone</div></div>
        <div class="ba-score"><div class="ba-score-num after-num">89</div><div class="ba-score-label">Engage</div></div>
      </div>
      <div class="ba-transcript">
        &ldquo;We looked at how onboarding works today. The data shows significant room to improve. I&rsquo;m proposing we rethink the approach &mdash; let me walk you through what that looks like.&rdquo;
      </div>
      <div class="ba-stat ba-stat-after">0 filler words · 30 words total</div>
    </div>

  </div>
  <div class="ba-caption">Same speaker. Same material. One session apart.</div>
</section>
```

```css
.before-after-section { max-width: 900px; margin: 0 auto; padding: 4rem 1rem; }
.ba-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
.ba-card { background: #fff; border: 1px solid #E8E4DD; border-radius: 12px; padding: 24px; }
.ba-label { font-size: 11px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: #999; margin-bottom: 16px; }
.ba-scores { display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; }
.ba-score { text-align: center; flex: 1; min-width: 50px; }
.ba-score-num { font-size: 22px; font-weight: 500; line-height: 1.2; }
.ba-score-label { font-size: 10px; color: #999; margin-top: 2px; }
.before-num { color: #E8913A; }
.after-num { color: #0D7377; }
.ba-transcript { font-size: 13px; line-height: 1.8; color: #333; margin-bottom: 16px; border-top: 1px solid #E8E4DD; padding-top: 16px; }
.filler { background: rgba(232, 145, 58, 0.18); border-radius: 3px; padding: 1px 4px; }
.ba-stat { font-size: 12px; font-weight: 500; }
.ba-stat-before { color: #E8913A; }
.ba-stat-after { color: #0D7377; }
.ba-caption { text-align: center; margin-top: 24px; font-size: 15px; font-weight: 500; color: #777; }

@media (max-width: 640px) {
  .ba-grid { grid-template-columns: 1fr; }
}
```

---

### Section 3: ASPIRATION HOOK

**Body copy:**

**You've done the hard part.** You know your material cold. You've rewritten the deck. You've anticipated every question. But here's what nobody talks about: *how you say it matters more than what you say.* The same pitch, delivered with confidence and clarity, gets a completely different result. You know this. You've seen it in the room. Voxify helps you make sure that person is you.

**Humor callout (standalone, visually distinct — could be a pull quote, slightly larger italic text, or set apart with extra whitespace):**

*Your mirror can't tell you that you said "basically" fourteen times.*

**Design notes:**
- "You've done the hard part." should be bold
- "how you say it matters more than what you say" should be italic/emphasized
- The humor callout should be visually separated — consider larger font size, centered, with generous whitespace above and below
- This whole section should feel spacious and confident. Let the words breathe.

---

### Section 4: HOW IT WORKS
Use id="how-it-works" for the anchor link from the hero.

**Section header (Bebas Neue):**
FROM ZERO TO FEEDBACK IN FOUR STEPS

**Subheader (Inter, muted):**
No setup. No downloads. Just hit record.

**Step 1: SET YOUR CONTEXT**
Pick your audience and what you want to sharpen. The AI adjusts its lens to match.

**Step 2: DELIVER IT**
Hit record and give your talk. Pause, restart, go again. This is your practice room.

**Step 3: GET YOUR ANALYSIS**
Pacing, filler words, tone, clarity — broken down with specifics, not vague encouragement.

**Step 4: LEVEL UP AND GO AGAIN**
Review your report. Record another attempt. Watch your scores climb.

**Design notes:**
- Each step should have a number (1-4), a bold title, and the description below
- Consider a horizontal layout on desktop (4 columns) or a vertical timeline-style layout
- Step numbers could use Bebas Neue in a large size with the primary teal color
- Generate simple SVG icons for each step: context/settings icon, microphone icon, analysis/chart icon, upward arrow/improvement icon

---

### Section 5: FEATURES

**Section header (Bebas Neue):**
BUILT FOR THE WAY YOU ACTUALLY PREPARE

**Feature 1: PRACTICE LIKE IT'S REAL**
Record yourself right in the browser. No apps, no setup. Just you and the mic.
*Icon: microphone or browser window*

**Feature 2: TUNED TO YOUR AUDIENCE**
Pitching VCs? Presenting to your team? The AI adjusts what it listens for.
*Icon: audience/people or target*

**Feature 3: PINPOINT WHAT TO SHARPEN**
Tone, pace, filler words, storytelling — choose your focus, get deep feedback on each.
*Icon: crosshair or sliders*

**Feature 4: EVERY WORD, CAPTURED**
Whisper-powered transcription shows exactly what you said, when you said it.
*Icon: text/transcript or waveform*

**Feature 5: TRACK YOUR PROGRESS**
Multiple attempts, side by side. See the improvement happen in real time.
*Icon: trending up chart or comparison*

**Feature 6: TAKE IT WITH YOU**
Downloadable PDF report. Review it later, share it with a coach, keep it as a benchmark.
*Icon: download or document*

**Design notes:**
- Generate simple, clean SVG icons in primary teal (#0D7377) for each feature
- Cards should have visual variety — not a flat 3x2 grid of identical boxes
- Consider alternating icon-left/icon-right rows, or a 2-column layout with larger icons
- Feature titles in bold Inter or Bebas Neue

---

### Section 6: MID-PAGE CTA

**Headline (Bebas Neue):**
SEE WHAT YOUR DELIVERY SCORE LOOKS LIKE

**Subtext (Inter):**
Record your first session — it takes 2 minutes.

**CTA button:** Start for free → links to /users/sign_up

**Design notes:**
- This section should have a different background — use the secondary color (#E8E4DD) or a subtle teal wash to visually break from the surrounding sections
- CTA button should be prominent, accent color (#E8913A) with white text

---

### Section 7: TRUST & SOCIAL PROOF

**Section header (Bebas Neue):**
YOU'RE IN GOOD COMPANY

**Testimonials (mockup — to be replaced with real testimonials later):**

> "I didn't realize how much I was rushing until I saw my pacing score. My next pitch went completely differently."
> — Sarah Chen, Product Lead at Meridian

> "I used to just rehearse in my head. Hearing the playback with the filler words highlighted was a wake-up call — in the best way."
> — James Okafor, Founder at Brevity Labs

> "I ran three attempts before my board presentation. By the third, I'd cut my filler words in half and slowed my pace by 20%. Walked in feeling ready."
> — Priya Sharma, VP of Sales at Conduit

**Founder credibility block:**

**Why I built this.**
I kept watching smart people lose rooms — not because their ideas were weak, but because their delivery didn't match their expertise. The tools that existed were either built for enterprise teams or required a long-term commitment. I wanted something you could use in 2 minutes before the meeting that actually matters. That's Voxify.
— [Your name, your title — replace with real info]

**Trust signals (displayed as a row of small items with icons):**

🔒 Your recordings are private. Always.
We never share, sell, or store your audio beyond your session.

⚡ Powered by OpenAI Whisper
Precise, reliable transcription.

📊 Feedback based on research, not guesswork.
Analysis framework built on communication science.

**Design notes:**
- Testimonials should be in cards or a clean quote format with the person's name, title, and company below
- The founder block should feel personal — maybe a slightly different layout, left-aligned, with space for a headshot later
- Trust signal icons should be simple SVGs (lock, lightning bolt, bar chart) in teal, displayed in a horizontal row
- Replace emoji placeholders with actual SVG icons

---

### Section 8: OBJECTION HANDLING

**Section header (Bebas Neue):**
QUESTIONS YOU MIGHT BE ASKING

**Q: "I'm already a decent speaker."**
Good. This isn't remedial. The best presenters in the world still rehearse, still get coached, still refine. Voxify is how good speakers find their next gear.

**Q: "Is AI feedback actually useful?"**
It's not a replacement for a human coach — it's the practice reps between high-stakes moments. Specific, measurable feedback on exactly the areas you choose, every time you record. No scheduling, no judgment, no waiting.

**Q: "Is my recording private?"**
Completely. Your audio is processed for analysis and never shared, sold, or stored beyond your session. This is your private practice room.

**Q: "How is this different from practicing in front of a mirror?"**
Your mirror can't measure your pacing, count your filler words, or tell you that your energy dropped in the second half. Voxify gives you the data behind the feeling.

**Design notes:**
- This is NOT a traditional FAQ accordion. Style it as a clean, open layout — all answers visible without clicking
- Questions should be styled distinctly (italic, or in a different color) from answers
- Consider a two-column layout on desktop with Q on the left, A on the right
- Keep it visually light and easy to scan

---

### Section 9: FINAL CTA

**Headline (Bebas Neue):**
YOUR NEXT BIG MOMENT IS COMING

**Body (Inter):**
A board meeting. A pitch. A keynote. A conversation that could change everything. You've prepared the content. Now prepare the delivery.

**CTA buttons:**
- Primary: Start for free → links to /users/sign_up (accent color button)
- Secondary: Sign in → links to /users/sign_in (text link or outlined button)

**Design notes:**
- This section should feel like a confident closing statement
- Consider a full-width background in primary teal (#0D7377) with white text for maximum impact
- Or keep it on the warm background with strong typography
- The body copy should have generous line height and feel unhurried

---

### Section 10: FOOTER

Keep the existing footer structure. Minimal, clean, brand-aligned.

---

## Summary of Visual Components to Build

1. **Animated Hero Scores** — CSS animated bar chart with counting numbers (code provided above)
2. **Before/After Transformation** — Two-card comparison with filler word highlighting (code provided above)
3. **Feature Icons** — 6 simple SVG icons in teal (#0D7377), line-style, for each feature card
4. **Trust Signal Icons** — 3 small SVG icons: lock, lightning bolt, bar chart
5. **Step Number Styling** — Large Bebas Neue numbers (1-4) in teal for the how-it-works section
6. **Step Icons** — 4 simple SVG icons for each step: settings/context, microphone, chart/analysis, upward arrow

## Notes for Implementation

- All component code above uses vanilla HTML/CSS/JS. Adapt to ERB partials and Stimulus controllers as appropriate for the Rails stack.
- The score animation should ideally trigger on scroll-into-view using an IntersectionObserver (could be a Stimulus controller) rather than on page load, so it fires when the user actually sees it.
- The before/after section scores could also animate on scroll for consistency.
- Ensure all new sections have appropriate responsive breakpoints. The before/after grid and feature grid should stack to single column on mobile (below ~640px).
- Test that Bebas Neue is loaded and available. If using Google Fonts or a local file, ensure it's imported in the asset pipeline or via a link tag.
