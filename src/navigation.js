import WeavyPromise from './common/promise';
import WeavyUtils from './common/utils';
import WeavyPostal from './common/postal';

//console.debug("navigation.js");

/**
 * @class WeavyNavigation
 * @classdesc Class for handling internal/external navigation
 */

/**
 * Class for handling internal/external navigation.
 * 
 * @constructor
 * @hideconstructor
 * @param {Weavy} weavy - Weavy instance
 */
var WeavyNavigation = function (weavy) {
  /**
   *  Reference to this instance
   *  @lends WeavyNavigation#
   */
  var weavyNavigation = this;

  /**
   * Tries to open a navigation request.
   * 
   * @param {WeavyNavigation~navigationRequest} request - The navigation request object to open
   * @returns {Promise}
   * @resolved When the request successfully is opened
   * @rejected When the request can't be opened
   */
  function openRequest(request) {
    var whenOpened = new WeavyPromise();
    if (request.target) {
      weavy.log("navigation: opening overlay " + request.url);
      weavy.overlays.open(request).then((open) => {
        whenOpened.resolve(open);
      });
    } else {

      if (request.app && (request.app.id || request.app.appId)) {

        weavy.whenLoaded().then(function () {
          var openApp = weavy.app(request.app.id || request.app.appId);

          if (openApp) {
            weavy.overlays.closeAll(true);

            openApp.open(request.url).then(function (open) {
              whenOpened.resolve(open);
            });
          } else {
            weavy.info("navigation: requested app was not found");
            whenOpened.reject();
          }
        });
      } else {
        weavy.warn("navigation: url was not resolved to an app");
        whenOpened.reject();
      }
    }

    return whenOpened();
  }

  /**
   * Try to open an url in the app where it belongs. 
   * Automatically finds out where to open the url via a server call unless routing data is directly provided in a {@link WeavyNavigation~navigationRequest} object.
   * 
   * @param {string|WeavyNavigation~navigationRequest} request - String Url or a {@link WeavyNavigation~navigationRequest} object with route data.
   * @returns {Promise}
   * @resolved When the request successfully is opened
   * @rejected When the request can't be opened
   */
  weavyNavigation.open = function (request) {
    var isNavigationRequest = WeavyUtils.isPlainObject(request) && request.url;
    var isUrl = !request.app && !request.target && (typeof request === "string" && request || isNavigationRequest);
    var requestString = String(isUrl || isNavigationRequest);
    var isWeavyUrl = requestString.includes("wvy:");

    if (isWeavyUrl) {
      weavy.log("checking weavy url");
      var weavyUrls = requestString;
      var requestUrl = new URL(requestString, weavy.url);
      var requestHash = requestUrl && requestUrl.hash && requestUrl.hash.replace(/^#/, '');

      if (requestHash && requestHash.startsWith("wvy:")) {
        weavyUrls = requestUrl.hash.replace(/^#/, '').split(',');
      }
      return weavy.history.open(weavyUrls);
    } else if (isUrl) {
      weavy.log("checking url using click");
      var checkUrl;

      try {
        checkUrl = new URL(requestString, weavy.url)
      } catch (e) {
        weavy.error("Could not parse navigation request url");
      }

      if (checkUrl) {
        let pathSegments = checkUrl.pathname.split("/").filter((x) => x);
        if (pathSegments[0] === "dropin") {
          let [appType, appId, appSegment] = pathSegments.slice(1);

          appId = parseInt(appId);

          weavy.debug("Opening url parsed navigation request", appType, appId, appSegment)

          return openRequest({ url: requestString, app: { appId: appId } })
        }
      }

      //return weavy.ajax("/dropin/client/click?url=" + encodeURIComponent(requestString) + "&embedded=true").then(openRequest);
    } else if (isNavigationRequest) {
      weavy.log("open navigation request", request)
      return openRequest(request);
    }
    return WeavyPromise.reject();
  };


  weavy.on(WeavyPostal, "navigation-open", weavy.getId(), function (e) {
    let route = typeof e.data.route === "string" ? { url: e.data.route } : e.data.route;
    weavy.log("navigation-open", route)

    /**
     * Navigation event triggered when a page should be opened in another space or app.
     * 
     * @category events
     * @event WeavyNavigation#navigate
     * @property {WeavyNavigation~navigationRequest} route - Data about the requested navigation
     * 
     */
    route = weavy.triggerEvent("before:navigate", route);
    route.source = e.data.windowName;

    if (route !== false) {
      weavy.info("navigate: trying internal auto navigation");
      weavyNavigation.open(route).catch(function () {
        // Only trigger on: and after: if .open was unsuccessful
        route = weavy.triggerEvent("on:navigate", route);
        if (route !== false) {
          weavy.triggerEvent("after:navigate", route);
        }
      });
    }
  })


};

export default WeavyNavigation;


/**
 * The data for a navigation request. Some of the data is provided from the server just as meta data. It's received through the {@link WeavyNavigation#event:navigate} event and can be passed into the {@link WeavyNavigation#open} method.
 *
 * @example
 * var navigationRoute = {
 *   "entity": {
 *     "id": 203,
 *     "type": "content"
 *   },
 *   "app": {
 *     "id": 2149,
 *     "key": "files",
 *     "name": "Files"
 *   },
 *   "target": "overlay",
 *   "url": "/dropin/content/203"
 * };
 *
 * @typedef WeavyNavigation~navigationRequest
 * @type Object
 * @property {Object} app
 * @property {int} app.id - The server generated id for the app
 * @property {string} app.key - The key identifier for the app
 * @property {string} [app.name] - The name of the app
 * @property {Object} entity
 * @property {int} entity.id - The server generated id for the item
 * @property {string} [entity.type] - The type of the item
 * @property {string} url - The url to open
 * @property {string} [target] - Recommended target to open the url in, for instance "overlay", which may oven the preview overlay.
 */

