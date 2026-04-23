sap.ui.define([
    "sap/ui/core/UIComponent",
    "zfiexpensesmanage/model/models"
],
    function (UIComponent, models) {
        "use strict";

        sap.ui.loader.config({
            shim: {
                "zfiexpensesmanage/thirdparty/jspdf.umd.min": {
                    amd: true,
                    exports: "jspdf"
                }
            }
        });

        /**
         * Component: Bootstraps the application, router, and shared device model.
         *
         * @namespace zfiexpensesmanage
         * @extends sap.ui.core.UIComponent
         */
        return UIComponent.extend("zfiexpensesmanage.Component", {

            /**
            * Initializes component, OpenCV, router, and models.
            */
            init: function () {
                UIComponent.prototype.init.apply(this, arguments);

                this.getRouter().initialize();

                this.setModel(models.createDeviceModel(), "device");

                this.onInitializeOpenCV();
            },

            /**
             * Ensures OpenCV is loaded only once.
             */
            onInitializeOpenCV: function () {
                if (!window.cvPromise) {
                    window.cvReady = false;
                    window.cvPromise = this.handleCreateOpenCVPromise();
                }
            },

            /**
             * Creates the OpenCV loading promise.
             *
             * @returns {Promise} OpenCV promise
             */
            handleCreateOpenCVPromise: function () {
                return new Promise(function (resolve, reject) {
                    var sScriptUrl = this.handleGetOpenCVScriptUrl();
                    var oScript = this.handleCreateOpenCVScriptElement(sScriptUrl);

                    oScript.onload = function () {
                        this.handleBootstrapOpenCV(resolve, reject);
                    }.bind(this);

                    oScript.onerror = function () {
                        reject(new Error("Failed to load opencv.js"));
                    };

                    document.head.appendChild(oScript);
                }.bind(this));
            },

            /**
             * Returns the OpenCV script URL.
             *
             * @returns {string} Resolved URL
             */
            handleGetOpenCVScriptUrl: function () {
                return sap.ui.require.toUrl("zfiexpensesmanage/thirdparty/opencv.js");
            },

            /**
             * Creates the OpenCV script element.
             *
             * @param {string} sScriptUrl Script URL
             * @returns {HTMLScriptElement} Script element
             */
            handleCreateOpenCVScriptElement: function (sScriptUrl) {
                var oScript = document.createElement("script");

                oScript.src = sScriptUrl;
                oScript.async = true;
                oScript.defer = true;

                return oScript;
            },

            /**
             * Bootstraps the OpenCV factory.
             *
             * @param {function} resolve Promise resolve
             * @param {function} reject Promise reject
             */
            handleBootstrapOpenCV: function (resolve, reject) {
                try {
                    if (typeof window.cv !== "function") {
                        reject(new Error("OpenCV factory not available."));
                        return;
                    }

                    var fnCvFactory = window.cv;
                    var oFactoryResult = fnCvFactory({
                        locateFile: function (sPath) {
                            return sap.ui.require.toUrl("zfiexpensesmanage/thirdparty/" + sPath);
                        }
                    });

                    Promise.resolve(oFactoryResult)
                        .then(function (oCv) {
                            window.cv = oCv;
                            window.cvReady = true;
                            resolve(oCv);
                        })
                        .catch(function (oError) {
                            reject(oError);
                        });

                } catch (oError) {
                    reject(oError);
                }
            }
        });
    });
