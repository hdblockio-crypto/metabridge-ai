const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// data 폴더 없으면 자동 생성
const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const db = new Database(path.join(dataDir, 'usage.db'));

// 스키마 자동 실행
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

console.log('DB 연결 완료');

module.exports = db;