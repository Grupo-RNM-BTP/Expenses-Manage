sap.ui.define([
    "sap/ui/base/Object"
], function (BaseObject) {
    "use strict";

    const fnGetBitmapDims = (oMedia) => {
        const bIsImg = oMedia.tagName === "IMG";

        return {
            w: bIsImg ? oMedia.naturalWidth : oMedia.videoWidth,
            h: bIsImg ? oMedia.naturalHeight : oMedia.videoHeight
        };
    };

    const fnOrderTLTRBRBL = function (aPts) {
        return this.handleOrderTLTRBRBL(aPts);
    };

    const fnComputeOutSizeFromQuad = (aQuad) => {
        const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

        const nW = (d(aQuad[0], aQuad[1]) + d(aQuad[2], aQuad[3])) / 2;
        const nH = (d(aQuad[1], aQuad[2]) + d(aQuad[3], aQuad[0])) / 2;

        const nOutW = Math.max(500, Math.min(2400, Math.round(nW)));
        const nOutH = Math.max(500, Math.min(3400, Math.round(nH)));

        return { nOutW, nOutH };
    };

    const fnWarpToDataURL = (oCv, oSrcCanvas, aQuadOrdered, nOutW, nOutH) => {
        const oSrc = oCv.imread(oSrcCanvas);
        const oDst = new oCv.Mat();

        const oSrcPts = oCv.matFromArray(4, 1, oCv.CV_32FC2, [
            aQuadOrdered[0].x, aQuadOrdered[0].y,
            aQuadOrdered[1].x, aQuadOrdered[1].y,
            aQuadOrdered[2].x, aQuadOrdered[2].y,
            aQuadOrdered[3].x, aQuadOrdered[3].y
        ]);

        const oDstPts = oCv.matFromArray(4, 1, oCv.CV_32FC2, [
            0, 0,
            nOutW - 1, 0,
            nOutW - 1, nOutH - 1,
            0, nOutH - 1
        ]);

        const oM = oCv.getPerspectiveTransform(oSrcPts, oDstPts);
        oCv.warpPerspective(
            oSrc, oDst, oM, new oCv.Size(nOutW, nOutH),
            oCv.INTER_LINEAR, oCv.BORDER_REPLICATE, new oCv.Scalar()
        );

        const oOutCanvas = document.createElement("canvas");
        oOutCanvas.width = nOutW;
        oOutCanvas.height = nOutH;
        oCv.imshow(oOutCanvas, oDst);
        const sDataUrl = oOutCanvas.toDataURL("image/png");

        oSrc.delete();
        oDst.delete();
        oSrcPts.delete();
        oDstPts.delete();
        oM.delete?.();

        return sDataUrl;
    };

    // Função única para imagens OU vídeo
    const handleWarpFromMedia = async function (oMedia, aQuadPx) {
        await this.handleEnsureOpenCVReady();

        const { w: nW, h: nH } = fnGetBitmapDims(oMedia);

        if (!nW || !nH) {
            throw new Error("Media sem dimensões válidas.");
        }

        if (!aQuadPx || aQuadPx.length !== 4) {
            throw new Error("Quadrilátero inválido.");
        }

        const aQuadOrdered = fnOrderTLTRBRBL.call(this, aQuadPx);
        const { nOutW, nOutH } = fnComputeOutSizeFromQuad(aQuadOrdered);

        const oSrcCanvas = document.createElement("canvas");

        oSrcCanvas.width = nW;
        oSrcCanvas.height = nH;

        const oCtx = oSrcCanvas.getContext("2d");

        oCtx.drawImage(oMedia, 0, 0, nW, nH);

        return fnWarpToDataURL(window.cv, oSrcCanvas, aQuadOrdered, nOutW, nOutH);
    };

    const ScanUtil = BaseObject.extend("my.app.util.ScanUtil", {
        /**
         * Attaches selected handler methods to a target controller instance.
         * @param {object} oController - The controller to receive the handlers.
         * @returns {object} The same controller instance with handlers attached.
         */
        handleAttachToController: function (oController) {
            const aHandlerNames = [
                "handleEnsureOpenCVReady",
                "handleCreateOverlayCanvas",
                "handleStopLiveDetect",
                "handleClearAutoDetectTimer",
                "handleStopAllDetect",
                "handleOrderTLTRBRBL",
                "handleWarp",
                "handleCaptureFrame",
                "handleMapOverlayToMedia",
                "handleEnableDrawModeImage",
                "handleDisableDrawModeImage",
                "onStartAutoDetect",
                "onLiveDetect"
            ];
            aHandlerNames.forEach((sKey) => { oController[sKey] = this[sKey]; });

            return oController;
        },

        /**
         * Ensures that OpenCV is ready and returns a promise that resolves when it is.
         * @returns {Promise<void>} A promise that resolves when OpenCV is ready.
         */
        handleEnsureOpenCVReady: function () {
            return new Promise((resolve, reject) => {
                const bCvReady = Boolean(window.cv && window.cvReady);
                if (bCvReady) {
                    return resolve();
                } else {
                    reject();
                }
            });
        },

        /**
         * Creates an overlay canvas element for the given video element.
         * @param {HTMLVideoElement} video - The video element to create the overlay for.
         * @returns {HTMLCanvasElement} The created overlay canvas element.
         */
        handleCreateOverlayCanvas: function (oVideo) {
            const oContainer = oVideo.parentElement || oVideo;

            let oOverlayCanvas = oContainer.querySelector("#cameraOverlay");

            if (!oOverlayCanvas) {
                oOverlayCanvas = document.createElement("canvas");

                oOverlayCanvas.id = "cameraOverlay";
                oOverlayCanvas.style.position = "absolute";
                oOverlayCanvas.style.inset = "0";
                oOverlayCanvas.style.pointerEvents = "none";
                oOverlayCanvas.style.width = "100%";
                oOverlayCanvas.style.height = "100%";

                const sContainerPos = getComputedStyle(oContainer).position;
                if (sContainerPos === "static") {
                    oContainer.style.position = "relative";
                }

                oContainer.appendChild(oOverlayCanvas);
            }

            const fnResize = () => {
                const oRect = oVideo.getBoundingClientRect();

                oOverlayCanvas.width = Math.max(1, Math.round(oRect.width));
                oOverlayCanvas.height = Math.max(1, Math.round(oRect.height));
            };

            fnResize();

            try {
                new ResizeObserver(fnResize).observe(oVideo);
            } catch (oErr) { }

            return oOverlayCanvas;
        },

        /**
         * Clears (and optionally hides) the camera overlay canvas.
         * @param {HTMLElement} oRootOrVideo - Root container or the video element.
         * @param {boolean} bHide - If true, hides the overlay after clearing.
         */
        handleClearOverlay: function (oRootOrVideo, bHide = true) {
            try {
                const oRoot = oRootOrVideo?.querySelector ? oRootOrVideo : oRootOrVideo?.parentElement;
                if (!oRoot) return;

                const oOverlay = oRoot.querySelector("#cameraOverlay");
                if (!oOverlay) return;

                const oCtx = oOverlay.getContext?.("2d");
                oCtx && oCtx.clearRect(0, 0, oOverlay.width, oOverlay.height);

                if (bHide) {
                    oOverlay.style.display = "none";
                }
            } catch (e) { }
        },

        /**
         * Starts live document detection on the given DOM reference.
         * @param {HTMLElement} oDomRef - The DOM reference to start detection on.
         * @returns {Promise<boolean>} A promise that resolves to true if detection started successfully, false otherwise.
         */
        onLiveDetect: async function (oDomRef) {
            this.handleStopLiveDetect();

            const oRoot = oDomRef || (this.getView() && this.getView().getDomRef());
            if (!oRoot) return;

            const oVideo = oRoot.querySelector("#cameraVideo");
            if (!oVideo) return;

            const oOverlayCanvas = this.handleCreateOverlayCanvas(oVideo);

            try {
                await this.handleEnsureOpenCVReady();
            } catch (oError) {
                this._oLiveDetectCtrl = { stop: true };
                return false;
            }

            this._oScanFx = this._oScanFx || { pos: 0, last: performance.now() };

            this._oLiveDetectCtrl = { stop: false };

            const oCv = window.cv;
            const MAX_FPS = 15;
            const TARGET_SHORT = 720;

            let iLastTimestamp = 0;

            // ----- parâmetros de filtro -----
            const MIN_AREA_RATIO = 0.035;  // >= 3.5% do frame processado
            const MAX_AREA_RATIO = 0.98;   // <= 98% (evita “mesa inteira”)
            const MIN_RECT_DOC = 0.65;     // retangularidade p/ docs “quadrados”
            const MIN_RECT_RECE = 0.50;    // retangularidade mínima p/ faturas
            const ASPECT_CORE_MIN = 0.60;  // janela “normal” (docs)
            const ASPECT_CORE_MAX = 2.00;
            const ASPECT_EXT_MIN = 0.40;   // janela extra p/ faturas
            const ASPECT_EXT_MAX = 5.00;
            const BORDER_TOL = 8;          // px no espaço processado
            const EPS_FACTOR = 0.02;       // approxPolyDP

            const fnSignedArea = (aPts) => {
                let nArea = 0;
                for (let i = 0; i < 4; i++) {
                    const oP = aPts[i], oQ = aPts[(i + 1) % 4];
                    nArea += oP.x * oQ.y - oQ.x * oP.y;
                }

                return nArea / 2;
            };

            const fnIntersectLines = (oP, oV, oQ, oW) => {
                const fnCross = (oA, oB) => oA.x * oB.y - oA.y * oB.x;
                const oR = { x: oQ.x - oP.x, y: oQ.y - oP.y };
                const nDen = fnCross(oV, oW);

                if (Math.abs(nDen) < 1e-6) {
                    return { x: (oP.x + oQ.x) * 0.5, y: (oP.y + oQ.y) * 0.5 };
                }

                const nT = fnCross(oR, oW) / nDen;
                return { x: oP.x + nT * oV.x, y: oP.y + nT * oV.y };
            };

            const fnOutwardNormal = (oE, bIsCCW) => {
                let nx, ny;
                if (bIsCCW) {
                    nx = oE.y; ny = -oE.x;
                } else {
                    nx = -oE.y; ny = oE.x;
                }

                const nLen = Math.hypot(nx, ny) || 1;
                return { x: nx / nLen, y: ny / nLen };
            };

            const fnOffsetQuadOutward = (aPts, nPad) => {
                const bIsCCW = fnSignedArea(aPts) > 0;
                const aEdges = [];
                const aOut = [];

                for (let i = 0; i < 4; i++) {
                    const oA = aPts[i], oB = aPts[(i + 1) % 4];
                    const oE = { x: oB.x - oA.x, y: oB.y - oA.y };
                    const oN = fnOutwardNormal(oE, bIsCCW);
                    const oP = { x: oA.x + oN.x * nPad, y: oA.y + oN.y * nPad };
                    const oV = { x: oE.x, y: oE.y };

                    aEdges.push({ p: oP, v: oV });
                }

                for (let i = 0; i < 4; i++) {
                    const oPrev = aEdges[(i + 3) % 4];
                    const oCurr = aEdges[i];

                    aOut.push(fnIntersectLines(oPrev.p, oPrev.v, oCurr.p, oCurr.v));
                }

                return aOut;
            };

            const fnClampQuadToBounds = (aPts, nW, nH) => aPts.map(oP => ({
                x: Math.max(0, Math.min(nW - 1, oP.x)),
                y: Math.max(0, Math.min(nH - 1, oP.y))
            }));

            const sColorBorder = "rgba(255, 185, 100, 0.28)";
            const sColorFill = "rgba(255, 185, 100, 0.28)";
            const sColorGlow = "rgba(255, 200, 120, 0.55)";

            const fnDrawQuad = (aQuad) => {
                const nW = oOverlayCanvas.width, nH = oOverlayCanvas.height;
                const oCtx = oOverlayCanvas.getContext("2d");

                oCtx.clearRect(0, 0, nW, nH);
                if (!aQuad) {
                    return;
                }

                oCtx.beginPath();
                oCtx.moveTo(aQuad[0].x, aQuad[0].y);
                for (let i = 1; i < 4; i++) { oCtx.lineTo(aQuad[i].x, aQuad[i].y); }
                oCtx.closePath();

                const nCx = (aQuad[0].x + aQuad[1].x + aQuad[2].x + aQuad[3].x) / 4;
                const nCy = (aQuad[0].y + aQuad[1].y + aQuad[2].y + aQuad[3].y) / 4;
                const nR = Math.hypot(nW, nH) * 0.35;
                const oGrad = oCtx.createRadialGradient(nCx, nCy, 0, nCx, nCy, nR);

                oGrad.addColorStop(0.0, "rgba(255, 200, 140, 0.35)");
                oGrad.addColorStop(1.0, sColorFill);

                oCtx.fillStyle = oGrad;
                oCtx.fill();

                oCtx.lineWidth = 3;
                oCtx.strokeStyle = sColorBorder;
                oCtx.shadowColor = sColorGlow;
                oCtx.shadowBlur = 8;
                oCtx.stroke();
                oCtx.shadowBlur = 0;

                oCtx.fillStyle = "rgba(255, 210, 150, 0.9)";
                for (let i = 0; i < 4; i++) {
                    oCtx.beginPath();
                    oCtx.arc(aQuad[i].x, aQuad[i].y, 4, 0, Math.PI * 2);
                    oCtx.fill();
                }

                oCtx.save();
                oCtx.beginPath();
                oCtx.moveTo(aQuad[0].x, aQuad[0].y);

                for (let i = 1; i < 4; i++) {
                    oCtx.lineTo(aQuad[i].x, aQuad[i].y);
                }

                oCtx.closePath();
                oCtx.clip();

                const nNow = performance.now();
                const nLast = this._oScanFx.last || nNow;
                const nDt = (nNow - nLast) / 1000;
                this._oScanFx.last = nNow;

                const nSpeed = 0.55;
                const nBand = 0.22;
                this._oScanFx.pos = (this._oScanFx.pos + nDt * nSpeed) % 1;

                const nCellFrac = 0.095;
                const nCell = Math.max(18, Math.round(Math.min(nW, nH) * nCellFrac));

                const nGapFactor = 0.10;
                const nSize = Math.round(nCell * (1 - nGapFactor));
                const nOffsetAlt = 0.18;

                const sColorSquare = "rgba(255, 230, 170, 1)";
                const sBorderSquare = "rgba(255, 210, 140, 0.9)";
                const nBaseAlpha = 0.40;
                const nPeakAlpha = 0.92;

                const sPrevComp = oCtx.globalCompositeOperation;
                oCtx.globalCompositeOperation = "screen";

                const nBandTop = (this._oScanFx.pos - nBand / 2) * nH;
                const nBandBot = (this._oScanFx.pos + nBand / 2) * nH;
                const nBandMid = (nBandTop + nBandBot) / 2;
                const nBandHalf = (nBand * nH) / 2;

                for (let y = -nCell; y < nH + nCell; y += nCell) {
                    if (y + nCell < nBandTop || y - nCell > nBandBot) continue;

                    const nDist = Math.abs((y + nCell / 2) - nBandMid) / nBandHalf;
                    let nAlpha = Math.max(nBaseAlpha, nPeakAlpha * (1 - nDist));
                    const nTwinkle = 0.90 + 0.10 * Math.sin((y * 0.03) + nNow * 0.004);
                    nAlpha *= nTwinkle;

                    const nRowOffset = ((Math.floor(y / nCell) % 2) ? 0 : nCell * nOffsetAlt);

                    for (let x = -nCell; x < nW + nCell; x += nCell) {
                        oCtx.globalAlpha = nAlpha;
                        const nPx = x + nRowOffset + (nCell - nSize) / 2;
                        const nPy = y + (nCell - nSize) / 2;

                        oCtx.fillStyle = sColorSquare;
                        oCtx.fillRect(nPx, nPy, nSize, nSize);

                        oCtx.globalAlpha = Math.min(1, nAlpha + 0.12);
                        oCtx.strokeStyle = sBorderSquare;
                        oCtx.lineWidth = Math.max(1, Math.round(nSize * 0.04));
                        oCtx.strokeRect(nPx, nPy, nSize, nSize);
                    }
                }

                oCtx.globalAlpha = 1;
                oCtx.globalCompositeOperation = sPrevComp;
                oCtx.restore();
            };

            const fnLoop = () => {
                if (this._oLiveDetectCtrl?.stop) {
                    return;
                }

                const nNow = performance.now();
                if (nNow - iLastTimestamp < 1000 / MAX_FPS) {
                    return requestAnimationFrame(fnLoop);
                }
                iLastTimestamp = nNow;

                const nVW = oVideo.videoWidth, nVH = oVideo.videoHeight;
                if (!nVW || !nVH) {
                    return requestAnimationFrame(fnLoop);
                }

                const nScale = (nVH > nVW ? TARGET_SHORT / nVW : TARGET_SHORT / nVH);
                const nProcW = Math.max(1, Math.round(nVW * nScale));
                const nProcH = Math.max(1, Math.round(nVH * nScale));

                if (!this._oOffCanvas) {
                    this._oOffCanvas = document.createElement("canvas");
                }

                const oOff = this._oOffCanvas;
                oOff.width = nProcW; oOff.height = nProcH;

                const oOffCtx = oOff.getContext("2d");
                oOffCtx.drawImage(oVideo, 0, 0, nProcW, nProcH);

                let aQuadOverlayCss = null;

                try {
                    const oSrc = oCv.imread(oOff);
                    const oGray = new oCv.Mat();
                    oCv.cvtColor(oSrc, oGray, oCv.COLOR_RGBA2GRAY);

                    const oBlur = new oCv.Mat();
                    oCv.GaussianBlur(oGray, oBlur, new oCv.Size(5, 5), 0);

                    const oBin = new oCv.Mat();
                    oCv.threshold(oBlur, oBin, 0, 255, oCv.THRESH_BINARY + oCv.THRESH_OTSU);

                    const oContours = new oCv.MatVector();
                    const oHierarchy = new oCv.Mat();
                    oCv.findContours(oBin, oContours, oHierarchy, oCv.RETR_EXTERNAL, oCv.CHAIN_APPROX_SIMPLE);

                    const fnTouchesBorder = (oPoly, nW, nH, nTol) => {
                        for (let i = 0; i < oPoly.rows; i++) {
                            const nX = oPoly.intPtr(i, 0)[0], nY = oPoly.intPtr(i, 0)[1];
                            if (nX <= nTol || nY <= nTol || nX >= nW - nTol || nY >= nH - nTol) return true;
                        }
                        return false;
                    };

                    const fnToPointArray = (oPoly) => {
                        const aPts = [];
                        if (oPoly.type() === oCv.CV_32SC2) {
                            for (let i = 0; i < oPoly.rows; i++) aPts.push({ x: oPoly.intPtr(i, 0)[0], y: oPoly.intPtr(i, 0)[1] });
                        } else {
                            for (let i = 0; i < oPoly.rows; i++) aPts.push({ x: oPoly.floatPtr(i, 0)[0], y: oPoly.floatPtr(i, 0)[1] });
                        }
                        return aPts;
                    };

                    const fnOrder4 = (aPts) => {
                        const nCx = aPts.reduce((s, p) => s + p.x, 0) / aPts.length;
                        const nCy = aPts.reduce((s, p) => s + p.y, 0) / aPts.length;
                        let oTL, oTR, oBR, oBL;

                        for (const oP of aPts) {
                            if (oP.x < nCx && oP.y < nCy) oTL = oP;
                            else if (oP.x > nCx && oP.y < nCy) oTR = oP;
                            else if (oP.x > nCx && oP.y > nCy) oBR = oP;
                            else oBL = oP;
                        }

                        return [oTL, oTR, oBR, oBL];
                    };

                    const fnBoxPoints = (oRot) => {
                        if (oCv.RotatedRect && oCv.RotatedRect.points) {
                            return oCv.RotatedRect.points(oRot);
                        }
                        const nAng = oRot.angle * Math.PI / 180.0;
                        const b = Math.cos(nAng) * 0.5, a = Math.sin(nAng) * 0.5;
                        const nCx = oRot.center.x, nCy = oRot.center.y;
                        const nW = oRot.size.width, nH = oRot.size.height;

                        return [
                            { x: nCx - a * nH - b * nW, y: nCy + b * nH - a * nW },
                            { x: nCx + a * nH - b * nW, y: nCy - b * nH - a * nW },
                            { x: nCx + a * nH + b * nW, y: nCy - b * nH + a * nW },
                            { x: nCx - a * nH + b * nW, y: nCy + b * nH + a * nW }
                        ];
                    };

                    let oBest = null;

                    for (let i = 0; i < oContours.size(); i++) {
                        const oCnt = oContours.get(i);
                        const nArea = oCv.contourArea(oCnt);

                        if (nArea < 1) continue;

                        const nAreaRatio = nArea / (nProcW * nProcH);
                        if (nAreaRatio < MIN_AREA_RATIO || nAreaRatio > MAX_AREA_RATIO) continue;

                        const nPeri = oCv.arcLength(oCnt, true);
                        const oApprox = new oCv.Mat();
                        oCv.approxPolyDP(oCnt, oApprox, EPS_FACTOR * nPeri, true);

                        if (oApprox.rows < 4 || oApprox.rows > 8) { oApprox.delete(); continue; }
                        if (!oCv.isContourConvex(oApprox)) { oApprox.delete(); continue; }
                        if (fnTouchesBorder(oApprox, nProcW, nProcH, BORDER_TOL)) { oApprox.delete(); continue; }

                        const aPts = fnToPointArray(oApprox);
                        oApprox.delete();

                        const oMatPts = oCv.matFromArray(aPts.length, 1, oCv.CV_32FC2, aPts.flatMap(oP => [oP.x, oP.y]));
                        const oRRect = oCv.minAreaRect(oMatPts);
                        oMatPts.delete();

                        const aRectPts = fnBoxPoints(oRRect);
                        const [oTL, oTR, oBR, oBL] = fnOrder4(aRectPts);

                        const aXs = aRectPts.map(oP => oP.x), aYs = aRectPts.map(oP => oP.y);
                        const nMinX = Math.max(0, Math.min(...aXs)), nMaxX = Math.min(nProcW - 1, Math.max(...aXs));
                        const nMinY = Math.max(0, Math.min(...aYs)), nMaxY = Math.min(nProcH - 1, Math.max(...aYs));
                        const nBw = Math.max(1, nMaxX - nMinX), nBh = Math.max(1, nMaxY - nMinY);

                        const nRectAreaAxis = nBw * nBh;
                        const nRectangularity = nRectAreaAxis > 0 ? nArea / nRectAreaAxis : 0;

                        const nW = oRRect.size.width, nH = oRRect.size.height;
                        const nAspect = (Math.max(nW, nH) / Math.max(1, Math.min(nW, nH)));

                        const bCoreAspectOK = (nAspect >= ASPECT_CORE_MIN && nAspect <= ASPECT_CORE_MAX);
                        const bExtAspectOK = (nAspect >= ASPECT_EXT_MIN && nAspect <= ASPECT_EXT_MAX);
                        if (!bExtAspectOK) continue;

                        const nMinRect = bCoreAspectOK ? MIN_RECT_DOC : MIN_RECT_RECE;
                        if (nRectangularity < nMinRect) continue;

                        const nScore = nRectangularity * 0.6 + Math.min(1, nAreaRatio / 0.5) * 0.4 + (bCoreAspectOK ? 0.10 : 0);

                        if (!oBest || nScore > oBest.score) {
                            oBest = { score: nScore, tl: oTL, tr: oTR, br: oBR, bl: oBL };
                        }
                    }

                    if (oBest) {
                        const oRectCss = oVideo.getBoundingClientRect();
                        const nSx = oRectCss.width / nProcW;
                        const nSy = oRectCss.height / nProcH;

                        aQuadOverlayCss = [
                            { x: oBest.tl.x * nSx, y: oBest.tl.y * nSy },
                            { x: oBest.tr.x * nSx, y: oBest.tr.y * nSy },
                            { x: oBest.br.x * nSx, y: oBest.br.y * nSy },
                            { x: oBest.bl.x * nSx, y: oBest.bl.y * nSy }
                        ];

                        const nSvx = oVideo.videoWidth / nProcW;
                        const nSvy = oVideo.videoHeight / nProcH;
                        let aCornersVideo = [
                            { x: oBest.tl.x * nSvx, y: oBest.tl.y * nSvy },
                            { x: oBest.tr.x * nSvx, y: oBest.tr.y * nSvy },
                            { x: oBest.br.x * nSvx, y: oBest.br.y * nSvy },
                            { x: oBest.bl.x * nSvx, y: oBest.bl.y * nSvy }
                        ];

                        const nMinDim = Math.min(oVideo.videoWidth, oVideo.videoHeight);
                        const PAD_FRAC = 0.20;
                        const nPadPx = Math.max(8, Math.min(32, PAD_FRAC * nMinDim));

                        let aInflated = fnOffsetQuadOutward(aCornersVideo, nPadPx);
                        aInflated = fnClampQuadToBounds(aInflated, oVideo.videoWidth, oVideo.videoHeight);

                        this._aLastQuadVideoPx = aInflated;
                    } else {
                        this._aLastQuadVideoPx = null;
                    }

                    fnDrawQuad(aQuadOverlayCss);

                    oSrc.delete();
                    oGray.delete();
                    oBlur.delete();
                    oBin.delete();
                    oContours.delete();
                    oHierarchy.delete();
                } catch (oErr) { }

                requestAnimationFrame(fnLoop);
            };

            requestAnimationFrame(fnLoop);

            return true;
        },

        /**
         * Starts auto-detection of documents in the camera feed.
         */
        onStartAutoDetect: function () {
            this.handleClearAutoDetectTimer?.();

            const oVideo =
                (this.oCameraDialog && this.oCameraDialog.getDomRef && this.oCameraDialog.getDomRef() && this.oCameraDialog.getDomRef().querySelector("#cameraVideo")) ||
                (this.getView && this.getView() && this.getView().getDomRef && this.getView().getDomRef() && this.getView().getDomRef().querySelector("#cameraVideo"));

            if (!oVideo || !oVideo.videoWidth || !oVideo.videoHeight) {
                return;
            }

            const STABLE_MS = 3000;
            const TICK_MS = 120;

            let nStableSinceMs = null;
            let bDone = false;

            const fnAvgEdgeWH = (aQ) => {
                const fnD = (oA, oB) => Math.hypot(oA.x - oB.x, oA.y - oB.y);
                const nW = (fnD(aQ[0], aQ[1]) + fnD(aQ[2], aQ[3])) / 2;
                const nH = (fnD(aQ[1], aQ[2]) + fnD(aQ[3], aQ[0])) / 2;

                return { w: nW, h: nH };
            };

            const fnWarpAndSave = async () => {
                try {
                    await this.handleEnsureOpenCVReady();
                } catch (oError) {
                    throw new Error("OpenCV não carregado.");
                }

                const oCv = window.cv;

                const aQuadRaw = this._aLastQuadVideoPx;
                if (!aQuadRaw || aQuadRaw.length !== 4) {
                    throw new Error("Documento não detetado.");
                }
                let aQuad = aQuadRaw.map(p => ({ x: p.x, y: p.y }));

                this.handleStopLiveDetect?.();
                this.handleClearAutoDetectTimer?.();

                const oRoot =
                    (this.oCameraDialog && this.oCameraDialog.getDomRef && this.oCameraDialog.getDomRef()) ||
                    (this.getView && this.getView() && this.getView().getDomRef && this.getView().getDomRef()) ||
                    null;

                if (oRoot) {
                    this.handleClearOverlay?.(oRoot, true);
                } else {
                    this.handleClearOverlay?.(oVideo, true);
                }

                await new Promise((r) => requestAnimationFrame(r));

                aQuad = this.handleOrderTLTRBRBL(aQuad);

                const oWH = fnAvgEdgeWH(aQuad);
                const nOutW = Math.max(500, Math.min(2400, Math.round(oWH.w)));
                const nOutH = Math.max(500, Math.min(3400, Math.round(oWH.h)));

                const oSrcCanvas = document.createElement("canvas");
                oSrcCanvas.width = oVideo.videoWidth;
                oSrcCanvas.height = oVideo.videoHeight;

                const oSctx = oSrcCanvas.getContext("2d");
                oSctx.drawImage(oVideo, 0, 0, oSrcCanvas.width, oSrcCanvas.height);

                const oSrc = oCv.imread(oSrcCanvas);
                const oDst = new oCv.Mat();

                const oSrcPts = oCv.matFromArray(4, 1, oCv.CV_32FC2, [
                    aQuad[0].x, aQuad[0].y,
                    aQuad[1].x, aQuad[1].y,
                    aQuad[2].x, aQuad[2].y,
                    aQuad[3].x, aQuad[3].y
                ]);

                const oDstPts = oCv.matFromArray(4, 1, oCv.CV_32FC2, [
                    0, 0,
                    nOutW - 1, 0,
                    nOutW - 1, nOutH - 1,
                    0, nOutH - 1
                ]);

                const oM = oCv.getPerspectiveTransform(oSrcPts, oDstPts);
                oCv.warpPerspective(
                    oSrc, oDst, oM, new oCv.Size(nOutW, nOutH),
                    oCv.INTER_LINEAR, oCv.BORDER_REPLICATE, new oCv.Scalar()
                );

                const oOutCanvas = document.createElement("canvas");
                oOutCanvas.width = nOutW;
                oOutCanvas.height = nOutH;

                oCv.imshow(oOutCanvas, oDst);
                const sDataUrl = oOutCanvas.toDataURL("image/png");

                if (this.oExpensesModel) {
                    this.oExpensesModel.setProperty("/capturedImage", sDataUrl);
                    this.oExpensesModel.setProperty("/imageExt", "PNG");
                }

                this._bPhotoTaken = true;
                this.handleClearCameraAutoClose();

                this.handleStopAllDetect();
                this.handleScanPhoto();

                oSrc.delete();
                oDst.delete();
                oSrcPts.delete();
                oDstPts.delete();
                oM.delete?.();
            };

            const fnTick = () => {
                if (bDone) return;

                const bDetected = !!this._aLastQuadVideoPx && this._aLastQuadVideoPx.length === 4;
                const nNow = Date.now();

                if (bDetected) {
                    if (nStableSinceMs == null) {
                        nStableSinceMs = nNow;
                    }

                    if (nNow - nStableSinceMs >= STABLE_MS) {
                        bDone = true;
                        clearInterval(this._iAutoDetectTimer);
                        this._iAutoDetectTimer = null;

                        fnWarpAndSave().catch(() => { });
                    }
                } else {
                    nStableSinceMs = null;
                }
            };

            this._iAutoDetectTimer = setInterval(fnTick, TICK_MS);
        },

        /**
         * Stops the live document detection.
         */
        handleStopLiveDetect: function () {
            if (this._oLiveDetectCtrl) {
                this._oLiveDetectCtrl.stop = true;
            }

            this._oLiveDetectCtrl = null;
            this._oOffCanvas = null;
        },

        /**
         * Clears the auto-detect timer.
         */
        handleClearAutoDetectTimer: function () {
            if (this._iAutoDetectTimer) {
                clearInterval(this._iAutoDetectTimer);
                this._iAutoDetectTimer = null;
            }
        },

        /**
         * Stops all document detection.
         * @param {HTMLElement} oDomRef - The DOM reference to stop detection on.
         */
        handleStopAllDetect: function (oDomRef) {
            try {
                this.handleStopLiveDetect?.();
                this.handleClearAutoDetectTimer?.();

                let oRoot =
                    (oDomRef) ||
                    (this.oCameraDialog && this.oCameraDialog.getDomRef && this.oCameraDialog.getDomRef()) ||
                    (this.getView && this.getView() && this.getView().getDomRef && this.getView().getDomRef()) || null;

                if (oRoot) {
                    const oOverlay = oRoot.querySelector && oRoot.querySelector("#cameraOverlay");
                    if (oOverlay) {
                        try {
                            const oCtx = oOverlay.getContext?.("2d");
                            oCtx && oCtx.clearRect(0, 0, oOverlay.width, oOverlay.height);
                        } catch (oErr) { }
                    }
                }

                this._oOffCanvas = null;
                this._aLastQuadVideoPx = null;
                this._oScanFx = null;

            } catch (oErr) { }

            return true;
        },

        /**
         * Orders the points of a quadrilateral in a specific order.
         * @param {Array} pts - The array of points to order.
         * @returns {Array} The ordered array of points.
         */
        handleOrderTLTRBRBL: function (aPts) {
            let oTL, oTR, oBR, oBL;
            const nCx = (aPts[0].x + aPts[1].x + aPts[2].x + aPts[3].x) / 4;
            const nCy = (aPts[0].y + aPts[1].y + aPts[2].y + aPts[3].y) / 4;

            for (const oP of aPts) {
                if (oP.x < nCx && oP.y < nCy) oTL = oP;
                else if (oP.x > nCx && oP.y < nCy) oTR = oP;
                else if (oP.x > nCx && oP.y > nCy) oBR = oP;
                else oBL = oP;
            }

            return (oTL && oTR && oBR && oBL) ? [oTL, oTR, oBR, oBL] : aPts;
        },

        /**
         * Warps the current frame to a quadrilateral.
         * @param {HTMLVideoElement} video - The video element to warp.
         * @param {Array} quadVideoPx - The array of points defining the quadrilateral.
         */
        handleWarp: async function (oVideo, aQuadVideoPx) {
            return handleWarpFromMedia.call(this, oVideo, aQuadVideoPx);
        },

        /**
         * Captures a frame from the given video element.
         * @param {HTMLVideoElement} video - The video element to capture a frame from.
         * @returns {string} The data URL of the captured frame.
         */
        handleCaptureFrame: function (oVideo) {
            const oCanvas = document.createElement("canvas");
            oCanvas.width = oVideo.videoWidth;
            oCanvas.height = oVideo.videoHeight;

            const oCtx = oCanvas.getContext("2d");
            oCtx.drawImage(oVideo, 0, 0, oCanvas.width, oCanvas.height);

            const sDataUrl = oCanvas.toDataURL("image/png");
            return sDataUrl;
        },

        /**
         * Maps the overlay coordinates to the media coordinates.
         * @param {HTMLCanvasElement} overlay - The overlay element.
         * @param {HTMLVideoElement | HTMLImageElement} media - The media element.
         * @returns {Object} An object containing the toMedia function and the drawArea object.
         */
        handleMapOverlayToMedia(oOverlay, oMedia) {
            const nElW = oOverlay.width, nElH = oOverlay.height;

            const bIsImg = oMedia.tagName === "IMG";
            const nMediaW = bIsImg ? oMedia.naturalWidth : oMedia.videoWidth;
            const nMediaH = bIsImg ? oMedia.naturalHeight : oMedia.videoHeight;

            const nScaleToFit = Math.min(nElW / nMediaW, nElH / nMediaH);
            const nDrawW = nMediaW * nScaleToFit, nDrawH = nMediaH * nScaleToFit;
            const nOffX = (nElW - nDrawW) / 2, nOffY = (nElH - nDrawH) / 2;

            return {
                toMedia: ({ x, y }) => {
                    const nX = (x - nOffX) / nScaleToFit;
                    const nY = (y - nOffY) / nScaleToFit;
                    return {
                        x: Math.max(0, Math.min(nMediaW - 1, nX)),
                        y: Math.max(0, Math.min(nMediaH - 1, nY))
                    };
                },
                drawArea: { offX: nOffX, offY: nOffY, drawW: nDrawW, drawH: nDrawH }
            };
        },

        /**
         * Enables the draw mode for the image.
         * @param {HTMLElement} root - The root element.
         */
        handleEnableDrawModeImage(oRoot) {
            const oImg = oRoot.querySelector("#cameraImage");
            const oOverlay = oRoot.querySelector("#cameraOverlay") || this.handleCreateOverlayCanvas(oImg);
            const oCtx = oOverlay.getContext("2d");

            this.handleStopLiveDetect?.();
            this.handleClearAutoDetectTimer?.();

            this._oDrawImg = {
                start: null,
                current: null,
                lastOverlayRect: null
            };

            oOverlay.style.pointerEvents = "auto";

            const sColorBorder = "rgba(255, 185, 100, 0.28)";
            const sColorFill = "rgba(255, 185, 100, 0.28)";
            const sColorGlow = "rgba(255, 200, 120, 0.55)";

            const fnDrawRect = (nX, nY, nW, nH, bClear = true) => {
                if (bClear) {
                    oCtx.clearRect(0, 0, oOverlay.width, oOverlay.height);
                }

                const nCx = nX + nW / 2, nCy = nY + nH / 2;
                const nR = Math.hypot(oOverlay.width, oOverlay.height) * 0.35;
                const oGrad = oCtx.createRadialGradient(nCx, nCy, 0, nCx, nCy, nR);

                oGrad.addColorStop(0.0, "rgba(255, 200, 140, 0.35)");
                oGrad.addColorStop(1.0, sColorFill);
                oCtx.fillStyle = oGrad;
                oCtx.fillRect(nX, nY, nW, nH);

                oCtx.lineWidth = 3;
                oCtx.strokeStyle = sColorBorder;
                oCtx.shadowColor = sColorGlow;
                oCtx.shadowBlur = 8;
                oCtx.strokeRect(nX, nY, nW, nH);
                oCtx.shadowBlur = 0;

                const aPts = [{ x: nX, y: nY }, { x: nX + nW, y: nY }, { x: nX + nW, y: nY + nH }, { x: nX, y: nY + nH }];
                oCtx.fillStyle = "rgba(255, 210, 150, 0.9)";
                for (const oP of aPts) {
                    oCtx.beginPath(); oCtx.arc(oP.x, oP.y, 4, 0, Math.PI * 2); oCtx.fill();
                }
            };

            const fnGetPos = (oEv) => {
                const oRect = oOverlay.getBoundingClientRect();

                const fnToX = (nClientX) => (nClientX - oRect.left) * (oOverlay.width / oRect.width);
                const fnToY = (nClientY) => (nClientY - oRect.top) * (oOverlay.height / oRect.height);

                if (oEv.touches && oEv.touches[0]) {
                    return { x: fnToX(oEv.touches[0].clientX), y: fnToY(oEv.touches[0].clientY) };
                }
                return { x: fnToX(oEv.clientX), y: fnToY(oEv.clientY) };
            };

            const fnStartDraw = (oEv) => {
                oEv.preventDefault();

                const oP = fnGetPos(oEv);
                this._oDrawImg.start = oP;
                this._oDrawImg.current = oP;

                this._oDrawImg.lastOverlayRect = null;
                this._aLastQuadImagePx = null;

                oCtx.clearRect(0, 0, oOverlay.width, oOverlay.height);
            };

            const fnMoveDraw = (oEv) => {
                if (!this._oDrawImg.start) return;

                this._oDrawImg.current = fnGetPos(oEv);

                const oA = this._oDrawImg.start, oB = this._oDrawImg.current;
                const nX = Math.min(oA.x, oB.x), nY = Math.min(oA.y, oB.y);
                const nW = Math.abs(oA.x - oB.x), nH = Math.abs(oA.y - oB.y);

                fnDrawRect(nX, nY, nW, nH, true);
            };

            const fnEndDraw = () => {
                if (!this._oDrawImg.start || !this._oDrawImg.current) return;

                const oA = this._oDrawImg.start, oB = this._oDrawImg.current;
                const nX = Math.min(oA.x, oB.x), nY = Math.min(oA.y, oB.y);
                const nW = Math.abs(oA.x - oB.x), nH = Math.abs(oA.y - oB.y);

                fnDrawRect(nX, nY, nW, nH, true);

                this._oDrawImg.lastOverlayRect = { x: nX, y: nY, w: nW, h: nH };

                const oMap = this.handleMapOverlayToMedia(oOverlay, oImg);

                const oTL = oMap.toMedia({ x: nX, y: nY });
                const oTR = oMap.toMedia({ x: nX + nW, y: nY });
                const oBR = oMap.toMedia({ x: nX + nW, y: nY + nH });
                const oBL = oMap.toMedia({ x: nX, y: nY + nH });

                const nPad = Math.max(6, Math.min(24, 0.06 * Math.min(oImg.naturalWidth, oImg.naturalHeight)));
                const fnInflate = (aPts, nPadPx, nWpx, nHpx) => {
                    const fnSignedAreaLocal = (pp) =>
                        (pp[0].x * pp[1].y - pp[1].x * pp[0].y +
                            pp[1].x * pp[2].y - pp[2].x * pp[1].y +
                            pp[2].x * pp[3].y - pp[3].x * pp[2].y +
                            pp[3].x * pp[0].y - pp[0].x * pp[3].y) / 2;

                    const bIsCCW = fnSignedAreaLocal(aPts) > 0;
                    const fnEdge = (p, q) => ({ x: q.x - p.x, y: q.y - p.y });
                    const fnNorm = (e) => { const nx = bIsCCW ? e.y : -e.y, ny = bIsCCW ? -e.x : e.x; const len = Math.hypot(nx, ny) || 1; return { x: nx / len, y: ny / len }; };
                    const fnCross = (a, b) => a.x * b.y - a.y * b.x;
                    const fnInter = (P, V, Q, W) => { const r = { x: Q.x - P.x, y: Q.y - P.y }; const d = fnCross(V, W); if (Math.abs(d) < 1e-6) return { x: (P.x + Q.x) / 2, y: (P.y + Q.y) / 2 }; const t = fnCross(r, W) / d; return { x: P.x + t * V.x, y: P.y + t * V.y }; };
                    const aLines = [];
                    for (let i = 0; i < 4; i++) {
                        const A = aPts[i], B = aPts[(i + 1) % 4];
                        const E = fnEdge(A, B), N = fnNorm(E);
                        aLines.push({ p: { x: A.x + N.x * nPadPx, y: A.y + N.y * nPadPx }, v: E });
                    }
                    const aOut = [];
                    for (let i = 0; i < 4; i++) {
                        aOut.push(fnInter(aLines[(i + 3) % 4].p, aLines[(i + 3) % 4].v, aLines[i].p, aLines[i].v));
                    }
                    return aOut.map(p => ({ x: Math.max(0, Math.min(nWpx - 1, p.x)), y: Math.max(0, Math.min(nHpx - 1, p.y)) }));
                };
                const aInflated = fnInflate([oTL, oTR, oBR, oBL], nPad, oImg.naturalWidth, oImg.naturalHeight);

                this._aLastQuadImagePx = aInflated;

                this._oDrawImg.start = null;
                this._oDrawImg.current = null;
            };

            oOverlay.addEventListener("mousedown", fnStartDraw);
            oOverlay.addEventListener("mousemove", fnMoveDraw);
            oOverlay.addEventListener("mouseup", fnEndDraw);

            oOverlay.addEventListener("touchstart", fnStartDraw, { passive: false });
            oOverlay.addEventListener("touchmove", fnMoveDraw, { passive: false });
            oOverlay.addEventListener("touchend", fnEndDraw);

            const fnRedrawLast = () => {
                if (!this._oDrawImg?.lastOverlayRect) return;
                const { x, y, w, h } = this._oDrawImg.lastOverlayRect;
                fnDrawRect(x, y, w, h, true);
            };

            try {
                new ResizeObserver(fnRedrawLast).observe(oOverlay);
            } catch (oErr) { }

            this._oDrawImg.cleanup = () => {
                oOverlay.style.pointerEvents = "none";
                oOverlay.removeEventListener("mousedown", fnStartDraw);
                oOverlay.removeEventListener("mousemove", fnMoveDraw);
                oOverlay.removeEventListener("mouseup", fnEndDraw);

                oOverlay.removeEventListener("touchstart", fnStartDraw);
                oOverlay.removeEventListener("touchmove", fnMoveDraw);
                oOverlay.removeEventListener("touchend", fnEndDraw);
            };
        },

        /**
         * Disables the draw mode for the image.
         * @param {HTMLElement} root - The root element.
         */
        handleDisableDrawModeImage(oRoot) {
            const oOverlay = oRoot.querySelector("#cameraOverlay");
            if (this._oDrawImg?.cleanup) {
                this._oDrawImg.cleanup();
            }

            this._oDrawImg = null;
            if (oOverlay) {
                const oCtx = oOverlay.getContext("2d");
                oCtx && oCtx.clearRect(0, 0, oOverlay.width, oOverlay.height);
            }
        },
    });

    return ScanUtil;
});
