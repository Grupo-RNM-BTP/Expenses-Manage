sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject,) {
    "use strict";

    let pJsPdf;

    /**
     * Loads the jsPDF library from CDN once and returns its constructor.
     * @returns {Promise<function>} Promise that resolves to the jsPDF constructor.
     */
    function loadJsPdf() {
        if (pJsPdf) return pJsPdf;

        pJsPdf = new Promise((resolve, reject) => {
            const sUrl = "https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js";
            const sId = "thirdparty-jspdf";

            const resolveIfReady = () => {
                const JsPDF =
                    (window.jspdf && window.jspdf.jsPDF) ||
                    (window.jspdf && window.jspdf.default && window.jspdf.default.jsPDF) ||
                    window.jsPDF;

                if (JsPDF) {
                    return resolve(JsPDF);
                }

                reject(new Error("jsPDF não disponível no window."));
            };

            const existing = document.getElementById(sId);

            if (existing) {
                if (existing.dataset.ready === "true") {
                    return resolveIfReady();
                }

                existing.addEventListener("load", () => setTimeout(resolveIfReady, 0), { once: true });
                existing.addEventListener("error", () => reject(new Error("Falha ao carregar jsPDF")), { once: true });

                return;
            }

            const script = document.createElement("script");
            script.id = sId;
            script.src = sUrl;
            script.async = true;

            script.onload = () => {
                setTimeout(() => {
                    script.dataset.ready = "true";

                    resolveIfReady();
                }, 0);
            };

            script.onerror = () => reject(new Error("Falha ao carregar jsPDF"));
            
            document.head.appendChild(script);
        });

        return pJsPdf;
    }

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
                const { width, height } = img;

                const format = base64Str.startsWith("data:image/png") ? "PNG" : "JPEG";

                const maxWidthMm = 180;
                const maxHeightMm = 260;
                const pxPerMm = 3.78;

                const maxWidthPx = maxWidthMm * pxPerMm;
                const maxHeightPx = maxHeightMm * pxPerMm;

                const ratio = Math.min(maxWidthPx / width, maxHeightPx / height, 1);
                const displayWidthPx = Math.round(width * ratio);
                const displayHeightPx = Math.round(height * ratio);

                const scaleFactor = 3;
                const canvas = document.createElement("canvas");
                canvas.width = displayWidthPx * scaleFactor;
                canvas.height = displayHeightPx * scaleFactor;

                const ctx = canvas.getContext("2d");
                ctx.scale(scaleFactor, scaleFactor);
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = "high";

                ctx.filter = "contrast(105%) brightness(102%)";
                ctx.drawImage(img, 0, 0, displayWidthPx, displayHeightPx);

                const outputFormat = format === "PNG" ? "image/png" : "image/jpeg";
                const quality = format === "PNG" ? 1.0 : 0.97;
                const optimizedBase64 = canvas.toDataURL(outputFormat, quality);

                const widthMm = displayWidthPx / pxPerMm;
                const heightMm = displayHeightPx / pxPerMm;

                resolve({ optimizedBase64, format, widthMm, heightMm });
            };

            img.onerror = () => reject(new Error("Não foi possível ler a imagem base64."));
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
            ["convertToPdf"].forEach((k) => { oController[k] = this[k]; });
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

            if (base64Image.startsWith("data:application/pdf") || base64Image.startsWith("JVBERi0x")) {
                return base64Image;
            }

            try {
                const JsPDF = await loadJsPdf();
                const { optimizedBase64, format, widthMm, heightMm } = await prepareImageForPdf(base64Image);

                const orientation = widthMm > heightMm ? "landscape" : "portrait";
                const doc = new JsPDF({
                    orientation,
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
        },
    });
});
