sap.ui.define([], function () {
    "use strict";
    return {

        hasExpDoc: function (sExpDoc) {
            return !!sExpDoc;
        },

        noExpDoc: function (sExpDoc) {
            return !sExpDoc;
        },

        hasReason: function (sReason) {
            return !!sReason;
        },
        statusText: function (iStatus) {
            iStatus = parseInt(iStatus);

            switch (iStatus) {
                case 0: return "Success";
                case 1: return "Rejected";
                case 2: return "Declined";
                case 3: return "Others";
                case 4: return "Error";
                case 5: return "Without Attachment";
                case 6: return "Pending";
                default: return "Unknown";
            }
        },

        statusState: function (iStatus) {
            iStatus = parseInt(iStatus);

            switch (iStatus) {
                case 0: return "Success";
                case 1:
                case 2:
                case 4: return "Error";
                case 5:
                case 6: return "Warning";
                case 3: return "None";
                default: return "None";
            }
        },

        statusIcon: function (iStatus) {
            iStatus = parseInt(iStatus); // 👈 forçar a ser número

            switch (iStatus) {
                case 0: return "sap-icon://status-positive";
                case 1:
                case 2:
                case 4: return "sap-icon://status-negative";
                case 5:
                case 6: return "sap-icon://status-inactive";
                case 3: return "sap-icon://question-mark";
                default: return "";
            }
        },

        formatDateTime: function (sValue) {
            if (!sValue) {
                return "";
            }

            let oDate;

            if (typeof sValue === "string" && sValue.length === 14) {
                var year = sValue.substring(0, 4),
                    month = sValue.substring(4, 6) - 1,
                    day = sValue.substring(6, 8),
                    hour = sValue.substring(8, 10),
                    minute = sValue.substring(10, 12),
                    second = sValue.substring(12, 14);

                oDate = new Date(year, month, day, hour, minute, second);
            }
            else if (sValue instanceof Date) {
                oDate = sValue;
            }
            else {
                return sValue;
            }

            const oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                pattern: "dd/MM/yyyy HH:mm:ss"
            });

            return oDateFormat.format(oDate);
        }
    };
});
