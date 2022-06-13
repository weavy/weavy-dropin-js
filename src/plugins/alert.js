import Weavy from '../weavy';

/**
 * Plugin for displaying alert messages.
 * 
 * @mixin AlertPlugin
 * @param {Weavy} weavy - The Eeavy instance
 * @param {Object} options - Plugin options
 * @returns {Weavy.plugins.alert}
 * @property {AlertPlugin#alert} .alert()
 * @typicalname weavy
 */
class AlertPlugin {
    constructor(weavy, options) {
        var _addMessages = [];

        function displayMessage(message, sticky) {
            if (!sticky) {
                weavy.whenTimeout(5000).then(function () {
                    message.classList.remove(weavy.getPrefix("in"));
                });
                weavy.whenTimeout(5200).then(function () {
                    message.remove();
                });
            }
            weavy.whenTimeout(1).then(function () {
                message.classList.add(weavy.getPrefix("in"));
            });
            weavy.nodes.global.appendChild(message);
        }

        /**
         * Displays an alert.
         *
         * @example
         * weavy.alert("Weavy is awesome!", true);
         *
         * @param {string} message - The message to display
         * @param {boolean} [sticky=false] - Should the alert be sticky and not dismissable?
         */
        this.alert = weavy.alert = function (message, sticky) {
            var alertMessage = document.createElement("div");
            alertMessage.className = weavy.getPrefix(options.className);
            if (message instanceof HTMLElement) {
                alertMessage.appendChild(message);
            } else {
                alertMessage.innerHTML = message;
            }

            if (weavy.nodes.global) {
                displayMessage(alertMessage, sticky);
            } else {
                _addMessages.push([alertMessage, sticky]);
            }
            weavy.log("Alert\n" + alertMessage.innerText);

            return alertMessage;
        };

        weavy.on("after:build", function () {
            _addMessages.forEach(function (alertMessage) {
                displayMessage.apply(weavy, alertMessage);
            });
            _addMessages = [];
        });
    }
}

/**
 * Default plugin options
 * 
 * @example
 * Weavy.plugins.alert.defaults = {
 *     className: "alert-message fade in"
 * };
 * 
 * @name defaults
 * @memberof AlertPlugin
 * @type {Object}
 * @property {string} [className=alert-message fade in] - Default classes for the alerts
 */
AlertPlugin.defaults = {
    className: "alert-message fade"
};

Weavy.plugins.alert = AlertPlugin;
export default AlertPlugin;
