import constants from "../../constants.js";
import utils from "../../utils.js";
import { cloneTemplate } from "../../../components/utils.js";

const { DwController } = WebCardinal.controllers;
const { promisify } = utils;

class GroupsUI extends DwController {
  constructor(...props) {
    super(...props);
  }

  // listeners

  // addBlockchainDomainListener() {
  //   const inputElement = this.getElementByTag("blockchain-domain");
  //
  //   const nativeElement = inputElement.shadowRoot.querySelector("[part=input]");
  //   if (!(nativeElement instanceof HTMLElement)) return;
  //
  //   const buttonElements = inputElement.querySelectorAll("sl-button");
  //   const [editButtonElement, saveButtonElement] = buttonElements;
  //
  //   editButtonElement.addEventListener("click", (event) => {
  //     event.stopPropagation();
  //     editButtonElement.setAttribute("hidden", "");
  //     saveButtonElement.removeAttribute("hidden");
  //     inputElement.disabled = false;
  //     setTimeout(() => {
  //       nativeElement.focus();
  //       nativeElement.setSelectionRange(0, nativeElement.value.length);
  //     });
  //   });
  //
  //   saveButtonElement.addEventListener("click", (event) => {
  //     event.stopPropagation();
  //     saveButtonElement.setAttribute("hidden", "");
  //     editButtonElement.removeAttribute("hidden");
  //     inputElement.disabled = true;
  //   });
  // }

  addGroupContentListener() {
    const key = "dw:groups:active-tab";
    const part = "group-content";
    const rootElement = this.querySelector(`#dw-${part}`);
    const subParts = {
      [part]: ["group-members", "group-credentials", "group-databases"],
    };

    this.model.onChange("selectedGroup", ({ targetChain }) => {
      if (targetChain !== "selectedGroup") {
        return;
      }

      rootElement.innerHTML = "";

      this.updateState("selectedGroup", this.model.selectedGroup);

      if (!this.model.selectedGroup) {
        return;
      }

      const documentFragment = cloneTemplate(part);

      for (const subPart of subParts[part]) {
        const parentElement = documentFragment.querySelector(`#dw-${subPart}`);
        parentElement.append(cloneTemplate(subPart));
      }

      rootElement.hidden = true;
      rootElement.append(documentFragment);

      const tabGroupElement = rootElement.querySelector("sl-tab-group");
      const storedActiveTab = localStorage.getItem(key);

      tabGroupElement.addEventListener("sl-tab-show", (event) => {
        const tab = event.detail.name;

        if (tab === "members") {
          localStorage.removeItem(key);
        }

        localStorage.setItem(key, tab);
      });

      if (tabGroupElement && storedActiveTab) {
        setTimeout(async () => {
          await tabGroupElement.show(storedActiveTab);
          rootElement.hidden = false;
        });
      } else {
        rootElement.hidden = false;
      }
    });
  }

  // methods

  async addGroup(model, target) {
    return await this.ui.submitGenericForm(model, target);
  }

  async selectGroup(model, target) {
    if (target.checked) {
      target.checked = false;
      return undefined;
    }

    Array.from(target.parentElement.parentElement.children).forEach((item) => {
      item.firstElementChild.checked = false;
    });

    target.checked = true;
    return model;
  }
}

class GroupsController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;

    this.model = {
      // blockchainDomain: "example.domain",
      groups: [],
      selectedGroup: undefined,
      areGroupsLoaded: false,
    };

    ui.page = new GroupsUI(...props);
    // ui.page.addBlockchainDomainListener();
    ui.page.addGroupContentListener.call(this);

    this.onTagClick("group.add", async (...props) => {
      try {
        const { name } = await ui.page.addGroup(...props);
        const group = await this.addGroup({ name });
        this.model.selectedGroup = undefined;
        this.model.groups.push(group);
        await ui.showToast(group);
      } catch (err) {
        console.log(err);
      }
    });

    this.onTagClick("group.select", async (...props) => {
      const selectedGroup = await ui.page.selectGroup(...props);
      this.model.selectedGroup = selectedGroup;
      await ui.showToast(selectedGroup);
    });

    this.onTagClick("group.delete", async (deletedGroup) => {
      try {
        await this.deleteGroup(deletedGroup);
        this.model.selectedGroup = undefined;
        this.model.groups = this.model.groups.filter((group) => group.did !== deletedGroup.did);
        await ui.showToast(deletedGroup);
      } catch (err) {
        console.log(err);
      }
    });

    setTimeout(async () => {
      this.model.groups = await this.fetchGroups();
      this.model.areGroupsLoaded = true;
    });
  }

  async fetchGroups() {
    return await this.storageService.filterAsync(constants.TABLES.GROUPS);
  }

  /**
   * @param {object} group
   * @param {string} group.name
   **/
  async addGroup(group) {
    const w3cdid = require("opendsu").loadAPI("w3cdid");
    const groupDIDDocument = await promisify(w3cdid.createIdentity)("group", constants.DOMAIN, group.name);
    group.did = groupDIDDocument.getIdentifier();
    await this.storageService.insertRecordAsync(constants.TABLES.GROUPS, group.did, group);
    await promisify(groupDIDDocument.addMember)(this.identity.did, {
      did: this.identity.did,
      username: this.identity.username,
    });
    return group;
  }

  /**
   * @param {object} group
   * @param {string} group.did
   **/
  async deleteGroup(group) {
    await this.storageService.deleteRecordAsync(constants.TABLES.GROUPS, group.did);
  }
}

export default GroupsController;