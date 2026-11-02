
// ==========================================
// NAUKRISETU - SUPABASE CONNECTION
// ==========================================

const SUPABASE_URL = "https://suxpoqntuvsdcvgdkxlz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XPQiTJEaYSeb_nnWi-3C3A_baaPvwPz";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

// ==========================================
// GLOBAL VARIABLES
// ==========================================

let jobs = [];
let admitCards = [];
let results = [];
let answerKeys = [];

let activeFilter = "All";
let visibleCount = 5;
let currentQuery = "";

const jobList = document.getElementById("jobList");
const emptyState = document.getElementById("emptyState");
const resultCount = document.getElementById("resultCount");

// ==========================================
// HELPER FUNCTIONS
// ==========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function formatDate(value) {
  if (!value) return "Check notification";

  const date = new Date(
    value + (String(value).length === 10 ? "T00:00:00" : "")
  );

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// Only allow valid HTTP/HTTPS URLs
function getSafeURL(value) {
  if (!value) return "";

  try {
    const url = new URL(String(value).trim());

    if (url.protocol === "https:" || url.protocol === "http:") {
      return url.href;
    }

    return "";
  } catch {
    return "";
  }
}

function getCategory(department = "") {
  const d = department.toLowerCase();

  if (d.includes("maharashtra") || d.includes("mpsc") || d.includes("maha")) {
    return "Maharashtra";
  }

  if (d.includes("railway") || d.includes("rrb")) {
    return "Railway";
  }

  if (d.includes("bank") || d.includes("ibps") || d.includes("sbi")) {
    return "Banking";
  }

  if (d.includes("ssc") || d.includes("upsc")) {
    return "SSC";
  }

  if (d.includes("teaching") || d.includes("education") || d.includes("teacher")) {
    return "Teaching";
  }

  if (d.includes("defence") || d.includes("army") || d.includes("navy") || d.includes("air force")) {
    return "Defence";
  }

  if (d.includes("private")) {
    return "Private";
  }

  return "Central Government";
}

function mapJob(row) {
  const department = row.department || "Recruitment Department";
  const category = getCategory(department);

  return {
    id: row.id,
    org: department,
    initials: department.substring(0, 3).toUpperCase(),
    title: row.title || "Untitled Recruitment",
    category: category,
    tags: [
      row.qualification || "Qualification as per notification",
      row.location || "India"
    ],
    deadline: formatDate(row.last_date),
    qualification: row.qualification || "As per official notification",
    vacancies: row.total_posts ?? "As per notification",
    location: row.location || "As per notification",
    type: category,
    official: getSafeURL(row.official_url || row.notification_url),
    notification: getSafeURL(row.notification_url || row.official_url),
    description: row.description || "Please read the official notification for complete details."
  };
}

// ==========================================
// LOAD PUBLISHED JOBS
// ==========================================

async function loadJobs() {
  jobList.innerHTML = "<p>Loading published jobs...</p>";

  const { data, error } = await supabaseClient
    .from("jobs")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Jobs loading error:", error);
    jobList.innerHTML = "<p>Jobs load नहीं हो सके। कृपया कुछ देर बाद दोबारा कोशिश करें।</p>";
    resultCount.textContent = "Unable to load jobs";
    return;
  }

  jobs = (data || []).map(mapJob);

  renderJobs();
}

// ==========================================
// FILTER AND SEARCH JOBS
// ==========================================

function filteredJobs() {
  const q = currentQuery.trim().toLowerCase();

  return jobs.filter(j => {
    const matchesFilter =
      activeFilter === "All" ||
      j.category === activeFilter ||
      j.tags.some(t => t.toLowerCase().includes(activeFilter.toLowerCase())) ||
      (activeFilter === "Central Government" && j.category === "Central Government");

    const haystack = [
      j.title,
      j.org,
      j.category,
      j.location,
      ...j.tags,
      j.qualification
    ].join(" ").toLowerCase();

    return matchesFilter && (!q || haystack.includes(q));
  });
}

// ==========================================
// DISPLAY JOBS
// ==========================================

function renderJobs() {
  const list = filteredJobs();
  const shown = list.slice(0, visibleCount);

  jobList.innerHTML = shown.map(j => `
    <article class="job-row">
      <div class="org-mark">${escapeHTML(j.initials)}</div>

      <div class="job-info">
        <h3>${escapeHTML(j.title)}</h3>
        <p>${escapeHTML(j.org)} · ${escapeHTML(j.location)}</p>

        <div class="job-meta">
          <span class="job-chip">${escapeHTML(j.category)}</span>
          ${j.tags.slice(0, 2).map(t => `<span class="job-chip">${escapeHTML(t)}</span>`).join("")}
          <span class="job-chip deadline">${escapeHTML(j.deadline)}</span>
        </div>
      </div>

      <div class="job-action">
        <span class="job-status">Published</span>
        <button class="view-job" data-job="${escapeHTML(j.id)}">View Details ↗</button>
      </div>
    </article>
  `).join("");

  emptyState.hidden = shown.length !== 0;

  if (list.length === 0) {
    emptyState.hidden = false;
    resultCount.textContent = "No published jobs found";
  } else {
    resultCount.textContent = `Showing ${shown.length} of ${list.length} jobs`;
  }

  document.getElementById("showMoreBtn").hidden = list.length <= visibleCount;
}

function setFilter(filter) {
  activeFilter = filter;
  currentQuery = "";
  visibleCount = 5;

  document.querySelectorAll(".filter-tab").forEach(b => {
    b.classList.toggle("selected", b.dataset.filter === filter);
  });

  renderJobs();

  document.getElementById("latest").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function searchJobs(query) {
  currentQuery = query || "";
  activeFilter = "All";
  visibleCount = jobs.length;

  document.querySelectorAll(".filter-tab").forEach(b => {
    b.classList.toggle("selected", b.dataset.filter === "All");
  });

  renderJobs();

  document.getElementById("latest").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// ==========================================
// JOB DETAILS MODAL
// ==========================================

function openJob(id) {
  const j = jobs.find(x => String(x.id) === String(id));

  if (!j) return;

  document.getElementById("modalTitle").textContent = j.title;
  document.getElementById("modalOrg").textContent = j.org + " · " + j.location;

  document.getElementById("modalBadges").innerHTML = [
    j.category,
    ...j.tags
  ].map(t => `<span>${escapeHTML(t)}</span>`).join("");

  document.getElementById("modalDetails").innerHTML = [
    ["Qualification", j.qualification],
    ["Vacancies", j.vacancies],
    ["Application Deadline", j.deadline],
    ["Job Location", j.location],
    ["Recruitment Type", j.type],
    ["Description", j.description]
  ].map(([k, v]) => `
    <div class="detail-cell">
      <small>${escapeHTML(k)}</small>
      <b>${escapeHTML(v)}</b>
    </div>
  `).join("");

  const officialLink = document.getElementById("modalOfficial");
  officialLink.href = j.official || "#";
  officialLink.target = "_blank";
  officialLink.rel = "noopener noreferrer";
  officialLink.style.display = j.official ? "" : "none";

  document.getElementById("jobModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeJob() {
  document.getElementById("jobModal").hidden = true;
  document.body.style.overflow = "";
}

// ==========================================
// LOAD ADMIT CARDS
// ==========================================

async function loadAdmitCards() {
  const container = document.getElementById("admitCardList");

  if (!container) {
    console.error("Admit Card container not found.");
    return;
  }

  container.innerHTML = "<p class='updates-loading'>Loading admit cards...</p>";

  const { data, error } = await supabaseClient
    .from("admit_cards")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Admit cards error:", error);
    container.innerHTML = "<p>Admit cards load नहीं हो सके।</p>";
    return;
  }

  admitCards = data || [];

  if (admitCards.length === 0) {
    container.innerHTML = "<p class='updates-loading'>अभी कोई Published Admit Card उपलब्ध नहीं है।</p>";
    return;
  }

  container.innerHTML = admitCards.map(item => {
    const url = getSafeURL(item.download_url) || getSafeURL(item.official_url);

    return `
      <a class="update-card"
         href="${escapeHTML(url || "#")}"
         ${url ? 'target="_blank" rel="noopener noreferrer"' : 'aria-disabled="true" onclick="return false;"'}>
        <span class="update-icon blue">▣</span>
        <div>
          <b>${escapeHTML(item.title)}</b>
          <small>${escapeHTML(item.department || "Recruitment Update")} · ${escapeHTML(formatDate(item.exam_date))}</small>
        </div>
        <span class="update-arrow">↗</span>
      </a>
    `;
  }).join("");
}

// ==========================================
// LOAD RESULTS
// ==========================================

async function loadResults() {
  const container = document.getElementById("resultList");

  if (!container) {
    console.error("Result container not found.");
    return;
  }

  container.innerHTML = "<p class='updates-loading'>Loading results...</p>";

  const { data, error } = await supabaseClient
    .from("results")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Results loading error:", error);
    container.innerHTML = "<p>Results load नहीं हो सके।</p>";
    return;
  }

  results = data || [];

  if (results.length === 0) {
    container.innerHTML = "<p class='updates-loading'>अभी कोई Published Result उपलब्ध नहीं है।</p>";
    return;
  }

  container.innerHTML = results.map(item => {
    const url = getSafeURL(item.result_url) || getSafeURL(item.official_url);

    return `
      <a class="update-card"
         href="${escapeHTML(url || "#")}"
         ${url ? 'target="_blank" rel="noopener noreferrer"' : 'aria-disabled="true" onclick="return false;"'}>
        <span class="update-icon green">▥</span>
        <div>
          <b>${escapeHTML(item.title)}</b>
          <small>${escapeHTML(item.department || "Exam Update")} · ${escapeHTML(formatDate(item.result_date))}</small>
        </div>
        <span class="update-arrow">↗</span>
      </a>
    `;
  }).join("");
}

// ==========================================
// LOAD ANSWER KEYS - SUPABASE
// ==========================================

async function loadAnswerKeys() {
  const container = document.getElementById("answerKeyList");

  if (!container) {
    console.error("Answer Key container #answerKeyList not found.");
    return;
  }

  container.innerHTML = "<p class='updates-loading'>Loading answer keys...</p>";

  const { data, error } = await supabaseClient
    .from("answer_keys")
    .select("*")
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Answer Keys loading error:", error);
    container.innerHTML = "<p>Answer Keys load नहीं हो सके। कृपया कुछ देर बाद कोशिश करें।</p>";
    return;
  }

  answerKeys = data || [];

  if (answerKeys.length === 0) {
    container.innerHTML =
      "<p class='updates-loading'>अभी कोई Published Answer Key उपलब्ध नहीं है।</p>";
    return;
  }

  container.innerHTML = answerKeys.map(item => {
    const url =
      getSafeURL(item.answer_key_url) ||
      getSafeURL(item.official_url);

    return `
      <a class="update-card"
         href="${escapeHTML(url || "#")}"
         ${url
           ? 'target="_blank" rel="noopener noreferrer"'
           : 'aria-disabled="true" onclick="return false;"'}>
        <span class="update-icon green">✓</span>
        <div>
          <b>${escapeHTML(item.title)}</b>
          <small>
            ${escapeHTML(item.department || "Examination Update")}
            · ${escapeHTML(formatDate(item.exam_date))}
          </small>
        </div>
        <span class="update-arrow">↗</span>
      </a>
    `;
  }).join("");
}

// ==========================================
// EVENT LISTENERS
// ==========================================

jobList.addEventListener("click", e => {
  const button = e.target.closest("[data-job]");
  if (button) openJob(button.dataset.job);
});

document.getElementById("filterTabs").addEventListener("click", e => {
  const button = e.target.closest("[data-filter]");
  if (button) setFilter(button.dataset.filter);
});

document.querySelectorAll("[data-category]").forEach(button => {
  button.addEventListener("click", () => setFilter(button.dataset.category));
});

document.querySelectorAll("[data-quick]").forEach(button => {
  button.addEventListener("click", () => searchJobs(button.dataset.quick));
});

document.getElementById("heroSearchBtn").addEventListener("click", () => {
  searchJobs(document.getElementById("heroSearch").value);
});

document.getElementById("heroSearch").addEventListener("keydown", e => {
  if (e.key === "Enter") searchJobs(e.target.value);
});

document.getElementById("sideSearchBtn").addEventListener("click", () => {
  searchJobs(document.getElementById("sideSearch").value);
});

document.getElementById("sideSearch").addEventListener("keydown", e => {
  if (e.key === "Enter") searchJobs(e.target.value);
});

document.getElementById("showMoreBtn").addEventListener("click", () => {
  visibleCount = jobs.length;
  renderJobs();
});

document.getElementById("modalClose").addEventListener("click", closeJob);
document.getElementById("modalDone").addEventListener("click", closeJob);

document.getElementById("jobModal").addEventListener("click", e => {
  if (e.target.id === "jobModal") closeJob();
});

// ==========================================
// STATIC INFORMATION MODAL
// ==========================================

const staticContent = {
  about: [
    "About NaukriSetu",
    "NaukriSetu is an independent career information platform intended to help job seekers discover recruitment notices, examination updates, admit cards and results. We are not a government organization and are not affiliated with any recruitment authority."
  ],

  contact: [
    "Contact Us",
    "Contact details will be added before the website is launched publicly. Please do not submit personal documents or sensitive information through an unverified contact channel."
  ],

  privacy: [
    "Privacy Policy",
    "This website displays recruitment information stored in its database. Any future forms, analytics or other data collection must be explained in an updated Privacy Policy."
  ],

  disclaimer: [
    "Disclaimer",
    "NaukriSetu is an independent information website and is not affiliated with the Government of India or any state government. All recruitment details must be verified against the official notification. Dates, eligibility, fees, vacancies and links can change. Always use the recruiting organization's official website to apply."
  ],

  terms: [
    "Terms & Conditions",
    "Information on this website is provided for general awareness. Users must independently verify all recruitment information with the relevant official authority. Do not use this website to submit applications or payments unless a verified official link directs you to the recruiting organization."
  ]
};

function openStatic(key) {
  const item = staticContent[key];
  if (!item) return;

  document.getElementById("staticTitle").textContent = item[0];

  document.getElementById("staticBody").innerHTML =
    `<p>${escapeHTML(item[1])}</p>`;

  document.getElementById("staticModal").hidden = false;
  document.body.style.overflow = "hidden";
}

function closeStatic() {
  document.getElementById("staticModal").hidden = true;

  if (document.getElementById("jobModal").hidden) {
    document.body.style.overflow = "";
  }
}

document.querySelectorAll("[data-static]").forEach(link => {
  link.addEventListener("click", e => {
    e.preventDefault();
    openStatic(link.dataset.static);
  });
});

document.getElementById("staticClose").addEventListener("click", closeStatic);

document.getElementById("staticModal").addEventListener("click", e => {
  if (e.target.id === "staticModal") closeStatic();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    closeJob();
    closeStatic();
  }
});

// ==========================================
// MOBILE MENU
// ==========================================

const menuBtn = document.getElementById("mobileMenuBtn");
const nav = document.getElementById("mainNav");

menuBtn.addEventListener("click", () => {
  const open = nav.classList.toggle("open");

  menuBtn.setAttribute("aria-expanded", String(open));
  menuBtn.textContent = open ? "×" : "☰";
});

nav.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    nav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
    menuBtn.textContent = "☰";
  });
});

// ==========================================
// BACK TO TOP
// ==========================================

const backTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
  backTop.classList.toggle("show", window.scrollY > 500);
});

backTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});

// ==========================================
// FOOTER YEAR
// ==========================================

document.getElementById("year").textContent = new Date().getFullYear();

// ==========================================
// START WEBSITE
// ==========================================

async function initializeWebsite() {
  await Promise.all([
    loadJobs(),
    loadAdmitCards(),
    loadResults(),
    loadAnswerKeys()
  ]);
}

initializeWebsite();
