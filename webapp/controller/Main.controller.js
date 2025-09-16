sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
    "sap/ui/unified/FileUploader",
    "sap/ui/core/Fragment"
],
    function (BaseController, formatter, JSONModel, FileUploader, Fragment) {
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

                if (!this._bInitialSorterApplied) {
                    oBindingParams.sorter = [new sap.ui.model.Sorter("Erdat", true)];
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

                if (!(oFile.type === "image/png" || oFile.type === "image/jpeg")) {
                    sap.m.MessageBox.error(this.getResourceBundle().getText("invalidFormat"));
                    return;
                }

                var sType = oFile.type.split("/")[1].toUpperCase();

                if (sType.toUpperCase() === "JPEG") {
                    this._sFileType = "JPG";
                }
                else {
                    this._sFileType = sType.toUpperCase();
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

                    var sDocument = await this.onGetDocumentToBase64(sap.ui.getCore().byId("fileUploaderMain"));

                    oEntry.Expenseno = this.getView().getModel("Main").getProperty("/ExpNo");
                    oEntry.FileString = sDocument;
                    oEntry.FileType = this._sFileType;

                    this.getModel("global").setProperty("/busy", true);
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
                }
            },

            //---------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------- Approve Expenses -----------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------

            /**
             * Apply initial sorter before table binding.
             * @param {sap.ui.base.Event} oEvent
             */
            onBeforeRebindTableCards: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams");

                if (!this._bInitialSorterApplied) {
                    oBindingParams.sorter = [new sap.ui.model.Sorter("VYearMonthDay", true)];
                }
            },

            //---------------------------------------------------------------------------------------------------------------------------------------------------------
            //---------------------------------------------------------------------- Leader Management -----------------------------------------------------------------
            //---------------------------------------------------------------------------------------------------------------------------------------------------------

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

                oModel.refresh();
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
            onAddVatLine: function () {
                var aVatLines = this.oExpensesModel.getProperty("/vatLines");

                aVatLines.push({ p: "", v: "" });
                this.oExpensesModel.setProperty("/vatLines", aVatLines);
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
                        aLines.splice(iIndex, 1);
                        this.oExpensesModel.setProperty("/vatLines", aLines);
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
            handleFinishProcess: function (oData) {
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

                    if (oData) {
                        that.handleSetValues(oData);
                        that.handleCheckUnit();
                    } else {
                        Fragment.byId(oView.getId(), "expenseDialog:datePicker").setDateValue(new Date());

                        that.onAddVatLine();
                        that.oExpensesModel.setProperty("/vatEditMode", true);
                    }

                    oDialog.open();
                });
            },

            /**
             * Sets the values of the expense entry dialog
             * @param {Object} oData - The data to set
             */
            handleSetValues: function (oData) {
                var oView = this.getView();

                Fragment.byId(oView.getId(), "expenseDialog:inputLocal").setValue(oData.Local);
                Fragment.byId(oView.getId(), "expenseDialog:inputNif").setValue(oData.Nif);
                Fragment.byId(oView.getId(), "expenseDialog:selectCountry").setSelectedKey(oData.Country);
                Fragment.byId(oView.getId(), "expenseDialog:selectExpType").setSelectedKey(oData.Exptype);
                Fragment.byId(oView.getId(), "expenseDialog:inputFuelQuantity").setValue(oData.Fuelqty);
                Fragment.byId(oView.getId(), "expenseDialog:inputAmt").setValue(oData.Amt);

                if (oData.Exptype) {
                    this.oExpensesModel.setProperty("/exptype", oData.Exptype);
                }

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
                        this.onAddVatLine();
                    }
                } catch (e) {
                    this.oExpensesModel.setProperty("/vatLines", []);
                }
            },

            /**
             * Finishes the expense creation process
             */
            onFinishProcess: function () {
                this._bSubmit = true;

                const sIds = [
                    "expenseDialog:inputLocal",
                    "expenseDialog:selectCountry",
                    "expenseDialog:inputNif",
                    "expenseDialog:selectPymtMeth",
                    "expenseDialog:selectExpType",
                    "expenseDialog:inputFuelQuantity",
                    "expenseDialog:datePicker",
                    "expenseDialog:inputAmt",
                    "expenseDialog:inputUnit",
                    "expenseDialog:vatTable"
                ];

                if (!this.handleValidateRequiredFields(sIds)) {
                    return;
                }


                var oView = this.getView(),
                    oModel = oView.getModel(),
                    that = this,
                    oEntry = {};

                oEntry.Bktxt = Fragment.byId(oView.getId(), "expenseDialog:inputLocal").getValue();
                oEntry.Nif = Fragment.byId(oView.getId(), "expenseDialog:inputNif").getValue();
                oEntry.Exptype = Fragment.byId(oView.getId(), "expenseDialog:selectExpType").getSelectedKey();
                oEntry.Pymtmeth = Fragment.byId(oView.getId(), "expenseDialog:selectPymtMeth").getSelectedKey();
                oEntry.Land1 = Fragment.byId(oView.getId(), "expenseDialog:selectCountry").getSelectedKey();
                oEntry.Sdate = Fragment.byId(oView.getId(), "expenseDialog:datePicker").getDateValue();
                oEntry.Value = Fragment.byId(oView.getId(), "expenseDialog:inputAmt").getValue();
                oEntry.TableIva = JSON.stringify(oView.getModel("Expenses").getProperty("/vatLines"));

                oEntry.Doc = oView.getModel("Expenses").getProperty("/capturedImage");
                oEntry.DocType = oView.getModel("Expenses").getProperty("/imageExt");

                if ((oEntry.Exptype || '').indexOf('COMBST') > -1) {
                    oEntry.Fuelqty = Fragment.byId(oView.getId(), "expenseDialog:inputFuelQuantity").getValue();
                }

                if (Fragment.byId(oView.getId(), "expenseDialog:inputUnit").getVisible()) {
                    const iValue = Fragment.byId(oView.getId(), "expenseDialog:inputUnit").getValue();

                    oEntry.Unit = String(iValue);
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
                                }
                            }
                        } catch (error) {

                        }

                        that.handleSuccessSubmit();
                        oModel.refresh(true);
                        that.getCardValues();
                    },
                    error: function (oError) {
                        sap.ui.core.BusyIndicator.hide();

                        var sError = JSON.parse(oError.responseText).error.message.value;
                        that.handleErrorMessage(sError);
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
                this.byId("processingDialog:cancelBtn").setVisible(false);

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
             * Starts the device camera stream using the specified facing mode.
             * @param {string} facingMode - Camera direction ("user" or "environment")
             */
            handleStartCamera: async function (facingMode, oDomRef) {
                this.getView().getModel("Camera").setProperty("/mode", facingMode);
                try {
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

                    // 2) Ligar stream ao vídeo
                    video.playsInline = true;
                    video.muted = true;
                    video.srcObject = stream;
                    await video.play();

                    this._photoTaken = false;
                    this.handleScheduleCameraAutoClose(120000);

                    // 3) Puxar para o máximo com applyConstraints (quando suportado)
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
                    vBase64 = this.oExpensesModel.getProperty("/capturedImage");

                if (!vBase64) return;

                oEntry.Base64 = vBase64;

                oModel.create("/ReadImage", oEntry, {
                    success: (oData) => {
                        this.handleFinishProcess(oData);
                        this.onStopScanning();
                    },
                    error: (oError) => {
                        this._bError = true;
                        this.handleScanError();
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
            onTakePhoto: function () {
                this._photoTaken = true;

                var video = document.getElementById('cameraVideo'),
                    canvas = document.createElement('canvas'),
                    context = canvas.getContext('2d');

                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                var imageData = canvas.toDataURL('image/png');

                if (this.oExpensesModel) {
                    this.oExpensesModel.setProperty("/capturedImage", imageData);
                    this.oExpensesModel.setProperty("/imageExt", "PNG");
                }

                this.handleClearCameraAutoClose();
                this.handleScanPhoto();
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

                    var sExt = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(sBase64)[1];
                    sExt = sExt ? sExt.toLowerCase() : "";

                    if (sExt === "jpeg") {
                        sExt = "JPG";
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

                this.handleCheckUnit();
            },

            /**
             * Handles the change of the country by updating the "Expenses" model.
             * @param {Event} oEvent - The event object
             */
            onCountryChange: function () {
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
        });
    });
