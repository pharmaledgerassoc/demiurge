import Message from "./utils/Message.js";

function promisify(fun) {
  return function (...args) {
    return new Promise((resolve, reject) => {
      function callback(err, result) {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      }

      args.push(callback);

      fun.call(this, ...args);
    });
  };
}

function getPKFromCredential(credential) {
  const crypto = require("opendsu").loadAPI("crypto");
  return crypto.sha256(credential);
}

async function sendGroupMessage(sender, group, content, contentType, recipientType, groupOperation) {
  const w3cdid = require("opendsu").loadAPI("w3cdid");
  const groupDIDDocument = await promisify(w3cdid.resolveDID)(group.did);
  const message = new Message();
  message.setSender(sender);
  content = typeof content === "object" ? JSON.stringify(content) : content;
  message.setContent(content);
  message.setGroupDID(group.did);

  message.setRecipientType(recipientType);
  message.setContentType(contentType);
  message.setOperation(groupOperation);

  await promisify(groupDIDDocument.sendMessage)(message);
}

async function sendUserMessage(sender, group, member, content, contentType, recipientType, operation) {
  const w3cdid = require("opendsu").loadAPI("w3cdid");
  let didDocument = await promisify(w3cdid.resolveDID)(sender);
  const receiverDIDDocument = await promisify(w3cdid.resolveDID)(member.did);
  const message = new Message();
  message.setSender(sender);
  message.setContent(content);
  message.setContentType(contentType);
  message.setRecipientType(recipientType);
  message.setGroupDID(group.did);
  message.setOperation(operation);

  await promisify(didDocument.sendMessage)(message, receiverDIDDocument);
}

export default {
  promisify,
  getPKFromCredential,
  sendGroupMessage,
  sendUserMessage,
};