import { onCleanup, onMount, Show, useContext } from "solid-js";
import { getDatabase, onValue, ref } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AppContext, createAppStore } from "./store";
import app from "shared/firebase";
import {
  Auth,
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  User,
} from "@firebase/auth";

const Login = () => {
  const [store, { setLoading }] = useContext(AppContext);
  const provider = new GoogleAuthProvider();
  const loginWithGoogle = async (e: Event) => {
    e.preventDefault();
    setLoading(true);
    return signInWithPopup(getAuth(store.app), provider);
  };
  return (
    <form onSubmit={loginWithGoogle}>
      <button type="submit" disabled={store.loading} className="bg-primary">
        Sign in with Google
      </button>
    </form>
  );
};
const functions = getFunctions(app);
const generateObsidianToken = httpsCallable(functions, "generateObsidianToken");
const wipe = httpsCallable(functions, "wipe");

const Authed = () => {
  const [store, { setCurrentUser, setObsidianToken, setLoading }] =
    useContext(AppContext);

  const handleGenerateClick = async () => {
    setLoading(true);
    try {
      const { data } = await generateObsidianToken();
      typeof data === "string" && setObsidianToken(data);
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = async (auth: Auth) => {
    try {
      setLoading(true);
      await signOut(auth);
      setCurrentUser(undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleClearClick = async () => {
    try {
      setLoading(true);
      // clear everything
      await wipe({ id: -1 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <section>
        <div className="flex flex-col md:flex-row md:justify-left">
          {!store.obsidianToken && (
            <button
              onClick={handleGenerateClick}
              disabled={store.loading}
              className="md:w-auto md:mr-5 bg-primary border-green-600"
            >
              Generate Obsidian Signin Token
            </button>
          )}
          <button
            onClick={() => handleClearClick()}
            disabled={store.loading}
            title="Click if plugin is erroring"
            className="md:w-auto md:mr-5 bg-white text-gray-600 border-gray-600"
          >
            Clear Buffer ⚠️
          </button>
          <button
            onClick={() => handleLogoutClick(getAuth(store.app))}
            disabled={store.loading}
            className="md:w-auto bg-white text-gray-600 border-gray-600"
          >
            Logout
          </button>
        </div>
        {store.obsidianToken && (
          <>
            <p>Copy token and paste into plugin settings</p>
            <input type="text" readOnly={true} value={store.obsidianToken} />
          </>
        )}
      </section>
      {store.key && (
        <>
          <h3> Webhook URL </h3>
          <div>
            <ul>
              <li>Use webhook url in services like IFTTT</li>
              <li>
                Query param{" "}
                <span className="is-family-monospace has-text-grey">path</span>{" "}
                controls which file to update
              </li>
              <li>Method type POST</li>
              <li>Body is the markdown to insert into the file</li>
            </ul>
          </div>
          <input
            type="text"
            readOnly={true}
            value={`https://us-central1-obsidian-buffer.cloudfunctions.net/webhook/${store.key}?path=test/spotify.md`}
          />
        </>
      )}
      {store.buffer && (
        <>
          {store.buffer.map((v) => (
            <div>{JSON.stringify(v.val)}</div>
          ))}
        </>
      )}
    </>
  );
};

function App() {
  const store = createAppStore();
  const [state, { setApp, setLoading, setKey, setCurrentUser }] = store;

  setApp(app);
  const auth = getAuth(state.app);

  let keyUnsubscribe = () => {};
  const authUnsubscribe = auth.onAuthStateChanged((user: User | null) => {
    keyUnsubscribe();
    setCurrentUser(user || undefined);
    if (user) {
      setLoading(true);
      const db = getDatabase(state.app);
      keyUnsubscribe = onValue(ref(db, `users/${user.uid}/key`), (value) => {
        const val = value.val();
        setKey(val);
        if (val) {
          setLoading(false);
        }
      });
    } else {
      setLoading(false);
    }
  });

  onCleanup(() => {
    authUnsubscribe();
    keyUnsubscribe();
  });

  return (
    <>
      <main>
        <article>
          <hgroup>
            <h1> Obsidian Webhooks </h1>
            <h2>Connect obsidian to the internet of things via webhooks</h2>
          </hgroup>
          <div className="mb-3">
            <a href="https://ko-fi.com/I3I72N2AC" target="_blank">
              <img
                className="h-9 border-0"
                src="https://cdn.ko-fi.com/cdn/kofi1.png?v=3"
                alt="Buy Me a Coffee at ko-fi.com"
              />
            </a>
          </div>
          <Show when={state.loading}>
            <section>
              <div>
                <progress class="progress is-primary" max="100"></progress>
              </div>
            </section>
          </Show>
          <AppContext.Provider value={store}>
            {state.currentUser ? <Authed /> : <Login />}
          </AppContext.Provider>
        </article>
      </main>
    </>
  );
}

export default App;
