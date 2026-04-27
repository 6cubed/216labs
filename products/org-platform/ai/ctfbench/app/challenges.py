from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Challenge:
    id: str
    title: str
    category: str
    difficulty: str
    points: int
    prompt_md: str
    attachments: list[dict[str, str]]


CHALLENGES: list[Challenge] = [
    Challenge(
        id="ctfbench-001",
        title="Clockwork Caesar",
        category="crypto",
        difficulty="easy",
        points=100,
        prompt_md=(
            "You intercept a message from a toy radio modem that uses a shifting Caesar cipher.\n\n"
            "It rotates by **k = (minute + second) mod 26** at the time it was sent.\n"
            "Unfortunately, the sender only wrote down the timestamp: `00:02:03`.\n\n"
            "Ciphertext:\n\n"
            "```\n"
            "YMNX NX F YJXY TK YMJ HJFXFW\n"
            "```\n\n"
            "Decode the plaintext. The flag is the plaintext, uppercased, with spaces replaced by `_`.\n"
            "Example format: `CTFBENCH{LIKE_THIS}`\n"
        ),
        attachments=[],
    ),
    Challenge(
        id="ctfbench-002",
        title="Monochrome Run-Length",
        category="forensics",
        difficulty="easy",
        points=100,
        prompt_md=(
            "A build tool exported a message using a tiny run-length encoding (RLE) text format.\n"
            "Each non-empty line is:\n"
            "`<count>:<char>`\n\n"
            "To decode: repeat `<char>` exactly `<count>` times, concatenate in order.\n"
            "Ignore bracketed comments.\n\n"
            "Recover the phrase. Flag format:\n"
            "`CTFBENCH{<decoded_text>}`\n"
        ),
        attachments=[{"name": "rle.txt", "path": "/static/challenges/ctfbench-002/rle.txt"}],
    ),
    Challenge(
        id="ctfbench-003",
        title="Two-Stage Base",
        category="misc",
        difficulty="easy",
        points=100,
        prompt_md=(
            "A build pipeline accidentally double-encodes secrets:\n"
            "1) base64\n"
            "2) then base32\n\n"
            "Recover the original ASCII string.\n\n"
            "Token:\n\n"
            "```\n"
            "LFWVM5KZGJUGMWLKLEYFQM2SN5NFONLGLFVE26I=\n"
            "```\n\n"
            "Flag format: `CTFBENCH{<original>}`\n"
        ),
        attachments=[],
    ),
    Challenge(
        id="ctfbench-004",
        title="XOR Ledger",
        category="crypto",
        difficulty="medium",
        points=200,
        prompt_md=(
            "A ledger stores integers 0–255. The checksum is the XOR of all values.\n\n"
            "Values (decimal):\n"
            "```\n"
            "12 250 99 99 5 128 1 42 42 18\n"
            "```\n\n"
            "Compute the checksum as a **two-digit lowercase hex** (zero-padded).\n"
            "Flag: `CTFBENCH{<hex>}`\n"
        ),
        attachments=[],
    ),
    Challenge(
        id="ctfbench-005",
        title="Torn Transcript",
        category="forensics",
        difficulty="medium",
        points=200,
        prompt_md=(
            "A text file was torn into chunks and re-ordered. Each chunk starts with a marker like\n"
            "`[chunk:NN]`.\n\n"
            "Reassemble the original message by sorting on `NN` and concatenating with newlines.\n"
            "The flag is the SHA-256 hex of the reconstructed message.\n\n"
            "Format: `CTFBENCH{<sha256_hex>}`\n"
        ),
        attachments=[{"name": "torn.txt", "path": "/static/challenges/ctfbench-005/torn.txt"}],
    ),
    Challenge(
        id="ctfbench-006",
        title="Keyed Grid",
        category="crypto",
        difficulty="medium",
        points=200,
        prompt_md=(
            "A 5x5 keyed Polybius grid is constructed from the keyword `MERCURY` then the rest of the\n"
            "alphabet (I/J combined). Coordinates are row/col starting at 1.\n\n"
            "Ciphertext coordinates:\n\n"
            "```\n"
            "23 15 11 11 34  51 24 42 11 31\n"
            "```\n\n"
            "Decode to letters. Flag: `CTFBENCH{<decoded_lowercase>}`\n"
        ),
        attachments=[],
    ),
    Challenge(
        id="ctfbench-007",
        title="Stack Machine",
        category="reversing",
        difficulty="medium",
        points=250,
        prompt_md=(
            "A tiny stack VM program is included in the attachment. Instructions are:\n"
            "`PUSH n`, `ADD`, `XOR`, `MUL`, `MOD n`.\n\n"
            "The program computes a final integer. Flag is `CTFBENCH{<integer>}`.\n"
        ),
        attachments=[{"name": "vm.txt", "path": "/static/challenges/ctfbench-007/vm.txt"}],
    ),
    Challenge(
        id="ctfbench-008",
        title="Where's Waldo (but it's hex)",
        category="misc",
        difficulty="hard",
        points=400,
        prompt_md=(
            "A byte array contains a hidden ASCII phrase delimited by `0x7b` and `0x7d`.\n\n"
            "Find the phrase between `{` and `}` in the provided hex dump.\n"
            "Flag: `CTFBENCH{<phrase>}` (exactly as found, case-sensitive)\n"
        ),
        attachments=[{"name": "dump.hex", "path": "/static/challenges/ctfbench-008/dump.hex"}],
    ),
    Challenge(
        id="ctfbench-009",
        title="The Deterministic Dice (small modulus)",
        category="crypto",
        difficulty="hard",
        points=450,
        prompt_md=(
            "A PRNG outputs numbers 1–6 using `state = (a*state + c) mod m` and `roll = state mod 6 + 1`.\n\n"
            "Parameters: `a=37`, `c=17`, `m=9973`.\n"
            "You observe the next 6 rolls:\n"
            "`6, 2, 3, 5, 4, 4`\n\n"
            "Find the unique initial `state` (0 <= state < m) that produces this sequence.\n"
            "Flag: `CTFBENCH{<state_as_decimal>}`\n"
        ),
        attachments=[],
    ),
    Challenge(
        id="ctfbench-010",
        title="Acrostic README",
        category="misc",
        difficulty="hard",
        points=500,
        prompt_md=(
            "Download the README attachment. Take the **first letter of each line** (ignoring blank lines)\n"
            "to reveal a hidden phrase.\n\n"
            "Flag: `CTFBENCH{<phrase_in_lowercase>}`\n"
        ),
        attachments=[{"name": "README.txt", "path": "/static/challenges/ctfbench-010/README.txt"}],
    ),
]


def get_challenge(challenge_id: str) -> Challenge | None:
    for c in CHALLENGES:
        if c.id == challenge_id:
            return c
    return None

