import constants from "../constants.js";

const { DwController } = WebCardinal.controllers;
import MessagesService from "../services/MessagesService.js";
import utils from "../utils.js";

class BootingIdentityController extends DwController {
  constructor(...props) {
    super(...props);
    const { ui } = this;
    ui.disableMenu();

    console.log("BootingIdentityController");

    this.model = {
      domain: this.domain,
      username: this.userDetails.username,
    };

    let didDocument;

    this.onTagEvent("did-component", "did-generate", async (readOnlyModel) => {
      didDocument = readOnlyModel.didDocument;
      await ui.showDialogFromComponent(
        "dw-dialog-booting-identity",
        {
          did: didDocument.getIdentifier(),
        },
        {
          parentElement: this.element,
        }
      );
    });

    this.onTagClick("did-confirm", async (model, button) => {
      button.loading = true;
      if (didDocument) {
        const { setStoredDID } = await import("../services/BootingIdentityService.js");
        const did = didDocument.getIdentifier();
        await setStoredDID(did, this.model.username);
        this.did = did;
        this.domain = didDocument.getDomain();
        const openDSU = require("opendsu");
        const scAPI = openDSU.loadAPI("sc");
        const dbAPI = openDSU.loadAPI("db");
        const w3cDID = openDSU.loadAPI("w3cdid");
        const enclaveDB = await $$.promisify(dbAPI.getMainEnclaveDB)()
        ui.hideDialogFromComponent("dw-dialog-booting-identity");
        const didDomain = await $$.promisify(scAPI.getDIDDomain)();
        const publicName = "first_demiurge_identity";

        const __waitForMessage = ()=>{
          didDocument.readMessage(async (err, message) => {
            message = JSON.parse(message);
            if (message.sender === this.did) {
              ui.enableMenu();
              this.navigateToPageTag("quick-actions");
              return;
            }

            await utils.addSharedEnclaveToEnv(message.enclave.enclaveType, message.enclave.enclaveDID, message.enclave.enclaveKeySSI);
            ui.enableMenu();
            this.navigateToPageTag("quick-actions");
          });
        }

        let firstDIDDocument;
        try {
          firstDIDDocument = await $$.promisify(w3cDID.resolveDID)(`did:ssi:name:${didDomain}:${publicName}`);
        }catch (e) {
          button.loading = false;
          await ui.showDialogFromComponent(
              "dw-dialog-initialising",
              {
                did: didDocument.getIdentifier(),
              },
              {
                parentElement: this.element,
                disableClosing: true,
              }
          );
          await $$.promisify(w3cDID.createIdentity)("name", didDomain, publicName);
          const data = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(
              "/app/messages/createEnclave.json"
          );

          this.processMessages(data, async ()=>{
            console.log("Processed create enclave messages");
            const enclaveRecord = await enclaveDB.readKeyAsync(constants.SHARED_ENCLAVE);
            await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
            const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(
                "/app/messages/createGroup.json"
            );

              this.processMessages(messages, async () => {
                console.log("Processed create group messages");
                __waitForMessage();
              });

          })
          // MessagesService.processMessages(data, async () => {
          //   console.log("Processed create enclave messages");
          //   const enclaveRecord = await enclaveDB.readKeyAsync(constants.SHARED_ENCLAVE);
          //   await utils.addSharedEnclaveToEnv(enclaveRecord.enclaveType, enclaveRecord.enclaveDID, enclaveRecord.enclaveKeySSI);
          //   const records = await enclaveDB.getAllRecordsAsync("KeyValueTable");
          //   console.log("records", records);
          //   const messages = await $$.promisify(this.DSUStorage.getObject.bind(this.DSUStorage))(
          //       "/app/messages/createGroup.json"
          //   );
          //   if (messages) {
          //     MessagesService.processMessages(messages, async () => {
          //       console.log("Processed create group messages");
          //       __waitForMessage();
          //     });
          //   }
          // });
          return;
        }

        button.loading = false;
        await ui.showDialogFromComponent(
            "dw-dialog-waiting-approval",
            {
              did: didDocument.getIdentifier(),
            },
            {
              parentElement: this.element,
              disableClosing: true,
            }
        );
        __waitForMessage();
      }
    });
  }

  processMessages(messages, callback){
    if(!messages){
      return callback();
    }
    const __processMessagesRecursively = (index)=>{
      const message = messages[index];
      if (typeof message === "undefined") {
        callback();
      }else{
        MessagesService.processMessages([message], async () => {
          console.log("Processed create group message");
          __processMessagesRecursively(index + 1);
        });
      }
    }

    __processMessagesRecursively(0);
  }
}

export default BootingIdentityController;
