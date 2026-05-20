# Firebase setup for Elite Study Room Management

This project is ready for Firebase Firestore. Until Firebase keys are added, it runs in a browser demo database using local storage.

## Collections

### rooms
- `name`: room or zone name
- `type`: room type
- `capacity`: total seats
- `price`: booking price
- `seatPrefix`: S, PC, G, BR, etc.
- `active`: true or false

### slots
- `label`: Morning, Evening, Full Day, etc.
- `start`: 24 hour start time
- `end`: 24 hour end time
- `active`: true or false

### bookings
- `userName`
- `phone`
- `email`
- `roomId`
- `roomName`
- `slotId`
- `slotLabel`
- `seatId`
- `seatLabel`
- `date`
- `notes`
- `status`: pending, approved, rejected, or cancelled
- `source`
- `createdAt`

## How to connect Firebase

1. Create a Firebase project.
2. Enable Firestore Database.
3. Open the Firebase project settings and create a Web App.
4. Copy the Firebase config values into `firebase-config.js`. Keep the `window.firebaseConfig = { ... }` format.
5. Open `admin_dashboard.html` and click `Seed Default Setup` once.

## Starter Firestore rules

These rules are simple for early testing. For production, add Firebase Authentication and allow admin writes only for verified admin accounts.

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /rooms/{roomId} {
      allow read: if true;
      allow write: if true;
    }

    match /slots/{slotId} {
      allow read: if true;
      allow write: if true;
    }

    match /bookings/{bookingId} {
      allow create: if true;
      allow read, update, delete: if true;
    }
  }
}
```
