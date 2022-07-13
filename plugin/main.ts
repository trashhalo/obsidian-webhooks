/* eslint-disable no-console */
import { App, Notice, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
  Auth,
  getAuth,
  signInWithCustomToken,
  signOut,
  Unsubscribe,
} from "firebase/auth";
import { FirebaseApp } from "firebase/app";
import {
  DataSnapshot,
  getDatabase,
  goOffline,
  goOnline,
  onValue,
  ref,
} from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import app from "shared/firebase";

enum NewLineType {
  Windows = 1,
  UnixMac = 2,
}

interface MyPluginSettings {
  token: string;
  frequency: string;
  triggerOnLoad: boolean;
  error?: string;
  newLineType?: NewLineType;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  token: "",
  frequency: "0", // manual by default
  triggerOnLoad: true,
  newLineType: undefined,
};

export default class ObsidianWebhooksPlugin extends Plugin {
  settings: MyPluginSettings;
  firebase: FirebaseApp;
  loggedIn: boolean;
  authUnsubscribe: Unsubscribe;
  valUnsubscribe: Unsubscribe;

  async onload() {
    console.log("loading plugin");
    await this.loadSettings();
    this.firebase = app;
    this.authUnsubscribe = getAuth(this.firebase).onAuthStateChanged((user) => {
      if (this.valUnsubscribe) {
        this.valUnsubscribe();
      }
      if (user) {
        const db = getDatabase(this.firebase);
        const buffer = ref(db, `buffer/${user.uid}`);
        this.valUnsubscribe = onValue(buffer, async (data) => {
          try {
            await goOffline(db);
            await this.onBufferChange(data);
          } finally {
            await goOnline(db);
          }
        });
      }
    });

    this.addSettingTab(new WebhookSettingTab(this.app, this));
  }

  async onBufferChange(data: DataSnapshot) {
    if (!data.hasChildren()) {
      return;
    }

    try {
      let last: unknown = undefined;
      let promiseChain = Promise.resolve();
      data.forEach((event) => {
        const val = event.val();
        last = val;
        promiseChain = promiseChain.then(() => this.applyEvent(val));
      });
      await promiseChain;
      await this.wipe(last);
      promiseChain.catch((err) => {});

      new Notice("notes updated by webhooks");
    } catch (err) {
      new Notice("error processing webhook events, " + err.toString());
      throw err;
    } finally {
    }
  }

  async wipe(value: unknown) {
    const functions = getFunctions(this.firebase);
    const wipe = httpsCallable(functions, "wipe");
    await wipe(value);
  }

  async applyEvent({
    data,
    path: pathOrArr,
  }: {
    data: string;
    path: string | Array<string>;
  }) {
    const fs = this.app.vault.adapter;
    let path: string;
    if (typeof pathOrArr === "string") {
      path = pathOrArr;
    } else {
      path = Object.values(pathOrArr).first();
    }

    let dirPath = path.replace(/\/*$/, "").replace(/^(.+)\/[^\/]*?$/, "$1");
    if (dirPath !== path) {
      // == means its in the root
      const exists = await fs.stat(dirPath);
      if (!exists) {
        await fs.mkdir(dirPath);
      }
    }
    let contentToSave = data;
    if (this.settings.newLineType == NewLineType.UnixMac) {
      contentToSave += "\n";
    } else if (this.settings.newLineType == NewLineType.Windows) {
      contentToSave += "\r\n";
    }
    const pathStat = await fs.stat(path);
    console.log("webhook updating path", path, pathStat);
    if (pathStat?.type === "folder") {
      throw new Error(
        `path name exists as a folder. please delete folder: ${path}`
      );
    } else if (pathStat?.type == "file") {
      const existingContent = await fs.read(path);
      contentToSave = existingContent + contentToSave;
    }
    await fs.write(path, contentToSave);
  }

  onunload() {
    console.log("unloading plugin");
    if (this.authUnsubscribe) {
      this.authUnsubscribe();
    }
    if (this.valUnsubscribe) {
      this.valUnsubscribe();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}

class WebhookSettingTab extends PluginSettingTab {
  plugin: ObsidianWebhooksPlugin;
  auth: Auth;
  authObserver: Unsubscribe;

  constructor(oApp: App, plugin: ObsidianWebhooksPlugin) {
    super(oApp, plugin);
    this.plugin = plugin;
    this.auth = getAuth(this.plugin.firebase);
    this.authObserver = this.auth.onAuthStateChanged(this.display);
  }

  hide(): void {
    this.authObserver();
  }

  display(): void {
    if (!this) {
      return;
    }

    let { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Settings for webhooks" });
    containerEl
      .createEl("p", { text: "Generate login tokens at " })
      .createEl("a", {
        text: "Obsidian Webhooks",
        href: "https://obsidian-buffer.web.app",
      });

    if (this.plugin.settings.error) {
      containerEl.createEl("p", {
        text: `error: ${this.plugin.settings.error}`,
      });
    }

    if (this.auth.currentUser) {
      new Setting(containerEl)
        .setName(`logged in as ${this.auth.currentUser.email}`)
        .addButton((button) => {
          button
            .setButtonText("Logout")
            .setCta()
            .onClick(async (evt) => {
              try {
                await signOut(this.auth);
                this.plugin.settings.error = undefined;
              } catch (err) {
                this.plugin.settings.error = err.message;
              } finally {
                await this.plugin.saveSettings();
                this.display();
              }
            });
        });
      new Setting(containerEl)
        .setName("New Line")
        .setDesc("Add new lines between incoming notes")
        .addDropdown((dropdown) => {
          dropdown.addOption("none", "No new lines");
          dropdown.addOption("windows", "Windows style newlines");
          dropdown.addOption("unixMac", "Linux, Unix or Mac style new lines");
          const { newLineType } = this.plugin.settings;
          if (newLineType === undefined) {
            dropdown.setValue("none");
          } else if (newLineType == NewLineType.Windows) {
            dropdown.setValue("windows");
          } else if (newLineType == NewLineType.UnixMac) {
            dropdown.setValue("unixMac");
          }
          dropdown.onChange(async (value) => {
            if (value == "none") {
              this.plugin.settings.newLineType = undefined;
            } else if (value == "windows") {
              this.plugin.settings.newLineType = NewLineType.Windows;
            } else if (value == "unixMac") {
              this.plugin.settings.newLineType = NewLineType.UnixMac;
            }
            await this.plugin.saveSettings();
            this.display();
          });
        });
      return;
    }

    new Setting(containerEl).setName("Webhook login token").addText((text) =>
      text
        .setPlaceholder("Paste your token")
        .setValue(this.plugin.settings.token)
        .onChange(async (value) => {
          console.log("Secret: " + value);
          this.plugin.settings.token = value;
          await this.plugin.saveSettings();
        })
    );

    new Setting(containerEl)
      .setName("Login")
      .setDesc("Exchanges webhook token for authenication")
      .addButton((button) => {
        button
          .setButtonText("Login")
          .setCta()
          .onClick(async (evt) => {
            try {
              await signInWithCustomToken(
                this.auth,
                this.plugin.settings.token
              );
              this.plugin.settings.token = "";
              this.plugin.settings.error = undefined;
            } catch (err) {
              this.plugin.settings.error = err.message;
            } finally {
              await this.plugin.saveSettings();
              this.display();
            }
          });
      });
  }
}
