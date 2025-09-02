sap.ui.define([
    "./BaseController",
    "../model/formatter",
    "sap/ui/model/json/JSONModel"
],
    function (BaseController, formatter, JSONModel) {
        "use strict";

        return BaseController.extend("zfiexpensesmanage.controller.Detail", {

            formatter: formatter,

            onInit: function () {

            },
        });
    });
