sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel",
],
    function (BaseController, formatter, JSONModel) {
        "use strict";

        return BaseController.extend("zfiexpensesmanage.controller.Detail", {

            formatter: formatter,

            onInit: function () {
                var oAttachmentModel = new sap.ui.model.json.JSONModel({
                    attachments: []
                });
                this.getView().setModel(oAttachmentModel, "attachmentModel");
                this.getOwnerComponent().getRouter().getRoute("Detail").attachPatternMatched(this.onObjectDetail, this);
            },

            onObjectDetail: function (oEvent) {
                var sObjectId = "/ZFI_EXPENSES_MNG" + oEvent.getParameter("arguments").objectId;
                this._bindView(sObjectId, true);
            },

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
                // if (sForceRefresh) {
                //     this.getView().getModel().refresh();
                // }
                this.getView().getModel("attachmentModel").setProperty("/attachments", []);
                this.setVisibleSection(sObjectPath);
                this.onGetDocument(sObjectPath);
            },

            // Set visible section of detail
            setVisibleSection: function (sObjectPath) {
                var oModel = this.getModel();

                oModel.read(sObjectPath, {
                    success: function (oData) {
                        if (oData.FiStatus === "0") {
                            this.byId("Section1").setVisible(true);
                            this.byId("Section2").setVisible(false);
                        } else {
                            this.byId("Section1").setVisible(false);
                            this.byId("Section2").setVisible(true);
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
            },

            // Get document of expenses
            onGetDocument: function (sObjectPath, sExpNo) {
                var oModel = this.getModel();

                if (sObjectPath) {
                    var sPath = sObjectPath.replace("ZFI_EXPENSES_MNG", "AttachmentsEvents");
                    sPath = sPath.replace("ExpNo", "Expenseno");
                    sPath = sPath.replace(/\(.*?Expenseno=/, "(Expenseno=");
                } else {
                    var sPath = "/AttachmentsEvents(Expenseno='" + sExpNo + "')";
                }

                oModel.read(sPath, {
                    success: function (oData) {
                        var oModel = this.getView().getModel("attachmentModel"),
                            aAttachments = oModel.getProperty("/attachments");

                        oModel.setProperty("/attachments", []);

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

            // Handle close detail
            onPressCloseDetail: function () {
                var oFCL = this.getView().getParent().getParent();
                oFCL.setLayout(sap.f.LayoutType.OneColumn);

                this.getRouter().navTo("RouteMain");
            },

            // Upload of file to Backend
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

                var reader = new FileReader();

                reader.onload = function (e) {
                    var sBase64 = e.target.result;
                    this._sUploadedBase64 = sBase64;

                    var oModel = this.getModel(),
                        sFullPath = this.getView().getBindingContext().sPath,
                        match = sFullPath.match(/ExpNo='(.*?)'/),
                        sExpNo = match ? match[1] : null,
                        sPath = "/AttachmentsEvents",
                        oEntry = {
                            Expenseno: sExpNo,
                            FileString: sBase64
                        };

                    oModel.create(sPath, oEntry, {
                        success: function () {
                            this.byId("fileUploader").setValue("");
                            this.onRealodData();
                            sap.m.MessageBox.show(this.getResourceBundle().getText("uploadSuccess"));
                        }.bind(this),
                        error: function (oError) {
                            this.byId("fileUploader").setValue("");
                            var sError = JSON.parse(oError.responseText).error.message.value;
                            sap.m.MessageBox.alert(sError, {
                                icon: "ERROR"
                            });
                        }.bind(this)
                    });

                }.bind(this);

                reader.readAsDataURL(oFile);
            },

            // Handle Delete
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
                            this.byId("attachmentList").removeSelections();
                        }.bind(this)
                    });
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            // Handle Delete bakcend
            onDeleteSelected: function () {
                var oModel = this.getModel(),
                    sFullPath = this.getView().getBindingContext().sPath,
                    match = sFullPath.match(/ExpNo='(.*?)'/),
                    sExpNo = match ? match[1] : null,
                    sPath = "/AttachmentsEvents(Expenseno='" + sExpNo + "')";

                oModel.remove(sPath, {
                    success: function () {
                        this.onRealodData();
                        sap.m.MessageBox.show(this.getResourceBundle().getText("deleteSuccess"));
                    }.bind(this),
                    error: function (oError) {
                        var sError = JSON.parse(oError.responseText).error.message.value;
                        sap.m.MessageBox.alert(sError, {
                            icon: "ERROR"
                        });
                    }.bind(this)
                })
            },
        });
    });
