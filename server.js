const express = require('express');
const cookieSession = require('cookie-session');
const { Pool } = require('pg');

const app = express();
const port = process.env.PORT || 3000;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost')
    ? { rejectUnauthorized: false } : false
});

app.set('trust proxy', 1);
app.use(express.json());
app.use(cookieSession({
  name: 'tpax_session',
  keys: [process.env.SESSION_SECRET || 'change-this-session-secret-before-launch'],
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000
}));

const schema = `
CREATE TABLE IF NOT EXISTS bosses (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 99),
  location TEXT NOT NULL DEFAULT '',
  respawn_hours NUMERIC(8,2) NOT NULL CHECK (respawn_hours > 0),
  last_killed TIMESTAMPTZ,
  killed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);`;

async function init() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing');
    process.exit(1);
  }
  await pool.query(schema);
}
function auth(req, res, next) {
  if (req.session && req.session.loggedIn) return next();
  res.status(401).json({ error: 'Unauthorized' });
}
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === process.env.SITE_USER && password === process.env.SITE_PASSWORD) {
    req.session = { loggedIn: true, username };
    return res.json({ ok: true });
  }
  res.status(401).json({ error: 'Неверный логин или пароль' });
});
app.post('/api/logout', (req, res) => { req.session = null; res.json({ ok: true }); });
app.get('/api/me', (req, res) => res.json({ loggedIn: !!(req.session && req.session.loggedIn) }));

app.get('/api/bosses', auth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM bosses ORDER BY name ASC');
    res.json(rows);
  } catch (e) { res.status(500).json({ error: 'Database error' }); }
});
app.post('/api/bosses', auth, async (req, res) => {
  const { name, level, location, respawn_hours } = req.body || {};
  if (!name || !Number.isInteger(Number(level)) || Number(level) < 1 || Number(level) > 99 ||
      !location || !Number.isFinite(Number(respawn_hours)) || Number(respawn_hours) <= 0) {
    return res.status(400).json({ error: 'Проверь имя, уровень, локацию и время респауна' });
  }
  try {
    const { rows } = await pool.query(
      'INSERT INTO bosses(name,level,location,respawn_hours) VALUES($1,$2,$3,$4) RETURNING *',
      [name.trim(), Number(level), location.trim(), Number(respawn_hours)]
    );
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Не удалось добавить РБ' }); }
});
app.put('/api/bosses/:id', auth, async (req, res) => {
  const { name, level, location, respawn_hours } = req.body || {};
  if (!name || !Number.isInteger(Number(level)) || Number(level) < 1 || Number(level) > 99 ||
      !location || !Number.isFinite(Number(respawn_hours)) || Number(respawn_hours) <= 0) {
    return res.status(400).json({ error: 'Проверь все поля' });
  }
  try {
    const { rows } = await pool.query(
      'UPDATE bosses SET name=$1,level=$2,location=$3,respawn_hours=$4 WHERE id=$5 RETURNING *',
      [name.trim(), Number(level), location.trim(), Number(respawn_hours), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'РБ не найден' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Не удалось изменить РБ' }); }
});
app.post('/api/bosses/:id/kill', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'UPDATE bosses SET last_killed=NOW(), killed_by=$1 WHERE id=$2 RETURNING *',
      [process.env.KILLER_LABEL || 'Tpax2000', req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'РБ не найден' });
    res.json(rows[0]);
  } catch (e) { res.status(500).json({ error: 'Не удалось отметить убийство' }); }
});
app.delete('/api/bosses/:id', auth, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM bosses WHERE id=$1', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'РБ не найден' });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Не удалось удалить РБ' }); }
});

app.use(express.static('public'));
app.get('*', (req, res) => res.sendFile(require('path').join(__dirname, 'public', 'index.html')));

init().then(() => app.listen(port, () => console.log(`Tpax2000 running on ${port}`)))
  .catch(err => { console.error(err); process.exit(1); });
