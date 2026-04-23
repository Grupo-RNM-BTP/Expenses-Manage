sap.ui.define([
    "sap/ui/base/Object",
    "zfiexpensesmanage/thirdparty/jspdf.umd.min"
], function (BaseObject, jspdfLib) {
    "use strict";

    const JsPDF =
        jspdfLib && (
            jspdfLib.jsPDF ||
            (jspdfLib.default && jspdfLib.default.jsPDF) ||
            jspdfLib.default
        );

    /**
     * Prepares a base64 image to fit into an A4 PDF page.
     * Scales and slightly enhances the image, returning an optimized base64 and dimensions in millimeters.
     * @param {string} base64Str - Image as a data URL (PNG or JPEG).
     * @returns {Promise<{optimizedBase64: string, format: "PNG"|"JPEG", widthMm: number, heightMm: number}>}
     */
    function prepareImageForPdf(base64Str) {
        return new Promise((resolve, reject) => {
            const img = new Image();

            img.onload = function () {
                const width = img.width;
                const height = img.height;
                const maxWidthMm = 180;
                const maxHeightMm = 260;
                const pxPerMm = 3.78;

                const maxWidthPx = maxWidthMm * pxPerMm;
                const maxHeightPx = maxHeightMm * pxPerMm;

                const ratio = Math.min(maxWidthPx / width, maxHeightPx / height, 1);
                const displayWidthPx = Math.round(width * ratio);
                const displayHeightPx = Math.round(height * ratio);

                const canvas = document.createElement("canvas");
                canvas.width = displayWidthPx;
                canvas.height = displayHeightPx;

                const ctx = canvas.getContext("2d");
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "medium";
                ctx.filter = "contrast(103%) brightness(101%)";
                ctx.drawImage(img, 0, 0, displayWidthPx, displayHeightPx);

                const optimizedBase64 = canvas.toDataURL("image/jpeg", 0.75);

                const widthMm = displayWidthPx / pxPerMm;
                const heightMm = displayHeightPx / pxPerMm;

                canvas.width = 0;
                canvas.height = 0;
                canvas.remove();

                resolve({
                    optimizedBase64: optimizedBase64,
                    format: "JPEG",
                    widthMm: widthMm,
                    heightMm: heightMm
                });
            };

            img.onerror = function () {
                reject(new Error("Não foi possível ler a imagem base64."));
            };

            img.src = base64Str;
        });
    }

    return BaseObject.extend("my.app.util.PdfUtil", {
        /**
         * Attaches utility methods to the given controller instance.
         * @param {sap.ui.core.mvc.Controller} oController - The controller to augment.
         * @returns {sap.ui.core.mvc.Controller} The same controller for chaining.
         */
        handleAttachToController: function (oController) {
            const that = this;
            ["convertToPdf"].forEach(function (k) {
                oController[k] = that[k];
            });
            return oController;
        },

        /**
         * Converts a base64 image (PNG/JPEG) into a single-page A4 PDF (data URI).
         * Shows a BusyIndicator during the whole process. If input is already a PDF, returns it unchanged.
         * @param {string} base64Image - Image as data URL or raw base64 (PNG/JPEG) or PDF data URI.
         * @returns {Promise<string>} PDF as data URI string.
         */
        convertToPdf: async function (base64Image) {
            sap.ui.core.BusyIndicator.show(0);

            if (!base64Image) {
                sap.ui.core.BusyIndicator.hide();
                return "";
            }

            if (
                base64Image.startsWith("data:application/pdf") ||
                base64Image.startsWith("JVBERi0x")
            ) {
                sap.ui.core.BusyIndicator.hide();
                return base64Image;
            }

            try {
                if (!JsPDF) {
                    throw new Error("jsPDF module not available.");
                }

                const prepared = await prepareImageForPdf(base64Image);
                const optimizedBase64 = prepared.optimizedBase64;
                const format = prepared.format;
                const widthMm = prepared.widthMm;
                const heightMm = prepared.heightMm;

                const orientation = widthMm > heightMm ? "landscape" : "portrait";

                const doc = new JsPDF({
                    orientation: orientation,
                    unit: "mm",
                    format: "a4",
                    compress: true
                });

                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();

                const topMargin = 10;
                const posX = (pageWidth - widthMm) / 2;
                const posY = Math.max(topMargin, (pageHeight - heightMm) / 2);

                doc.addImage(optimizedBase64, format, posX, posY, widthMm, heightMm);

                return doc.output("datauristring");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        }
    });
});