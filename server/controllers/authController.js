const db = require('../db/index');
const crypto = require('crypto');

// 비밀번호 해시 (crypto 내장모듈 사용, bcrypt 없이)
function hashPassword(pw) {
  return crypto.createHash('sha256').update(pw + 'ai-converter-salt').digest('hex');
}

// 간단한 토큰 생성
function generateToken(userId) {
  return crypto.createHash('sha256').update(userId + Date.now() + 'secret').digest('hex');
}

// 회원가입
const signup = (req, res) => {
  const { email, password, plan } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: '비밀번호는 8자 이상이어야 합니다.' });
  }

  // 중복 체크
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(400).json({ error: '이미 가입된 이메일입니다.' });
  }

  const hashed = hashPassword(password);
  const result = db.prepare(
    'INSERT INTO users (email, password, plan) VALUES (?, ?, ?)'
  ).run(email, hashed, plan || 'free');

  res.json({ success: true, message: '회원가입이 완료됐습니다.' });
};

// 로그인
const login = (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 틀렸습니다.' });
  }

  const hashed = hashPassword(password);
  if (user.password !== hashed) {
    return res.status(401).json({ error: '이메일 또는 비밀번호가 틀렸습니다.' });
  }

  const token = generateToken(user.id);

  // 토큰 저장
  db.prepare('UPDATE users SET token = ? WHERE id = ?').run(token, user.id);

  res.json({
    token,
    user: { id: user.id, email: user.email, plan: user.plan }
  });
};

// 대시보드 데이터
const getDashboard = (req, res) => {
  const userId = req.userId;

  const totalGenerations = db.prepare(
    'SELECT COUNT(*) as cnt FROM generations WHERE user_id = ?'
  ).get(userId)?.cnt || 0;

  const totalApiCalls = db.prepare(
    'SELECT SUM(api_calls) as total FROM usage_logs WHERE user_id = ?'
  ).get(userId)?.total || 0;

  const generations = db.prepare(
    'SELECT * FROM generations WHERE user_id = ? ORDER BY created_at DESC LIMIT 10'
  ).all(userId);

  res.json({ totalGenerations, totalApiCalls, generations });
};

module.exports = { signup, login, getDashboard };
