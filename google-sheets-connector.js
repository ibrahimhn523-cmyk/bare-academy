/**
 * google-sheets-connector.js
 * أكاديمية بارع — الربط الكامل مع Google Sheets API
 *
 * القراءة:  Google Sheets REST API v4 (API Key)
 * الكتابة: Google Apps Script Web App (POST)
 * الاحتياط: localStorage عند غياب الاتصال
 */

// ================================================================
// SHEETS_CONNECTOR — الطبقة الأساسية
// ================================================================
const SHEETS_CONNECTOR = (function () {

    const SPREADSHEET_ID = '16us-8KcHTb6XHwOzeWlrqhzHFGyCsWv20qZT_pFN4nI';
    const API_KEY        = 'AIzaSyBzaTDL-gQ-Ss5LCTdnvS6ITThcO5JwRBY';
    const BASE_URL       = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`;

    const SHEETS = {
        PROGRAMS:      'PROGRAMS',
        STUDENTS:      'STUDENTS',
        SUBSCRIPTIONS: 'SUBSCRIPTIONS',
        PAYMENTS:      'PAYMENTS',
        LOGS:          'LOGS'
    };

    const SHEET_HEADERS = {
        PROGRAMS:      ['id','name','startDate','endDate','location','status','createdAt'],
        STUDENTS:      ['id','fullName','phone','category','status','notes','createdAt'],
        SUBSCRIPTIONS: ['id','studentId','studentName','paymentType','durationDays','startDate','endDate','status','createdAt'],
        PAYMENTS:      ['id','studentId','studentName','subscriptionId','requiredAmount','paidAmount','remainingAmount','paymentStatus','paymentMethod','paymentMethodOther','paymentDate','durationDays','startDate','endDate','notes','createdAt'],
        LOGS:          ['id','operation','description','performedBy','timestamp','status']
    };

    const _DEFAULT_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwleug6tXApiaOvghnOSZaw6H_HVU-xIqupeXsdBftPLuHLw4PEEksvYwz4HxlTgTsJ/exec';
    // حفظ الرابط الافتراضي في localStorage إن لم يكن موجوداً
    if (!localStorage.getItem('appsScriptUrl')) {
        localStorage.setItem('appsScriptUrl', _DEFAULT_SCRIPT_URL);
    }
    let _scriptUrl = localStorage.getItem('appsScriptUrl') || _DEFAULT_SCRIPT_URL;

    // --------------------------------------------------------
    // قراءة ورقة كاملة → مصفوفة كائنات
    // --------------------------------------------------------
    async function readSheet(sheetName, { useCache = false } = {}) {
        const cacheKey = `bare_cache_${sheetName}`;
        const url = `${BASE_URL}/values/${encodeURIComponent(sheetName)}?key=${API_KEY}`;
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            if (json.error) throw new Error(json.error.message);
            const rows = json.values || [];
            const data = rowsToObjects(rows);
            sessionStorage.setItem(cacheKey, JSON.stringify(data)); // cache للجلسة
            return data;
        } catch (e) {
            console.warn(`[Sheets] قراءة ${sheetName} فشلت:`, e.message);
            const cached = sessionStorage.getItem(cacheKey);
            if (cached) return JSON.parse(cached);
            throw e;
        }
    }

    function rowsToObjects(rows) {
        if (!rows || rows.length < 2) return [];
        const headers = rows[0].map(h => String(h).trim());
        return rows.slice(1)
            .map((row, i) => {
                const obj = { _row: i + 2 };
                headers.forEach((h, j) => { obj[h] = row[j] !== undefined ? String(row[j]) : ''; });
                return obj;
            })
            .filter(obj => headers.some(h => obj[h] !== ''));
    }

    // --------------------------------------------------------
    // إرسال أوامر عبر Google Apps Script Web App
    // --------------------------------------------------------
    async function callScript(action, data = {}) {
        if (!_scriptUrl) throw new Error('لم يتم تكوين رابط Google Apps Script بعد');
        const body = JSON.stringify({ action, ...data });
        const res = await fetch(_scriptUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body
        });
        if (!res.ok) throw new Error(`Apps Script HTTP ${res.status}`);
        const json = await res.json();
        if (json.error) throw new Error(json.error);
        return json;
    }

    function setScriptUrl(url) {
        _scriptUrl = url ? url.trim() : '';
        localStorage.setItem('appsScriptUrl', _scriptUrl);
    }

    function hasScriptUrl() { return Boolean(_scriptUrl); }

    // --------------------------------------------------------
    // الحسابات التلقائية
    // --------------------------------------------------------
    const Calc = {
        /**
         * حساب تاريخ انتهاء الاشتراك بتخطي الخميس(4) والجمعة(5) والسبت(6)
         */
        calculateEndDate(startDateStr, workingDays) {
            if (!startDateStr || !workingDays) return '';
            const date = new Date(startDateStr + 'T00:00:00');
            let counted = 0;
            const total = parseInt(workingDays) || 0;
            if (total <= 0) return startDateStr;
            while (counted < total) {
                const day = date.getDay(); // 0=أحد … 6=سبت
                if (day !== 4 && day !== 5 && day !== 6) counted++;
                if (counted < total) date.setDate(date.getDate() + 1);
            }
            return date.toISOString().split('T')[0];
        },

        /**
         * عدد الأيام المتبقية حتى تاريخ معيّن
         */
        calculateRemainingDays(endDateStr) {
            if (!endDateStr) return null;
            const today = new Date(); today.setHours(0, 0, 0, 0);
            const end = new Date(endDateStr + 'T00:00:00');
            return Math.ceil((end - today) / 86400000);
        },

        /** المبلغ المتبقي */
        calculateRemaining(required, paid) {
            return Math.max(0, (parseFloat(required) || 0) - (parseFloat(paid) || 0));
        },

        /** حالة الدفع */
        calculatePaymentStatus(required, paid) {
            const r = parseFloat(required) || 0;
            const p = parseFloat(paid) || 0;
            if (p >= r && r > 0) return 'مسدد بالكامل';
            if (p > 0) return 'مسدد جزئياً';
            return 'لم يسدد بعد';
        },

        /** حالة الاشتراك بناءً على تاريخ الانتهاء */
        calculateSubscriptionStatus(endDateStr) {
            const days = this.calculateRemainingDays(endDateStr);
            if (days === null) return 'نشط';
            if (days < 0)  return 'منتهي';
            if (days <= 3) return 'ينتهي قريباً';
            return 'نشط';
        }
    };

    return { readSheet, callScript, setScriptUrl, hasScriptUrl, SHEETS, SHEET_HEADERS, Calc };

})();


// ================================================================
// LOCAL_DB — تخزين محلي في localStorage
// ================================================================
const LOCAL_DB = {
    get(key) {
        try { return JSON.parse(localStorage.getItem(`bare_${key}`)) || []; }
        catch { return []; }
    },
    set(key, data) {
        localStorage.setItem(`bare_${key}`, JSON.stringify(data));
    },
    nextId(key) {
        const arr = this.get(key);
        return arr.length ? Math.max(...arr.map(x => parseInt(x.id) || 0)) + 1 : 1;
    }
};


// ================================================================
// StudentsDB
// ================================================================
const StudentsDB = {

    async fetchAll() {
        try {
            const rows = await SHEETS_CONNECTOR.readSheet(SHEETS_CONNECTOR.SHEETS.STUDENTS);
            const parsed = rows
                .map(r => ({
                    id: parseInt(r.id) || 0,
                    fullName:  r.fullName  || '',
                    phone:     r.phone     || '',
                    category:  r.category  || '',
                    status:    r.status    || 'نشط',
                    notes:     r.notes     || '',
                    createdAt: r.createdAt || ''
                }))
                .filter(s => s.id > 0);
            LOCAL_DB.set('students', parsed);
            return parsed;
        } catch (e) {
            console.warn('[StudentsDB] استخدام بيانات محلية:', e.message);
            return LOCAL_DB.get('students');
        }
    },

    async add(data) {
        const students = LOCAL_DB.get('students');
        const id = LOCAL_DB.nextId('students');
        const student = {
            id,
            fullName:  data.fullName,
            phone:     data.phone,
            category:  data.category,
            status:    data.status || 'نشط',
            notes:     data.notes  || '',
            createdAt: new Date().toISOString()
        };
        students.push(student);
        LOCAL_DB.set('students', students);

        _syncAppend(SHEETS_CONNECTOR.SHEETS.STUDENTS, [
            id, student.fullName, student.phone, student.category,
            student.status, student.notes, student.createdAt
        ]);

        LogsDB.add('إضافة طالب', `تم تسجيل الطالب: ${student.fullName}`);
        return student;
    },

    async update(id, data) {
        const students = LOCAL_DB.get('students');
        const idx = students.findIndex(s => s.id === id);
        if (idx === -1) throw new Error('الطالب غير موجود');
        Object.assign(students[idx], data);
        LOCAL_DB.set('students', students);

        _syncUpdate(SHEETS_CONNECTOR.SHEETS.STUDENTS, id, students[idx]);
        LogsDB.add('تعديل طالب', `تعديل بيانات: ${students[idx].fullName}`);
        return students[idx];
    },

    async softDelete(id) {
        const s = await this.update(id, { status: 'محذوف' });
        LogsDB.add('حذف طالب', `أرشفة الطالب: ${s.fullName}`);
        return s;
    },

    search(query, status) {
        let data = LOCAL_DB.get('students');
        if (status) data = data.filter(s => s.status === status);
        if (query) {
            const q = query.toLowerCase();
            data = data.filter(s =>
                s.fullName.toLowerCase().includes(q) || s.phone.includes(q)
            );
        }
        return data;
    }
};


// ================================================================
// SubscriptionsDB
// ================================================================
const SubscriptionsDB = {

    async fetchAll() {
        try {
            const rows = await SHEETS_CONNECTOR.readSheet(SHEETS_CONNECTOR.SHEETS.SUBSCRIPTIONS);
            const parsed = rows
                .map(r => ({
                    id:           parseInt(r.id) || 0,
                    studentId:    parseInt(r.studentId) || 0,
                    studentName:  r.studentName  || '',
                    paymentType:  r.paymentType  || '',
                    durationDays: parseInt(r.durationDays) || 0,
                    startDate:    r.startDate    || '',
                    endDate:      r.endDate      || '',
                    status:       r.status       || 'نشط',
                    createdAt:    r.createdAt    || ''
                }))
                .filter(s => s.id > 0)
                .map(s => ({
                    ...s,
                    status: SHEETS_CONNECTOR.Calc.calculateSubscriptionStatus(s.endDate)
                }));
            LOCAL_DB.set('subscriptions', parsed);
            return parsed;
        } catch (e) {
            console.warn('[SubscriptionsDB] استخدام بيانات محلية:', e.message);
            return LOCAL_DB.get('subscriptions');
        }
    },

    async add(data) {
        const subs = LOCAL_DB.get('subscriptions');
        const id = LOCAL_DB.nextId('subscriptions');
        const endDate = SHEETS_CONNECTOR.Calc.calculateEndDate(data.startDate, data.durationDays);
        const sub = {
            id,
            studentId:    data.studentId,
            studentName:  data.studentName  || '',
            paymentType:  data.paymentType  || '',
            durationDays: parseInt(data.durationDays) || 0,
            startDate:    data.startDate    || '',
            endDate,
            status:       SHEETS_CONNECTOR.Calc.calculateSubscriptionStatus(endDate),
            createdAt:    new Date().toISOString()
        };
        subs.push(sub);
        LOCAL_DB.set('subscriptions', subs);

        _syncAppend(SHEETS_CONNECTOR.SHEETS.SUBSCRIPTIONS, [
            id, sub.studentId, sub.studentName, sub.paymentType,
            sub.durationDays, sub.startDate, sub.endDate, sub.status, sub.createdAt
        ]);

        return sub;
    },

    getByStudentId(studentId) {
        return LOCAL_DB.get('subscriptions').filter(s => s.studentId === studentId);
    }
};


// ================================================================
// PaymentsDB
// ================================================================
const PaymentsDB = {

    async fetchAll() {
        try {
            const rows = await SHEETS_CONNECTOR.readSheet(SHEETS_CONNECTOR.SHEETS.PAYMENTS);
            const parsed = rows
                .map(r => ({
                    id:                parseInt(r.id) || 0,
                    studentId:         parseInt(r.studentId) || 0,
                    studentName:       r.studentName       || '',
                    subscriptionId:    parseInt(r.subscriptionId) || 0,
                    requiredAmount:    parseFloat(r.requiredAmount) || 0,
                    paidAmount:        parseFloat(r.paidAmount)     || 0,
                    remainingAmount:   parseFloat(r.remainingAmount)|| 0,
                    paymentStatus:     r.paymentStatus     || 'لم يسدد بعد',
                    paymentMethod:     r.paymentMethod     || '',
                    paymentMethodOther:r.paymentMethodOther|| '',
                    paymentDate:       r.paymentDate       || '',
                    durationDays:      parseInt(r.durationDays) || 0,
                    startDate:         r.startDate         || '',
                    endDate:           r.endDate           || '',
                    notes:             r.notes             || '',
                    createdAt:         r.createdAt         || ''
                }))
                .filter(p => p.id > 0)
                .map(p => ({
                    ...p,
                    remainingAmount: SHEETS_CONNECTOR.Calc.calculateRemaining(p.requiredAmount, p.paidAmount),
                    paymentStatus:   SHEETS_CONNECTOR.Calc.calculatePaymentStatus(p.requiredAmount, p.paidAmount)
                }));
            LOCAL_DB.set('payments', parsed);
            return parsed;
        } catch (e) {
            console.warn('[PaymentsDB] استخدام بيانات محلية:', e.message);
            return LOCAL_DB.get('payments');
        }
    },

    async add(data) {
        const payments = LOCAL_DB.get('payments');
        const id = LOCAL_DB.nextId('payments');
        const remaining = SHEETS_CONNECTOR.Calc.calculateRemaining(data.requiredAmount, data.paidAmount);
        const status    = SHEETS_CONNECTOR.Calc.calculatePaymentStatus(data.requiredAmount, data.paidAmount);
        const payment = {
            id,
            studentId:          data.studentId          || 0,
            studentName:        data.studentName        || '',
            subscriptionId:     data.subscriptionId     || 0,
            requiredAmount:     parseFloat(data.requiredAmount) || 0,
            paidAmount:         parseFloat(data.paidAmount)     || 0,
            remainingAmount:    remaining,
            paymentStatus:      status,
            paymentMethod:      data.paymentMethod      || '',
            paymentMethodOther: data.paymentMethodOther || '',
            paymentDate:        data.paymentDate        || new Date().toISOString().split('T')[0],
            durationDays:       data.durationDays       || '',
            startDate:          data.startDate          || '',
            endDate:            data.endDate            || '',
            notes:              data.notes              || '',
            createdAt:          new Date().toISOString()
        };
        payments.push(payment);
        LOCAL_DB.set('payments', payments);

        _syncAppend(SHEETS_CONNECTOR.SHEETS.PAYMENTS, [
            id, payment.studentId, payment.studentName, payment.subscriptionId,
            payment.requiredAmount, payment.paidAmount, payment.remainingAmount,
            payment.paymentStatus, payment.paymentMethod, payment.paymentMethodOther,
            payment.paymentDate, payment.durationDays, payment.startDate, payment.endDate,
            payment.notes, payment.createdAt
        ]);

        LogsDB.add('إضافة دفعة', `دفعة للطالب: ${payment.studentName} — ${payment.paidAmount.toLocaleString()} ر.س`);
        return payment;
    },

    async update(id, data) {
        const payments = LOCAL_DB.get('payments');
        const idx = payments.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('الدفعة غير موجودة');

        // إعادة حساب المتبقي والحالة
        const req  = data.requiredAmount ?? payments[idx].requiredAmount;
        const paid = data.paidAmount     ?? payments[idx].paidAmount;
        data.remainingAmount = SHEETS_CONNECTOR.Calc.calculateRemaining(req, paid);
        data.paymentStatus   = SHEETS_CONNECTOR.Calc.calculatePaymentStatus(req, paid);

        Object.assign(payments[idx], data);
        LOCAL_DB.set('payments', payments);

        _syncUpdate(SHEETS_CONNECTOR.SHEETS.PAYMENTS, id, payments[idx]);
        LogsDB.add('تعديل دفعة', `تعديل دفعة الطالب: ${payments[idx].studentName}`);
        return payments[idx];
    },

    async delete(id) {
        const payments = LOCAL_DB.get('payments');
        const p = payments.find(x => x.id === id);
        LOCAL_DB.set('payments', payments.filter(x => x.id !== id));

        _syncDelete(SHEETS_CONNECTOR.SHEETS.PAYMENTS, id);
        if (p) LogsDB.add('حذف دفعة', `حذف دفعة الطالب: ${p.studentName}`);
    },

    search(query, status) {
        let data = LOCAL_DB.get('payments');
        if (status) data = data.filter(p => p.paymentStatus === status);
        if (query) {
            const q = query.toLowerCase();
            data = data.filter(p => (p.studentName || '').toLowerCase().includes(q));
        }
        return data;
    },

    getStats() {
        const data = LOCAL_DB.get('payments');
        const totalRequired  = data.reduce((s, p) => s + (p.requiredAmount  || 0), 0);
        const totalPaid      = data.reduce((s, p) => s + (p.paidAmount      || 0), 0);
        const totalRemaining = data.reduce((s, p) => s + (p.remainingAmount || 0), 0);
        const rate = totalRequired > 0 ? Math.round((totalPaid / totalRequired) * 100) : 0;
        const fullyPaid = data.filter(p => p.paymentStatus === 'مسدد بالكامل').length;
        const partial   = data.filter(p => p.paymentStatus === 'مسدد جزئياً').length;
        const unpaid    = data.filter(p => p.paymentStatus === 'لم يسدد بعد').length;
        return { totalRequired, totalPaid, totalRemaining, rate, fullyPaid, partial, unpaid };
    }
};


// ================================================================
// LogsDB
// ================================================================
const LogsDB = {

    async fetchAll() {
        try {
            const rows = await SHEETS_CONNECTOR.readSheet(SHEETS_CONNECTOR.SHEETS.LOGS);
            const parsed = rows
                .map(r => ({
                    id:          parseInt(r.id) || 0,
                    operation:   r.operation   || '',
                    description: r.description || '',
                    performedBy: r.performedBy || 'admin',
                    timestamp:   r.timestamp   || '',
                    status:      r.status      || 'نجاح'
                }))
                .filter(l => l.id > 0)
                .reverse(); // الأحدث أولاً
            LOCAL_DB.set('logs', parsed);
            return parsed;
        } catch (e) {
            console.warn('[LogsDB] استخدام بيانات محلية:', e.message);
            return LOCAL_DB.get('logs');
        }
    },

    add(operation, description, status = 'نجاح') {
        const logs = LOCAL_DB.get('logs');
        const id   = LOCAL_DB.nextId('logs');
        const entry = {
            id,
            operation,
            description,
            performedBy: 'admin',
            timestamp:   new Date().toISOString(),
            status
        };
        logs.unshift(entry);
        LOCAL_DB.set('logs', logs.slice(0, 1000));

        // مزامنة صامتة — لا نريد أن تسبب logs فاشلة حلقة لا نهائية
        if (SHEETS_CONNECTOR.hasScriptUrl()) {
            SHEETS_CONNECTOR.callScript('appendRow', {
                sheet: SHEETS_CONNECTOR.SHEETS.LOGS,
                values: [id, operation, description, 'admin', entry.timestamp, status]
            }).catch(() => {});
        }

        return entry;
    },

    search(query, type, dateFrom, dateTo) {
        let data = LOCAL_DB.get('logs');
        if (type)     data = data.filter(l => l.operation === type);
        if (query) {
            const q = query.toLowerCase();
            data = data.filter(l =>
                l.description.toLowerCase().includes(q) || l.operation.includes(q)
            );
        }
        if (dateFrom) data = data.filter(l => l.timestamp >= dateFrom);
        if (dateTo)   data = data.filter(l => l.timestamp <= dateTo + 'T23:59:59');
        return data;
    }
};


// ================================================================
// ProgramsDB
// ================================================================
const ProgramsDB = {
    async fetch() {
        try {
            const rows = await SHEETS_CONNECTOR.readSheet(SHEETS_CONNECTOR.SHEETS.PROGRAMS);
            if (rows.length) {
                const prog = rows[0];
                localStorage.setItem('bare_program', JSON.stringify({
                    name:     prog.name     || '',
                    start:    prog.startDate|| '',
                    end:      prog.endDate  || '',
                    location: prog.location || '',
                    status:   prog.status   || ''
                }));
            }
            return rows;
        } catch (e) {
            console.warn('[ProgramsDB] استخدام بيانات محلية:', e.message);
            return [];
        }
    }
};


// ================================================================
// دوال المزامنة الداخلية (تعمل صامتة في الخلفية)
// ================================================================
function _syncAppend(sheet, values) {
    if (!SHEETS_CONNECTOR.hasScriptUrl()) return;
    SHEETS_CONNECTOR.callScript('appendRow', { sheet, values }).catch(e =>
        console.warn(`[Sync] appendRow ${sheet} فشل:`, e.message)
    );
}

function _syncUpdate(sheet, id, data) {
    if (!SHEETS_CONNECTOR.hasScriptUrl()) return;
    SHEETS_CONNECTOR.callScript('updateRow', { sheet, id, data }).catch(e =>
        console.warn(`[Sync] updateRow ${sheet} فشل:`, e.message)
    );
}

function _syncDelete(sheet, id) {
    if (!SHEETS_CONNECTOR.hasScriptUrl()) return;
    SHEETS_CONNECTOR.callScript('deleteRow', { sheet, id }).catch(e =>
        console.warn(`[Sync] deleteRow ${sheet} فشل:`, e.message)
    );
}


// ================================================================
// SHEETS_API — واجهة متوافقة مع الكود القديم
// ================================================================
const SHEETS_API = {
    setScriptUrl(url) { SHEETS_CONNECTOR.setScriptUrl(url); },
    async call(action, data) { return SHEETS_CONNECTOR.callScript(action, data); }
};


// ================================================================
// Calc — متوافق مع الكود القديم
// ================================================================
const Calc = SHEETS_CONNECTOR.Calc;
