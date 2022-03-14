import WeavyUtils from './common/utils';
import WeavyPromise from './common/promise';

//console.debug("app.js");

/**
 * @class WeavyApp
 * @classdesc Base class for representation of apps in Weavy.
 * @example
 * var app = weavy.app({ id: "myapp1", type: "posts" });
 */

/**
 * This class is automatically instantiated when defining apps in weavy. 
 * All the methods and properties are accessible in each instance. 
 * The passed options will fetch the app or create it.
 * 
 * @constructor
 * @hideconstructor
 * @param {Weavy} weavy - Weavy instance the app belongs to
 * @param {WeavyApp#options} options - App options
 * @param {Object} [data] - Initial data belonging to the app
 */
var WeavyApp = function (weavy, options, data) {

  weavy.debug("new WeavyApp", options);

  const appUrl = "/dropin/client/app";

  /** 
   * Reference to this instance
   * @lends WeavyApp#
   */
  var app = this;

  /** 
   * The container passed in from {@link WeavyApp#options}.
   * @category properties
   * @type {Element|jQuery|string}
   */
  app.container = null;

  /** 
   * The root object for the container of the app. 
   * @category properties
   * @type {Object}
   * @property {Element} container - The inner container to put nodes in.
   * @property {string} id - The id of the root
   * @property {Element} parent - The element defined in options to contain the app.
   * @property {ShadowRoot} root - The isolated ShadowRoot in the section.
   * @property {Element} section - The &lt;weavy&gt;-section within the parent.
   * @property {Function} remove() - Method for removing the root from the DOM.
   */
  app.root = null;

  /** 
   * The Panel displaying the app.
   * @category properties
   * @type {WeavyPanels~panel}
   */
  app.panel = null;

  /**
   * The url of the app, received from app data.
   * @category properties
   * @type {string}
   */
  app.url = null;

  /**
   * The id of the app, defined in options.
   * @category properties
   * @type {string}
   */
  app.id = null;

  /**
   * The server appId of the app, recieved from app data.
   * @category properties
   * @type {string}
   */
  app.appId = null;

  /**
   * The name of the app, defined in options or received from app data.
   * @category properties
   * @type {string}
   */
  app.name = null;


  /** 
   * The short readable type of the app, such as "files".
   * @category properties
   * @type {string}
   */
  app.type = null;

  /** 
   * Will the app open automatically when loaded? Defaults to true. 
   * @see WeavyApp#options
   * @category properties
   * @type {boolean}
   */
  app.autoOpen = null;

  /**
   * The {@link Weavy} instance the app belongs to.
   * @category properties
   * @type {Weavy}
   */
  app.weavy = weavy;

  /**
   * Options for defining the app. Id and type is required.
   * 
   * @example
   * weavy.app({
   *   id: "myid",
   *   name: "Posts",
   *   type: "posts",
   *   container: "#myappcontainer",
   *   open: false,
   *   controls: true
   * });
   * 
   * @category options
   * @typedef
   * @member
   * @type {Object}
   * @property {string} id - The id representing the app in the context environment.
   * @property {string} name - The display name of the app.
   * @property {Element|jQuery|string} container - The container where the app should be placed.
   * @property {string} type - The kind of app. <br> • posts <br> • files <br> • messenger <br> • notifications <br> • comments <br> • chat
   * @property {boolean} controls - Show or hide the panel controls. Defaults to false.
   */
  app.options = options;

  /**
   * The server data for the app.
   * 
   * @example
   * {
   *   id: "files",
   *   url: "/e/apps/2136",
   *   type: "files"
   * }
   * 
   * @category properties
   * @typedef
   * @member
   * @type {Object}
   * @property {string} id - The id for the app.
   * @property {string} url - The base url to the app.
   * @property {string} type - The type of the app.
   */
  app.data = data;

  // EVENT HANDLERS

  /** 
   * The parent which the events bubbles to.
   * @category eventhandling
   * @type {Weavy}
   * @ignore
   */
  app.eventParent = weavy;

  /**
   * Event listener registration for the specific app. Only recieves events that belong to the app.
   * 
   * @category eventhandling
   * @function
   * @example
   * weavy.app("myapp").on("open", function(e) { ... })
   */
  app.on = weavy.events.on.bind(app);

  /**
   * One time event listener registration for the specific app. Is only triggered once and only recieves events that belong to the app.
   *
   * @category eventhandling
   * @function
   * @example
   * weavy.app("myapp").one("open", function(e) { ... })
   */
  app.one = weavy.events.one.bind(app);

  /**
   * Event listener unregistration for the specific app.
   * 
   * @category eventhandling
   * @function
   * @example
   * weavy.app("myapp").off("open", function(e) { ... })
   */
  app.off = weavy.events.off.bind(app);

  /**
   * Triggers events on the specific app. The events will also bubble up to the space and then the weavy instance.
   *
   * @category eventhandling
   * @function
   * @example
   * weavy.app("myapp").triggerEvent("myevent", [eventData])
   */
  app.triggerEvent = function (name, data) {
    data = WeavyUtils.assign(data, { app: app });
    return weavy.events.triggerEvent.call(app, name, data);
  }

  /** 
   * Is the app currently open? Returns the open status of the app panel.
   * @category properties
   * @member isOpen
   * @memberof WeavyApp#
   * @type {boolean}
   */
  Object.defineProperty(this, "isOpen", {
    get: function () {
      return app.panel ? app.panel.isOpen : false;
    }
  });

  /**
   * Has the app initialized on the server?
   * @category properties
   * @type {boolean}
   */
  app.isInitialized = false;

  /**
   * Is the app built? 
   * @category properties
   * @type {boolean}
   */
  app.isBuilt = false;

  /**
   * Has the app loaded?
   * @category properties
   * @type {boolean}
   */
  Object.defineProperty(this, "isLoaded", {
    get: function () {
      return app.panel ? app.panel.isReady : false;
    }
  });

  /**
   * Promise that resolves when the app has been initialized on the server.
   * 
   * @category promises
   * @type {WeavyPromise}
   */
  app.whenInitialized = new WeavyPromise();

  /**
   * Promise that resolves when the app is built.
   * 
   * @category promises
   * @type {WeavyPromise}
   */
  app.whenBuilt = new WeavyPromise();

  /**
   * Promise that resolves when the app is loaded and ready.
   * 
   * @category promises
   * @type {WeavyPromise}
   */
  app.whenLoaded = new WeavyPromise();

  /**
   * Configure the app with options or data. If the app has data it will also be built. 
   * Currently existing options are extended with new options.
   * Data will resolve {@link WeavyApp#whenInitialized} promise.
   * 
   * @category methods
   * @function
   * @param {WeavyApp#options} options
   * @param {WeavyApp#data} data
   * @resolves {WeavyApp#whenInitialized}
   */
  app.configure = function (options, data) {
    if (options && typeof options === "object") {
      app.options = WeavyUtils.assign(app.options, options, true);
    }

    if (data && typeof data === "object") {
      app.data = data;
    }

    if (app.options && typeof app.options === "object") {
      if (app.autoOpen === null || app.container === null) {
        app.autoOpen = app.options && app.options.open !== undefined ? app.options.open : (!app.group || false);
        app.container = app.options.container;
      }

      if (app.id === null && app.options.id) {
        app.id = app.options.id;
      }

      if (app.name === null && app.options.name) {
        app.name = app.options.name;
      }

      if (app.type === null && app.options.type) {
        app.type = app.options.type;
      }
    }

    if (app.data && typeof app.data === "object") {

      if (!app.id && app.data.id) {
        app.id = app.data.id;
      }

      if (app.appId === null && app.data.appId) {
        app.appId = app.data.appId;
      }

      app.url = app.data.url;

      app.isInitialized = true;

      /**
       * Triggered when the app data has been fetched from the server.
       * 
       * @category events
       * @event WeavyApp#app-load
       * @returns {Object}
       * @property {WeavyApp} app - The app that fires the event
       */
      app.triggerEvent("app-init");

      app.whenInitialized.resolve(app);

      if (!app.isBuilt && app.weavy.isBuilt) {
        app.build();
      }
    }
  }


  /**
   * Sets options and fetches (or creates) the app on the server. Options will replace existing options.
   * When data is fetched, the {@link WeavyApp#whenInitialized} promise is resolved.
   * 
   * @category methods
   * @function
   * @param {WeavyApp#options} [options] - Optional new app options
   * @returns {WeavyApp#whenInitialized}
   * @resolves {WeavyApp#whenInitialized}
   */
  app.fetchOrCreate = function (options) {
    if (options && typeof options === "object") {
      app.options = options;
    }

    if (app.options && typeof app.options === "object") {

      var initAppUrl = new URL(appUrl, weavy.url);

      weavy.ajax(initAppUrl, app.options, "POST").then(function (data) {
        app.data = data;
        app.configure.call(app);
      }).catch(function (error) {
        app.weavy.error("WeavyApp.fetchOrCreate()", error.message);
        app.whenInitialized.reject(error);
      });
    } else {
      app.whenInitialized.reject(new Error("WeavyApp.fetchOrCreate() requires options"));
    }

    return app.whenInitialized();
  }

  /**
   * Builds the app. Creates a shadow root and a panel. Is executed on the {@link Weavy#event:build} event.
   * 
   * @category methods
   * @function
   * @resolves {WeavyApp#whenBuilt}
   */
  app.build = function () {
    weavy.authentication.whenAuthorized().then(function () {

      if (app.options && app.data) {
        let appRootId = "app-root-" + (app.options.group || app.id);
        var root = app.root ??= weavy.getRoot(appRootId);
        if (!root && app.container) {
          try {
            app.root = root = weavy.createRoot(app.container, appRootId, app);

            root.apps = new Set();

            root.container.panels = weavy.panels.createContainer("app-container-" + app.id);
            root.container.panels.eventParent = app;
            root.container.appendChild(root.container.panels.node);
          } catch (e) {
            weavy.warn("could not create app in container", { id: app.id }, e);
          }
        }

        if (!app.isBuilt && root) {
          app.isBuilt = true;
          weavy.debug("Building app", app.id);

          var panelId = "app-" + app.id;
          var controls = app.options && app.options.controls !== undefined ? app.options.controls : false;

          let whenStylesLoaded = app.root.addStyles(app.options);

          app.panel = root.container.panels.addPanel(panelId, app.url, { controls: controls });

          root.apps.add(app);

          /**
           * Triggered when the app panel is opened.
           * 
           * @category events
           * @event WeavyApp#app-open
           * @returns {Object}
           * @property {WeavyApp} app - The app that fires the event
           * @extends WeavyPanel#event:panel-open
           */
          app.panel.on("panel-open", (e, data) => app.triggerEvent("app-open", data));

          /**
           * Triggered when the app panel is toggled. Is always followed by either {@link WeavyApp#event:open} event or {@link WeavyApp#event:close} event.
           * 
           * @category events
           * @event WeavyApp#app-toggle
           * @returns {Object}
           * @property {WeavyApp} app - The app that fires the event
           * @extends WeavyPanel#event:panel-toggle
           */
          app.panel.on("panel-toggle", (e, data) => app.triggerEvent("app-toggle", data));

          /**
           * Triggered when the app panel is closed.
           * 
           * @category events
           * @event WeavyApp#app-close
           * @returns {Object}
           * @property {WeavyApp} app - The app that fires the event
           * @extends WeavyPanel#event:panel-close
           */
          app.panel.on("panel-close", (e, data) => app.triggerEvent("app-close", data));

          /**
           * Triggered when the app receives a postMessage sent from the panel frame.
           * 
           * @category events
           * @event WeavyApp#message
           * @returns {Object}
           * @property {WeavyApp} app - The app that fires the event
           * @extends WeavyPanels#event:message
           */
          app.on("before:message", (e, message) => {
            if (message.panelId === panelId) {
              return WeavyUtils.assign(message, { app: app });
            }
          });

          app.panel.whenReady().then(() => {
            /**
             * Triggered when the app has loaded it's contents.
             * 
             * @category events
             * @event WeavyApp#app-load
             * @returns {Object}
             * @property {WeavyApp} app - The app that fires the event
             */
            app.triggerEvent("app-load");

            app.whenLoaded.resolve(app);
          })

          // Send styles to frame on ready and when styles are updated
          app.on("panel-ready root-styles", () => app.root.getStyles().then((styles) => {
            app.postMessage({ name: "styles", id: app.id, css: styles, className: options.className });
          }));

          whenStylesLoaded.then((styles) => {
            /**
             * Triggered when the app panel is built.
             * 
             * @category events
             * @event WeavyApp#app-build
             * @returns {Object}
             * @property {WeavyApp} app - The app that fires the event
             */
            app.triggerEvent("app-build");

            app.whenBuilt.resolve(app);
          })
        }
      }

    })
    return app.whenBuilt();
  };

  weavy.on("build", app.build.bind(app));

  // Opens the app automatically after build
  app.whenBuilt().then(function () {
    weavy.whenReady().then(function () {
      if (app.autoOpen && !app.isOpen) {
        app.open.call(app, null, true);
      }
    });
  });

  weavy.on("after:signed-in", function () {
    weavy.whenReady().then(function () {
      if (app.autoOpen && !app.isOpen) {
        // Reopen on sign in
        app.open.call(app, null, true);
      }
    });
  });

  app.configure();
};

/**
 * Opens the app panel and optionally loads a destination url after waiting for {@link WeavyApp#whenBuilt}.
 * If the root contains multiple apps it also closes the other apps in the root.
 * 
 * @category panel
 * @function WeavyApp#open
 * @param {string} [destination] - Destination url to navigate to on open
 * @returns {Promise}
 */
WeavyApp.prototype.open = function (destination, noHistory) {
  var app = this;
  var weavy = app.weavy;
  var whenInitializedAndBuilt = Promise.all([app.whenBuilt(), weavy.whenInitialized()]);
  return whenInitializedAndBuilt.then(function () {
    var openPromises = [app.panel.open(destination, noHistory)];

    // Sibling apps should be closed if the app is grouped
    let rootApps = Array.from(app.root && app.root.apps || []);
    if (rootApps.length > 1) {
      rootApps.forEach(function (groupApp) {
        if (groupApp !== app) {
          openPromises.push(groupApp.panel.close(true));
        }
      });
    }

    return Promise.all(openPromises).catch(function (reason) {
      weavy.warn("Could not open app", app.id, reason);
    });
  }, function (reason) {
    weavy.warn("Could not open app", app.id, reason);
  });
}

/**
 * Closes the app panel.
 * 
 * @category panel
 * @function WeavyApp#close
 * @returns {Promise}
 * */
WeavyApp.prototype.close = function () {
  var app = this;
  app.autoOpen = false;
  return app.whenBuilt().then(function () {
    return app.panel.close();
  });
}

/**
 * Toggles the app panel open or closed. It optionally loads a destination url on toggle open.
 * If the space is {@link WeavySpace#tabbed} it also closes the other apps in the space.
 * 
 * @category panel
 * @function WeavyApp#toggle
 * @param {string} [destination] - Destination url to navigate to on open
 * @returns {Promise}
 */
WeavyApp.prototype.toggle = function (destination) {
  var app = this;
  var weavy = app.weavy;

  return app.whenBuilt().then(function () {
    var togglePromises = [app.panel.toggle(destination)];

    // Sibling apps should be closed if app is grouped
    let rootApps = Array.from(app.root && app.root.apps || []);
    
    if (!app.isOpen && rootApps.length > 1) {
      rootApps.forEach(function (groupApp) {
        if (groupApp !== app) {          
          togglePromises.push(groupApp.panel.close(true, true));
        }
      });
    }

    return Promise.all(togglePromises).catch(function (reason) {
      weavy.warn("Could not toggle app", app.id, reason);
    });
  });
}

/**
 * Resets the app panel.
 * 
 * @category panel
 * @function WeavyApp#reset
 * @returns {Promise}
 * */
WeavyApp.prototype.reset = function () {
  var app = this;
  var weavy = app.weavy;
  var whenBuiltAndReady = Promise.all([app.whenBuilt(), weavy.whenReady()]);
  return whenBuiltAndReady.then(function () {
    return app.panel.reset();
  });
}

/**
 * Removes the app in the client and the DOM. The app will not be removed on the server and can be added and fetched at any point again.
 * 
 * @category methods
 * @function WeavyApp#remove
 * @returns {Promise}
 */
WeavyApp.prototype.remove = function () {
  var app = this;
  var weavy = this.weavy;

  weavy.debug("Removing app", app.id);

  var whenPanelRemoved = app.panel ? app.panel.remove(null, true) : Promise.resolve();

  var whenRemoved = whenPanelRemoved.then(function () {
    if ('getRoot' in weavy) {
      let appRootId = "app-root-" + (app.options.group || app.id);
      var appRoot = weavy.getRoot(appRootId);

      if (appRoot && appRoot.apps.size === 0) {
        appRoot.remove();
      }
    }
  });

  app.root.apps.remove(app);

  weavy.apps = weavy.apps.filter(function (a) { return !a.match(app) });

  return whenRemoved;
}

/**
 * Sends postMessage to the app panel frame. 
 * Returns a promise that is resolved when the message has been delivered and rejected if the message fails or has timed out.
 * 
 * @category panel
 * @function WeavyApp#postMessage
 * @param {object} message - The Message to send
 * @param {Transferable[]} [transfer] - A sequence of Transferable objects that are transferred with the message.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage}
 * @returns {Promise}
 * */
WeavyApp.prototype.postMessage = function (message, transfer) {
  var app = this;
  return app.whenBuilt().then(function () {
    return app.panel.postMessage(message, transfer);
  });
}


/**
 * Check if another app or an object is matching this app. It checks for a match of the id property or the server appId property.
 * 
 * @category methods
 * @function WeavyApp#match
 * @param {WeavyApp|Object} options
 * @param {int} [options.id] - Optional id to match.
 * @param {string} [options.appId] - Optional appId to match.
 * @returns {boolean} 
 */
WeavyApp.prototype.match = function (options) {
  if (options) {
    if (options.id && this.id) {
      return WeavyUtils.eqString(options.id, this.id);
    }

    if (options.appId && this.appId) {
      return options.appId === this.appId;
    }
  }

  return false;
};

/**
 * Check if another app or an object is matching this app. It checks for a match of the id property or the server appId property.
 * 
 * @category methods
 * @function WeavyApp#addStyles
 * @param {string|Object} styles - CSS string or styles object
 * @param {string} [styles.css] - Optional css to add.
 * @param {string} [styles.stylesheet] - Optional stylesheet url to load.
 * @returns {boolean} 
 */
 WeavyApp.prototype.addStyles = function (styles) {
  var css, stylesheet;

  if (typeof styles === "string") {
    css = styles;
  } else if (WeavyUtils.isPlainObject(styles)) {
    css = styles.css;
    stylesheet = styles.stylesheet;
  }

  return this.whenBuilt.then(() => {
    return this.root.addStyles({css, stylesheet});
  });
};
/**
 * Function for making an id/object in to an app definition object
 * 
 * @function WeavyApp.getAppSelector
 * @param {string|WeavyApp#options} options - The id/object to parse
 * @returns {Object} appSelector
 * @returns {boolean} appSelector.isId - Is appOptions parsed as a id (string)?
 * @returns {boolean} appSelector.isAppId - Is appOptions parsed as a server appId (int)?
 * @returns {boolean} appSelector.isConfig - Is AppOptions parsed as an app definition (Object)?
 * @returns {Object} appSelector.selector - App definition object
 */
WeavyApp.getAppSelector = (options) => {
  var isId = typeof options === "string";
  var isAppId = Number.isInteger(options);
  var isConfig = WeavyUtils.isPlainObject(options);

  var selector = isConfig && options || isId && { id: options } || isAppId && { appId: options };

  if (!selector) {
    if ('id' in options) {
      selector = { id: options.id };
    } else if ('appId' in options) {
      selector = { appId: options.appId };
    }
  }

  return { isId: isId, isAppId: isAppId, isConfig: isConfig, selector: selector };
}

export default WeavyApp;
