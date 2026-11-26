// Ping PWA. Plain JS, no build step. Patterns here are the template for every system:
// - data comes from /api (behind Cloudflare Access), refreshed on open and whenever the app comes back to the front;
// - own changes show at once (optimistic) and are sent with the version they read (409 = changed elsewhere);
// - new notes created offline wait in a local queue and are sent when the connection returns;
// - an expired Access session is detected and the user is sent through the login again.
// Identifiers are in English; text shown to the user is in Spanish (ADR-0010).

const $ = (selector) => document.querySelector(selector);
const list = $("#list");
const noteTemplate = $("#note-template");
const form = $("#new-note");
const input = $("#new-note-text");

const CACHE_KEY = "ping.notes";
const PENDING_KEY = "ping.pending";

let notes = [];
let editingId = null;
let loading = false;

// ---------- local storage (best effort: it can be unavailable or cleared) ----------

function readLocal(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

const pending = () => readLocal(PENDING_KEY, []);
const savePending = (value) => writeLocal(PENDING_KEY, value);

// ---------- API ----------

class SessionExpired extends Error {}
class Offline extends Error {}

async function api(method, path, body) {
  let res;
  try {
    res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: "same-origin",
      redirect: "manual", // Access answers an expired session with a redirect to its login page
    });
  } catch {
    throw new Offline();
  }
  if (res.type === "opaqueredirect" || res.status === 401 || res.status === 403) throw new SessionExpired();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

// ---------- notices ----------

function showNotice(text, action) {
  $("#notice-text").textContent = text;
  const button = $("#notice-action");
  button.hidden = !action;
  if (action) {
    button.textContent = action.label;
    button.onclick = action.run;
  }
  $("#notice").hidden = false;
}

const clearNotice = () => ($("#notice").hidden = true);

function handleError(error) {
  if (error instanceof SessionExpired) {
    showNotice("Tu sesión venció.", { label: "Entrar de nuevo", run: () => location.reload() });
  } else if (error instanceof Offline) {
    showNotice("Sin conexión. Lo nuevo se guarda acá y se envía cuando vuelva la señal.");
  } else {
    showNotice("Algo salió mal. Probá de nuevo.");
    console.error(error);
  }
}

// ---------- rendering ----------

const dateFormat = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function render() {
  const queued = pending().map((p) => ({ ...p, pending: true }));
  const known = new Set(notes.map((n) => n.id));
  const all = [...queued.filter((p) => !known.has(p.id)), ...notes];

  list.replaceChildren(...all.map(renderNote));
  $("#empty").hidden = all.length > 0;
}

function renderNote(note) {
  const li = noteTemplate.content.firstElementChild.cloneNode(true);
  li.dataset.id = note.id;
  const text = li.querySelector(".text");
  li.querySelector(".date").textContent = note.createdAt ? dateFormat.format(new Date(note.createdAt)) : "";

  if (note.pending) {
    li.classList.add("pending");
    text.textContent = note.text;
    li.querySelector(".status").textContent = "Pendiente de envío";
    li.querySelector(".actions").remove();
    return li;
  }

  if (editingId === note.id) {
    const area = document.createElement("textarea");
    area.value = note.text;
    area.maxLength = 2000;
    area.rows = 3;
    area.setAttribute("aria-label", "Editar nota");
    text.replaceWith(area);
    li.querySelector(".actions").replaceChildren(
      button("Guardar", () => saveEdit(note, area.value)),
      button("Cancelar", () => {
        editingId = null;
        render();
      }),
    );
    queueMicrotask(() => area.focus());
    return li;
  }

  text.textContent = note.text;
  li.querySelector(".edit").onclick = () => {
    editingId = note.id;
    render();
  };
  const del = li.querySelector(".delete");
  del.onclick = () => {
    // Two-step delete instead of a confirm() dialog.
    if (del.dataset.armed) return deleteNote(note);
    del.dataset.armed = "1";
    del.textContent = "¿Seguro?";
    setTimeout(() => {
      delete del.dataset.armed;
      del.textContent = "Borrar";
    }, 3000);
  };
  return li;
}

function button(label, onclick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = label;
  b.onclick = onclick;
  return b;
}

// ---------- actions ----------

async function load() {
  if (loading) return;
  loading = true;
  try {
    await sendPending();
    const [me, fetched] = await Promise.all([api("GET", "/api/me"), api("GET", "/api/notes")]);
    if (me.status === 200) $("#who").textContent = me.data.email;
    if (fetched.status === 200) {
      notes = fetched.data;
      writeLocal(CACHE_KEY, notes);
      clearNotice();
    }
  } catch (error) {
    handleError(error);
  } finally {
    loading = false;
    if (editingId === null) render();
  }
}

async function sendPending() {
  for (const p of pending()) {
    const { status, data } = await api("POST", "/api/notes", { id: p.id, text: p.text });
    if (status === 201 || status === 200) {
      notes = [data, ...notes.filter((n) => n.id !== data.id)];
    } else if (status >= 400 && status < 500) {
      showNotice(`No se pudo guardar una nota pendiente: ${data?.error ?? status}`);
    } else {
      return; // server problem: keep it queued
    }
    savePending(pending().filter((x) => x.id !== p.id));
    writeLocal(CACHE_KEY, notes); // so the note shows at once on the next open (PWA-02)
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  input.value = "";
  savePending([{ id: crypto.randomUUID(), text, createdAt: new Date().toISOString() }, ...pending()]);
  render();
  try {
    await sendPending();
    clearNotice();
  } catch (error) {
    handleError(error);
  }
  render();
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) form.requestSubmit();
});

async function saveEdit(note, newText) {
  const text = newText.trim();
  if (!text || text === note.text) {
    editingId = null;
    return render();
  }
  await change(note, { text, version: note.version });
}

async function deleteNote(note) {
  await change(note, { delete: true, version: note.version });
}

async function change(note, patch) {
  try {
    const { status, data } = await api("PATCH", `/api/notes/${note.id}`, patch);
    if (status === 200) {
      notes = data.deletedAt ? notes.filter((n) => n.id !== note.id) : notes.map((n) => (n.id === note.id ? data : n));
      clearNotice();
    } else if (status === 409) {
      notes = notes.map((n) => (n.id === note.id ? data.current : n));
      showNotice("Esta nota cambió mientras la tenías abierta. Te muestro la versión actual.");
    } else if (status === 404) {
      notes = notes.filter((n) => n.id !== note.id);
      showNotice("Esa nota ya no existe.");
    } else {
      showNotice(`No se pudo guardar: ${data?.error ?? status}`);
    }
    writeLocal(CACHE_KEY, notes);
  } catch (error) {
    handleError(error);
  }
  editingId = null;
  render();
}

// ---------- startup ----------

notes = readLocal(CACHE_KEY, []);
render();
load();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") load();
});
window.addEventListener("online", load);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker:", error));
}
