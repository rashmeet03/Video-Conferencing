import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import { connectToSocket } from "./controllers/socketManager.js";
import userRoutes from "./routes/usersRouts.js";
const app = express();
const server = createServer(app);
const io = connectToSocket(server);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); 

// Serve the WebRTC frontend (now located in ../frontend)
app.use(express.static(path.join(__dirname, "..", "..", "frontend")));

app.use("/api/v1/users",userRoutes);
// Use 3011 by default to avoid clashing with any existing process on 3010.
app.set("port", process.env.PORT || 3011);

app.get("/home", (req, res) => {    
  res.send("running");
});

const start = async () => {
  // Log a helpful message instead of crashing on port conflicts.
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${app.get("port")} is already in use. ` +
        `Either stop the existing process or set PORT to another value.`
      );
    } else {
      console.error("Server error:", err);
    }
  });

  // Start HTTP + Socket.IO even if MongoDB is down (WebRTC signaling doesn't require Mongo).
  server.listen(app.get("port"), () => {
    console.log(`App is listening on port ${app.get("port")}`);
  });

  // MongoDB connection has been strictly removed for native runtime support.
};

start();
