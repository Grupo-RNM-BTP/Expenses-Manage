sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "../util/ScanUtil",
],
    function (BaseController, formatter, ScanUtil) {
        "use strict";

        /**
        * DetailController: Handles detail view, attachments, file upload, and deletion.
        *
        * @namespace zfiexpensesmanage.controller
        * @extends zfiexpensesmanage.controller.BaseController
        */

        return BaseController.extend("zfiexpensesmanage.controller.Detail", {

            formatter: formatter,

            /**
             * Initialize the controller, set attachment model and attach route pattern.
             */
            onInit: function () {
                var oAttachmentModel = new sap.ui.model.json.JSONModel({
                    attachments: []
                });

                new ScanUtil().handleAttachToController(this);

                this.getView().setModel(oAttachmentModel, "attachmentModel");
                this.getOwnerComponent().getRouter().getRoute("Detail").attachPatternMatched(this.onObjectDetail, this);
            },

            /**
             * Handle object detail navigation.
             * @param {sap.ui.core.mvc.NavigationEvent} oEvent Navigation event
             */
            onObjectDetail: function (oEvent) {
                var sObjectId = "/ZFI_EXPENSES_MNG" + oEvent.getParameter("arguments").objectId;
                this._bindView(sObjectId, true);
            },

            /**
             * Bind view to object path.
             * @param {string} sObjectPath Object path
             * @param {boolean} sForceRefresh Force refresh
             */
            _bindView: function (sObjectPath, sForceRefresh) {
                this.getView().bindElement({
                    path: sObjectPath,
                    events: {
                        dataRequested: function () {
                            this.getModel("global").setProperty("/busy", true);
                        }.bind(this),
                        dataReceived: function (oData) {
                            this.getModel("global").setProperty("/busy", false);
                        }.bind(this)
                    }
                });
                this.getView().getModel("attachmentModel").setProperty("/attachments", []);
                this.setVisibleSection(sObjectPath);
                this.onGetDocument(sObjectPath);
            },

            /**
             * Show/hide detail sections based on FiStatus.
             * @param {string} sObjectPath
             */
            setVisibleSection: function (sObjectPath) {
                var oModel = this.getModel();

                oModel.read(sObjectPath, {
                    success: function (oData) {
                        if (oData.FiStatus === "0" || oData.FiStatus === "2" || oData.FiStatus === "7") {
                            this.byId("editButton").setVisible(false);
                        } else {
                            this.byId("editButton").setVisible(true);
                        }

                        if (oData.FiStatus === "0") {
                            this.byId("Section1").setVisible(true);
                            this.byId("Section2").setVisible(false);
                        } else {
                            this.byId("Section1").setVisible(false);
                            this.byId("Section2").setVisible(true);
                        }
                    }.bind(this)
                })
            },

            /**
            * Load attachments for a given object or expense number.
            * @param {string} sObjectPath
            * @param {string} sExpNo
            */
            onGetDocument: function (sObjectPath, sExpNo) {
                var oModel = this.getModel(),
                    sPath;

                if (sObjectPath) {
                    var sExpNo2 = sObjectPath.match(/ExpNo='(\d+)'/)[1];
                    sPath = "/AttachmentsEvents(Expenseno='" + sExpNo2 + "')";
                } else {
                    sPath = "/AttachmentsEvents(Expenseno='" + sExpNo + "')";
                }

                // this.getModel("global").setProperty("/busy", true);
                oModel.read(sPath, {
                    success: function (oData) {
                        var oModel = this.getView().getModel("attachmentModel"),
                            aAttachments = oModel.getProperty("/attachments");

                        this.getView().getModel("attachmentModel").setProperty("/attachments", []);

                        if (oData.FileString.length > 0) {
                            aAttachments.push({
                                title: oData.TitleFile || "Sem título",
                                src: oData.FileString,
                                expNo: oData.Expenseno,
                                pernr: oData.Pernr
                            });

                            oModel.setProperty("/attachments", aAttachments);

                            this.byId("attachmentIllustration").setVisible(false);
                            this.byId("attachmentList").setVisible(true);
                        } else {
                            this.byId("attachmentIllustration").setVisible(true);
                            this.byId("attachmentList").setVisible(false);
                        }
                        // this.getModel("global").setProperty("/busy", false);
                    }.bind(this),
                    error: function (oError) {
                        // this.getModel("global").setProperty("/busy", false);
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

            /**
             * Handle file upload to backend.
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

                var reader = new FileReader();

                reader.onload = async function (e) {
                    var sBase64 = e.target.result;

                    var oModel = this.getModel(),
                        sFullPath = this.getView().getBindingContext().sPath,
                        match = sFullPath.match(/ExpNo='(.*?)'/),
                        sExpNo = match ? match[1] : null,
                        sPath = "/AttachmentsEvents",
                        oEntry = {};


                    this.getModel("global").setProperty("/busy", true);
                    var sDocument = await this.onConvertToPDF(sBase64);
                    oEntry.Expenseno = sExpNo;
                    oEntry.FileString = sDocument;
                    oEntry.FileType = "PDF";

                    oModel.create(sPath, oEntry, {
                        success: function () {
                            this.getModel("global").setProperty("/busy", false);
                            this.byId("fileUploader").setValue("");
                            this.onRealodData(sExpNo);
                            sap.m.MessageBox.success(this.getResourceBundle().getText("uploadSuccess"));
                        }.bind(this),
                        error: function (oError) {
                            this.getModel("global").setProperty("/busy", false);
                            this.byId("fileUploader").setValue("");
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

                }.bind(this);

                reader.readAsDataURL(oFile);
            },

            /**
             * Handle delete expense.
             */
            handleDeleteExpense: function () {
                try {
                    sap.m.MessageBox.confirm(this.getResourceBundle().getText("confirmDeleteExpense"), {
                        title: this.getResourceBundle().getText("deleteTitle"),
                        icon: sap.m.MessageBox.Icon.WARNING,
                        actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                        emphasizedAction: sap.m.MessageBox.Action.YES,
                        onClose: function (oAction) {
                            if (oAction === sap.m.MessageBox.Action.YES) {
                                this.onDeleteSelected();
                            }
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
             * Handle delete expense backend.
             */
            onDeleteSelected: function () {
                var oModel = this.getModel(),
                    sFullPath = this.getView().getBindingContext().sPath,
                    match = sFullPath.match(/ExpNo='(.*?)'/),
                    sExpNo = match ? match[1] : null,
                    sPath = "/AttachmentsEvents(Expenseno='" + sExpNo + "')";

                this.getModel("global").setProperty("/busy", true);

                oModel.remove(sPath, {
                    success: function () {
                        this.getModel("global").setProperty("/busy", false);
                        this.onRealodData(sExpNo);
                        sap.m.MessageBox.success(this.getResourceBundle().getText("deleteAttachSuccess"));
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
             * Opens the first attachment (image lightbox or PDF) from the attachment model.
             */
            onPressAvatar: function () {
                this.getModel("global").setProperty("/busy", true);

                var aAttachments = this.getView().getModel("attachmentModel").getProperty("/attachments");

                if (!aAttachments || aAttachments.length === 0) {
                    return;
                }

                var oAttachment = aAttachments[0];

                if (!oAttachment.src.startsWith("data:application/pdf")) {
                    var oLightBox = new sap.m.LightBox({
                        imageContent: new sap.m.LightBoxItem({
                            imageSrc: oAttachment.src
                        })
                    });

                    oLightBox.addEventDelegate({
                        onAfterRendering: function () {
                        }.bind(this)
                    });

                    oLightBox.open();
                } else {
                    this.openPDF(oAttachment.src);

                }
                this.getModel("global").setProperty("/busy", false);

            },

            /**
             * Handles action button presses (Save, Cancel, Edit).
             * @param {string} oAction
             */
            onPressActionButtons: function (oAction) {
                if (oAction === "S") {
                    this.onSaveEdit();
                } else if (oAction === "C") {
                    this.onButtonsState(false, true);
                    this.byId("textComments").setValue(this.Comment);
                    this.Comment = "";
                } else if (oAction === "E") {
                    this.onButtonsState(true, false);
                    this.Comment = this.byId("textComments").getValue()
                }
            },

            /**
             * Saves edited comments for the current expense.
             */
            onSaveEdit: function () {
                var oModel = this.getModel(),
                    sReference = this.byId("TextReference").getText(),
                    sPath = "/EditExpense(Exp='" + sReference + "')",
                    oData = {},
                    oEntry = {};

                oData.exp = sReference;
                oData.comments = this.byId("textComments").getValue();

                oEntry.Data = JSON.stringify(oData);

                oModel.update(sPath, oEntry, {
                    success: function () {
                        this.onButtonsState(false, true);
                        this.getView().getModel().refresh();
                        this.Comment = "";
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

        });
    });
