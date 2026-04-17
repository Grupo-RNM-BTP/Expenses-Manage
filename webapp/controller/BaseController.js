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
         * Set OData model with token/email and user language.
         * @param {string} token Authentication token
         * @param {string} sEmail User email
         */
        setModelCA: function (token, sEmail) {
            var userLanguage = sessionStorage.getItem("oLangu");
            if (!userLanguage) {
                userLanguage = "EN";
            }

            var serviceUrlWithLanguage = this.getModel().sServiceUrl + (this.getModel().sServiceUrl.includes("?") ? "&" : "?") + "sap-language=" + userLanguage;
            var oHeaders = {
                "applicationName": "ZFI_EXP_MNG"
            };

            if (token) {
                oHeaders.authorization = token;
            }

            if (sEmail) {
                oHeaders["X-user-email"] = sEmail;
            }

            CAModel = new sap.ui.model.odata.v2.ODataModel({
                serviceUrl: serviceUrlWithLanguage,
                annotationURI: "/zsrv_iwfnd/Annotations(TechnicalName='ZFI_EXPENSES_ANNO_MDL',Version='0001')/$value/",
                headers: oHeaders
            });

            this.setModel(CAModel);
        },

        /**
         * Get current user email from FLP/Work Zone shell.
         * @returns {string}
         */
        getShellUserEmail: function () {
            return sap.ushell?.Container?.getUser()?.getEmail?.() || "";
        },

        /**
         * Validate user authentication using backend service.
         * @param {string} type Auth type
         */
        getUserAuthentication: function (type) {
            var that = this,
                urlParams = new URLSearchParams(window.location.search),
                token = urlParams.get('token'),
                sEmail = this.getShellUserEmail(),
                sViewName = this.getView().getParent().getParent().getLayout();

            if (sViewName.includes("OneColumn")) {
                this.getCardValues();
            }

            if (sEmail) {
                that.getModel("global").setProperty("/userEmail", sEmail);
            }

            if (token != null || sEmail) {
                var headers = new Headers();
                if (token != null) {
                    headers.append("X-authorization", token);
                }
                if (sEmail) {
                    headers.append("X-user-email", sEmail);
                }

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
                            that.getModel("global").setProperty("/token", token || "");
                            that.getModel("global").setProperty("/userEmail", sEmail || "");
                            that.getModel("global").setProperty("/authSource", token ? "token" : "shell");
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
        getCardValues: async function () {
            try {
                var oModel = this.getView().getModel();

                oModel.read("/GetCardValues", {
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            var o = oData.results[0];

                            this.byId("idNoTheExpensesNonReconciled").setText(o.NdocV);
                            this.byId("idSumOfApprovedExpenses").setText(this.formatter.formatCurrencyEUR(o.ApprvdV));
                            this.byId("idSumOfExpensesLast30Days").setText(this.formatter.formatCurrencyEUR(o.Last30V));
                            this.byId("idReceible").setText(this.formatter.formatCurrencyEUR(o.Receivablev));
                            this.byId("idSettled").setText(this.formatter.formatCurrencyEUR(o.Settledv));
                            this.byId("idPayable").setText(this.formatter.formatCurrencyEUR(o.Payablev));
                        } else {
                            this.byId("idNoTheExpensesNonReconciled").setText("0");
                            this.byId("idSumOfApprovedExpenses").setText(this.formatter.formatCurrencyEUR(0));
                            this.byId("idSumOfExpensesLast30Days").setText(this.formatter.formatCurrencyEUR(0));
                            this.byId("idReceible").setText(this.formatter.formatCurrencyEUR(0));
                            this.byId("idSettled").setText(this.formatter.formatCurrencyEUR(0));
                            this.byId("idPayable").setText(this.formatter.formatCurrencyEUR(0));
                        }
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

                        oGraficoModel.setProperty("/gastosPorMes", this.formatter.formatCurrencyEUR(aAgrupado));
                        oGraficoModel.setProperty("/totalAno", this.formatter.formatCurrencyEUR(fTotalAno));
                        oGraficoModel.setProperty("/gastoMesAtual", this.formatter.formatCurrencyEUR(fGastoMesAtual));
                        oGraficoModel.setProperty("/moeda", this.formatter.formatCurrencyEUR(sMoeda));

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
            this.onButtonsState(false, true);
            this.getModel("global").setProperty("/layout", "OneColumn");
            this.getModel("global").setProperty("/detailReadOnly", false);
            this.getRouter().navTo("RouteMain");
        },

        onButtonsState: function (sState1, sState2) {
            var sEdit = this.byId("editButton"),
                sSave = this.byId("saveButton"),
                sCancel = this.byId("cancelButton"),
                sTextArea = this.byId("textComments");

            if (sEdit || sSave || sCancel || sTextArea) {
                sEdit.setVisible(sState2);
                sSave.setVisible(sState1);
                sCancel.setVisible(sState1);
                sTextArea.setEnabled(sState1);
            }
        },

        /**
         * Open PDF document.
         */
        openPDF: function (sDocument) {
            try {
                if (sap.ui.Device.system.phone || sap.ui.Device.system.tablet) {
                    this.openPDFMobile(sDocument);
                    return;
                }

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
                        displayType: sap.m.PDFViewerDisplayType.Auto,
                        isTrustedSource: true
                    });
                    this.getView().addDependent(this._PDFViewer);
                } else {
                    this._PDFViewer.setSource(_pdfurl);
                }

                jQuery.sap.addUrlWhitelist("blob");
                this._PDFViewer.open();
            } catch (error) {
                this.showErrorMessage({
                    oText: error.message,
                    oTitle: this.getResourceBundle().getText("errorTitle")
                });
            }
        },

        /**
         * Open PDF document on mobile.
         */
        openPDFMobile: function (sDocument) {
            try {
                var base64PDF = sDocument.split(",")[1];
                var arrayBuffer = this.base64ToArrayBuffer(base64PDF);
                var blob = new Blob([arrayBuffer], { type: 'application/pdf' });
                var url = URL.createObjectURL(blob);
                // window.open(url);

                var win = window.open(url, "_blank");

                if (!win || win.closed || typeof win.closed === "undefined") {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("popUpBlocked"));
                }
            } catch (error) {
                this.showErrorMessage({
                    oText: error.message,
                    oTitle: this.getResourceBundle().getText("errorTitle")
                });
            }
        },

        /**
         * Convert base64 to array buffer.
         */
        base64ToArrayBuffer: function (base64) {
            var binaryString = atob(base64);
            var len = binaryString.length;
            var bytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return bytes.buffer;
        },

        /**
         * Convert image to PDF.
         */
        onConvertToPDF: async function (base64Image) {
            sap.ui.core.BusyIndicator.show(0);
            try {
                if (!base64Image) {
                    return "";
                }
                else if (base64Image.startsWith("data:application/pdf") || base64Image.startsWith("JVBERi0x")) {
                    return base64Image;
                }

                const mod = await import("https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js");
                const JsPDF = mod.jsPDF || (mod.default && mod.default.jsPDF) || window.jspdf.jsPDF;
                const { optimizedBase64, format, widthMm, heightMm } = await this._prepareImageForPdf(base64Image);
                const orientation = widthMm > heightMm ? "landscape" : "portrait";

                const doc = new JsPDF({
                    orientation,
                    unit: "mm",
                    format: "a4",
                    compress: true
                });

                const pageWidth = doc.internal.pageSize.getWidth();
                const posX = (pageWidth - widthMm) / 2;
                doc.addImage(optimizedBase64, format, posX, 10, widthMm, heightMm);

                const pdfBase64 = doc.output("datauristring");
                return pdfBase64;
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },

        /**
         * Prepare image for PDF.
         */
        _prepareImageForPdf: function (base64Str) {
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = function () {
                    const { width, height } = img;
                    const maxWidthMm = 180;
                    const maxHeightMm = 260;
                    const pxPerMm = 3.78;
                    const maxWidthPx = maxWidthMm * pxPerMm;
                    const maxHeightPx = maxHeightMm * pxPerMm;
                    const ratio = Math.min(maxWidthPx / width, maxHeightPx / height, 1);
                    const displayWidthPx = width * ratio;
                    const displayHeightPx = height * ratio;
                    const canvas = document.createElement("canvas");

                    canvas.width = displayWidthPx;
                    canvas.height = displayHeightPx;

                    const ctx = canvas.getContext("2d");
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = "medium";
                    ctx.filter = "contrast(103%) brightness(101%)";
                    ctx.drawImage(img, 0, 0, displayWidthPx, displayHeightPx);

                    const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.75);
                    const widthMm = displayWidthPx / pxPerMm;
                    const heightMm = displayHeightPx / pxPerMm;

                    canvas.width = 0;
                    canvas.height = 0;
                    canvas.remove();

                    resolve({ optimizedBase64, format: "JPEG", widthMm, heightMm });
                };
                img.src = base64Str;
            });
        },
    });
});
