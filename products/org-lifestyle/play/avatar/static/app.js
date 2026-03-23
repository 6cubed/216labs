(function () {
  const stage = document.getElementById("stage");
  const faceShell = document.getElementById("faceShell");
  const mouth = document.getElementById("mouth");
  const cheeks = document.querySelectorAll(".cheek");
  const brows = document.querySelectorAll(".brow");
  const pupils = document.querySelectorAll(".pupil");
  const eyelids = document.querySelectorAll(".eyelid");
  const form = document.getElementById("chatForm");
  const input = document.getElementById("userInput");
  const sendBtn = document.getElementById("sendBtn");
  const log = document.getElementById("log");
  const statusEl = document.getElementById("status");

  /** @type {{role: string, content: string}[]} */
  let history = [];

  let audioCtx = null;
  let idleT = 0;
  let blinkTimer = null;

  function setStatus(text, isError) {
    statusEl.textContent = text || "";
    statusEl.classList.toggle("error", !!isError);
  }

  function appendLine(role, text) {
    const wrap = document.createElement("div");
    wrap.className = "msg " + (role === "You" ? "you" : "avatar");
    const r = document.createElement("div");
    r.className = "role";
    r.textContent = role;
    const c = document.createElement("div");
    c.textContent = text;
    wrap.appendChild(r);
    wrap.appendChild(c);
    log.appendChild(wrap);
    log.scrollTop = log.scrollHeight;
  }

  function scheduleBlink() {
    if (blinkTimer) clearTimeout(blinkTimer);
    const delay = 2200 + Math.random() * 3800;
    blinkTimer = setTimeout(() => {
      blink();
      scheduleBlink();
    }, delay);
  }

  function blink() {
    eyelids.forEach((el) => {
      el.style.height = "100%";
    });
    setTimeout(() => {
      eyelids.forEach((el) => {
        el.style.height = "0%";
      });
    }, 90);
  }

  function ensureAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === "suspended") {
      return audioCtx.resume();
    }
    return Promise.resolve();
  }

  function playMp3Base64(b64) {
    return ensureAudioContext().then(() => {
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      return audioCtx.decodeAudioData(buf.buffer.slice(0));
    });
  }

  function speakWithAnalysis(audioBuffer) {
    return ensureAudioContext().then(() => {
      const src = audioCtx.createBufferSource();
      src.buffer = audioBuffer;
      const gain = audioCtx.createGain();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.65;
      src.connect(analyser);
      analyser.connect(gain);
      gain.connect(audioCtx.destination);

      const data = new Uint8Array(analyser.frequencyBinCount);
      mouth.classList.add("speaking");
      cheeks.forEach((c) => c.classList.add("glow"));

      let raf = 0;
      function tick() {
        idleT += 0.045;
        analyser.getByteFrequencyData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i];
        const avg = sum / (data.length * 255);
        const amp = Math.min(1, avg * 3.2 + 0.08);
        const mouthH = 18 + amp * 52;
        mouth.style.setProperty("--mouth-h", mouthH + "%");

        const browLift = -2 - amp * 5;
        brows.forEach((b) => {
          b.style.transform =
            (b.classList.contains("left") ? "rotate(-6deg) " : "rotate(6deg) ") +
            "translateY(" +
            browLift +
            "px)";
        });

        const nod = Math.sin(idleT * 6) * amp * 2.5;
        const sway = Math.sin(idleT * 1.1) * 1.2;
        stage.style.transform =
          "rotateY(" + sway + "deg) rotateX(" + (nod * 0.4) + "deg) translateZ(0)";

        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      return new Promise((resolve) => {
        src.onended = () => {
          cancelAnimationFrame(raf);
          mouth.classList.remove("speaking");
          cheeks.forEach((c) => c.classList.remove("glow"));
          mouth.style.setProperty("--mouth-h", "28%");
          brows.forEach((b) => {
            b.style.transform = b.classList.contains("left")
              ? "rotate(-6deg)"
              : "rotate(6deg)";
          });
          stage.style.transform = "";
          resolve();
        };
        src.start(0);
      });
    });
  }

  /* Parallax pupils + face tilt from pointer */
  document.addEventListener(
    "mousemove",
    (e) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = (e.clientX - cx) / cx;
      const dy = (e.clientY - cy) / cy;
      pupils.forEach((p) => {
        p.style.transform =
          "translate(" + dx * 5 + "px, " + dy * 3 + "px)";
      });
      if (!mouth.classList.contains("speaking")) {
        faceShell.style.transform =
          "rotateY(" + dx * 6 + "deg) rotateX(" + (-dy * 4) + "deg)";
      }
    },
    { passive: true }
  );

  scheduleBlink();

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = (input.value || "").trim();
    if (!text) return;

    input.value = "";
    sendBtn.disabled = true;
    setStatus("Thinking…");

    history.push({ role: "user", content: text });
    appendLine("You", text);

    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Request failed");
      }

      const reply = data.reply || "";
      history.push({ role: "assistant", content: reply });
      appendLine("Avatar", reply);

      if (data.audio_base64 && data.audio_mime) {
        setStatus("Speaking…");
        const buf = await playMp3Base64(data.audio_base64);
        await speakWithAnalysis(buf);
        setStatus("");
      } else {
        setStatus(data.tts_error ? "Heard you — speech unavailable." : "");
        if (data.tts_error) console.warn(data.tts_error);
        /* Subtle “miming” from text length when no audio */
        mouth.classList.add("speaking");
        const dur = Math.min(3200, 400 + reply.length * 38);
        let t0 = null;
        function mime(t) {
          if (!t0) t0 = t;
          const u = (t - t0) / dur;
          if (u >= 1) {
            mouth.classList.remove("speaking");
            mouth.style.setProperty("--mouth-h", "28%");
            return;
          }
          const wobble = 0.5 + 0.5 * Math.sin(u * Math.PI * 14);
          mouth.style.setProperty("--mouth-h", 22 + wobble * 28 + "%");
          requestAnimationFrame(mime);
        }
        requestAnimationFrame(mime);
      }
    } catch (err) {
      setStatus(err.message || String(err), true);
      history.pop();
    } finally {
      sendBtn.disabled = false;
      input.focus();
    }
  });

  input.focus();
})();
