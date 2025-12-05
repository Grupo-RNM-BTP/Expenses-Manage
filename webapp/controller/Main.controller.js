sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "../util/ScanUtil",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/Button"
],
    function (BaseController, formatter, JSONModel, Fragment, ScanUtil, Filter, FilterOperator, MessageToast, MessageBox, Dialog, Table, Column, ColumnListItem, Text, Button) {
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
                    ExpNo: "",
                    ExpensesReconciled: [],
                    ExpenseDevolution: [],
                    inputValue: "",
                    sliderMax: ""
                });
                this.getView().setModel(oModel, "Main");
                this.getView().setModel(new JSONModel({}), "graficoModel");

                this._handlers = {};
                this._bError = false;
                this._bSubmit = false;
                this._cancel = false;
                this._chknum = "";
                this._cardnum = "";

                this._bScan = false;

                new ScanUtil().handleAttachToController(this);

                this.getView().setModel(new JSONModel(), "Camera");
                this.getView().setModel(new JSONModel({ vatLines: [], vatEditMode: true, unitVisible: false }), "Expenses");

                this.getView().setModel(new JSONModel({ processingDialogBtnVisible: true, aiScan: true }), "Scan");

                this.getView().setModel(new JSONModel({ title: "", description: "" }), "Scanning");

                this.getView().setModel(new JSONModel({ entries: [] }), "Logs");

                this.getView().setModel(new JSONModel({ hasData: false, items: [] }), "Cards");

                this.getView().setModel(new JSONModel({ syncInProgress: false, syncText: "", currentJobId: null }), "Sync");

                this.getView().setModel(new JSONModel({ items: [] }), "SyncLogs");

                this._iPollInterval = 2000;
                this._sPollTimerId = null;


                this.oScanModel = this.getView().getModel("Scan");
                this.oCameraModel = this.getView().getModel("Camera");
                this.oExpensesModel = this.getView().getModel("Expenses");
                this.oScanningModel = this.getView().getModel("Scanning");
                this._bInitialSorterApplied = false;
                this._bInitialSorterApplied2 = false;
                this._bInitialSorterApplied3 = false;


                sessionStorage.setItem("goToLaunchpad", "X");
                this.getRouter().attachRouteMatched(this.getUserAuthentication, this);
            },

            /**
             * Handle after rendering, get card values, and set theme.
             */
            onAfterRendering: async function () {
                var oCard = this.byId("idNewCard");
                if (oCard) {
                    oCard.addEventDelegate({
                        onclick: function () {
                            this.handleStartProcess();
                        }.bind(this)
                    });
                }
                await this.onCheckLeader();
                await this.getCardValues();
                this.byId("idTitle1").setText(this.getResourceBundle().getText("ManageMyExpenses"));
                sessionStorage.setItem("goToLaunchpad", "X");

                // this.handleSynchronize();
            },

            /**
             * Handle route matched, set goToLaunchpad and get user authentication.
             */
            onRouteMatched: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                this.getUserAuthentication();
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
                        this.onPressCloseDetail();
                        this.byId("MyExpensesTable").getTable().removeSelections();
                        this.getCardValues();
                        this.byId("idTitle1").setText(this.getResourceBundle().getText("ManageMyExpenses"));
                        oNavContainer.to(this.byId("pageManage"));
                        oToolPage.setSideExpanded(false);
                        break;

                    case "CardMovements":
                        this.onPressCloseDetail();
                        this.getSumMonth();
                        this.byId("idTitle1").setText(this.getResourceBundle().getText("OverviewExpenses"));
                        oNavContainer.to(this.byId("pageCardMovements"));
                        oToolPage.setSideExpanded(false);
                        break;

                    case "TransRecon":
                        this.onPressCloseDetail();
                        oNavContainer.to(this.byId("pageTransRecon"));
                        this.byId("idTitle1").setText(this.getResourceBundle().getText("TransactionReconciliation"));
                        oToolPage.setSideExpanded(false);
                        break;

                    case "CurrentAccount":
                        this.onPressCloseDetail();
                        oNavContainer.to(this.byId("pageCurrentAccount"));
                        this.byId("idTitle1").setText(this.getResourceBundle().getText("CurrentAccount"));
                        oToolPage.setSideExpanded(false);
                        break;

                    case "ApproveExpenses":
                        this.onPressCloseDetail();
                        this.byId("smartTableApprovals").getTable().removeSelections();
                        this.byId("idTitle1").setText(this.getResourceBundle().getText("ApproveExpenses"));
                        oNavContainer.to(this.byId("pageApprovals"));
                        oToolPage.setSideExpanded(false);
                        break;
                }
            },

            /**
             * Handle side navigation toggle.
             */
            onSideNavToggle: function () {
                var oToolPage = this.byId("toolPage");
                oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
            },


            //---------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------- Manage Expenses ------------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------

            /**
             * Apply initial sorter before table binding.
             * @param {sap.ui.base.Event} oEvent
             */
            onBeforeRebindTable: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams");

                if (!this._bInitialSorterApplied2) {
                    oBindingParams.sorter.push(
                        new sap.ui.model.Sorter("Erdat", true)
                    );
                    this._bInitialSorterApplied2 = true;
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
                                            width: "100%"
                                        }),
                                        new sap.ui.unified.FileUploader({
                                            id: "fileUploaderMain",
                                            name: "fileUploaderMain",
                                            change: this.onFileChange.bind(this),
                                            width: "100%",
                                            buttonText: this.getResourceBundle().getText("btnChooseFile")
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
                                press: this.onCloseUploadDialog.bind(this)
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
             * Close upload dialog.
             */
            onCloseUploadDialog: function () {
                this._oUploadDialog.close();
                this._oUploadDialog.destroy();
                this._oUploadDialog = null;
                this._sFileType = "";
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

                    var oFile = oDocumentInput.oFileUpload.files[0],
                        oReader = new FileReader();

                    oReader.readAsDataURL(oFile);

                    oReader.onload = function (e) {
                        resolve(e.target.result);
                    };

                    oReader.onerror = function (err) {
                        reject(err);
                    };
                });
            },

            /**
             * Handle file change event.
             * @param {sap.ui.base.Event} oEvent File change event
             */
            onFileChange: function (oEvent) {
                var aFiles = oEvent.getParameter("files");
                if (!aFiles || aFiles.length === 0) {
                    return;
                }

                var oFile = aFiles[0];

                var aAllowedTypes = ["image/png", "image/jpeg", "application/pdf"];
                if (aAllowedTypes.indexOf(oFile.type) === -1) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("invalidFormat"));
                    return;
                }

                var sType = oFile.type.split("/")[1].toUpperCase();

                if (sType === "JPEG") {
                    this._sFileType = "JPG";
                } else if (sType === "PDF") {
                    this._sFileType = "PDF";
                } else {
                    this._sFileType = sType;
                }
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

                    this.getModel("global").setProperty("/busy", true);
                    var sDocument = await this.onGetDocumentToBase64(sap.ui.getCore().byId("fileUploaderMain"));
                    var sDocument = await this.onConvertToPDF(sDocument);

                    oEntry.Expenseno = this.getView().getModel("Main").getProperty("/ExpNo");
                    oEntry.FileString = sDocument;
                    oEntry.FileType = "PDF";

                    oModel.create(sPath, oEntry, {
                        success: function () {
                            this.onCloseUploadDialog();
                            this.getModel("global").setProperty("/busy", false);
                            oModel.refresh();
                            this.getCardValues();
                            sap.m.MessageBox.success(this.getResourceBundle().getText("uploadSuccess"));
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
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
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
                    this.byId("toolPage").setSideExpanded(false);
                }
            },

            /**
             * Handle avatar press and navigate to detail view.
             * @param {sap.ui.base.Event} oEvent
             */
            onPressAvatar: function (oEvent) {
                try {
                    var oModel = this.getModel(),
                        sExpNo = oEvent.getSource().getBindingContext().getObject().ExpNo,
                        sPath = "/AttachmentsEvents(Expenseno='" + sExpNo + "')";

                    this.getModel("global").setProperty("/busy", true);
                    oModel.read(sPath, {
                        success: function (oData) {
                            var sSrc = oData.FileString;
                            if (!sSrc.startsWith("data:application/pdf")) {
                                var oLightBox = new sap.m.LightBox({
                                    imageContent: new sap.m.LightBoxItem({
                                        imageSrc: sSrc
                                    })
                                });

                                oLightBox.addEventDelegate({
                                    onAfterRendering: function () {
                                    }.bind(this)
                                });

                                oLightBox.open();
                            } else {
                                this.openPDF(sSrc);
                            }

                            this.getModel("global").setProperty("/busy", false);

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
                    });

                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            /**
             * Handle selection change.
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

            //---------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------- Transactions ---------------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------

            /**
             * Handles the synchronize action triggered from the UI.
             * Starts the backend sync job and begins polling for synchronization logs.
             */
            handleSynchronize: function () {
                var oModel = this.getView().getModel(),
                    oSync = this.getView().getModel("Sync"),
                    oBundle = this.getResourceBundle(),
                    that = this;

                oSync.setProperty("/syncInProgress", true);
                oSync.setProperty(
                    "/syncText",
                    oBundle
                        ? oBundle.getText("SyncInProgress", this.getResourceBundle().getText("SyncingTransactions"))
                        : this.getResourceBundle().getText("SyncingTransactions")
                );
                oSync.setProperty("/currentJobId", null);

                this.handleStopPollingLogs();
                this.getView().getModel("SyncLogs").setProperty("/items", []);

                oModel.callFunction("/StartSync", {
                    method: "POST",
                    success: function (oData, oResponse) {
                        var oResult = oData || (oResponse && oResponse.data);
                        var sJobId = oResult && oResult.JobId;

                        if (!sJobId) {
                            oSync.setProperty("/syncInProgress", false);
                            oSync.setProperty("/syncText", "");
                            return;
                        }

                        oSync.setProperty("/currentJobId", sJobId);

                        that.handleStartPollingLogs(sJobId);
                    },
                    error: function () {
                        oSync.setProperty("/syncInProgress", false);
                        oSync.setProperty("/syncText", "");
                    }
                });
            },

            /**
             * Fetches synchronization logs for a given job from the backend
             * and updates the SyncLogs model.
             *
             * @param {string} sJobId Identifier of the backend synchronization job.
             * @private
             */
            handleFetchLogs: function (sJobId) {
                var oModel = this.getView().getModel(),
                    oSync = this.getView().getModel("Sync"),
                    oLog = this.getView().getModel("SyncLogs"),
                    that = this;

                var aFilters = [
                    new Filter("JobId", FilterOperator.EQ, sJobId)
                ];

                oModel.read("/SyncLog", {
                    filters: aFilters,
                    success: function (oData) {
                        var aResults = (oData && oData.results) || [];

                        oLog.setProperty("/items", aResults);

                        var bFinished = aResults.some(function (oLogItem) {
                            return oLogItem.Type === "S" || oLogItem.Type === "E";
                        });

                        if (bFinished) {
                            that.handleStopPollingLogs();

                            oSync.setProperty("/syncInProgress", false);
                            oSync.setProperty("/syncText", "");

                            var oSmartTable = that.byId("smartTable");
                            if (oSmartTable && oSmartTable.rebindTable) {
                                oSmartTable.rebindTable(true);
                            }
                        }
                    },
                    error: function () {
                        that.handleStopPollingLogs();

                        oSync.setProperty("/syncInProgress", false);
                        oSync.setProperty("/syncText", "");
                    }
                });
            },

            /**
             * Starts periodic polling of synchronization logs
             * for the given job identifier.
             *
             * @param {string} sJobId Identifier of the backend synchronization job.
             * @private
             */
            handleStartPollingLogs: function (sJobId) {
                var that = this;

                this.handleStopPollingLogs();
                this.handleFetchLogs(sJobId);

                this._sPollTimerId = setInterval(function () {
                    that.handleFetchLogs(sJobId);
                }, this._iPollInterval || 2000);
            },

            /**
             * Stops the periodic polling of synchronization logs.
             *
             * @private
             */
            handleStopPollingLogs: function () {
                if (this._sPollTimerId) {
                    clearInterval(this._sPollTimerId);
                    this._sPollTimerId = null;
                }
            },

            /**
             * Opens the synchronization log dialog.
             * Lazy-loads the fragment on first use.
             */
            onSyncLogDialogOpen: function () {
                var that = this;

                if (!this._pSyncLogDialog) {
                    this._pSyncLogDialog = Fragment.load({
                        id: this.getView().getId(),
                        name: "zfiexpensesmanage.fragments.SyncLog",
                        controller: this
                    }).then(function (oDialog) {
                        that.getView().addDependent(oDialog);
                        return oDialog;
                    });
                }

                this._pSyncLogDialog.then(function (oDialog) {
                    oDialog.open();
                });
            },

            /**
             * Closes the synchronization log dialog if it has been created.
             */
            onSyncLogDialogClose: function () {
                if (this._pSyncLogDialog) {
                    this._pSyncLogDialog.then(function (oDialog) {
                        oDialog.close();
                    });
                }
            },

            /**
             * Lifecycle hook called when the controller is destroyed.
             * Stops log polling and destroys the sync log dialog if needed.
             */
            onExit: function () {
                this.handleStopPollingLogs();

                if (this._pSyncLogDialog) {
                    this._pSyncLogDialog.then(function (oDialog) {
                        oDialog.destroy();
                    });
                    this._pSyncLogDialog = null;
                }
            },


            /**
             * Apply initial sorter before table binding.
             * @param {sap.ui.base.Event} oEvent
             */

            onBeforeRebindTableCards: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams"),
                    oBundle = this.getResourceBundle(),
                    aSorters = oBindingParams.sorter || [];

                aSorters = aSorters.filter(function (oSorter) {
                    return !(oSorter.sPath === "Chknum" && oSorter.group);
                });

                var oGroupSorter = new sap.ui.model.Sorter(
                    "Chknum",
                    false,
                    function (oContext) {
                        var sChknum = oContext.getProperty("Chknum");
                        sChknum = sChknum ? String(sChknum) : "";

                        var bProcessed = sChknum.length > 10;

                        return {
                            key: bProcessed ? "PROC" : "NOPROC",
                            text: bProcessed
                                ? oBundle.getText("ReconGroupProcessed")
                                : oBundle.getText("ReconGroupNotProcessed")
                        };
                    }
                );
                oGroupSorter.group = true;

                aSorters.unshift(oGroupSorter);

                var bHasDateSorter = aSorters.some(function (oSorter) {
                    return oSorter.sPath === "VYearMonthDay";
                });

                if (!bHasDateSorter) {
                    var oDateSorter = new sap.ui.model.Sorter("VYearMonthDay", true);
                    aSorters.push(oDateSorter);
                }

                oBindingParams.sorter = aSorters;
            },

            //---------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------- Reconciliation -----------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------

            /**
             * Apply initial sorter and grouping before table binding (Reconciliation table).
             * Ensures that grouping by Chknum is always applied, even after user
             * changes sorting or table personalization.
             *
             * @param {sap.ui.base.Event} oEvent SmartTable beforeRebindTable event.
             */
            onBeforeRebindTableRecon: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams"),
                    oBundle = this.getResourceBundle(),
                    aSorters = oBindingParams.sorter || [];

                aSorters = aSorters.filter(function (oSorter) {
                    return !(oSorter.sPath === "Chknum" && oSorter.group);
                });

                var oGroupSorter = new sap.ui.model.Sorter(
                    "Chknum",
                    false,
                    function (oContext) {
                        var sChknum = oContext.getProperty("Chknum");
                        sChknum = sChknum ? String(sChknum) : "";

                        var bProcessed = sChknum.length > 10;

                        return {
                            key: bProcessed ? "PROC" : "NOPROC",
                            text: bProcessed
                                ? oBundle.getText("ReconGroupProcessed")
                                : oBundle.getText("ReconGroupNotProcessed")
                        };
                    }
                );
                oGroupSorter.group = true;

                aSorters.unshift(oGroupSorter);

                var bHasDateSorter = aSorters.some(function (oSorter) {
                    return oSorter.sPath === "Posteddt";
                });

                if (!bHasDateSorter) {
                    var oDateSorter = new sap.ui.model.Sorter("Posteddt", true);
                    aSorters.push(oDateSorter);
                }

                oBindingParams.sorter = aSorters;
            },

            /**
             * Get expenses.
             * @param {string} oAction - The action to be performed
             */
            onGetExpenses: function (oAction) {
                var oModel = this.getModel(),
                    sPath = "/ZFI_EXPENSES_MNG",
                    that = this;

                this.getView().getModel("Main").setProperty("/ExpensesReconciled", []);
                this.getView().getModel("Main").setProperty("/ExpenseDevolution", []);

                this.getModel("global").setProperty("/busy", true);

                return new Promise(function (resolve, reject) {
                    oModel.read(sPath, {
                        success: function (oData) {
                            if (oAction === 'R') {
                                var aFiltered = oData.results.filter(o => o.Checknum === "" && o.Pymtmeth === "A" && o.FiStatus !== "9" && o.FiStatus !== "1" && o.FiStatus !== "2" && o.FiStatus !== "4" && o.FiStatus !== "7");
                                that.getView().getModel("Main").setProperty("/ExpensesReconciled", aFiltered);
                            } else if (oAction === 'D') {
                                var aFiltered = oData.results.filter(o => o.Checknum !== "" && o.ExpType != "DEV" && o.Pymtmeth === "A" && o.FiStatus !== "9" && o.FiStatus !== "1" && o.FiStatus !== "2" && o.FiStatus !== "4" && o.FiStatus !== "7");
                                that.getView().getModel("Main").setProperty("/ExpenseDevolution", aFiltered);
                            }

                            that.getModel("global").setProperty("/busy", false);
                            resolve(aFiltered);
                        },
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
                            reject(oError);
                        }
                    });
                });
            },

            /**
             * Handle selection change in the reconciliation table.
             * @param {sap.ui.base.Event} oEvent - The event object
             */
            onSelectionChangeRecon: function (oEvent) {
                var aSelectedItems = oEvent.getSource().getSelectedItems();

                if (aSelectedItems.length === 1) {
                    this.onChangeStateReconButtons(true, true);
                } else if (aSelectedItems.length > 1) {
                    this.onChangeStateReconButtons(false, true);
                } else if (aSelectedItems.length === 0) {
                    this.onChangeStateReconButtons(false, false);
                }
            },

            /**
             * Change the state of the reconciliation buttons.
             * @param {boolean} sState - The state of the reconciliation button and the Without Attach button
             * @param {boolean} CompState - The state of the compensation button
             */
            onChangeStateReconButtons: function (sState, CompState) {
                this.byId("idExpensesWithoutAttach").setEnabled(sState);
                this.byId("idReconcile").setEnabled(CompState);
                this.byId("idCompensation").setEnabled(CompState);
            },

            /* ************************************** CONFIDENCIAL EXPENSE ************************************* */

            /**
             * Handle expense without attach.
             */
            handleExpenseWithoutAttach: function () {
                this._chknum = "";
                this._cardnum = "";

                var oData = {},
                    oTable = this.byId("smartTableTransRecon").getTable().getSelectedItems();

                if (oTable.length === 0) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"),
                        {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        }
                    );
                    return;
                } else if (oTable.length > 1) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("multipleSelection"),
                        {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        }
                    );
                    return;
                }


                oData.ExpNo = "";
                oData.Valid = true;
                oData.Nifc = "";
                oData.Local = "";
                oData.Nifs = "";
                oData.Country = "PT";
                oData.Fuelqty = "";
                oData.TableIva = "";
                this._cardnum = oTable[0].getBindingContext().getObject().Cardnumber;
                this._chknum = oTable[0].getBindingContext().getObject().Chknum;

                var sFormattedDate = oTable[0].getBindingContext().getObject().sDateFromated,
                    aParts = sFormattedDate.split("."),
                    sDateForPicker = aParts[0] + "-" + aParts[1] + "-" + aParts[2];

                oData.Date = new Date(sDateForPicker);
                oData.Exptype = "UE";
                oData.Amt = oTable[0].getBindingContext().getObject().Amt;

                this.handleFinishProcess(oData, "M");
            },

            /* ************************************** RECONCILIATION ************************************* */

            /**
             * Handle reconcile.
             */
            handleReconcile: function () {
                var oView = this.getView(),
                    that = this,
                    oTableItems = this.byId("smartTableTransRecon").getTable().getSelectedItems();

                if (oTableItems.length === 0) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"),
                        {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        }
                    );
                    return;
                }

                if (!this._pReconcileDialog) {
                    this._pReconcileDialog = Fragment.load({
                        id: oView.getId(),
                        name: "zfiexpensesmanage.fragments.Reconcile",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                this.onGetExpenses('R').then(function (aFiltered) {
                    if (aFiltered && aFiltered.length) {
                        that._pReconcileDialog.then(function (oDialog) {
                            if (that.byId("smartTableTransRecon").getTable().getSelectedItems().length === 1) {
                                that.byId("reconcileTable").setMode("MultiSelect");
                            } else {
                                that.byId("reconcileTable").setMode("SingleSelectLeft");
                            }
                            oDialog.open();
                        });
                    } else {
                        that.showErrorMessage({
                            oText: that.getResourceBundle().getText("noRECON")
                        });
                    }
                }).catch(function (oError) {
                    return;
                });
            },

            /**
             * Send reconcile to Backend.
             */
            onReconcile: function () {
                var oModel = this.getModel(),
                    oGlobalModel = this.getModel("global"),
                    oTableSmart = this.byId("smartTableTransRecon").getTable(),
                    oTable = this.byId("reconcileTable"),
                    aSelectedExpenses = oTable.getSelectedItems(),
                    aSelectedMovements = oTableSmart.getSelectedItems(),
                    sPath = "/ReconcileExpense";

                if (!aSelectedExpenses.length) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"),
                        {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        }
                    );
                    return;
                }

                var aExpenses = aSelectedExpenses.map(oItem => {
                    var oObjExpenses = oItem.getBindingContext("Main").getObject();
                    return {
                        ExpNo: oObjExpenses.ExpNo,
                    };
                });

                var aMovements = aSelectedMovements.map(oItem => {
                    var oObjMovements = oItem.getBindingContext().getObject();
                    return {
                        Amt: oObjMovements.Amt,
                        Posteddt: this.onFormatedateYYYYMMDD(oObjMovements.sDateFromated),
                        Chknum: oObjMovements.Chknum,
                        Cardnumber: oObjMovements.Cardnumber,
                    };
                });

                var oEntry = {
                    Expenses: JSON.stringify(aExpenses),
                    Movements: JSON.stringify(aMovements)
                };

                oGlobalModel.setProperty("/busy", true);
                oModel.create(sPath, oEntry, {
                    success: function () {
                        this.getView().getModel("Main").setProperty("/ExpensesReconciled", []);
                        this.onCancelReconcile();
                        oTableSmart.removeSelections();
                        sap.m.MessageBox.success(this.getResourceBundle().getText("reconciledSucess"));
                        oGlobalModel.setProperty("/busy", false);
                        oModel.refresh(true);
                        this.onChangeStateReconButtons(false, false);
                    }.bind(this),
                    error: function (oError) {
                        this.onChangeStateReconButtons(false, false);
                        oGlobalModel.setProperty("/busy", false);
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

            onFormatedateYYYYMMDD: function (sDateFormated) {
                var aParts = sDateFormated.split("."),
                    sDateForPicker = aParts[0] + aParts[1] + aParts[2];

                return sDateForPicker;
            },

            /**
             * Cancel reconcile.
             */
            onCancelReconcile: function () {
                if (this._pReconcileDialog) {
                    this._pReconcileDialog.then(function (oDialog) {
                        oDialog.close();
                        oDialog.destroy();
                    });
                    this._pReconcileDialog = null;

                }

                this.onChangeStateReconButtons(false, false);
                var oTableSmart = this.byId("smartTableTransRecon").getTable();
                oTableSmart.removeSelections();
            },

            /* ************************************** DECISION ************************************* */

            /**
             * Handle open decision dialog.
             */
            handleOpenDecisionDialog: function () {
                var oView = this.getView();

                if (!this._DecisionDialog) {
                    this._DecisionDialog = Fragment.load({
                        id: oView.getId(),
                        name: "zfiexpensesmanage.fragments.Decision",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                this._DecisionDialog.then(function (oDialog) {
                    oDialog.open();
                });
            },

            /**
             * Handle selection change in the compensation table.
             * @param {sap.ui.base.Event} oEvent - The event object
             */
            onSelectCompensation: function (oEvent) {
                if (oEvent.getParameter("selected")) {
                    this.byId("cbDev").setSelected(false);
                }
            },

            /**
             * Handle selection change in the devolution table.
             * @param {sap.ui.base.Event} oEvent - The event object
             */
            onSelectDevolution: function (oEvent) {
                if (oEvent.getParameter("selected")) {
                    this.byId("cbComp").setSelected(false);
                }
            },

            /**
             * Handle decision.
             */
            onDecision: function () {
                var oCheckBoxDev = this.byId("cbDev").getSelected(),
                    oCheckBoxComp = this.byId("cbComp").getSelected();

                if (oCheckBoxDev === true) {
                    this.handleDevolution();
                } else if (oCheckBoxComp === true) {
                    this.handleCompensation();
                }
            },

            /**
             * Handle cancel decision.
             */
            onCancelDecision: function () {
                if (this._DecisionDialog) {
                    this._DecisionDialog.then(function (oDialog) {
                        oDialog.close();
                        oDialog.destroy();
                    });
                    this._DecisionDialog = null;

                }

                this.onChangeStateReconButtons(false, false);
                var oTableSmart = this.byId("smartTableTransRecon").getTable();
                oTableSmart.removeSelections();
            },

            /* ************************************** COMPENSION ************************************* */

            /**
             * Handle compensation.
             */
            handleCompensation: function () {
                var oModel = this.getModel(),
                    sPath = "/Compensation",
                    oTableSmart = this.byId("smartTableTransRecon").getTable(),
                    aSelectedItems = oTableSmart.getSelectedItems(),
                    oGlobalModel = this.getModel("global"),
                    Items = [];

                if (aSelectedItems.length < 2) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("SelectAtLeastTwo"));
                    return;
                }

                aSelectedItems.forEach(oItem => {
                    var oData = oItem.getBindingContext().getObject();

                    Items.push({
                        amt: oData.Amt,
                        posteddt: oData.sDateFromated.replace(/\./g, ""),
                        chknum: oData.Chknum,
                        Cardnumber: oData.Cardnumber
                    });
                });

                var oEntry = {
                    ExpNo: '999999',
                    Items: JSON.stringify(Items)
                };

                oGlobalModel.setProperty("/busy", true);
                oModel.create(sPath, oEntry, {
                    success: function () {
                        oGlobalModel.setProperty("/busy", false);
                        oModel.refresh(true);
                        this.onCancelDecision();
                    }.bind(this),
                    error: function (oError) {
                        this.onCancelDecision();
                        oGlobalModel.setProperty("/busy", false);
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

            /* ************************************** DEVOLUTION ************************************* */

            /**
             * Handle devolution.
             */
            handleDevolution: function () {
                var oView = this.getView(),
                    that = this,
                    oTableItems = this.byId("smartTableTransRecon").getTable().getSelectedItems();

                if (oTableItems.length > 1) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("multipleSelection"),
                        {
                            icon: "ERROR",
                            onClose: null,
                            styleClass: '',
                            initialFocus: null,
                            textDirection: sap.ui.core.TextDirection.Inherit
                        }
                    );
                    return;
                }

                if (!this._pDevolutionDialog) {
                    this._pDevolutionDialog = Fragment.load({
                        id: oView.getId(),
                        name: "zfiexpensesmanage.fragments.Devolution",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                this.onGetExpenses('D').then(function (aFiltered) {
                    if (aFiltered && aFiltered.length) {
                        that._pDevolutionDialog.then(function (oDialog) {
                            oDialog.open();
                        });
                    } else {
                        this.showErrorMessage({
                            oText: this.getResourceBundle().getText("noRECON")
                        });
                    }
                }).catch(function (oError) {
                    return;
                });
            },

            /**
             * Send devolution to Backend.
             */
            onDevolution: function () {
                var oModel = this.getModel(),
                    oGlobalModel = this.getModel("global"),
                    sPath = "/Devolution",
                    oTable = this.byId("DevolutionTable"),
                    oSmartTable = this.byId("smartTableTransRecon").getTable(),
                    oItemData = {},
                    oEntry = {};

                if (oTable.getSelectedItems().length != 1) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"));
                    return;
                }

                oItemData.ExpNo = oTable.getSelectedItem().getBindingContext("Main").getObject().ExpNo;
                oItemData.chknum = oSmartTable.getSelectedItem().getBindingContext().getObject().Chknum;
                oItemData.Cardnumber = oSmartTable.getSelectedItem().getBindingContext().getObject().Cardnumber;
                oItemData.Date = oSmartTable.getSelectedItem().getBindingContext().getObject().sDateFromated.replace(/\./g, "");
                oItemData.Amt = oSmartTable.getSelectedItem().getBindingContext().getObject().Amt;

                oEntry.ExpNo = oItemData.ExpNo
                oEntry.ItemData = JSON.stringify(oItemData)

                oGlobalModel.setProperty("/busy", true);
                oModel.create(sPath, oEntry, {
                    success: function () {
                        oGlobalModel.setProperty("/busy", false);
                        oModel.refresh(true);
                        this.onCancelDecision();
                        this.onCancelDevolution();
                    }.bind(this),
                    error: function (oError) {
                        oGlobalModel.setProperty("/busy", false);
                        this.onCancelDevolution();
                        this.onCancelDecision();
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
             * Cancel devolution.
             */
            onCancelDevolution: function () {
                if (this._pDevolutionDialog) {
                    this._pDevolutionDialog.then(function (oDialog) {
                        oDialog.close();
                        oDialog.destroy();
                    });
                    this._pDevolutionDialog = null;

                }
            },

            //---------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------- Leader Management -----------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------

            /**
             * Apply initial sorter before table binding.
             * @param {sap.ui.base.Event} oEvent
             */
            onBeforeRebindTableApprovals: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams");

                if (!this._bInitialSorterApplied) {
                    oBindingParams.sorter = [new sap.ui.model.Sorter("Erdat", true)];
                }
            },

            /**
             * Check if the user is a leader.
             */
            onCheckLeader: async function () {
                var oModel = this.getModel(),
                    sPath = "/CheckLeader";
                oModel.read(sPath, {
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            if (oData.results[0].Return === true) {
                                this.byId("idApproveExpenses").setVisible(true);
                            }
                        } else {
                            this.byId("idApproveExpenses").setVisible(false);
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

            onOpenDialogReason: function () {
                var oView = this.getView();
                var that = this;

                if (this.byId("idTableApprovals").getSelectedItems().length === 0) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"));
                    return;
                }

                if (!this._oReasonDialog) {
                    this._oReasonDialog = new sap.m.Dialog({
                        title: this.getResourceBundle().getText("reason"),
                        type: "Message",
                        contentWidth: "400px",
                        content: [
                            new sap.m.Text({
                                text: this.getResourceBundle().getText("TextReason")
                            }),
                            new sap.m.TextArea(oView.createId("reasonTextArea"), {
                                width: "100%",
                                rows: 4,
                                growing: true,
                                maxLength: 500,
                                placeholder: this.getResourceBundle().getText("placeholderReason")
                            })
                        ],
                        beginButton: new sap.m.Button({
                            text: "OK",
                            type: "Emphasized",
                            press: function () {
                                that.ReasonRejection = oView.byId("reasonTextArea").getValue();

                                if (!that.ReasonRejection) {
                                    sap.m.MessageToast.show(that.getResourceBundle().getText("messageReason"));
                                    return;
                                }

                                that.onGetItemsTable("R");
                                oView.byId("reasonTextArea").setValue('');
                                that._oReasonDialog.close();
                            }
                        }),
                        endButton: new sap.m.Button({
                            text: this.getResourceBundle().getText("cancelReason"),
                            press: function () {
                                that.ReasonRejection = '';
                                oView.byId("reasonTextArea").setValue("");
                                this.byId("idTableApprovals").removeSelections();

                                that._oReasonDialog.close();
                                that._oReasonDialog.destroy();
                                that._oReasonDialog = null;
                            }
                        }),
                        afterClose: function () {
                            var oTextArea = oView.byId("reasonTextArea");
                            if (oTextArea) {
                                oTextArea.setValue("");
                            }
                        }
                    });

                    oView.addDependent(this._oReasonDialog);
                }

                this._oReasonDialog.open();

            },

            /**
             * Get selected items from table.
             * @param {string} oAction
             */
            onGetItemsTable: function (oAction) {
                var oSelectedItems = this.byId("idTableApprovals").getSelectedItems(),
                    aSelectedData = [],
                    oEntry = {},
                    sReason = this.ReasonRejection;


                if (oSelectedItems.length === 0) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"));
                    return;
                }

                oSelectedItems.forEach(function (oItem) {
                    var oData = oItem.getBindingContext().getObject();
                    aSelectedData.push({
                        pernr: oData.Pernr,
                        exp: oData.ExpNo,
                        FI_STATUS: oData.FiStatus,
                        REASON_REJECTION: sReason
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
                        this.ReasonRejection = '';
                        this.handleButtonsState(false, false);
                    }.bind(this),
                    error: function (oError) {
                        this.getModel("global").setProperty("/busy", false);
                        this.byId("idTableApprovals").removeSelections();
                        this.handleButtonsState(false, false);
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

                oModel.refresh();
            },

            /**
             * Handle selection change.
             */
            onSelectionChangeApprovals: function (oEvent) {
                var oSelectedItems = oEvent.getSource().getSelectedItems();
                if (oSelectedItems.length === 0) {
                    this.handleButtonsState(false, false);
                } else if (oSelectedItems.length === 1) {
                    this.handleButtonsState(true, true);
                }
                else if (oSelectedItems.length > 1) {
                    this.handleButtonsState(false, true);
                }
            },

            /**
            * Handle buttons state.
            * @param {boolean} sState
            */
            handleButtonsState: function (sState1, sState2) {
                this.byId("partialApprovalButton").setEnabled(sState1);
                this.byId("approveButton").setEnabled(sState2);
                this.byId("rejectButton").setEnabled(sState1);
            },

            /**
             * Handle open dialog.
             */
            handleOpenDialog: function () {
                var oView = this.getView(),
                    sValue = this.byId("smartTableApprovals").getTable().getSelectedItems()[0].getBindingContext().getObject().Value,
                    iValue = parseFloat(sValue),
                    oSelectedItems = this.byId("smartTableApprovals").getTable().getSelectedItems();

                if (oSelectedItems.length > 1) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("noSelection"));
                    return;
                }

                this.getView().getModel("Main").setProperty("/inputValue", parseFloat(iValue.toFixed(2)));
                this.getView().getModel("Main").setProperty("/sliderMax", parseFloat(iValue.toFixed(2)));

                if (this._pPartialApprovalDialog) {
                    this.onCancelPartial();
                }

                if (!this._pPartialApprovalDialog) {
                    this._pPartialApprovalDialog = Fragment.load({
                        id: oView.getId(),
                        name: "zfiexpensesmanage.fragments.PartialApproval",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });

                    this._pPartialApprovalDialog.then(function (oDialog) {
                        oDialog.open();
                    });
                }
            },

            /**
             * Handle cancel partial.
             */
            onCancelPartial: function () {
                if (this._pPartialApprovalDialog) {
                    this._pPartialApprovalDialog.then(function (oDialog) {
                        oDialog.close();
                        oDialog.destroy();
                    });
                    this._pPartialApprovalDialog = null;
                }
            },

            /**
             * Handle slider change.
             * @param {sap.ui.base.Event} oEvent
             */
            onSliderChange: function (oEvent) {
                var iValue = oEvent.getParameter("value");
                this.getView().getModel("Main").setProperty("/inputValue", parseFloat(iValue.toFixed(2)));
                this.byId("inputValue").setValue(parseFloat(iValue.toFixed(2)));
            },

            /**
             * Handle value change.
             * @param {sap.ui.base.Event} oEvent
             */
            onValueChange: function (oEvent) {
                var sValue = oEvent.getParameter("value").replace(",", ".");
                var fValue = parseFloat(sValue),
                    iSliderMax = this.getView().getModel("Main").getProperty("/sliderMax");

                if (isNaN(fValue)) fValue = 0;
                if (fValue < 0) fValue = 0;
                if (fValue > iSliderMax) fValue = iSliderMax;

                fValue = parseFloat(fValue.toFixed(2));

                this.getView().getModel("Main").setProperty("/inputValue", fValue);
                this.byId("sliderValue").setValue(fValue);
            },

            onConfirmPartial: function () {
                var oSelectedItems = this.byId("idTableApprovals").getSelectedItems()[0].getBindingContext().getObject(),
                    sPernr = oSelectedItems.Pernr,
                    sExpNo = oSelectedItems.ExpNo,
                    sFiStatus = oSelectedItems.FiStatus,
                    sValue = this.getView().getModel("Main").getProperty("/inputValue"),
                    aSelectedData = [
                        {
                            pernr: sPernr,
                            exp: sExpNo,
                            fi_status: sFiStatus,
                            apprvd_value: sValue
                        }
                    ];


                var oEntry = {
                    DataExp: JSON.stringify(aSelectedData),
                };

                this.handleEvents(oEntry, "PA");
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
                        this.handleButtonsState(false, false);
                        this.onCancelPartial();
                    }.bind(this),
                    error: function (oError) {
                        this.getModel("global").setProperty("/busy", false);
                        this.byId("idTableApprovals").removeSelections();
                        this.handleButtonsState(false, false);
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

                oModel.refresh();
            },

            //---------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------- New Expense ----------------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------

            /**
             * Detaches the camera DOM handlers.
             * @param {HTMLElement} oDomRef - The DOM reference of the camera dialog
             */
            handleDetachCameraListeners: function (oDomRef) {
                if (!oDomRef || !this._handlers) return;

                var captureBtn = oDomRef.querySelector("#captureBtn"),
                    closeBtn = oDomRef.querySelector("#closeBtn"),
                    fileInput = oDomRef.querySelector("#fileUploader"),
                    settingsBtn = oDomRef.querySelector("#settingsBtn");

                if (captureBtn && this._handlers.capture) captureBtn.removeEventListener("click", this._handlers.capture);
                if (closeBtn && this._handlers.close) closeBtn.removeEventListener("click", this._handlers.close);
                if (fileInput && this._handlers.file) fileInput.removeEventListener("change", this._handlers.file);
                if (settingsBtn && this._handlers.settings) settingsBtn.removeEventListener("click", this._handlers.settings);

                this._handlers.capture = null;
                this._handlers.close = null;
                this._handlers.file = null;
                this._handlers.settings = null;
            },

            /**
             * Removes decimals from a float value.
             * @param {number} vValue - The float value to remove decimals from
             * @returns {string} The value without decimals
             */
            handleRemoveDecimals: function (vValue) {
                if (vValue === null || vValue === undefined) {
                    return "";
                }
                return parseInt(vValue, 10);
            },

            /**
             * Validates required fields.
             * @param {string[]} sIds - Array of IDs of the controls to validate
             * @returns {boolean} True if all required fields are valid, false otherwise
             */
            handleValidateRequiredFields: function (sIds) {
                const oView = this.getView();
                let bValid = true;

                const setState = (ctrl, ok) => {
                    if (ctrl.setValueState) {
                        ctrl.setValueState(ok ? sap.ui.core.ValueState.None : sap.ui.core.ValueState.Error);

                        if (!ok && ctrl.setValueStateText) {
                            ctrl.setValueStateText(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("xexp.expFieldRequired"));
                        }
                    }
                };

                const checkisEmpty = (ctrl) => {
                    if (ctrl.getRequired && (!ctrl.getRequired() || !ctrl.getVisible())) {
                        return false;
                    }

                    if (ctrl instanceof sap.m.Input || ctrl instanceof sap.m.TextArea || ctrl instanceof sap.m.MultiInput) {
                        const v = ctrl.getValue ? ctrl.getValue() : "";
                        return (v ?? "").toString().trim() === "";
                    }

                    if (ctrl instanceof sap.m.Select || ctrl instanceof sap.m.ComboBox) {
                        const key = ctrl.getSelectedKey ? ctrl.getSelectedKey() : "";
                        return (key ?? "").toString().trim() === "";
                    }

                    if (ctrl instanceof sap.m.DatePicker || ctrl instanceof sap.m.DateTimePicker) {
                        const v = ctrl.getValue ? ctrl.getValue() : "";
                        return (v ?? "").toString().trim() === "";
                    }
                    return false;
                };

                const getControls = (c, acc) => {
                    acc.push(c);

                    if (c.getItems) (c.getItems() || []).forEach(k => getControls(k, acc));
                    if (c.getContent) (c.getContent() || []).forEach(k => getControls(k, acc));
                    if (c.getCells) (c.getCells() || []).forEach(k => getControls(k, acc));
                    if (c.getAggregation) {
                        ["content", "items", "cells", "blocks", "formContainers", "formElements", "fields", "toolbar", "subHeader"].forEach(a => {
                            const aggr = c.getAggregation(a);
                            if (Array.isArray(aggr)) aggr.forEach(k => getControls(k, acc));
                        });
                    }
                };

                sIds.forEach((id) => {
                    const ctrl = oView.byId(id) || sap.ui.getCore().byId(id);
                    if (!ctrl) return;

                    if (ctrl instanceof sap.m.Table) {
                        const aItems = ctrl.getItems() || [];

                        if (aItems.length === 0) {
                            oView.byId("expenseDialog:messageStrip").setVisible(true);
                            return;
                        } else {
                            oView.byId("expenseDialog:messageStrip").setVisible(false);
                        }

                        aItems.forEach((item) => {
                            const aCells = (item.getCells && item.getCells()) || [];

                            aCells.forEach((cell) => {
                                const bucket = [];

                                getControls(cell, bucket);
                                bucket.forEach((inner) => {
                                    if (
                                        inner instanceof sap.m.Input ||
                                        inner instanceof sap.m.TextArea ||
                                        inner instanceof sap.m.MultiInput ||
                                        inner instanceof sap.m.Select ||
                                        inner instanceof sap.m.ComboBox ||
                                        inner instanceof sap.m.DatePicker ||
                                        inner instanceof sap.m.DateTimePicker
                                    ) {
                                        const empty = checkisEmpty(inner);
                                        setState(inner, !empty);
                                        if (empty) bValid = false;
                                    }
                                });
                            });
                        });
                        return;
                    }

                    const required = ctrl.getRequired ? ctrl.getRequired() : false;

                    if (required) {
                        const empty = checkisEmpty(ctrl);
                        setState(ctrl, !empty);

                        if (empty) {
                            bValid = false;
                        }
                    } else {
                        if (ctrl.setValueState) ctrl.setValueState(sap.ui.core.ValueState.None);
                    }
                });

                return bValid;
            },

            /**
             * Adds a new VAT line to the expense entry dialog.
             */
            onAddVatLine: function (sT, sB) {
                var aVatLines = this.oExpensesModel.getProperty("/vatLines");

                aVatLines.push({ p: "", t: sT, v: "", b: sB });
                this.oExpensesModel.setProperty("/vatLines", aVatLines);

                var idx = aVatLines.length;
                this.handleLogChange("Nova linha adicionada ao resumo IVA (linha " + idx + ")", "", "", "", true);

                this.handleSetupVatTableLogging("expenseDialog:vatTable");
            },

            /**
             * Deletes a VAT line from the expense entry dialog.
             * @param {sap.ui.base.Event} oEvent - The event object
             */
            onDeleteVatLine: function (oEvent) {
                var aLines = this.oExpensesModel.getProperty("/vatLines") || [],
                    oItem = oEvent.getSource().getParent(),
                    oTable = this.byId("expenseDialog:vatTable");

                if (oTable) {
                    var iIndex = oTable.indexOfItem(oItem);

                    if (iIndex > -1) {
                        var snapshot = aLines[iIndex] || {};
                        this.handleLogChange("Linha do resumo IVA (linha " + (iIndex + 1) + ") eliminada", JSON.stringify(snapshot), "", "", true);

                        aLines.splice(iIndex, 1);
                        this.oExpensesModel.setProperty("/vatLines", aLines);

                        this.handleSetupVatTableLogging("expenseDialog:vatTable");
                    }
                }
            },

            /**
             * Toggles the VAT edit mode.
             */
            onToggleVatEdit: function () {
                if (!this.handleValidateRequiredFields(["expenseDialog:vatTable"])) {
                    return;
                }

                this.oExpensesModel.setProperty("/vatEditMode", !this.oExpensesModel.getProperty("/vatEditMode"));
            },

            /**
             * Handles the change event of the VAT type select.
             * @param {Event} oEvent - The event object
             */
            onVatTypeChange: function (oEvent) {
                const oSelect = oEvent.getSource();
                const oSelectedItem = oEvent.getParameter("selectedItem");
                if (!oSelectedItem) return;

                const sDesc = oSelectedItem.getText();

                const oCtx = oSelect.getBindingContext("Expenses");
                if (!oCtx) return;

                const oModel = oCtx.getModel();
                oModel.setProperty(oCtx.getPath() + "/d", sDesc);

                this.onVatCellChange(oEvent);
            },

            /**
             * Starts the expense creation process by opening the camera fragment,
             * initializing the camera, and binding click handlers for capture/upload/close actions.
             */
            handleStartProcess: function () {
                var Device = sap.ui.Device;
                var oView = this.getView();

                this._bError = false;
                this._bSubmit = false;
                this._cancel = false;
                this._chknum = "";
                this._cardnum = "";

                this.handleResetModels();

                if (!this.oCameraDialog) {
                    this.oCameraDialog = sap.ui.xmlfragment("zfiexpensesmanage.fragments.Camara", this);

                    oView.addDependent(this.oCameraDialog);
                }

                this.oCameraDialog.open();

                setTimeout(() => {
                    var oDomRef = this.oCameraDialog.getDomRef();
                    if (!oDomRef) return;

                    this.handleStartCamera("environment", oDomRef);

                    this.handleDetachCameraListeners(oDomRef);

                    this._handlers.capture = this.onTakePhoto.bind(this);
                    this._handlers.close = this.onCloseCamera.bind(this);
                    this._handlers.file = this.onSelectFile.bind(this);
                    this._handlers.settings = this.handleSettings.bind(this);

                    var captureBtn = oDomRef.querySelector("#captureBtn"),
                        closeBtn = oDomRef.querySelector("#closeBtn"),
                        fileInput = oDomRef.querySelector("#fileUploader"),
                        settingsBtn = oDomRef.querySelector("#settingsBtn");

                    if (captureBtn) captureBtn.addEventListener("click", this._handlers.capture);
                    if (closeBtn) closeBtn.addEventListener("click", this._handlers.close);
                    if (fileInput) fileInput.addEventListener("change", this._handlers.file);
                    if (settingsBtn) settingsBtn.addEventListener("click", this._handlers.settings);
                }, 200);
            },

            /**
             * Loads and opens the expense entry dialog fragment
             */
            handleFinishProcess: function (oData, oAction) {
                var that = this,
                    oView = this.getView();

                if (!this._pExpenseDialog) {
                    this._pExpenseDialog = Fragment.load({
                        id: oView.getId(),
                        name: "zfiexpensesmanage.fragments.NewExp",
                        controller: this
                    }).then(function (oDialog) {
                        oView.addDependent(oDialog);
                        return oDialog;
                    });
                }

                this._pExpenseDialog.then(function (oDialog) {
                    if (oAction === "M") {
                        that.handleStateFields();
                    } else {
                        Fragment.byId(oView.getId(), "expenseDialog:selectExpType").bindItems({
                            path: "/ZFI_EXPENSES_TYPES",
                            template: new sap.ui.core.Item({
                                key: "{Exptype}",
                                text: "{Description}"
                            })
                        });
                    }

                    if (oData) {
                        that.handleSetValues(oData);
                        that.handleCheckUnit();
                    } else {
                        Fragment.byId(oView.getId(), "expenseDialog:datePicker").setDateValue(new Date());

                        that.onAddVatLine();
                        that.oExpensesModel.setProperty("/vatEditMode", true);
                    }

                    if (oAction !== "M") that.handleLoadCreditCards();

                    oDialog.open();

                    that.handleSetupFieldsLogging();

                    var oVatTable = that.byId("expenseDialog:vatTable");
                    if (oVatTable) {
                        that.handleSetupVatTableLogging("expenseDialog:vatTable");

                        oVatTable.attachUpdateFinished(function () {
                            that.handleSetupVatTableLogging("expenseDialog:vatTable");
                        });
                    }
                });
            },

            /**
            * Loads the credit cards from the OData service
            */
            handleLoadCreditCards: function () {
                var oModel = this.getView().getModel();

                oModel.read("/CreditCards", {
                    success: function (oData) {
                        var aCards = oData.results || [];

                        var oCardsModel = this.getView().getModel("Cards");
                        oCardsModel.setProperty("/items", aCards);
                        oCardsModel.setProperty("/hasData", aCards.length > 0);

                    }.bind(this),
                    error: function () { }
                });
            },

            /**
             * Handles the state fields of the expense entry dialog when the action is "M"
             */
            handleStateFields: function () {
                var oView = this.getView();
                var fnById = (id) => Fragment.byId(oView.getId(), id);

                fnById("expenseDialog:selectExpType").bindItems({
                    path: "/ZFI_EXPENSES_TYPES3",
                    template: new sap.ui.core.Item({
                        key: "{Exptype}",
                        text: "{Description}"
                    })
                });

                fnById("expenseDialog:textAreaComments").setRequired(true);
                fnById("expenseDialog:inputExpNo").setRequired(false);
                fnById("expenseDialog:inputLocal").setRequired(false);
                fnById("expenseDialog:datePicker").setEnabled(false);
                fnById("expenseDialog:inputNif").setRequired(false);
                fnById("expenseDialog:selectCountry").setRequired(false);
                fnById("expenseDialog:selectExpType").setEnabled(false);
                fnById("expenseDialog:selectExpSubType").setRequired(false);
                fnById("expenseDialog:selectBP").setRequired(false);
                fnById("expenseDialog:inputPlate").setRequired(false);
                fnById("expenseDialog:inputFuelQuantity").setRequired(false);
                fnById("expenseDialog:selectPymtMeth").setEnabled(false);
                fnById("expenseDialog:inputAmt").setEnabled(false);
                fnById("expenseDialog:titleVatTable").setVisible(false);
                fnById("expenseDialog:vatTable").setVisible(false);
                fnById("expenseDialog:labelAttachment").setVisible(false);
                fnById("fileUploader").setVisible(false);
            },

            /**
             * Sets the values of the expense entry dialog
             * @param {Object} oData - The data to set
             */
            handleSetValues: function (oData) {
                var oView = this.getView();

                this._bScan = true;

                this.oExpensesModel.setProperty("/expNo", oData.ExpNo);
                this.oExpensesModel.setProperty("/valid", oData.Valid);
                this.oExpensesModel.setProperty("/nifCompany", oData.Nifc);

                Fragment.byId(oView.getId(), "expenseDialog:inputExpNo").setValue(oData.ExpNo);
                Fragment.byId(oView.getId(), "expenseDialog:inputLocal").setValue(oData.Local);
                Fragment.byId(oView.getId(), "expenseDialog:inputNif").setValue(oData.Nifs);
                Fragment.byId(oView.getId(), "expenseDialog:selectCountry").setSelectedKey(oData.Country);
                Fragment.byId(oView.getId(), "expenseDialog:selectExpType").setSelectedKey(oData.Exptype);
                Fragment.byId(oView.getId(), "expenseDialog:inputFuelQuantity").setValue(oData.Fuelqty);
                Fragment.byId(oView.getId(), "expenseDialog:inputAmt").setValue(oData.Amt);

                if (oData.Date) {
                    Fragment.byId(oView.getId(), "expenseDialog:datePicker").setDateValue(oData.Date);
                } else {
                    Fragment.byId(oView.getId(), "expenseDialog:datePicker").setDateValue(new Date());
                }

                try {
                    if (oData.TableIva) {
                        var aVat = JSON.parse(oData.TableIva) || [];
                        var aVatNorm = aVat.map(row => ({
                            idx: row.idx,
                            v: row.v,
                            b: row.b,
                            t: row.t,
                            d: row.d
                        }));

                        this.oExpensesModel.setProperty("/vatLines", aVatNorm);
                        this.oExpensesModel.setProperty("/vatEditMode", false);
                    } else {
                        if (oData.Exptype === "UE") {
                            this.onAddVatLine("ISE", oData.Amt);
                        } else {
                            this.onAddVatLine("", "");
                        }
                    }
                } catch (e) {
                    this.oExpensesModel.setProperty("/vatLines", []);
                }

                this.handleLogPrefilledFields();
            },

            /**
             * Finishes the expense creation process
             */
            onFinishProcess: async function () {
                this._bSubmit = true;

                const sIds = [
                    "expenseDialog:inputExpNo",
                    "expenseDialog:inputLocal",
                    "expenseDialog:datePicker",
                    "expenseDialog:inputNif",
                    "expenseDialog:selectCountry",
                    "expenseDialog:selectExpType",
                    "expenseDialog:selectExpSubType",
                    "expenseDialog:selectBP",
                    "expenseDialog:inputPlate",
                    "expenseDialog:inputFuelQuantity",
                    "expenseDialog:selectPymtMeth",
                    "expenseDialog:inputAmt",
                    "expenseDialog:textAreaComments",
                    "expenseDialog:inputUnit",
                    "expenseDialog:vatTable"
                ];
                var oView = this.getView(),
                    sExpType = Fragment.byId(oView.getId(), "expenseDialog:selectExpType").getSelectedKey(),
                    sAmt = Fragment.byId(oView.getId(), "expenseDialog:inputAmt").getValue(),
                    sTotal = parseFloat((sAmt * 1.75).toFixed(2));

                if (sExpType !== "UE") {
                    if (!this.handleValidateRequiredFields(sIds)) {
                        return;
                    }
                }

                if (sExpType === "UE") {
                    var bContinue = await new Promise(resolve => {
                        sap.m.MessageBox.confirm(this.getResourceBundle().getText("confirmUE") + " " + sTotal + this.getResourceBundle().getText("confirmUE2"),
                            {
                                icon: sap.m.MessageBox.Icon.WARNING,
                                actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                                emphasizedAction: sap.m.MessageBox.Action.YES,
                                onClose: function (sAction) {
                                    resolve(sAction === sap.m.MessageBox.Action.YES);
                                }
                            }
                        );
                    });

                    if (!bContinue) {
                        return;
                    }
                }

                var oModel = oView.getModel(),
                    that = this,
                    oEntry = {};

                oEntry.Valid = this.oExpensesModel.getProperty("/valid");
                oEntry.OExpNo = this.oExpensesModel.getProperty("/expNo");
                oEntry.Nifc = this.oExpensesModel.getProperty("/nifCompany");

                oEntry.ExpNo = Fragment.byId(oView.getId(), "expenseDialog:inputExpNo").getValue();
                oEntry.Bktxt = Fragment.byId(oView.getId(), "expenseDialog:inputLocal").getValue();
                oEntry.Nif = Fragment.byId(oView.getId(), "expenseDialog:inputNif").getValue();
                oEntry.Exptype = Fragment.byId(oView.getId(), "expenseDialog:selectExpType").getSelectedKey();
                oEntry.Pymtmeth = Fragment.byId(oView.getId(), "expenseDialog:selectPymtMeth").getSelectedKey();
                oEntry.Land1 = Fragment.byId(oView.getId(), "expenseDialog:selectCountry").getSelectedKey();
                oEntry.Sdate = Fragment.byId(oView.getId(), "expenseDialog:datePicker").getValue();
                oEntry.Value = Fragment.byId(oView.getId(), "expenseDialog:inputAmt").getValue();
                oEntry.Comments = Fragment.byId(oView.getId(), "expenseDialog:textAreaComments").getValue();
                oEntry.TableIva = JSON.stringify(oView.getModel("Expenses").getProperty("/vatLines"));

                oEntry.Doc = await this.onConvertToPDF(oView.getModel("Expenses").getProperty("/capturedImage"));
                oEntry.DocType = "PDF";

                var aLogs = this.getView().getModel("Logs").getProperty("/entries") || [];
                oEntry.Log = JSON.stringify(aLogs);

                if ((oEntry.Exptype || '').indexOf('COMBST') > -1) {
                    oEntry.Fuelqty = Fragment.byId(oView.getId(), "expenseDialog:inputFuelQuantity").getValue();
                }

                if (Fragment.byId(oView.getId(), "expenseDialog:inputPlate").getVisible()) {
                    oEntry.Plate = Fragment.byId(oView.getId(), "expenseDialog:inputPlate").getValue();
                }

                if (Fragment.byId(oView.getId(), "expenseDialog:inputUnit").getVisible()) {
                    const iValue = Fragment.byId(oView.getId(), "expenseDialog:inputUnit").getValue();

                    oEntry.Unit = String(iValue);
                }

                if (Fragment.byId(oView.getId(), "expenseDialog:selectBP").getVisible()) {
                    const sValue = Fragment.byId(oView.getId(), "expenseDialog:selectBP").data("BPKey");

                    oEntry.Partner = String(sValue);
                }

                if (Fragment.byId(oView.getId(), "expenseDialog:selectExpSubType").getVisible()) {
                    const sValue = Fragment.byId(oView.getId(), "expenseDialog:selectExpSubType").getSelectedKey();

                    oEntry.Expsubtype = String(sValue);
                }

                var sCardnumber = this.byId("expenseDialog:selectCreditCard").getSelectedKey();

                oEntry.Cardnumber = sCardnumber || this._cardnum;
                oEntry.Chknum = this._chknum;

                this.handleCheckTaxID(oEntry.Nif).then(function (canProceed) {
                    if (!canProceed) {
                        return;
                    }

                    sap.ui.core.BusyIndicator.show(0);

                    oModel.create("/Expense", oEntry, {
                        success: function (oData, oResponse) {
                            sap.ui.core.BusyIndicator.hide();

                            try {
                                var sHeaders = oResponse.headers;

                                if (sHeaders) {
                                    var sResponse = JSON.parse(sHeaders["sap-message"]).message;

                                    if (sResponse) {
                                        sap.m.MessageBox.warning(sResponse);
                                        that.handleLogChange("Aviso na criação da despesa", "", "", sResponse);
                                    } else {
                                        that.handleLogChange("Sucesso na criação da despesa");
                                    }
                                }
                            } catch (error) {

                            }
                            that.getCardValues();
                            that.handleSuccessSubmit();
                            oModel.refresh(true);
                        },
                        error: function (oError) {
                            sap.ui.core.BusyIndicator.hide();

                            var sError = JSON.parse(oError.responseText).error.message.value;
                            that.handleErrorMessage(sError);
                            that.handleLogChange("Erro na criação da despesa", "", "", sError);
                        }
                    });
                });
            },

            /**
             * Checks if the tax ID of the document is valid.
             */
            handleCheckTaxID: function () {
                var that = this;
                var sNifCompany = this.oExpensesModel.getProperty("/nifCompany");
                var bValid = this.oExpensesModel.getProperty("/valid");

                return new Promise(function (resolve) {
                    var isValidEmpty = bValid === "" || bValid === null || bValid === undefined || bValid === false;

                    if (isValidEmpty && that._bScan === true) {
                        var sMessage;
                        if (!sNifCompany) {
                            sMessage = that.getResourceBundle().getText("xexp.expNifMismatch2");
                        } else {
                            sMessage = that.getResourceBundle().getText("xexp.expNifMismatch", [sNifCompany]);
                        }

                        sap.m.MessageBox.warning(sMessage, {
                            actions: [sap.m.MessageBox.Action.OK, sap.m.MessageBox.Action.CANCEL],
                            emphasizedAction: sap.m.MessageBox.Action.OK,
                            onClose: function (oAction) {
                                resolve(oAction === sap.m.MessageBox.Action.OK);
                            }
                        });
                    } else {
                        resolve(true);
                    }
                });
            },

            /**
             * Handles the success submit of the expense creation process.
             */
            handleSuccessSubmit: function () {
                this.oScanningModel.setProperty("/illustrationType", "sapIllus-SuccessScreen");
                this.oScanningModel.setProperty("/title", this.getResourceBundle().getText("xexp.expSuccessTitle"));
                this.oScanningModel.setProperty("/description", this.getResourceBundle().getText("xexp.expSuccessDescription"));

                this.handleOpenScanningFrgmnt();
                this.getView().getModel("Scan").setProperty("/processingDialogBtnVisible", false);

                this.onCancelProcess(true);

                setTimeout(() => {
                    this.onStopScanning();
                }, 2500);
            },

            /**
             * Cancels the expense creation process:
             * closes and destroys the dialog, and clears the captured image from the model.
             */
            onCancelProcess: function (bClearImage) {
                if (this._pExpenseDialog) {
                    this._pExpenseDialog.then(function (oDialog) {
                        oDialog.close();
                        oDialog.destroy();
                    });
                    this._pExpenseDialog = null;
                }

                if (bClearImage) {
                    this.oExpensesModel.setProperty("/capturedImage", "");
                    this.oExpensesModel.setProperty("/vatLines", []);
                }
            },

            /**
             * Reset application models to the same defaults used in onInit.
             */
            handleResetModels: function () {
                this.getView().getModel("Camera")?.setData({});

                this.getView().getModel("Expenses")?.setData({
                    vatLines: [],
                    vatEditMode: true,
                    unitVisible: false
                });

                this.getView().getModel("Scan")?.setData({
                    processingDialogBtnVisible: true,
                    aiScan: true
                });

                this.getView().getModel("Scanning")?.setData({
                    title: "",
                    description: "",
                    illustrationType: ""
                });

                this.getView().getModel("Cards")?.setData({ hasData: false, items: [] });

                this.getView().getModel("Logs")?.setData({ entries: [] });
            },

            /**
             * Starts the device camera stream using the specified facing mode.
             * @param {string} facingMode - Camera direction ("user" or "environment")
             * @param {Element} oDomRef - DOM do diálogo/view que contém #cameraVideo
             */
            handleStartCamera: async function (facingMode, oDomRef) {
                this.getView().getModel("Camera").setProperty("/mode", facingMode);

                try {
                    this.handleStopAllDetect(oDomRef);

                    var video = oDomRef.querySelector("#cameraVideo");
                    if (!video) {
                        sap.m.MessageToast.show("Vídeo não encontrado.");
                        return;
                    }

                    let stream;
                    try {
                        stream = await navigator.mediaDevices.getUserMedia({
                            audio: false,
                            video: {
                                facingMode: { exact: facingMode },
                                width: { ideal: 1920 },
                                height: { ideal: 1080 },
                                frameRate: { ideal: 60 },
                                aspectRatio: 16 / 9
                            }
                        });
                    } catch (e) {
                        stream = await navigator.mediaDevices.getUserMedia({
                            audio: false,
                            video: { facingMode }
                        });
                    }

                    video.playsInline = true;
                    video.muted = true;
                    video.srcObject = stream;
                    await video.play();

                    this._photoTaken = false;
                    this.handleScheduleCameraAutoClose(120000);

                    var track = stream.getVideoTracks()[0],
                        caps = track.getCapabilities && track.getCapabilities();

                    if (caps) {
                        const wanted = {
                            width: caps.width ? caps.width.max : undefined,
                            height: caps.height ? caps.height.max : undefined,
                            frameRate: caps.frameRate ? Math.min(60, caps.frameRate.max) : undefined
                        };

                        await track.applyConstraints({
                            width: wanted.width,
                            height: wanted.height,
                            frameRate: wanted.frameRate
                        }).catch(() => { });
                    }

                    this.handleCreateOverlayCanvas(video);
                    this.onLiveDetect(oDomRef);
                    this.onStartAutoDetect();

                    this._cameraStream = stream;
                } catch (err) {
                    sap.m.MessageToast.show(this.getResourceBundle().getText("xexp.expErrorStartCamera"));
                }
            },

            /** 
             * Schedule camera auto close 
             */
            handleScheduleCameraAutoClose: function (ms = 120000) {
                this.handleClearCameraAutoClose();

                this._cameraCloseTimeout = setTimeout(() => {
                    if (this._cameraStream && !this._photoTaken) {
                        this.onCloseCamera?.();
                    }
                }, ms);
            },

            /** 
             * Clear camera auto close 
             */
            handleClearCameraAutoClose: function () {
                if (this._cameraCloseTimeout) {
                    clearTimeout(this._cameraCloseTimeout);
                    this._cameraCloseTimeout = null;
                }
            },

            /**
             * Switches the camera between front and back.
             */
            handleSwitchCamera: function () {
                var vFacingMode = this.oCameraModel.getProperty("/mode"),
                    vNewFacingMode = vFacingMode === "user" ? "environment" : "user";

                this.handleStartCamera(vNewFacingMode, this.oCameraDialog.getDomRef());
            },

            /**
             * Stops the active camera stream and closes the camera dialog.
             */
            onCloseCamera: function () {
                try {
                    this.handleStopAllDetect();

                    var video = null;

                    if (this.oCameraDialog && this.oCameraDialog.getDomRef()) {
                        video = this.oCameraDialog.getDomRef().querySelector("#cameraVideo");
                    }
                    if (!video && this.getView() && this.getView().getDomRef()) {
                        video = this.getView().getDomRef().querySelector("#cameraVideo");
                    }

                    var stream = (video && video.srcObject) || this._cameraStream;

                    if (stream && typeof stream.getTracks === "function") {
                        stream.getTracks().forEach(function (t) {
                            try { t.stop(); } catch (e) { }
                        });
                    }

                    if (video) {
                        try { video.pause(); } catch (e) { }

                        video.srcObject = null;
                        video.removeAttribute("src");

                        try { video.load(); } catch (e) { }
                    }
                } finally {
                    this.handleClearCameraAutoClose();

                    this._cameraStream = null;

                    if (this.oCameraDialog) {
                        this.oCameraDialog.close();
                        this.oCameraDialog.destroy();
                        this.oCameraDialog = null;
                    }
                }
            },


            /**
             * Handles the scanning of a photo by closing the camera and opening the scanning dialog.
             */
            handleScanPhoto: function () {
                var vAiScan = this.oScanModel.getProperty("/aiScan");

                this.onCloseCamera();

                if (!vAiScan) {
                    this.handleFinishProcess();
                    return;
                }

                this.handleScanningDialog();
            },

            /**
             * Scans the photo with OpenAI API (ChatGPT) and opens the expense entry dialog.
             */
            onScanPhoto: function () {
                var oEntry = {},
                    oModel = this.getView().getModel(),
                    vBase64 = this.oExpensesModel.getProperty("/capturedImage"),
                    vDocType = this.oExpensesModel.getProperty("/imageExt");

                if (!vBase64) return;

                if (this._cancel) return;

                oEntry.Base64 = vBase64;
                oEntry.DocType = vDocType;

                oModel.create("/ReadImage", oEntry, {
                    success: (oData) => {
                        if (!this._cancel) {
                            this.handleFinishProcess(oData, "A");
                            this.onStopScanning();
                        }
                    },
                    error: (oError) => {
                        if (!this._cancel) {
                            this._bError = true;
                            this.handleScanError();
                        }
                    }
                });
            },

            /**
             * Handles the scanning error by changing de processing dialog title and description.
             */
            handleScanError: function () {
                this.oScanningModel.setProperty("/illustrationType", "sapIllus-SimpleError");
                this.oScanningModel.setProperty("/title", this.getResourceBundle().getText("xexp.expScanErrorTitle"));
                this.oScanningModel.setProperty("/description", this.getResourceBundle().getText("xexp.expScanErrorDescription"));

                setTimeout(() => {
                    this.onStopScanning();
                    this.onCancelProcess(false);
                    this.handleFinishProcess();
                }, 3000);
            },

            /**
             * Opens the scanning dialog with a processing animation.
             */
            handleScanningDialog: function () {
                this.onScanPhoto();

                this.handleOpenScanningFrgmnt();

                this.oScanningModel.setProperty("/illustrationType", "sapIllus-BeforeSearch");
                this.oScanningModel.setProperty("/title", this.getResourceBundle().getText("xexp.expScanTitle"));
                this.oScanningModel.setProperty("/description", this.getResourceBundle().getText("xexp.expScanDescription"));

                setTimeout(() => {
                    if (this._bError || this._bSubmit) return;

                    this.oScanningModel.setProperty("/title", this.getResourceBundle().getText("xexp.expScanAlmostThere"));
                    this.oScanningModel.setProperty("/description", this.getResourceBundle().getText("xexp.expScanAlmostThereDescription"));

                    this.byId("im").setBusy(false);

                    setTimeout(() => {
                        if (this._bError || this._bSubmit) return;

                        this.oScanningModel.setProperty("/title", this.getResourceBundle().getText("xexp.expScanPreparingResults"));
                        this.oScanningModel.setProperty("/description", this.getResourceBundle().getText("xexp.expScanPreparingResultsDescription"));
                    }, 5000);
                }, 4000);
            },

            /**
             * Opens the scanning fragment
             */
            handleOpenScanningFrgmnt: function () {
                if (!this._pProcessingDialog) {
                    this._pProcessingDialog = Fragment.load({
                        id: this.getView().getId(),
                        name: "zfiexpensesmanage.fragments.Scanning",
                        controller: this
                    }).then(oDialog => {
                        this.getView().addDependent(oDialog);
                        return oDialog;
                    });
                }
                this._pProcessingDialog.then(oDialog => oDialog.open());
            },

            /**
             * Stops the scanning process.
             */
            onStopScanning: function () {
                if (this._pProcessingDialog) {
                    this._pProcessingDialog.then(oDialog => oDialog.close());
                }

                this._cancel = true;
            },

            /**
             * Opens the settings popover.
             */
            handleSettings: function () {
                var oView = this.getView(),
                    oHtml = sap.ui.getCore().byId("cameraHTML"),
                    oBtnDom = oHtml && oHtml.getDomRef() && oHtml.getDomRef().querySelector("#settingsBtn");

                if (!oBtnDom) {
                    oBtnDom = oView.getDomRef();
                }

                if (!this._pSettingsPopover) {
                    this._pSettingsPopover = Fragment.load({
                        id: oView.getId(),
                        name: "zfiexpensesmanage.fragments.Settings",
                        controller: this
                    }).then(function (oPopover) {
                        oView.addDependent(oPopover);
                        return oPopover;
                    });
                }

                this._pSettingsPopover.then(function (oPopover) {
                    oPopover.openBy(oBtnDom);
                });
            },

            /**
             * Toggles the AI scanning switch.
             * @param {Event} oEvent - The event object
             */
            handleAiExtractToggle: function (oEvent) {
                var bCheck = oEvent.getParameter("state");

                this.oScanModel.setProperty("/aiScan", bCheck);
            },

            /**
             * Closes the settings popover.
             */
            onCloseSettings: function () {
                this._pSettingsPopover.then(function (oPopover) {
                    oPopover.close();
                });
            },


            /**
             * Captures a photo from the live camera stream,
             * saves it as a base64 PNG in the "Expenses" model, and opens the expense dialog.
             */
            onTakePhoto: async function () {
                this._photoTaken = true;

                const root =
                    (this.oCameraDialog && this.oCameraDialog.getDomRef()) ||
                    (this.getView() && this.getView().getDomRef()) || document;

                const video = root.querySelector && root.querySelector("#cameraVideo");
                if (!video || !video.videoWidth || !video.videoHeight) {
                    return;
                }

                let dataURL;
                try {
                    const quad = this._aLastQuadVideoPx;
                    if (quad && quad.length === 4) {
                        dataURL = await this.handleWarp(video, quad);
                    } else {
                        dataURL = this.handleCaptureFrame(video);
                    }
                } catch (e) {
                    dataURL = this.handleCaptureFrame(video);
                }

                if (this.oExpensesModel) {
                    this.oExpensesModel.setProperty("/capturedImage", dataURL);
                    this.oExpensesModel.setProperty("/imageExt", "PNG");
                }

                if (!this._aLastQuadVideoPx) {
                    this.onCloseCamera();

                    await this.openManualCropDialog();
                    return;
                }

                this.handleScanPhoto?.();
            },

            /**
             * Handles image file upload by reading it as base64,
             * saving it in the "Expenses" model, and then opening the expense dialog.
             * @param {Event} oEvent - File input change event
             */
            onSelectFile: function (oEvent) {
                this._photoTaken = true;

                var oFile = oEvent.target.files[0];
                if (!oFile) return;

                var reader = new FileReader();

                reader.onload = function (e) {
                    var sBase64 = e.target.result;
                    var sMime = oFile.type && oFile.type.length ? oFile.type : "";
                    if (!sMime) {
                        var m = /^data:([^;]+);base64,/.exec(sBase64);
                        sMime = m && m[1] ? m[1] : "";
                    }

                    var sExt = "";
                    if (sMime.startsWith("image/")) {
                        sExt = sMime.split("/")[1].toLowerCase();

                        if (sExt === "jpeg") sExt = "JPG";
                        if (sExt === "jpg") sExt = "JPG";
                    } else if (sMime === "application/pdf") {
                        sExt = "PDF";
                    } else {
                        sap.m.MessageToast.show(this.getResourceBundle().getText("xexp.expScanUnsupportedFile"));
                        return;
                    }

                    if (this.oExpensesModel) {
                        this.oExpensesModel.setProperty("/capturedImage", sBase64);
                        this.oExpensesModel.setProperty("/imageExt", sExt);
                    }

                    this.handleClearCameraAutoClose();
                    this.handleScanPhoto();
                }.bind(this);

                reader.readAsDataURL(oFile);
            },

            /**
             * Handles the change of the expense type by updating the "Expenses" model.
             * @param {Event} oEvent - The event object
             */
            onExpTypeChange: function (oEvent) {
                const oSelect = oEvent.getSource();
                const oItem = oEvent.getParameter("selectedItem") || oSelect.getSelectedItem();
                const sKey = oItem ? oItem.getKey() : oSelect.getSelectedKey();

                this.oExpensesModel.setProperty("/exptype", sKey);
                this.oExpensesModel.refresh(true);

                const oPlateInput = Fragment.byId(this.getView().getId(), "expenseDialog:inputPlate");
                oPlateInput.setRequired(sKey !== "ADR");

                this.handleCheckUnit();
            },

            /**
             * Handles the change of the country by updating the "Expenses" model.
             * @param {Event} oEvent - The event object
             */
            onCountryChange: function (oEvent) {
                try {
                    const viewId = this.getView().getId();
                    const oItem = oEvent.getParameter("selectedItem");
                    const oContext = oItem.getBindingContext();
                    const oObject = oContext.getObject();

                    const isEur = oObject.Waers === "EUR";
                    const isPartOfEU = oObject.IsPartOfEU === true || oObject.IsPartOfEU === "X";
                    const text = this.getResourceBundle().getText("xexp.expValueWithCurr", [oObject.WaersDesc, oObject.Waers]);

                    if (!isEur && oObject.WaersDesc && oObject.Waers) {
                        Fragment.byId(viewId, "expenseDialog:labelAmt").setText(text);
                    } else {
                        Fragment.byId(viewId, "expenseDialog:labelAmt").setText(
                            this.getResourceBundle().getText("xexp.expValue2")
                        );
                    }

                    Fragment.byId(viewId, "expenseDialog:inputNif").setVisible(isPartOfEU ? true : false);
                } catch (sError) {
                    this.handleErrorMessage(sError);
                }

                this.handleCheckUnit();
            },

            /**
             * Handles the check of the unit.
             * @param {Object} oData - The data object
             */
            handleCheckUnit: function (oData) {
                const oModel = this.getModel();
                const that = this;
                var vLand1, vExptype;

                if (!oData) {
                    vLand1 = Fragment.byId(this.getView().getId(), "expenseDialog:selectCountry").getSelectedKey();
                    vExptype = Fragment.byId(this.getView().getId(), "expenseDialog:selectExpType").getSelectedKey();
                } else {
                    vLand1 = oData.Land1;
                    vExptype = oData.Exptype;
                }

                this.oExpensesModel.setProperty("/unitVisible", false);

                var sPath = "/TransactionLimit";
                if (vLand1 && vExptype) {
                    sPath += "(Land1='" + vLand1 + "',Exptype='" + vExptype + "')";

                    sap.ui.core.BusyIndicator.show(0);

                    oModel.read(sPath, {
                        success: function (oData) {
                            sap.ui.core.BusyIndicator.hide();

                            if (oData.Unit) {
                                that.oExpensesModel.setProperty("/unitVisible", true);
                            }
                        },
                        error: function (oError) {
                            sap.ui.core.BusyIndicator.hide();

                            var sError = JSON.parse(oError.responseText).error.message.value;
                            that.handleErrorMessage(sError);
                        }
                    });
                }
            },

            /**
            * Handles error messages.
            * @param {string} vError - Error message
            */
            handleErrorMessage: function (vError) {
                sap.m.MessageBox.alert(vError, {
                    icon: "ERROR",
                    onClose: null,
                    styleClass: '',
                    initialFocus: null,
                    textDirection: sap.ui.core.TextDirection.Inherit
                });
            },

            /* ************************************************************************************** */
            /* *                                        Logs                                        * */
            /* ************************************************************************************** */


            /* ************************************** VAT Table ************************************* */

            /**
             * Recursively searches for final controls (Input/Select) within a container.
             * @param {sap.ui.core.Control} ctrl - The control to search within
             * @param {sap.ui.core.Control[]} out - Array to store found controls
             */
            handleGetInputsAndSelects: function (ctrl, out) {
                if (!ctrl) { return; }

                if (ctrl instanceof sap.m.Input || ctrl instanceof sap.m.Select) {
                    out.push(ctrl);
                    return;
                }

                var tryAgg = function (name) {
                    var aggr = ctrl.getAggregation && ctrl.getAggregation(name);
                    if (Array.isArray(aggr)) {
                        aggr.forEach(function (child) { this.handleGetInputsAndSelects(child, out); }.bind(this));
                    } else if (aggr) {
                        this.handleGetInputsAndSelects(aggr, out);
                    }
                }.bind(this);

                tryAgg("items");
                tryAgg("content");
                tryAgg("cells");
                tryAgg("formElements");
                tryAgg("fields");
                tryAgg("blocks");
                tryAgg("subHeader");
                tryAgg("toolbar");
            },

            /**
             * Sets up VAT table logging.
             * @param {string} sId - The ID of the VAT table
             */
            handleSetupVatTableLogging: function (sId) {
                var oVatTable = this.byId(sId);
                if (!oVatTable) { return; }

                var that = this;

                if (!(oVatTable.getItems() || []).length) {
                    oVatTable.attachEventOnce("updateFinished", function () {
                        that.handleSetupVatTableLogging(sId);
                    });
                    return;
                }

                (oVatTable.getItems() || []).forEach(function (item) {
                    (item.getCells() || []).forEach(function (cell) {
                        var leafCtrls = [];
                        that.handleGetInputsAndSelects(cell, leafCtrls);

                        leafCtrls.forEach(function (leaf) {
                            that.handleRememberPrev(leaf);

                            if (leaf.attachBrowserEvent) {
                                leaf.attachBrowserEvent("focusin", that.handleRememberPrev.bind(that, leaf));
                            }
                        });
                    });
                });

                if (!oVatTable.__loggingHooked) {
                    oVatTable.__loggingHooked = true;
                    oVatTable.attachUpdateFinished(function () {
                        that.handleSetupVatTableLogging(sId);
                    });
                }
            },

            /**
             * VAT table cell–specific logging (bind to cells' change event).
             * @param {sap.ui.base.Event} oEvent
             */
            onVatCellChange: function (oEvent) {
                var ctrl = oEvent.getSource();
                var ctx = ctrl.getBindingContext("Expenses");
                if (!ctx) {
                    return;
                }

                var path = ctx.getPath();
                var idx = path.split("/").pop();

                var prop = "";
                if (ctrl.getValue && ctrl.getBinding && ctrl.getBinding("value")) {
                    prop = ctrl.getBinding("value").getPath();

                } else if (ctrl instanceof sap.m.Select) {
                    prop = "t";
                }

                var colLabelMap = {
                    "t": "campo tipo de IVA",
                    "b": "campo valor base",
                    "v": "campo IVA",
                    "d": "Descrição"
                };
                var prettyCol = colLabelMap[prop] || prop;

                var oldVal = ctrl.data("__prev");
                var newVal = this.handleGetFieldValue(ctrl, oEvent);

                this.handleLogChange("Alteração de valor em resumo IVA (linha " + (Number(idx) + 1) + ") " + prettyCol, oldVal, newVal);

                ctrl.data("__prev", newVal);
            },

            /* ************************************** Other Fields ************************************* */

            /**
             * Call this when the dialog opens: wires logging to all simple fields.
             */
            handleSetupFieldsLogging: function () {
                var that = this;
                this.handleGetFieldsMap().forEach(function (m) {
                    that.handleAttachLoggingForControl(m);
                });
            },

            /**
             * Maps dialog field.
             * @returns {Array<{id:string,label:string}>}
             */
            handleGetFieldsMap: function () {
                return [
                    { id: "expenseDialog:inputExpNo", label: "número da despesa" },
                    { id: "expenseDialog:inputLocal", label: "estabelecimento" },
                    { id: "expenseDialog:datePicker", label: "data da despesa" },
                    { id: "expenseDialog:inputNif", label: "número de identificação fiscal do fornecedor" },
                    { id: "expenseDialog:selectCountry", label: "país" },
                    { id: "expenseDialog:selectExpType", label: "tipo de despesa" },
                    { id: "expenseDialog:selectExpSubType", label: "subtipo de despesa" },
                    { id: "expenseDialog:selectBP", label: "parceiro" },
                    { id: "expenseDialog:inputPlate", label: "matrícula" },
                    { id: "expenseDialog:inputFuelQuantity", label: "quantidade de combustível" },
                    { id: "expenseDialog:selectPymtMeth", label: "método de pagamento" },
                    { id: "expenseDialog:inputAmt", label: "montante" },
                    { id: "expenseDialog:textAreaComments", label: "observações" },
                    { id: "expenseDialog:inputUnit", label: "unidade" }
                ];
            },

            /**
             * Attaches focusin/change listeners to a control and stores its initial value.
             * @param {{id:string, label:string}} meta
             */
            handleAttachLoggingForControl: function (meta) {
                var ctrl = this.byId(meta.id) || sap.ui.getCore().byId(meta.id);
                if (!ctrl) {
                    return;
                }

                this.handleRememberPrev(ctrl);

                if (ctrl.attachBrowserEvent) {
                    ctrl.attachBrowserEvent("focusin", this.handleRememberPrev.bind(this, ctrl));
                }

                if (ctrl.attachChange) {
                    ctrl.attachChange(this.onGenericFieldChange.bind(this, meta));
                } else if (ctrl.attachEvent) {
                    ctrl.attachEvent("change", this.onGenericFieldChange.bind(this, meta));
                }
            },

            /**
             * Generic change handler: compares with previous value and logs the change.
             * @param {{id:string, label:string}} meta
             * @param {sap.ui.base.Event} oEvent
             */
            onGenericFieldChange: function (meta, oEvent) {
                var oSource = oEvent.getSource(),
                    sOldValue = oSource.data("__prev"),
                    sNewValue = this.handleGetFieldValue(oSource, oEvent);

                var bHasOld = sOldValue !== undefined && sOldValue !== null && String(sOldValue).trim() !== "";
                var sLabel = bHasOld ? ("Alteração de valor no campo " + meta.label) : ("Novo valor para o campo " + meta.label);

                this.handleLogChange(sLabel, sOldValue, sNewValue);
                oSource.data("__prev", sNewValue);
            },

            /* ************************************** Geral ************************************* */

            /**
             * Logs the prefilled fields.
             */
            handleLogPrefilledFields: function () {
                var that = this;

                // --- Dialog fields ---
                this.handleGetFieldsMap().forEach(function (m) {
                    var ctrl = that.byId(m.id) || sap.ui.getCore().byId(m.id);
                    if (!ctrl) {
                        return;
                    }

                    var val = that.handleGetFieldValue(ctrl);
                    var empty = (val === undefined || val === null || String(val).trim() === "");
                    if (!empty) {
                        that.handleLogChange("Campo " + m.label + " digitalizado", "", val);

                        try {
                            ctrl.data("__prev", val);
                        }
                        catch (e) { }
                    }
                });

                // --- VAT table lines ---
                var aVat = this.oExpensesModel.getProperty("/vatLines") || [];
                if (aVat.length) {
                    var colLabelMap = {
                        "d": "tipo de taxa",
                        "b": "valor base",
                        "v": "valor IVA",
                    };

                    aVat.forEach(function (line, idx) {
                        ["b", "v", "d"].forEach(function (prop) {
                            var v = line && line[prop];
                            var isEmpty = (v === undefined || v === null || String(v).toString().trim() === "");

                            if (!isEmpty) {
                                that.handleLogChange("Campo " + (colLabelMap[prop] || prop) + " do resumo IVA e linha " + (idx + 1) + " digitalizado", "", String(v));
                            }
                        });
                    });
                }
            },

            /**
             * Adds a log entry to the "Logs" model.
             * @param {string} sDescription
             * @param {string} sOldValue
             * @param {string} sNewValue
             * @param {boolean} bVatLine
             */
            handleLogChange: function (sDescription, sOldValue, sNewValue, sError, bVatLine) {
                if (!bVatLine) {
                    if (sOldValue === sNewValue) {
                        return;
                    }
                }

                var oLogs = this.getView().getModel("Logs"),
                    aLogs = oLogs.getProperty("/entries") || [];

                aLogs.push({
                    Description: sDescription,
                    OldValue: sOldValue,
                    NewValue: sNewValue,
                    Error: sError,
                    Time: new Date().toISOString()
                });

                oLogs.setProperty("/entries", aLogs);
            },

            /**
             * Returns a human-readable value from a control.
             * @param {sap.ui.core.Control} ctrl
             * @param {sap.ui.base.Event} [evt]
             * @returns {string}
             */
            handleGetFieldValue: function (ctrl, evt) {
                if (evt && evt.getParameter && evt.getParameter("value") !== undefined) {
                    return evt.getParameter("value");
                }
                if (ctrl instanceof sap.m.Select) {
                    return ctrl.getSelectedKey();
                }
                if (ctrl instanceof sap.m.DatePicker || ctrl instanceof sap.m.DateTimePicker) {
                    return ctrl.getValue();
                }
                if (ctrl.getValue) {
                    return ctrl.getValue();
                }
                return "";
            },

            /**
             * Stores the previous value in the control's data (call on focusin).
             * @param {sap.ui.core.Control} ctrl
             */
            handleRememberPrev: function (ctrl) {
                try {
                    ctrl.data("__prev", this.handleGetFieldValue(ctrl));
                } catch (e) { }
            },

            /* ************************************** VH PARTNER ************************************* */

            /**
             * Opens the partner value help dialog
             */
            handleOpenPartnerVH: function () {
                try {
                    this._oBasicSearchField = new sap.m.SearchField();

                    this._oMaterialVh = this.loadFragment({
                        name: "zfiexpensesmanage.fragments.BusinessPartner"
                    }).then(function (oDialogSuggestions) {
                        var oFilterBar = oDialogSuggestions.getFilterBar();

                        this._oMaterialVh = oDialogSuggestions;

                        this.getView().addDependent(oDialogSuggestions);

                        oDialogSuggestions.setRangeKeyFields([{
                            label: "BusinessPartner",
                            key: "BusinessPartner",
                            type: "string",
                            typeInstance: new sap.ui.model.type.String({
                                maxLength: 40
                            })
                        }]);

                        oFilterBar.setFilterBarExpanded(false);
                        oFilterBar.setBasicSearch(this._oBasicSearchField);

                        this._oBasicSearchField.attachSearch(function () {
                            oFilterBar.search();
                        });

                        oDialogSuggestions.getTableAsync().then(function (oTable) {
                            oTable.setModel(this.getView().getModel());

                            if (oTable.bindRows) {
                                oTable.bindAggregation("rows", {
                                    path: "/ZFI_BUSINESS_PARTNER",
                                    events: {
                                        dataReceived: function () {
                                            oDialogSuggestions.update();
                                        }
                                    }
                                });

                                var oBusinessPartner = new sap.ui.table.Column({
                                    label: new sap.m.Label({
                                        text: this.getResourceBundle().getText("BusinessPartner")
                                    }),
                                    template: new sap.m.Text({
                                        wrapping: false,
                                        text: "{BusinessPartner}"
                                    })
                                });
                                oBusinessPartner.data({ fieldName: "BusinessPartner" });
                                oTable.addColumn(oBusinessPartner);

                                var oBusinessPartnerName = new sap.ui.table.Column({
                                    label: new sap.m.Label({
                                        text: this.getResourceBundle().getText("BusinessPartnerName")
                                    }),
                                    template: new sap.m.Text({
                                        wrapping: false,
                                        text: "{BusinessPartnerName}"
                                    })
                                });
                                oBusinessPartnerName.data({ fieldName: "BusinessPartnerName" });
                                oTable.addColumn(oBusinessPartnerName);
                            }

                            if (oTable.bindItems) {
                                if (oTable.removeAllColumns) {
                                    oTable.removeAllColumns();
                                }

                                var oColBP = new sap.m.Column({
                                    header: new sap.m.Label({
                                        text: this.getResourceBundle().getText("BusinessPartner")
                                    })
                                });
                                oColBP.data({ fieldName: "BusinessPartner" });
                                oTable.addColumn(oColBP);

                                var oColBPName = new sap.m.Column({
                                    header: new sap.m.Label({
                                        text: this.getResourceBundle().getText("BusinessPartnerName")
                                    })
                                });
                                oColBPName.data({ fieldName: "BusinessPartnerName" });
                                oTable.addColumn(oColBPName);

                                oTable.bindAggregation("items", {
                                    path: "/ZFI_BUSINESS_PARTNER",
                                    template: new sap.m.ColumnListItem({
                                        cells: [
                                            new sap.m.Text({ text: "{BusinessPartner}" }),
                                            new sap.m.Text({ text: "{BusinessPartnerName}" })
                                        ]
                                    }),
                                    events: {
                                        dataReceived: function () {
                                            oDialogSuggestions.update();
                                        }
                                    }
                                });
                            }

                            oDialogSuggestions.update();
                        }.bind(this));

                        oDialogSuggestions.open();
                    }.bind(this));
                } catch (e) {
                    this.showErrorMessage(e.message);
                }
            },

            /**
             * Handles the partner press event
             * @param {sap.ui.core.Control} oEvent
             */
            handlePartnerPress: function (oEvent) {
                try {
                    var aTokens = oEvent.getParameter("tokens");
                    var oBusinessPartner = Fragment.byId(this.getView().getId(), "expenseDialog:selectBP");


                    if (aTokens.length > 0) {
                        if (aTokens.length > 1) {
                            this.showErrorMessage(this.getResourceBundle().getText("MultipleSelection"));
                            return;
                        }

                        var oToken = aTokens[0],
                            sBusinessPartner = oToken.getKey(),
                            sBusinessPartnerName = oToken.getText();

                        oBusinessPartner.setValue(sBusinessPartnerName);
                        oBusinessPartner.data("BPKey", sBusinessPartner);
                    }

                    this._oMaterialVh.close();
                } catch (e) {
                    this.showErrorMessage(e.message);
                }
            },

            /**
             * Handles the partner value help close event
             */
            handlePartnerVhClose: function () {
                try {
                    this._oMaterialVh.close();
                    this._oMaterialVh.destroy();
                    this._oMaterialVh = null;
                } catch (oError) {
                    this.showErrorMessage(oError.message);
                }
            },

            /**
             * Handles the partner value help search event
             * @param {sap.ui.core.Control} oEvent
             */
            handlePartnerVhSearch: function (oEvent) {
                try {
                    var sSearchQuery = this._oBasicSearchField.getValue().toUpperCase(),
                        aSelectionSet = oEvent.getParameter("selectionSet");

                    var aFilters = aSelectionSet.reduce(function (aResult, oControl) {
                        if (oControl.getValue()) {
                            aResult.push(new sap.ui.model.Filter({
                                path: oControl.getName(),
                                operator: sap.ui.model.FilterOperator.Contains,
                                value1: oControl.getValue()
                            }));
                        }

                        return aResult;
                    }, []);

                    aFilters.push(new sap.ui.model.Filter({
                        filters: [
                            new sap.ui.model.Filter({ path: "BusinessPartner", operator: sap.ui.model.FilterOperator.Contains, value1: sSearchQuery }),
                            new sap.ui.model.Filter({ path: "BusinessPartnerName", operator: sap.ui.model.FilterOperator.Contains, value1: sSearchQuery }),
                        ],
                        and: false
                    }));

                    this.handleFilterVhTable(new sap.ui.model.Filter({ filters: aFilters, and: true }), this._oMaterialVh);
                } catch (e) {
                    this.showErrorMessage(e.message);
                }
            },

            /**
             * Filters the value help table
             * @param {sap.ui.model.Filter} oFilter
             * @param {sap.ui.core.Control} oValueHelp
             */
            handleFilterVhTable: function (oFilter, oValueHelp) {
                oValueHelp.getTableAsync().then(function (oTable) {
                    if (oTable.bindRows) {
                        oTable.getBinding("rows").filter(oFilter);
                    }

                    if (oTable.bindItems) {
                        oTable.getBinding("items").filter(oFilter);
                    }

                    oValueHelp.update();
                });
            },

            /* ************************************************************************************** */
            /* *                                        Crop                                        * */
            /* ************************************************************************************** */

            /**
             * Opens the manual crop dialog.
             */
            openManualCropDialog: async function () {
                if (!this._pManualCropFrag) {
                    this._pManualCropFrag = sap.ui.core.Fragment.load({
                        id: this.getView().getId(),
                        name: "zfiexpensesmanage.fragments.Crop",
                        controller: this
                    }).then((oFrag) => {
                        this.getView().addDependent(oFrag);
                        return oFrag;
                    });
                }

                const oDlg = await this._pManualCropFrag;
                oDlg.open();

                const dataURL = this.oExpensesModel?.getProperty("/capturedImage");
                if (!dataURL) {
                    return;
                }

                const root = oDlg.getDomRef();
                const img = root.querySelector("#cameraImage");

                img.onload = () => {
                    const overlay = root.querySelector("#cameraOverlay");

                    const resize = () => {
                        const r = img.getBoundingClientRect();

                        overlay.width = Math.max(1, Math.round(r.width));
                        overlay.height = Math.max(1, Math.round(r.height));

                        const ctx = overlay.getContext("2d");
                        ctx && ctx.clearRect(0, 0, overlay.width, overlay.height);
                    };

                    resize();
                    try {
                        new ResizeObserver(resize).observe(img);
                    }
                    catch (e) { }

                    this.handleEnableDrawModeImage(root);
                };

                img.src = dataURL;
            },

            /**
             * Uses the cropped photo.
             */
            onUseCroppedPhoto: async function () {
                var bContinue = false;

                const oDlg = this.byId("cropDialog");
                if (!oDlg) return;

                const root = oDlg.getDomRef();
                const img = root.querySelector("#cameraImage");

                try {
                    const quad = this._aLastQuadImagePx;
                    if (!quad || quad.length !== 4) {
                        sap.m.MessageBox.error(this.getResourceBundle().getText("xexp.cropArea"));
                        return;
                    }

                    bContinue = true;

                    const dataURL = await this.handleWarp(img, quad);
                    if (this.oExpensesModel) {
                        this.oExpensesModel.setProperty("/capturedImage", dataURL);
                        this.oExpensesModel.setProperty("/imageExt", "PNG");
                    }
                } catch (e) {

                } finally {
                    if (!bContinue) {
                        return;
                    }

                    this.handleDisableDrawModeImage(root);
                    oDlg.close();
                    this.handleScanPhoto?.();
                }
            },

        });
    });
