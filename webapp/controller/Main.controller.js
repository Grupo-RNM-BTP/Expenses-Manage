sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/ui/unified/FileUploader"   
],
    function (BaseController, formatter, JSONModel, FileUploader) {
        "use strict";


        /**
         * MainController: Handles main view, navigation, uploads, and card data.
         *
         * @namespace zfiexpensesmanage.controller
         * @extends zfiexpensesmanage.controller.BaseController
         */

        return BaseController.extend("zfiexpensesmanage.controller.Main", {

            formatter: formatter,

            /**
             * Initialize the controller, set model, and attach route matched.
             */
            onInit: function () {
                var oModel = new JSONModel({
                    ExpNo: ""
                });
                this.getView().setModel(oModel, "Main");
                this.getView().setModel(new JSONModel({}), "graficoModel");

                this._handlers = {};
                this._bError = false;
                this._bSubmit = false;

                this.getView().setModel(new JSONModel(), "Camera");
                this.getView().setModel(new JSONModel({ vatLines: [], vatEditMode: true, unitVisible: false }), "Expenses");

                this.getView().setModel(new JSONModel({ aiScan: true }), "Scan");

                this.getView().setModel(new JSONModel({ title: "A analisar documento", description: "" }), "Scanning");

                this.oScanModel = this.getView().getModel("Scan");
                this.oCameraModel = this.getView().getModel("Camera");
                this.oExpensesModel = this.getView().getModel("Expenses");
                this.oScanningModel = this.getView().getModel("Scanning");


                sessionStorage.setItem("goToLaunchpad", "X");
                this.getRouter().attachRouteMatched(this.getUserAuthentication, this);
            },

            /**
             * Handle after rendering, get card values, and set theme.
             */
            onAfterRendering: function () {
                this.onCheckLeader();
                this.getCardValues();
                sessionStorage.setItem("goToLaunchpad", "X");
                if (sessionStorage.getItem("selectedTheme").indexOf("dark") !== -1) {
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(28,34,40,0.99)");
                }
                else {
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(255, 255, 255, 0.99)");
                }
            },

            /**
             * Handle route matched, set goToLaunchpad and get user authentication.
             */
            onRouteMatched: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                this.getUserAuthentication();
            },

            /**
             * Apply initial sorter before table binding.
             * @param {sap.ui.base.Event} oEvent
             */
            onBeforeRebindTable: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams");

                if (!this._bInitialSorterApplied) {
                    oBindingParams.sorter = [new sap.ui.model.Sorter("Erdat", true)];
                }
            },

            onBeforeRebindTableCards: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams");

                if (!this._bInitialSorterApplied) {
                    oBindingParams.sorter = [new sap.ui.model.Sorter("VYearMonthDay", true)];
                }
            },

            /**
             * Open reason dialog.
             * @param {sap.ui.base.Event} oEvent
             */
            onPressReason: function (oEvent) {
                try {
                    var oIcon = oEvent.getSource(),
                        sReasonText = oIcon.getBindingContext().getProperty("Reason");

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
                                text: this.getResourceBundle().getText("btnClose"),
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
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            /**
             * Open upload dialog.
             * @param {sap.ui.base.Event} oEvent
             */
            onUploadPressed: function (oEvent) {
                try {
                    this.getView().getModel("Main").setData({});
                    var that = this,
                        sPath = oEvent.getSource().getBindingContext().getPath(),
                        oMatch = sPath.match(/ExpNo='([^']+)'/),
                        sExpNo = oMatch[1];

                    this.getView().getModel("Main").setProperty("/ExpNo", sExpNo);

                    if (!this._oUploadDialog) {
                        this._oUploadDialog = new sap.m.Dialog({
                            title: this.getResourceBundle().getText("uploadImage"),
                            contentWidth: "300px",
                            contentHeight: "auto",
                            content: [
                                new sap.m.VBox({
                                    fitContainer: true,
                                    renderType: "Bare",
                                    items: [
                                        new sap.m.Text({
                                            text: this.getResourceBundle().getText("selectImage"),
                                            wrapping: true,
                                            width: "100%",
                                        }),
                                        // new sap.m.Input({
                                        //     id: "input123",
                                        //     name: "input123",
                                        //     width: "100%",
                                        //     text: "123",
                                            
                                        // })
                                        new sap.ui.unified.FileUploader({
                                            id: "fileUploaderMain",
                                            name: "fileUploaderMain",
                                            change: this.onFileChange.bind(this),
                                            width: "100%",
                                            buttonText: this.getResourceBundle().getText("btnChooseFile"),
                                            fileType: ["jpg", "jpeg", "png"]
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
                                    that._oUploadDialog.destroy();
                                    that._oUploadDialog = null;
                                    this._sFileType = "";
                                }
                            }),
                            afterClose: function () {
                                var oFileUploader = sap.ui.getCore().byId("fileUploaderMain");
                                if (oFileUploader) {
                                    oFileUploader.clear();
                                }
                            }
                        });
                        this.getView().addDependent(this._oUploadDialog);
                    }
                    this._oUploadDialog.open();
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            /**
             * Get document and convert to Base64.
             * @param {sap.ui.base.Event} oDocumentInput
             */
            onGetDocumentToBase64: function (oDocumentInput) {
                return new Promise(function (resolve, reject) {
                    if (!oDocumentInput.oFileUpload.files.length) {
                        return;
                    }

                    var oFile = oDocumentInput.oFileUpload.files[0];
                    var oReader = new FileReader();

                    oReader.readAsDataURL(oFile);

                    oReader.onload = function (e) {
                        resolve(e.target.result);
                    };

                    oReader.onerror = function (err) {
                        reject(err);
                    };
                });
            },

            onFileChange: function (oEvent) {
                var aFiles = oEvent.getParameter("files");
                if (!aFiles || aFiles.length === 0) {
                    return;
                }

                var oFile = aFiles[0];

                if (!(oFile.type === "image/png" || oFile.type === "image/jpeg")) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("invalidFormat"));
                    return;
                }

                var sType = oFile.type.split("/")[1].toUpperCase();

                if (oFile.type.toLowerCase().includes("jpeg")) {
                    sType = "jpg";
                }

                this._sFileType = sType;

            },

            /**
             * Send Data to backend with IMAGE.
             */
            handleUpload: async function () {
                try {
                    var oModel = this.getView().getModel(),
                        sPath = "/AttachmentsEvents",
                        oEntry = {};

                    if (sap.ui.getCore().byId("fileUploaderMain").getValue() == "") {
                        return sap.ui.getCore().byId("fileUploaderMain").setValueState("Error")
                    }

                    var sDocument = await this.onGetDocumentToBase64(sap.ui.getCore().byId("fileUploaderMain"));

                    oEntry.Expenseno = this.getView().getModel("Main").getProperty("/ExpNo");
                    oEntry.FileString = sDocument;
                    oEntry.FileType = this._sFileType;

                    oModel.create(sPath, oEntry, {
                        success: function () {
                            this._oUploadDialog.close();
                            this._oUploadDialog.destroy();
                            oModel.refresh();
                            this._sFileType = "";
                            sap.m.MessageBox.success(this.getResourceBundle().getText("uploadSuccess"));
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
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            /**
             * Handle navigation between pages based on side menu selection.
             * @param {sap.ui.base.Event} oEvent
             */
            onItemSelect: function (oEvent) {
                var sKey = oEvent.getParameter("item").getKey(),
                    oNavContainer = this.byId("NavContainer"),
                    oToolPage = this.byId("toolPage");

                switch (sKey) {
                    case "Manage":
                        this.getCardValues();
                        this.onPressCloseDetail();
                        oNavContainer.to(this.byId("pageManage"));
                        oToolPage.setSideExpanded(false);
                        break;

                    case "CardMovements":
                        this.getSumMonth();
                        this.getSumYear();
                        this.onPressCloseDetail();
                        oNavContainer.to(this.byId("pageCardMovements"));
                        oToolPage.setSideExpanded(false);
                        break;

                    case "ApproveExpenses":
                        this.onPressCloseDetail();
                        oNavContainer.to(this.byId("pageApprovals"));
                        oToolPage.setSideExpanded(false);
                        break;
                }
            },

            /**
             * Handle expense item press and navigate to detail view.
             * @param {sap.ui.base.Event} oEvent
             */
            handleExpensePress: function (oEvent) {
                this.getModel("global").setProperty("/layout", "TwoColumnsMidExpanded");

                var oItem = oEvent.getSource();

                if (oItem) {
                    var sPath = oItem.getBindingContext().sPath;

                    this.onNavigation(sPath, "Detail", "/ZFI_EXPENSES_MNG");
                }
            },

            /**
             * Handle side navigation toggle.
             */
            onSideNavToggle: function () {
                var oToolPage = this.byId("toolPage");
                oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
            },

            /**
             * Check if the user is a leader.
             */
            onCheckLeader: function () {
                var oModel = this.getModel(),
                    sPath = "/CheckLeader";

                oModel.read(sPath, {
                    success: function (oData) {
                        if (oData.results[0].Return === true) {
                            this.byId("idApproveExpenses").setVisible(true);
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
                })
            },

            /**
             * Get selected items from table.
             * @param {string} oAction
             */
            onGetItemsTable: function (oAction) {
                var oSelectedItems = this.byId("idTableApprovals").getSelectedItems(),
                    aSelectedData = [],
                    oEntry = {};

                if (oSelectedItems.length === 0) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"));
                    return;
                }

                oSelectedItems.forEach(function (oItem) {
                    var oData = oItem.getBindingContext().getObject();
                    aSelectedData.push({
                        pernr: oData.Pernr,
                        exp: oData.ExpNo,
                        FI_STATUS: oData.FiStatus
                    });
                });

                oEntry = {
                    DataExp: JSON.stringify(aSelectedData),
                };

                this.handleEvents(oEntry, oAction);
            },

            /**
             * Handle events.
             * @param {object} oEntry
             * @param {string} oAction
             */
            handleEvents: function (oEntry, oAction) {
                var oModel = this.getModel(),
                    sPath = "/LeaderEvents";

                oEntry.Action = oAction;

                this.getModel("global").setProperty("/busy", true);
                oModel.create(sPath, oEntry, {
                    success: function () {
                        this.getModel("global").setProperty("/busy", false);
                        oModel.refresh();
                    }.bind(this),
                    error: function (oError) {
                        this.getModel("global").setProperty("/busy", false);
                        var sError = JSON.parse(oError.responseText).error.message.value;
                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }.bind(this)
                })
            },

            /**
             * Handle selection change.
             * @param {sap.ui.base.Event} oEvent
             */
            handleSelectionChange: function (oEvent) {
                this.byId("deleteButton").setEnabled(true);
            },

            /**
             * Handle delete expense.
             */
            handleDelete: function () {
                var oModel = this.getModel(),
                    oTable = this.byId("MyExpensesTable").getTable(),
                    oSelectedItems = oTable.getSelectedItem(),
                    sExpNo = oSelectedItems.getBindingContext().getObject().ExpNo,
                    sPath = "/EditExpense(Exp='" + sExpNo + "')";

                this.getModel("global").setProperty("/busy", true);
                oModel.remove(sPath, {
                    success: function () {
                        this.getModel("global").setProperty("/busy", false);
                        oModel.refresh();
                        oTable.removeSelections();
                        this.byId("deleteButton").setEnabled(false);
                    }.bind(this),
                    error: function (oError) {
                        this.getModel("global").setProperty("/busy", false);
                        var sError = JSON.parse(oError.responseText).error.message.value;
                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        });
                    }.bind(this)
                })
            },
        });
    });
