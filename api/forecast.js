module.exports = async (req, res) => {
  const key = process.env.WEATHER_API_KEY;
  if (!key) {
    return res.status(500).json({ error: { message: "WEATHER_API_KEY is not set" } });
  }
  const q = req.query.q || "";
  try {
    const r = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${encodeURIComponent(q)}&days=3&aqi=no`
    );
    res.status(r.status).json(await r.json());
  } catch (err) {
    res.status(502).json({ error: { message: "Weather service unreachable" } });
  }
};
