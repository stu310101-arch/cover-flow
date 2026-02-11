// 共用設定：科目與單元（含各單元對應的 HTML 檔案路徑）
const SUBJECTS = {
  physics: {
    id: "physics",
    name: "物理",
    subjectFile: "physics.html",
    units: [
      { id: "p1", title: "牛頓第一運動定律", file: "physics-p1.html" },
      { id: "p2", title: "牛頓第二運動定律", file: "physics-p2.html" },
      { id: "p3", title: "牛頓第三運動定律", file: "physics-p3.html" },
      { id: "p4", title: "熱力學第一定律", file: "physics-p4.html" },
      { id: "p5", title: "萬有引力", file: "physics-p5.html" },
      { id: "p6", title: "光學：折射與反射", file: "physics-p6.html" },
      { id: "p7", title: "電磁感應", file: "physics-p7.html" },
      { id: "p8", title: "量子力學基礎", file: "physics-p8.html" }
    ]
  },
  chemistry: {
    id: "chemistry",
    name: "化學",
    subjectFile: "chemistry.html",
    units: [
      { id: "c_periodic", title: "元素週期表", file: "chemistry-periodic.html" },
      { id: "c1", title: "原子結構", file: "chemistry-c1.html" },
      { id: "c2", title: "化學鍵結", file: "chemistry-c2.html" },
      { id: "c3", title: "酸鹼中和", file: "chemistry-c3.html" },
      { id: "c4", title: "氧化還原反應", file: "chemistry-c4.html" },
      { id: "c5", title: "有機化學導論", file: "chemistry-c5.html" }
    ]
  },
  biology: {
    id: "biology",
    name: "生物",
    subjectFile: "biology.html",
    units: [
      { id: "b1", title: "細胞構造", file: "biology-b1.html" },
      { id: "b2", title: "光合作用", file: "biology-b2.html" },
      { id: "b3", title: "遺傳學：孟德爾定律", file: "biology-b3.html" },
      { id: "b4", title: "人體循環系統", file: "biology-b4.html" },
      { id: "b5", title: "神經系統", file: "biology-b5.html" }
    ]
  },
  earth_science: {
    id: "earth_science",
    name: "地科",
    subjectFile: "earth_science.html",
    units: [
      { id: "e1", title: "地球氣體與大氣層", file: "earth-e1.html" },
      { id: "e2", title: "板塊構造學說", file: "earth-e2.html" },
      { id: "e3", title: "天文：太陽系", file: "earth-e3.html" },
      { id: "e4", title: "岩石循環", file: "earth-e4.html" },
      { id: "e5", title: "氣象觀測", file: "earth-e5.html" }
    ]
  }
};

const UNITS_PER_PAGE = 10; // 目錄頁一頁顯示 10 個單元

// 搜尋索引：用在首頁搜尋列
const searchIndex = [];
Object.keys(SUBJECTS).forEach((key) => {
  const subject = SUBJECTS[key];
  (subject.units || []).forEach((unit) => {
    searchIndex.push({
      subjectId: subject.id,
      subjectName: subject.name,
      unitId: unit.id,
      unitTitle: unit.title,
      file: unit.file
    });
  });
});

// Firebase / Auth 狀態
let firebaseReady = false;
let auth = null;
let db = null;
let currentUser = null;

// 目錄／單元頁狀態
let activeSubjectId = null;
let activeUnitId = null;
let activeUnitTitle = "";
let currentBookPage = 0;

// ===== Firebase 設定（請改成你自己的專案設定） =====
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

function initFirebaseAndAuth() {
  const userLabel = document.getElementById("authUserLabel");
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  if (!window.firebase) {
    if (userLabel) userLabel.textContent = "尚未登入（Firebase SDK 未載入）";
    if (loginBtn) loginBtn.disabled = true;
    return;
  }

  try {
    const placeholder = !firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY";
    if (placeholder) {
      if (userLabel) userLabel.textContent = "尚未登入（請先在 common.js 中設定 firebaseConfig）";
      if (loginBtn) loginBtn.disabled = true;
      return;
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseReady = true;
  } catch (e) {
    console.error("Firebase 初始化失敗：", e);
    if (userLabel) userLabel.textContent = "尚未登入（Firebase 初始化失敗）";
    if (loginBtn) loginBtn.disabled = true;
    return;
  }

  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      if (!firebaseReady || !auth) {
        alert("尚未設定有效的 Firebase 設定，請先在 common.js 中填入 firebaseConfig。");
        return;
      }
      const provider = new firebase.auth.GoogleAuthProvider();
      auth.signInWithPopup(provider).catch((err) => {
        console.error("登入失敗", err);
        alert("登入失敗：" + (err && err.message ? err.message : "請稍後再試"));
      });
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      if (!auth) return;
      auth.signOut().catch((err) => {
        console.error("登出失敗", err);
      });
    });
  }

  if (auth) {
    auth.onAuthStateChanged((user) => {
      currentUser = user || null;
      if (userLabel) {
        if (user) {
          userLabel.textContent = "已登入：" + (user.displayName || user.email || "匿名使用者");
        } else {
          userLabel.textContent = "尚未登入";
        }
      }
      if (loginBtn) loginBtn.style.display = user ? "none" : "inline-flex";
      if (logoutBtn) logoutBtn.style.display = user ? "inline-flex" : "none";

      updateNoteEditorState();
      const pageType = document.body.dataset.page;
      if (pageType === "unit" && activeUnitId && firebaseReady && db) {
        loadUserNote();
      }
    });
  }
}

// ===== 首頁：搜尋＋導向 =====
function initHomePage() {
  const searchInput = document.getElementById("searchInput");
  const searchClearBtn = document.getElementById("searchClearBtn");
  const searchResultsBox = document.getElementById("searchResults");
  const searchArea = document.getElementById("searchArea");

  if (!searchInput || !searchResultsBox || !searchArea || !searchClearBtn) return;

  function renderSearchResults(query) {
    const q = (query || "").trim().toLowerCase();
    searchResultsBox.innerHTML = "";
    if (!q) {
      searchResultsBox.style.display = "none";
      return;
    }

    const matches = searchIndex.filter((item) =>
      item.unitTitle.toLowerCase().includes(q) ||
      item.subjectName.toLowerCase().includes(q)
    );

    if (!matches.length) {
      const div = document.createElement("div");
      div.className = "search-result-empty";
      div.textContent = "找不到相關單元";
      searchResultsBox.appendChild(div);
    } else {
      matches.forEach((item) => {
        const row = document.createElement("div");
        row.className = "search-result-item";
        const main = document.createElement("div");
        main.className = "search-result-main";
        const title = document.createElement("div");
        title.className = "search-result-title";
        title.textContent = item.unitTitle;
        const sub = document.createElement("div");
        sub.className = "search-result-subject";
        sub.textContent = item.subjectName;
        main.appendChild(title);
        main.appendChild(sub);
        const arrow = document.createElement("div");
        arrow.textContent = "→";
        arrow.style.fontSize = "12px";
        arrow.style.color = "#9ca3af";
        row.appendChild(main);
        row.appendChild(arrow);
        row.addEventListener("click", () => {
          const target = item.file;
          if (target) {
            window.location.href = target;
          }
        });
        searchResultsBox.appendChild(row);
      });
    }
    searchResultsBox.style.display = "block";
  }

  searchInput.addEventListener("input", () => {
    renderSearchResults(searchInput.value);
  });

  searchClearBtn.addEventListener("click", () => {
    searchInput.value = "";
    renderSearchResults("");
    searchInput.focus();
  });

  document.addEventListener("click", (e) => {
    if (!searchArea.contains(e.target)) {
      searchResultsBox.style.display = "none";
    }
  });
}

// ===== 科目目錄頁：筆記本風、一頁 5 個單元 =====
function initSubjectPage() {
  const subjectId = document.body.dataset.subjectId;
  const subject = SUBJECTS[subjectId];
  if (!subject) return;

  activeSubjectId = subjectId;
  currentBookPage = 0;

  const titleEl = document.getElementById("bookSubjectTitle");
  const listEl = document.getElementById("bookUnitList");
  const pageInfoEl = document.getElementById("bookPageInfo");
  const prevBtn = document.getElementById("bookPrevPageBtn");
  const nextBtn = document.getElementById("bookNextPageBtn");
  const backBtn = document.getElementById("bookBackBtn");

  if (titleEl) titleEl.textContent = subject.name + " 筆記本";

  function renderPage() {
    const units = subject.units || [];
    const totalPages = Math.max(1, Math.ceil(units.length / UNITS_PER_PAGE));

    if (currentBookPage >= totalPages) currentBookPage = totalPages - 1;
    if (currentBookPage < 0) currentBookPage = 0;

    const start = currentBookPage * UNITS_PER_PAGE;
    const pageUnits = units.slice(start, start + UNITS_PER_PAGE);

    if (!listEl) return;
    listEl.innerHTML = "";

    if (!pageUnits.length) {
      const div = document.createElement("div");
      div.className = "book-unit-empty";
      div.textContent = "此科目前尚未建立單元。";
      listEl.appendChild(div);
    } else {
      pageUnits.forEach((unit, index) => {
        const card = document.createElement("a");
        card.href = unit.file || "#";
        card.className = "book-unit-item";
        const idx = document.createElement("div");
        idx.className = "book-unit-index";
        idx.textContent = String(start + index + 1).padStart(2, "0");
        const title = document.createElement("div");
        title.className = "book-unit-title";
        title.textContent = unit.title;
        const note = document.createElement("div");
        note.className = "book-unit-note";
        note.textContent = "點擊開啟本單元頁面與個人雲端筆記";
        card.appendChild(idx);
        card.appendChild(title);
        card.appendChild(note);
        listEl.appendChild(card);
      });
    }

    if (pageInfoEl) {
      pageInfoEl.textContent = (currentBookPage + 1) + " / " + totalPages;
    }
    if (prevBtn) prevBtn.disabled = currentBookPage === 0;
    if (nextBtn) nextBtn.disabled = currentBookPage >= totalPages - 1;
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", () => {
      if (currentBookPage > 0) {
        currentBookPage -= 1;
        renderPage();
      }
    });
  }
  if (nextBtn) {
    nextBtn.addEventListener("click", () => {
      currentBookPage += 1;
      renderPage();
    });
  }
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = "index.html";
    });
  }

  renderPage();
}

// ===== 單元頁：小提點 + 個人雲端筆記 =====
function initUnitPage() {
  const ds = document.body.dataset;
  activeSubjectId = ds.subjectId || null;
  activeUnitId = ds.unitId || null;
  activeUnitTitle = ds.unitTitle || "";

  const subjectName = ds.subjectName || "";
  const subjectFile = ds.subjectFile || "index.html";

  const breadcrumbEl = document.getElementById("noteBreadcrumb");
  const subjectTagEl = document.getElementById("noteSubjectTag");
  const unitTitleEl = document.getElementById("noteUnitTitle");
  const hintEl = document.getElementById("hintContent");
  const backBtn = document.getElementById("noteBackBtn");

  if (breadcrumbEl) {
    breadcrumbEl.textContent = subjectName && activeUnitTitle
      ? subjectName + " / " + activeUnitTitle
      : activeUnitTitle || "";
  }
  if (subjectTagEl) {
    subjectTagEl.textContent = subjectName || "";
  }
  if (unitTitleEl) {
    unitTitleEl.textContent = activeUnitTitle || "";
  }
  // 如果該單元未提供自訂內容，才顯示預設的小提點文字
  if (hintEl && !hintEl.dataset.custom) {
    hintEl.textContent = "這裡之後會放本單元的小提點（關鍵觀念、易錯點等），由你提供文字內容。";
  }
  if (backBtn) {
    backBtn.addEventListener("click", () => {
      window.location.href = subjectFile;
    });
  }

  initNoteEditor();
  updateNoteEditorState();
  if (firebaseReady && currentUser && db && activeUnitId) {
    loadUserNote();
  }
}

// ===== 雲端筆記邏輯（共用） =====
function updateNoteEditorState() {
  const textarea = document.getElementById("noteTextarea");
  const saveBtn = document.getElementById("noteSaveBtn");
  const status = document.getElementById("noteStatusText");

  if (!textarea || !saveBtn || !status) return; // 不在單元頁就直接略過

  if (!firebaseReady) {
    textarea.disabled = true;
    saveBtn.disabled = true;
    status.textContent = "Firebase 尚未設定，因此暫不提供雲端筆記功能。";
    return;
  }

  if (!currentUser) {
    textarea.disabled = true;
    saveBtn.disabled = true;
    status.textContent = "請先登入以編輯並儲存筆記。";
    return;
  }

  textarea.disabled = false;
  saveBtn.disabled = false;
  status.textContent = "已登入，可以編輯筆記並儲存到個人帳號。";
}

function loadUserNote() {
  const textarea = document.getElementById("noteTextarea");
  const status = document.getElementById("noteStatusText");
  const footerInfo = document.getElementById("noteFooterInfo");

  if (!firebaseReady || !db || !currentUser || !activeUnitId) return;
  if (!textarea || !status) return;

  status.textContent = "讀取雲端筆記中...";
  if (footerInfo) footerInfo.textContent = "";

  const docRef = db
    .collection("userNotes")
    .doc(currentUser.uid)
    .collection("units")
    .doc(activeUnitId);

  docRef
    .get()
    .then((doc) => {
      if (doc.exists) {
        const data = doc.data() || {};
        textarea.value = data.noteText || "";
        status.textContent = "已從雲端載入筆記。";
        if (data.updatedAt && data.updatedAt.toDate && footerInfo) {
          const d = data.updatedAt.toDate();
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const mm = String(d.getMinutes()).padStart(2, "0");
          footerInfo.textContent = "上次儲存時間：" + `${y}/${m}/${dd} ${hh}:${mm}`;
        }
      } else {
        textarea.value = "";
        status.textContent = "尚未建立筆記，可以開始撰寫。";
      }
    })
    .catch((err) => {
      console.error("載入筆記失敗", err);
      status.textContent = "載入筆記時發生錯誤。";
    });
}

function initNoteEditor() {
  const saveBtn = document.getElementById("noteSaveBtn");
  const textarea = document.getElementById("noteTextarea");
  const status = document.getElementById("noteStatusText");
  const footerInfo = document.getElementById("noteFooterInfo");

  if (!saveBtn || !textarea || !status) return;

  if (saveBtn.dataset.bound === "1") return; // 避免重複綁定
  saveBtn.dataset.bound = "1";

  saveBtn.addEventListener("click", () => {
    if (!firebaseReady || !db || !auth) {
      alert("Firebase 尚未設定，無法儲存到雲端。");
      return;
    }
    if (!currentUser) {
      alert("請先登入再儲存筆記。");
      return;
    }
    if (!activeUnitId) {
      alert("目前沒有選定單元。");
      return;
    }

    const noteText = textarea.value || "";
    const docRef = db
      .collection("userNotes")
      .doc(currentUser.uid)
      .collection("units")
      .doc(activeUnitId);

    saveBtn.disabled = true;
    status.textContent = "儲存中...";

    docRef
      .set(
        {
          noteText: noteText,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
          subjectId: activeSubjectId,
          unitTitle: activeUnitTitle
        },
        { merge: true }
      )
      .then(() => {
        status.textContent = "已儲存到雲端。";
        if (footerInfo) {
          const now = new Date();
          const y = now.getFullYear();
          const m = String(now.getMonth() + 1).padStart(2, "0");
          const d = String(now.getDate()).padStart(2, "0");
          const hh = String(now.getHours()).padStart(2, "0");
          const mm = String(now.getMinutes()).padStart(2, "0");
          footerInfo.textContent = "上次儲存時間：" + `${y}/${m}/${d} ${hh}:${mm}`;
        }
      })
      .catch((err) => {
        console.error("儲存筆記失敗", err);
        alert("儲存筆記失敗：" + (err && err.message ? err.message : "請稍後再試"));
        status.textContent = "儲存時發生錯誤。";
      })
      .finally(() => {
        saveBtn.disabled = false;
      });
  });
}

// ===== 入口：依據 body data-page 決定載入哪種頁面 =====
document.addEventListener("DOMContentLoaded", () => {
  initFirebaseAndAuth();

  const pageType = document.body.dataset.page || "home";
  if (pageType === "home") {
    initHomePage();
  } else if (pageType === "subject") {
    initSubjectPage();
  } else if (pageType === "unit") {
    initUnitPage();
  }
});
