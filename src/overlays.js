import WeavyUtils from './common/utils';
import WeavyPostal from './common/postal';

//console.debug("overlay.js");

/**
 * @class WeavyOverlay
 * @classdesc Class for handling panel overlays.
 */

/**
 * Class for handling panel overlays.
 * 
 * @constructor
 * @hideconstructor
 * @param {Weavy} weavy - Weavy instance
 */
var WeavyOverlays = function (weavy) {

    /**
     *  Reference to this instance
     *  @lends WeavyOverlay#
     */
    var weavyOverlays = this;

    var _overlays = new Map();

    var overlayClassNames = {
        modal: "weavy-modal",
        preview: "weavy-dark",
        overlay: "weavy-floating"
    }

    var overlayUrlRegex = {
        preview: /^(.*)(\/attachments\/[0-9]+\/?)(.+)?$/,
        content: /^(.*)(\/content\/[0-9]+\/?)(.+)?$/
    }


    this.overlay = function (overlayOptions) {
        // Copy all options
        overlayOptions = WeavyUtils.assign(overlayOptions);

        weavy.log("get overlay", overlayOptions);
        let overlayId = overlayOptions.overlayId || overlayOptions.type || "overlay";
        let overlay = _overlays.get(overlayId);

        if (!overlay) {
            let overlayUrl = new URL(overlayOptions.url, weavy.url);

            if (overlayOptions.type) {
                overlayOptions.className = overlayClassNames[overlayOptions.type] + (overlayOptions.className ? " " + overlayOptions.className : "");
            }

            overlay = weavy.nodes.panels.overlays.addPanel("overlay:" + overlayId, overlayUrl, overlayOptions);

            overlay.on("before:panel-open", function () {
                moveToFront(overlayId);
            });

            // Send styles to frame on ready and when styles are updated
            // TODO: Move this to panel?
            overlay.on("panel-ready root-styles", () => weavy.root.getStyles().then((styles) => {
                overlay.postMessage({ name: "styles", id: overlayId, css: styles, className: overlayOptions.className });
            }));

            _overlays.set(overlayId, overlay);
        } else {
            if (overlayOptions.title) {
                overlay.node.dataset.title = overlayOptions.title;
            } else {
                delete overlay.node.dataset.title;
            }
        }

        return overlay;
    }

    /**
     * Tries to move forward an overlay panel
     * 
     * @property {string} overlayId - The id of the panel to focus;
     */
    function moveToFront(overlayId) {
        var overlay = _overlays.get(overlayId)
        if (overlay) {
            weavy.debug("preview panels moveToFront", overlayId);

            _overlays.delete(overlayId);
            _overlays.set(overlayId, overlay);

            requestAnimationFrame(sortOverlays);
        }
    }

    function sortOverlays() {
        weavy.debug("sorting overlays", Array.from(_overlays.values()).filter((overlay) => overlay.isOpen).reverse());
        Array.from(_overlays.values()).filter((overlay) => overlay.isOpen).reverse().forEach((overlay, i) => {
            if (overlay.node) {
                overlay.node.style.transform = "translateZ(-" + i + "rem)";
            }
        });
    }

    /**
     * Tries to focus an overlay panel
     * 
     * @param {Object} open - Object with panel data
     * @property {string} open.panelId - The id of the panel to focus;
     */
    function focus(overlay) {
        weavy.log("overlay panels focus", overlay?.panelId, Array.from(_overlays.values()));
        overlay = overlay || getTopOverlay();

        if (overlay) {
            try {
                overlay.frame.contentWindow.focus();
            } catch (e) {
                overlay.frame.focus();
            }
        }
    }

    function reset(overlay) {
        if (overlay.isOpen) {
            overlay.loadingStarted(true);
        } else {
            overlay.reset();
        }
    }

    function getTopOverlay() {
        return Array.from(_overlays.values()).filter((overlay) => overlay.isOpen).pop();
    }

    // Layer open
    weavy.on(WeavyPostal, "overlay-open", weavy.getId(), function (e, overlayOptions) {
        var overlayUrl = new URL(overlayOptions.url, weavy.url).href;
        overlayOptions.url = overlayUrl;
        overlayOptions.overlayId = overlayOptions.overlayId || overlayOptions.type || overlayOptions.weavyMessageId || "overlay";

        weavy.log("overlay-open", overlayOptions);

        var overlay = weavyOverlays.overlay(overlayOptions, true);

        var openUrl;

        if (overlay.location && overlay.location !== overlayOptions.url) {
            reset(overlay);
        }
        openUrl = overlayOptions.url;
        overlay.open(openUrl).then(focus);
    });

    weavy.on("before:build", function () {

        if (!weavy.nodes.panels.overlays) {
            /**
             * Preview panel container. Attached to {@link Weavy#nodes#global}.
             * 
             * @type {WeavyPanels~container}
             * @category panels
             * @name Weavy#nodes#panels#overlays
             **/
            weavy.nodes.panels.overlays = weavy.panels.createContainer();
            weavy.nodes.panels.overlays.node.classList.add("weavy-overlays"); // TODO: change name
            weavy.nodes.global.appendChild(weavy.nodes.panels.overlays.node);
        }
    });


    weavy.on("after:panel-close", function (e, close) {
        if (close.panels === weavy.nodes.panels.overlays) {
            var overlayId = close.panelId.split("overlay:")[1];
            var panel = _overlays.get(overlayId);

            // TODO: Garbage cleanup needed instead

            //_overlays.delete(overlayId);
            weavy.log("overlay panel after:close", close.panelId, overlayId);

            if (panel) {
                //panel.close().then(() => panel.remove());
            }

            sortOverlays();
            focus();
        }
    });


    /**
     * Opens a url in an overlay panel. If the url is an attachment url it will open in the preview panel.
     * 
     * @param {string} url - The url to the overlay page to open
     */
    this.open = function (request) {
        return weavy.whenLoaded().then(function () {
            var url = request.url;
            var overlayType = request.target || "overlay";


            if (overlayType === "overlay" && overlayUrlRegex.preview.test(url)) {
                overlayType = "preview";
            }

            var overlay = weavyOverlays.overlay({ type: overlayType, url: url });

            if (request.source && request.source !== overlay.frame.name) {
                reset(overlay);
            }
            return overlay.open(url).then(focus);

        });
    }

    /**
     * Opens a url in an overlay panel. If the url is an attachment url it will open in the preview panel.
     * 
     * @param {WeavyHistory~panelState} panelState - The url to the overlay page to open
     */
    this.openState = function (panelState) {
        return weavy.whenLoaded().then(function () {
            let panelAttributes = WeavyUtils.assign(panelState.attributes, { title: panelState.title })
            let overlay = weavyOverlays.overlay(panelAttributes);
            overlay.setState(panelState).then(focus);
        });
    }

    /**
     * Closes all open overlay panels.
     * @param {boolean} noHistory - Set to true if you want no navigation history generated when closing
     **/
    this.closeAll = function (noHistory) {
        return weavy.whenLoaded().then(function () {
            let closedOverlays = Array.from(_overlays.values()).map((overlay) => {
                return overlay.close(noHistory);
            });
            return Promise.all(closedOverlays);
        });
    }

    // Keyboard handling

    /**
     * Requests the topmost open panel to make a prev navigation
     * @param {Event} e
     */
    function handleKey(which) {
        var topOverlay = getTopOverlay();

        if (topOverlay) {
            if (which === 27) { // Esc
                topOverlay.close();
                return true;
            } else {
                topOverlay.postMessage({ name: "key:trigger", which: which });
                return true;
            }
        }
    }

    /**
     * Recieves a prev request from a panel and sends it to the topmost open preview panel.
     **/
    weavy.on(WeavyPostal, "key:press", weavy.getId(), function (e, key) {
        weavy.log("bouncing key", key.which, getTopOverlay()?.panelId);
        handleKey(key.which);
    });

    weavy.on(document, "keyup", function (e) {
        if (handleKey(e.which)) {
            e.stopImmediatePropagation();
        }
    })
};

export default WeavyOverlays;

