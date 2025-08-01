sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function (Controller, MessageBox) {
    "use strict";

    return Controller.extend("zfiexpensesmanage.controller.BaseController", {

        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        showErrorMessage: function (oMessage) {
            MessageBox.error(oMessage.oText, {
                title: oMessage.oTitle,
                actions: [sap.m.MessageBox.Action.OK],
                emphasizedAction: sap.m.MessageBox.Action.OK
            });
        },

        // Format currency
        formatCurrencyEUR: function (vValue) {
            var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
                currencyCode: false
            });

            return oCurrencyFormat.format(vValue, "EUR");
        },

        // Get sum of approved expenses
        getSumOfApprovedExpenses: function () {
            var oModel = this.getView().getModel();

            oModel.read("/ZFI_EXPENSES_APPRVD", {
                success: function (oData) {
                    this.getView().byId("idSumOfApprovedExpenses").setText(this.formatCurrencyEUR(oData.results[0].Totalvalue));
                }.bind(this),
                error: function (oError) {
                    var sError = JSON.parse(oError.responseText).error.message.value;

                    sap.m.MessageBox.alert(sError, {
                        icon: "ERROR",
                        onClose: null,
                        styleClass: '',
                        initialFocus: null,
                        textDirection: sap.ui.core.TextDirection.Inherit
                    });
                }.bind(this)
            });
        },

        // Get sum of expenses without attach
        getSumOfExpensesNoAttach: function () {
            var oModel = this.getView().getModel();

            oModel.read("/ZFI_EXPENSES_SUM_NDOC", {
                success: function (oData) {
                    this.getView().byId("idSumOfExpensesNoAttach").setText(this.formatCurrencyEUR(oData.results[0].Totalvalue));
                }.bind(this),
                error: function (oError) {
                    var sError = JSON.parse(oError.responseText).error.message.value;

                    sap.m.MessageBox.alert(sError, {
                        icon: "ERROR",
                        onClose: null,
                        styleClass: '',
                        initialFocus: null,
                        textDirection: sap.ui.core.TextDirection.Inherit
                    });
                }.bind(this)
            });
        },

        // Get sum of expenses last 30 days
        getSumOfExpensesLast30Days: function () {
            var oModel = this.getView().getModel();

            oModel.read("/ZFI_EXPENSES_LAST30", {
                success: function (oData) {
                    this.getView().byId("idSumOfExpensesLast30Days").setText(this.formatCurrencyEUR(oData.results[0].Totalvalue));
                }.bind(this),
                error: function (oError) {
                    var sError = JSON.parse(oError.responseText).error.message.value;

                    sap.m.MessageBox.alert(sError, {
                        icon: "ERROR",
                        onClose: null,
                        styleClass: '',
                        initialFocus: null,
                        textDirection: sap.ui.core.TextDirection.Inherit
                    });
                }.bind(this)
            });
        },

        getSumYear: function () {
            var oModel = this.getView().getModel();
            var oGraficoModel = this.getView().getModel("graficoModel");
            var iAnoAtual = new Date().getFullYear();

            oModel.read("/ZFI_EXPENSES_BCP2", {
                success: function (oData) {
                    var aResults = oData.results;

                    var oAnoAtual = aResults.find(function (entry) {
                        return parseInt(entry.VYear) === iAnoAtual;
                    });

                    if (oAnoAtual) {
                        oGraficoModel.setProperty("/totalAno", parseFloat(oAnoAtual.Amount));
                        oGraficoModel.setProperty("/moeda", oAnoAtual.Currency);
                    } else {
                        oGraficoModel.setProperty("/totalAno", 0);
                    }
                }.bind(this),

                error: function (oError) {
                    var sError = JSON.parse(oError.responseText).error.message.value;
                    sap.m.MessageBox.alert(sError, { icon: "ERROR" });
                }.bind(this)
            });
        },

        getSumMonth: function () {
            var oModel = this.getView().getModel(),
                oGraficoModel = this.getView().getModel("graficoModel"),
                iAnoAtual = new Date().getFullYear(),
                iMesAtual = new Date().getMonth() + 1;

            oModel.read("/ZFI_EXPENSES_BCP", {
                success: function (oData) {
                    var aAllResults = oData.results;

                    var aDadosAnoAtual = aAllResults.filter(function (oEntry) {
                        return parseInt(oEntry.VYear) === iAnoAtual;
                    });

                    aDadosAnoAtual.sort(function (a, b) {
                        return parseInt(a.YearMonth) - parseInt(b.YearMonth);
                    });

                    aDadosAnoAtual.forEach(function (oEntry) {
                        oEntry.Amount = parseFloat(oEntry.Amount);
                    });

                    oGraficoModel.setProperty("/gastosPorMes", aDadosAnoAtual);

                    var sMesAtualKey = iAnoAtual.toString() + (iMesAtual < 10 ? "0" + iMesAtual : iMesAtual);
                    var oMesAtual = aDadosAnoAtual.find(function (oEntry) {
                        return oEntry.YearMonth === sMesAtualKey;
                    });

                    if (oMesAtual) {
                        oGraficoModel.setProperty("/gastoMesAtual", oMesAtual.Amount);
                        oGraficoModel.setProperty("/moeda", oMesAtual.Currency);

                        var aSemMesAtual = aDadosAnoAtual.filter(function (oEntry) {
                            return oEntry.YearMonth !== sMesAtualKey;
                        });
                        oGraficoModel.setProperty("/gastosPorMes", aSemMesAtual);
                    } else {
                        oGraficoModel.setProperty("/gastoMesAtual", 0);
                    }

                }.bind(this),

                error: function (oError) {
                    var sError = JSON.parse(oError.responseText).error.message.value;
                    sap.m.MessageBox.alert(sError, { icon: "ERROR" });
                }.bind(this)
            });
        }
    });
});