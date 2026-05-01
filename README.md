<!--
  README TEMPLATE
  ===============
  Two kinds of sections in this file:

  1. Sections marked with <!-- FILL MANUALLY: ... --> are for YOU to write.
     They contain personal, project-specific content only you can provide.

  2. Sections marked with <!-- FILL VIA CLAUDE CODE --> are populated by
     Claude Code based on actual analysis of the codebase. Do not edit
     these by hand before running the prompt.

  Delete every HTML comment block (including this one) once the README
  is finalized.
-->

# Voxify

> <!-- FILL MANUALLY: One or two sentences describing what this project does and who it is for. Mention the context (bootcamp project, personal project, hackathon, etc.) if relevant. -->
AI-powered presentation coach built in a team of three as a bootcamp project. Record yourself, receive relevant and individual feedback and improve your presentation skills.

📂 **Repository:** https://github.com/Robert-w1/voxify/

<!-- FILL MANUALLY: Add badges here once CI is set up. Example:
![Build Status](https://github.com/Robert-w1/voxify/actions/workflows/ci.yml/badge.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
-->

---

## 📸 Preview

![Home page](app/docs/screenshots/1_homepage.png)
![Start recording](app/docs/screenshots/5_start_recording.png)
![Feedback](app/docs/screenshots/7_feedback.png)

---

## 📑 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Installation & Setup](#installation--setup)
- [Usage](#usage)
- [Tests](#tests)
- [My Contribution](#my-contribution)
- [Known Limitations](#known-limitations)
- [Planned Improvements](#planned-improvements)
- [License](#license)

---

## ✨ Features

- 🔐 User registration und sign in with secure password encryption (bcrypt)
- 👥 Choose practice purpose, audience and feedback areas
- 🎙️->📊 Record yourself and get comprehensive AI-powered feedback on multiple dimensions
- 📝 Download PDF report containing your a transcription of your recording and whole feedback
- 📂 Organize your recordings in project folders
- 🔍 Full-text search by session or folder

---

## 🛠 Tech Stack

<!-- FILL VIA CLAUDE CODE: Group the technologies into categories
(Frontend / Backend / External APIs / Tooling & Deployment) and list
the actual libraries with their major versions, as found in the
dependency manifests. -->

---

## 🏗 Architecture

<!-- FILL VIA CLAUDE CODE: Brief description of the architecture of THIS
project. Include a simple ASCII diagram showing the actual components
and request flow. Mention non-obvious choices (background jobs, caching,
service objects, etc.) found in the code. -->

---

## 🚀 Installation & Setup

<!-- FILL VIA CLAUDE CODE: Provide step-by-step instructions that
actually work for this codebase, including:
- Prerequisites with required versions
- Clone and install commands
- Environment variable setup (referencing .env.example if present)
- Database setup commands
- Command to start the dev server
- The URL where the app becomes available -->

---

## 🎯 Usage

1. After sign in you start a new session
2. Choose your core purpose
![Choose core purpose](app/docs/screenshots/2_purpose.png)
3. Choose your audience
![Choose audience](app/docs/screenshots/3_audience.png)
4. Optional: choose feedback focus
![Choose feedback focus](app/docs/screenshots/4_focus_areas.png)
5. Start your recording
![Start recording](app/docs/screenshots/5_start_recording.png)
6. Optional: listen to your recording or re-do
![Listen to recording](app/docs/screenshots/6_listen.png)
7. Get your individual AI-powered feedback
![Get feedback](app/docs/screenshots/7_feedback.png)


---

## 🧪 Tests

<!-- FILL VIA CLAUDE CODE: Describe the actual testing setup found in
this project — which frameworks, which categories of tests exist, exact
commands to run them, and how external APIs are handled in tests. -->

---

<!-- FILL VIA CLAUDE CODE: If linters/formatters are configured, add a
"## 🧹 Code Quality" section here listing tools, commands, and whether
they run in CI. If none are configured, skip this section. -->

<!-- FILL VIA CLAUDE CODE: If CI/CD workflows exist, add a
"## ⚙️ Continuous Integration" section here describing the provider,
what the pipeline does, and on which events it triggers. If no CI is
configured, skip this section. -->

---

## 👥 My Contribution

<!-- FILL MANUALLY: If this was a team project, state team size and
context. List your main areas of responsibility honestly. Optionally
add a short reflection on what you learned. If this was a solo project,
replace this section with "## 👤 About This Project" and note that it
was built solo. -->

---

## ⚠️ Known Limitations

- Only recordings in English can be processed
- Tone and pace are not currently being adequatly assessed
- If the recording is too short, the feedback can be inaccurate

---

## 🔮 Planned Improvements

- Improve feedback on tone, pace and pitch variation
- Fine-tune AI feedback

---

## 📄 License

<!-- FILL MANUALLY: State the license. Common choice for portfolio
projects is MIT. Make sure a LICENSE file actually exists in the repo. -->

---

## 📬 Contact

<!-- FILL MANUALLY: Your name, email, LinkedIn, optional portfolio URL. -->
