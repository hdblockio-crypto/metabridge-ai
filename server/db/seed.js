const db = require('./index');

// 테스트 유저 추가
const insert = db.prepare(`
  INSERT OR IGNORE INTO users (email, plan) VALUES (?, ?)
`);

insert.run('test@test.com', 'free');
insert.run('pro@test.com', 'pro');

console.log('테스트 데이터 추가 완료');