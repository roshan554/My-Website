
const SUPABASE_URL = "https://suxpoqntuvsdcvgdkxlz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XPQiTJEaYSeb_nnWi-3C3A_baaPvwPz";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[c]);
}

function safeURL(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function message(id, text, isError = false) {
  $(id).textContent = text;
  $(id).style.color = isError ? "#b83232" : "#08796a";
}

function showLogin(text = "") {
  $("loginBox").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
  $("logoutBtn").classList.add("hidden");
  $("loginMessage").textContent = text;
}

function showDashboard() {
  $("loginBox").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  $("logoutBtn").classList.remove("hidden");
}

async function verifyAdmin(user) {
  const { data, error } = await db
    .from("admin_users")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error("Admin check failed: " + error.message);
  if (!data) throw new Error("इस Account को Admin अनुमति नहीं है।");

  return true;
}

async function openAdmin(user) {
  try {
    await verifyAdmin(user);
    showDashboard();

    await Promise.all([
      loadJobs(),
      loadAdmitCards(),
      loadResults(),
      loadAnswerKeys(),
      loadPendingUpdates()
    ]);
  } catch (error) {
    await db.auth.signOut();
    showLogin(error.message);
  }
}

// LOGIN
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  $("loginBtn").disabled = true;
  $("loginBtn").textContent = "Logging in...";
  $("loginMessage").textContent = "Please wait...";

  const { data, error } = await db.auth.signInWithPassword({
    email: $("loginEmail").value.trim(),
    password: $("loginPassword").value
  });

  $("loginBtn").disabled = false;
  $("loginBtn").textContent = "Login";

  if (error) {
    $("loginMessage").textContent = error.message;
    return;
  }

  await openAdmin(data.user);
});

// LOGOUT
$("logoutBtn").addEventListener("click", async () => {
  await db.auth.signOut();
  showLogin("You have been logged out.");
});

// DASHBOARD TABS
document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(item =>
      item.classList.toggle("active", item === button)
    );

    document.querySelectorAll(".content-section").forEach(section =>
      section.classList.toggle("hidden", section.id !== button.dataset.tab)
    );

    if (button.dataset.tab === "pendingSection") {
      loadPendingUpdates();
    }
  });
});

// GENERIC RECORD DISPLAY
function renderRecords(containerId, rows, type) {
  const container = $(containerId);

  if (!rows.length) {
    container.innerHTML = "<p>No records added yet.</p>";
    return;
  }

  container.innerHTML = rows.map(item => {
    let subtitle = "";

    if (type === "jobs") {
      subtitle = `${item.department || "Department not specified"} · ${item.location || "Location not specified"}`;
    } else if (type === "admit") {
      subtitle = `${item.department || "Department not specified"} · Exam: ${item.exam_date || "Not specified"}`;
    } else if (type === "results") {
      subtitle = `${item.department || "Department not specified"} · Date: ${item.result_date || "Not specified"}`;
    } else {
      subtitle = `${item.department || "Department not specified"} · Exam: ${item.exam_date || "Not specified"}`;
    }

    return `
      <article class="job-card">
        <div>
          <h3>${escapeHTML(item.title)}</h3>
          <p>${escapeHTML(subtitle)}</p>
          <p>Status: <span class="status ${escapeHTML(item.status)}">${escapeHTML(item.status)}</span></p>
        </div>
        <div>
          <button class="small" data-edit-type="${type}" data-edit-id="${escapeHTML(item.id)}">Edit</button>
          <button class="small danger" data-delete-type="${type}" data-delete-id="${escapeHTML(item.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

// LOAD JOBS
async function loadJobs() {
  $("jobSummary").textContent = "Loading jobs...";

  const { data, error } = await db
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("jobSummary").textContent = "Could not load jobs: " + error.message;
    return;
  }

  const rows = data || [];
  $("jobSummary").textContent = `Total jobs: ${rows.length}`;
  renderRecords("jobsContainer", rows, "jobs");
}

// LOAD ADMIT CARDS
async function loadAdmitCards() {
  $("admitSummary").textContent = "Loading admit cards...";

  const { data, error } = await db
    .from("admit_cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("admitSummary").textContent = "Could not load admit cards: " + error.message;
    return;
  }

  const rows = data || [];
  $("admitSummary").textContent = `Total admit cards: ${rows.length}`;
  renderRecords("admitContainer", rows, "admit");
}

// LOAD RESULTS
async function loadResults() {
  $("resultSummary").textContent = "Loading results...";

  const { data, error } = await db
    .from("results")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("resultSummary").textContent = "Could not load results: " + error.message;
    return;
  }

  const rows = data || [];
  $("resultSummary").textContent = `Total results: ${rows.length}`;
  renderRecords("resultsContainer", rows, "results");
}

// LOAD ANSWER KEYS
async function loadAnswerKeys() {
  $("answerSummary").textContent = "Loading answer keys...";

  const { data, error } = await db
    .from("answer_keys")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("answerSummary").textContent = "Could not load answer keys: " + error.message;
    return;
  }

  const rows = data || [];
  $("answerSummary").textContent = `Total answer keys: ${rows.length}`;
  renderRecords("answerContainer", rows, "answers");
}

// LOAD PENDING UPDATES
async function loadPendingUpdates() {
  $("pendingSummary").textContent = "Loading pending updates...";
  $("pendingContainer").innerHTML = "";

  const { data, error } = await db
    .from("collected_updates")
    .select("*")
    .eq("status", "pending")
    .order("detected_at", { ascending: false });

  if (error) {
    $("pendingSummary").textContent =
      "Could not load pending updates: " + error.message;
    return;
  }

  const rows = data || [];

  $("pendingSummary").textContent =
    `Pending notifications: ${rows.length}`;

  if (!rows.length) {
    $("pendingContainer").innerHTML =
      "<p>No pending notifications available.</p>";
    return;
  }

  $("pendingContainer").innerHTML = rows.map(item => {
    const officialURL = safeURL(item.official_url);
    const notificationURL = safeURL(item.notification_url);

    const rawText =
      item.raw_data?.original_text ||
      item.description ||
      "No additional description available.";

    return `
      <article class="pending-card">
        <h3>${escapeHTML(item.title)}</h3>

        <p><strong>Department:</strong>
          ${escapeHTML(item.department || "Not specified")}
        </p>

        <p><strong>Category:</strong>
          ${escapeHTML(item.category)}
        </p>

        <p><strong>Location:</strong>
          ${escapeHTML(item.location || "Not specified")}
        </p>

        <p><strong>Language:</strong>
          ${escapeHTML(item.detected_language || "Not specified")}
        </p>

        <p><strong>Detected:</strong>
          ${escapeHTML(item.detected_at || "Not available")}
        </p>

        ${officialURL
          ? `<p><a href="${escapeHTML(officialURL)}" target="_blank" rel="noopener noreferrer">Open Official Website</a></p>`
          : ""}

        ${notificationURL
          ? `<p><a href="${escapeHTML(notificationURL)}" target="_blank" rel="noopener noreferrer">Open Notification</a></p>`
          : ""}

        <details>
          <summary>View collected notification text</summary>
          <div class="pending-text">${escapeHTML(rawText)}</div>
        </details>

        <div class="pending-actions">
          <button
            type="button"
            class="small approve"
            data-approve-id="${escapeHTML(item.id)}">
            Approve & Publish
          </button>

          <button
            type="button"
            class="small reject"
            data-reject-id="${escapeHTML(item.id)}">
            Reject
          </button>
        </div>
      </article>
    `;
  }).join("");
}

// APPROVE PENDING JOB
async function approvePendingUpdate(id, button) {
  if (!confirm(
    "क्या आपने official notification verify कर लिया है? Approve करने पर यह job public website पर publish होगी।"
  )) return;

  button.disabled = true;
  message("pendingMessage", "Approving notification...");

  try {
    const { data: item, error: fetchError } = await db
      .from("collected_updates")
      .select("*")
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (fetchError) throw fetchError;

    if (item.category !== "jobs") {
      throw new Error(
        "यह approval फिलहाल केवल Government Jobs के लिए उपलब्ध है।"
      );
    }

    // Prevent accidental duplicate job creation on retry.
    const { data: existing, error: checkError } = await db
      .from("jobs")
      .select("id")
      .eq("title", item.title)
      .eq("department", item.department)
      .limit(1);

    if (checkError) throw checkError;

    if (existing && existing.length > 0) {
      throw new Error(
        "इस title और department की job पहले से मौजूद है। पहले Jobs section जाँचें।"
      );
    }

    const rawPosts = item.total_posts;
    const parsedPosts =
      rawPosts && !isNaN(Number(rawPosts))
        ? Number(rawPosts)
        : null;

    const jobRecord = {
      title: item.title,
      department: item.department || null,
      qualification: item.qualification || null,
      location: item.location || null,
      total_posts: parsedPosts,
      application_start: item.application_start || null,
      last_date: item.last_date || null,
      official_url: safeURL(item.official_url) || null,
      notification_url: safeURL(item.notification_url) || null,
      description: item.description ||
        item.raw_data?.original_text ||
        null,
      status: "published"
    };

    const { error: insertError } = await db
      .from("jobs")
      .insert(jobRecord);

    if (insertError) throw insertError;

    const { error: updateError } = await db
      .from("collected_updates")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending");

    if (updateError) {
      throw new Error(
        "Job was published, but approval status could not be updated. Do not approve again. Refresh and check Jobs: " +
        updateError.message
      );
    }

    message("pendingMessage", "Notification approved and published.");

    await Promise.all([
      loadPendingUpdates(),
      loadJobs()
    ]);

  } catch (error) {
    message(
      "pendingMessage",
      "Approval failed: " + error.message,
      true
    );
  } finally {
    button.disabled = false;
  }
}

// REJECT PENDING UPDATE
async function rejectPendingUpdate(id, button) {
  if (!confirm("क्या आप इस notification को reject करना चाहते हैं?")) {
    return;
  }

  button.disabled = true;
  message("pendingMessage", "Rejecting notification...");

  const { error } = await db
    .from("collected_updates")
    .update({
      status: "rejected",
      reviewed_at: new Date().toISOString()
    })
    .eq("id", id)
    .eq("status", "pending");

  if (error) {
    message("pendingMessage", "Reject failed: " + error.message, true);
    button.disabled = false;
    return;
  }

  message("pendingMessage", "Notification rejected.");
  await loadPendingUpdates();
}

$("refreshPendingBtn").onclick = async function () {
  this.disabled = true;
  this.textContent = "Refreshing...";

  await loadPendingUpdates();

  this.disabled = false;
  this.textContent = "Refresh Pending Updates";
};

// JOB FORM: ADD / UPDATE
$("jobForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("jobId").value;
  const posts = $("totalPosts").value;

  const record = {
    title: $("title").value.trim(),
    department: $("department").value.trim() || null,
    qualification: $("qualification").value.trim() || null,
    location: $("location").value.trim() || null,
    total_posts: posts === "" ? null : Number(posts),
    application_start: $("applicationStart").value || null,
    last_date: $("lastDate").value || null,
    official_url: safeURL($("officialUrl").value) || null,
    notification_url: safeURL($("notificationUrl").value) || null,
    description: $("description").value.trim() || null,
    status: $("status").value
  };

  $("saveJobBtn").disabled = true;
  message("jobMessage", "Saving...");

  const result = id
    ? await db.from("jobs").update(record).eq("id", id)
    : await db.from("jobs").insert(record);

  $("saveJobBtn").disabled = false;

  if (result.error) {
    message("jobMessage", "Save failed: " + result.error.message, true);
    return;
  }

  resetJobForm();
  message("jobMessage", id ? "Job updated successfully." : "Job added successfully.");
  await loadJobs();
});

function resetJobForm() {
  $("jobForm").reset();
  $("jobId").value = "";
  $("jobFormHeading").textContent = "Add New Job";
  $("saveJobBtn").textContent = "Save Job";
  $("cancelJobEdit").classList.add("hidden");
}

$("cancelJobEdit").addEventListener("click", resetJobForm);

// ADMIT CARD FORM
$("admitForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("admitId").value;

  const record = {
    title: $("admitTitle").value.trim(),
    department: $("admitDepartment").value.trim() || null,
    exam_date: $("examDate").value || null,
    download_url: safeURL($("downloadUrl").value) || null,
    official_url: safeURL($("admitOfficialUrl").value) || null,
    status: $("admitStatus").value
  };

  $("saveAdmitBtn").disabled = true;
  message("admitMessage", "Saving...");

  const result = id
    ? await db.from("admit_cards").update(record).eq("id", id)
    : await db.from("admit_cards").insert(record);

  $("saveAdmitBtn").disabled = false;

  if (result.error) {
    message("admitMessage", "Save failed: " + result.error.message, true);
    return;
  }

  resetAdmitForm();
  message("admitMessage", id ? "Admit card updated successfully." : "Admit card added successfully.");
  await loadAdmitCards();
});

function resetAdmitForm() {
  $("admitForm").reset();
  $("admitId").value = "";
  $("admitFormHeading").textContent = "Add New Admit Card";
  $("saveAdmitBtn").textContent = "Save Admit Card";
  $("cancelAdmitEdit").classList.add("hidden");
}

$("cancelAdmitEdit").addEventListener("click", resetAdmitForm);

// RESULT FORM
$("resultForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("resultId").value;

  const record = {
    title: $("resultTitle").value.trim(),
    department: $("resultDepartment").value.trim() || null,
    result_date: $("resultDate").value || null,
    result_url: safeURL($("resultUrl").value) || null,
    official_url: safeURL($("resultOfficialUrl").value) || null,
    status: $("resultStatus").value
  };

  $("saveResultBtn").disabled = true;
  message("resultMessage", "Saving...");

  const result = id
    ? await db.from("results").update(record).eq("id", id)
    : await db.from("results").insert(record);

  $("saveResultBtn").disabled = false;

  if (result.error) {
    message("resultMessage", "Save failed: " + result.error.message, true);
    return;
  }

  resetResultForm();
  message("resultMessage", id ? "Result updated successfully." : "Result added successfully.");
  await loadResults();
});

function resetResultForm() {
  $("resultForm").reset();
  $("resultId").value = "";
  $("resultFormHeading").textContent = "Add New Result";
  $("saveResultBtn").textContent = "Save Result";
  $("cancelResultEdit").classList.add("hidden");
}

$("cancelResultEdit").addEventListener("click", resetResultForm);

// ANSWER KEY FORM
$("answerForm").addEventListener("submit", async event => {
  event.preventDefault();

  const id = $("answerId").value;

  const record = {
    title: $("answerTitle").value.trim(),
    department: $("answerDepartment").value.trim() || null,
    exam_date: $("answerExamDate").value || null,
    answer_key_url: safeURL($("answerKeyUrl").value) || null,
    official_url: safeURL($("answerOfficialUrl").value) || null,
    status: $("answerStatus").value
  };

  $("saveAnswerBtn").disabled = true;
  message("answerMessage", "Saving...");

  const result = id
    ? await db.from("answer_keys").update(record).eq("id", id)
    : await db.from("answer_keys").insert(record);

  $("saveAnswerBtn").disabled = false;

  if (result.error) {
    message("answerMessage", "Save failed: " + result.error.message, true);
    return;
  }

  resetAnswerForm();
  message("answerMessage", id ? "Answer key updated successfully." : "Answer key added successfully.");
  await loadAnswerKeys();
});

function resetAnswerForm() {
  $("answerForm").reset();
  $("answerId").value = "";
  $("answerFormHeading").textContent = "Add New Answer Key";
  $("saveAnswerBtn").textContent = "Save Answer Key";
  $("cancelAnswerEdit").classList.add("hidden");
}

$("cancelAnswerEdit").addEventListener("click", resetAnswerForm);

// EDIT AND DELETE BUTTONS
document.addEventListener("click", async event => {
  const target = event.target;

  const approve = target.closest("[data-approve-id]");
  if (approve) {
    await approvePendingUpdate(approve.dataset.approveId, approve);
    return;
  }

  const reject = target.closest("[data-reject-id]");
  if (reject) {
    await rejectPendingUpdate(reject.dataset.rejectId, reject);
    return;
  }

  const edit = target.closest("[data-edit-type]");
  const remove = target.closest("[data-delete-type]");

  if (edit) {
    const type = edit.dataset.editType;
    const id = edit.dataset.editId;

    const config = {
      jobs: {
        table: "jobs",
        form: "jobForm",
        id: "jobId",
        heading: "jobFormHeading",
        save: "saveJobBtn",
        cancel: "cancelJobEdit",
        message: "jobMessage",
        section: "jobsSection",
        fields: {
          title: "title",
          department: "department",
          qualification: "qualification",
          location: "location",
          total_posts: "totalPosts",
          application_start: "applicationStart",
          last_date: "lastDate",
          official_url: "officialUrl",
          notification_url: "notificationUrl",
          status: "status",
          description: "description"
        },
        title: "Edit Job",
        saveText: "Update Job"
      },
      admit: {
        table: "admit_cards",
        form: "admitForm",
        id: "admitId",
        heading: "admitFormHeading",
        save: "saveAdmitBtn",
        cancel: "cancelAdmitEdit",
        message: "admitMessage",
        section: "admitSection",
        fields: {
          title: "admitTitle",
          department: "admitDepartment",
          exam_date: "examDate",
          download_url: "downloadUrl",
          official_url: "admitOfficialUrl",
          status: "admitStatus"
        },
        title: "Edit Admit Card",
        saveText: "Update Admit Card"
      },
      results: {
        table: "results",
        form: "resultForm",
        id: "resultId",
        heading: "resultFormHeading",
        save: "saveResultBtn",
        cancel: "cancelResultEdit",
        message: "resultMessage",
        section: "resultsSection",
        fields: {
          title: "resultTitle",
          department: "resultDepartment",
          result_date: "resultDate",
          result_url: "resultUrl",
          official_url: "resultOfficialUrl",
          status: "resultStatus"
        },
        title: "Edit Result",
        saveText: "Update Result"
      },
      answers: {
        table: "answer_keys",
        form: "answerForm",
        id: "answerId",
        heading: "answerFormHeading",
        save: "saveAnswerBtn",
        cancel: "cancelAnswerEdit",
        message: "answerMessage",
        section: "answerSection",
        fields: {
          title: "answerTitle",
          department: "answerDepartment",
          exam_date: "answerExamDate",
          answer_key_url: "answerKeyUrl",
          official_url: "answerOfficialUrl",
          status: "answerStatus"
        },
        title: "Edit Answer Key",
        saveText: "Update Answer Key"
      }
    };

    const c = config[type];
    if (!c) return;

    const { data, error } = await db
      .from(c.table)
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      message(c.message, "Could not open record: " + error.message, true);
      return;
    }

    $(c.id).value = data.id;

    Object.entries(c.fields).forEach(([column, elementId]) => {
      $(elementId).value = data[column] ?? "";
    });

    $(c.heading).textContent = c.title;
    $(c.save).textContent = c.saveText;
    $(c.cancel).classList.remove("hidden");

    document.querySelector(`[data-tab="${c.section}"]`).click();
    $(c.form).scrollIntoView({ behavior: "smooth" });
  }

  if (remove) {
    const type = remove.dataset.deleteType;
    const id = remove.dataset.deleteId;

    const config = {
      jobs: { table: "jobs", load: loadJobs },
      admit: { table: "admit_cards", load: loadAdmitCards },
      results: { table: "results", load: loadResults },
      answers: { table: "answer_keys", load: loadAnswerKeys }
    };

    const c = config[type];
    if (!c || !confirm("Are you sure you want to delete this record?")) return;

    const { error } = await db.from(c.table).delete().eq("id", id);

    if (error) {
      alert("Delete failed: " + error.message);
      return;
    }

    alert("Record deleted successfully.");
    await c.load();
  }
});

// INITIAL SESSION CHECK
async function startAdmin() {
  const { data, error } = await db.auth.getSession();

  if (error || !data.session) {
    showLogin();
    return;
  }

  await openAdmin(data.session.user);
}

startAdmin();
