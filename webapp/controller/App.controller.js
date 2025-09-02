sap.ui.define(
  [
    "./BaseController",
    "sap/ui/model/json/JSONModel"
  ],
  function (BaseController, JSONModel) {
    "use strict";

    return BaseController.extend("zfiexpensesmanage.controller.App", {
      onInit: function () {
        var oModel = new JSONModel({
          layout: "OneColumn",
          busy: false,
          delay: 0
        });

        this.setModel(oModel, "global");

        var urlParams = new URLSearchParams(window.location.search),
          token = urlParams.get('token');

        this.setModelCA(token);

        if (!sessionStorage.getItem("oLangu"))
          sap.ui.getCore().getConfiguration().setLanguage("EN");
        else {
          sap.ui.getCore().getConfiguration().setLanguage(sessionStorage.getItem("oLangu"));
        }
      }
    });
  }
);
