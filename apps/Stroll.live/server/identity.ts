import { createHash } from "crypto";
import type { Request } from "express";

const ADJECTIVES = [
  "Swift", "Gentle", "Bright", "Quiet", "Copper", "Silver", "Mossy",
  "Misty", "Golden", "Amber", "Crimson", "Azure", "Jade", "Scarlet",
  "Coral", "Sage", "Lunar", "Stellar", "Crystal", "Ember", "Frost",
  "Breeze", "Dusk", "Midnight", "Velvet", "Iron", "Wild", "Ancient",
  "Noble", "Clever", "Lucky", "Merry", "Hidden", "Hollow", "Rusty",
  "Wandering", "Stony", "Dusty", "Stormy", "Sunlit",
];

const NOUNS = [
  "Fox", "Bear", "Owl", "Hawk", "Wolf", "Deer", "Hare", "Swan",
  "Crow", "Wren", "Finch", "Robin", "Badger", "Otter", "Heron",
  "Raven", "Eagle", "Lark", "Sparrow", "Magpie", "Jay", "Dove",
  "Hound", "Stag", "Piper", "Weaver", "Walker", "Fisher", "Dancer",
  "Dreamer", "Seeker", "Keeper", "Rider", "Drifter", "Climber",
  "Sailor", "Watcher", "Forager", "Spinner", "Carver",
];

function hashIdentity(req: Request): Buffer {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const ua = req.headers["user-agent"] || "unknown";
  return createHash("sha256").update(`${ip}::${ua}`).digest();
}

export function generateAuthor(req: Request): { authorName: string; authorHue: number } {
  const hash = hashIdentity(req);

  const adjIdx = hash[0] % ADJECTIVES.length;
  const nounIdx = hash[1] % NOUNS.length;
  const authorName = `${ADJECTIVES[adjIdx]} ${NOUNS[nounIdx]}`;

  const authorHue = ((hash[2] << 8) | hash[3]) % 360;

  return { authorName, authorHue };
}
