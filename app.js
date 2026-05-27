"use strict";

const state = {
  groupSelections: {}, // groupLetter -> { first, second, third }
  bestThirdSelected: [],  // array of teamIds (up to 8)
  r32Winners: [],
  r16Winners: [],
  qfWinners: [],
  sfWinners: [],
  finalWinner: null,
  currentStage: "groups",
};

function teamById(id) { return TEAMS.find(t => t.id === id); }
function teamName(id) { const t = teamById(id); return t ? (t.names[currentLang] || t.names.en) : "?"; }

function getGroupTeams(g) { return TEAMS.filter(t => t.group === g); }

function showStage(name) {
  document.querySelectorAll(".stage-section").forEach(s => s.classList.remove("active"));
  document.getElementById("stage-" + name).classList.add("active");
  state.currentStage = name;
  updateStageStates();
}

// ── STAGE PROGRESSION ──────────────────────────────────────────────────
const STAGE_ORDER = ["guide", "groups", "bestthird", "round32", "round16", "quarters", "semis", "final"];

function isStageCompleted(key) {
  switch (key) {
    case "guide":     return true;
    case "groups":    return allGroupsComplete() && countThirdPlace() >= 8;
    case "bestthird": return state.bestThirdSelected.length === 8;
    case "round32":   return state.r32Winners.filter(Boolean).length >= 16;
    case "round16":   return state.r16Winners.filter(Boolean).length >= 8;
    case "quarters":  return state.qfWinners.filter(Boolean).length >= 4;
    case "semis":     return state.sfWinners.filter(Boolean).length >= 2;
    case "final":     return !!state.finalWinner;
  }
  return false;
}

function initStageNav() {
  const nav = document.getElementById("stageNav");
  if (!nav || nav.dataset.initialized) return;
  const tabs = Array.from(nav.querySelectorAll(".stage-tab"));

  // Assign step numbers
  tabs.forEach((tab, i) => tab.setAttribute("data-step", i));

  // Insert connectors between tabs
  for (let i = tabs.length - 1; i > 0; i--) {
    const conn = document.createElement("div");
    conn.className = "stage-connector";
    conn.dataset.between = i;
    nav.insertBefore(conn, tabs[i]);
  }
  nav.dataset.initialized = "1";
}

function updateStageStates() {
  const nav = document.getElementById("stageNav");
  if (!nav) return;
  const tabs = Array.from(nav.querySelectorAll(".stage-tab"));
  const connectors = Array.from(nav.querySelectorAll(".stage-connector"));

  // Find the highest sequentially-completed stage index
  let lastCompletedIdx = -1;
  for (let i = 0; i < STAGE_ORDER.length; i++) {
    if (isStageCompleted(STAGE_ORDER[i])) lastCompletedIdx = i;
    else break;
  }

  tabs.forEach((tab, i) => {
    tab.classList.remove("locked", "completed", "available", "active");
    const key = tab.dataset.stage;

    if (key === state.currentStage) {
      tab.classList.add("active");
    } else if (i <= lastCompletedIdx) {
      tab.classList.add("completed");
    } else if (i === lastCompletedIdx + 1) {
      tab.classList.add("available");
    } else {
      tab.classList.add("locked");
    }
  });

  connectors.forEach(conn => {
    const idx = parseInt(conn.dataset.between, 10);
    conn.classList.remove("completed", "available");
    if (idx <= lastCompletedIdx) {
      conn.classList.add("completed");
    } else if (idx === lastCompletedIdx + 1) {
      conn.classList.add("available");
    }
  });
}

function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  setTimeout(() => el.classList.remove("show"), 2800);
}

// ── GROUP STAGE ────────────────────────────────────────────────────────
function renderGroups() {
  const container = document.getElementById("groupsContainer");
  if (!container) return;
  container.innerHTML = "";

  GROUPS.forEach(g => {
    const teams = getGroupTeams(g);
    const sel = state.groupSelections[g] || {};
    const card = document.createElement("div");
    card.className = "group-card";

    const teamsHTML = teams.map(team => {
      let badge = "";
      if (sel.first === team.id) badge = `<span class="rank-badge first">${t("group1st")}</span>`;
      else if (sel.second === team.id) badge = `<span class="rank-badge second">${t("group2nd")}</span>`;
      else if (sel.third === team.id) badge = `<span class="rank-badge third">${t("group3rd")}</span>`;
      const isSelected = sel.first === team.id || sel.second === team.id || sel.third === team.id;
      return `
        <div class="team-row ${isSelected ? "selected" : ""}" data-group="${g}" data-team="${team.id}" role="button" tabindex="0">
          <img src="${flagUrl(team.id)}" alt="${teamName(team.id)}" class="flag-img" onerror="this.style.display='none'">
          <span class="team-name">${team.names[currentLang] || team.names.en}</span>
          ${badge}
        </div>`;
    }).join("");

    card.innerHTML = `
      <div class="group-header">
        <span class="group-badge">${t("groupLabel")} ${g}</span>
      </div>
      <div class="group-teams">
        ${teamsHTML}
      </div>`;

    card.querySelectorAll(".team-row").forEach(row => {
      const handler = () => toggleGroupSelection(row.dataset.group, row.dataset.team);
      row.addEventListener("click", handler);
      row.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") handler(); });
    });

    container.appendChild(card);
  });
}

function toggleGroupSelection(g, teamId) {
  const sel = state.groupSelections[g] || {};
  if (sel.first === teamId) {
    state.groupSelections[g] = { first: sel.second, second: sel.third, third: undefined };
  } else if (sel.second === teamId) {
    state.groupSelections[g] = { first: sel.first, second: sel.third, third: undefined };
  } else if (sel.third === teamId) {
    state.groupSelections[g] = { first: sel.first, second: sel.second, third: undefined };
  } else if (!sel.first) {
    state.groupSelections[g] = { first: teamId, second: sel.second, third: sel.third };
  } else if (!sel.second) {
    state.groupSelections[g] = { first: sel.first, second: teamId, third: sel.third };
  } else if (!sel.third) {
    state.groupSelections[g] = { first: sel.first, second: sel.second, third: teamId };
  } else {
    state.groupSelections[g] = { first: sel.first, second: sel.second, third: teamId };
  }
  renderGroups();
  updateStageStates();
}

function allGroupsComplete() {
  return GROUPS.every(g => {
    const s = state.groupSelections[g];
    return s && s.first && s.second;
  });
}

function countThirdPlace() {
  return GROUPS.filter(g => {
    const s = state.groupSelections[g];
    return s && s.third;
  }).length;
}

// ── BEST 3RD PLACE ─────────────────────────────────────────────────────
function renderBestThird() {
  const container = document.getElementById("bestThirdContainer");
  container.innerHTML = "";

  const thirdPlacers = [];
  GROUPS.forEach(g => {
    const sel = state.groupSelections[g];
    if (sel && sel.third) {
      thirdPlacers.push({ id: sel.third, group: g });
    }
  });

  thirdPlacers.forEach(({ id, group }) => {
    const isSelected = state.bestThirdSelected.includes(id);
    const team = teamById(id);
    const div = document.createElement("div");
    div.className = `best-third-team ${isSelected ? "selected" : ""}`;
    div.innerHTML = `
      <img src="${flagUrl(id)}" alt="${teamName(id)}" class="flag-img" onerror="this.style.display='none'">
      <span class="team-name">${team.names[currentLang] || team.names.en}</span>
      <span class="team-group">(${t("groupLabel")} ${group})</span>
      ${isSelected ? `<span class="checkmark">✓</span>` : ""}
    `;
    div.addEventListener("click", () => toggleBestThird(id));
    container.appendChild(div);
  });

  document.getElementById("bestThirdCount").textContent = state.bestThirdSelected.length;
}

function toggleBestThird(teamId) {
  const idx = state.bestThirdSelected.indexOf(teamId);
  if (idx >= 0) {
    state.bestThirdSelected.splice(idx, 1);
  } else if (state.bestThirdSelected.length < 8) {
    state.bestThirdSelected.push(teamId);
  } else {
    showToast(t("toastBestThirdFull"));
    return;
  }
  renderBestThird();
  updateStageStates();
}

function goBestThird() {
  if (!allGroupsComplete()) { showToast(t("toastNeedPick")); return; }
  const count = countThirdPlace();
  if (count < 8) {
    showToast(`Pick 3rd place in at least 8 groups (currently ${count})`);
    return;
  }
  state.bestThirdSelected = [];
  renderBestThird();
  showStage("bestthird");
}

function goToR32() {
  if (state.bestThirdSelected.length !== 8) {
    showToast(t("toastNeedPick"));
    return;
  }
  state.r32Winners = [];
  const matches = buildR32Matches();
  const pick = (idx, teamId) => {
    state.r32Winners[idx] = teamId;
    renderBracket("round32Container", matches, state.r32Winners, pick);
  };
  renderBracket("round32Container", matches, state.r32Winners, pick);
  showStage("round32");
}

// ── BRACKET RENDERING ──────────────────────────────────────────────────
function renderBracket(containerId, matches, winners, onPick) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";

  matches.forEach((match, idx) => {
    const [a, b] = match;
    const winner = winners[idx];
    const matchEl = document.createElement("div");
    matchEl.className = "match-card";

    matchEl.innerHTML = `
      <div class="match-label">${t("matchLabel")} ${idx + 1}</div>
      <div class="match-teams">
        <button class="team-btn ${winner === a ? "winner" : ""} ${!a ? "disabled" : ""}"
                data-idx="${idx}" data-team="${a || ""}" ${!a ? "disabled" : ""}>
          <img src="${a ? flagUrl(a) : ''}" alt="" class="flag-img" style="${!a ? 'display:none' : ''}">
          <span class="btn-name">${a ? (teamById(a).names[currentLang] || teamById(a).names.en) : "TBD"}</span>
          ${winner === a ? '<span class="win-star">★</span>' : ''}
        </button>
        <span class="vs-label">${t("vsLabel")}</span>
        <button class="team-btn ${winner === b ? "winner" : ""} ${!b ? "disabled" : ""}"
                data-idx="${idx}" data-team="${b || ""}" ${!b ? "disabled" : ""}>
          <img src="${b ? flagUrl(b) : ''}" alt="" class="flag-img" style="${!b ? 'display:none' : ''}">
          <span class="btn-name">${b ? (teamById(b).names[currentLang] || teamById(b).names.en) : "TBD"}</span>
          ${winner === b ? '<span class="win-star">★</span>' : ''}
        </button>
      </div>`;

    matchEl.querySelectorAll(".team-btn:not([disabled])").forEach(btn => {
      btn.addEventListener("click", () => {
        const teamId = btn.dataset.team;
        if (teamId) onPick(idx, teamId);
      });
    });

    container.appendChild(matchEl);
  });

  updateStageStates();
}

// ── BRACKET BUILDING ───────────────────────────────────────────────────
function buildR32Matches() {
  // 32 seeded teams: 12 winners + 12 runners-up + 8 best 3rd
  const seeds = [
    ...GROUPS.map(g => state.groupSelections[g]?.first).filter(Boolean),
    ...GROUPS.map(g => state.groupSelections[g]?.second).filter(Boolean),
    ...state.bestThirdSelected.slice(0, 8),
  ];

  while (seeds.length < 32) seeds.push(null);

  const matches = [];
  for (let i = 0; i < 16; i++) {
    matches.push([seeds[i], seeds[31 - i]]);
  }
  return matches;
}

function buildMatchesFromWinners(prevWinners) {
  const matches = [];
  for (let i = 0; i < prevWinners.length; i += 2) {
    matches.push([prevWinners[i] || null, prevWinners[i+1] || null]);
  }
  return matches;
}

// ── ROUND TRANSITIONS ──────────────────────────────────────────────────
function goToR16() {
  if (state.r32Winners.filter(Boolean).length < 16) { showToast(t("toastNeedPick")); return; }
  state.r16Winners = [];
  const matches = buildMatchesFromWinners(state.r32Winners);
  const pick = (idx, teamId) => {
    state.r16Winners[idx] = teamId;
    renderBracket("round16Container", matches, state.r16Winners, pick);
  };
  renderBracket("round16Container", matches, state.r16Winners, pick);
  showStage("round16");
}

function goToQF() {
  if (state.r16Winners.filter(Boolean).length < 8) { showToast(t("toastNeedPick")); return; }
  state.qfWinners = [];
  const matches = buildMatchesFromWinners(state.r16Winners);
  const pick = (idx, teamId) => {
    state.qfWinners[idx] = teamId;
    renderBracket("quartersContainer", matches, state.qfWinners, pick);
  };
  renderBracket("quartersContainer", matches, state.qfWinners, pick);
  showStage("quarters");
}

function goToSF() {
  if (state.qfWinners.filter(Boolean).length < 4) { showToast(t("toastNeedPick")); return; }
  state.sfWinners = [];
  const matches = buildMatchesFromWinners(state.qfWinners);
  const pick = (idx, teamId) => {
    state.sfWinners[idx] = teamId;
    renderBracket("semisContainer", matches, state.sfWinners, pick);
  };
  renderBracket("semisContainer", matches, state.sfWinners, pick);
  showStage("semis");
}

function goToFinal() {
  if (state.sfWinners.filter(Boolean).length < 2) { showToast(t("toastNeedPick")); return; }
  state.finalWinner = null;
  const matches = [[state.sfWinners[0], state.sfWinners[1]]];
  const pick = (idx, teamId) => {
    state.finalWinner = teamId;
    renderBracket("finalContainer", matches, [state.finalWinner], pick);
    showChampion(teamId);
  };
  renderBracket("finalContainer", matches, state.finalWinner ? [state.finalWinner] : [], pick);
  document.getElementById("championDisplay").classList.add("hidden");
  showStage("final");
}

function showChampion(teamId) {
  const team = teamById(teamId);
  if (!team) return;
  const name = team.names[currentLang] || team.names.en;
  const el = document.getElementById("championDisplay");
  el.innerHTML = `
    <div class="champion-card">
      <div class="champion-confetti">🎉🎊🎉🎊🎉</div>
      <img src="${flagUrl(team.id)}" alt="" class="champion-flag">
      <div class="champion-name">${name}</div>
      <div class="champion-msg">${t("championMsg")}</div>
      <div class="champion-sub">${t("championSub")}</div>
      <div class="champion-actions">
        <button class="btn-share" id="btnShare">${t("shareBtn")}</button>
        <button class="btn-restart" id="btnRestart">${t("restartBtn")}</button>
      </div>
    </div>`;
  el.classList.remove("hidden");
  el.scrollIntoView({ behavior: "smooth", block: "center" });

  document.getElementById("btnShare").addEventListener("click", () => shareResult(name));
  document.getElementById("btnRestart").addEventListener("click", resetSimulation);

  el.querySelector(".champion-card").classList.add("pop-in");
}

function shareResult(name) {
  const text = `${name} — ${t("championMsg")} 🏆 #WorldCup2026`;
  if (navigator.share) {
    navigator.share({ title: t("siteTitle"), text }).catch(() => {});
  } else {
    navigator.clipboard?.writeText(text).then(() => showToast("Copied!")).catch(() => {});
  }
}

function resetSimulation() {
  state.groupSelections = {};
  state.bestThirdSelected = [];
  state.r32Winners = [];
  state.r16Winners = [];
  state.qfWinners = [];
  state.sfWinners = [];
  state.finalWinner = null;
  renderGroups();
  showStage("groups");
  updateStageStates();
  showToast(t("toastReset"));
}

function rerenderCurrentStage() {
  applyTranslations();
  if (state.currentStage === "groups") {
    renderGroups();
  } else if (state.currentStage === "bestthird") {
    renderBestThird();
  } else if (state.currentStage === "round32") {
    const matches = buildR32Matches();
    const pick = (idx, teamId) => {
      state.r32Winners[idx] = teamId;
      renderBracket("round32Container", matches, state.r32Winners, pick);
    };
    renderBracket("round32Container", matches, state.r32Winners, pick);
  } else if (state.currentStage === "round16") {
    const matches = buildMatchesFromWinners(state.r32Winners);
    const pick = (idx, teamId) => {
      state.r16Winners[idx] = teamId;
      renderBracket("round16Container", matches, state.r16Winners, pick);
    };
    renderBracket("round16Container", matches, state.r16Winners, pick);
  } else if (state.currentStage === "quarters") {
    const matches = buildMatchesFromWinners(state.r16Winners);
    const pick = (idx, teamId) => {
      state.qfWinners[idx] = teamId;
      renderBracket("quartersContainer", matches, state.qfWinners, pick);
    };
    renderBracket("quartersContainer", matches, state.qfWinners, pick);
  } else if (state.currentStage === "semis") {
    const matches = buildMatchesFromWinners(state.qfWinners);
    const pick = (idx, teamId) => {
      state.sfWinners[idx] = teamId;
      renderBracket("semisContainer", matches, state.sfWinners, pick);
    };
    renderBracket("semisContainer", matches, state.sfWinners, pick);
  } else if (state.currentStage === "final") {
    const matches = [[state.sfWinners[0], state.sfWinners[1]]];
    const pick = (idx, teamId) => {
      state.finalWinner = teamId;
      renderBracket("finalContainer", matches, [state.finalWinner], pick);
      showChampion(teamId);
    };
    renderBracket("finalContainer", matches, state.finalWinner ? [state.finalWinner] : [], pick);
    if (state.finalWinner) showChampion(state.finalWinner);
  }
}

// ── INIT ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  try {
    initStageNav();
    setLang(currentLang);
    renderGroups();
    updateStageStates();

    document.querySelectorAll(".stage-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        if (tab.classList.contains("locked")) {
          showToast(t("toastNeedPick"));
          return;
        }
        showStage(tab.dataset.stage);
      });
    });

    document.getElementById("btnStartGuide").addEventListener("click", () => showStage("groups"));
    document.getElementById("btnGroupsNext").addEventListener("click", goBestThird);
    document.getElementById("btnBestThirdNext").addEventListener("click", goToR32);
    document.getElementById("btnR32Next").addEventListener("click", goToR16);
    document.getElementById("btnR16Next").addEventListener("click", goToQF);
    document.getElementById("btnQFNext").addEventListener("click", goToSF);
    document.getElementById("btnSFNext").addEventListener("click", goToFinal);
    document.getElementById("btnReset").addEventListener("click", resetSimulation);

    const langBtn = document.getElementById("langBtn");
    const dropdown = document.getElementById("langDropdown");
    langBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("open");
    });
    document.addEventListener("click", () => dropdown.classList.remove("open"));
    dropdown.querySelectorAll("button[data-lang]").forEach(btn => {
      btn.addEventListener("click", () => {
        setLang(btn.dataset.lang);
        dropdown.classList.remove("open");
      });
    });
  } catch (error) {
    console.error("Error during initialization:", error);
  }
});
