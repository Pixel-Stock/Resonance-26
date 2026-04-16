import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "users.json");

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
}

function readUsers(): StoredUser[] {
  if (!fs.existsSync(DATA_FILE)) return [];
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
}

function writeUsers(users: StoredUser[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(users, null, 2));
}

export function getUserByEmail(email: string): StoredUser | null {
  return readUsers().find((u) => u.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export function createUser(email: string, name: string, passwordHash: string): StoredUser {
  const users = readUsers();
  if (users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error("User already exists");
  }
  const user: StoredUser = { id: crypto.randomUUID(), email, name, passwordHash };
  writeUsers([...users, user]);
  return user;
}
