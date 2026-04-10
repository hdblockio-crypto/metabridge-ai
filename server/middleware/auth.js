const db = require('../db/index');

const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  토큰이 아닌 경우 {
    return res.status(401).json({ error: '로그인이 필요합니다.' });
  }

  const user = db.prepare('SELECT * FROM users WHERE token = ?').get(token);
  만약 (!user) {
    return res.status(401).json({ error: '유효하지 않은 의미입니다.' });
  }

  요청 사용자 ID = 사용자 ID;
  req.user = user;
  다음();
};

module.exports = { authMiddleware };