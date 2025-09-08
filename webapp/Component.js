sap.ui.define([
    "sap/ui/core/UIComponent",
    "zfiexpensesmanage/model/models"
],
    function (UIComponent, models) {
        "use strict";

        // sap.ui.loader.config({
        //     paths: {
        //         "zfiexpenses": "/sap/bc/ui5_ui5/sap/zfi_exp_ovw"
        //     }
        // });

        return UIComponent.extend("zfiexpensesmanage.Component", {
            metadata: {
                manifest: "json"
            },
            init: function () {
                UIComponent.prototype.init.apply(this, arguments);

                this.getRouter().initialize();

                this.setModel(models.createDeviceModel(), "device");
            }
        });
    }
);