import { useEffect, useState } from "react";
import firebase from "firebase/app";
import { useList, useObjectVal } from "react-firebase-hooks/database";

const Login = () => {
  const provider = new firebase.auth.GoogleAuthProvider();
  const loginWithGoogle = async () => {
    firebase.auth().signInWithRedirect(provider);
  };
  return (
    <section className="section">
      <div className="container">
        <button className="button is-primary" onClick={loginWithGoogle}>
          {" "}
          Sign in with Google{" "}
        </button>
      </div>
    </section>
  );
};

const generateObsidianToken = firebase
  .functions()
  .httpsCallable("generateObsidianToken");

const Authed = ({ user, onLogout }: { user: any; onLogout: () => void }) => {
  const [obsidianToken, setObsidianToken] = useState<any>(null);
  const [obsidianTokenLoading, setObsidianTokenLoading] = useState(false);

  const [value, keyLoading, keyError] = useObjectVal<string>(
    firebase.database().ref(`users/${user.uid}/key`)
  );
  const [snapshots, listLoading, listError] = useList(
    firebase.database().ref(`buffer/${user.uid}`)
  );
  const handleGenerateClick = async () => {
    setObsidianTokenLoading(true);
    try {
      const { data } = await generateObsidianToken();
      setObsidianToken(data);
    } finally {
      setObsidianTokenLoading(false);
    }
  };

  const handleLogoutClick = async () => {
    await firebase.auth().signOut();
    onLogout();
  };

  return (
    <>
      <section className="section">
        <div className="container">
          <h1 className="title"> Login Token </h1>
          <div className="buttons">
            {!obsidianToken && (
              <button
                className="button is-primary"
                onClick={handleGenerateClick}
                disabled={obsidianTokenLoading}
              >
                Generate Obsidian Signin Token
              </button>
            )}
            <button
              className="button is-light"
              onClick={handleLogoutClick}
              disabled={obsidianTokenLoading}
            >
              Logout
            </button>
          </div>
          {obsidianTokenLoading && <> generating ... </>}
          {obsidianToken && (
            <>
              <p className="subtitle">
                Copy token and paste into plugin settings
              </p>
              <input
                className="input"
                type="text"
                readOnly={true}
                value={obsidianToken}
              />
            </>
          )}
        </div>
      </section>
      <section className="section">
        <div className="container">
          {keyError && <strong>Error: {keyError}</strong>}
          {keyLoading && <span>Key: Loading...</span>}
          {!keyLoading && value && (
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
                value={`https://us-central1-obsidian-buffer.cloudfunctions.net/webhook/${value}?path=test/spotify.md`}
              />
            </>
          )}
        </div>
      </section>
      <section className="section">
        <div className="container">
          {listError && <strong>Error: {listError}</strong>}
          {listLoading && <span>List: Loading...</span>}
          {!listLoading && snapshots && (
            <>
              {snapshots.map((v) => (
                <div key={v.key}>{JSON.stringify(v.val())}</div>
              ))}
            </>
          )}
        </div>
      </section>
    </>
  );
};

const App = () => {
  const [currentUser, setCurrentUser] = useState(firebase.auth().currentUser);

  useEffect(() => {
    const handleRedirect = async () => {
      await firebase.auth().getRedirectResult();
      setCurrentUser(firebase.auth().currentUser);
    };
    handleRedirect();
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
      {currentUser ? (
        <Authed user={currentUser} onLogout={() => setCurrentUser(null)} />
      ) : (
        <Login />
      )}
    </>
  );
};

export default App;
