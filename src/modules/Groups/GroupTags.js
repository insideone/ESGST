import Module from '../../class/Module';

class GroupsGroupTags extends Module {
  constructor() {
    super();
    this.info = {
      description: `
      <ul>
        <li>Adds a button (<i class="fa fa-tag"></i>) next to a group's name (in any page) that allows you to save tags for the group (only visible to you).</li>
        <li>You can press Enter to save the tags.</li>
        <li>Each tag can be colored individually.</li>
        <li>There is a button (<i class="fa fa-list"></i>) in the tags popup that allows you to view a list with all of the tags that you have used ordered from most used to least used.</li>
        <li>Adds a button (<i class="fa fa-gamepad"></i> <i class="fa fa-tags"></i>) to the page heading of this menu that allows you to manage all of the tags that have been saved.</li>
      </ul>
    `,
      features: {
        gpt_s: {
          name: `Show tag suggestions while typing.`,
          sg: true,
          st: true
        }
      },
      id: `gpt`,
      load: this.gpt,
      name: `Group Tags`,
      sg: true,
      type: `groups`
    };
  }

  gpt() {
    const tagsModule = this.esgst.modules.tags;
    this.esgst.groupFeatures.push(tagsModule.tags_addButtons.bind(tagsModule, `gpt`));
    // noinspection JSIgnoredPromiseFromCall
    tagsModule.tags_getTags(`gpt`);
  }
}

export default GroupsGroupTags;