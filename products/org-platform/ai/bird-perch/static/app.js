(() => {
  const $ = (id) => document.getElementById(id);
  const status = $("status");
  const err = $("err");
  const results = $("results");
  const bgResults = $("bgResults");
  const meta = $("meta");
  const liveMeta = $("liveMeta");
  const liveSpecies = $("liveSpecies");
  const liveConf = $("liveConf");
  const liveTop5 = $("liveTop5");
  const liveBg5 = $("liveBg5");
  const taxStatus = $("taxStatus");

  let mediaRecorder = null;
  const chunks = [];

  let liveWs = null;
  let liveRecorder = null;
  let liveStream = null;
  let livePing = null;
  let liveActive = false;
  let liveHelloText = "";
  let liveTargetSr = 48000;

  function setErr(msg) {
    if (!msg) {
      err.hidden = true;
      err.textContent = "";
      return;
    }
    err.hidden = false;
    err.textContent = msg;
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function setLiveUiLocked(on) {
    $("btnLiveStart").disabled = on;
    $("fileIn").disabled = on;
    $("btnRec").disabled = on;
  }

  function setRecordUiLocked(on) {
    $("btnLiveStart").disabled = on;
    $("fileIn").disabled = on;
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

  async function refreshTaxonomyStatus() {
    if (!taxStatus) return;
    try {
      const r = await fetch("/api/taxonomy");
      const j = await r.json();
      taxStatus.textContent = j.present ? "taxonomy loaded" : "no taxonomy CSV yet";
    } catch {
      taxStatus.textContent = "taxonomy status failed";
    }
  }

  async function uploadTaxonomyCsv(file) {
    setErr("");
    if (!file) return;
    if (taxStatus) taxStatus.textContent = "uploading…";
    const fd = new FormData();
    fd.append("file", file, file.name || "taxonomy.csv");
    try {
      const res = await fetch("/api/taxonomy", { method: "POST", body: fd });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(j.detail || j.error || res.statusText);
      }
      if (taxStatus) taxStatus.textContent = `taxonomy saved (${j.rows} rows)`;
    } catch (e) {
      setErr(e.message || String(e));
      if (taxStatus) taxStatus.textContent = "upload failed";
    }
  }

  async function sendBlob(blob) {
    setErr("");
    status.textContent = "Uploading…";
    results.innerHTML = "";
    if (bgResults) bgResults.innerHTML = "";
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
        const title = row.species_code ? escapeHtml(row.species_code) : "";
        li.innerHTML = `<span class="match-name"${title ? ` title="${title}"` : ""}>${escapeHtml(
          row.species || ""
        )}</span>
          <span class="match-p">${(row.confidence * 100).toFixed(1)}%</span>`;
        results.appendChild(li);
      });
      if (bgResults) {
        (j.background || []).forEach((row) => {
          const li = document.createElement("li");
          li.innerHTML = `<span class="match-name">${escapeHtml(row.label || "")}</span>
            <span class="match-p">${(row.confidence * 100).toFixed(1)}%</span>`;
          bgResults.appendChild(li);
        });
      }
    } catch (e) {
      setErr(e.message || String(e));
      status.textContent = "Failed";
    }
  }

  function stopLive() {
    liveActive = false;
    if (livePing) {
      clearInterval(livePing);
      livePing = null;
    }
    if (liveRecorder && liveRecorder.state !== "inactive") {
      try {
        liveRecorder.stop();
      } catch (_) {}
    }
    liveRecorder = null;
    if (liveStream) {
      liveStream.getTracks().forEach((t) => t.stop());
      liveStream = null;
    }
    if (liveWs) {
      try {
        liveWs.close();
      } catch (_) {}
      liveWs = null;
    }
    $("btnLiveStop").disabled = true;
    $("btnLiveStart").disabled = false;
    setLiveUiLocked(false);
    setRecordUiLocked(false);
    if (!mediaRecorder || mediaRecorder.state === "inactive") {
      $("btnRec").disabled = false;
    }
    status.textContent = "Live stopped";
  }

  function renderTick(msg) {
    const top = msg.top;
    if (top && top.species) {
      liveSpecies.textContent = top.species;
      liveConf.textContent =
        typeof top.confidence === "number" ? `${(top.confidence * 100).toFixed(1)}% confidence` : "";
    } else {
      liveSpecies.textContent = "—";
      liveConf.textContent =
        typeof msg.min_conf === "number" ? `No confident match (min ${(msg.min_conf * 100).toFixed(0)}%)` : "";
    }
    liveTop5.innerHTML = "";
    (msg.top5 || []).forEach((row) => {
      const li = document.createElement("li");
      const title = row.species_code ? escapeHtml(row.species_code) : "";
      li.innerHTML = `<span class="match-name"${title ? ` title="${title}"` : ""}>${escapeHtml(
        row.species || ""
      )}</span>
        <span class="match-p">${(row.confidence * 100).toFixed(1)}%</span>`;
      liveTop5.appendChild(li);
    });
    if (liveBg5) {
      liveBg5.innerHTML = "";
      (msg.bg5 || []).forEach((row) => {
        const li = document.createElement("li");
        li.innerHTML = `<span class="match-name">${escapeHtml(row.label || "")}</span>
          <span class="match-p">${(row.confidence * 100).toFixed(1)}%</span>`;
        liveBg5.appendChild(li);
      });
    }
    if (liveHelloText && typeof msg.buffer_samples === "number") {
      liveMeta.textContent = `${liveHelloText} · buffer ~${(msg.buffer_samples / liveTargetSr).toFixed(1)}s`;
    }
  }

  async function startLive() {
    setErr("");
    if (liveActive) return;
    liveHelloText = "";
    liveSpecies.textContent = "…";
    liveConf.textContent = "";
    liveTop5.innerHTML = "";
    liveMeta.textContent = "";
    setLiveUiLocked(true);
    $("btnLiveStop").disabled = false;
    status.textContent = "Connecting live stream…";

    const proto = location.protocol === "https:" ? "wss" : "ws";
    const ws = new WebSocket(`${proto}://${location.host}/ws/listen`);
    liveWs = ws;

    ws.addEventListener("message", (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "hello") {
        liveTargetSr = typeof msg.target_sr === "number" && msg.target_sr > 0 ? msg.target_sr : 48000;
        liveHelloText = `Infer every ${msg.infer_interval_ms} ms · ring ~${msg.ring_seconds}s`;
        liveMeta.textContent = liveHelloText;
        return;
      }
      if (msg.type === "pong") return;
      if (msg.type === "tick") {
        renderTick(msg);
        return;
      }
      if (msg.type === "error") {
        setErr(msg.detail || "Live error");
      }
    });

    ws.addEventListener("error", () => {
      setErr("Live WebSocket error");
      stopLive();
    });

    ws.addEventListener("close", () => {
      if (liveActive) {
        stopLive();
      }
    });

    ws.addEventListener(
      "open",
      async () => {
        try {
          liveStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
          setErr("Microphone: " + (e.message || e));
          stopLive();
          return;
        }

        const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm";
        liveRecorder = new MediaRecorder(liveStream, { mimeType: mime });
        const sliceMs = 900;
        liveRecorder.ondataavailable = async (e) => {
          if (!e.data.size || !liveWs || liveWs.readyState !== WebSocket.OPEN) return;
          try {
            const buf = await e.data.arrayBuffer();
            liveWs.send(buf);
          } catch (_) {}
        };
        liveRecorder.start(sliceMs);

        liveActive = true;
        status.textContent = "Live — listening…";
        livePing = setInterval(() => {
          if (liveWs && liveWs.readyState === WebSocket.OPEN) {
            try {
              liveWs.send(JSON.stringify({ type: "ping" }));
            } catch (_) {}
          }
        }, 25000);
      },
      { once: true }
    );
  }

  $("btnRec").addEventListener("click", async () => {
    setErr("");
    chunks.length = 0;
    try {
      setRecordUiLocked(true);
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
        setRecordUiLocked(false);
      };
      mediaRecorder.start();
      $("btnStop").disabled = false;
      $("btnRec").disabled = true;
      status.textContent = "Recording…";
    } catch (e) {
      setErr("Microphone: " + (e.message || e));
      setRecordUiLocked(false);
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

  $("btnLiveStart").addEventListener("click", () => {
    startLive();
  });

  $("btnLiveStop").addEventListener("click", () => {
    stopLive();
  });

  const taxIn = $("taxIn");
  if (taxIn) {
    taxIn.addEventListener("change", (ev) => {
      const f = ev.target.files && ev.target.files[0];
      if (!f) return;
      uploadTaxonomyCsv(f);
      ev.target.value = "";
    });
  }

  refreshHealth();
  refreshTaxonomyStatus();
})();
