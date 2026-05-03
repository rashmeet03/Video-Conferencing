## Backend – Ports & Running

- Default port is now **3011** (so it doesn’t clash with anything already on 3010).
- You can override it with the `PORT` env var.

### Start

```bash
cd backend
npm install
npm start           # starts on http://localhost:3011 by default
```

To use a custom port:

```bash
PORT=4000 npm start    # Unix
set PORT=4000 && npm start   # Windows CMD
$env:PORT=4000; npm start    # PowerShell
```
