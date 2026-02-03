import express from "express";

const app = express();
app.set("trust proxy", 1);
app.use(express.json({ limit: "50kb" }));

const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (!origin) return next();

  if (ALLOWED_ORIGINS.length === 0 || ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS,GET");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  }
  return res.status(403).json({ ok: false, error: "origin_not_allowed" });
});

app.get("/health", (req, res) => res.json({ ok: true }));

app.post("/lead", async (req, res) => {
  try {
    const { name, phone, dates, people, cities, msg } = req.body || {};
    if (!name || !phone) return res.status(400).json({ ok: false, error: "name_and_phone_required" });

    const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
    const TG_CHAT_ID = process.env.TG_CHAT_ID;

    if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
      return res.status(500).json({ ok: false, error: "server_not_configured" });
    }

    const citiesText = Array.isArray(cities) && cities.length ? cities.join(", ") : "— не выбрано";

    const text =
`🧾 Новая заявка (Follow the Rabbit)
Имя: ${name}
Телефон: ${phone}
Даты: ${dates || "-"}
Людей: ${people || "-"}
Города: ${citiesText}
Комментарий: ${msg || "-"}`;

    const tgRes = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text, disable_web_page_preview: true })
    });

    const tgJson = await tgRes.json();
    if (!tgJson.ok) return res.status(502).json({ ok: false, error: "telegram_failed", details: tgJson });

    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log("API listening on", PORT));
