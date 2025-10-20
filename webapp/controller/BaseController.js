sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/core/Fragment"
], function (Controller, MessageBox, Fragment) {
    "use strict";

    var CAModel;

    /**
     * BaseController: Utility controller for navigation, models, messages, and OData calls.
     *
     * @namespace zfiexpensesmanage.controller
     * @extends sap.ui.core.mvc.Controller
     */

    return Controller.extend("zfiexpensesmanage.controller.BaseController", {

        /**
         * Set OData model with token and user language.
         * @param {string} token Authentication token
         */
        setModelCA: function (token) {
            var userLanguage = sessionStorage.getItem("oLangu");
            if (!userLanguage) {
                userLanguage = "EN";
            }
            var serviceUrlWithLanguage = this.getModel().sServiceUrl + (this.getModel().sServiceUrl.includes("?") ? "&" : "?") + "sap-language=" + userLanguage;

            CAModel = new sap.ui.model.odata.v2.ODataModel({
                serviceUrl: serviceUrlWithLanguage,
                annotationURI: "/zsrv_iwfnd/Annotations(TechnicalName='ZFI_EXPENSES_ANNO_MDL',Version='0001')/$value/",
                headers: {
                    "authorization": token,
                    "applicationName": "ZFI_EXP_MNG"
                }
            });

            this.setModel(CAModel);
        },

        /**
         * Validate user authentication using backend service.
         * @param {string} type Auth type
         */
        getUserAuthentication: function (type) {
            var that = this,
                urlParams = new URLSearchParams(window.location.search),
                token = urlParams.get('token'),
                sViewName = this.getView().getParent().getParent().getLayout();

            if (sViewName.includes("OneColumn")) {
                this.getCardValues();
            }

            if (token != null) {
                var headers = new Headers();
                headers.append("X-authorization", token);

                var requestOptions = {
                    method: 'GET',
                    headers: headers,
                    redirect: 'follow'
                };

                fetch("/sap/opu/odata/sap/ZODCA_AUTHENTICATOR_SRV/USER_AUTHENTICATION", requestOptions)
                    .then(function (response) {
                        if (!response.ok) {
                            throw new Error("Ocorreu um erro ao ler a entidade.");
                        }
                        return response.text();
                    })
                    .then(function (xml) {
                        var parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xml, "text/xml"),
                            successResponseElement = xmlDoc.getElementsByTagName("d:SuccessResponse")[0],
                            response = successResponseElement.textContent;

                        if (response != 'X') {
                            that.getRouter().navTo("NotFound");
                        }
                        else {
                            that.getModel("global").setProperty("/token", token);
                        }
                    })
                    .catch(function (error) {
                        console.error(error);
                    });
            } else {
                that.getRouter().navTo("NotFound");
                return;
            }
        },

        /**
         * Get router instance.
         * @returns {sap.ui.core.routing.Router}
         */
        getRouter: function () {
            return this.getOwnerComponent().getRouter();
        },

        /**
        * Navigate to given route with optional object ID.
        * @param {string} sPath Object path
        * @param {string} oRoute Route name
        * @param {string} oEntityName Entity name
        */
        onNavigation: function (sPath, oRoute, oEntityName) {
            if (sPath) {
                this.getRouter().navTo(oRoute, {
                    objectId: sPath.replace(oEntityName, "")
                }, false, true);
            } else {
                this.getRouter().navTo(oRoute, {}, false, true);
            }
        },

        /**
         * Get view model.
         * @param {string} [sName] Model name
         * @returns {sap.ui.model.Model}
         */
        getModel: function (sName) {
            return this.getView().getModel(sName);
        },

        /**
         * Set view model.
         * @param {sap.ui.model.Model} oModel Model
         * @param {string} [sName] Model name
         * @returns {sap.ui.model.Model}
         */
        setModel: function (oModel, sName) {
            return this.getView().setModel(oModel, sName);
        },

        /**
         * Get i18n resource bundle.
         * @returns {sap.ui.model.resource.ResourceBundle}
         */
        getResourceBundle: function () {
            return this.getOwnerComponent().getModel("i18n").getResourceBundle();
        },

        /**
         * Show error message.
         * @param {object} oMessage Error message object
         */
        showErrorMessage: function (oMessage) {
            MessageBox.error(oMessage.oText, {
                title: oMessage.oTitle,
                actions: [sap.m.MessageBox.Action.OK],
                emphasizedAction: sap.m.MessageBox.Action.OK
            });
        },

        /**
       * Fetch card values from backend and update view.
       */
        getCardValues: function () {
            try {
                var oModel = this.getView().getModel();

                oModel.read("/GetCardValues", {
                    success: function (oData) {
                        this.getView().byId("idSumOfExpensesNoAttach").setText(oData.results[0].NdocV + " EUR");
                        this.getView().byId("idSumOfApprovedExpenses").setText(oData.results[0].ApprvdV + " EUR");
                        this.getView().byId("idSumOfExpensesLast30Days").setText(oData.results[0].Last30V + " EUR");
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
            } catch (error) {
                this.showErrorMessage({
                    oText: error.message,
                    oTitle: this.getResourceBundle().getText("errorTitle")
                });
            }
        },

        /**
         * Fetch sum of expenses month from backend and update view.
         */
        getSumMonth: function () {
            try {
                var oModel = this.getView().getModel(),
                    oGraficoModel = this.getView().getModel("graficoModel"),
                    iAnoAtual = new Date().getFullYear(),
                    iMesAtual = new Date().getMonth() + 1,
                    sMesAtualKey = iAnoAtual.toString() + (iMesAtual < 10 ? "0" + iMesAtual : iMesAtual);

                oModel.read("/ZFI_BCP_MOVCC", {
                    success: function (oData) {
                        var aResults = (oData.results || []).map(function (oEntry) {
                            return {
                                YearMonth: oEntry.YearMonth,
                                VYear: parseInt(oEntry.VYear, 10),
                                Amount: parseFloat(oEntry.Amt) || 0,
                                Currency: oEntry.Currency
                            };
                        });

                        var aDadosAnoAtual = aResults.filter(o => o.VYear === iAnoAtual);

                        var mGrouped = {};
                        aDadosAnoAtual.forEach(function (oItem) {
                            if (!mGrouped[oItem.YearMonth]) {
                                mGrouped[oItem.YearMonth] = {
                                    YearMonth: oItem.YearMonth,
                                    Amount: 0,
                                    Currency: oItem.Currency
                                };
                            }
                            mGrouped[oItem.YearMonth].Amount += oItem.Amount;
                        });

                        var aAgrupado = Object.values(mGrouped)
                            .map(o => ({
                                YearMonth: o.YearMonth,
                                Amount: parseFloat(o.Amount.toFixed(2)),
                                Currency: o.Currency
                            }))
                            .sort((a, b) => a.YearMonth.localeCompare(b.YearMonth));

                        var fTotalAno = aAgrupado.reduce((acc, curr) => acc + curr.Amount, 0);
                        fTotalAno = parseFloat(fTotalAno.toFixed(2));

                        var oMesAtual = aAgrupado.find(o => o.YearMonth === sMesAtualKey);
                        var fGastoMesAtual = oMesAtual ? oMesAtual.Amount : 0;
                        var sMoeda = oMesAtual ? oMesAtual.Currency : (aAgrupado[0] ? aAgrupado[0].Currency : "");

                        oGraficoModel.setProperty("/gastosPorMes", aAgrupado);
                        oGraficoModel.setProperty("/totalAno", fTotalAno);
                        oGraficoModel.setProperty("/gastoMesAtual", fGastoMesAtual);
                        oGraficoModel.setProperty("/moeda", sMoeda);

                        this.getView().byId("barChart").setVizProperties({
                            title: {
                                text: this.getResourceBundle().getText("Resumo") + " " + iAnoAtual
                            },
                            valueAxis: {
                                title: { text: sMoeda }
                            },
                            plotArea: {
                                dataLabel: { visible: true }
                            }
                        });

                    }.bind(this),

                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;
                        sap.m.MessageBox.alert(sError, { icon: "ERROR" });
                    }.bind(this)
                });
            } catch (error) {
                this.showErrorMessage({
                    oText: error.message,
                    oTitle: this.getResourceBundle().getText("errorTitle")
                });
            }
        },

        /**
        * Fetch card values from backend and update view.
        */
        onRealodData: function (sExpNo) {
            this.onGetDocument("", sExpNo);
            this.getView().getModel().refresh();
        },

        /**
       * Handle close detail.
       */
        onPressCloseDetail: function () {
            this.getModel("global").setProperty("/layout", "OneColumn");
            this.getRouter().navTo("RouteMain");
        },

        openPDF: function (sDocument) {
            var sBase64 = sDocument.split(",")[1],
                decodedPdfContent = atob(sBase64),
                byteNumbers = new Array(decodedPdfContent.length);

            for (var i = 0; i < decodedPdfContent.length; i++) {
                byteNumbers[i] = decodedPdfContent.charCodeAt(i);
            }

            var byteArray = new Uint8Array(byteNumbers),
                blob = new Blob([byteArray], { type: "application/pdf" }),
                _pdfurl = URL.createObjectURL(blob);

            if (!this._PDFViewer) {
                this._PDFViewer = new sap.m.PDFViewer({
                    width: "auto",
                    title: "Visualização de Documento",
                    showDownloadButton: false,
                    source: _pdfurl,
                    sourceType: "object"
                });
                this.getView().addDependent(this._PDFViewer);
            } else {
                this._PDFViewer.setSource(_pdfurl);
            }

            jQuery.sap.addUrlWhitelist("blob");
            this._PDFViewer.open();
        }
    });
});