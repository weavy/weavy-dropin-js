import WeavyUtils from './utils/utils';
import WeavyPromise from './utils/promise';
import WeavyConsole from './utils/console';
import WeavyPostal from './utils/postal';
import WeavyEvents from './utils/events';

import wvy from './utils/wvy';

const ssoUrl = "/dropin/client/login";
const signOutUrl = "/dropin/client/logout";
const userUrl = "/dropin/client/user";

const _authentications = new Map();

// MULTI AUTHENTICATION HANDLING
class WeavyAuthenticationsManager {
  static getAuthentication(url) {
    var sameOrigin = false;

    url = url && String(url);

    var urlExtract = url && /^(https?:\/(\/[^/]+)+)\/?$/.exec(url)
    if (urlExtract) {
      sameOrigin = window.location.origin === urlExtract[1];
      url = urlExtract[1];
    }
    url = (sameOrigin ? "" : url) || "";
    if (_authentications.has(url)) {
      return _authentications.get(url);
    } else {
      var authentication = new WeavyAuthentication(url);
      _authentications.set(url, authentication);
      return authentication;
    }
  }

  static removeAuthentication(url) {
    url = url && String(url) || "";
    try {
      var authentication = _authentications.get(url);
      if (authentication && authentication.destroy) {
        authentication.destroy();
      }
      _authentications.delete(url);
    } catch (e) {
      console.error("Could not remove authentication", url, e);
    }
  }

  // expose WeavyAuthentication.default. self initiatied upon access and no other authentication is active 
  static get default() {
    if (_authentications.has("")) {
      return _authentications.get("");
    } else {
      var authentication = WeavyAuthenticationsManager.getAuthentication();

      WeavyUtils.ready(function () {
        setTimeout(function () {
          if (_authentications.size === 1) {
            authentication.init();
          }
        }, 1);
      });

      return authentication;
    }
  }

  // Bridge for simple syntax and backward compatibility with the mobile apps
  static get on() {
    return WeavyAuthenticationsManager.default.on;
  }

  // Bridge for simple syntax
  static get sso() {
    return WeavyAuthenticationsManager.default.sso;
  }
}

class WeavyAuthentication {

  constructor(baseUrl) {
    var _initialized = false;

    var console = new WeavyConsole("WeavyAuthentication");

    console.debug("create new weavy authentication", baseUrl);

    baseUrl = baseUrl && String(baseUrl) || window.location.origin + (wvy.config && wvy.config.applicationPath || "/");

    if (baseUrl) {
      // Remove trailing slash
      baseUrl = /\/$/.test(baseUrl) ? baseUrl.slice(0, -1) : baseUrl;
    }

    var events = new WeavyEvents(this);
    this.on = events.on;
    this.one = events.one;
    this.off = events.off;

    var _user = null;

    // Is the user established?
    var _isAuthenticated = null;
    var _whenAuthenticated = new WeavyPromise();
    var _whenAuthorized = new WeavyPromise();

    var _isUpdating = false;
    var _isNavigating = false;

    var _whenSignedOut = new WeavyPromise();
    var _isSigningOut = false;

    window.addEventListener('beforeunload', function () {
      _isNavigating = true;
    });

    window.addEventListener('turbolinks:request-start', function () {
      _isNavigating = true;
    });

    window.addEventListener('turbolinks:load', function () {
      _isNavigating = false;

      // If the user was changed on page load, process the user instantly
      if (_user && wvy.context && wvy.context.user && (_user.id !== wvy.context.user)) {
        processUser({ id: wvy.context.user }, "turbolinks:load/wvy.context.user");
      }
    });



    /**
     * Checks if the provided or authenticated user is signed in
     * 
     * @param {any} [user] - Optional user to check
     */
    function isAuthorized(user) {
      if (user) {
        return user.id && user.id !== -1 || false;
      }
      return _user && _user.id && _user.id !== -1 || false;
    }

    // JWT
    var _jwt;
    var _jwtFactory;

    function setJwt(jwt) {
      console.debug("configuring jwt");
      _jwt = null;
      _jwtFactory = jwt;
    }

    /**
     * Returns the current jwt token; either the specified jwt string or as a result from the supplied function.
     * @param {boolean} [refresh=false] - Set to true if you want to call the host for a new token.
     * @returns {Promise}
     */
    function getJwt(refresh) {
      return new Promise(function (resolve, reject) {
        if (_jwt && !refresh) {
          // jwt already set, return it
          resolve(_jwt);
          return;
        }

        if (refresh) {
          // reset jwt on refresh
          _jwt = null;
        }

        if (_jwtFactory === undefined) {
          // no jwt provided, return nothing
          resolve(false);
          return;
        }

        if (typeof _jwtFactory === "string" && _jwtFactory) {
          _jwt = _jwtFactory;
          console.warn("Providing JWT without a factory function is deprecated. Consider using a factory function to avoid unexpected errors.")
          resolve(_jwt);
        } else if (typeof _jwtFactory === "function") {
          var resolvedProvider = _jwtFactory(refresh);

          if (typeof resolvedProvider.then === "function") {
            resolvedProvider.then(function (token) {
              if (typeof token === "string" && token) {
                _jwt = token;
                resolve(_jwt);
              } else {
                reject("failed to get a valid string token from the jwt factory promise");
              }
            }, function (reason) {
              reject("failed to get token from the jwt factory promise:", reason);
            });
          } else if (resolvedProvider && typeof resolvedProvider === "string") {
            _jwt = resolvedProvider;
            resolve(_jwt);
          } else {
            reject("failed to get a valid string token from the jwt factory function");
          }
        } else {
          reject("jwt option should be a factory function that is returning a string or is returning a promise that resolves to a string.");
        }
      });
    }

    function clearJwt() {
      console.debug("clearing jwt");
      _jwt = null;
      _jwtFactory = null;
    }

    function init(jwt) {
      if (_isAuthenticated === null || jwt && jwt !== _jwtFactory) {
        if (typeof jwt === "string" || typeof jwt === "function") {
          setJwt(jwt);
        }

        // Authenticate
        if (_jwtFactory !== undefined) {
          console.debug("authenticate by jwt")
          // If JWT is defined, it should always be processed
          WeavyPostal.whenLeader().finally(function () { return validateJwt(); })
        } else if (wvy.context && wvy.context.user) {
          // If user is defined in wvy.context, user is already signed in
          setUser({ id: wvy.context.user }, "init/wvy.context.user");
        } else {
          // Check for current user state
          updateUserState("authenticate()");
        }
      }

      if (!_initialized) {
        _initialized = true;

        // Listen on messages from parent?
        WeavyPostal.on("message", { weavyId: "wvy.authentication", baseUrl: baseUrl }, onChildMessageReceived);
        WeavyPostal.on("distribute", { weavyId: "wvy.authentication", baseUrl: baseUrl }, onParentMessageReceived);

        console.debug("init", !(baseUrl || window.name) ? "self" : "");
      }

      return _whenAuthenticated();
    }

    function setUser(user, originSource) {
      if (user && user.id) {
        if (_user && user && _user.id !== user.id) {
          console.debug("setUser", user.id, originSource);
        }
        _user = user;
        if (wvy.context) {
          wvy.context.user = user.id;
        }
        _isAuthenticated = true;
        if (isAuthorized(user)) {
          _whenAuthorized.resolve();
        } else {
          // Authenticated but still awaiting auhorization
          if (_whenAuthorized.state() !== "pending") {
            _whenAuthorized.reset();
          }
          _isSigningOut = false;
          _whenSignedOut.resolve();
        }

        _whenAuthenticated.resolve(user);
      } else {
        // No valid user, reset states
        _user = null;
        if (wvy.context) {
          wvy.context.user = null;
        }
        _isAuthenticated = false;

        _whenAuthorized.reset();
      }
    }

    function alert(message, type) {
      if (wvy.alert && !_isNavigating) {
        wvy.alert.alert(type || "info", message, null, "wvy-authentication-alert");
      }
    }

    // AUTHENTICATION

    /**
     * Sign in using Single Sign On JWT token. 
     * 
     * A new JWT provider will replace the current JWT provider, then the JWT will be validated.
     * 
     * @param {string|function} [jwt] - Optional JWT token string or JWT factory function that is returning a JWT token string or is returning a Promise resolving a JWT token string. 
     */
    function signIn(jwt) {
      if (typeof jwt === "string" || typeof jwt === "function") {
        setJwt(jwt);
      }

      if (_whenAuthenticated.state() !== "pending") {
        _whenAuthenticated.reset();
      }

      if (_whenAuthorized.state() !== "pending") {
        _whenAuthorized.reset();
      }

      WeavyPostal.whenLeader().finally(function () { return validateJwt(); })

      return _whenAuthenticated();
    }

    /**
     * Sign out the current user.
     * 
     * @param {boolean} [clear] - Clears JWT provider after signOut
     */
    function signOut(clear) {
      var authUrl = new URL(signOutUrl, baseUrl);
      _isSigningOut = true;

      if (clear) {
        clearJwt();
      }

      events.triggerEvent("clear-user");

      var fetchSettings = {
        method: "POST",
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'reload', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'include', // include, *same-origin, omit
        headers: {
          // https://stackoverflow.com/questions/8163703/cross-domain-ajax-doesnt-send-x-requested-with-header
          "X-Requested-With": "XMLHttpRequest"
        },
        redirect: 'manual', // manual, *follow, error
        referrerPolicy: "no-referrer-when-downgrade", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      };

      window.fetch(authUrl.toString(), fetchSettings).catch(function () {
        console.warn("signOut request fail");
      }).finally(function () {
        console.debug("signout ajax -> processing user");
        processUser({ id: -1 }, "signOut()");
      });

      return _whenSignedOut();
    }

    function processUser(user, originSource) {
      // Default state when user is unauthenticated or has not changed
      var state = "updated";

      var reloadLink = ' <a href="#" onclick="location.reload(); return false;">' + wvy.t("Reload") + '</a>';

      if (user && user.id) {
        if (_isAuthenticated) {
          if (isAuthorized()) {
            // When signed in
            if (user && user.id === -1) {
              console.info("signed-out");
              alert(wvy.t("You have been signed out.") + reloadLink);
              // User signed out
              state = "signed-out";
            } else if (user && user.id !== _user.id) {
              console.info("changed-user");
              alert(wvy.t("The signed in user has changed.") + reloadLink)
              // User changed
              state = "changed-user";
            }
          } else {
            // When signed out
            if (user && user.id !== -1) {
              console.info("signed-in", originSource);

              // Show a message if the user hasn't loaded a new page
              if (wvy && wvy.context && wvy.context.user && (user.id !== wvy.context.user)) {
                alert(wvy.t("You have signed in.") + reloadLink);
              }

              // User signed in
              state = "signed-in";
            }
          }
        }

        setUser(user, originSource || "processUser()");
        events.triggerEvent("user", { state: state, authorized: isAuthorized(user), user: user });
      } else {
        // No valid user state
        setUser(null, originSource || "processUser()");
        events.triggerEvent("clear-user");

        var eventResult = events.triggerEvent("user", { state: "user-error", authorized: false, user: user });
        if (eventResult !== false) {
          WeavyPostal.whenLeader().then(function (isLeader) {
            if (isLeader) {
              alert(wvy.t("Authentication error.") + reloadLink, "danger");
            }
          });
        }
      }

      _isUpdating = false;
    }


    function updateUserState(originSource) {
      if (!_isUpdating) {
        _isUpdating = true;
        WeavyPostal.whenLeader().then(function (isLeader) {
          if (isLeader) {
            console.debug("whenLeader => updateUserState" + (_jwtFactory !== undefined ? ":jwt" : ":cookie"), originSource);

            if (_whenAuthenticated.state() !== "pending") {
              _whenAuthenticated.reset();
            }
            if (_whenAuthorized.state() !== "pending") {
              _whenAuthorized.reset();
            }

            var url = new URL(userUrl, baseUrl);

            var fetchSettings = {
              method: "POST",
              mode: 'cors', // no-cors, *cors, same-origin
              cache: 'reload', // *default, no-cache, reload, force-cache, only-if-cached
              credentials: 'include', // include, *same-origin, omit
              headers: {
                'Content-Type': 'application/json',
                // https://stackoverflow.com/questions/8163703/cross-domain-ajax-doesnt-send-x-requested-with-header
                "X-Requested-With": "XMLHttpRequest"
              },
              redirect: 'manual', // manual, *follow, error
              referrerPolicy: "no-referrer-when-downgrade", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
            };

            getJwt().then(function (token) {
              if (_jwtFactory !== undefined) {
                if (typeof token !== "string") {
                  return Promise.reject(new Error("Provided JWT token is invalid."))
                }

                fetchSettings.body = JSON.stringify({ jwt: token });
              }

              window.fetch(url.toString(), fetchSettings).then(function (response) {
                if (response.status === 401 && _jwtFactory !== undefined) {
                  console.warn("JWT failed, trying again");
                  return getJwt(true).then(function (token) {
                    fetchSettings.body = JSON.stringify({ jwt: token });
                    return window.fetch(url.toString(), fetchSettings);
                  })
                }
                return response;
              }).then(WeavyUtils.processJSONResponse).then(function (actualUser) {
                console.debug("updateUserState ajax -> processing user")
                processUser(actualUser, "updateUserState," + originSource);
              }, function () {
                console.warn("updateUserState request fail");
                console.debug("updateUserState ajax fetch fail -> processing user");
                processUser({ id: null }, "updateUserState," + originSource);
              });
            });
          } else {
            WeavyPostal.postToParent({ name: "request:user", weavyId: "wvy.authentication", baseUrl: baseUrl });
          }
        });
      }

      return _whenAuthenticated();
    }

    function validateJwt() {
      var whenSSO = new WeavyPromise();
      var authUrl = new URL(ssoUrl, baseUrl);

      if (_isSigningOut) {
        // Wait for signout to complete
        return _whenSignedOut.then(function () { return validateJwt(); });
      } else if (_whenSignedOut.state() !== "pending") {
        // Reset signed out promise
        _whenSignedOut.reset();
      }

      console.debug("validating jwt");

      events.triggerEvent("signing-in");

      var fetchSettings = {
        method: "POST",
        mode: 'cors', // no-cors, *cors, same-origin
        cache: 'reload', // *default, no-cache, reload, force-cache, only-if-cached
        credentials: 'include', // include, *same-origin, omit
        headers: {
          'Content-Type': 'application/json',
          // https://stackoverflow.com/questions/8163703/cross-domain-ajax-doesnt-send-x-requested-with-header
          "X-Requested-With": "XMLHttpRequest"
        },
        redirect: 'manual', // manual, *follow, error
        referrerPolicy: "no-referrer-when-downgrade", // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
      };

      return getJwt().then(function (token) {
        if (!token || typeof token !== "string") {
          return Promise.reject(new Error("Provided JWT token is invalid."))
        }

        fetchSettings.headers.Authorization = "Bearer " + token;

        // Convert url to string to avoid bugs in patched fetch (Dynamics 365)
        return window.fetch(authUrl.toString(), fetchSettings).then(function (response) {
          if (response.status === 401) {
            console.warn("JWT failed, trying again");
            return getJwt(true).then(function (token) {
              fetchSettings.headers.Authorization = "Bearer " + token;
              return window.fetch(authUrl.toString(), fetchSettings);
            })
          }
          return response;

        }).then(WeavyUtils.processJSONResponse).then(function (ssoUser) {
          processUser(ssoUser);
          return whenSSO.resolve(ssoUser);
        }).catch(function (error) {
          console.error("sign in with JWT token failed.", error.message);
          events.triggerEvent("authentication-error", { method: "jwt", status: 401, message: error.message });
          processUser({ id: null });
        });
      })
    }

    // REALTIME CROSS WINDOW MESSAGE
    // handle cross frame events from rtm
    var onChildMessageReceived = function (e) {
      var msg = e.data;
      switch (msg.name) {
        case "request:user":
          _whenAuthenticated.then(function () {
            WeavyPostal.postToSource(e, { name: "user", user: _user, weavyId: "wvy.authentication", baseUrl: baseUrl });
          })
          break;
        default:
          return;
      }

    };

    var onParentMessageReceived = function (e) {
      var msg = e.data;
      switch (msg.name) {
        case "user":
          console.debug("parentMessage user -> processing user");
          processUser(msg.user, "parentMessage:user");
          break;
        default:
          return;
      }

    };


    function destroy() {
      _isAuthenticated = null;
      _user = null;
      _jwt = null;
      _jwtFactory = null;

      WeavyPostal.off("message", { weavyId: "wvy.authentication", baseUrl: baseUrl }, onChildMessageReceived);
      WeavyPostal.off("distribute", { weavyId: "wvy.authentication", baseUrl: baseUrl }, onParentMessageReceived);

      events.clear();

      _initialized = false;
    }

    // Exports 
    this.init = init;
    this.isAuthorized = isAuthorized;
    this.isAuthenticated = function () { return _isAuthenticated === true; };
    this.isInitialized = function () { return _initialized === true; }
    this.isProvided = function () { return !!_jwtFactory; };
    this.whenAuthenticated = function () { return _whenAuthenticated(); };
    this.whenAuthorized = function () { return _whenAuthorized(); };
    this.signIn = signIn;
    this.signOut = signOut;
    this.setJwt = setJwt;
    this.getJwt = getJwt;
    this.clearJwt = clearJwt;
    this.updateUserState = updateUserState;
    this.user = function () { return _user };
    this.destroy = destroy;
  }

}

export default WeavyAuthenticationsManager;
