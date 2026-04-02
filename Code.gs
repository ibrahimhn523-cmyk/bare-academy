/**
 * Code.gs — Google Apps Script
 * أكاديمية بارع | Backend API
 *
 * Deploy: Web App → Execute as Me → Anyone
 * Spreadsheet: 16us-8KcHTb6XHwOzeWlrqhzHFGyCsWv20qZT_pFN4nI
 */

// ================================================================
// الإعدادات الثابتة
// ================================================================
const CONFIG = {
  SPREADSHEET_ID : '16us-8KcHTb6XHwOzeWlrqhzHFGyCsWv20qZT_pFN4nI',
  ADMIN_PASSWORD : 'bareadmin1212',
  SHEETS: {
    PROGRAMS      : 'PROGRAMS',
    STUDENTS      : 'STUDENTS',
    SUBSCRIPTIONS : 'SUBSCRIPTIONS',
    PAYMENTS      : 'PAYMENTS',
    REGISTRATIONS : 'REGISTRATIONS',
    ATTENDANCE    : 'ATTENDANCE',
    LOGS          : 'LOGS'
  }
};

// ================================================================
// نقطة الدخول — GET (اختبار الاتصال فقط)
// ================================================================
function doGet(e) {
  return _json({ ok: true, message: 'أكاديمية بارع API — جاهز ✅' });
}

// ================================================================
// نقطة الدخول — POST (جميع العمليات)
// ================================================================
function doPost(e) {
  try {
    const body   = JSON.parse(e.postData.contents);
    const action = body.action || '';

    // ── التحقق من كلمة المرور (ما عدا ping) ──────────────────
    if (action !== 'ping') {
      const pwd = body.password || body.pwd || '';
      if (pwd !== CONFIG.ADMIN_PASSWORD) {
        return _json({ ok: false, error: 'كلمة المرور غير صحيحة' }, 401);
      }
    }

    // ── توجيه الطلبات ─────────────────────────────────────────
    switch (action) {

      // ── Ping / اختبار الاتصال ────────────────────────────────
      case 'ping':
        return _json({ ok: true, message: 'الاتصال ناجح ✅', timestamp: new Date().toISOString() });

      // ── قراءة البيانات ───────────────────────────────────────
      case 'fetchStudents':      return _json({ ok: true, data: _readSheet(CONFIG.SHEETS.STUDENTS) });
      case 'fetchSubscriptions': return _json({ ok: true, data: _readSheet(CONFIG.SHEETS.SUBSCRIPTIONS) });
      case 'fetchPayments':      return _json({ ok: true, data: _readSheet(CONFIG.SHEETS.PAYMENTS) });
      case 'fetchPrograms':      return _json({ ok: true, data: _readSheet(CONFIG.SHEETS.PROGRAMS) });
      case 'fetchLogs':          return _json({ ok: true, data: _readSheet(CONFIG.SHEETS.LOGS) });

      // ── إضافة صف ─────────────────────────────────────────────
      case 'appendRow': {
        const sheet  = body.sheet  || '';
        const values = body.values || [];
        if (!sheet || !values.length) return _json({ ok: false, error: 'بيانات ناقصة' });
        _appendRow(sheet, values);
        return _json({ ok: true, message: `تمت الإضافة في ${sheet}` });
      }

      // ── تحديث صف بناءً على id ────────────────────────────────
      case 'updateRow': {
        const sheet = body.sheet || '';
        const id    = String(body.id || '');
        const data  = body.data  || {};
        if (!sheet || !id) return _json({ ok: false, error: 'بيانات ناقصة' });
        const result = _updateRow(sheet, id, data);
        return _json({ ok: result, message: result ? 'تم التحديث' : 'السجل غير موجود' });
      }

      // ── حذف صف بناءً على id ──────────────────────────────────
      case 'deleteRow': {
        const sheet = body.sheet || '';
        const id    = String(body.id || '');
        if (!sheet || !id) return _json({ ok: false, error: 'بيانات ناقصة' });
        const result = _deleteRow(sheet, id);
        return _json({ ok: result, message: result ? 'تم الحذف' : 'السجل غير موجود' });
      }

      // ── إضافة تسجيل أولي (مع تسجيل في LOGS) ─────────────────
      case 'addRegistration': {
        const d = body.data || {};
        const regSheet = body.sheet || CONFIG.SHEETS.REGISTRATIONS;
        _ensureHeaders(regSheet, SHEET_HEADERS.REGISTRATIONS);
        const regId = _nextId(regSheet);
        _appendRow(regSheet, [
          regId, d.fullName || '', d.phone || '', d.category || '',
          d.notes || '', _now()
        ]);
        _addLog('إضافة تسجيل', `تسجيل جديد: ${d.fullName}`, 'admin');
        return _json({ ok: true, id: regId, message: `تم تسجيل ${d.fullName}` });
      }

      // ── إضافة طالب (مع تسجيل في LOGS) ──────────────────────
      case 'addStudent': {
        const d = body.data || {};
        const id = _nextId(CONFIG.SHEETS.STUDENTS);
        const row = [
          id, d.fullName || '', d.phone || '', d.category || '',
          d.status || 'نشط', d.notes || '', _now()
        ];
        _ensureHeaders(CONFIG.SHEETS.STUDENTS,
          ['id','fullName','phone','category','status','notes','createdAt']);
        _appendRow(CONFIG.SHEETS.STUDENTS, row);
        _addLog('إضافة طالب', `تسجيل الطالب: ${d.fullName}`, 'admin');
        return _json({ ok: true, id, message: `تم تسجيل ${d.fullName}` });
      }

      // ── إضافة دفعة (مع حساب المتبقي وتسجيل في LOGS) ────────
      case 'addPayment': {
        const d   = body.data || {};
        const id  = _nextId(CONFIG.SHEETS.PAYMENTS);
        const req = parseFloat(d.required || d.requiredAmount) || 0;
        const paid= parseFloat(d.paid    || d.paidAmount)      || 0;
        const rem = Math.max(0, req - paid);
        const status = paid >= req && req > 0 ? 'مسدد بالكامل'
                     : paid > 0              ? 'مسدد جزئياً'
                                             : 'لم يسدد بعد';
        const row = [
          id, d.studentId || '', d.studentName || '', d.subscriptionId || '',
          req, paid, rem, status,
          d.method || d.paymentMethod || '',
          d.notes || '',
          d.date  || d.paymentDate || _today(),
          d.installmentNum || 0,
          d.startDate || '', d.endDate || '',
          d.extraNotes || '', _now()
        ];
        _ensureHeaders(CONFIG.SHEETS.PAYMENTS, SHEET_HEADERS.PAYMENTS);
        _appendRow(CONFIG.SHEETS.PAYMENTS, row);
        _addLog('إضافة دفعة', `دفعة للطالب: ${d.studentName} — ${paid} ر.س`, 'admin');
        return _json({ ok: true, id, paymentStatus: status, remainingAmount: rem });
      }

      // ── إضافة log مباشرة ─────────────────────────────────────
      case 'addLog': {
        const op   = body.operation   || body.op || 'عملية';
        const desc = body.description || body.desc || '';
        _addLog(op, desc, 'admin');
        return _json({ ok: true, message: 'تم التسجيل في LOGS' });
      }

      // ── تحديث معلومات البرنامج ───────────────────────────────
      case 'updateProgram': {
        const d = body.data || {};
        _ensureHeaders(CONFIG.SHEETS.PROGRAMS, SHEET_HEADERS.PROGRAMS);
        const rows = _readSheet(CONFIG.SHEETS.PROGRAMS);
        if (rows.length === 0) {
          _appendRow(CONFIG.SHEETS.PROGRAMS,
            [1, d.name||'', d.startDate||'', d.endDate||'', d.durationDays||'', d.fullFee||'', d.groupCount||'', d.groups||'', 'نشط', d.notes||'', _now()]);
        } else {
          _updateRow(CONFIG.SHEETS.PROGRAMS, String(rows[0].id), d);
        }
        _addLog('تحديث البرنامج', `تحديث معلومات: ${d.name || ''}`, 'admin');
        return _json({ ok: true, message: 'تم تحديث معلومات البرنامج' });
      }

      default:
        return _json({ ok: false, error: `الإجراء غير معروف: ${action}` }, 400);
    }

  } catch (err) {
    Logger.log('doPost Error: ' + err.message + '\n' + err.stack);
    return _json({ ok: false, error: err.message }, 500);
  }
}


// ================================================================
// دوال المساعدة — الورقات
// ================================================================

/** فتح الـ Spreadsheet */
function _ss() {
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

/** الحصول على ورقة (إنشاءها إن لم تكن موجودة) */
function _sheet(name) {
  const ss = _ss();
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

/** قراءة ورقة كاملة → مصفوفة كائنات */
function _readSheet(name) {
  const sh   = _sheet(name);
  const data = sh.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(String);
  return data.slice(1)
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? String(row[i]) : ''; });
      return obj;
    })
    .filter(obj => headers.some(h => obj[h] !== ''));
}

/** إضافة صف جديد */
function _appendRow(name, values) {
  _sheet(name).appendRow(values);
}

/** تحديث صف بناءً على عمود id */
function _updateRow(sheetName, id, data) {
  const sh      = _sheet(sheetName);
  const allData = sh.getDataRange().getValues();
  if (allData.length < 2) return false;
  const headers = allData[0].map(String);
  const idCol   = headers.indexOf('id');
  if (idCol === -1) return false;

  for (let r = 1; r < allData.length; r++) {
    if (String(allData[r][idCol]) === String(id)) {
      headers.forEach((h, c) => {
        if (data[h] !== undefined) {
          sh.getRange(r + 1, c + 1).setValue(data[h]);
        }
      });
      return true;
    }
  }
  return false;
}

/** حذف صف بناءً على عمود id */
function _deleteRow(sheetName, id) {
  const sh      = _sheet(sheetName);
  const allData = sh.getDataRange().getValues();
  if (allData.length < 2) return false;
  const headers = allData[0].map(String);
  const idCol   = headers.indexOf('id');
  if (idCol === -1) return false;

  for (let r = 1; r < allData.length; r++) {
    if (String(allData[r][idCol]) === String(id)) {
      sh.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

/** الحصول على الـ ID التالي */
function _nextId(sheetName) {
  const sh      = _sheet(sheetName);
  const allData = sh.getDataRange().getValues();
  if (allData.length < 2) return 1;
  const headers = allData[0].map(String);
  const idCol   = headers.indexOf('id');
  if (idCol === -1) return allData.length;
  const ids = allData.slice(1)
    .map(row => parseInt(row[idCol]) || 0)
    .filter(n => n > 0);
  return ids.length ? Math.max(...ids) + 1 : 1;
}

/** التأكد من وجود headers (يضيفها في الصف الأول إن كانت الورقة فارغة) */
function _ensureHeaders(sheetName, headers) {
  const sh = _sheet(sheetName);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length)
      .setBackground('#2D3651')
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  }
}

/** تسجيل عملية في LOGS */
function _addLog(operation, description, performedBy) {
  _ensureHeaders(CONFIG.SHEETS.LOGS,
    ['id','operation','description','performedBy','timestamp','status']);
  const id = _nextId(CONFIG.SHEETS.LOGS);
  _appendRow(CONFIG.SHEETS.LOGS,
    [id, operation, description, performedBy || 'admin', _now(), 'نجاح']);
}


// ================================================================
// دوال المساعدة — التاريخ والوقت
// ================================================================

function _now() {
  return new Date().toISOString();
}

function _today() {
  return Utilities.formatDate(new Date(), 'Asia/Riyadh', 'yyyy-MM-dd');
}


// ================================================================
// دوال المساعدة — الاستجابة
// ================================================================

function _json(obj, statusCode) {
  const output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}


// ================================================================
// هيكل الرؤوس لكل جدول
// ================================================================
const SHEET_HEADERS = {
  PROGRAMS:      ['id','name','startDate','endDate','durationDays','fullFee','groupCount','groups','status','notes','createdAt'],
  STUDENTS:      ['id','fullName','phone','category','status','notes','createdAt'],
  SUBSCRIPTIONS: ['id','studentId','studentName','phone','category','programId','programName','paymentType','startDate','endDate','status','createdAt'],
  PAYMENTS:      ['id','studentId','studentName','subscriptionId','required','paid','remaining','paymentStatus','method','notes','date','installmentNum','startDate','endDate','extraNotes','createdAt'],
  REGISTRATIONS: ['id','fullName','phone','category','notes','createdAt'],
  ATTENDANCE:    ['id','date','programId','programName','studentId','studentName','status','notes','createdAt'],
  LOGS:          ['id','operation','description','performedBy','timestamp','status']
};

// ================================================================
// دالة الإعداد الأولي — تشغيلها مرة واحدة لبناء الورقات
// ================================================================
function setupSheets() {
  _buildSheets(CONFIG.SHEETS);
  _addLog('إعداد النظام', 'تم إنشاء ورقات الإنتاج بنجاح', 'system');
  Logger.log('✅ تم إعداد جميع أوراق الإنتاج بنجاح');
}

/** بناء مجموعة ورقات بناءً على كائن أسماء */
function _buildSheets(sheetsObj) {
  Object.entries(sheetsObj).forEach(([key, sheetName]) => {
    const headers = SHEET_HEADERS[key] || [];
    if (!headers.length) return;
    const sh = _sheet(sheetName);
    if (sh.getLastRow() === 0) {
      sh.appendRow(headers);
      sh.getRange(1, 1, 1, headers.length)
        .setBackground('#2D3651')
        .setFontColor('#ffffff')
        .setFontWeight('bold');
      sh.setFrozenRows(1);
      sh.setColumnWidth(1, 50);
    }
    Logger.log(`✅ ${sheetName} — جاهز`);
  });
}


// ================================================================
// دالة الاختبار — تشغيلها للتحقق من الإعداد
// ================================================================
function testSetup() {
  const result = {
    spreadsheet: _ss().getName(),
    sheets: Object.values(CONFIG.SHEETS).map(name => {
      const sh = _ss().getSheetByName(name);
      return { name, exists: !!sh, rows: sh ? sh.getLastRow() : 0 };
    })
  };
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
