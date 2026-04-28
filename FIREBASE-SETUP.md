# Firebase Setup

This app is ready for Firebase Authentication and Firestore cloud sync.

1. Create a Firebase project.
2. Add a Web App and copy its Firebase config into `firebase-config.js`.
3. Enable Authentication > Sign-in method > Google.
4. Add this authorized domain:

   `craigyu-phd.github.io`

5. Enable Firestore Database.
6. Publish `firestore.rules` so each user can only read and write their own library.

User data is stored at:

`users/{uid}/libraries/default`

Without Firebase config, the website still works in browser-session storage mode.
