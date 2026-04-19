(() => {
  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const err = $("err");
  const results = $("results");
  const meta = $("meta");

  let mediaRecorder = null;
  const chunks = [];

  function setErr(msg) {
    if (!msg) {
      err.hidden = true;
      err.textContent = "";
      return;
    }
    err.hidden = false;
    err.textContent = msg;
  }

  async function refreshHealth() {
    try {
      const r = await fetch("/api/health");
      const j = await r.json();
      meta.textContent = j.mock ? "mock model" : j.model === "ready" ? "model loaded" : "model lazy-load";
    } catch {
      meta.textContent = "health check failed";
    }
  }

  async function sendBlob(blob) {
    setErr("");
    status.textContent = "Uploading…";
    results.innerHTML = "";
    const fd = new FormData();
    fd.append("file", blob, "clip.webm");
    try {
      const res = await fetch("/api/identify", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.detail || j.error || res.statusText);
      }
      status.textContent = j.note || "OK";
      (j.species || []).forEach((row) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="match-name">${escapeHtml(row.species)}</span>
          <span class="match-p">${(row.confidence * 100).toFixed(1)}%</span>`;
        results.appendChild(li);
      });
    } catch (e) {
      setErr(e.message || String(e));
      status.textContent = "Failed";
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  $("btnRec").addEventListener("click", async () => {
    setErr("");
    chunks.length = 0;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
        sendBlob(blob);
      };
      mediaRecorder.start();
      $("btnStop").disabled = false;
      $("btnRec").disabled = true;
      status.textContent = "Recording…";
    } catch (e) {
      setErr("Microphone: " + (e.message || e));
    }
  });

  $("btnStop").addEventListener("click", () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    $("btnStop").disabled = true;
    $("btnRec").disabled = false;
    status.textContent = "Processing…";
  });

  $("fileIn").addEventListener("change", (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (!f) return;
    sendBlob(f);
    ev.target.value = "";
  });

  refreshHealth();
})();
