const express = require('express');
const path = require('path');
const { initDB } = require('./db/init');
const apiRouter = require('./routes/api');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

initDB();

app.listen(PORT, () => {
  console.log('\n🌸 さくらリフォーム 販売管理システム 起動完了');
  console.log(`📊 ブラウザで開く: http://localhost:${PORT}\n`);
});
