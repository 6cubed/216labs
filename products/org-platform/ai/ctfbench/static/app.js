function fmtUtcSeconds(s) {
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return "";
  const d = new Date(n * 1000);
  return d.toISOString().replace("T", " ").replace(".000Z", "Z");
}

function wireUtcSpans() {
  document.querySelectorAll("[data-utc]").forEach((el) => {
    const v = el.getAttribute("data-utc");
    el.textContent = fmtUtcSeconds(v);
  });
}

async function submitFlag(form) {
  const fd = new FormData(form);
  const payload = {
    challenge_id: fd.get("challenge_id"),
    name: fd.get("name"),
    contact: fd.get("contact"),
    flag: fd.get("flag"),
  };

  const status = form.querySelector("[data-flag-status]");
  status.className = "status";
  status.textContent = "Submitting…";

  const res = await fetch("/api/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  let j = null;
  try {
    j = await res.json();
  } catch {}

  if (!res.ok) {
    status.classList.add("bad");
    status.textContent = (j && j.detail) || "Submission failed.";
    return;
  }

  if (j.correct) {
    status.classList.add("ok");
    status.textContent = j.credited ? "Correct — you are the first solver. Credited on the leaderboard." : "Correct — already credited to the first solver.";
  } else {
    status.classList.add("bad");
    status.textContent = j.message || "Incorrect flag.";
  }
}

function wireForms() {
  document.querySelectorAll("form[data-submit-flag]").forEach((form) => {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      submitFlag(form).catch((err) => {
        const status = form.querySelector("[data-flag-status]");
        status.className = "status bad";
        status.textContent = err?.message || "Submission failed.";
      });
    });
  });
}

wireUtcSpans();
wireForms();

