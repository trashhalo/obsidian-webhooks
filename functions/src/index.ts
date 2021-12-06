import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as express from "express";
import * as crypto from "crypto";

admin.initializeApp();
const webhookApp = express();
webhookApp.post("/:key", async (req: any, res: any) => {
  const user = await (
    await admin.database().ref(`/keys/${req.params.key}`).get()
  ).val();
  if (!user) {
    return res.status(403).send("invalid key");
  }
  const today = new Date();
  const exp = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + 7
  );

  let path: string;
  const qPath: unknown = req.query.path;
  if (typeof qPath === "string") {
    path = qPath;
  } else if (Array.isArray(qPath)) {
    path = qPath[0];
  } else {
    return res
      .status(422)
      .send(
        `path not a valid format. expected string recieved ${JSON.stringify(
          qPath
        )}`
      );
  }

  const buffer = {
    id: crypto.randomBytes(16).toString("hex"),
    path,
    exp,
    data: req.rawBody.toString(),
  };
  await admin.database().ref(`/buffer/${user}`).push(buffer);
  res.send("ok");
});
export const webhook = functions.https.onRequest(webhookApp);

export const newUser = functions.auth.user().onCreate((user) => {
  const key = crypto.randomBytes(24).toString("hex");
  admin.database().ref(`/keys/${key}`).set(user.uid);
  admin.database().ref(`/users/${user.uid}/key`).set(key);
});

export const wipe = functions.https.onCall(async (data, context) => {
  if (context.auth) {
    const user = await admin.auth().getUser(context.auth.uid);
    if (user.providerData[0].providerId != "anonymous") {
      const db = admin.database();
      const ref = db.ref(`/buffer/${user.uid}`);
      await ref.transaction((buffer) => {
        if (buffer == null) {
          return buffer;
        }
        if (typeof buffer == "object") {
          const arr: { id: string }[] = Object.values(buffer);
          const index = arr.findIndex((v) => v.id === data.id);
          return arr.splice(index + 1);
        }
        throw new Error(
          `buffer not as expected ${typeof buffer} ${JSON.stringify(buffer)}`
        );
      });
    }
  }
});

export const generateObsidianToken = functions.https.onCall(
  (_data, context) => {
    if (context.auth) {
      return admin.auth().createCustomToken(context.auth.uid);
    }
    throw new Error("authed only");
  }
);
