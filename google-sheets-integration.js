/**
 * google-sheets-integration.js
 * طبقة التكامل مع Google Sheets + localStorage كـ fallback
 * أكاديمية بارع
 */

// =============================================
// إدارة البيانات المحلية (localStorage)
// =============================================
const LOCAL_DB = {
    PREFIX: 'bare_academy_',

    get(key) {
        try {
            return JSON.parse(localStorage.getItem(this.PREFIX + key)) || [];
        } catch { return []; }
    },

    set(key, data) {
        localStorage.setItem(this.PREFIX + key, JSON.stringify(data));
    },

    nextId(key) {
        const data = this.get(key);
        if (!data.length) return 1;
        return Math.max(...data.map(d => d.id || 0)) + 1;
    }
};

// =============================================
// الحسابات التلقائية
// =============================================
const Calc = {
    /**
     * حساب تاريخ النهاية مع استثناء الخميس/الجمعة/السبت
     * @param {string} startDate - تاريخ البداية بصيغة YYYY-MM-DD
     * @param {number} days - عدد أيام الدراسة
     * @returns {string} تاريخ النهاية
     */
    calculateEndDate(startDate, days) {
        if (!startDate || !days) return '';
        let date = new Date(startDate);
        let count = 0;
        const maxIter = days * 3;
        let iter = 0;
        while (count < days && iter < maxIter) {
            date.setDate(date.getDate() + 1);
            iter++;
            const dow = date.getDay(); // 0=Sun,1=Mon,2=Tue,3=Wed,4=Thu,5=Fri,6=Sat
            if (dow !== 4 && dow !== 5 && dow !== 6) count++; // استثناء الخميس/الجمعة/السبت
        }
        return date.toISOString().split('T')[0];
    },

    /**
     * حساب المبلغ المتبقي
     */
    calculateRemaining(required, paid) {
        return Math.max(0, (parseFloat(required) || 0) - (parseFloat(paid) || 0));
    },

    /**
     * تحديد حالة الدفع تلقائياً
     */
    calculatePaymentStatus(required, paid) {
        const r = parseFloat(required) || 0;
        const p = parseFloat(paid) || 0;
        if (p <= 0) return 'لم يسدد بعد';
        if (p >= r) return 'مسدد بالكامل';
        return 'مسدد جزئياً';
    },

    /**
     * حساب عدد أيام الدراسة الفعلية بين تاريخين
     */
    countStudyDays(startDate, endDate) {
        if (!startDate || !endDate) return 0;
        let date = new Date(startDate);
        const end = new Date(endDate);
        let count = 0;
        while (date <= end) {
            const dow = date.getDay();
            if (dow !== 4 && dow !== 5 && dow !== 6) count++;
            date.setDate(date.getDate() + 1);
        }
        return count;
    }
};

// =============================================
// إدارة الطلاب (STUDENTS)
// =============================================
const StudentsDB = {
    async fetchAll() {
        if (SHEETS_API.SCRIPT_URL) {
            try {
                const res = await SHEETS_API.getStudents();
                if (res.success) {
                    LOCAL_DB.set('students', res.data);
                    return res.data;
                }
            } catch (e) { console.warn('API unavailable, using local:', e.message); }
        }
        return LOCAL_DB.get('students');
    },

    async add(data) {
        const id = LOCAL_DB.nextId('students');
        const student = {
            id,
            fullName: data.fullName,
            phone: data.phone,
            category: data.category,
            status: data.status || 'نشط',
            notes: data.notes || '',
            createdAt: new Date().toISOString()
        };
        const all = LOCAL_DB.get('students');
        all.push(student);
        LOCAL_DB.set('students', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.addStudent(student); } catch (e) { console.warn(e); }
        }
        await LogsDB.add('إضافة طالب', `تم إضافة الطالب: ${data.fullName}`);
        return student;
    },

    async update(id, data) {
        const all = LOCAL_DB.get('students');
        const idx = all.findIndex(s => s.id === id);
        if (idx === -1) throw new Error('الطالب غير موجود');
        all[idx] = { ...all[idx], ...data, updatedAt: new Date().toISOString() };
        LOCAL_DB.set('students', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.updateStudent(id, all[idx]); } catch (e) { console.warn(e); }
        }
        await LogsDB.add('تعديل طالب', `تم تعديل بيانات الطالب: ${all[idx].fullName}`);
        return all[idx];
    },

    async softDelete(id) {
        const all = LOCAL_DB.get('students');
        const idx = all.findIndex(s => s.id === id);
        if (idx === -1) throw new Error('الطالب غير موجود');
        const name = all[idx].fullName;
        all[idx].status = 'محذوف';
        all[idx].deletedAt = new Date().toISOString();
        LOCAL_DB.set('students', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.softDeleteStudent(id); } catch (e) { console.warn(e); }
        }
        await LogsDB.add('حذف طالب', `تم حذف الطالب: ${name}`);
    },

    search(query, status = '') {
        const all = LOCAL_DB.get('students');
        return all.filter(s => {
            const matchName = !query || s.fullName.includes(query) || s.phone.includes(query);
            const matchStatus = !status || s.status === status;
            return matchName && matchStatus;
        });
    }
};

// =============================================
// إدارة الاشتراكات (SUBSCRIPTIONS)
// =============================================
const SubscriptionsDB = {
    async fetchAll() {
        if (SHEETS_API.SCRIPT_URL) {
            try {
                const res = await SHEETS_API.getSubscriptions();
                if (res.success) {
                    LOCAL_DB.set('subscriptions', res.data);
                    return res.data;
                }
            } catch (e) { console.warn(e); }
        }
        return LOCAL_DB.get('subscriptions');
    },

    async add(data) {
        const id = LOCAL_DB.nextId('subscriptions');
        const endDate = Calc.calculateEndDate(data.startDate, data.durationDays);
        const sub = {
            id,
            studentId: data.studentId,
            studentName: data.studentName,
            paymentType: data.paymentType,
            durationDays: parseInt(data.durationDays),
            startDate: data.startDate,
            endDate,
            status: data.status || 'نشط',
            createdAt: new Date().toISOString()
        };
        const all = LOCAL_DB.get('subscriptions');
        all.push(sub);
        LOCAL_DB.set('subscriptions', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.addSubscription(sub); } catch (e) { console.warn(e); }
        }
        return sub;
    },

    getByStudentId(studentId) {
        return LOCAL_DB.get('subscriptions').filter(s => s.studentId === studentId);
    }
};

// =============================================
// إدارة الدفعات (PAYMENTS)
// =============================================
const PaymentsDB = {
    async fetchAll() {
        if (SHEETS_API.SCRIPT_URL) {
            try {
                const res = await SHEETS_API.getPayments();
                if (res.success) {
                    LOCAL_DB.set('payments', res.data);
                    return res.data;
                }
            } catch (e) { console.warn(e); }
        }
        return LOCAL_DB.get('payments');
    },

    async add(data) {
        const id = LOCAL_DB.nextId('payments');
        const remaining = Calc.calculateRemaining(data.requiredAmount, data.paidAmount);
        const paymentStatus = Calc.calculatePaymentStatus(data.requiredAmount, data.paidAmount);
        const payment = {
            id,
            studentId: data.studentId,
            studentName: data.studentName,
            subscriptionId: data.subscriptionId,
            durationDays: data.durationDays,
            startDate: data.startDate,
            endDate: data.endDate,
            requiredAmount: parseFloat(data.requiredAmount) || 350,
            paidAmount: parseFloat(data.paidAmount) || 0,
            remainingAmount: remaining,
            paymentMethod: data.paymentMethod,
            paymentMethodOther: data.paymentMethodOther || '',
            paymentDate: data.paymentDate || new Date().toISOString().split('T')[0],
            paymentStatus,
            notes: data.notes || '',
            createdAt: new Date().toISOString()
        };
        const all = LOCAL_DB.get('payments');
        all.push(payment);
        LOCAL_DB.set('payments', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.addPayment(payment); } catch (e) { console.warn(e); }
        }
        await LogsDB.add('إضافة دفعة', `دفعة جديدة للطالب ${data.studentName}: ${data.paidAmount} ر.س`);
        return payment;
    },

    async update(id, data) {
        const all = LOCAL_DB.get('payments');
        const idx = all.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('الدفعة غير موجودة');
        const remaining = Calc.calculateRemaining(
            data.requiredAmount || all[idx].requiredAmount,
            data.paidAmount || all[idx].paidAmount
        );
        const paymentStatus = Calc.calculatePaymentStatus(
            data.requiredAmount || all[idx].requiredAmount,
            data.paidAmount || all[idx].paidAmount
        );
        all[idx] = { ...all[idx], ...data, remainingAmount: remaining, paymentStatus, updatedAt: new Date().toISOString() };
        LOCAL_DB.set('payments', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.updatePayment(id, all[idx]); } catch (e) { console.warn(e); }
        }
        await LogsDB.add('تعديل دفعة', `تم تعديل دفعة الطالب: ${all[idx].studentName}`);
        return all[idx];
    },

    async delete(id) {
        const all = LOCAL_DB.get('payments');
        const idx = all.findIndex(p => p.id === id);
        if (idx === -1) throw new Error('الدفعة غير موجودة');
        const name = all[idx].studentName;
        all.splice(idx, 1);
        LOCAL_DB.set('payments', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.deletePayment(id); } catch (e) { console.warn(e); }
        }
        await LogsDB.add('حذف دفعة', `تم حذف دفعة الطالب: ${name}`);
    },

    search(query, status = '') {
        const all = LOCAL_DB.get('payments');
        return all.filter(p => {
            const matchName = !query || (p.studentName && p.studentName.includes(query));
            const matchStatus = !status || p.paymentStatus === status;
            return matchName && matchStatus;
        });
    },

    getStats() {
        const all = LOCAL_DB.get('payments');
        const totalRequired = all.reduce((s, p) => s + (p.requiredAmount || 0), 0);
        const totalPaid = all.reduce((s, p) => s + (p.paidAmount || 0), 0);
        const totalRemaining = all.reduce((s, p) => s + (p.remainingAmount || 0), 0);
        const rate = totalRequired > 0 ? Math.round((totalPaid / totalRequired) * 100) : 0;
        const fullyPaid = all.filter(p => p.paymentStatus === 'مسدد بالكامل').length;
        const partial = all.filter(p => p.paymentStatus === 'مسدد جزئياً').length;
        const unpaid = all.filter(p => p.paymentStatus === 'لم يسدد بعد').length;
        return { totalRequired, totalPaid, totalRemaining, rate, fullyPaid, partial, unpaid };
    }
};

// =============================================
// إدارة سجل العمليات (LOGS)
// =============================================
const LogsDB = {
    async fetchAll() {
        if (SHEETS_API.SCRIPT_URL) {
            try {
                const res = await SHEETS_API.getLogs();
                if (res.success) {
                    LOCAL_DB.set('logs', res.data);
                    return res.data;
                }
            } catch (e) { console.warn(e); }
        }
        return LOCAL_DB.get('logs');
    },

    async add(operation, description, performedBy = 'admin') {
        const id = LOCAL_DB.nextId('logs');
        const log = {
            id,
            operation,
            description,
            performedBy,
            timestamp: new Date().toISOString(),
            status: 'نجاح'
        };
        const all = LOCAL_DB.get('logs');
        all.unshift(log); // أحدث أولاً
        LOCAL_DB.set('logs', all);

        if (SHEETS_API.SCRIPT_URL) {
            try { await SHEETS_API.addLog(operation, description, performedBy); } catch (e) { console.warn(e); }
        }
        return log;
    },

    search(query, type = '', dateFrom = '', dateTo = '') {
        const all = LOCAL_DB.get('logs');
        return all.filter(log => {
            const matchQuery = !query || log.description.includes(query);
            const matchType = !type || log.operation === type;
            const logDate = log.timestamp ? log.timestamp.split('T')[0] : '';
            const matchFrom = !dateFrom || logDate >= dateFrom;
            const matchTo = !dateTo || logDate <= dateTo;
            return matchQuery && matchType && matchFrom && matchTo;
        });
    }
};
