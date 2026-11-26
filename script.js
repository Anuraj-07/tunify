/* Tunify – a Spotify-style music player (HTML + CSS + JavaScript) */

// ---------- Data ----------
// Demo audio: free SoundHelix sample songs. Replace the url with your own mp3 files if you like.
const NAMES = [
  ["Midnight Drive", "Aarav Sound"], ["Golden Hour", "Meera Lane"],
  ["Neon Rain", "The Late Hours"], ["Slow River", "Kabir & Co."],
  ["Pulse", "Nova Beats"], ["Paper Planes", "Isha Rao"],
  ["Skyline", "Studio Nine"], ["Quiet Hours", "Rohan Keys"]
];
const TRACKS = NAMES.map(function (n, i) {
  return {
    id: i + 1, title: n[0], artist: n[1],
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-" + (i + 1) + ".mp3",
    hue: (i * 47 + 150) % 360
  };
});
const PLAYLISTS = [
  { id: "all", name: "All Songs", desc: "Everything in one place", ids: null, hue: 140 },
  { id: "liked", name: "Liked Songs", desc: "Your favourites", ids: "liked", hue: 280 },
  { id: "chill", name: "Chill Vibes", desc: "Slow down and relax", ids: [2, 4, 8], hue: 200 },
  { id: "focus", name: "Deep Focus", desc: "Study and work", ids: [3, 6, 8], hue: 30 },
  { id: "workout", name: "Workout Beats", desc: "High energy", ids: [1, 5, 7], hue: 0 },
  { id: "party", name: "Party Mix", desc: "Turn it up", ids: [1, 5, 6, 7], hue: 320 }
];

// ---------- State ----------
const audio = new Audio();
let likes = loadLikes();
let currentPlaylist = "all";
let queue = [];        // ids of songs in the current play order
let queueIndex = -1;
let shuffle = false;
let repeatMode = 0;    // 0 = off, 1 = repeat all, 2 = repeat one
let dragging = false;

// ---------- Elements ----------
const $ = function (id) { return document.getElementById(id); };
const trackList = $("trackList"), cardsEl = $("cards"), navEl = $("playlistNav");
const playBtn = $("playBtn"), seek = $("seek");

// ---------- Helpers ----------
function loadLikes() {
  try { return JSON.parse(localStorage.getItem("tunifyLikes")) || []; } catch (e) { return []; }
}
function saveLikes() { localStorage.setItem("tunifyLikes", JSON.stringify(likes)); }
function art(hue) { return "background:linear-gradient(135deg,hsl(" + hue + ",70%,45%),hsl(" + (hue + 50) + ",70%,22%))"; }
function findTrack(id) { return TRACKS.find(function (t) { return t.id === id; }); }
function fmt(s) {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return m + ":" + String(sec).padStart(2, "0");
}
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  setTimeout(function () { t.classList.remove("show"); }, 2800);
}

// Songs shown for the current playlist + search text
function visibleTracks() {
  const pl = PLAYLISTS.find(function (p) { return p.id === currentPlaylist; });
  let list = TRACKS;
  if (pl.ids === "liked") list = TRACKS.filter(function (t) { return likes.includes(t.id); });
  else if (pl.ids) list = TRACKS.filter(function (t) { return pl.ids.includes(t.id); });
  const q = $("searchInput").value.trim().toLowerCase();
  if (q) list = list.filter(function (t) { return (t.title + " " + t.artist).toLowerCase().includes(q); });
  return list;
}

// ---------- Rendering ----------
function renderSidebarAndCards() {
  navEl.innerHTML = ""; cardsEl.innerHTML = "";
  PLAYLISTS.forEach(function (p) {
    const active = p.id === currentPlaylist ? " active" : "";
    navEl.innerHTML += '<li><button class="' + active + '" data-pl="' + p.id + '"><span class="lib-art" style="' + art(p.hue) + '">' + p.name[0] + '</span><span><span class="lib-name">' + p.name + '</span><br><span class="lib-sub">Playlist</span></span></button></li>';
    cardsEl.innerHTML += '<button class="card' + active + '" data-pl="' + p.id + '"><div class="card-art" style="' + art(p.hue) + '">' + p.name[0] + '</div><p class="card-name">' + p.name + '</p><p class="card-desc">' + p.desc + '</p></button>';
  });
}

function renderTracks() {
  const list = visibleTracks();
  const pl = PLAYLISTS.find(function (p) { return p.id === currentPlaylist; });
  $("listTitle").textContent = pl.name;
  $("emptyMsg").hidden = list.length > 0;
  $("emptyMsg").textContent = currentPlaylist === "liked" && !$("searchInput").value ? "Tap the heart on a song to add it here." : "No songs found.";
  const playingId = queue[queueIndex];
  trackList.innerHTML = list.map(function (t, i) {
    const playing = t.id === playingId ? " playing" : "";
    const liked = likes.includes(t.id);
    return '<li class="track-row' + playing + '" data-id="' + t.id + '"><span class="num">' + (playing ? "♪" : i + 1) + '</span>' +
      '<div class="track-info"><div class="t-art" style="' + art(t.hue) + '">' + t.title[0] + '</div><div><p class="t-title">' + t.title + '</p><p class="t-artist">' + t.artist + '</p></div></div>' +
      '<button class="heart' + (liked ? " liked" : "") + '" data-like="' + t.id + '" aria-label="Like ' + t.title + '">' + (liked ? "♥" : "♡") + '</button></li>';
  }).join("");
}

function updateNowPlaying() {
  const t = findTrack(queue[queueIndex]);
  if (!t) return;
  $("npTitle").textContent = t.title;
  $("npArtist").textContent = t.artist;
  $("npCover").setAttribute("style", art(t.hue));
  const liked = likes.includes(t.id);
  $("npLike").textContent = liked ? "♥" : "♡";
  $("npLike").classList.toggle("liked", liked);
  document.title = t.title + " • Tunify";
}

// ---------- Playback ----------
function startQueue(list, startId) {
  queue = list.map(function (t) { return t.id; });
  queueIndex = queue.indexOf(startId);
  loadAndPlay();
}

function loadAndPlay() {
  const t = findTrack(queue[queueIndex]);
  audio.src = t.url;
  audio.play().catch(function () { toast("Could not play. Check your internet connection."); });
  updateNowPlaying();
  renderTracks();
}

function togglePlay() {
  if (queueIndex === -1) {
    const list = visibleTracks();
    if (list.length) startQueue(list, list[0].id);
    return;
  }
  if (audio.paused) audio.play(); else audio.pause();
}

function nextTrack(auto) {
  if (queueIndex === -1) return;
  if (shuffle && queue.length > 1) {
    let n;
    do { n = Math.floor(Math.random() * queue.length); } while (n === queueIndex);
    queueIndex = n;
  } else if (queueIndex < queue.length - 1) {
    queueIndex++;
  } else if (repeatMode === 1 || !auto) {
    queueIndex = 0;
  } else {
    audio.pause(); audio.currentTime = 0; return;   // end of queue
  }
  loadAndPlay();
}

function prevTrack() {
  if (queueIndex === -1) return;
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  queueIndex = queueIndex > 0 ? queueIndex - 1 : queue.length - 1;
  loadAndPlay();
}

function toggleLike(id) {
  const i = likes.indexOf(id);
  if (i === -1) likes.push(id); else likes.splice(i, 1);
  saveLikes();
  renderTracks();
  updateNowPlaying();
}

function openPlaylist(id) {
  currentPlaylist = id;
  renderSidebarAndCards();
  renderTracks();
}

// ---------- Events ----------
trackList.addEventListener("click", function (e) {
  const like = e.target.closest("[data-like]");
  if (like) { toggleLike(Number(like.dataset.like)); return; }
  const row = e.target.closest(".track-row");
  if (row) startQueue(visibleTracks(), Number(row.dataset.id));
});
document.addEventListener("click", function (e) {
  const pl = e.target.closest("[data-pl]");
  if (pl) openPlaylist(pl.dataset.pl);
});
$("playAll").addEventListener("click", function () {
  const list = visibleTracks();
  if (list.length) startQueue(list, list[0].id);
});
$("searchInput").addEventListener("input", renderTracks);
$("navHome").addEventListener("click", function () {
  $("searchInput").value = ""; openPlaylist("all");
  $("navHome").classList.add("active"); $("navSearch").classList.remove("active");
});
$("navSearch").addEventListener("click", function () {
  $("searchInput").focus();
  $("navSearch").classList.add("active"); $("navHome").classList.remove("active");
});
$("npLike").addEventListener("click", function () { if (queueIndex !== -1) toggleLike(queue[queueIndex]); });

playBtn.addEventListener("click", togglePlay);
$("nextBtn").addEventListener("click", function () { nextTrack(false); });
$("prevBtn").addEventListener("click", prevTrack);
$("shuffleBtn").addEventListener("click", function () {
  shuffle = !shuffle;
  this.classList.toggle("on", shuffle);
  this.title = "Shuffle: " + (shuffle ? "on" : "off");
});
$("repeatBtn").addEventListener("click", function () {
  repeatMode = (repeatMode + 1) % 3;
  this.classList.toggle("on", repeatMode > 0);
  this.textContent = repeatMode === 2 ? "↻1" : "↻";
  this.title = "Repeat: " + ["off", "all", "one"][repeatMode];
});

audio.addEventListener("play", function () { playBtn.textContent = "❚❚"; playBtn.setAttribute("aria-label", "Pause"); });
audio.addEventListener("pause", function () { playBtn.textContent = "▶"; playBtn.setAttribute("aria-label", "Play"); });
audio.addEventListener("ended", function () {
  if (repeatMode === 2) { audio.currentTime = 0; audio.play(); } else nextTrack(true);
});
audio.addEventListener("error", function () { if (audio.src) toast("Could not load this song."); });
audio.addEventListener("loadedmetadata", function () { $("durTime").textContent = fmt(audio.duration); });
audio.addEventListener("timeupdate", function () {
  $("curTime").textContent = fmt(audio.currentTime);
  if (!dragging && audio.duration) seek.value = (audio.currentTime / audio.duration) * 1000;
});
seek.addEventListener("input", function () {
  dragging = true;
  if (audio.duration) {
    audio.currentTime = (seek.value / 1000) * audio.duration;
    $("curTime").textContent = fmt(audio.currentTime);
  }
});
seek.addEventListener("change", function () { dragging = false; });
$("volume").addEventListener("input", function () { audio.volume = this.value / 100; });

// Space bar = play / pause (unless typing in the search box)
document.addEventListener("keydown", function (e) {
  if (e.code === "Space" && e.target.tagName !== "INPUT" && e.target.tagName !== "BUTTON") {
    e.preventDefault(); togglePlay();
  }
});

// ---------- Start ----------
audio.volume = 0.7;
const hour = new Date().getHours();
$("greeting").textContent = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
renderSidebarAndCards();
renderTracks();