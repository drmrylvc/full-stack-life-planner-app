# ezlife26 mobile release

The hosted app is already installable as a PWA on Android, iPhone, and tablet:

- Preview / phone link: `https://3000-i5fzefmn0vqoqfwnr0xel.e2b.app/`
- Android: Chrome → **Install app** or **Add to Home screen**.
- iPhone/iPad: Safari → **Share** → **Add to Home Screen**.
- The same account keeps targets, tasks, habits, files, and language preferences synced.

## Native store wrapper

This repo includes `capacitor.config.ts` for preparing Google Play and Apple App Store shells with Capacitor.
The app is intentionally hosted because the planner uses authenticated Next.js route handlers, PostgreSQL persistence, sessions, and private file downloads.

```bash
npm install
CAPACITOR_SERVER_URL=https://YOUR-PRODUCTION-DOMAIN.example npx cap add android
CAPACITOR_SERVER_URL=https://YOUR-PRODUCTION-DOMAIN.example npx cap add ios
CAPACITOR_SERVER_URL=https://YOUR-PRODUCTION-DOMAIN.example npx cap sync
npx cap open android
npx cap open ios
```

Use the same production HTTPS domain in both shells. Do not ship the temporary preview hostname as the final store URL.

## Google Play checklist

1. Create a Play Console app named **ezlife26**.
2. Use package ID `com.ezlife26.planner`.
3. In Android Studio, set the release version code/name, app icon, splash screen, signing key, target SDK, and HTTPS network policy.
4. Build a signed Android App Bundle (`.aab`) and upload it to an internal testing track first.
5. Add the privacy policy URL, support email, app category, content rating, data-safety answers, screenshots, feature graphic, and tablet screenshots.
6. Test sign-in, sign-up, language switching, task CRUD, file upload/download, offline messaging, and account deletion before production rollout.

## Apple App Store checklist

1. Enroll in the Apple Developer Program and create an App Store Connect app named **ezlife26**.
2. Use bundle identifier `com.ezlife26.planner`.
3. In Xcode, set the development team, signing, version/build number, deployment target, icons, launch screen, and privacy manifest.
4. Archive and upload a signed `.ipa` through Xcode or Transporter to TestFlight.
5. Add the privacy policy URL, support URL, age rating, app privacy answers, description, keywords, and iPhone/iPad screenshots.
6. Test the hosted HTTPS session, Apple web-view navigation, file access, keyboard input, safe-area spacing, and universal links before review.

## Required production follow-up

- Replace the preview URL with the final HTTPS domain in `CAPACITOR_SERVER_URL`.
- Publish a privacy policy and support/contact page.
- Add the final Apple Team ID to an Apple App Site Association file if universal links are enabled.
- Add the final Android SHA-256 signing fingerprint to `assetlinks.json` if verified app links are enabled.
- Store signing keys and App Store credentials in the CI/CD secret manager, never in this repo.
