import Module from '../../class/Module';
import Popup from '../../class/Popup';
import {common} from '../Common';

const
  getLocalValue = common.getLocalValue.bind(common),
  setLocalValue = common.setLocalValue.bind(common)
;

class GeneralCakeDayReminder extends Module {
  constructor() {
    super();
    this.info = {
      description: `
      <ul>
        <li>Shows a popup reminding you of your cake day on SteamGifts.</li>
        <li>You can set it to remind you a specified number of days before your cake day.</li>
      </ul>
    `,
      features: {
        cdr_b: {
          inputItems: [
            {
              id: `cdr_days`,
              prefix: `Days: `
            }
          ],
          name: `Remind you a specified number of days before your cake day.`,
          sg: true
        },
        cdr_d: {
          description: `
          <ul>
            <li>With this option enabled, the feature also reminds you if some days have already passed since your cake day and you had not logged in during that time.</li>
          </ul>
        `,
          name: `Remind you on your cake day.`,
          sg: true
        }
      },
      id: `cdr`,
      load: this.cdr,
      name: `Cake Day Reminder`,
      sg: true,
      type: `general`
    };
  }

  cdr() {
    let currentDate = new Date();
    let year = currentDate.getFullYear();
    let time = currentDate.getTime();
    let registrationDate = new Date(this.esgst.registrationDate * 1e3);
    registrationDate.setFullYear(year);
    registrationDate = registrationDate.getTime();
    const bYear = parseInt(getLocalValue(`cdr_bYear`, 0));
    let dYear = getLocalValue(`cdr_dYear`);
    if (dYear) {
      dYear = parseInt(dYear);
    } else {
      setLocalValue(`cdr_dYear`, year);
      dYear = year;
    }
    if (this.esgst.cdr_b && bYear !== year && time < registrationDate && time + (this.esgst.cdr_days * 86400000) >= registrationDate) {
      setLocalValue(`cdr_bYear`, year);
      new Popup({
        addScrollable: true,
        icon: `fa-birthday-cake`,
        isTemp: true,
        title: `ESGST reminder: your cake day is in ${Math.floor((registrationDate - time) / 86400000)} days.`
      }).open();
    } else if (this.esgst.cdr_d && dYear !== year && time >= registrationDate) {
      setLocalValue(`cdr_dYear`, year);
      if (time >= registrationDate + 86400000) {
        new Popup({
          addScrollable: true,
          icon: `fa-birthday-cake`,
          isTemp: true,
          title: `ESGST reminder: your cake day was ${Math.floor((time - registrationDate) / 86400000)} days ago.`
        }).open();
      } else {
        new Popup({
          addScrollable: true,
          icon: `fa-birthday-cake`,
          isTemp: true,
          title: `ESGST reminder: your cake day is today. Happy cake day!`
        }).open();
      }
    }
  }
}

export default GeneralCakeDayReminder;