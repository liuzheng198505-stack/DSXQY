import express from "express";
import { createServer as createViteServer } from "vite";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const IMAGES_DIR = path.join(DATA_DIR, "images");

async function initDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(IMAGES_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, JSON.stringify({}));
  }
}

async function startServer() {
  await initDb();
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "50mb" }));

  // API Routes
  app.post("/api/register", async (req, res) => {
    try {
      const { email, password } = req.body;
      const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
      if (users[email]) {
        return res.status(400).json({ error: "该邮箱已注册" });
      }
      users[email] = { password, images: [] };
      await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
      if (!users[email] || users[email].password !== password) {
        return res.status(400).json({ error: "邮箱或密码错误" });
      }
      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.post("/api/images", async (req, res) => {
    try {
      const { email, imageUrl, prompt } = req.body;
      const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
      if (!users[email]) return res.status(404).json({ error: "User not found" });

      const userImagesDir = path.join(IMAGES_DIR, email);
      await fs.mkdir(userImagesDir, { recursive: true });

      const filename = `${Date.now()}-${crypto.randomBytes(4).toString("hex")}.png`;
      const filepath = path.join(userImagesDir, filename);

      // Download image from URL
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      await fs.writeFile(filepath, buffer);

      const newImage = {
        filename,
        url: `/api/images/${email}/${filename}`,
        prompt
      };

      users[email].images.unshift(newImage);
      await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

      res.json({ success: true, image: newImage });
    } catch (error) {
      console.error("Failed to save image:", error);
      res.status(500).json({ error: "Failed to save image" });
    }
  });

  app.get("/api/images/:email", async (req, res) => {
    try {
      const { email } = req.params;
      const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
      if (!users[email]) return res.status(404).json({ error: "User not found" });
      res.json({ images: users[email].images || [] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  app.delete("/api/images/:email/:filename", async (req, res) => {
    try {
      const { email, filename } = req.params;
      const users = JSON.parse(await fs.readFile(USERS_FILE, "utf-8"));
      if (!users[email]) return res.status(404).json({ error: "User not found" });

      users[email].images = users[email].images.filter((img: any) => img.filename !== filename);
      await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2));

      try {
        await fs.unlink(path.join(IMAGES_DIR, email, filename));
      } catch (e) {
        console.error("Failed to delete file from disk:", e);
      }

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Serve static images
  app.use("/api/images", express.static(IMAGES_DIR));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
