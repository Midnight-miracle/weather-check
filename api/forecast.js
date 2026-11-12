export default async function handler(req, res) {
  const { q } = req.query;
  const url = `https://api.weatherapi.com/v1/forecast.json?key=${process.env.WEATHER_API_KEY}&q=${encodeURIComponent(q || "")}&days=3&aqi=no`;
  const r = await fetch(url);
  res.status(r.status).json(await r.json());
}
