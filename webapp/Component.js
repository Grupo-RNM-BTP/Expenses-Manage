sap.ui.define([
    "sap/ui/core/UIComponent",
    "zfiexpensesmanage/model/models"
],
    function (UIComponent, models) {
        "use strict";

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