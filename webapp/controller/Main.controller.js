sap.ui.define([
    "./BaseController",
    "sap/m/MessageBox",
    "../model/formatter",
    "sap/ui/model/json/JSONModel"
],
    function (BaseController, MessageBox, formatter, JSONModel) {
        "use strict";

        return BaseController.extend("zfiexpensesmanage.controller.Main", {
            formatter: formatter,
            onInit: function () {
                var oModel = new JSONModel({
                    ExpNo: ""
                });
                this.getView().setModel(oModel, "Main");
                sap.ui.core.UIComponent.getRouterFor(this).getRoute("RouteMain").attachPatternMatched(this.onObjectMain, this);
            },

            // On object main
            onObjectMain: function (oEvent) {
                this.bindData("/" + oEvent.getParameter("config").pattern.replace("/{objectId}", "") + oEvent.getParameter("arguments").objectId, true);
            },

            // Bind data
            bindData: function (sObjectPath) {
                this.getView().bindElement({ path: sObjectPath });

                this.getSumOfApprovedExpenses();
                this.getSumOfExpensesNoAttach();
                this.getSumOfExpensesLast30Days();

                this.getView().getModel().refresh();
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

            // Format currency
            formatCurrencyEUR: function (vValue) {
                var oCurrencyFormat = sap.ui.core.format.NumberFormat.getCurrencyInstance({
                    currencyCode: false
                });

                return oCurrencyFormat.format(vValue, "EUR");
            },

            // Open upload dialog
            onUploadPressed: function (oEvent) {
                this.getView().getModel("Main").setData({});
                var that = this,
                    sPath = oEvent.getSource().getBindingContext().getPath();

                var oMatch = sPath.match(/ExpNo='([^']+)'/),
                    sExpNo = oMatch[1];

                this.getView().getModel("Main").setProperty("/ExpNo", sExpNo);


                if (!this._oUploadDialog) {
                    this._oUploadDialog = new sap.m.Dialog({
                        title: this.getResourceBundle().getText("uploadImage"),
                        stretchOnPhone: true,
                        content: [
                            new sap.m.VBox({
                                fitContainer: true,
                                renderType: "Bare",
                                items: [
                                    new sap.m.Text({
                                        text: this.getResourceBundle().getText("selectImage"),
                                        wrapping: true,
                                        width: "100%",
                                        design: "Bold"
                                    }),
                                    new sap.ui.unified.FileUploader({
                                        id: "fileUploader",
                                        name: "fileUploader",
                                        width: "100%",
                                        buttonText: this.getResourceBundle().getText("btnChooseFile"),
                                        fileType: ["jpg", "jpeg", "png", "gif"],
                                        change: function (oEvent) {
                                            var files = oEvent.getParameter("files");
                                            if (files && files.length > 0) {
                                                var file = files[0];
                                                if (!file.type.match('image.*')) {
                                                    sap.m.MessageToast.show(this.getResourceBundle().getText("invalidFile"));
                                                    this.clear();
                                                }
                                            }
                                        }
                                    })
                                ]
                            }).addStyleClass("sapUiSmallMargin")
                        ],
                        beginButton: new sap.m.Button({
                            text: this.getResourceBundle().getText("btnUpload"),
                            type: "Emphasized",
                            press: this.handleUpload.bind(this)
                        }),
                        endButton: new sap.m.Button({
                            text: this.getResourceBundle().getText("btnCancel"),
                            press: function () {
                                that._oUploadDialog.close();
                            }
                        }),
                        afterClose: function () {
                            var oFileUploader = sap.ui.getCore().byId("fileUploader");
                            if (oFileUploader) {
                                oFileUploader.clear();
                            }
                        }
                    });
                    this.getView().addDependent(this._oUploadDialog);
                }

                this._oUploadDialog.open();
            },

            // Send Data to backend
            handleUpload: async function () {
                var oModel = this.getView().getModel(),
                    sPath = "/UploadImage",
                    sDocument = await this.onGetDocument(sap.ui.getCore().byId("fileUploader")),
                    oEntry = {};

                oEntry.Exp = this.getView().getModel("Main").getProperty("/ExpNo");
                oEntry.Document = sDocument;

                oModel.create(sPath, oEntry, {
                    success: function () {

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
                    }
                })
            },

            // Get document and convert to Base64
            onGetDocument: function () {
                var oDocumentInput = sap.ui.getCore().byId("fileUploader");

                if (oDocumentInput.getValue() == "") {
                    return sap.ui.getCore().byId("fileUploader").setValueState("Error")
                }
                else {
                    return new Promise(function (resolve, reject) {
                        var oItem = "",
                            oFileReader = new FileReader();

                        if (oDocumentInput.oFileUpload.files.length > 0) {
                            oItem = oDocumentInput.oFileUpload.files[0]
                        }

                        oFileReader.readAsDataURL(oItem);
                        oFileReader.name = oItem.name;
                        oFileReader.size = oItem.size;

                        oFileReader.onload = function (oEvent) {
                            var oBase64 = btoa(oEvent.target.result);

                            resolve(oBase64);

                        };

                        oFileReader.onerror = function (error) {
                            reject(error);
                        };
                    });
                }
            },

            // Open reason dialog
            onPressReason: function (oEvent) {
                var oIcon = oEvent.getSource();
                var sReasonText = oIcon.getBindingContext().getProperty("Reason");

                if (!this._oReasonDialog) {
                    this._oReasonDialog = new sap.m.Dialog({
                        title: "Motivo",
                        content: new sap.m.VBox({
                            items: [
                                new sap.m.Text({ text: sReasonText, textAlign: "Center" })
                            ],
                            justifyContent: "Center",
                            alignItems: "Center"
                        }),
                        beginButton: new sap.m.Button({
                            text: "Fechar",
                            press: function () {
                                this._oReasonDialog.close();
                            }.bind(this)
                        })
                    });
                    this.getView().addDependent(this._oReasonDialog);
                } else {
                    this._oReasonDialog.getContent()[0].getItems()[0].setText(sReasonText);
                }

                this._oReasonDialog.open();
            }
        });
    });
