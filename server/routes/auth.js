const express = require('express');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const router = express.Router();
 
let db;
try { db = require('../db/index'); } catch(e) { console.log('DB 로드 실패:', e.message); }
 
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map(e => e.trim());
 
// Google OAuth 전략 설정
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: `${process.env.DOMAIN}/api/auth/google/callback`
}, (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails[0].value;
    const role = ADMIN_EMAILS.includes(email) ? 'admin' : 'user';
 
    if (!db) return done(new Error('DB 없음'));
 
    let user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    if (user) {
      db.prepare('UPDATE users SET role = ?, name = ? WHERE google_id = ?').run(role, profile.displayName, profile.id);
      user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    } else {
      db.prepare('INSERT INTO users (google_id, email, name, avatar, role) VALUES (?, ?, ?, ?, ?)').run(
        profile.id, email, profile.displayName, profile.photos?.[0]?.value || '', role
      );
      user = db.prepare('SELECT * FROM users WHERE google_id = ?').get(profile.id);
    }
    done(null, user);
  } catch(err) { done(err); }
}));
 
// Google 로그인 시작
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));
 
// Google 콜백
router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login.html?error=fail' }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user.id, email: req.user.email, role: req.user.role, name: req.user.name },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    res.redirect(`/login.html?token=${token}`);
  }
);
 
// 내 정보
router.get('/me', (req, res) => {
  const auth = req.headers.authorization?.split(' ')[1];
  if (!auth) return res.status(401).json({ error: '인증 필요' });
  try {
    const user = jwt.verify(auth, process.env.JWT_SECRET);
    res.json(user);
  } catch { res.status(401).json({ error: '토큰 만료' }); }
});
 
module.exports = router;