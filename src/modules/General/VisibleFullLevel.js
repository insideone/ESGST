import Module from '../../class/Module';

class VisibleFullLevel extends Module {
  constructor() {
    super();
    this.info = {
      description: `
      <ul>
        <li>Displays the full level at the header, instead of only showing it when hovering over the level. For example, "Level 5" becomes "Lvl 5.25".</li>
      </ul>
    `,
      id: `vfl`,
      name: `Visible Full Level`,
      sg: true,
      type: `general`
    };
  }

  init() {
    this.esgst.triggerFunctions.onLevelContainerUpdated.push(this.update.bind(this));
  }

  update() {
    if (!this.esgst.levelContainer) {
      return;
    }
    this.esgst.levelContainer.textContent = `Lvl ${this.esgst.levelContainer.getAttribute(`title`).match(/(\d+?\.\d+|\d+)/)[1]}`;
  }
}

export default VisibleFullLevel;