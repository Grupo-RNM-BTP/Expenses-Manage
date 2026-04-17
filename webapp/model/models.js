sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
],
    function (JSONModel, Device) {
        "use strict";

        /**
         * Models: Creates shared application models.
         *
         * @namespace zfiexpensesmanage.model
         */
        return {
            
            /**
             * Create a one-way device model so the UI can react to device capabilities.
             *
             * @returns {sap.ui.model.json.JSONModel} Device model instance.
             */
            createDeviceModel: function () {
                var oModel = new JSONModel(Device);
                oModel.setDefaultBindingMode("OneWay");
                return oModel;
            }
        };
    });
