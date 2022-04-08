import WeavyPromise from './common/promise';
import WeavyUtils from './common/utils';

// DEFINE CUSTOM ELEMENTS AND STYLES

/**
 * Three custom elements are used <weavy>, <weavy-root> and <weavy-container>
 * <weavy> can't be defined and acts only as a DOM placeholder.
 **/
if ('customElements' in window) {
  try {
    window.customElements.define('weavy-root', HTMLElement.prototype);
    window.customElements.define('weavy-container', HTMLElement.prototype);
  } catch (e) { /* well, the browser didn't like it, no worries */ }
}

// <weavy> and <weavy-root> should have no layout of their own.
var weavyElementCSS = 'weavy, weavy-root { display: contents; }';

// <weavy> and <weavy-root> gets layout only if needed 
if (!('CSS' in window && CSS.supports('display', 'contents'))) {
  weavyElementCSS = 'weavy, weavy-root { display: flex; position: absolute; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; }';
}

// Prefer modern CSS registration
if (document.adoptedStyleSheets) {
  var sheet = new CSSStyleSheet();
  sheet.replaceSync(weavyElementCSS);
  document.adoptedStyleSheets = Array.prototype.concat.call(document.adoptedStyleSheets, [sheet]);
} else {
  // Fallback CSS registration
  var elementStyleSheet = document.createElement("style");
  elementStyleSheet.type = "text/css";
  elementStyleSheet.styleSheet ? elementStyleSheet.styleSheet.cssText = weavyElementCSS : elementStyleSheet.appendChild(document.createTextNode(weavyElementCSS));

  document.getElementsByTagName("head")[0].appendChild(elementStyleSheet);
}


/**
 * @class WeavyRoot

 * @classdesc
 * Weavy shadow root to enable closed scopes in the DOM that also can be managed and removed.
 * The shadow root will isolate styles and nodes within the root.
 * 
 * @structure
 * {parent} ➜ &lt;weavy/&gt; ➜ {root} ➜ {ShadowDOM} ➜ {container}
 * 
 * You may define styles by either setting weavy options or by injecting them via {@link WeavyRoot#addStyles}
 * 
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/Web_Components/Using_shadow_DOM}
 * @property {string} id - The id of the root.
 * @property {Element} parent - The parent DOM node where the root is attached.
 * @property {Element} section - The &lt;weavy/&gt; node which is the placeholder for the root. Attached to the parent.
 * @property {Element} root - The the &lt;weavy-root/&gt; that acts as root. May contain a ShadowDOM if supported.
 * @property {ShadowDOM|Element} dom - The ShadowDOM if supported, otherwise the same as root. The ShadowDOM is closed by default.
 * @property {Element} container - The &lt;weavy-container/&gt; where you safely can place elements. Attached to the dom.
 * @example
 * ```html
 * <style>
 *   ​‍@namespace weavy "http://www.weavy.com"
 *   // The weavy namespace will be recognized by weavy and the stylesheet will inserted into all weavy roots
 *   ...
 * </style>
 * ```
 */
class WeavyRoot {
  /**
   * Is ShadowDOM supported by the browser?
   * @memberof WeavyRoot.
   * @static
   * @type {boolean}
   */
  static supportsShadowDOM = !!HTMLElement.prototype.attachShadow;

  /**
   * Is constructable stylesheets supprted by the browser?
   * @memberof WeavyRoot.
   * @static 
   * @type {boolean}
   */
  static supportsConstructableStylesheets = 'adoptedStyleSheets' in document;

  id;

  /**
   * The id without any weavy prefix
   * @private
   * @type {string}
   */
  #rawId;

  parent;
  section;
  root;
  dom;
  container;

  /**
   * The weavy instance
   * @private
   * @type {Weavy}
   */
  #weavy;

  /**
   * Object containing the stylesheet and a promise that is resolved when the stylesheet is loaded and available.
   * @typedef WeavyRoot~StylesheetLoader
   * @private
   * @type {object}
   * @property {Promise} whenCss - Resolved when the stylesheet is loaded
   * @property {?CSSStyleSheet} stylesheet - The stylesheet when loaded
   */

  /**
   * List of stylesheet loading objects. Each entry containing the stylesheet and a promise that is resolved when the stylesheet is loaded and available. 
   * @private
   * @type {WeavyRoot~StylesheetLoader[]}
   */
  #styleSheets;

  /**
   * Concatenated string of all added CSS.
   * @private
   * @type {string}
   */
  #css;

  /**
   * Creates a sealed shadow DOM and injects additional styles into the created root.
   * @param {Weavy} weavy - Weavy instance
   * @param {Element} parent - The parent DOM node where the root should be attached. 
   * @param {string} id - The id of the root.
   * @param {*} [eventParent] - Optional parent to bubble events to.
   */
  constructor(weavy, parent, id, eventParent) {
    this.#weavy = weavy;

    this.#rawId = weavy.removeId(id);
    this.id = weavy.getId(id);
    this.parent = WeavyUtils.asElement(parent);

    if (!this.parent) {
      throw new Error("No parent container defined" + this.id);
    }

    // Events
    this.eventParent = eventParent;
    this.on = weavy.events.on.bind(this);
    this.one = weavy.events.one.bind(this);
    this.off = weavy.events.off.bind(this);
    this.triggerEvent = weavy.events.triggerEvent.bind(this);

    this.section = document.createElement("weavy");

    this.section.id = this.id;

    this.root = document.createElement("weavy-root");
    this.root.setAttribute("data-version", weavy.version);

    this.container = document.createElement("weavy-container");
    this.container.className = "weavy-container";
    this.container.id = weavy.getId("weavy-container-" + this.#rawId);

    // STYLES
    this.#styleSheets = [];
    this.#css = "";
  
    // EXTERNAL STYLES
    // Get stylesheet from head
    for (let sheet of document.styleSheets) {
      try {
        if (sheet instanceof CSSStyleSheet) {
          if (sheet.cssRules && sheet.cssRules[0] instanceof CSSNamespaceRule && sheet.cssRules[0].prefix === "weavy") {
            weavy.debug("CSS: found external stylesheet");
            if (WeavyRoot.supportsConstructableStylesheets) {
              var cSheet = new CSSStyleSheet();
              for (let rule of sheet.cssRules) {
                cSheet.insertRule(rule.cssText, cSheet.cssRules.length);
              }
              this.#styleSheets.push({ stylesheet: cSheet });
            } else {
              this.#styleSheets.push({ stylesheet: sheet });
            }
          }
        }
      } catch(e) {
        weavy.warn("Error reading stylesheet:", e);
      }
    }

    this.triggerEvent("before:root-create", this);

    this.parent.appendChild(this.section);
    this.section.appendChild(this.root);

    if (WeavyRoot.supportsShadowDOM) {
      if (weavy.options.shadowMode === "open") {
        weavy.warn("Using ShadowDOM in open mode", this.id);
      }
      this.dom = this.root.attachShadow({ mode: weavy.options.shadowMode || "closed" });
    } else {
      this.dom = this.root;
    }
    this.dom.appendChild(this.container);

    this.addStyles(weavy.options);

    /**
     * Triggered when a shadow root is created
     * 
     * @event WeavyRoot#root-create
     * @returns {WeavyRoot}
     **/
    this.triggerEvent("on:root-create", this);

    if (!this.#styleSheets.length && !this.#css && (!eventParent || eventParent === weavy)) {
      weavy.error("CSS: No styles provided! Provide a stylesheet using the weavy namespace or add styles in options.");
    }

    queueMicrotask(() => this.triggerEvent("after:root-create", this));
  }

  addStyles(options) {
    // get styles from options
    if (options?.css) {
      this.#weavy.debug("CSS: adding custom css");
      this.#addCss(options.css);
    }

    // load stylesheet from options
    if (options?.stylesheet) {
      let stylesheets = WeavyUtils.asArray(options.stylesheet);

      stylesheets.forEach((stylesheet) => {
        this.#weavy.debug("CSS: fetching stylesheet");
        var cssUrl = new URL(stylesheet, window.location.href);
        var whenCss = new WeavyPromise();
        let stylesheetObj = { whenCss: whenCss };
        this.#styleSheets.push(stylesheetObj);
  
        fetch(cssUrl).then((response) => {
          let contentType = (response.headers.has("content-type") ? response.headers.get("content-type") : "").split(";")[0];
          if (response.ok && contentType === "text/css") {
            return response.text().then((clientCss) => {
  
              if (WeavyRoot.supportsConstructableStylesheets) {
                var cSheet = new CSSStyleSheet();
                cSheet.replaceSync(clientCss);
                stylesheetObj.stylesheet = cSheet;
              } else {
                this.#addCss(clientCss);
              }
              whenCss.resolve()
            });
          } else {
            whenCss.reject(new Error("Error fetching stylesheet"));
          }
        });
      })
    }

    this.#applyStyles();
    return Promise.all(this.#styleSheets.map((styleSheetObj) => styleSheetObj.whenCss));
  }

  getStyles(withoutNamespaces) {
    return Promise.all(this.#styleSheets.map((stylesheet) => stylesheet.whenCss)).then(() => { 
      let styleSheetsText = this.#styleSheets.reduce((allCss, stylesheetObj) => {
        if(stylesheetObj.stylesheet) {
          return allCss += Array.from(stylesheetObj.stylesheet.cssRules).reduce((css, rule) => {
            return withoutNamespaces && rule instanceof CSSNamespaceRule ? css : css += rule.cssText;
          }, "");
        } else {
          return allCss;
        }
      }, "");
      return styleSheetsText + "\n" + this.#css
    })
  }

  #applyStyles() {
    this.triggerEvent("before:root-styles");

    let notLoaded = !!this.#styleSheets.find((styleSheetObj) => styleSheetObj.whenCss?.state() === "pending")

    if (notLoaded) {
      Promise.all(this.#styleSheets.map((styleSheetObj) => styleSheetObj.whenCss)).then(() => {
        this.#applyStyleSheets();
        this.#applyCss();
        this.triggerEvent("on:root-styles");
        this.triggerEvent("after:root-styles");
      });
    } else {
      this.#applyStyleSheets();
      this.#applyCss();

      this.triggerEvent("on:root-styles");
      this.triggerEvent("after:root-styles");
    }
  }

  #applyCss() {
    if (this.#css) {
      this.#weavy.debug("CSS: setting custom css stylesheet");

      let cssStyles = document.createElement("style");

      cssStyles.appendChild(document.createTextNode(this.#css));

      if (WeavyRoot.supportsShadowDOM) {
        this.dom.appendChild(cssStyles);
      } else {
        var styleId = this.#weavy.getId("weavy-styles");
        if (!document.getElementById(styleId)) {
          cssStyles.id = styleId; // Is weavyStyles set?
          document.getElementsByTagName("head")[0].appendChild(cssStyles);
        }
      }
    }
  }

  #applyStyleSheets() {
    let styleSheets = this.#styleSheets.map((styleSheetObj) => styleSheetObj.stylesheet).filter((x) => x);
    if (WeavyRoot.supportsConstructableStylesheets) {
      this.#weavy.debug("CSS: setting adopted stylesheets", this.dom);
      this.dom.adoptedStyleSheets = [...this.dom.adoptedStyleSheets, ...styleSheets];
    } else {
      this.#weavy.debug("CSS: cloning stylesheets", this.dom);
      styleSheets.forEach((styleSheet) => {
        if (styleSheet.ownerNode) {
          // Check if stylesheet exists already
          let isNewLink = styleSheet.href && !this.dom.querySelector("link[rel='stylesheet'][href='" + styleSheet.href + "']");
          let isNewStyle = !styleSheet.href && !Array.from(this.dom.querySelectorAll("style")).filter((existingStyle) => {
            try {
              let matchLength = existingStyle.cssRules.length === styleSheet.cssRules.length;
              let matchFirstRule = !existingStyle.cssRules.length || existingStyle.cssRules[0].cssText === styleSheet.cssRules[0].cssText;
              let matchLastRule = !existingStyle.cssRules.length || existingStyle.cssRules[existingStyle.cssRule - 1].cssText === styleSheet.cssRules[existingStyle.cssRule - 1].cssText;
              return matchLength && matchFirstRule && matchLastRule;
            } catch(e) {
              return false;
            }
          }).length;
          if (isNewLink || isNewStyle) {
            try {
              this.dom.appendChild(styleSheet.ownerNode.cloneNode(true));
            } catch(e) {
              this.weavy.error("Could not clone stylesheet", e)
            }
          }
        } else {
          this.#weavy.warn("Could not add stylesheet: No valid ownerNode");
        }
      });
    }
  }

  /**
   * Add styles to an existing weavy stylesheet.
   *
   * @memberof ThemePlugin#
   * @param {string} css - The styles to apply. Full css including selectors etc may be used.
   */
  #addCss(cssText) {
    if (cssText) {
      if (WeavyRoot.supportsConstructableStylesheets) {
        var sheet = new CSSStyleSheet();
        sheet.replaceSync(cssText);
        this.#styleSheets.push({ stylesheet: sheet });
      } else {
        this.#css += cssText + "\n";
      }
    }
  }

  remove() {
    this.triggerEvent("before:remove-root", this);

    if (this.section) {
      this.section.remove();
      this.section = null;
    }

    this.triggerEvent("on:remove-root", this);
    this.triggerEvent("after:remove-root", this);
  }
}

export default WeavyRoot;