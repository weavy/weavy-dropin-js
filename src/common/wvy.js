/* eslint-env commonjs, amd */

// UMD based on https://github.com/umdjs/umd/blob/master/templates/returnExports.js
// TODO: move to ES6 and transpiler

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        // AMD. Register as an anonymous module.
        define([], factory);
    } else if (typeof module === 'object' && module.exports) {
        // Node. Does not work with strict CommonJS, but
        // only CommonJS-like environments that support module.exports,
        // like Node.
        module.exports = factory();
    } else {
        // Browser globals (root is window)
        root.wvy = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    //console.debug("wvy.js", window.name);

    /**
     * Module wrappper for wvy namespace
     * 
     * @module wvy
     * @returns {Object}
     */

    let root = self !== undefined ? self : window;
    let wvy = root.wvy || {};

    /**
     * Translation retriever. 
     * Gets any translated string or returns the original string if translation is not present.
     * 
     * Note: Translations are stored in window.wvy and not in root scope.
     * 
     * @param {string} key - The string to translate.
     */
    wvy.t = function (key) {
        var text = window.wvy && window.wvy.resources !== null ? window.wvy.resources[key] : key;
        return text || key;
    }

    /**
     * Session Storage wrapper for settings. Makes the settings shared between windows.
     * Fallbacks to variable if local storage is unavailable.
     * 
     * @example
     * // Always update/add settings using assignment of a whole object, otherwise nothing will happen.
     * wvy.settings = { "mysetting": 4 };
     * 
     * // Make sure to always use wvy.settings.dotnotation to always get the current value.
     * console.log(wvy.settings.mysetting)
     **/
    Object.defineProperty(wvy, "settings", {
        get: function () {
            return wvy.utils.retrieveItem("wvy.settings", true, 'sessionStorage');
        },
        set: function (obj) {
            if (!wvy.utils.isPlainObject(obj)) {
                throw new Error("Invalid settings object");
            }

            let previousObj = wvy.utils.retrieveItem("wvy.settings", true, 'sessionStorage');

            if (previousObj) {
                obj = wvy.utils.assign(previousObj, obj);
            }

            wvy.utils.storeItem("wvy.settings", obj, true, 'sessionStorage');
        }
    })

    return wvy;
}));
