import Weavy from '../weavy';
import WeavyPostal from '../utils/postal-parent';
import WeavyPromise from '../utils/promise';

/**
 * Filepicker plugin for attaching from Google, O365, Dropbox etc.
 * It listens to `request:origin` messages from frames and responds to the source with a `origin` message containing the `window.location.origin`.
 * 
 * _This plugin has no exposed properties or options._
 * 
 * @mixin FileBrowserPlugin
 * @param {Weavy} weavy - The Weavy instance
 * @parm {Object} options - Plugin options
 * @returns {Weavy.plugins.filebrowser}
 * @typicalname weavy.plugins.filebrowser
 */
class FileBrowserPlugin {
  constructor(weavy, options) {
    var loadingStarted = false;
    var fileBrowserOrigin = "https://filebrowser.weavycloud.com";
    var fileBrowserUrl = fileBrowserOrigin + "/index10.html";
    var filebrowserSrc = "about:blank";
    var $filebrowserFrame = null;
    var whenFilebrowserLoaded = new WeavyPromise();
    var panelData = null;

    var loadFilebrowser = function () {
      if (!loadingStarted) {
        loadingStarted = true;

        // TODO: Custom file browser url
        console.debug("Using filebrowser: ", fileBrowserUrl);
                
        var origin = window.top.document.location.origin;
        filebrowserSrc = fileBrowserUrl + "?origin=" + origin + "&v=X&t=" + Date.now().toString() + "&weavyId=" + weavy.getId();
        
        if (!$filebrowserFrame || $filebrowserFrame.length === 0) {

          //TODO: use weavy.nodes.panels.filebrowser.addPanel()

          var id = weavy.getId("filebrowser");
          $filebrowserFrame = document.createElement("iframe");
          $filebrowserFrame.id = id;
          $filebrowserFrame.name = id;
          $filebrowserFrame.src = filebrowserSrc;
          $filebrowserFrame.className = "wy-filebrowser-frame";

          weavy.nodes.panels.filebrowser.node.appendChild($filebrowserFrame);

          WeavyPostal.registerContentWindow($filebrowserFrame.contentWindow, id, weavy.getId(), fileBrowserOrigin);
        }
        $filebrowserFrame.addEventListener('load', () => {
          whenFilebrowserLoaded.resolve();
        }, {
          once: true,
        });
        
      }

      return whenFilebrowserLoaded.promise();
    }

    weavy.on(WeavyPostal, "addExternalBlobs", weavy.getId(), function (e) {
      WeavyPostal.postToSource(panelData, e.data);
    });

    weavy.on(WeavyPostal, "file-browser-open", weavy.getId(), function (e) {
      panelData = e;
      loadFilebrowser().then(() => {
        $filebrowserFrame.style.display = "block";        
      });

    });

    weavy.on(WeavyPostal, "file-browser-close", weavy.getId(), function (e) {
      $filebrowserFrame.style.display = "none";

    });

    weavy.on("before:build", function () {

      if (!weavy.nodes.panels.filebrowser) {
        /**
         * Filebrowser panel container. Attached to {@link Weavy#nodes#global}.
         * 
         * @type {WeavyPanels~container}
         * @category panels
         * @name Weavy#nodes#panels#filebrowser
         **/
        weavy.nodes.panels.filebrowser = weavy.panels.createContainer();
        weavy.nodes.panels.filebrowser.node.classList.add("wy-filebrowser");
        weavy.nodes.global.appendChild(weavy.nodes.panels.filebrowser.node);
      }
    });
  }
}

/**
 * Default plugin options
 * 
 * @example
 * Weavy.plugins.filebrowser.defaults = {
 * };
 * 
 * @ignore
 * @name defaults
 * @memberof FileBrowserPlugin
 * @type {Object}
 */
FileBrowserPlugin.defaults = {
};

// Register and return plugin
//console.debug("Registering Weavy plugin: filebrowser");
Weavy.plugins.filebrowser = FileBrowserPlugin;

export default FileBrowserPlugin;
