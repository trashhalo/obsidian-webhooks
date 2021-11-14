import { onCleanup, onMount, Show, useContext } from "solid-js";
import { getDatabase, onValue, ref } from "firebase/database";
import { getFunctions, httpsCallable } from "firebase/functions";
import { AppContext, createAppStore } from "./store";
import app from "shared/firebase";
import {
  Auth,
  getAuth,
  getRedirectResult,
  GoogleAuthProvider,
  signInWithRedirect,
  signOut,
  User,
} from "@firebase/auth";

const Login = () => {
  const [store] = useContext(AppContext);
  const provider = new GoogleAuthProvider();
  const loginWithGoogle = async () => {
    signInWithRedirect(getAuth(store.app), provider);
  };
  return (
    <section className="section">
      <div className="container">
        <button
          className="button is-primary"
          onClick={loginWithGoogle}
          disabled={store.loading}
        >
          Sign in with Google
        </button>
      </div>
    </section>
  );
};
const functions = getFunctions(app);
const generateObsidianToken = httpsCallable(functions, "generateObsidianToken");

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

  return (
    <>
      <section className="section">
        <div className="container">
          <h1 className="title"> Login Token </h1>
          <div className="buttons">
            {!store.obsidianToken && (
              <button
                className="button is-primary"
                onClick={handleGenerateClick}
                disabled={store.loading}
              >
                Generate Obsidian Signin Token
              </button>
            )}
            <button
              className="button is-light"
              onClick={() => handleLogoutClick(getAuth(store.app))}
              disabled={store.loading}
            >
              Logout
            </button>
          </div>
          {store.obsidianToken && (
            <>
              <p className="subtitle">
                Copy token and paste into plugin settings
              </p>
              <input
                className="input"
                type="text"
                readOnly={true}
                value={store.obsidianToken}
              />
            </>
          )}
        </div>
      </section>
      <section className="section">
        <div className="container">
          {store.key && (
            <>
              <h1 className="title"> Webhook URL </h1>
              <div className="content">
                <ul>
                  <li>Use webhook url in services like IFTTT</li>
                  <li>
                    Query param{" "}
                    <span className="is-family-monospace has-text-grey">
                      path
                    </span>{" "}
                    controls which file to update
                  </li>
                  <li>Method type POST</li>
                  <li>Body is the markdown to insert into the file</li>
                </ul>
              </div>
              <input
                className="input"
                type="text"
                readOnly={true}
                value={`https://us-central1-obsidian-buffer.cloudfunctions.net/webhook/${store.key}?path=test/spotify.md`}
              />
            </>
          )}
        </div>
      </section>
      <section className="section">
        <div className="container">
          {store.buffer && (
            <>
              {store.buffer.map((v) => (
                <div>{JSON.stringify(v.val)}</div>
              ))}
            </>
          )}
        </div>
      </section>
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

  onMount(() => getRedirectResult(auth));

  onCleanup(() => {
    authUnsubscribe();
    keyUnsubscribe();
  });

  return (
    <>
      <section className="hero">
        <div className="hero-body">
          <p className="title"> Obsidian Webhooks </p>
          <p className="subtitle">
            Connect obsidian to the internet of things via webhooks
            <br />
            <a href="https://ko-fi.com/I3I72N2AC" target="_blank">
              <img
                height="36"
                style={{ border: "0px", height: "36px" }}
                src="https://cdn.ko-fi.com/cdn/kofi1.png?v=3"
                alt="Buy Me a Coffee at ko-fi.com"
              />
            </a>
          </p>
        </div>
      </section>
      <Show when={state.loading}>
        <section className="section">
          <div className="container">
            <progress class="progress is-primary" max="100"></progress>
          </div>
        </section>
      </Show>
      <AppContext.Provider value={store}>
        {state.currentUser ? <Authed /> : <Login />}
      </AppContext.Provider>
    </>
  );
}

export default App;
