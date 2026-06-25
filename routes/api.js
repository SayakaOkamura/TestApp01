const express = require('express');
const router = express.Router();
const { getDB } = require('../db/init');

// ダッシュボード集計
router.get('/dashboard', (req, res) => {
  const db = getDB();
  const { period } = req.query;

  // 期間フィルターの日付範囲を計算
  const now = new Date();
  let dateFrom = null, dateTo = null;
  if (period === 'month') {
    dateFrom = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  } else if (period === 'last_month') {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    dateFrom = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    dateTo   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  } else if (period === 'quarter') {
    const qStart = Math.floor(now.getMonth() / 3) * 3;
    dateFrom = `${now.getFullYear()}-${String(qStart+1).padStart(2,'0')}-01`;
  }

  const pFilter = dateFrom
    ? (dateTo ? ` AND contract_date >= '${dateFrom}' AND contract_date < '${dateTo}'`
               : ` AND contract_date >= '${dateFrom}'`)
    : '';
  const iFilter = dateFrom
    ? (dateTo ? ` AND payment_date >= '${dateFrom}' AND payment_date < '${dateTo}'`
               : ` AND payment_date >= '${dateFrom}'`)
    : '';

  const contractedAmount = db.prepare(`SELECT COALESCE(SUM(contract_amount),0) as v FROM projects WHERE status='契約済'${pFilter}`).get().v;
  const receivedAmount   = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM invoices WHERE payment_status='入金済'${iFilter}`).get().v;
  const unpaidAmount     = db.prepare(`SELECT COALESCE(SUM(amount),0) as v FROM invoices WHERE payment_status='未入金'`).get().v;
  const pipelineAmount   = db.prepare(`SELECT COALESCE(SUM(estimated_amount),0) as v FROM projects WHERE status NOT IN ('契約済','失注')`).get().v;
  const projectCount     = db.prepare(`SELECT COUNT(*) as v FROM projects`).get().v;
  const activeCount      = db.prepare(`SELECT COUNT(*) as v FROM projects WHERE status NOT IN ('契約済','失注')`).get().v;

  const statusDist      = db.prepare(`SELECT status, COUNT(*) as count, COALESCE(SUM(CASE WHEN contract_amount>0 THEN contract_amount ELSE estimated_amount END),0) as amount FROM projects GROUP BY status ORDER BY count DESC`).all();
  const workTypeBreak   = db.prepare(`SELECT work_type, COALESCE(SUM(contract_amount),0) as total FROM projects WHERE status='契約済' GROUP BY work_type ORDER BY total DESC`).all();
  const staffPerf       = db.prepare(`SELECT staff, COUNT(*) as count, COALESCE(SUM(contract_amount),0) as total FROM projects WHERE status='契約済' AND staff!='' GROUP BY staff ORDER BY total DESC`).all();
  const unpaidInvoices  = db.prepare(`SELECT * FROM invoices WHERE payment_status='未入金' ORDER BY due_date ASC`).all();
  const pipelineProj    = db.prepare(`SELECT * FROM projects WHERE status NOT IN ('契約済','失注') ORDER BY probability DESC, estimated_amount DESC LIMIT 10`).all();
  const recentContracts = db.prepare(`SELECT * FROM projects WHERE status='契約済' ORDER BY contract_date DESC LIMIT 5`).all();

  res.json({
    kpi: { contractedAmount, receivedAmount, unpaidAmount, pipelineAmount, projectCount, activeCount },
    statusDist, workTypeBreak, staffPerf, unpaidInvoices, pipelineProj, recentContracts
  });
});

// ---- 案件 ----
router.get('/projects', (req, res) => {
  const { status, work_type, staff } = req.query;
  let sql = 'SELECT * FROM projects WHERE 1=1';
  const params = [];
  if (status)    { sql += ' AND status=?';    params.push(status); }
  if (work_type) { sql += ' AND work_type=?'; params.push(work_type); }
  if (staff)     { sql += ' AND staff=?';     params.push(staff); }
  sql += ' ORDER BY id DESC';
  res.json(getDB().prepare(sql).all(...params));
});

router.post('/projects', (req, res) => {
  const db = getDB();
  const f = req.body;
  const r = db.prepare(`INSERT INTO projects (name,customer_name,address,work_type,staff,status,probability,estimated_amount,first_visit_date,planned_start_date,contract_date,contract_amount,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    f.name, f.customer_name, f.address, f.work_type, f.staff, f.status,
    Number(f.probability)||0, Number(f.estimated_amount)||0,
    f.first_visit_date||null, f.planned_start_date||null, f.contract_date||null,
    Number(f.contract_amount)||0, f.notes
  );
  res.json({ id: r.lastInsertRowid });
});

router.put('/projects/:id', (req, res) => {
  const f = req.body;
  getDB().prepare(`UPDATE projects SET name=?,customer_name=?,address=?,work_type=?,staff=?,status=?,probability=?,estimated_amount=?,first_visit_date=?,planned_start_date=?,contract_date=?,contract_amount=?,notes=? WHERE id=?`).run(
    f.name, f.customer_name, f.address, f.work_type, f.staff, f.status,
    Number(f.probability)||0, Number(f.estimated_amount)||0,
    f.first_visit_date||null, f.planned_start_date||null, f.contract_date||null,
    Number(f.contract_amount)||0, f.notes, req.params.id
  );
  res.json({ success: true });
});

router.delete('/projects/:id', (req, res) => {
  getDB().prepare('DELETE FROM projects WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ---- 顧客 ----
router.get('/customers', (req, res) => {
  res.json(getDB().prepare('SELECT * FROM customers ORDER BY id DESC').all());
});

router.post('/customers', (req, res) => {
  const f = req.body;
  const r = getDB().prepare(`INSERT INTO customers (name,address,building_type,building_age,phone,email,source,staff,notes) VALUES (?,?,?,?,?,?,?,?,?)`).run(
    f.name, f.address, f.building_type, Number(f.building_age)||0, f.phone, f.email, f.source, f.staff, f.notes
  );
  res.json({ id: r.lastInsertRowid });
});

router.put('/customers/:id', (req, res) => {
  const f = req.body;
  getDB().prepare(`UPDATE customers SET name=?,address=?,building_type=?,building_age=?,phone=?,email=?,source=?,staff=?,notes=? WHERE id=?`).run(
    f.name, f.address, f.building_type, Number(f.building_age)||0, f.phone, f.email, f.source, f.staff, f.notes, req.params.id
  );
  res.json({ success: true });
});

router.delete('/customers/:id', (req, res) => {
  getDB().prepare('DELETE FROM customers WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ---- 請求・入金 ----
router.get('/invoices', (req, res) => {
  res.json(getDB().prepare('SELECT * FROM invoices ORDER BY invoice_date DESC').all());
});

router.post('/invoices', (req, res) => {
  const f = req.body;
  const r = getDB().prepare(`INSERT INTO invoices (invoice_number,project_name,customer_name,invoice_type,invoice_date,amount,due_date,payment_status,payment_date,notes) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    f.invoice_number, f.project_name, f.customer_name, f.invoice_type,
    f.invoice_date||null, Number(f.amount)||0, f.due_date||null,
    f.payment_status||'未入金', f.payment_date||null, f.notes
  );
  res.json({ id: r.lastInsertRowid });
});

router.put('/invoices/:id', (req, res) => {
  const f = req.body;
  getDB().prepare(`UPDATE invoices SET invoice_number=?,project_name=?,customer_name=?,invoice_type=?,invoice_date=?,amount=?,due_date=?,payment_status=?,payment_date=?,notes=? WHERE id=?`).run(
    f.invoice_number, f.project_name, f.customer_name, f.invoice_type,
    f.invoice_date||null, Number(f.amount)||0, f.due_date||null,
    f.payment_status, f.payment_date||null, f.notes, req.params.id
  );
  res.json({ success: true });
});

router.delete('/invoices/:id', (req, res) => {
  getDB().prepare('DELETE FROM invoices WHERE id=?').run(req.params.id);
  res.json({ success: true });
});

// ---- 社員・サービス（参照のみ） ----
router.get('/staff', (req, res) => {
  res.json(getDB().prepare('SELECT * FROM staff ORDER BY department, id').all());
});

// 担当者別稼働状況
router.get('/staff/workload', (req, res) => {
  const db = getDB();
  const salesStaff = db.prepare(`SELECT * FROM staff WHERE department='営業部' ORDER BY id`).all();
  const result = salesStaff.map(s => {
    // 案件の担当者は姓のみ（例：「佐々木」）、社員テーブルはフルネーム（「佐々木 亮」）
    // s.name LIKE (project.staff || '%') で前方一致させる
    const projects = db.prepare(`
      SELECT id, name, status, work_type, customer_name, estimated_amount, contract_amount
      FROM projects WHERE ? LIKE (staff || '%') AND status!='失注'
      ORDER BY CASE status
        WHEN '商談中' THEN 1 WHEN '見積提出済' THEN 2
        WHEN '現地調査済' THEN 3 WHEN '初回訪問済' THEN 4 WHEN '契約済' THEN 5
      END`).all(s.name);
    const active     = projects.filter(p => p.status !== '契約済');
    const contracted = projects.filter(p => p.status === '契約済');
    return { ...s, active_count: active.length, contracted_count: contracted.length, projects };
  });
  res.json(result);
});

// 担当者だけを素早く更新
router.patch('/projects/:id/staff', (req, res) => {
  getDB().prepare('UPDATE projects SET staff=? WHERE id=?').run(req.body.staff, req.params.id);
  res.json({ success: true });
});

// ステータスだけを素早く更新
router.patch('/projects/:id/status', (req, res) => {
  getDB().prepare('UPDATE projects SET status=? WHERE id=?').run(req.body.status, req.params.id);
  res.json({ success: true });
});

// 緊急度の高い案件一覧
router.get('/urgent', (req, res) => {
  const db = getDB();
  const all = db.prepare(`SELECT * FROM projects WHERE status NOT IN ('失注')`).all();

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const critical = [], warning = [];
  const seen = new Set();

  function addCritical(p, reason) {
    if (!seen.has(p.id)) { seen.add(p.id); critical.push({ ...p, urgency_reason: reason }); }
  }
  function addWarning(p, reason) {
    if (!seen.has(p.id)) { seen.add(p.id); warning.push({ ...p, urgency_reason: reason }); }
  }

  for (const p of all) {
    const notes = (p.notes || '').toLowerCase();
    const prob  = p.probability || 0;

    // 🔴 備考に緊急ワード
    if (notes.includes('急ぎ') || notes.includes('雨漏り') || notes.includes('緊急')) {
      addCritical(p, '備考：緊急対応が必要'); continue;
    }
    // 🔴 着工予定日超過（非契約済）- 日付形式が有効な場合のみ
    if (p.planned_start_date && p.status !== '契約済') {
      const pd = new Date(p.planned_start_date);
      if (!isNaN(pd) && pd < today) {
        const days = Math.floor((today - pd) / (1000 * 60 * 60 * 24));
        addCritical(p, `着工予定日を${days}日超過`); continue;
      }
    }
    // 🟠 確度70%以上の重要商談
    if (prob >= 70 && ['商談中', '見積提出済'].includes(p.status)) {
      addWarning(p, `確度${prob}%・要フォロー`); continue;
    }
    // 🟠 担当者未割り当て（進行中）
    if (!p.staff && !['契約済'].includes(p.status)) {
      addWarning(p, '担当者が未割り当て');
    }
  }

  res.json({ critical, warning, total: critical.length + warning.length });
});

router.get('/services', (req, res) => {
  res.json(getDB().prepare('SELECT * FROM services ORDER BY category, name').all());
});

// 案件に紐づく見積明細
router.get('/quotes', (req, res) => {
  const { customer_name } = req.query;
  let sql = 'SELECT * FROM quotes';
  const params = [];
  if (customer_name) { sql += ' WHERE customer_name=?'; params.push(customer_name); }
  sql += ' ORDER BY quote_number';
  res.json(getDB().prepare(sql).all(...params));
});

module.exports = router;
