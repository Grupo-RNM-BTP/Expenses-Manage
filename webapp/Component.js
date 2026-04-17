sap.ui.define([
    "sap/ui/core/UIComponent",
    "zfiexpensesmanage/model/models"
],
    function (UIComponent, models) {
        "use strict";

        /**
         * Component: Bootstraps the application, router, and shared device model.
         *
         * @namespace zfiexpensesmanage
         * @extends sap.ui.core.UIComponent
         */
        return UIComponent.extend("zfiexpensesmanage.Component", {

            metadata: {
                manifest: "json"
            },

            /**
             * Initialize the component, start routing, and register the device model.
             */
            init: function () {
                UIComponent.prototype.init.apply(this, arguments);

                this.getRouter().initialize();

                this.setModel(models.createDeviceModel(), "device");
            }
        });
    }
);
