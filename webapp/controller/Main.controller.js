sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel"
],
    function (BaseController, formatter, JSONModel) {
        "use strict";

        return BaseController.extend("zfiexpensesmanage.controller.Main", {

            formatter: formatter,

            onInit: function () {
                var oModel = new JSONModel({
                    ExpNo: ""
                });
                this.getView().setModel(oModel, "Main");
                this.getView().setModel(new JSONModel({}), "graficoModel");

                sessionStorage.setItem("goToLaunchpad", "X");

                // this.getRouter().getRoute("RouteMain").attachPatternMatched(this.getUserAuthentication, this);
                this.getRouter().getRoute("RouteMain").attachPatternMatched(this.onObjectMain, this);
            },

            onAfterRendering: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                if (sessionStorage.getItem("selectedTheme").indexOf("dark") !== -1) {
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(28,34,40,0.99)");
                }
                else {
                    jQuery(".sapUiBlockLayer, .sapUiLocalBusyIndicator").css("background-color", "rgba(255, 255, 255, 0.99)");
                }

            },

            onRouteMatched: function () {
                sessionStorage.setItem("goToLaunchpad", "X");
                this.getUserAuthentication();
            },

            // On before rebind table
            onBeforeRebindTable: function (oEvent) {
                var oBindingParams = oEvent.getParameter("bindingParams");

                if (!this._bInitialSorterApplied) {
                    oBindingParams.sorter = [new sap.ui.model.Sorter("Erdat", true)];
                }
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
                try {
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
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            // Open upload dialog
            onUploadPressed: function (oEvent) {
                try {
                    debugger;
                    this.getView().getModel("Main").setData({});
                    var that = this,
                        sPath = oEvent.getSource().getBindingContext().getPath();

                    var oMatch = sPath.match(/ExpNo='([^']+)'/),
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
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            // Get document and convert to Base64
            onGetDocument: function () {
                try {
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

                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            // Send Data to backend with IMAGE
            handleUpload: async function () {
                try {
                    debugger;
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
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            // Open Edit Dialog change Value
            // handleEditExpense: function () {
            //     try {
            //         if (this._editDialog) {
            //             this._editDialog = null;
            //         }
            //         var oLabel = new sap.m.Label({
            //             text: this.getResourceBundle().getText("labelValue")
            //         });

            //         var oInput = new sap.m.Input({
            //             id: "idInputValue",
            //             placeholder: this.getResourceBundle().getText("placeholderValue"),
            //             width: "100%"
            //         });

            //         oLabel.setLabelFor(oInput);

            //         var oForm = new sap.ui.layout.form.SimpleForm({
            //             layout: "ResponsiveGridLayout",
            //             content: [
            //                 oLabel,
            //                 oInput
            //             ]
            //         });

            //         this._editDialog = new sap.m.Dialog({
            //             title: this.getResourceBundle().getText("editValue"),
            //             contentWidth: "300px",
            //             contentHeight: "auto",
            //             content: [oForm],
            //             beginButton: new sap.m.Button({
            //                 text: this.getResourceBundle().getText("btnOk"),
            //                 type: "Emphasized",
            //                 press: this.handleEditValue.bind(this)
            //             }),
            //             endButton: new sap.m.Button({
            //                 text: this.getResourceBundle().getText("btnCancel"),
            //                 press: function () {
            //                     this._editDialog.close();
            //                     this._editDialog.destroy();
            //                     this._editDialog = null;

            //                 }.bind(this)
            //             }),
            //             afterClose: function () {
            //                 this._editDialog.close();
            //                 this._editDialog.destroy();
            //                 this._editDialog = null;

            //             }.bind(this)
            //         });


            //         this._editDialog.open();
            //     } catch (error) {
            //         this.showErrorMessage({
            //             oText: error.message,
            //             oTitle: this.getResourceBundle().getText("errorTitle")
            //         });
            //     }
            // },

            // Handle Edit Value
            // handleEditValue: function () {
            //     try {
            //         var oModel = this.getView().getModel(),
            //             oTable = this.byId("idTableExpenses"),
            //             sTablePath = oTable.getSelectedItem().getBindingContext().getPath(),
            //             expNoMatch = sTablePath.match(/ExpNo='(.*?)'/),
            //             sExpNo = expNoMatch ? expNoMatch[1] : null,
            //             sPath = "/EditExpense('" + sExpNo + "')",
            //             inputValue = sap.ui.getCore().byId("idInputValue"),
            //             oEntry = {};

            //         if (inputValue.getValue() == "") {
            //             inputValue.setValueState("Error");
            //             return;
            //         }

            //         oEntry.Amount = inputValue.getValue();

            //         oModel.update(sPath, oEntry, {
            //             success: function () {
            //                 oTable.removeSelections();
            //                 oModel.refresh();
            //                 this._editDialog.close();
            //                 this._editDialog.destroy();
            //             }.bind(this),
            //             error: function (oError) {
            //                 var sError = JSON.parse(oError.responseText).error.message.value;

            //                 sap.m.MessageBox.alert(sError, {
            //                     icon: "ERROR",
            //                     onClose: null,
            //                     styleClass: '',
            //                     initialFocus: null,
            //                     textDirection: sap.ui.core.TextDirection.Inherit
            //                 });
            //             }.bind(this)
            //         })
            //     } catch (error) {
            //         this.showErrorMessage({
            //             oText: error.message,
            //             oTitle: this.getResourceBundle().getText("errorTitle")
            //         });
            //     }
            // },

            // Handle Delete
            handleDeleteExpense: function () {
                try {
                    var oTable = this.byId("idTableExpenses"),
                        sTablePath = oTable.getSelectedItem().getBindingContext().getPath(),
                        expNoMatch = sTablePath.match(/ExpNo='(.*?)'/),
                        sExpNo = expNoMatch ? expNoMatch[1] : null,
                        sPath = "/EditExpense('" + sExpNo + "')";

                    sap.m.MessageBox.confirm(this.getResourceBundle().getText("confirmDeleteExpense"), {
                        title: this.getResourceBundle().getText("deleteTitle"),
                        icon: sap.m.MessageBox.Icon.WARNING,
                        actions: [sap.m.MessageBox.Action.YES, sap.m.MessageBox.Action.NO],
                        emphasizedAction: sap.m.MessageBox.Action.YES,
                        onClose: function (oAction) {
                            if (oAction === sap.m.MessageBox.Action.YES) {
                                this.onDeleteExpense(sPath);
                            }

                            this.handleButtons(false, ['btnEdit', 'btnDelete']);
                            this.handleRemoveSelections(oTable);
                        }.bind(this)
                    });
                } catch (error) {
                    this.showErrorMessage({
                        oText: error.message,
                        oTitle: this.getResourceBundle().getText("errorTitle")
                    });
                }
            },

            onItemSelect: function (oEvent) {
                var sKey = oEvent.getParameter("item").getKey();
                var oNavContainer = this.byId("NavContainer");

                switch (sKey) {
                    case "Menu":
                        var oToolPage = this.byId("toolPage");
                        oToolPage.setSideExpanded(!oToolPage.getSideExpanded());
                        break;
                    case "Manage":
                        oNavContainer.to(this.byId("pageManage"));
                        break;

                    case "CardMovements":
                        oNavContainer.to(this.byId("pageCardMovements"));
                        break;
                }
            },


            /**
             * Delete Expense
             * @param {string} sPath - Path to the expense to delete
             */
            onDeleteExpense: function (sPath) {
                var oModel = this.getView().getModel();

                oModel.remove(sPath, {
                    success: function () {
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

                this.handleRequestBusy(oModel);
            },

            /**
             * Navigate to Expense Detail
             * @param {sap.ui.base.Event} oEvent - Event object
             */
            handleExpensePress: function (oEvent) {
                this.getModel("global").setProperty("/layout", "TwoColumnsMidExpanded");

                var oItem = oEvent.getParameter("listItem");

                if (oItem) {
                    var sPath = oItem.getBindingContextPath();

                    this.onNavigation(sPath, "Detail", "/ZFI_EXPENSES_MNG");
                }
            }
        });
    });
