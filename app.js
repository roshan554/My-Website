
(() => {
  "use strict";

  const SUPABASE_URL = "https://suxpoqntuvsdcvgdkxlz.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_XPQiTJEaYSeb_nnWi-3C3A_baaPvwPz";

  const db = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );

  const $ = id => document.getElementById(id);

  let pendingRows = [];
  let sourceNames = {};
  let jobRows = [];

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, ch => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[ch]);

  const val = id => $(id).value.trim();

  function showMessage(message, error = false) {
    const box = $("message");
    box.textContent = message;
    box.classList.add("show");
    box.style.background = error ? "#fff0ef" : "#eaf4ff";
    box.style.color = error ? "#8a1c13" : "#17466e";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const dateText = value =>
    value
      ? new Date(`${value}T00:00:00`).toLocaleDateString()
      : "—";

  function safeLink(url, label) {
    if (!url) {
      return `<span class="missing">Missing ${escapeHTML(label)}</span>`;
    }

    try {
      const parsed = new URL(url);

      if (!["https:", "http:"].includes(parsed.protocol)) {
        return `<span class="missing">Invalid ${escapeHTML(label)}</span>`;
      }

      return `<a href="${escapeHTML(parsed.href)}"
        target="_blank" rel="noopener noreferrer">
        ${escapeHTML(label)} ↗
      </a>`;
    } catch {
      return `<span class="missing">Invalid ${escapeHTML(label)}</span>`;
    }
  }

  function detail(label, value) {
    return `
      <div class="detail">
        <b>${escapeHTML(label)}</b>
        <span>
          ${value
            ? escapeHTML(value)
            : '<span class="missing">Not provided</span>'}
        </span>
      </div>
    `;
  }

  function setBusy(button, busy, text) {
    if (!button) return;

    button.disabled = busy;

    if (busy) {
      button.dataset.oldText = button.textContent;
      button.textContent = text || "Please wait…";
    } else if (button.dataset.oldText) {
      button.textContent = button.dataset.oldText;
    }
  }

  // ADMIN AUTHENTICATION

  async function verifyAdmin(user) {
    const { data, error } = await db
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      throw new Error(
        "This account is not authorized as an administrator."
      );
    }
  }

  async function openAdmin(user) {
    await verifyAdmin(user);

    $("loginPanel").classList.add("hidden");
    $("adminApp").classList.remove("hidden");
    $("logoutBtn").classList.remove("hidden");

    await loadSources();

    await Promise.all([
      loadDashboard(),
      loadPending(),
      loadJobs(),
      loadSimple("admit_cards", "admitList"),
      loadSimple("results", "resultsList"),
      loadSimple("answer_keys", "answerList")
    ]);
  }

  async function loadSources() {
    const { data, error } = await db
      .from("automation_sources")
      .select("id,name");

    if (error) {
      console.warn("Source names unavailable", error);
      return;
    }

    sourceNames = Object.fromEntries(
      (data || []).map(x => [x.id, x.name])
    );
  }

  // DASHBOARD

  async function loadDashboard() {
    const [jobs, pending, rejected] = await Promise.all([
      db.from("jobs").select("id,last_date,status"),

      db.from("collected_updates")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),

      db.from("collected_updates")
        .select("id", { count: "exact", head: true })
        .eq("status", "rejected")
    ]);

    if (jobs.error) throw jobs.error;

    const all = jobs.data || [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const next = new Date(today);
    next.setDate(next.getDate() + 7);

    const published = all.filter(
      x => x.status === "published"
    );

    const closing = published.filter(x => {
      if (!x.last_date) return false;

      const d = new Date(`${x.last_date}T00:00:00`);

      return d >= today && d <= next;
    });

    $("statPublished").textContent = published.length;
    $("statPending").textContent = pending.count ?? "—";
    $("statClosing").textContent = closing.length;
    $("statRejected").textContent = rejected.count ?? "—";

    $("dashboardSummary").textContent =
      `${published.length} published jobs, ` +
      `${pending.count ?? 0} pending notifications and ` +
      `${closing.length} jobs closing within 7 days.`;
  }

  // PENDING UPDATES

  async function loadPending() {
    const filter = $("pendingFilter").value;

    let query = db
      .from("collected_updates")
      .select("*")
      .order("detected_at", { ascending: false })
      .limit(150);

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data, error } = await query;

    if (error) throw error;

    pendingRows = data || [];

    renderPending();
  }

  function renderPending() {
    const term = $("pendingSearch").value.toLowerCase();

    const rows = pendingRows.filter(r =>
      [
        r.title,
        r.post_name,
        r.department,
        sourceNames[r.source_id]
      ].join(" ").toLowerCase().includes(term)
    );

    $("pendingList").innerHTML = rows.length
      ? rows.map(r => {
          const source =
            sourceNames[r.source_id] || "Unknown source";

          const isPending = r.status === "pending";

          const completeness = [
            ["Department", r.department],
            ["Post name", r.post_name],
            ["Vacancies", r.total_posts],
            ["Qualification", r.qualification || r.eligibility_summary],
            ["Notification date", r.notification_date],
            ["Application start", r.application_start],
            ["Last date", r.last_date],
            ["Age limit", r.age_limit],
            ["Salary", r.pay_scale],
            ["Notification PDF", r.notification_url || r.official_url],
            ["Apply link", r.apply_url]
          ];

          const missing = completeness.filter(
            ([, v]) =>
              v === null ||
              v === undefined ||
              String(v).trim() === ""
          );

          return `
            <article class="item"
              data-pending-id="${escapeHTML(r.id)}">

              <div class="section-head">
                <div>
                  <h3>
                    ${escapeHTML(r.post_name || r.title || "Untitled")}
                  </h3>

                  <div class="muted">
                    ${escapeHTML(r.department || "Department missing")}
                    · Source (admin only):
                    <b>${escapeHTML(source)}</b>
                    · Status:
                    <b>${escapeHTML(r.status)}</b>
                  </div>
                </div>

                <span class="${missing.length ? "missing" : "ok"}">
                  ${missing.length
                    ? missing.length + " required field(s) missing"
                    : "Required fields present"}
                </span>
              </div>

              <div class="details">
                ${detail("Job title", r.title)}
                ${detail("Post name", r.post_name)}
                ${detail("Department", r.department)}
                ${detail("Vacancies", r.total_posts)}
                ${detail("Notification date", dateText(r.notification_date))}
                ${detail("Application starts", dateText(r.application_start))}
                ${detail("Last date", dateText(r.last_date))}
                ${detail("Qualification", r.qualification || r.eligibility_summary)}
                ${detail("Age limit", r.age_limit)}
                ${detail("Salary / Pay scale", r.pay_scale)}
                ${detail("Location", r.location)}
                ${detail("Application mode", r.application_mode)}
                ${detail("Selection process", r.selection_process)}
              </div>

              <div class="links">
                ${safeLink(
                  r.notification_url || r.official_url,
                  "Official notification PDF"
                )}

                ${safeLink(
                  r.apply_url,
                  "Official Apply Online page"
                )}

                ${
                  r.official_url && r.notification_url
                    ? safeLink(r.official_url, "Department website")
                    : ""
                }
              </div>

              ${
                r.description
                  ? `<p>${escapeHTML(r.description).slice(0, 900)}</p>`
                  : ""
              }

              ${
                missing.length
                  ? `<p class="missing">
                      Missing:
                      ${missing.map(x => escapeHTML(x[0])).join(", ")}
                    </p>`
                  : ""
              }

              ${
                isPending
                  ? `
                    <div class="actions">
                      <button class="success"
                        data-action="edit-review"
                        data-id="${escapeHTML(r.id)}">
                        Edit details
                      </button>

                      <button class="success"
                        data-action="approve"
                        data-id="${escapeHTML(r.id)}"
                        ${missing.length ? "disabled" : ""}>
                        Approve & Publish
                      </button>

                      <button class="danger"
                        data-action="reject"
                        data-id="${escapeHTML(r.id)}">
                        Reject
                      </button>
                    </div>
                  `
                  : ""
              }
            </article>
          `;
        }).join("")
      : '<p class="muted">No updates found for this filter.</p>';
  }

  // EDIT PENDING RECORD

  function reviewEditor(row) {
    const fields = [
      ["title", "Job title"],
      ["post_name", "Post name"],
      ["department", "Department"],
      ["total_posts", "Total vacancies"],
      ["qualification", "Qualification"],
      ["notification_date", "Notification date", "date"],
      ["application_start", "Application start", "date"],
      ["last_date", "Last date", "date"],
      ["age_limit", "Age limit"],
      ["pay_scale", "Salary / Pay scale"],
      ["location", "Location"],
      ["application_mode", "Application mode"],
      ["selection_process", "Selection process"],
      ["notification_url", "Official notification PDF URL"],
      ["apply_url", "Official Apply Online URL"],
      ["official_url", "Official department URL"],
      ["eligibility_summary", "Eligibility summary"],
      ["description", "Description"]
    ];

    const html = fields.map(([key, label, type]) => `
      <div class="field">
        <label>${escapeHTML(label)}</label>
        <input
          data-edit-field="${key}"
          type="${type === "date" ? "date" : "text"}"
          value="${escapeHTML(row[key] || "")}">
      </div>
    `).join("");

    const modal = document.createElement("div");

    modal.className = "panel";
    modal.style.marginTop = "12px";

    modal.innerHTML = `
      <h3>Edit pending notification</h3>

      <div class="form-grid">
        ${html}
      </div>

      <div class="actions">
        <button class="success"
          data-action="save-review"
          data-id="${escapeHTML(row.id)}">
          Save pending details
        </button>

        <button class="secondary" data-action="cancel-edit">
          Cancel
        </button>
      </div>
    `;

    const card = document.querySelector(
      `[data-pending-id="${CSS.escape(row.id)}"]`
    );

    card.appendChild(modal);
  }

  async function saveReview(id, button) {
    const card = document.querySelector(
      `[data-pending-id="${CSS.escape(id)}"]`
    );

    const update = {};

    card.querySelectorAll("[data-edit-field]").forEach(el => {
      update[el.dataset.editField] =
        el.value.trim() || null;
    });

    setBusy(button, true, "Saving…");

    const { error } = await db
      .from("collected_updates")
      .update(update)
      .eq("id", id)
      .eq("status", "pending");

    setBusy(button, false);

    if (error) throw error;

    showMessage("Pending notification details saved.");

    await loadPending();
  }

  // APPROVE AND PUBLISH

  async function approvePending(id, button) {
    const row = pendingRows.find(x => x.id === id);

    if (!row) {
      throw new Error("Pending record not found. Refresh and try again.");
    }

    const required = [
      "title",
      "department",
      "total_posts",
      "qualification",
      "notification_date",
      "application_start",
      "last_date",
      "age_limit",
      "pay_scale",
      "apply_url"
    ];

    const missing = required.filter(
      k => !row[k] || String(row[k]).trim() === ""
    );

    if (!row.notification_url && !row.official_url) {
      missing.push("notification_url");
    }

    if (missing.length) {
      throw new Error(
        "Cannot approve. Missing: " + missing.join(", ")
      );
    }

    const urls = [
      row.notification_url || row.official_url,
      row.apply_url
    ];

    for (const u of urls) {
      try {
        const p = new URL(u);

        if (!["https:", "http:"].includes(p.protocol)) {
          throw new Error("Invalid URL");
        }
      } catch {
        throw new Error("One or more official URLs are invalid.");
      }
    }

    if (!confirm(
      "Confirm that you opened and verified the original recruiting " +
      "department notification PDF and official application page. " +
      "Publish this job?"
    )) {
      return;
    }

    setBusy(button, true, "Publishing…");

    const { data: dupe, error: dupeErr } = await db
      .from("jobs")
      .select("id")
      .ilike("title", row.title)
      .ilike("department", row.department)
      .limit(1);

    if (dupeErr) {
      setBusy(button, false);
      throw dupeErr;
    }

    if (dupe && dupe.length) {
      setBusy(button, false);

      throw new Error(
        "A job with the same title and department already exists. " +
        "Check Published Jobs before proceeding."
      );
    }

    const job = {
      title: row.title,
      post_name: row.post_name || row.title,
      department: row.department,
      qualification: row.qualification,
      location: row.location,
      total_posts: Number(row.total_posts),
      notification_date: row.notification_date,
      application_start: row.application_start,
      last_date: row.last_date,
      age_limit: row.age_limit,
      pay_scale: row.pay_scale,
      application_mode: row.application_mode,
      selection_process: row.selection_process,
      eligibility_summary: row.eligibility_summary,
      official_url: row.official_url || row.notification_url,
      notification_url: row.notification_url || row.official_url,
      apply_url: row.apply_url,
      description: row.description,
      status: "published"
    };

    const { error: insertErr } = await db
      .from("jobs")
      .insert(job)
      .select("id")
      .single();

    if (insertErr) {
      setBusy(button, false);
      throw insertErr;
    }

    const { error: updateErr } = await db
      .from("collected_updates")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending");

    setBusy(button, false);

    if (updateErr) {
      throw new Error(
        "Job was published, but pending status could not be updated. " +
        "Do not publish it again; check Published Jobs. " +
        updateErr.message
      );
    }

    showMessage("Job published successfully.");

    await Promise.all([
      loadPending(),
      loadJobs(),
      loadDashboard()
    ]);
  }

  // REJECT PENDING UPDATE

  async function rejectPending(id) {
    if (!confirm("Reject this collected update? It will not be published.")) {
      return;
    }

    const { error } = await db
      .from("collected_updates")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending");

    if (error) throw error;

    showMessage("Update rejected.");

    await Promise.all([
      loadPending(),
      loadDashboard()
    ]);
  }

  // PUBLISHED JOBS

  function resetJobForm() {
    $("jobForm").reset();
    $("jobId").value = "";
    $("jobFormHeading").textContent = "Add / Edit Government Job";
  }

  async function loadJobs() {
    const { data, error } = await db
      .from("jobs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);

    if (error) throw error;

    jobRows = data || [];

    renderJobs();
  }

  function renderJobs() {
    const term = $("jobsSearch").value.toLowerCase();

    const rows = jobRows.filter(r =>
      [r.title, r.post_name, r.department]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );

    $("jobsList").innerHTML = rows.length
      ? rows.map(r => `
          <article class="item">

            <div class="section-head">
              <div>
                <h3>${escapeHTML(r.post_name || r.title)}</h3>
                <div class="muted">
                  ${escapeHTML(r.department || "")}
                  · ${escapeHTML(r.status || "")}
                </div>
              </div>

              <b>${escapeHTML(r.total_posts ?? "—")} vacancies</b>
            </div>

            <div class="details">
              ${detail("Qualification", r.qualification)}
              ${detail("Age limit", r.age_limit)}
              ${detail("Salary", r.pay_scale)}
              ${detail("Notification date", dateText(r.notification_date))}
              ${detail("Application start", dateText(r.application_start))}
              ${detail("Last date", dateText(r.last_date))}
            </div>

            <div class="links">
              ${safeLink(r.notification_url || r.official_url, "Notification")}
              ${safeLink(r.apply_url, "Apply Online")}
            </div>

            <div class="actions">
              <button data-action="edit-job" data-id="${escapeHTML(r.id)}">
                Edit
              </button>

              <button class="danger"
                data-action="delete-job"
                data-id="${escapeHTML(r.id)}">
                Delete
              </button>
            </div>

          </article>
        `).join("")
      : '<p class="muted">No jobs found.</p>';
  }

  async function saveJob(event) {
    event.preventDefault();

    const id = val("jobId");

    const payload = {
      title: val("jobTitle"),
      post_name: val("jobPostName"),
      department: val("jobDepartment"),
      total_posts: Number(val("jobPosts")),
      qualification: val("jobQualification"),
      age_limit: val("jobAgeLimit"),
      pay_scale: val("jobPayScale"),
      location: val("jobLocation") || null,
      notification_date: val("jobNotificationDate"),
      application_start: val("jobStart"),
      last_date: val("jobLastDate"),
      application_mode: val("jobMode") || null,
      selection_process: val("jobSelection") || null,
      apply_url: val("jobApplyUrl"),
      notification_url: val("jobNotificationUrl"),
      official_url: val("jobOfficialUrl") || val("jobNotificationUrl"),
      eligibility_summary: val("jobEligibility") || null,
      description: val("jobDescription") || null,
      status: val("jobStatus")
    };

    const { error } = id
      ? await db.from("jobs").update(payload).eq("id", id)
      : await db.from("jobs").insert(payload);

    if (error) throw error;

    resetJobForm();

    showMessage("Job saved.");

    await Promise.all([
      loadJobs(),
      loadDashboard()
    ]);
  }

  function editJob(id) {
    const r = jobRows.find(x => x.id === id);

    if (!r) return;

    const map = {
      jobId: "id",
      jobTitle: "title",
      jobPostName: "post_name",
      jobDepartment: "department",
      jobPosts: "total_posts",
      jobQualification: "qualification",
      jobAgeLimit: "age_limit",
      jobPayScale: "pay_scale",
      jobLocation: "location",
      jobNotificationDate: "notification_date",
      jobStart: "application_start",
      jobLastDate: "last_date",
      jobMode: "application_mode",
      jobSelection: "selection_process",
      jobApplyUrl: "apply_url",
      jobNotificationUrl: "notification_url",
      jobOfficialUrl: "official_url",
      jobEligibility: "eligibility_summary",
      jobDescription: "description",
      jobStatus: "status"
    };

    Object.entries(map).forEach(([id, key]) => {
      $(id).value = r[key] ?? "";
    });

    $("jobFormHeading").textContent = "Edit Government Job";

    showTab("jobs");

    $("jobTitle").focus();
  }

  async function deleteJob(id) {
    if (!confirm("Delete this job record?")) return;

    const { error } = await db
      .from("jobs")
      .delete()
      .eq("id", id);

    if (error) throw error;

    showMessage("Job deleted.");

    await Promise.all([
      loadJobs(),
      loadDashboard()
    ]);
  }

  // ADMIT CARDS, RESULTS AND ANSWER KEYS

  async function loadSimple(table, target) {
    const { data, error } = await db
      .from(table)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) throw error;

    const config = {
      admit_cards: {
        title: "title",
        department: "department",
        date: "exam_date",
        url: "download_url",
        urlLabel: "Download"
      },

      results: {
        title: "title",
        department: "department",
        date: "result_date",
        url: "result_url",
        urlLabel: "View result"
      },

      answer_keys: {
        title: "title",
        department: "department",
        date: "exam_date",
        url: "answer_key_url",
        urlLabel: "Answer key"
      }
    }[table];

    const rows = data || [];

    $(target).innerHTML = rows.length
      ? rows.map(r => `
          <article class="item">

            <h3>${escapeHTML(r[config.title])}</h3>

            <p class="muted">
              ${escapeHTML(r[config.department] || "")}
              · ${dateText(r[config.date])}
              · ${escapeHTML(r.status || "")}
            </p>

            <div class="links">
              ${safeLink(r[config.url], config.urlLabel)}
              ${safeLink(r.official_url, "Official website")}
            </div>

            <div class="actions">
              <button class="danger"
                data-action="delete-simple"
                data-table="${table}"
                data-id="${escapeHTML(r.id)}">
                Delete
              </button>
            </div>

          </article>
        `).join("")
      : '<p class="muted">No records found.</p>';
  }

  async function saveSimple(event, table, prefix) {
    event.preventDefault();

    let payload;

    if (table === "admit_cards") {
      payload = {
        title: val("admitTitle"),
        department: val("admitDepartment") || null,
        exam_date: val("admitDate") || null,
        download_url: val("admitDownload"),
        official_url: val("admitOfficial") || null,
        status: val("admitStatus")
      };
    }

    if (table === "results") {
      payload = {
        title: val("resultTitle"),
        department: val("resultDepartment") || null,
        result_date: val("resultDate") || null,
        result_url: val("resultUrl"),
        official_url: val("resultOfficial") || null,
        status: val("resultStatus")
      };
    }

    if (table === "answer_keys") {
      payload = {
        title: val("answerTitle"),
        department: val("answerDepartment") || null,
        exam_date: val("answerDate") || null,
        answer_key_url: val("answerUrl"),
        official_url: val("answerOfficial") || null,
        status: val("answerStatus")
      };
    }

    const { error } = await db
      .from(table)
      .insert(payload);

    if (error) throw error;

    $(prefix).reset();

    showMessage("Record saved.");

    const target = {
      admit_cards: "admitList",
      results: "resultsList",
      answer_keys: "answerList"
    }[table];

    await loadSimple(table, target);
  }

  async function deleteSimple(table, id) {
    if (!confirm("Delete this record?")) return;

    const { error } = await db
      .from(table)
      .delete()
      .eq("id", id);

    if (error) throw error;

    const target = {
      admit_cards: "admitList",
      results: "resultsList",
      answer_keys: "answerList"
    }[table];

    await loadSimple(table, target);

    showMessage("Record deleted.");
  }

  // TAB NAVIGATION

  function showTab(name) {
    document.querySelectorAll(".tab-section").forEach(section => {
      section.classList.add("hidden");
    });

    $("tab-" + name).classList.remove("hidden");

    document.querySelectorAll(".tabs button").forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.tab === name
      );
    });
  }

  document.querySelectorAll(".tabs button").forEach(button => {
    button.addEventListener("click", () => {
      showTab(button.dataset.tab);
    });
  });

  // LOGIN

  $("loginForm").addEventListener("submit", async event => {
    event.preventDefault();

    const button = event.submitter;

    setBusy(button, true, "Signing in…");

    try {
      const { data, error } = await db.auth.signInWithPassword({
        email: val("email"),
        password: $("password").value
      });

      if (error) throw error;

      await openAdmin(data.user);

    } catch (err) {
      showMessage(err.message || "Login failed.", true);
      await db.auth.signOut();

    } finally {
      setBusy(button, false);
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await db.auth.signOut();
    location.reload();
  });

  // FORM EVENTS

  $("jobForm").addEventListener("submit", event => {
    saveJob(event).catch(err =>
      showMessage(err.message, true)
    );
  });

  $("resetJobForm").addEventListener("click", resetJobForm);

  $("jobsSearch").addEventListener("input", renderJobs);

  $("pendingSearch").addEventListener("input", renderPending);

  $("pendingFilter").addEventListener("change", () => {
    loadPending().catch(err =>
      showMessage(err.message, true)
    );
  });

  $("admitForm").addEventListener("submit", event => {
    saveSimple(event, "admit_cards", "admitForm")
      .catch(err => showMessage(err.message, true));
  });

  $("resultForm").addEventListener("submit", event => {
    saveSimple(event, "results", "resultForm")
      .catch(err => showMessage(err.message, true));
  });

  $("answerForm").addEventListener("submit", event => {
    saveSimple(event, "answer_keys", "answerForm")
      .catch(err => showMessage(err.message, true));
  });

  // REFRESH BUTTONS

  $("refreshDashboard").addEventListener("click", () => {
    loadDashboard().catch(err =>
      showMessage(err.message, true)
    );
  });

  $("refreshPending").addEventListener("click", () => {
    loadPending().catch(err =>
      showMessage(err.message, true)
    );
  });

  $("refreshJobs").addEventListener("click", () => {
    loadJobs().catch(err =>
      showMessage(err.message, true)
    );
  });

  $("refreshAdmit").addEventListener("click", () => {
    loadSimple("admit_cards", "admitList")
      .catch(err => showMessage(err.message, true));
  });

  $("refreshResults").addEventListener("click", () => {
    loadSimple("results", "resultsList")
      .catch(err => showMessage(err.message, true));
  });

  $("refreshAnswer").addEventListener("click", () => {
    loadSimple("answer_keys", "answerList")
      .catch(err => showMessage(err.message, true));
  });

  // ACTION BUTTONS

  document.addEventListener("click", async event => {
    const button = event.target.closest("[data-action]");

    if (!button) return;

    const { action, id, table } = button.dataset;

    try {
      if (action === "edit-review") {
        const row = pendingRows.find(x => x.id === id);
        if (row) reviewEditor(row);
      }

      if (action === "cancel-edit") {
        button.closest(".panel").remove();
      }

      if (action === "save-review") {
        await saveReview(id, button);
      }

      if (action === "approve") {
        await approvePending(id, button);
      }

      if (action === "reject") {
        await rejectPending(id);
      }

      if (action === "edit-job") {
        editJob(id);
      }

      if (action === "delete-job") {
        await deleteJob(id);
      }

      if (action === "delete-simple") {
        await deleteSimple(table, id);
      }

    } catch (err) {
      showMessage(err.message || "Action failed.", true);
    }
  });

  // RESTORE EXISTING SESSION

  db.auth.getSession().then(async ({ data, error }) => {
    if (error) return;

    if (data.session) {
      try {
        await openAdmin(data.session.user);
      } catch (err) {
        showMessage(
          err.message || "Admin verification failed.",
          true
        );

        await db.auth.signOut();
      }
    }
  });

  db.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      $("adminApp").classList.add("hidden");
      $("logoutBtn").classList.add("hidden");
      $("loginPanel").classList.remove("hidden");
    }
  });

})();
