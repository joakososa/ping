// Ping PWA. Plain JS, no build step. Patterns here are the template for every system:
// - data comes from /api (behind Cloudflare Access), refreshed on open and whenever the app comes back to the front;
// - own changes show at once (optimistic) and are sent with the version they read (409 = changed elsewhere);
// - new notes created offline wait in a local queue and are sent when the connection returns;
// - an expired Access session is detected and the user is sent through the login again.

const $ = (selector) => document.querySelector(selector);
const lista = $("#lista");
const tplNota = $("#tpl-nota");
const form = $("#nueva");
const entrada = $("#nueva-texto");

const CLAVE_CACHE = "ping.notas";
const CLAVE_PENDIENTES = "ping.pendientes";

let notas = [];
let editando = null; // id of the note being edited
let cargando = false;

// ---------- local storage (best effort: it can be unavailable or cleared) ----------

function leer(clave, porDefecto) {
  try {
    const valor = localStorage.getItem(clave);
    return valor ? JSON.parse(valor) : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardar(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    /* ignore */
  }
}

const pendientes = () => leer(CLAVE_PENDIENTES, []);
const guardarPendientes = (valor) => guardar(CLAVE_PENDIENTES, valor);

// ---------- API ----------

class SesionVencida extends Error {}
class SinConexion extends Error {}

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
    throw new SinConexion();
  }
  if (res.type === "opaqueredirect" || res.status === 401 || res.status === 403) throw new SesionVencida();
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  return { status: res.status, data };
}

// ---------- notices ----------

function avisar(texto, accion) {
  $("#aviso-texto").textContent = texto;
  const boton = $("#aviso-accion");
  boton.hidden = !accion;
  if (accion) {
    boton.textContent = accion.texto;
    boton.onclick = accion.hacer;
  }
  $("#aviso").hidden = false;
}

const limpiarAviso = () => ($("#aviso").hidden = true);

function manejarError(error) {
  if (error instanceof SesionVencida) {
    avisar("Tu sesión venció.", { texto: "Entrar de nuevo", hacer: () => location.reload() });
  } else if (error instanceof SinConexion) {
    avisar("Sin conexión. Lo nuevo se guarda acá y se envía cuando vuelva la señal.");
  } else {
    avisar("Algo salió mal. Probá de nuevo.");
    console.error(error);
  }
}

// ---------- rendering ----------

const formatoFecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" });

function pintar() {
  const enCola = pendientes().map((p) => ({ ...p, pendiente: true }));
  const ids = new Set(notas.map((n) => n.id));
  const todas = [...enCola.filter((p) => !ids.has(p.id)), ...notas];

  lista.replaceChildren(...todas.map(pintarNota));
  $("#vacio").hidden = todas.length > 0;
}

function pintarNota(nota) {
  const li = tplNota.content.firstElementChild.cloneNode(true);
  li.dataset.id = nota.id;
  const texto = li.querySelector(".texto");
  li.querySelector(".fecha").textContent = nota.creado ? formatoFecha.format(new Date(nota.creado)) : "";

  if (nota.pendiente) {
    li.classList.add("pendiente");
    texto.textContent = nota.texto;
    li.querySelector(".estado").textContent = "Pendiente de envío";
    li.querySelector(".acciones").remove();
    return li;
  }

  if (editando === nota.id) {
    const area = document.createElement("textarea");
    area.value = nota.texto;
    area.maxLength = 2000;
    area.rows = 3;
    texto.replaceWith(area);
    const acciones = li.querySelector(".acciones");
    acciones.replaceChildren(boton("Guardar", () => guardarEdicion(nota, area.value)), boton("Cancelar", () => {
      editando = null;
      pintar();
    }));
    queueMicrotask(() => area.focus());
    return li;
  }

  texto.textContent = nota.texto;
  li.querySelector(".editar").onclick = () => {
    editando = nota.id;
    pintar();
  };
  const borrar = li.querySelector(".borrar");
  borrar.onclick = () => {
    // Two-step delete instead of a confirm() dialog.
    if (borrar.dataset.armado) return borrarNota(nota);
    borrar.dataset.armado = "1";
    borrar.textContent = "¿Seguro?";
    setTimeout(() => {
      delete borrar.dataset.armado;
      borrar.textContent = "Borrar";
    }, 3000);
  };
  return li;
}

function boton(texto, onclick) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = texto;
  b.onclick = onclick;
  return b;
}

// ---------- actions ----------

async function cargar() {
  if (cargando) return;
  cargando = true;
  try {
    await enviarPendientes();
    const [yo, lista] = await Promise.all([api("GET", "/api/me"), api("GET", "/api/notas")]);
    if (yo.status === 200) $("#quien").textContent = yo.data.email;
    if (lista.status === 200) {
      notas = lista.data;
      guardar(CLAVE_CACHE, notas);
      limpiarAviso();
    }
  } catch (error) {
    manejarError(error);
  } finally {
    cargando = false;
    if (editando === null) pintar();
  }
}

async function enviarPendientes() {
  for (const p of pendientes()) {
    const { status, data } = await api("POST", "/api/notas", { id: p.id, texto: p.texto });
    if (status === 201 || status === 200) {
      notas = [data, ...notas.filter((n) => n.id !== data.id)];
    } else if (status >= 400 && status < 500) {
      avisar(`No se pudo guardar una nota pendiente: ${data?.error ?? status}`);
    } else {
      return; // server problem: keep it queued
    }
    guardarPendientes(pendientes().filter((x) => x.id !== p.id));
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const texto = entrada.value.trim();
  if (!texto) return;
  entrada.value = "";
  guardarPendientes([{ id: crypto.randomUUID(), texto, creado: new Date().toISOString() }, ...pendientes()]);
  pintar();
  try {
    await enviarPendientes();
    limpiarAviso();
  } catch (error) {
    manejarError(error);
  }
  pintar();
});

entrada.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) form.requestSubmit();
});

async function guardarEdicion(nota, nuevoTexto) {
  const texto = nuevoTexto.trim();
  if (!texto || texto === nota.texto) {
    editando = null;
    return pintar();
  }
  await cambiar(nota, { texto, version: nota.version });
}

async function borrarNota(nota) {
  await cambiar(nota, { borrar: true, version: nota.version });
}

async function cambiar(nota, cambio) {
  try {
    const { status, data } = await api("PATCH", `/api/notas/${nota.id}`, cambio);
    if (status === 200) {
      notas = data.borradoEn ? notas.filter((n) => n.id !== nota.id) : notas.map((n) => (n.id === nota.id ? data : n));
      limpiarAviso();
    } else if (status === 409) {
      notas = notas.map((n) => (n.id === nota.id ? data.actual : n));
      avisar("Esta nota cambió mientras la tenías abierta. Te muestro la versión actual.");
    } else if (status === 404) {
      notas = notas.filter((n) => n.id !== nota.id);
      avisar("Esa nota ya no existe.");
    } else {
      avisar(`No se pudo guardar: ${data?.error ?? status}`);
    }
    guardar(CLAVE_CACHE, notas);
  } catch (error) {
    manejarError(error);
  }
  editando = null;
  pintar();
}

// ---------- startup ----------

notas = leer(CLAVE_CACHE, []);
pintar();
cargar();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") cargar();
});
window.addEventListener("online", cargar);

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((error) => console.warn("Service worker:", error));
}
