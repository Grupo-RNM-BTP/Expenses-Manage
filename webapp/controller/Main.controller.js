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

                var oGraficoModel = new sap.ui.model.json.JSONModel({});

                this.getView().setModel(oGraficoModel, "graficoModel");
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
                this.getSumMonth();
                this.getSumYear();

                this.getView().getModel().refresh();
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
                                        fileType: ["jpg", "jpeg", "png", "gif"]
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

            // Send Data to backend with IMAGE
            handleUpload: async function () {
                var oModel = this.getView().getModel(),
                    sPath = "/UploadImage",
                    sDocument = await this.onGetDocument(sap.ui.getCore().byId("fileUploader")),
                    oEntry = {};

                oEntry.Exp = this.getView().getModel("Main").getProperty("/ExpNo");
                oEntry.Document = sDocument;

                oModel.create(sPath, oEntry, {
                    success: function () {
                        this._oUploadDialog.close();
                        this._oUploadDialog.destroy();
                        oModel.refresh();
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

            // Open Edit Dialog change Value
            handleEdit: function () {
                debugger;
                if (this._editDialog) {
                    this._editDialog = null;
                }
                var oLabel = new sap.m.Label({
                    text: this.getResourceBundle().getText("labelValue")
                });

                var oInput = new sap.m.Input({
                    id: "idInputValue",
                    placeholder: this.getResourceBundle().getText("placeholderValue"),
                    width: "100%"
                });

                oLabel.setLabelFor(oInput);

                var oForm = new sap.ui.layout.form.SimpleForm({
                    layout: "ResponsiveGridLayout",
                    content: [
                        oLabel,
                        oInput
                    ]
                });

                this._editDialog = new sap.m.Dialog({
                    title: this.getResourceBundle().getText("editValue"),
                    contentWidth: "300px",
                    contentHeight: "auto",
                    content: [oForm],
                    beginButton: new sap.m.Button({
                        text: this.getResourceBundle().getText("btnOk"),
                        type: "Emphasized",
                        press: this.handleEditValue.bind(this)
                    }),
                    endButton: new sap.m.Button({
                        text: this.getResourceBundle().getText("btnCancel"),
                        press: function () {
                            this._editDialog.close();
                            this._editDialog.destroy();
                            this._editDialog = null;

                        }.bind(this)
                    }),
                    afterClose: function () {
                        this._editDialog.close();
                        this._editDialog.destroy();
                        this._editDialog = null;

                    }.bind(this)
                });


                this._editDialog.open();
            },

            // Handle Edit Value
            handleEditValue: function () {
                var oModel = this.getView().getModel(),
                    oTable = this.byId("idTableExpenses"),
                    sTablePath = oTable.getSelectedItem().getBindingContext().getPath(),
                    expNoMatch = sTablePath.match(/ExpNo='(.*?)'/),
                    sExpNo = expNoMatch ? expNoMatch[1] : null,
                    sPath = "/EditExpense('" + sExpNo + "')",
                    inputValue = sap.ui.getCore().byId("idInputValue"),
                    oEntry = {};

                if (inputValue.getValue() == "") {
                    inputValue.setValueState("Error");
                    return;
                }

                oEntry.Amount = inputValue.getValue();

                oModel.update(sPath, oEntry, {
                    success: function () {
                        oTable.removeSelections();
                        oModel.refresh();
                        this._editDialog.close();
                        this._editDialog.destroy();
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

            // Handle Selection Change
            handleSelectionChange: function () {
                this.byId("btnDelete").setEnabled(true);
                this.byId("btnEdit").setEnabled(true);
            },

            // Handle Delete
            handleDelete: function () {
                var oModel = this.getView().getModel(),
                    oTable = this.byId("idTableExpenses"),
                    sTablePath = oTable.getSelectedItem().getBindingContext().getPath(),
                    expNoMatch = sTablePath.match(/ExpNo='(.*?)'/),
                    sExpNo = expNoMatch ? expNoMatch[1] : null,
                    sPath = "/EditExpense('" + sExpNo + "')";

                sap.m.MessageBox.confirm(
                    this.getResourceBundle().getText("confirmDeleteExpense"),
                    {
                        title: this.getResourceBundle().getText("deleteTitle"),
                        icon: sap.m.MessageBox.Icon.WARNING,
                        actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                        emphasizedAction: sap.m.MessageBox.Action.YES,
                        onClose: function (oAction) {
                            if (oAction === sap.m.MessageBox.Action.YES) {
                                oModel.remove(sPath, {
                                    success: function () {
                                        oTable.removeSelections();
                                        oModel.refresh();
                                        sap.m.MessageToast.show(this.getResourceBundle().getText("deleteSuccess"));
                                    }.bind(this),
                                    error: function (oError) {
                                        var sError = JSON.parse(oError.responseText).error.message.value;
                                        sap.m.MessageBox.alert(sError, {
                                            icon: sap.m.MessageBox.Icon.ERROR
                                        });
                                    }.bind(this)
                                });
                            }
                        }.bind(this)
                    }
                );
            },

        });
    });
