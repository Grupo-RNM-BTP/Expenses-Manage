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

        base64ToSrc: function (sBase64Encoded) {
            if (!sBase64Encoded) {
                return "";
            }
            try {
                var decoded = atob(sBase64Encoded);
                return decoded;
            } catch (e) {
                console.error("Erro a decodificar base64:", e);
                return "";
            }
        },

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
                default: return this.getResourceBundle().getText("statusUnknown");
            }
        },

        statusState: function (iStatus) {
            iStatus = parseInt(iStatus);

            switch (iStatus) {
                case 0: return "Success";
                case 1: return "Error";
                case 2: return "Error";
                case 4: return "Error";
                case 5: return "Warning";
                case 6: return "Warning";
                case 3: return "None";
                default: return "None";
            }
        },

        statusIcon: function (iStatus) {
            iStatus = parseInt(iStatus);

            switch (iStatus) {
                case 0: return "sap-icon://status-positive";
                case 1: return "sap-icon://status-negative";
                case 2: return "sap-icon://status-negative";
                case 4: return "sap-icon://status-negative";
                case 5: return "sap-icon://status-inactive";
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
        },

        formatYearMonth: function (sYearMonth) {
            if (!sYearMonth || sYearMonth.length !== 6) {
                return sYearMonth;
            }
            var month = sYearMonth.substring(4, 6),
                months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
                monthIndex = parseInt(month, 10) - 1;

            if (monthIndex < 0 || monthIndex > 11) {
                return sYearMonth;
            }
            return months[monthIndex];
        },

        formatAmountEuro: function(fAmount) {
            debugger;
            if (typeof fAmount !== "number") {
              return fAmount;
            }
            return new Intl.NumberFormat("pt-PT", {
              style: "currency",
              currency: "EUR",
              minimumFractionDigits: 2
            }).format(fAmount);
          }
    };
});
