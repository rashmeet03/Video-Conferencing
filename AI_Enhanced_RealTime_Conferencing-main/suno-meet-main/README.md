## Suno – 1:1 WebRTC Video Conferencing

This repo now includes a simple **one-to-one WebRTC video call frontend** served by the backend via Express + Socket.IO.

### Run

From `backend/`:

```bash
npm install
npm start
```

Backend runs on **port 3010** by default.

### Use

- Open `http://localhost:3010/?room=demo` in **two different browsers/tabs/devices**
- Click **Join** on both
- You should see local + remote video

### Notes

- Rooms are **1:1 only** (a 3rd participant will get “room full”).
- MongoDB is optional for calling; the server will keep running even if Mongo isn’t available.
