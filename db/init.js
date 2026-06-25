const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const DB_PATH = path.join(__dirname, '../data/sakura.db');
const DATA_DIR = path.join(__dirname, '../HandsOn_資料');

let db;

function getDB() {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
    db.exec('PRAGMA journal_mode=WAL');
  }
  return db;
}

function initDB() {
  const dataDir = path.join(__dirname, '../data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

  const database = getDB();

  database.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT,
      building_type TEXT,
      building_age INTEGER,
      phone TEXT,
      email TEXT,
      source TEXT,
      staff TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS staff (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      department TEXT,
      position TEXT,
      qualification TEXT,
      extension TEXT,
      mobile TEXT,
      email TEXT
    );
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      customer_name TEXT,
      address TEXT,
      work_type TEXT,
      staff TEXT,
      status TEXT,
      probability INTEGER DEFAULT 0,
      estimated_amount INTEGER DEFAULT 0,
      first_visit_date TEXT,
      planned_start_date TEXT,
      contract_date TEXT,
      contract_amount INTEGER DEFAULT 0,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_number TEXT,
      customer_name TEXT,
      project_name TEXT,
      service_name TEXT,
      quantity REAL,
      unit_price INTEGER,
      subtotal INTEGER,
      created_date TEXT,
      expiry_date TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_number TEXT,
      project_name TEXT,
      customer_name TEXT,
      invoice_type TEXT,
      invoice_date TEXT,
      amount INTEGER DEFAULT 0,
      due_date TEXT,
      payment_status TEXT DEFAULT '未入金',
      payment_date TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      category TEXT,
      standard_price INTEGER,
      unit TEXT,
      duration TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS project_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER,
      project_name TEXT DEFAULT '',
      customer_name TEXT DEFAULT '',
      content TEXT NOT NULL,
      due_date TEXT,
      is_done INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  const count = database.prepare('SELECT COUNT(*) AS c FROM projects').get();
  if (count.c === 0) {
    console.log('Excelデータをインポート中...');
    importFromExcel(database);
    console.log('インポート完了 ✓');
  }
}

function parseDate(val) {
  if (!val) return null;
  if (typeof val === 'string' && val.trim()) return val.replace(/\//g, '-');
  if (typeof val === 'number') {
    try {
      const info = XLSX.SSF.parse_date_code(val);
      return `${info.y}-${String(info.m).padStart(2,'0')}-${String(info.d).padStart(2,'0')}`;
    } catch { return null; }
  }
  return null;
}

function parseProbability(val) {
  if (!val && val !== 0) return 0;
  if (typeof val === 'string') return parseInt(val.replace('%', '')) || 0;
  if (typeof val === 'number') return val <= 1 ? Math.round(val * 100) : Math.round(val);
  return 0;
}

function readSheet(filename) {
  const wb = XLSX.readFile(path.join(DATA_DIR, filename));
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
}

function importFromExcel(database) {
  // 社員名簿
  const staffData = readSheet('社員名簿.xlsx');
  const insStaff = database.prepare(`INSERT INTO staff (name,department,position,qualification,extension,mobile,email) VALUES (?,?,?,?,?,?,?)`);
  for (let i = 4; i < staffData.length; i++) {
    const r = staffData[i];
    if (!r[0]) continue;
    insStaff.run(r[0], r[1], r[2], r[3], String(r[4]), String(r[5]), r[6]);
  }

  // 顧客管理台帳
  const custData = readSheet('顧客管理台帳.xlsx');
  const insCust = database.prepare(`INSERT INTO customers (name,address,building_type,building_age,phone,email,source,staff,notes) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (let i = 4; i < custData.length; i++) {
    const r = custData[i];
    if (!r[0]) continue;
    insCust.run(r[0], r[1], r[2], Number(r[3])||0, String(r[4]), r[5], r[6], r[7], r[8]);
  }

  // 案件管理表
  const projData = readSheet('案件管理表.xlsx');
  const insProj = database.prepare(`INSERT INTO projects (name,customer_name,address,work_type,staff,status,probability,estimated_amount,first_visit_date,planned_start_date,contract_date,contract_amount,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let i = 4; i < projData.length; i++) {
    const r = projData[i];
    if (!r[0]) continue;
    insProj.run(r[0], r[1], r[2], r[3], r[4], r[5],
      parseProbability(r[6]), Number(r[7])||0,
      parseDate(r[8]), parseDate(r[9]), parseDate(r[10]),
      Number(r[11])||0, r[12]);
  }

  // 見積明細一覧
  const quoteData = readSheet('見積明細一覧.xlsx');
  const insQuote = database.prepare(`INSERT INTO quotes (quote_number,customer_name,project_name,service_name,quantity,unit_price,subtotal,created_date,expiry_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (let i = 4; i < quoteData.length; i++) {
    const r = quoteData[i];
    if (!r[0]) continue;
    insQuote.run(r[0], r[1], r[2], r[3], Number(r[4]), Number(r[5]), Number(r[6]), parseDate(r[7]), parseDate(r[8]), r[9]);
  }

  // 請求・入金管理表
  const invData = readSheet('請求・入金管理表.xlsx');
  const insInv = database.prepare(`INSERT INTO invoices (invoice_number,project_name,customer_name,invoice_type,invoice_date,amount,due_date,payment_status,payment_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`);
  for (let i = 4; i < invData.length; i++) {
    const r = invData[i];
    if (!r[0]) continue;
    insInv.run(r[0], r[1], r[2], r[3], parseDate(r[4]), Number(r[5])||0, parseDate(r[6]), r[7], parseDate(r[8]), r[9]);
  }

  // 工事サービス標準単価表
  const svcData = readSheet('工事サービス標準単価表.xlsx');
  const insSvc = database.prepare(`INSERT INTO services (name,category,standard_price,unit,duration,notes) VALUES (?,?,?,?,?,?)`);
  for (let i = 4; i < svcData.length; i++) {
    const r = svcData[i];
    if (!r[0]) continue;
    insSvc.run(r[0], r[1], Number(r[2])||0, r[3], r[4], r[5]);
  }
}

module.exports = { initDB, getDB };
