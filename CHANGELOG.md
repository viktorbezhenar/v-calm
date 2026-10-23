# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) · Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-23

### Added

- Seven breathing programs: Relax (4-6), Balance (4-2-4), Restore (5-5), Focus (4-4-4-4), Energize (4-2), Unwind (4-7-8), Physiological sigh (2-1-6).
- Two-tap start: expand a program, tap 2/3/4/5 min. "Repeat last" shortcut on the home screen.
- Breathing orb with guide ring and exhale shimmer; per-program colour themes.
- Synthesised phase sounds (inhale bell, hold chime, exhale singing bowl, closing bowl) with a volume slider.
- Sessions round up to whole cycles and always end on a full breath.
- Pause by tapping the orb; automatic pause when the app is hidden.
- Local streaks (2+ min per day), longest streak, total minutes, session count.
- Offline support via service worker; installable PWA with icons.
- iOS: plays with the silent switch on (Audio Session API), keeps the screen awake (Wake Lock).
- Security headers for Cloudflare Pages and the Docker/nginx image.
- Unit tests (timing engine, streaks, service worker asset list), ESLint, Prettier, GitHub Actions CI, Dependabot.
