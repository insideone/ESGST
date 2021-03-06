`use strict`;

// that will append styles to page in runtime
import './assets/css';

import 'jquery';

// jQuery QueryBuilder want global interact object
import interact from 'interactjs/dist/interact.min';

window.interact = interact;

import 'jQuery-QueryBuilder/dist/js/query-builder.standalone.min';

import Popup from './class/Popup';
import {utils} from './lib/jsUtils';
import esgst from './class/Esgst';

/** @var {object} GM */
/** @var {function} GM_getValue */
/** @var {function} GM_setValue */
/** @var {function} GM_deleteValue */
/** @var {function} GM_listValues */
/** @var {function} GM_getResourceURL */
/** @var {function} GM_xmlhttpRequest */
/** @var {function} delValues */
/** @var {function} setValues */
/** @property {boolean} global.chrome */
/** @property {function} browser.runtime.sendMessage */
/** @property {function} browser.runtime.onMessage.addListener */
/** @property {function} browser.runtime.getURL */

(() => {
  /**
   * @typedef {Object} EnvironmentFunctions
   * @property {function} setValue
   * @property {function} setValues
   * @property {function} getValue
   * @property {function} getValues
   * @property {function} delValue
   * @property {function} delValues
   * @property {function} getStorage
   * @property {function} notifyNewVersion
   * @property {function} continueRequest
   * @property {function} addHeaderMenu
   */

  /**
   * @type {EnvironmentFunctions}
   */
  let envFunctions = {};

  /**
   * @typedef {Object} EnvironmentVariables
   * @property {Object} _USER_INFO
   * @property {Object} browser
   * @property {Object} gm
   */

  /**
   * @type {EnvironmentVariables}
   */
  let envVariables = {};

  const
    common = esgst.modules.common,
    getZip = common.getZip.bind(common),
    readZip = common.readZip.bind(common)
  ;

  if (!NodeList.prototype[Symbol.iterator]) {
    NodeList.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }

  if (!HTMLCollection.prototype[Symbol.iterator]) {
    HTMLCollection.prototype[Symbol.iterator] = Array.prototype[Symbol.iterator];
  }

  const theme = common.getLocalValue(`theme`);
  if (theme) {
    const style = document.createElement(`style`);
    style.id = `esgst-theme`;
    style.textContent = theme;
    document.documentElement.appendChild(style);
  }
  const customTheme = common.getLocalValue(`customTheme`);
  if (customTheme) {
    const style = document.createElement(`style`);
    style.id = `esgst-custom-theme`;
    style.textContent = customTheme;
    document.documentElement.appendChild(style);
  }

  envVariables._USER_INFO = {extension: false};
  envVariables.browser = null;
  envVariables.gm = null;

  if (typeof GM === `undefined` && typeof GM_setValue === `undefined`) {
    [envVariables._USER_INFO.extension, envVariables.browser] = global.chrome && global.chrome.runtime ?
      [global.browser ? `firefox` : `chrome`, global.chrome] : [`edge`, global.browser];
  } else if (typeof GM === `undefined`) {
    // polyfill for userscript managers that do not support the gm-dot api
    envVariables.gm = {
      deleteValue: GM_deleteValue,
      getValue: GM_getValue,
      listValues: GM_listValues,
      getResourceUrl: GM_getResourceURL,
      setValue: GM_setValue,
      xmlHttpRequest: GM_xmlhttpRequest
    };
    for (const key in envVariables.gm) {
      const old = envVariables.gm[key];
      envVariables.gm[key] = (...args) =>
        new Promise((resolve, reject) => {
          try {
            resolve(old.apply(this, args));
          } catch (e) {
            reject(e);
          }
        });
    }
  } else {
    envVariables.gm = GM;
  }

  if (envVariables.gm) {
    (async () =>
      common.createElements(document.head, `beforeEnd`, [{
        attributes: {
          href: await envVariables.gm.getResourceUrl(`bs`),
          rel: `stylesheet`
        },
        type: `link`
      }, {
        attributes: {
          href: await envVariables.gm.getResourceUrl(`bss`),
          rel: `stylesheet`
        },
        type: `link`
      }, {
        attributes: {
          href: await envVariables.gm.getResourceUrl(`abc`),
          rel: `stylesheet`
        },
        type: `link`
      }, {
        attributes: {
          href: await envVariables.gm.getResourceUrl(`qb`),
          rel: `stylesheet`
        },
        type: `link`
      }]))();
  }

  // initialize esgst
  async function init() {
    if (document.getElementById(`esgst`)) {
      // esgst is already running
      return;
    }

    if (document.body && document.body.getAttribute(`data-esgst-action`)) {
      esgst.menuPath = true;
      esgst.settingsPath = true;
      esgst.sg = true;
      esgst.actionPage = true;
    }
    esgst.markdownParser.setBreaksEnabled(true);
    esgst.markdownParser.setMarkupEscaped(true);
    esgst.name = esgst.sg ? `sg` : `st`;

    if (envVariables._USER_INFO.extension) {
      // esgst is running as an extension
      envFunctions.setValues = values => {
        let key;
        return new Promise(resolve =>
          envVariables.browser.runtime.sendMessage({
            action: `setValues`,
            values: JSON.stringify(values)
          }, () => {
            for (key in values) {
              if (values.hasOwnProperty(key)) {
                esgst.storage[key] = values[key];
              }
            }
            resolve();
          }));
      };
      envFunctions.setValue = (key, value) => {
        return envFunctions.setValues({[key]: value});
      };
      envFunctions.getValue = async (key, value) => utils.isSet(esgst.storage[key]) ? esgst.storage[key] : value;
      envFunctions.getValues = values =>
        new Promise(resolve => {
          let output = {};
          for (let key in values) {
            if (values.hasOwnProperty(key)) {
              output[key] = utils.isSet(esgst.storage[key]) ? esgst.storage[key] : values[key];
            }
          }
          resolve(output);
        });
      envFunctions.delValues = keys =>
        new Promise(resolve =>
          envVariables.browser.runtime.sendMessage({
            action: `delValues`,
            keys: JSON.stringify(keys)
          }, () => {
            keys.forEach(key => delete esgst.storage[key]);
            resolve();
          })
        );
      envFunctions.delValue = key => {
        return envFunctions.delValues([key]);
      };
      envFunctions.getStorage = () =>
        new Promise(resolve =>
          envVariables.browser.runtime.sendMessage({
            action: `getStorage`
          }, storage => resolve(JSON.parse(storage))));
      envFunctions.notifyNewVersion = version => {
        let message;
        if (esgst.isNotifying) return;
        esgst.isNotifying = true;
        if (esgst.discussionPath) {
          message = `You are not using the latest ESGST version. Please update before reporting bugs and make sure the bugs still exist in the latest version.`;
        } else {
          message = `A new ESGST version is available.`;
        }
        let details = {
          icon: `fa-exclamation`,
          title: message,
          isTemp: true,
          onClose: () => {
            esgst.isNotifying = false;
            envFunctions.setValue(`dismissedVersion`, version);
          }
        };
        if (envVariables._USER_INFO.extension !== `firefox`) {
          details.buttons = [
            {
              color1: `green`,
              color2: ``,
              icon1: `fa-download`,
              icon2: ``,
              title1: `Download .zip`,
              title2: ``,
              callback1: open.bind(null, `https://github.com/gsrafael01/ESGST/releases/download/${version}/extension.zip`)
            },
            {
              color1: `green`,
              color2: ``,
              icon1: `fa-refresh`,
              icon2: ``,
              title1: `Reload Extension`,
              title2: ``,
              callback1: envVariables.browser.runtime.sendMessage.bind(envVariables.browser.runtime, {action: `reload`}, location.reload.bind(location))
            }
          ];
        }
        new Popup(details).open();
      };
      envFunctions.continueRequest = details =>
        new Promise(async resolve => {
          let isLocal = details.url.match(/^\//) || details.url.match(new RegExp(location.hostname));
          details.url = details.url.replace(/^\//, `https://${location.hostname}/`).replace(/^https?:/, location.href.match(/^http:/) ? `http:` : `https:`);
          if (isLocal) {
            let response = await fetch(details.url, {
              body: details.data,
              credentials: /** @type {"omit"|"include"} */ details.anon ? `omit` : `include`,
              headers: new Headers(details.headers),
              method: details.method,
              redirect: "follow"
            });
            let responseText = await response.text();
            response = {
              finalUrl: response.url,
              redirected: response.redirected,
              responseText
            };
            resolve(response);
            if (response.finalUrl.match(/www.steamgifts.com/)) {
              common.lookForPopups(response);
            }
          } else {
            envVariables.browser.runtime.sendMessage({
              action: `fetch`,
              blob: details.blob,
              fileName: details.fileName,
              manipulateCookies: envVariables._USER_INFO.extension === `firefox` && esgst.manipulateCookies,
              parameters: JSON.stringify({
                body: details.data,
                credentials: details.anon ? `omit` : `include`,
                headers: details.headers,
                method: details.method,
                redirect: `follow`
              }),
              url: details.url
            }, response => {
              response = JSON.parse(response);
              resolve(response);
              if (response.finalUrl.match(/www.steamgifts.com/)) {
                common.lookForPopups(response);
              }
            });
          }
        });
      envFunctions.addHeaderMenu = () => {
        if (!esgst.header) {
          return;
        }
        let arrow, button, className, context, dropdown, menu, position;
        if (esgst.sg) {
          className = `nav__left-container`;
          position = `beforeEnd`;
        } else {
          className = `nav_logo`;
          position = `afterEnd`;
        }
        context = document.getElementsByClassName(className)[0];
        menu = common.createElements(context, position, [{
          attributes: {
            class: `esgst-header-menu`,
            id: `esgst`,
            title: common.getFeatureTooltip()
          },
          type: `div`,
          children: [{
            attributes: {
              class: `esgst-header-menu-relative-dropdown esgst-hidden`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `esgst-header-menu-absolute-dropdown`
              },
              type: `div`,
              children: [{
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://github.com/gsrafael01/ESGST`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-github grey`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `GitHub`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Visit the GitHub page.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://github.com/gsrafael01/ESGST/issues`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-bug red`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Bugs/Suggestions`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Report bugs and/or make suggestions.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://github.com/gsrafael01/ESGST/milestones`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-map-signs blue`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Milestones`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Check out what's coming in the next version.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://www.steamgifts.com/discussion/TDyzv/`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-commenting green`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Discussion`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Visit the discussion page.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `http://steamcommunity.com/groups/esgst`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-steam green`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Steam Group`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Visit/join the Steam group.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  id: `esgst-changelog`
                },
                type: `div`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-file-text-o yellow`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Changelog`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Check out the changelog.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://www.patreon.com/gsrafael01`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-dollar grey`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Patreon`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Become a patron to support ESGST!`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row esgst-version-row`
                },
                type: `div`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-paypal grey`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Paypal (rafaelxgs@gmail.com)`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Donate to support ESGST. Thank you!`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row esgst-version-row`
                },
                type: `div`,
                children: [{
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Current Version: ${esgst.devVersion}`,
                    type: `p`
                  }]
                }]
              }]
            }]
          }, {
            attributes: {
              class: `esgst-header-menu-button`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `fa`
              },
              type: `i`,
              children: [{
                attributes: {
                  src: esgst.icon
                },
                type: `img`
              }]
            }, {
              text: `ESGST`,
              type: `node`
            }]
          }, {
            attributes: {
              class: `esgst-header-menu-button arrow`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `fa fa-angle-down`
              },
              type: `i`
            }]
          }]
        }]);
        dropdown = /** @type {HTMLElement} */ menu.firstElementChild;
        button = dropdown.nextElementSibling;
        arrow = button.nextElementSibling;
        button.addEventListener(`mousedown`, event => {
          if (event.button === 2) return;
          event.preventDefault();
          if (esgst.openSettingsInTab || event.button === 1) {
            open(`/esgst/settings`);
          } else {
            common.loadMenu();
          }
        });
        arrow.addEventListener(`click`, common.toggleHeaderMenu.bind(common, arrow, dropdown));
        document.addEventListener(`click`, common.closeHeaderMenu.bind(common, arrow, dropdown, menu), true);
        document.getElementById(`esgst-changelog`).addEventListener(`click`, common.loadChangelog.bind(common));
      };
      envVariables.browser.runtime.onMessage.addListener(message => {
        let key;
        message = JSON.parse(message);
        switch (message.action) {
          case `delValues`:
            message.values.forEach(value => delete esgst.storage[value]);
            break;
          case `setValues`:
            for (key in message.values) {
              if (message.values.hasOwnProperty(key)) {
                esgst.storage[key] = message.values[key];
              }
            }
            break;
        }
      });
    } else {
      // esgst is running as a script
      envFunctions.setValue = envVariables.gm.setValue;
      envFunctions.setValues = async values => {
        let promises = [];
        for (let key in values) {
          if (values.hasOwnProperty(key)) {
            promises.push(envVariables.gm.setValue(key, values[key]));
          }
        }
        await Promise.all(promises);
      };
      envFunctions.getValue = envVariables.gm.getValue;
      envFunctions.getValues = async values => {
        let output = {};
        let promises = [];
        for (let key in values) {
          if (values.hasOwnProperty(key)) {
            let promise = envVariables.gm.getValue(key, values[key]);
            promise.then(value => output[key] = value);
            promises.push(promise);
          }
        }
        await Promise.all(promises);
        return output;
      };
      envFunctions.delValue = envVariables.gm.deleteValue;
      envFunctions.delValues = async keys => {
        let promises = [];
        for (let i = keys.length - 1; i > -1; i--) {
          promises.push(envVariables.gm.deleteValue(keys[i]));
        }
        await Promise.all(promises);
      };
      envFunctions.getStorage = async () => {
        let keys = await envVariables.gm.listValues();
        let promises = [];
        let storage = {};
        for (let i = keys.length - 1; i > -1; i--) {
          let promise = envVariables.gm.getValue(keys[i]);
          promise.then(value => storage[keys[i]] = value);
          promises.push(promise);
        }
        await Promise.all(promises);
        return storage;
      };
      envFunctions.notifyNewVersion = version => {
        let message, popup;
        if (esgst.isNotifying) return;
        esgst.isNotifying = true;
        if (esgst.discussionPath) {
          message = `You are not using the latest ESGST version. Please update before reporting bugs and make sure the bugs still exist in the latest version.`;
        } else {
          message = `A new ESGST version is available.`;
        }
        popup = new Popup({addScrollable: true, icon: `fa-exclamation`, isTemp: true, title: message});
        common.createElements(popup.actions, `afterBegin`, [{
          text: `Update`,
          type: `span`
        }]).addEventListener(`click`, common.checkUpdate.bind(common));
        popup.onClose = () => {
          esgst.isNotifying = false;
          envFunctions.setValue(`dismissedVersion`, version);
        };
        popup.open();
      };
      envFunctions.continueRequest = details => {
        return new Promise(async resolve => {
          let isLocal = details.url.match(/^\//) || details.url.match(new RegExp(location.hostname));
          details.url = details.url.replace(/^\//, `https://${location.hostname}/`).replace(/^https?:/, location.href.match(/^http:/) ? `http:` : `https:`);
          if (isLocal) {
            let response = await fetch(details.url, {
              body: details.data,
              credentials: /** @type {"omit"|"include"} */ details.anon ? `omit` : `include`,
              headers: details.headers,
              method: details.method,
              redirect: "follow"
            });
            let responseText = await response.text();
            response = {
              finalUrl: response.url,
              redirected: response.redirected,
              responseText
            };
            resolve(response);
            if (response.finalUrl.match(/www.steamgifts.com/)) {
              common.lookForPopups(response);
            }
          } else {
            if (details.anon) {
              details.headers.Cookie = ``;
            }
            envVariables.gm.xmlHttpRequest({
              binary: !!details.fileName,
              data: details.fileName
                ? await getZip(details.data, details.fileName, `binarystring`)
                : details.data,
              headers: details.headers,
              method: details.method,
              overrideMimeType: details.blob ? `text/plain; charset=x-user-defined` : ``,
              url: details.url,
              onload: async response => {
                if (details.blob) {
                  response.responseText = (await readZip(response.responseText))[0].value;
                }
                resolve(response);
                if (response.finalUrl.match(/www.steamgifts.com/)) {
                  common.lookForPopups(response);
                }
              }
            });
          }
        });
      };
      envFunctions.addHeaderMenu = () => {
        if (!esgst.header) {
          return;
        }
        let arrow, button, className, context, dropdown, menu, position;
        if (esgst.sg) {
          className = `nav__left-container`;
          position = `beforeEnd`;
        } else {
          className = `nav_logo`;
          position = `afterEnd`;
        }
        context = document.getElementsByClassName(className)[0];
        menu = common.createElements(context, position, [{
          attributes: {
            class: `esgst-header-menu`,
            id: `esgst`,
            title: common.getFeatureTooltip()
          },
          type: `div`,
          children: [{
            attributes: {
              class: `esgst-header-menu-relative-dropdown esgst-hidden`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `esgst-header-menu-absolute-dropdown`
              },
              type: `div`,
              children: [{
                attributes: {
                  class: `esgst-header-menu-row`,
                  id: `esgst-update`
                },
                type: `div`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-refresh blue`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Update`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Check for updates.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://github.com/gsrafael01/ESGST`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-github grey`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `GitHub`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Visit the GitHub page.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://github.com/gsrafael01/ESGST/issues`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-bug red`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Bugs/Suggestions`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Report bugs and/or make suggestions.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://github.com/gsrafael01/ESGST/milestones`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-map-signs blue`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Milestones`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Check out what's coming in the next version.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://www.steamgifts.com/discussion/TDyzv/`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-commenting green`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Discussion`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Visit the discussion page.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `http://steamcommunity.com/groups/esgst`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-steam green`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Steam Group`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Visit/join the Steam group.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  id: `esgst-changelog`
                },
                type: `div`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-file-text-o yellow`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Changelog`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Check out the changelog.`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row`,
                  href: `https://www.patreon.com/gsrafael01`,
                  target: `_blank`
                },
                type: `a`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-dollar grey`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Patreon`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Become a patron to support ESGST!`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row esgst-version-row`
                },
                type: `div`,
                children: [{
                  attributes: {
                    class: `fa fa-fw fa-paypal grey`
                  },
                  type: `i`
                }, {
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-name`
                    },
                    text: `Paypal (rafaelxgs@gmail.com)`,
                    type: `p`
                  }, {
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Donate to support ESGST. Thank you!`,
                    type: `p`
                  }]
                }]
              }, {
                attributes: {
                  class: `esgst-header-menu-row esgst-version-row`
                },
                type: `div`,
                children: [{
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `esgst-header-menu-description`
                    },
                    text: `Current Version: ${esgst.devVersion}`,
                    type: `p`
                  }]
                }]
              }]
            }]
          }, {
            attributes: {
              class: `esgst-header-menu-button`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `fa`
              },
              type: `i`,
              children: [{
                attributes: {
                  src: esgst.icon
                },
                type: `img`
              }]
            }, {
              text: `ESGST`,
              type: `node`
            }]
          }, {
            attributes: {
              class: `esgst-header-menu-button arrow`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `fa fa-angle-down`
              },
              type: `i`
            }]
          }]
        }]);
        dropdown = /** @type {HTMLElement} */ menu.firstElementChild;
        button = dropdown.nextElementSibling;
        arrow = button.nextElementSibling;
        button.addEventListener(`mousedown`, event => {
          if (event.button === 2) return;
          event.preventDefault();
          if (esgst.openSettingsInTab || event.button === 1) {
            open(`/esgst/settings`);
          } else {
            common.loadMenu();
          }
        });
        arrow.addEventListener(`click`, common.toggleHeaderMenu.bind(common, arrow, dropdown));
        document.addEventListener(`click`, common.closeHeaderMenu.bind(common, arrow, dropdown, menu), true);
        document.getElementById(`esgst-update`).addEventListener(`click`, common.checkUpdate.bind(common));
        document.getElementById(`esgst-changelog`).addEventListener(`click`, common.loadChangelog.bind(common));
      };
    }

    common.setEnvironmentFunctions(envFunctions);
    common.setEnvironmentVariables(envVariables);

    let toDelete, toSet;

    // set default values or correct values
    /**
     * @property {object} esgst.storage.Emojis
     * @property {object} esgst.storage.filterPresets
     * @property {object} esgst.storage.dfPresets
     */
    esgst.storage = await envFunctions.getStorage();
    toDelete = [];
    toSet = {};
    if (utils.isSet(esgst.storage.users)) {
      esgst.users = JSON.parse(esgst.storage.users);
      let changed = false;
      for (let key in esgst.users.users) {
        if (esgst.users.users.hasOwnProperty(key)) {
          let wbc = esgst.users.users[key].wbc;
          if (wbc && wbc.result && wbc.result !== `whitelisted` && wbc.result !== `blacklisted`) {
            delete esgst.users.users[key].wbc;
            changed = true;
          }
        }
      }
      if (changed) {
        toSet.users = JSON.stringify(esgst.users);
      }
    } else {
      esgst.users = {
        steamIds: {},
        users: {}
      };
      toSet.users = JSON.stringify(esgst.users);
    }
    if (!utils.isSet(esgst.storage[`${esgst.name}RfiCache`])) {
      toSet[`${esgst.name}RfiCache`] = common.getLocalValue(`replies`, `{}`);
      common.delLocalValue(`replies`);
    }
    if (utils.isSet(esgst.storage.emojis)) {
      const fixed = common.fixEmojis(esgst.storage.emojis);
      if (esgst.storage.emojis !== fixed) {
        toSet.emojis = fixed;
      } else if (!esgst.storage.emojis) {
        toSet.emojis = `[]`;
      }
    } else {
      toSet.emojis = utils.isSet(esgst.storage.Emojis) ? common.fixEmojis(esgst.storage.Emojis) : `[]`;
      toDelete.push(`Emojis`);
    }
    esgst.emojis = JSON.parse(toSet.emojis || esgst.storage.emojis);
    if (esgst.sg) {
      if (!utils.isSet(esgst.storage.templates)) {
        toSet.templates = common.getLocalValue(`templates`, `[]`);
        common.delLocalValue(`templates`);
      }
      if (!utils.isSet(esgst.storage.stickiedCountries)) {
        toSet.stickiedCountries = common.getLocalValue(`stickiedCountries`, `[]`);
        common.delLocalValue(`stickiedCountries`);
      }
      if (utils.isSet(esgst.storage.giveaways)) {
        esgst.giveaways = JSON.parse(esgst.storage.giveaways);
      } else {
        toSet.giveaways = common.getLocalValue(`giveaways`, `{}`);
        esgst.giveaways = JSON.parse(toSet.giveaways);
        common.delLocalValue(`giveaways`);
      }
      if (utils.isSet(esgst.storage.decryptedGiveaways)) {
        esgst.decryptedGiveaways = esgst.storage.decryptedGiveaways;
        if (typeof esgst.decryptedGiveaways === `string`) {
          esgst.decryptedGiveaways = JSON.parse(esgst.decryptedGiveaways);
        } else {
          toSet.decryptedGiveaways = JSON.stringify(esgst.decryptedGiveaways);
        }
      } else {
        toSet.decryptedGiveaways = `{}`;
        esgst.decryptedGiveaways = {};
      }
      if (utils.isSet(esgst.storage.discussions)) {
        esgst.discussions = JSON.parse(esgst.storage.discussions);
      } else {
        toSet.discussions = common.getLocalValue(`discussions`, `{}`);
        esgst.discussions = JSON.parse(toSet.discussions);
        common.delLocalValue(`discussions`);
      }
      if (utils.isSet(esgst.storage.tickets)) {
        esgst.tickets = JSON.parse(esgst.storage.tickets);
      } else {
        toSet.tickets = common.getLocalValue(`tickets`, `{}`);
        esgst.tickets = JSON.parse(toSet.tickets);
        common.delLocalValue(`tickets`);
      }
      common.delLocalValue(`gFix`);
      common.delLocalValue(`dFix`);
      common.delLocalValue(`tFix`);
      if (utils.isSet(esgst.storage.groups)) {
        esgst.groups = JSON.parse(esgst.storage.groups);
      } else {
        toSet.groups = common.getLocalValue(`groups`, `[]`);
        esgst.groups = JSON.parse(toSet.groups);
        common.delLocalValue(`groups`);
      }
      if (!utils.isSet(esgst.storage.entries)) {
        toSet.entries = common.getLocalValue(`entries`, `[]`);
        common.delLocalValue(`entries`);
      }
      if (utils.isSet(esgst.storage.rerolls)) {
        esgst.rerolls = JSON.parse(esgst.storage.rerolls);
      } else {
        toSet.rerolls = common.getLocalValue(`rerolls`, `[]`);
        esgst.rerolls = JSON.parse(toSet.rerolls);
        common.delLocalValue(`rerolls`);
      }
      if (utils.isSet(esgst.storage.winners)) {
        esgst.winners = JSON.parse(esgst.storage.winners);
      } else {
        toSet.winners = common.getLocalValue(`winners`, `{}`);
        esgst.winners = JSON.parse(toSet.winners);
        common.delLocalValue(`winners`);
      }
    } else {
      if (utils.isSet(esgst.storage.trades)) {
        esgst.trades = JSON.parse(esgst.storage.trades);
      } else {
        toSet.trades = common.getLocalValue(`trades`, `{}`);
        esgst.trades = JSON.parse(toSet.trades);
        common.delLocalValue(`trades`);
      }
      common.delLocalValue(`tFix`);
    }
    let cache = JSON.parse(common.getLocalValue(`gdtttCache`, `{"giveaways":[],"discussions":[],"tickets":[],"trades":[]}`));
    for (let type in cache) {
      if (cache.hasOwnProperty(type)) {
        let doSet = false;
        cache[type].forEach(code => {
          if (!esgst[type][code]) {
            esgst[type][code] = {
              readComments: {}
            };
          }
          if (!esgst[type][code].visited) {
            doSet = true;
            esgst[type][code].visited = true;
          }
        });
        if (doSet) {
          toSet[type] = JSON.stringify(esgst[type]);
        }
      }
    }
    common.setLocalValue(`gdtttCache`, `{"giveaways":[],"discussions":[],"tickets":[],"trades":[]}`);
    if (utils.isSet(esgst.storage.games)) {
      esgst.games = JSON.parse(esgst.storage.games);
    } else {
      esgst.games = {
        apps: {},
        subs: {}
      };
      toSet.games = JSON.stringify(esgst.games);
    }
    if (utils.isSet(esgst.storage.settings)) {
      esgst.settings = JSON.parse(esgst.storage.settings);
    } else {
      esgst.settings = {};
    }
    esgst.version = esgst.storage.version;
    for (let key in esgst.settings) {
      let match = key.match(new RegExp(`(.+?)_${esgst.name}$`));
      if (match) {
        esgst[match[1]] = esgst.settings[key];
      }
    }
    for (let key in esgst.oldValues) {
      if (esgst.oldValues.hasOwnProperty(key)) {
        let localKey = key.replace(new RegExp(`(.+?)_${esgst.name}$`), `$1`);
        if (typeof esgst[localKey] === `undefined`) {
          esgst[localKey] = common.getSetting(key, key.match(/^(wbc_checkBlacklist|wbc_hb_sg)$/));
        }
      }
    }
    for (let key in esgst.defaultValues) {
      if (esgst.defaultValues.hasOwnProperty(key)) {
        let localKey = key.replace(new RegExp(`(.+?)_${esgst.name}$`), `$1`);
        if (!utils.isSet(esgst[localKey])) {
          esgst[localKey] = common.getSetting(key, key.match(/^(wbc_checkBlacklist|wbc_hb_sg)$/));
        }
      }
    }
    if (utils.isSet(esgst.storage.filterPresets)) {
      esgst.gf_presets = esgst.gf_presets.concat(
        esgst.modules.giveawaysGiveawayFilters.filters_convert(JSON.parse(esgst.storage.filterPresets))
      );
      esgst.settings.gf_presets = esgst.gf_presets;
      esgst.settingsChanged = true;
      toSet.old_gf_presets = esgst.storage.filterPresets;
      toDelete.push(`filterPresets`);
    }
    if (utils.isSet(esgst.storage.dfPresets)) {
      esgst.df_presets = esgst.df_presets.concat(
        esgst.modules.giveawaysGiveawayFilters.filters_convert(JSON.parse(esgst.storage.dfPresets))
      );
      esgst.settings.df_presets = esgst.df_presets;
      esgst.settingsChanged = true;
      toSet.old_df_presets = esgst.storage.dfPresets;
      toDelete.push(`dfPresets`);
    }

    esgst.features = common.getFeatures();
    for (let type in esgst.features) {
      if (esgst.features.hasOwnProperty(type)) {
        for (let id in esgst.features[type].features) {
          if (esgst.features[type].features.hasOwnProperty(id)) {
            common.dismissFeature(esgst.features[type].features[id], id);
            common.getFeatureSetting(esgst.features[type].features[id], id);
          }
        }
      }
    }

    [
      {id: `cec`, side: `left`},
      {id: `esContinuous`, side: `right`},
      {id: `esNext`, side: `right`},
      {id: `glwc`, side: `left`},
      {id: `mm`, side: `right`},
      {id: `stbb`, side: `right`},
      {id: `sttb`, side: `right`},
      {id: `ust`, side: `left`},
      {id: `wbm`, side: `left`}
    ].forEach(item => {
      if (esgst.leftButtonIds.indexOf(item.id) < 0 && esgst.rightButtonIds.indexOf(item.id) < 0 && esgst.leftMainPageHeadingIds.indexOf(item.id) < 0 && esgst.rightMainPageHeadingIds.indexOf(item.id) < 0) {
        esgst[`${item.side}MainPageHeadingIds`].push(item.id);
        esgst.settings.leftMainPageHeadingIds = esgst.leftMainPageHeadingIds;
        esgst.settings.rightMainPageHeadingIds = esgst.rightMainPageHeadingIds;
        esgst.settingsChanged = true;
      }
    });
    if (esgst.settings.users) {
      delete esgst.settings.users;
      esgst.settingsChanged = true;
    }
    if (esgst.settings.comments) {
      delete esgst.settings.comments;
      esgst.settingsChanged = true;
    }
    if (esgst.settings.giveaways) {
      delete esgst.settings.giveaways;
      esgst.settingsChanged = true;
    }
    if (esgst.settings.groups) {
      delete esgst.settings.groups;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories.indexOf(`gc_rd`) < 0) {
      esgst.gc_categories.push(`gc_rd`);
      esgst.settings.gc_categories = esgst.gc_categories;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories.indexOf(`gc_pw`) < 0) {
      esgst.gc_categories.push(`gc_pw`);
      esgst.settings.gc_categories = esgst.gc_categories;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories_gv.indexOf(`gc_pw`) < 0) {
      esgst.gc_categories_gv.push(`gc_pw`);
      esgst.settings.gc_categories_gv = esgst.gc_categories_gv;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories.indexOf(`gc_hltb`) < 0) {
      esgst.gc_categories.push(`gc_hltb`);
      esgst.settings.gc_categories = esgst.gc_categories;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories_gv.indexOf(`gc_hltb`) < 0) {
      esgst.gc_categories_gv.push(`gc_hltb`);
      esgst.settings.gc_categories_gv = esgst.gc_categories_gv;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories.indexOf(`gc_sp`) < 0) {
      esgst.gc_categories.push(`gc_sp`);
      esgst.settings.gc_categories = esgst.gc_categories;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories_gv.indexOf(`gc_sp`) < 0) {
      esgst.gc_categories_gv.push(`gc_sp`);
      esgst.settings.gc_categories_gv = esgst.gc_categories_gv;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories.indexOf(`gc_lg`) < 0) {
      esgst.gc_categories.push(`gc_lg`);
      esgst.settings.gc_categories = esgst.gc_categories;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories_gv.indexOf(`gc_lg`) < 0) {
      esgst.gc_categories_gv.push(`gc_lg`);
      esgst.settings.gc_categories_gv = esgst.gc_categories_gv;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories.indexOf(`gc_f`) < 0) {
      esgst.gc_categories.push(`gc_f`);
      esgst.settings.gc_categories = esgst.gc_categories;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories_gv.indexOf(`gc_f`) < 0) {
      esgst.gc_categories_gv.push(`gc_f`);
      esgst.settings.gc_categories_gv = esgst.gc_categories_gv;
      esgst.settingsChanged = true;
    }
    if (esgst.gc_categories_ids.indexOf(`gc_f`) < 0) {
      esgst.gc_categories_ids.push(`gc_f`);
      esgst.settings.gc_categories_ids = esgst.gc_categories_ids;
      esgst.settingsChanged = true;
    }
    [`gc_categories`, `gc_categories_gv`, `gc_categories_ids`].forEach(key => {
      let bkpLength = esgst[key].length;
      esgst[key] = Array.from(new Set(esgst[key]));
      if (bkpLength !== esgst[key].length) {
        esgst.settings[key] = esgst[key];
        esgst.settingsChanged = true;
      }
    });
    [``, `_gv`].forEach(key => {
      if (esgst[`giveawayColumns${key}`].indexOf(`sgTools`) < 0 && esgst[`giveawayPanel${key}`].indexOf(`sgTools`) < 0) {
        if (key === ``) {
          esgst[`giveawayPanel${key}`].push(`sgTools`);
          esgst.settings[`giveawayPanel${key}`] = esgst[`giveawayPanel${key}`];
        } else {
          esgst[`giveawayColumns${key}`].unshift(`sgTools`);
          esgst.settings[`giveawayColumns${key}`] = esgst[`giveawayColumns${key}`];
        }
        esgst.settingsChanged = true;
      }
      if (esgst[`giveawayColumns${key}`].indexOf(`ged`) < 0 && esgst[`giveawayPanel${key}`].indexOf(`ged`) < 0) {
        esgst[`giveawayColumns${key}`].unshift(`ged`);
        esgst.settings[`giveawayColumns${key}`] = esgst[`giveawayColumns${key}`];
        esgst.settingsChanged = true;
      }
      if (esgst[`giveawayColumns${key}`].indexOf(`touhou`) < 0 && esgst[`giveawayPanel${key}`].indexOf(`touhou`) < 0) {
        esgst[`giveawayColumns${key}`].push(`touhou`);
        esgst.settings[`giveawayColumns${key}`] = esgst[`giveawayColumns${key}`];
        esgst.settingsChanged = true;
      }
      if (esgst[`giveawayColumns${key}`].indexOf(`gptw`) < 0 && esgst[`giveawayPanel${key}`].indexOf(`gptw`) < 0) {
        esgst[`giveawayPanel${key}`].push(`gptw`);
        esgst.settings[`giveawayPanel${key}`] = esgst[`giveawayPanel${key}`];
        esgst.settingsChanged = true;
      }
      for (let i = esgst[`giveawayColumns${key}`].length - 1; i > -1; i--) {
        let id = esgst[`giveawayColumns${key}`][i];
        if (esgst[`giveawayPanel${key}`].indexOf(id) > -1) {
          esgst[`giveawayColumns${key}`].splice(i, 1);
          esgst.settings[`giveawayColumns${key}`] = esgst[`giveawayColumns${key}`];
          esgst.settingsChanged = true;
        }
      }
      for (let i = esgst[`giveawayPanel${key}`].length - 1; i > -1; i--) {
        let id = esgst[`giveawayPanel${key}`][i];
        if (esgst[`giveawayColumns${key}`].indexOf(id) > -1) {
          esgst[`giveawayPanel${key}`].splice(i, 1);
          esgst.settings[`giveawayPanel${key}`] = esgst[`giveawayPanel${key}`];
          esgst.settingsChanged = true;
        }
      }
    });
    if (esgst.settings.elementOrdering !== `1`) {
      const oldLeftButtonIds = JSON.stringify(esgst.leftButtonIds);
      const oldRightButtonIds = JSON.stringify(esgst.rightButtonIds);
      const oldLeftMainPageHeadingIds = JSON.stringify(esgst.leftMainPageHeadingIds);
      const oldRightMainPageHeadingIds = JSON.stringify(esgst.rightMainPageHeadingIds);
      for (let i = esgst.leftButtonIds.length - 1; i > -1; i--) {
        const id = esgst.leftButtonIds[i];
        if (!esgst.settings[`hideButtons_${id}_sg`]) {
          esgst.leftMainPageHeadingIds.push(id);
          esgst.leftButtonIds.splice(i, 1);
        } else if (esgst.rightButtonIds.indexOf(id) > -1) {
          esgst.leftButtonIds.splice(i, 1);
        }
      }
      for (let i = esgst.rightButtonIds.length - 1; i > -1; i--) {
        const id = esgst.rightButtonIds[i];
        if (!esgst.settings[`hideButtons_${id}_sg`]) {
          esgst.rightMainPageHeadingIds.push(id);
          esgst.rightButtonIds.splice(i, 1);
        } else if (esgst.leftButtonIds.indexOf(id) > -1) {
          esgst.rightButtonIds.splice(i, 1);
        }
      }
      for (let i = esgst.leftMainPageHeadingIds.length - 1; i > -1; i--) {
        const id = esgst.leftMainPageHeadingIds[i];
        if (esgst.settings[`hideButtons_${id}_sg`]) {
          esgst.leftButtonIds.push(id);
          esgst.leftMainPageHeadingIds.splice(i, 1);
        } else if (esgst.rightMainPageHeadingIds.indexOf(id) > -1) {
          esgst.leftMainPageHeadingIds.splice(i, 1);
        }
      }
      for (let i = esgst.rightMainPageHeadingIds.length - 1; i > -1; i--) {
        const id = esgst.rightMainPageHeadingIds[i];
        if (esgst.settings[`hideButtons_${id}_sg`]) {
          esgst.rightButtonIds.push(id);
          esgst.rightMainPageHeadingIds.splice(i, 1);
        } else if (esgst.leftMainPageHeadingIds.indexOf(id) > -1) {
          esgst.rightMainPageHeadingIds.splice(i, 1);
        }
      }
      esgst.leftButtonIds = Array.from(/** @type {ArrayLike} **/ new Set(esgst.leftButtonIds));
      esgst.rightButtonIds = Array.from(/** @type {ArrayLike} **/ new Set(esgst.rightButtonIds));
      esgst.leftMainPageHeadingIds = Array.from(new Set(esgst.leftMainPageHeadingIds));
      esgst.rightMainPageHeadingIds = Array.from(new Set(esgst.rightMainPageHeadingIds));
      if (oldLeftButtonIds !== JSON.stringify(esgst.leftButtonIds)) {
        esgst.settings.leftButtonIds = esgst.leftButtonIds;
      }
      if (oldRightButtonIds !== JSON.stringify(esgst.rightButtonIds)) {
        esgst.settings.rightButtonIds = esgst.rightButtonIds;
      }
      if (oldLeftMainPageHeadingIds !== JSON.stringify(esgst.leftMainPageHeadingIds)) {
        esgst.settings.leftMainPageHeadingIds = esgst.leftMainPageHeadingIds;
      }
      if (oldRightMainPageHeadingIds !== JSON.stringify(esgst.rightMainPageHeadingIds)) {
        esgst.settings.rightMainPageHeadingIds = esgst.rightMainPageHeadingIds;
      }
      esgst.settings.elementOrdering = `1`;
      esgst.settingsChanged = true;
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', load.bind(null, toDelete, toSet));
    } else {
      // noinspection JSIgnoredPromiseFromCall
      load(toDelete, toSet);
    }
  }

  async function load(toDelete, toSet) {
    const mainStyle = document.getElementById(`esgst-main-style`);
    if (mainStyle) {
      document.head.insertBefore(mainStyle, document.head.firstElementChild);
    }
    if (esgst.menuPath) {
      common.createElements(document.head, `beforeEnd`, [{
        attributes: {
          href: `https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css`,
          rel: `stylesheet`
        },
        type: `link`
      }]);
      const element = document.querySelector(`[href*="https://cdn.steamgifts.com/css/static.css"]`);
      if (element) {
        element.remove();
      }
      document.body.innerHTML = ``;
    }
    common.addStyle();
    if (esgst.sg) {
      try {
        let avatar = document.getElementsByClassName(`nav__avatar-inner-wrap`)[0].style.backgroundImage.match(/\("(.+)"\)/)[1];
        if (esgst.settings.avatar !== avatar) {
          esgst.avatar = esgst.settings.avatar = avatar;
          esgst.settingsChanged = true;
        }
        let username = document.getElementsByClassName(`nav__avatar-outer-wrap`)[0].href.match(/\/user\/(.+)/)[1];
        if (esgst.settings.username_sg !== username) {
          esgst.username = esgst.settings.username_sg = username;
          esgst.settingsChanged = true;
        }
        if (!esgst.settings.registrationDate_sg || !esgst.settings.steamId) {
          let responseHtml = utils.parseHtml((await common.request({
            method: `GET`,
            url: `https://www.steamgifts.com/user/${esgst.settings.username_sg}`
          })).responseText);
          let elements = responseHtml.getElementsByClassName(`featured__table__row__left`);
          for (let i = 0, n = elements.length; i < n; i++) {
            let element = elements[i];
            if (element.textContent === `Registered`) {
              esgst.registrationDate = esgst.settings.registrationDate_sg = parseInt(element.nextElementSibling.firstElementChild.getAttribute(`data-timestamp`));
              break;
            }
          }
          esgst.steamId = esgst.settings.steamId = responseHtml.querySelector(`a[href*="/profiles/"]`).getAttribute(`href`).match(/\d+/)[0];
          esgst.settingsChanged = true;
        }
      } catch (e) { /**/
      }
    } else {
      try {
        let avatar = document.getElementsByClassName(`nav_avatar`)[0].style.backgroundImage.match(/\("(.+)"\)/)[1];
        if (esgst.settings.avatar !== avatar) {
          esgst.avatar = esgst.settings.avatar = avatar;
          esgst.settingsChanged = true;
        }
        let username = document.querySelector(`.author_name[href*="/user/${esgst.settings.steamId}"], .underline[href*="/user/${esgst.settings.steamId}"]`).textContent;
        if (esgst.settings.username_st !== username) {
          esgst.username = esgst.settings.username_st = username;
          esgst.settingsChanged = true;
        }
      } catch (e) { /**/
      }
    }
    if (esgst.settingsChanged) {
      toSet.settings = JSON.stringify(esgst.settings);
    }
    if (Object.keys(toSet).length) {
      await envFunctions.setValues(toSet);
    }
    if (Object.keys(toDelete).length) {
      await envFunctions.delValues(toDelete);
    }

    // now that all values are set esgst can begin to load

    /* [URLR] URL Redirector */
    if (esgst.urlr && location.pathname.match(/^\/(giveaway|discussion|support\/ticket|trade)\/.{5}$/)) {
      location.href = `${location.href}/`;
    }

    if (location.pathname.match(/esgst-settings/)) {
      location.href = `/esgst/settings`;
    } else if (location.pathname.match(/esgst-sync/)) {
      location.href = `/esgst/sync`;
    } else if (location.pathname.match(/^\/esgst\/dropbox/)) {
      await envFunctions.setValue(`dropboxToken`, location.hash.match(/access_token=(.+?)&/)[1]);
      close();
    } else if (location.pathname.match(/^\/esgst\/google-drive/)) {
      await envFunctions.setValue(`googleDriveToken`, location.hash.match(/access_token=(.+?)&/)[1]);
      close();
    } else if (location.pathname.match(/^\/esgst\/onedrive/)) {
      await envFunctions.setValue(`oneDriveToken`, location.hash.match(/access_token=(.+?)&/)[1]);
      close();
    } else if (location.pathname.match(/^\/esgst\/imgur/)) {
      await envFunctions.setValue(`imgurToken`, location.hash.match(/access_token=(.+?)&/)[1]);
      close();
    } else {
      esgst.logoutButton = document.querySelector(`.js__logout, .js_logout`);
      if (!esgst.logoutButton && !esgst.menuPath) {
        // user is not logged in
        return;
      }
      if (esgst.st && !esgst.settings.esgst_st) {
        // esgst is not enabled for steamtrades
        return;
      }
      esgst.lastPage = esgst.modules.generalLastPageLink.lpl_getLastPage(document, true);
      await common.getElements();
      if (esgst.sg && !esgst.menuPath) {
        // noinspection JSIgnoredPromiseFromCall
        common.checkSync()
      }
      if (esgst.autoBackup) {
        common.checkBackup();
      }
      if (esgst.profilePath && esgst.autoSync) {
        document.getElementsByClassName(`form__sync-default`)[0].addEventListener(`click`, common.setSync.bind(common, true, null, null));
      }
      if (esgst.menuPath) {
        esgst.favicon.href = esgst.icon;
        if (esgst.actionPage) {
          common.createElements(document.body, `inner`, [{
            attributes: {
              class: `page__outer-wrap`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `page__inner-wrap`
              },
              type: `div`
            }]
          }]);
          esgst.pageOuterWrap = document.body.firstElementChild;
          esgst.pageOuterWrap.style.width = `calc(100% - ${innerWidth - document.documentElement.offsetWidth}px)`;
          esgst.mainContext = esgst.pageOuterWrap.lastElementChild;
        } else {
          let response = await common.request({
            method: `GET`,
            url: esgst.sg ? `https://www.steamgifts.com/` : `https://www.steamtrades.com`
          });
          let responseHtml = utils.parseHtml(response.responseText);
          common.createElements(document.body, `inner`, [{
            context: responseHtml.getElementsByTagName(`header`)[0]
          }, {
            attributes: {
              class: `page__outer-wrap`
            },
            type: `div`,
            children: [{
              attributes: {
                class: `page__inner-wrap`
              },
              type: `div`
            }]
          }, {
            context: responseHtml.getElementsByClassName(`footer__outer-wrap`)[0]
          }]);
          esgst.header = /** @type {HTMLElement} */ document.body.firstElementChild;
          esgst.footer = /** @type {HTMLElement} */ document.body.lastElementChild;
          esgst.headerNavigationLeft = /** @type {HTMLElement} */ document.getElementsByClassName(`nav__left-container`)[0];
          esgst.pageOuterWrap = esgst.header.nextElementSibling;
          esgst.mainContext = esgst.pageOuterWrap.lastElementChild;
          esgst.logoutButton = document.querySelector(`.js__logout, .js_logout`);
          if (esgst.logoutButton) {
            esgst.xsrfToken = esgst.logoutButton.getAttribute(`data-form`).match(/xsrf_token=(.+)/)[1];
          }
          await esgst.modules.generalHeaderRefresher.hr_refreshHeaderElements(document);
        }

        if (esgst.settingsPath) {
          document.title = `ESGST - Settings`;
          common.loadMenu(true);
        } else if (esgst.importMenuPath) {
          document.title = `ESGST - Restore`;
          common.loadDataManagement(true, `import`);
        } else if (esgst.exportMenuPath) {
          document.title = `ESGST - Backup`;
          common.loadDataManagement(true, `export`);
        } else if (esgst.deleteMenuPath) {
          document.title = `ESGST - Delete`;
          common.loadDataManagement(true, `delete`);
        } else if (esgst.gbPath) {
          document.title = `ESGST - Giveaway Bookmarks`;
          esgst.originalTitle = `ESGST - Giveaway Bookmarks`;
        } else if (esgst.gedPath) {
          document.title = `ESGST - Decrypted Giveaways`;
          esgst.originalTitle = `ESGST - Decrypted Giveaways`;
        } else if (esgst.gePath) {
          document.title = `ESGST - Extracted Giveaways`;
          esgst.originalTitle = `ESGST - Extracted Giveaways`;
        } else if (esgst.glwcPath) {
          document.title = `ESGST - Group Library/Wishlist Checker`;
          esgst.originalTitle = `ESGST - Group Library/Wishlist Checker`;
        } else if (location.pathname.match(/esgst\/sync/)) {
          await common.setSync();
        }

        // make the header dropdown menus work
        let elements = document.querySelectorAll(`nav .nav__button--is-dropdown-arrow`);
        for (let element of elements) {
          element.addEventListener(`click`, event => {
            let isSelected = element.classList.contains(`is-selected`);
            let buttons = document.querySelectorAll(`nav .nav__button`);
            for (let button of buttons) {
              button.classList.remove(`is-selected`);
            }
            let dropdowns = document.querySelectorAll(`nav .nav__relative-dropdown`);
            for (let dropdown of dropdowns) {
              dropdown.classList.add(`is-hidden`);
            }
            if (!isSelected) {
              element.classList.add(`is-selected`);
              (element.previousElementSibling.previousElementSibling || element.nextElementSibling).classList.remove(`is-hidden`);
            }
            event.stopPropagation();
          });
        }
        document.addEventListener(`click`, () => {
          let buttons = document.querySelectorAll(`nav .nav__button, .page__heading__button--is-dropdown`);
          for (let button of buttons) {
            button.classList.remove(`is-selected`);
          }
          let dropdowns = document.querySelectorAll(`nav .nav__relative-dropdown`);
          for (let dropdown of dropdowns) {
            dropdown.classList.add(`is-hidden`);
          }
        });
      }

      envFunctions.addHeaderMenu();
      common.showPatreonNotice();
      // noinspection JSIgnoredPromiseFromCall
      common.checkNewVersion();
      await common.loadFeatures(esgst.modules);
    }
  }

  // noinspection JSIgnoredPromiseFromCall
  init();
})();
