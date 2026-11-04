'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { google } = require('googleapis');

const app = express();
const PORT = process.env.PORT || 3001;
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '';
const SHEET_NAME = process.env.SHEET_NAME || 'Jawa Profit';
const SERVICE_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';

const COLUMNS = [
  'ID', 'Date', 'Item', 'Store', 'Total Cost', 'Qty PCs', 'Cost per PC',
  'Sell Price per PC', 'PCs Sold', 'PCs Remaining', 'Revenue', 'Profit',
  'Status', 'Notes',
];

app.use(compression());
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.use(
  rateLimit({
    windowMs: 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

let sheetsAuth = null;

function getSheetsAuth() {
  if (sheetsAuth) return sheetsAuth;
  if (!SHEET_ID || !SERVICE_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    return null;
  }
  sheetsAuth = new google.auth.GoogleAuth({
    credentials: {
      client_email: SERVICE_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return sheetsAuth;
}

function sheetsClient() {
  const auth = getSheetsAuth();
  if (!auth) return null;
  return google.sheets({ version: 'v4', auth });
}

function rangeRef(sheetName, range = 'A:N') {
  return `${sheetName}!${range}`;
}

function columnLetter(colIndex) {
  return String.fromCharCode(65 + colIndex);
}

async function readAllRows() {
  const client = sheetsClient();
  if (!client) {
    throw new Error(
      'Backend not configured. Set GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.'
    );
  }
  const res = await client.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: rangeRef(SHEET_NAME),
  });
  const values = res.data.values || [];
  if (values.length === 0) return { headers: COLUMNS, rows: [] };
  const headers = values[0];
  const rows = values.slice(1).map((v) => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = v[i] !== undefined ? v[i] : '';
    });
    return obj;
  });
  return { headers, rows };
}

async function appendRow(fields) {
  const client = sheetsClient();
  if (!client) {
    throw new Error('Backend not configured.');
  }
  const values = COLUMNS.map((c) => (fields[c] !== undefined ? fields[c] : ''));
  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: rangeRef(SHEET_NAME, 'A:N'),
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    resource: { values: [values] },
  });
  return { ok: true };
}

async function updateRowById(id, fields) {
  const client = sheetsClient();
  if (!client) {
    throw new Error('Backend not configured.');
  }
  const { rows } = await readAllRows();
  const index = rows.findIndex((r) => String(r.ID) === String(id));
  if (index === -1) throw new Error(`Row with ID ${id} not found.`);
  const rowNumber = index + 2;
  const updates = [];
  COLUMNS.forEach((c, colIndex) => {
    if (fields[c] !== undefined) {
      updates.push({
        range: `${SHEET_NAME}!${columnLetter(colIndex)}${rowNumber}`,
        values: [[String(fields[c])]],
      });
    }
  });
  if (updates.length) {
    await client.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      resource: { valueInputOption: 'USER_ENTERED', data: updates },
    });
  }
  return { ok: true, row: rowNumber };
}

// ---------- Routes ----------

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'jawa-profit-tracker',
    configured: Boolean(getSheetsAuth()),
  });
});

app.get('/api/sheet', async (req, res, next) => {
  try {
    const data = await readAllRows();
    res.json({ ok: true, ...data });
  } catch (err) {
    next(err);
  }
});

app.post('/api/sheet', async (req, res, next) => {
  try {
    const body = req.body || {};
    const item = String(body.item || '').trim();
    if (!item) {
      return res.status(400).json({ ok: false, error: 'Item is required.' });
    }

    const totalCostN = Number(body.totalCost) || 0;
    const qtyPcsN = Math.max(Number(body.qtyPcs) || 0, 0);
    const sellPriceN = Number(body.sellPrice) || 0;
    const pcsSoldN = Math.max(Number(body.pcsSold) || 0, 0);

    const costPerPc = qtyPcsN > 0 ? (totalCostN / qtyPcsN).toFixed(2) : '0';
    const pcsRemaining = Math.max(qtyPcsN - pcsSoldN, 0);
    const revenue = (pcsSoldN * sellPriceN).toFixed(2);
    const profit = (pcsSoldN * (sellPriceN - Number(costPerPc))).toFixed(2);
    const defaultStatus =
      qtyPcsN > 0 && pcsRemaining <= 0 ? 'Sold Out' : 'Active';
    const status = String(body.status || defaultStatus);

    const id =
      Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

    await appendRow({
      ID: id,
      Date: new Date().toISOString(),
      Item: item,
      Store: String(body.store || ''),
      'Total Cost': totalCostN.toFixed(2),
      'Qty PCs': qtyPcsN,
      'Cost per PC': costPerPc,
      'Sell Price per PC': sellPriceN.toFixed(2),
      'PCs Sold': pcsSoldN,
      'PCs Remaining': pcsRemaining,
      Revenue: revenue,
      Profit: profit,
      Status: status,
      Notes: String(body.notes || ''),
    });

    res.status(201).json({ ok: true, id });
  } catch (err) {
    next(err);
  }
});

app.put('/api/sheet/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatable = [
      'Item', 'Store', 'Total Cost', 'Qty PCs', 'Cost per PC',
      'Sell Price per PC', 'PCs Sold', 'PCs Remaining', 'Revenue', 'Profit',
      'Status', 'Notes',
    ];
    const fields = {};
    Object.keys(req.body || {}).forEach((k) => {
      if (updatable.includes(k)) fields[k] = req.body[k];
    });
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ ok: false, error: 'No updatable fields provided.' });
    }

    const { rows } = await readAllRows();
    const current = rows.find((r) => String(r.ID) === String(id));
    if (!current) {
      return res.status(404).json({ ok: false, error: 'Row not found.' });
    }
    const qtyPcsN = fields['Qty PCs'] !== undefined ? Number(fields['Qty PCs']) : Number(current['Qty PCs']) || 0;
    const totalCostN = fields['Total Cost'] !== undefined ? Number(fields['Total Cost']) : Number(current['Total Cost']) || 0;
    const sellPriceN = fields['Sell Price per PC'] !== undefined ? Number(fields['Sell Price per PC']) : Number(current['Sell Price per PC']) || 0;
    const pcsSoldN = fields['PCs Sold'] !== undefined ? Number(fields['PCs Sold']) : Number(current['PCs Sold']) || 0;

    fields['Cost per PC'] = qtyPcsN > 0 ? (totalCostN / qtyPcsN).toFixed(2) : current['Cost per PC'];
    fields['PCs Remaining'] = Math.max(qtyPcsN - pcsSoldN, 0);
    fields['Revenue'] = (pcsSoldN * sellPriceN).toFixed(2);
    fields['Profit'] = (pcsSoldN * (sellPriceN - Number(fields['Cost per PC']))).toFixed(2);
    if (!fields.Status) {
      fields.Status = qtyPcsN > 0 && fields['PCs Remaining'] <= 0 ? 'Sold Out' : 'Active';
    }

    await updateRowById(id, fields);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

app.delete('/api/sheet/:id', (_req, res) => {
  res
    .status(501)
    .json({ ok: false, error: 'Delete not supported; set Status to Inactive instead.' });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ ok: false, error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Jawa Profit Tracker backend listening on http://localhost:${PORT}`);
});

