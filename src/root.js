import WeavyPromise from './utils/promise';
import { asElement, asArray } from './utils/utils';
import weavyGlobalCss from "./scss/_global.scss";
import weavyRootCss from "./scss/_root.scss";

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
 *   .wy-container {
 *    // The .wy- selector will be recognized by weavy and the stylesheet will inserted into all weavy roots
 *    ...
 *   }
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

  /**
   * The stylesheet available in the global scope.
   * @memberof WeavyRoot.
   * @static 
   * @type {CSSStyleSheet|StyleElement}
   */
  static globalStyleSheet;

  /**
   * The common stylesheet for each root.
   * @memberof WeavyRoot.
   * @static 
   * @type {CSSStyleSheet|StyleElement}
   */
  static commonStyleSheet;

  /**
   * Adds CSS as a stylesheet to a root.
   * Using constructable stylesheets when available.
   * 
   * @param {string} css - The css to add
   * @param {*} root - The root where it should be added
   * @returns {CSSStyleSheet|StyleElement}
   */
  static addStyleSheet(css, root) {
    if (css && root) {
      // Prefer modern CSS registration
      if (WeavyRoot.supportsConstructableStylesheets) {
        let sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
        root.adoptedStyleSheets = Array.prototype.concat.call(root.adoptedStyleSheets, [sheet]);
        
        return sheet;
      } else {
        // Fallback CSS registration
        let elementStyleSheet = document.createElement("style");
        elementStyleSheet.styleSheet ? elementStyleSheet.styleSheet.cssText = css : elementStyleSheet.appendChild(document.createTextNode(css));
        (root === document ? document.head : root).appendChild(elementStyleSheet);
        
        return elementStyleSheet;
      }
    }
  }

  /**
   * The id of the root.
   * @type {string}
   */
  id;

  /**
   * The id without any weavy prefix
   * @private
   * @type {string}
   */
  #rawId;

  /**
   * The parent DOM node where the root is attached.
   * @type {Element} 
   */
  parent;

  /**
   * The &lt;weavy/&gt; node which is the placeholder for the root. Attached to the parent.
   * @type {Element}
   */
  section;

  /**
   * The the &lt;weavy-root/&gt; that acts as root. May contain a ShadowDOM if supported.
   * @type {Element}
   */
  root;

  /**
   * The ShadowDOM if supported, otherwise the same as root. The ShadowDOM is closed by default.
   * @type {ShadowDOM|Element}
   */
  dom;

  /**
   * The &lt;weavy-container/&gt; where you safely can place elements. Attached to the dom.
   * @type {Element}
   */
  container;

  /**
   * The weavy instance
   * @private
   * @type {Weavy}
   */
  #weavy;

  /**
   * The external styles found.
   * @private
   * @type {String}
   */
  #externalCss;

  /**
   * Object containing the stylesheet and a promise that is resolved when the stylesheet is loaded and available.
   * @typedef WeavyRoot~StylesheetLoader
   * @private
   * @type {object}
   * @property {URL} url - Resolved when the stylesheet is loaded
   * @property {Promise} whenCss - Resolved when the stylesheet is loaded
   * @property {?string} css - The CSS when loaded
   */

  /**
   * List of stylesheet loading objects. Each entry containing the stylesheet and a promise that is resolved when the stylesheet is loaded and available. 
   * @private
   * @type {WeavyRoot~StylesheetLoader[]}
   */
   #styleSheets;

   /**
    * List of any errors that has occured during stylesheet processing. 
    * @private
    * @type {{name: string, error: string}[]}
    */
   #styleSheetErrors;

  /**
   * Concatenated string of all added CSS.
   * @private
   * @type {string}
   */
  #css;

  static registerCustomElements() {
    if (!WeavyRoot.globalStyleSheet) {
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
    
      WeavyRoot.globalStyleSheet = WeavyRoot.addStyleSheet(weavyGlobalCss, document);
    }
  }

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
    this.parent = asElement(parent);

    if (!this.parent) {
      throw new Error("No parent container defined" + this.id);
    }

    // Events
    this.eventParent = eventParent;
    this.on = weavy.events.on.bind(this);
    this.one = weavy.events.one.bind(this);
    this.off = weavy.events.off.bind(this);
    this.triggerEvent = weavy.events.triggerEvent.bind(this);

    WeavyRoot.registerCustomElements();

    this.section = document.createElement("weavy");

    this.section.id = this.id;

    this.root = document.createElement("weavy-root");
    this.root.setAttribute("data-version", weavy.version);

    this.container = document.createElement("weavy-container");
    this.container.className = "wy-container";
    this.container.id = weavy.getId("container-" + this.#rawId);

    // STYLES
    this.#styleSheets = [];
    this.#styleSheetErrors = [];
    this.#css = "";
  
    this.triggerEvent("before:root-create", this);

    this.parent.appendChild(this.section);
    this.section.appendChild(this.root);

    if (WeavyRoot.supportsShadowDOM) {
      if (weavy.options.shadowMode === "open") {
        weavy.warn(this.id, "Using ShadowDOM in open mode", this.id);
      }
      this.dom = this.root.attachShadow({ mode: weavy.options.shadowMode || "closed" });
    } else {
      this.dom = this.root;
    }
    this.dom.appendChild(this.container);


    if (weavy.options.includeStyles) {
      this.#addCommonStyles();
    }
    this.#addExternalStyles();

    this.addStyles(weavy.options);

    /**
     * Triggered when a shadow root is created
     * 
     * @event WeavyRoot#root-create
     * @returns {WeavyRoot}
     **/
    this.triggerEvent("on:root-create", this);

    queueMicrotask(() => this.triggerEvent("after:root-create", this));
  }

  #addCommonStyles() {
    if (WeavyRoot.supportsShadowDOM) {
      // Register common styles in the root when ShadowDOM is used
      WeavyRoot.addStyleSheet(weavyRootCss, this.dom)
    } else if (!WeavyRoot.commonStyleSheet) {
      // Register root styles globally when ShadowDOM isn't supported
      WeavyRoot.commonStyleSheet = WeavyRoot.addStyleSheet(weavyRootCss, document)
    }
  }

  #addExternalStyles() {
    if (!this.#externalCss) {
      this.#externalCss = "";
      for (let sheet of document.styleSheets) {
        try {
          if (sheet instanceof CSSStyleSheet && sheet.cssRules) {
            for (let rule of sheet.cssRules) {
              if (rule.cssText.includes('.wy-') && !rule.parentRule) {
                this.#weavy.debug("Found external rule", rule.cssText)
                this.#externalCss += rule.cssText + "\n";
              }
            }
          }
        } catch(e) {
          this.#styleSheetErrors.push({name: sheet.href || sheet.ownerNode.nodeName, error: e.toString()});
        }
      }
    }
    
    // External styles are already available globally, no need to add them as stylesheet globally
    if (WeavyRoot.supportsShadowDOM) {
      WeavyRoot.addStyleSheet(this.#externalCss, this.dom)
    }
  }

  addStyles(options) {
    // get styles from options
    if (options?.css) {
      this.#weavy.debug(this.id, "CSS: adding custom css");
      this.#css += options.css;
    }

    // load stylesheet from options
    if (options?.stylesheet) {
      let stylesheets = asArray(options.stylesheet);

      stylesheets.forEach((stylesheet) => {
        var cssUrl = new URL(stylesheet, window.location.href);
        var whenCss = new WeavyPromise();
        
        let stylesheetExists = this.#styleSheets.find((existingStyleSheet) => existingStyleSheet.url?.toString() === cssUrl.toString());
        
        if (!stylesheetExists) {
          let stylesheetObj = { url: cssUrl, whenCss: whenCss, css: "" };
          this.#styleSheets.push(stylesheetObj);

          this.#weavy.debug(this.id, "CSS: fetching stylesheet", cssUrl.toString());
    
          fetch(cssUrl).then((response) => {
            let contentType = (response.headers.has("content-type") ? response.headers.get("content-type") : "").split(";")[0];
            if (response.ok && contentType === "text/css") {
              return response.text().then((fetchedCss) => {
                stylesheetObj.css = fetchedCss;
                whenCss.resolve()
              });
            } else {
              return Promise.reject(new Error("Error fetching stylesheet"));
            }
          }).catch((reason) => {
            this.#styleSheetErrors.push({ name: cssUrl, error: reason.toString() })
            whenCss.reject(reason);
          });
        }
      });
    }

    this.#applyStyles();

    return Promise.allSettled(this.#styleSheets.map((styleSheetObj) => styleSheetObj.whenCss)).then((result) => { 
      this.#showAnyErrors(this.id, "Some stylesheets could not be fetched");
      // return the fulfilled values
      return result.filter((p) => p.status === "fulfilled").map((p) => p.value);
    });
  }

  #applyStyles() {
    this.triggerEvent("before:root-styles");

    let notLoaded = !!this.#styleSheets.find((styleSheetObj) => styleSheetObj.whenCss?.state() === "pending")

    if (notLoaded) {
      Promise.allSettled(this.#styleSheets.map((styleSheetObj) => styleSheetObj.whenCss)).then(() => {
        this.#applyStyles();
      });
    } else {
      this.#styleSheets.forEach((styleSheetObj) => {
        WeavyRoot.addStyleSheet(styleSheetObj.css, this.dom);
      })
  
      if (this.#css) {
        WeavyRoot.addStyleSheet(this.#css, this.dom);
      }

      this.triggerEvent("on:root-styles");
      this.triggerEvent("after:root-styles");
    }
  }

  getStyles() {
    return Promise.allSettled(this.#styleSheets.map((stylesheet) => stylesheet.whenCss)).then(() => { 
      let styleSheetsCss = this.#styleSheets.reduce((allCss, stylesheetObj) => {
        if (stylesheetObj.css) {
          return allCss += stylesheetObj.css;
        } else {
          return allCss;
        }
      }, "");

      return [this.#externalCss, styleSheetsCss, this.#css].join("\n");
    })
  }

  /**
   * 
   * @param  {...any} labels - Any messages to put before the error listing
   */
  #showAnyErrors(...labels) {
    if (this.#styleSheetErrors.length) {

      this.#weavy.error(...labels);
      this.#styleSheetErrors.forEach((e) => this.#weavy.warn(e.name.toString(), e.error.toString()));

      this.#styleSheetErrors = [];
    }
  }

  remove() {
    this.triggerEvent("before:root-remove", this);

    if (this.section) {
      this.section.remove();
      this.section = null;
    }

    this.triggerEvent("on:root-remove", this);
    this.triggerEvent("after:root-remove", this);
  }
}

export default WeavyRoot;