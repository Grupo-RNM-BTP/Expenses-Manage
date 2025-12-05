sap.ui.define([], function () {
    "use strict";
    return {

        /**
         * Check if there is an expense document.
         * @param {string} sExpDoc Expense document
         * @returns {boolean} True if there is an expense document
         */
        hasExpDoc: function (sExpDoc) {

            return !!sExpDoc;
        },

        /**
         * Check if there is no expense document.
         * @param {string} sExpDoc Expense document
         * @returns {boolean} True if there is no expense document
         */
        noExpDoc: function (sExpDoc) {
            return !sExpDoc;
        },

        /**
         * Check if there is no expense document approved.
         * @param {string} sExpDoc Expense document
         * @returns {boolean} True if there is no expense document approved
         */
        noExpDocApprvd: function (sExpDoc) {
            return !sExpDoc;
        },

        /**
         * Check if there is a reason.
         * @param {string} sReason Reason
         * @returns {boolean} True if there is a reason
         */
        hasReason: function (sReason) {
            return !!sReason;
        },

        /**
         * Get status text.
         * @param {number} iStatus Status
         * @returns {string} Status text
         */
        statusText: function (iStatus) {
            iStatus = parseInt(iStatus);

            switch (iStatus) {
                case 0: return this.getResourceBundle().getText("statusSuccess");
                case 1: return this.getResourceBundle().getText("statusRejected");
                case 2: return this.getResourceBundle().getText("statusDeclined");
                case 3: return this.getResourceBundle().getText("statusOthers");
                case 4: return this.getResourceBundle().getText("statusError");
                case 5: return this.getResourceBundle().getText("statusWithoutAttachment");
                case 6: return this.getResourceBundle().getText("statusPending");
                case 7: return this.getResourceBundle().getText("statusMarkedDeletion");
                case 8: return this.getResourceBundle().getText("statusPartiallyApprove");
                case 9: return this.getResourceBundle().getText("statusInvalidExpenses");
                default: return this.getResourceBundle().getText("statusUnknown");
            }
        },

        /**
         * Get status state.
         * @param {number} iStatus Status
         * @returns {string} Status state
         */
        statusState: function (iStatus) {
            iStatus = parseInt(iStatus);

            switch (iStatus) {
                case 0: return "Success";
                case 1: return "Error";
                case 2: return "Error";
                case 4: return "Error";
                case 5: return "Warning";
                case 6: return "Warning";
                case 3: return "Warning";
                case 7: return "Error";
                case 8: return "Warning";
                case 9: return "Error";
                default: return "None";
            }
        },

        /**
         * Get status icon.
         * @param {number} iStatus Status
         * @returns {string} Status icon
         */
        statusIcon: function (iStatus) {
            iStatus = parseInt(iStatus);

            switch (iStatus) {
                case 0: return "sap-icon://status-positive";
                case 1: return "sap-icon://status-negative";
                case 2: return "sap-icon://status-negative";
                case 4: return "sap-icon://status-negative";
                case 5: return "sap-icon://warning";
                case 6: return "sap-icon://warning";
                case 3: return "sap-icon://question-mark";
                case 7: return "sap-icon://status-negative";
                case 8: return "sap-icon://warning";
                default: return "";
            }
        },

        /**
         * Format date time.
         * @param {string} sValue Date time
         * @returns {string} Formatted date time
         */
        formatDateTime: function (sValue) {
            if (!sValue) {
                return "";
            }

            let oDate;

            if (sValue instanceof Date) {
                oDate = sValue;
            }
            else if (typeof sValue === "string") {
                let sDigits = sValue.replace(/[^0-9]/g, "");

                if (sDigits.length >= 14) {
                    const base14 = sDigits.substring(0, 14);

                    const year = base14.substring(0, 4);
                    const month = base14.substring(4, 6) - 1;
                    const day = base14.substring(6, 8);
                    const hour = base14.substring(8, 10);
                    const minute = base14.substring(10, 12);
                    const second = base14.substring(12, 14);

                    oDate = new Date(year, month, day, hour, minute, second);
                }
                else if (sValue.indexOf("/Date(") === 0) {
                    const iMillis = parseInt(sValue.replace(/[^0-9]/g, ""), 10);
                    oDate = new Date(iMillis);
                }
                else {
                    oDate = new Date(sValue);
                }
            }
            else {
                return sValue;
            }

            if (isNaN(oDate.getTime())) {
                return sValue;
            }

            const oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy HH:mm:ss"
            });

            return oDateFormat.format(oDate);
        },


        /**
         * Format year month.
         * @param {string} sYearMonth Year month
         * @returns {string} Formatted year month
         */
        formatYearMonth: function (sYearMonth) {
            if (!sYearMonth || sYearMonth.length !== 6) {
                return sYearMonth;
            }
            var month = sYearMonth.substring(4, 6),
                months = [this.getResourceBundle().getText("month01"), this.getResourceBundle().getText("month02"), this.getResourceBundle().getText("month03"),
                this.getResourceBundle().getText("month04"), this.getResourceBundle().getText("month05"), this.getResourceBundle().getText("month06"),
                this.getResourceBundle().getText("month07"), this.getResourceBundle().getText("month08"), this.getResourceBundle().getText("month09"),
                this.getResourceBundle().getText("month10"), this.getResourceBundle().getText("month11"), this.getResourceBundle().getText("month12")],

                monthIndex = parseInt(month, 10) - 1;

            if (monthIndex < 0 || monthIndex > 11) {
                return sYearMonth;
            }
            return months[monthIndex];
        },

        /**
         * Format date to dd/mm/yyyy.
         * @param {string} sDate Date
         * @returns {string} Formatted date
         */
        formatDateToDDMMYYYY: function (sDate) {
            if (!sDate) {
                return "";
            }

            var oDate = new Date(sDate);

            var oDateFormat = sap.ui.core.format.DateFormat.getDateInstance({
                pattern: "dd/MM/yyyy"
            });

            return oDateFormat.format(oDate);
        },

        formatDate: function (sValue) {
            if (!sValue) {
                return "";
            }

            let oDate = (sValue instanceof Date) ? sValue : new Date(sValue);

            if (isNaN(oDate.getTime())) {
                return sValue;
            }

            const dd = String(oDate.getDate()).padStart(2, "0");
            const mm = String(oDate.getMonth() + 1).padStart(2, "0");
            const yyyy = oDate.getFullYear();

            return `${dd}.${mm}.${yyyy}`;
        },

        formatValue: function (fValue, sCurrency) {
            if (fValue === null || fValue === undefined || fValue === "") {
                return "";
            }

            var nValue = parseFloat(fValue);

            var sFormatted = nValue.toFixed(2);

            return sCurrency ? sFormatted + " " + sCurrency : sFormatted;
        },

        formatCurrencyEUR: function (value) {
            if (value === null || value === undefined || value === "") {
                return "";
            }

            var number = parseFloat(value);
            if (isNaN(number)) {
                return value;
            }

            var formatted = number
                .toFixed(2)
                .replace(".", ",")
                .replace(/\B(?=(\d{3})+(?!\d))/g, ".");

            return formatted + " EUR";
        }
    };
});
