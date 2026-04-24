(() => {
  const ACK = "strangerhall_safety_ack_v1";
  const gate = document.getElementById("gate");
  const app = document.getElementById("app");
  const status = document.getElementById("status");
  const topic = document.getElementById("topic");
  const log = document.getElementById("log");
  const msg = document.getElementById("msg");
  const btnFind = document.getElementById("btnFind");
  const btnSkip = document.getElementById("btnSkip");
  const btnSend = document.getElementById("btnSend");
  const btnReport = document.getElementById("btnReport");
  const btnAck = document.getElementById("btnAck");

  let ws = null;
  let matched = false;

  function line(text, cls) {
    const p = document.createElement("p");
    p.className = "line" + (cls ? " " + cls : "");
    p.textContent = text;
    log.appendChild(p);
    log.scrollTop = log.scrollHeight;
  }

  function setMatched(on) {
    matched = on;
    btnSkip.disabled = !on;
    btnReport.disabled = !on;
    msg.disabled = !on;
    btnSend.disabled = !on;
    topic.disabled = on;
    btnFind.disabled = on;
  }

  function connectWs(onOpen) {
    if (ws && ws.readyState <= 1) ws.close();
    const proto = location.protocol === "https:" ? "wss" : "ws";
    ws = new WebSocket(`${proto}://${location.host}/ws`);
    status.textContent = "Connecting…";
    ws.onopen = () => {
      status.textContent = "Connected — pick a topic and find a stranger";
      if (typeof onOpen === "function") onOpen();
    };
    ws.onclose = () => {
      status.textContent = "Disconnected — click Find stranger to reconnect";
      setMatched(false);
    };
    ws.onerror = () => {
      status.textContent = "WebSocket error";
    };
    ws.onmessage = (ev) => {
      let data;
      try {
        data = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (data.type === "queued") {
        line(`Waiting in «${data.topic}» queue…`, "sys");
        setMatched(false);
        status.textContent = "Looking for a stranger…";
      }
      if (data.type === "matched") {
        line(`Matched (topic: ${data.topic}). Say hi.`, "sys");
        setMatched(true);
        status.textContent = "In chat — be kind";
        msg.focus();
      }
      if (data.type === "chat") {
        line(`Stranger: ${data.text}`);
      }
      if (data.type === "peer_left") {
        line(`Stranger left (${data.reason || "gone"}).`, "sys");
        setMatched(false);
        status.textContent = "Partner left — find another?";
      }
      if (data.type === "error") {
        line(data.message || "Error", "sys");
      }
    };
  }

  btnAck.addEventListener("click", () => {
    try {
      localStorage.setItem(ACK, "1");
    } catch (_) {}
    gate.hidden = true;
    app.hidden = false;
    connectWs();
  });

  if (localStorage.getItem(ACK) === "1") {
    gate.hidden = true;
    app.hidden = false;
    connectWs();
  } else {
    gate.hidden = false;
  }

  btnFind.addEventListener("click", () => {
    const sendJoin = () => {
      log.innerHTML = "";
      ws.send(JSON.stringify({ type: "join", topic: topic.value }));
    };
    if (ws && ws.readyState === WebSocket.OPEN) {
      sendJoin();
      return;
    }
    connectWs(sendJoin);
  });

  btnSkip.addEventListener("click", () => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify({ type: "skip" }));
  });

  btnSend.addEventListener("click", () => {
    const t = msg.value.trim();
    if (!t || !ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify({ type: "chat", text: t }));
    line(`You: ${t}`);
    msg.value = "";
  });

  msg.addEventListener("keydown", (e) => {
    if (e.key === "Enter") btnSend.click();
  });

  btnReport.addEventListener("click", async () => {
    const reason = window.prompt("Report reason (short):", "abuse or spam");
    if (reason == null) return;
    try {
      await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason, topic: topic.value }),
      });
      line("Report sent. Thank you.", "sys");
    } catch {
      line("Report failed to send.", "sys");
    }
  });
})();
