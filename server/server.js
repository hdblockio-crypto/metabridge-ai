const express = require('express');
const cors = require('cors');
const passport = require('passport');
const jwt = require('jsonwebtoken');
require('dotenv').config();
 
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(passport.initialize());
 
// DB
let db;
try { db = require('./db/index'); console.log('DB 연결 성공'); } catch(e) { console.log('DB 없음:', e.message); }
 
// JWT 인증 미들웨어
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: '인증 필요' });
  try {
    req.user = jwt.verify(auth, process.env.JWT_SECRET);
    next();
  } catch { res.status(401).json({ error: '토큰 만료' }); }
}
 
// 관리자 미들웨어
function adminMiddleware(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: '관리자 권한 필요' });
  next();
}
 
// 월 사용량 초기화
function resetMonthlyIfNeeded(userId) {
  if (!db) return;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user) return;
  const now = new Date();
  const lastReset = user.last_reset ? new Date(user.last_reset) : null;
  if (!lastReset || lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
    db.prepare('UPDATE users SET monthly_used = 0, last_reset = ? WHERE id = ?').run(now.toISOString(), userId);
  }
}
 
// Auth 라우터
const authRouter = require('./routes/auth');
app.use('/api/auth', authRouter);
 
// 사용량 조회
app.get('/api/usage', authMiddleware, (req, res) => {
  if (!db) return res.json({ used: 0, limit: 10, totalAll: 0 });
  resetMonthlyIfNeeded(req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const totalAll = db.prepare('SELECT COUNT(*) as cnt FROM usage_log WHERE user_id = ?').get(req.user.id)?.cnt || 0;
  res.json({ used: user?.monthly_used || 0, limit: user?.monthly_limit || 10, totalAll });
});
 
// 히스토리 조회
app.get('/api/history', authMiddleware, (req, res) => {
  if (!db) return res.json({ logs: [] });
  const logs = db.prepare('SELECT * FROM usage_log WHERE user_id = ? ORDER BY created_at DESC LIMIT 30').all(req.user.id);
  res.json({ logs });
});
 
// 이미지 캐시 (메모리 캐시 - 동일 이미지 재분석 방지)
const extractCache = new Map();

// 이미지 해시 생성 (간단한 체크섬)
function hashImage(base64) {
  let hash = 0;
  const sample = base64.slice(0, 500) + base64.slice(-500);
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash) + sample.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString();
}

// 카테고리별 핵심 프롬프트 (토큰 절감)
const CATEGORY_PROMPTS = {
  clothing: `의류 상품 이미지를 분석하여 JSON을 채워라. 색상, 소재, 핏, 스타일, 시즌을 중점 분석하라.`,
  shoes: `신발 상품 이미지를 분석하여 JSON을 채워라. 소재, 색상, 굽 높이, 스타일을 중점 분석하라.`,
  bag: `가방 상품 이미지를 분석하여 JSON을 채워라. 소재, 색상, 크기, 용도를 중점 분석하라.`,
  cosmetics: `화장품 상품 이미지를 분석하여 JSON을 채워라. 제품 유형, 색상, 용량을 중점 분석하라.`,
  default: `상품 이미지를 분석하여 JSON을 채워라. 눈에 보이는 정보를 정확히 추출하라.`
};

// AI 이미지 추출
app.post('/api/extract', authMiddleware, async (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB 없음' });
  resetMonthlyIfNeeded(req.user.id);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if ((user?.monthly_used || 0) >= (user?.monthly_limit || 10)) {
    return res.status(429).json({ error: '이번 달 사용량 한도를 초과했습니다.' });
  }
 
  try {
    const { imageBase64, category, fields } = req.body;
    if (!imageBase64 || !category) return res.status(400).json({ error: '이미지와 카테고리 필요' });

    // 캐시 확인
    const cacheKey = hashImage(imageBase64) + '_' + category;
    if (extractCache.has(cacheKey)) {
      console.log('[캐시 히트]', cacheKey);
      db.prepare('UPDATE users SET monthly_used = monthly_used + 1 WHERE id = ?').run(req.user.id);
      db.prepare('INSERT INTO usage_log (user_id, type, category, status) VALUES (?, ?, ?, ?)').run(req.user.id, 'extract', category, 'success');
      return res.json({ success: true, data: extractCache.get(cacheKey), cached: true });
    }

    const { OpenAI } = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const tmpl = {};
    (fields || []).forEach(f => { tmpl[f.key] = null; });

    // 카테고리별 최적화 프롬프트
    const categoryPrompt = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.default;
    const prompt = `${categoryPrompt}
규칙: 1.이미지에서 명확히 확인된 정보만 입력 2.확인 불가는 null 3.JSON 외 텍스트 출력 금지 4.한국어로 작성

${JSON.stringify(tmpl, null, 2)}`;
 
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1-mini',
      max_tokens: 2000,
      messages: [{ role: 'user', content: [
        { type: 'image_url', image_url: { url: imageBase64, detail: 'high' } },
        { type: 'text', text: prompt }
      ]}],
      response_format: { type: 'json_object' }
    });
 
    const parsed = JSON.parse(response.choices[0].message.content);

    // 캐시 저장 (최대 100개, 1시간)
    if (extractCache.size >= 100) extractCache.delete(extractCache.keys().next().value);
    extractCache.set(cacheKey, parsed);
    setTimeout(() => extractCache.delete(cacheKey), 60 * 60 * 1000);
 
    // 사용량 증가
    db.prepare('UPDATE users SET monthly_used = monthly_used + 1 WHERE id = ?').run(req.user.id);
    db.prepare('INSERT INTO usage_log (user_id, type, category, status) VALUES (?, ?, ?, ?)').run(req.user.id, 'extract', category, 'success');
 
    res.json({ success: true, data: parsed });
  } catch(err) {
    if (db) db.prepare('INSERT INTO usage_log (user_id, type, category, status) VALUES (?, ?, ?, ?)').run(req.user.id, 'extract', req.body.category || '', 'fail');
    res.status(500).json({ error: err.message });
  }
});
 
// 관리자 API
app.get('/api/admin/users', authMiddleware, adminMiddleware, (req, res) => {
  if (!db) return res.json({ users: [] });
  const users = db.prepare('SELECT id, email, name, role, monthly_used, monthly_limit, created_at FROM users').all();
  res.json({ users });
});
 
app.patch('/api/admin/users/:id/limit', authMiddleware, adminMiddleware, (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB 없음' });
  db.prepare('UPDATE users SET monthly_limit = ? WHERE id = ?').run(req.body.limit, req.params.id);
  res.json({ success: true });
});
 
app.patch('/api/admin/users/:id/role', authMiddleware, adminMiddleware, (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB 없음' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(req.body.role, req.params.id);
  res.json({ success: true });
});
 
app.get('/api/admin/logs', authMiddleware, adminMiddleware, (req, res) => {
  if (!db) return res.json({ logs: [] });
  const logs = db.prepare(`
    SELECT ul.*, u.email as userEmail 
    FROM usage_log ul LEFT JOIN users u ON ul.user_id = u.id 
    ORDER BY ul.created_at DESC LIMIT 100
  `).all();
  res.json({ logs });
});
 
app.get('/api/admin/settings', authMiddleware, adminMiddleware, (req, res) => {
  if (!db) return res.json({ defaultLimit: 10, totalCalls: 0 });
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('default_limit');
  const totalCalls = db.prepare('SELECT COUNT(*) as cnt FROM usage_log').get()?.cnt || 0;
  res.json({ defaultLimit: parseInt(setting?.value || '10'), totalCalls });
});
 
app.patch('/api/admin/settings', authMiddleware, adminMiddleware, (req, res) => {
  if (!db) return res.status(500).json({ error: 'DB 없음' });
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('default_limit', String(req.body.defaultLimit));
  res.json({ success: true });
});
 
// 헬스체크
app.get('/health', (req, res) => res.json({ status: 'ok' }));
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`MetaBridge Server running on port ${PORT}`));
 