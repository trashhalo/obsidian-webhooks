import { App, Plugin, PluginSettingTab, Setting } from "obsidian";
import {
  Auth,
  getAuth,
  signInWithCustomToken,
  signOut,
  Unsubscribe,
} from "firebase/auth";
import { FirebaseApp, initializeApp } from "firebase/app";
import { DataSnapshot, getDatabase, onValue, ref } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";

interface MyPluginSettings {
  token: string;
  frequency: string;
  triggerOnLoad: boolean;
  error?: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
  token: "",
  frequency: "0", // manual by default
  triggerOnLoad: true,
};

// No one panic! https://stackoverflow.com/questions/37482366/is-it-safe-to-expose-firebase-apikey-to-the-public
const firebaseConfig = {
  apiKey: "AIzaSyD428MEhEl1Zj8TWw4MXZRsKlCXI_TCgvg",
  authDomain: "obsidian-buffer.firebaseapp.com",
  databaseURL: "https://obsidian-buffer-default-rtdb.firebaseio.com",
  projectId: "obsidian-buffer",
  storageBucket: "obsidian-buffer.appspot.com",
  messagingSenderId: "386398705772",
  appId: "1:386398705772:web:4ebb36001ad006dd632049",
  measurementId: "G-885V9M0N0C",
};

export default class MyPlugin extends Plugin {
  settings: MyPluginSettings;
  firebase: FirebaseApp;
  loggedIn: boolean;
  authUnsubscribe: Unsubscribe;
  valUnsubscribe: Unsubscribe;

  async onload() {
    console.log("loading plugin");
    await this.loadSettings();
    this.firebase = initializeApp(firebaseConfig);
    this.authUnsubscribe = getAuth(this.firebase).onAuthStateChanged((user) => {
      if (this.valUnsubscribe) {
        this.valUnsubscribe();
      }
      if (user) {
        const db = getDatabase(this.firebase);
        const buffer = ref(db, `buffer/${user.uid}`);
        this.valUnsubscribe = onValue(buffer, (data) => {
          this.onBufferChange(data);
        });
      }
    });

    this.addSettingTab(new WebhookSettingTab(this.app, this));
  }

  async onBufferChange(data: DataSnapshot) {
    if (!data.hasChildren()) {
      return;
    }
    this.valUnsubscribe();

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

      new Notification("notes updated by webhooks");
    } catch (err) {
      new Notification("error processing webhook events, " + err.toString());
      throw err;
    } finally {
      setTimeout(() => {
        this.valUnsubscribe = onValue(data.ref, (data) => {
          this.onBufferChange(data);
        });
      }, 5000);
    }
  }

  async wipe(value: unknown) {
    const functions = getFunctions(this.firebase);
    const wipe = httpsCallable(functions, "wipe");
    await wipe(value);
  }

  async applyEvent({ data, path }: { data: string; path: string }) {
    const fs = this.app.vault.adapter;
    let dirPath = path.replace(/\/*$/, "").replace(/^(.+)\/[^\/]*?$/, "$1");
    const exists = await fs.exists(dirPath);
    if (!exists) {
      await fs.mkdir(dirPath);
    }
    let contentToSave = data;
    if (await fs.exists(path)) {
      // if the file already exists we need to append content to existing one
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
  plugin: MyPlugin;
  auth: Auth;
  authObserver: Unsubscribe;

  constructor(app: App, plugin: MyPlugin) {
    super(app, plugin);
    this.plugin = plugin;
    this.auth = getAuth(this.plugin.firebase);
    this.authObserver = this.auth.onAuthStateChanged(this.display);
  }

  hide(): void {
    this.authObserver();
  }

  display(): void {
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
