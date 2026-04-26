# Firebase Auth on Safari and Mobile

Safari, Firefox, and modern Chrome privacy settings can block cross-origin storage used by Firebase Auth redirect flows. This matters when the app is served from a custom domain, but Firebase Auth uses the default project auth handler at `PROJECT_ID.firebaseapp.com`.

Sonosig avoids that class of issue in two ways:

- Google sign-in uses `signInWithPopup`, not `signInWithRedirect`.
- Browser Firebase config resolves `authDomain` to the current HTTPS host when the app is served from Firebase Hosting and `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is the default `firebaseapp.com` project domain.

For production custom domains, Firebase's auth handler must be reachable at:

```text
https://sonosig.com/__/auth/handler
https://www.sonosig.com/__/auth/handler
```

## Firebase Console Checklist

Authentication -> Settings -> Authorized domains should include:

- `localhost`
- `sonosig.com`
- `www.sonosig.com`
- `sonosig-dotcom.firebaseapp.com`
- `sonosig-dotcom.web.app`
- Firebase preview or App Hosting domains used for testing

Authentication -> Sign-in method should have Google enabled.

## Google Cloud Checklist

Google Cloud Console -> APIs & Services -> Credentials -> OAuth 2.0 Web client should include these authorized redirect URIs if both hosts are served:

```text
https://sonosig.com/__/auth/handler
https://www.sonosig.com/__/auth/handler
https://sonosig-dotcom.firebaseapp.com/__/auth/handler
https://sonosig-dotcom.web.app/__/auth/handler
```

## Environment Notes

`NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` can remain:

```text
sonosig-dotcom.firebaseapp.com
```

The browser client switches to the current HTTPS host on Firebase Hosting, so Safari uses a same-origin auth helper. If the app moves off Firebase Hosting, set `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` to a domain that serves Firebase's `/__/auth/handler` endpoint or keep auth traffic on the Firebase project domain.
