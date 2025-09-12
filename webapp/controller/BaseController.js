sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function (Controller, MessageBox) {
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
         * Fetch sum of expenses year from backend and update view.
         */
        getSumYear: function () {
            try {
                var oModel = this.getView().getModel(),
                    oGraficoModel = this.getView().getModel("graficoModel"),
                    iAnoAtual = new Date().getFullYear();

                oModel.read("/ZFI_EXPENSES_BCP2", {
                    success: function (oData) {
                        var aResults = oData.results;

                        var oAnoAtual = aResults.find(function (entry) {
                            return parseInt(entry.VYear) === iAnoAtual;
                        });

                        if (oAnoAtual) {
                            var fAmount = parseFloat(oAnoAtual.Amount) || 0;
                            oGraficoModel.setProperty("/totalAno", fAmount);
                            oGraficoModel.setProperty("/moeda", oAnoAtual.Currency || "");
                        } else {
                            oGraficoModel.setProperty("/totalAno", 0);
                            oGraficoModel.setProperty("/moeda", "");
                        }
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
                    iMesAtual = new Date().getMonth() + 1;

                oModel.read("/ZFI_EXPENSES_BCP", {
                    success: function (oData) {
                        var aAllResults = oData.results || [];

                        var aDadosAnoAtual = aAllResults.filter(function (oEntry) {
                            return parseInt(oEntry.VYear, 10) === iAnoAtual;
                        });

                        aDadosAnoAtual.sort(function (a, b) {
                            return parseInt(a.YearMonth, 10) - parseInt(b.YearMonth, 10);
                        });

                        aDadosAnoAtual.forEach(function (oEntry) {
                            oEntry.Amount = parseFloat(oEntry.Amount) || 0;
                        });

                        oGraficoModel.setProperty("/gastosPorMes", aDadosAnoAtual);

                        var sMesAtualKey = iAnoAtual.toString() + (iMesAtual < 10 ? "0" + iMesAtual : iMesAtual);
                        var oMesAtual = aDadosAnoAtual.find(function (oEntry) {
                            return oEntry.YearMonth === sMesAtualKey;
                        });

                        if (oMesAtual) {
                            oGraficoModel.setProperty("/gastoMesAtual", parseFloat(oMesAtual.Amount) || 0);
                            oGraficoModel.setProperty("/moeda", oMesAtual.Currency || "");

                            var aSemMesAtual = aDadosAnoAtual.filter(function (oEntry) {
                                return oEntry.YearMonth !== sMesAtualKey;
                            });
                            oGraficoModel.setProperty("/gastosPorMes", aSemMesAtual);
                        } else {
                            oGraficoModel.setProperty("/gastoMesAtual", 0);
                            oGraficoModel.setProperty("/moeda", "");
                        }
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
        * Fetch card values from backend and update view.
        */
        onRealodData: function (sExpNo) {
            this.onGetDocument("", sExpNo);
            this.byId("attachmentList").getBinding("items").refresh();
            this.getView().getModel().refresh();
        },

        /**
       * Handle close detail.
       */
        onPressCloseDetail: function () {
            // var oFCL = this.getView().getParent().getParent();
            this.getModel("global").setProperty("/layout", "OneColumn");
            this.getRouter().navTo("RouteMain");
        },

        /**
         * Attach busy indicator handlers to model requests.
         * @param {sap.ui.model.Model} oModel OData model
         */
        handleRequestBusy: function (oModel) {
            var oAppViewModel = this.getModel("global");

            oModel.attachRequestSent(() => {
                oAppViewModel.setProperty("/busy", true);
            });
            oModel.attachRequestCompleted(() => {
                oAppViewModel.setProperty("/busy", false);
            });
            oModel.attachRequestFailed(() => {
                oAppViewModel.setProperty("/busy", false);
            });
        },
    });
});