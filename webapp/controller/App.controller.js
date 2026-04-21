sap.ui.define([
  "./BaseController",
  "sap/ui/model/json/JSONModel"
],
  function (BaseController, JSONModel) {
    "use strict";

    /**
     * AppController: Initializes global application state and authentication context.
     *
     * @namespace zfiexpensesmanage.controller
     * @extends zfiexpensesmanage.controller.BaseController
     */
    return BaseController.extend("zfiexpensesmanage.controller.App", {

      /**
       * Initialize the global model, resolve authentication source, and apply persisted language.
       */
      onInit: async function () {
        var oModel = new JSONModel({
          layout: "OneColumn",
          busy: false,
          delay: 0,
          detailReadOnly: false
        });

        this.setModel(oModel, "global");

        var sEmail = this.handleGetUserEmail();

        if (!sEmail) {
          sap.m.MessageBox.error(this.handleGetResourceBundle().getText("errorUserEmail"));
          return;
        }

        this.handleSetModelCA(sEmail);
      }
    });
  });
