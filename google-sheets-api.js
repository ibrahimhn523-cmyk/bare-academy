/**
 * google-sheets-api.js
 * طبقة API منخفضة المستوى - الربط مع Google Apps Script
 * أكاديمية بارع
 */

const SHEETS_API = {
    SPREADSHEET_ID: '16us-8KcHTb6XHwOzeWlrqhzHFGyCsWv20qZT_pFN4nI',
    SCRIPT_URL: localStorage.getItem('appsScriptUrl') || '',

    setScriptUrl(url) {
        this.SCRIPT_URL = url;
        localStorage.setItem('appsScriptUrl', url);
    },

    async call(action, payload = {}) {
        if (!this.SCRIPT_URL) throw new Error('لم يتم تكوين رابط Apps Script');
        const url = `${this.SCRIPT_URL}?action=${encodeURIComponent(action)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ spreadsheetId: this.SPREADSHEET_ID, ...payload })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    },

    // ========== STUDENTS ==========
    async getStudents() {
        return this.call('getStudents');
    },
    async addStudent(data) {
        return this.call('addStudent', { data });
    },
    async updateStudent(rowId, data) {
        return this.call('updateStudent', { rowId, data });
    },
    async softDeleteStudent(rowId) {
        return this.call('softDeleteStudent', { rowId });
    },

    // ========== SUBSCRIPTIONS ==========
    async getSubscriptions() {
        return this.call('getSubscriptions');
    },
    async addSubscription(data) {
        return this.call('addSubscription', { data });
    },
    async updateSubscription(rowId, data) {
        return this.call('updateSubscription', { rowId, data });
    },

    // ========== PAYMENTS ==========
    async getPayments() {
        return this.call('getPayments');
    },
    async addPayment(data) {
        return this.call('addPayment', { data });
    },
    async updatePayment(rowId, data) {
        return this.call('updatePayment', { rowId, data });
    },
    async deletePayment(rowId) {
        return this.call('deletePayment', { rowId });
    },

    // ========== LOGS ==========
    async getLogs() {
        return this.call('getLogs');
    },
    async addLog(operation, description, performedBy = 'admin') {
        return this.call('addLog', {
            data: {
                operation,
                description,
                performedBy,
                timestamp: new Date().toISOString(),
                status: 'نجاح'
            }
        });
    }
};
