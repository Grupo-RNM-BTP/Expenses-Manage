sap.ui.define([
    "./BaseController",
    "sap/ui/model/json/JSONModel"
], function (BaseController, JSONModel) {
    "use strict";

    return BaseController.extend("zfiexpensesmanage.controller.NotFound", {
        onInit: function () {
            var oModel = new JSONModel();
            this.getView().setModel(oModel, "NotFound");

            var oRouter = this.getRouter();
            oRouter.attachRouteMatched(this.onRouteMatched, this);
        },

        onRouteMatched: function () {
            var that = this,
                urlParams = new URLSearchParams(window.location.search),
                token = urlParams.get('token');

            if (token != null) {
                var headers = new Headers();
                headers.append("X-authorization", token);

                var requestOptions = {
                    method: 'GET',
                    headers: headers,
                    redirect: 'follow'
                };

                fetch("/sap/opu/odata/TQA/AUTHENTICATOR_SRV/USER_AUTHENTICATION", requestOptions)
                    .then(function (response) {
                        if (!response.ok) {
                            throw new Error("Ocorreu um erro ao ler a entidade.");
                        }
                        return response.text();
                    })
                    .then(function (xml) {
                        var parser = new DOMParser(),
                            xmlDoc = parser.parseFromString(xml, "text/xml"),
                            successResponseElement = xmlDoc.getElementsByTagName("d:SuccessResponse")[0],
                            response = successResponseElement.textContent;

                        if (response == 'X') {
                            that.getRouter().navTo("RouteMain");
                        }
                    })
                    .catch(function (error) {
                        console.error(error);
                    });
            }
        },
    });
});
