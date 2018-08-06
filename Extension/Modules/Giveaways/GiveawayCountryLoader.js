_MODULES.push({
    description: `
      <ul>
        <li>If you click on/hover over (you can decide which one) the region restricted icon (<i class="fa fa-globe"></i>) of a giveaway (in any page) it shows the countries that the giveaway is restricted to.</li>
      </ul>
    `,
    id: `gcl`,
    load: gcl,
    name: `Giveaway Country Loader`,
    options: {
      title: `Load as:`,
      values: [`Popout (On Hover)`, `Popout (On Click)`, `Popup (On Click)`]
    },
    sg: true,
    type: `giveaways`
  });

  function gcl() {
    esgst.giveawayFeatures.push(gcl_setButton);
  }

  function gcl_setButton(giveaways, main) {
    if (main && (esgst.createdPath || esgst.enteredPath || esgst.wonPath)) return;
    giveaways.forEach(giveaway => {
      let container, context, delay, eventType, exitTimeout, onClick, timeout;
      if (giveaway.regionRestricted) {
        switch (esgst.gcl_index) {
          case 0:
            eventType = `mouseenter`;
            onClick = false;
            delay = 1000;
            giveaway.regionRestricted.addEventListener(`mouseleave`, event => {
              if (timeout) {
                clearTimeout(timeout);
                timeout = null;
              }
              exitTimeout = setTimeout(() => {
                if (context && !container.contains(event.relatedTarget)) {
                  context.close();
                }
              }, 1000);
            });
            giveaway.regionRestricted.addEventListener(`click`, () => {
              if (timeout) {
                clearTimeout(timeout);
                timeout = null;
              }
            });
            break;
          case 1:
            eventType = `click`;
            onClick = true;
            delay = 0;
            giveaway.regionRestricted.removeAttribute(`href`);
            giveaway.regionRestricted.classList.add(`esgst-clickable`);
            break;
          case 2:
            eventType = `click`;
            delay = 0;
            giveaway.regionRestricted.removeAttribute(`href`);
            giveaway.regionRestricted.classList.add(`esgst-clickable`);
            break;
        }
        giveaway.regionRestricted.addEventListener(eventType, () => {
          timeout = setTimeout(async () => {
            if (context) {
              switch (esgst.gcl_index) {
                case 0:
                  context.open(giveaway.regionRestricted);
                  break;
                case 1:
                  if (context.isOpen) {
                    context.close();
                  } else {
                    context.open(giveaway.regionRestricted);
                  }
                  break;
                case 2:
                  context.open();
                  break;
              }
            } else {
              if (esgst.gcl_index === 2) {
                context = new Popup(`fa-globe`, [{
                  attributes :{
                    href: `${giveaway.url}/region-restrictions`
                  },
                  text: `Giveaway Countries`,
                  type: `a`
                }]);
                container = context.scrollable;
                context.open();
              } else {
                context = new Popout(`esgst-gcl-popout`, null, 1000, onClick);
                container = context.popout;
                context.open(giveaway.regionRestricted);
              }
              createElements(container, `inner`, [{
                attributes: {
                  class: `fa fa-circle-o-notch fa-spin`
                },
                type: `i`
              }, {
                text: `Loading countries...`,
                type: `span`
              }]);
              const countries = await gcl_getCountries(1, `${giveaway.url}/region-restrictions/search?page=`);
              if (countries) {
                createElements(container, `inner`, [{
                  attributes: {
                    placeholder: `Search country...`,
                    type: `text`
                  },
                  type: `input`
                }, {
                  attributes: {
                    class: `esgst-text-left table`
                  },
                  type: `div`,
                  children: [{
                    attributes: {
                      class: `table__rows`
                    },
                    type: `div`
                  }]
                }]);
                container.firstElementChild.addEventListener(`input`, () => {
                  let elements, i, value;
                  value = container.firstElementChild.value.toLowerCase();
                  elements = container.lastElementChild.firstElementChild.children;
                  if (value) {
                    for (i = elements.length - 1; i > -1; --i) {
                      const element = elements[i];
                      if (element.getElementsByClassName(`table__column__heading`)[0].textContent.toLowerCase().match(value)) {
                        element.classList.remove(`esgst-hidden`);
                      } else {
                        element.classList.add(`esgst-hidden`);
                      }
                    }
                  } else {
                    for (i = elements.length - 1; i > -1; --i) {
                      elements[i].classList.remove(`esgst-hidden`);
                    }
                  }
                  context.reposition();
                });
                for (const country of countries) {
                  container.lastElementChild.firstElementChild.appendChild(country);
                }
                await endless_load(container);
                if (esgst.gcl_index === 1) {
                  createElements(container, `afterBegin`, [{
                    attributes: {
                      class: `esgst-ggl-heading`,
                      href: `${giveaway.url}/region-restrictions`
                    },
                    text: `Giveaway Countries`,
                    type: `a`
                  }]);
                }
                context.reposition();
              } else {
                createElements(container, `inner`, [{
                  attributes: {
                    class: `fa fa-times-circle`
                  },
                  type: `i`
                }, {
                  text: `An error ocurred.`,
                  type: `span`
                }]);
                if (esgst.gcl_index === 1) {
                  createElements(container, `afterBegin`, [{
                    attributes: {
                      class: `esgst-ggl-heading`,
                      href: `${giveaway.url}/region-restrictions`
                    },
                    text: `Giveaway Countries`,
                    type: `a`
                  }]);
                }
                context.reposition();
              }
            }
            if (esgst.gcl_index === 0) {
              container.onmouseenter = () => {
                if (exitTimeout) {
                  clearTimeout(exitTimeout);
                  exitTimeout = null;
                }
              };
            }
          }, delay);
        });
      }
    });
  }

  async function gcl_getCountries(nextPage, url) {
    const countries = [];
    let pagination = null;
    do {
      const responseHtml = parseHtml((await request({
        method: `GET`,
        url: `${url}${nextPage}`
      })).responseText);
      if (responseHtml.getElementsByClassName(`table--summary`)[0]) {
        return;
      }
      countries.push(...responseHtml.getElementsByClassName(`table__row-outer-wrap`));
      pagination = responseHtml.getElementsByClassName(`pagination__navigation`)[0];
      nextPage += 1;
    } while (pagination && !pagination.lastElementChild.classList.contains(`is-selected`));
    return countries;
  }
