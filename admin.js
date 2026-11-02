const SUPABASE_URL = "https://suxpoqntuvsdcvgdkxlz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XPQiTJEaYSeb_nnWi-3C3A_baaPvwPz";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = id => document.getElementById(id);

// HELPERS

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
  const element = $(id);
  if (!element) return;
  element.textContent = text;
  element.style.color = isError ? "#b83232" : "#08796a";
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

// AUTHENTICATION

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

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: $("loginEmail").value.trim(),
      password: $("loginPassword").value
    });

    if (error) throw error;
    await openAdmin(data.user);
  } catch (error) {
    $("loginMessage").textContent = error.message;
  } finally {
    $("loginBtn").disabled = false;
    $("loginBtn").textContent = "Login";
  }
});

// LOGOUT

$("logoutBtn").addEventListener("click", async () => {
  const { error } = await db.auth.signOut();

  if (error) {
    alert("Logout failed: " + error.message);
    return;
  }

  showLogin("You have been logged out.");
});

// TABS

document.querySelectorAll("[data-tab]").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-tab]").forEach(item => {
      item.classList.toggle("active", item === button);
    });

    document.querySelectorAll(".content-section").forEach(section => {
      section.classList.toggle(
        "hidden",
        section.id !== button.dataset.tab
      );
    });

    if (button.dataset.tab === "pendingSection") {
      loadPendingUpdates();
    }
  });
});

// GENERIC RECORD DISPLAY

function renderRecords(containerId, rows, type) {
  const container = $(containerId);
  if (!container) return;

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
          <p>
            Status:
            <span class="status ${escapeHTML(item.status)}">
              ${escapeHTML(item.status)}
            </span>
          </p>
        </div>

        <div>
          <button type="button" class="small"
            data-edit-type="${type}"
            data-edit-id="${escapeHTML(item.id)}">Edit</button>

          <button type="button" class="small danger"
            data-delete-type="${type}"
            data-delete-id="${escapeHTML(item.id)}">Delete</button>
        </div>
      </article>
    `;
  }).join("");
}

// LOAD FUNCTIONS

async function loadTable(table, summaryId, containerId, type, label) {
  const summary = $(summaryId);
  if (!summary) return;

  summary.textContent = "Loading...";

  const { data, error } = await db
    .from(table)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    summary.textContent = `Could not load ${label}: ${error.message}`;
    return;
  }

  const rows = data || [];
  summary.textContent = `Total ${label}: ${rows.length}`;
  renderRecords(containerId, rows, type);
}

const loadJobs = () =>
  loadTable("jobs", "jobSummary", "jobsContainer", "jobs", "jobs");

const loadAdmitCards = () =>
  loadTable("admit_cards", "admitSummary", "admitContainer", "admit", "admit cards");

const loadResults = () =>
  loadTable("results", "resultSummary", "resultsContainer", "results", "results");

const loadAnswerKeys = () =>
  loadTable("answer_keys", "answerSummary", "answerContainer", "answers", "answer keys");

// PENDING SELECTION TOOLBAR

function addPendingToolbar() {
  const container = $("pendingContainer");
  if (!container) return;

  const toolbar = document.createElement("div");
  toolbar.id = "pendingBulkToolbar";
  toolbar.style.cssText = [
    "display:flex",
    "flex-wrap:wrap",
    "align-items:center",
    "gap:10px",
    "padding:12px",
    "margin-bottom:15px",
    "border:1px solid #dce7e1",
    "border-radius:10px",
    "background:#f5faf7"
  ].join(";");

  toolbar.innerHTML = `
    <label style="display:flex;align-items:center;gap:7px;font-weight:600">
      <input type="checkbox" id="selectAllPending">
      Select All
    </label>

    <span id="pendingSelectedCount" style="font-size:14px">
      0 selected
    </span>

    <button type="button" id="approveSelectedBtn"
      class="small approve" disabled>
      Approve Selected
    </button>

    <button type="button" id="deleteSelectedBtn"
      class="small danger" disabled>
      Delete Selected
    </button>
  `;

  container.before(toolbar);
}

function getSelectedPendingIds() {
  return Array.from(
    document.querySelectorAll("[data-pending-select]:checked")
  ).map(input => input.value);
}

function updatePendingSelectionUI() {
  const checkboxes = Array.from(
    document.querySelectorAll("[data-pending-select]")
  );

  const selected = getSelectedPendingIds();
  const selectAll = $("selectAllPending");
  const approveButton = $("approveSelectedBtn");
  const deleteButton = $("deleteSelectedBtn");
  const count = $("pendingSelectedCount");

  if (count) count.textContent = `${selected.length} selected`;

  if (approveButton) approveButton.disabled = selected.length === 0;
  if (deleteButton) deleteButton.disabled = selected.length === 0;

  if (selectAll) {
    selectAll.checked =
      checkboxes.length > 0 && selected.length === checkboxes.length;

    selectAll.indeterminate =
      selected.length > 0 && selected.length < checkboxes.length;
  }
}

// PENDING UPDATES

async function loadPendingUpdates() {
  const summary = $("pendingSummary");
  const container = $("pendingContainer");

  if (!summary || !container) return;

  summary.textContent = "Loading pending updates...";
  container.innerHTML = "";

  const oldToolbar = $("pendingBulkToolbar");
  if (oldToolbar) oldToolbar.remove();

  try {
    const { data, error } = await db
      .from("collected_updates")
      .select("*")
      .eq("status", "pending")
      .order("detected_at", { ascending: false });

    if (error) throw error;

    const rows = data || [];
    summary.textContent = `Pending notifications: ${rows.length}`;

    if (!rows.length) {
      container.innerHTML = "<p>No pending notifications available.</p>";
      return;
    }

    addPendingToolbar();

    container.innerHTML = rows.map(item => {
      const officialURL = safeURL(item.official_url);
      const notificationURL = safeURL(item.notification_url);

      const rawText =
        item.raw_data?.original_text ||
        item.description ||
        item.raw_data?.collected_row ||
        "No additional description available.";

      return `
        <article class="pending-card">
          <label style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
            <input
              type="checkbox"
              data-pending-select
              value="${escapeHTML(item.id)}"
              aria-label="Select ${escapeHTML(item.title)}">
            <strong>Select notification</strong>
          </label>

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

          <p><strong>Qualification:</strong>
            ${escapeHTML(item.qualification || "Not specified")}
          </p>

          <p><strong>Total Posts:</strong>
            ${escapeHTML(item.total_posts || "Not specified")}
          </p>

          <p><strong>Last Date:</strong>
            ${escapeHTML(item.last_date || "Not specified")}
          </p>

          <p><strong>Language:</strong>
            ${escapeHTML(item.detected_language || "Not specified")}
          </p>

          <p><strong>Detected:</strong>
            ${escapeHTML(item.detected_at || "Not available")}
          </p>

          ${
            officialURL
              ? `<p><a href="${escapeHTML(officialURL)}" target="_blank" rel="noopener noreferrer">Open Official Website</a></p>`
              : ""
          }

          ${
            notificationURL
              ? `<p><a href="${escapeHTML(notificationURL)}" target="_blank" rel="noopener noreferrer">Open Notification</a></p>`
              : ""
          }

          <details>
            <summary>View collected notification text</summary>
            <div class="pending-text">${escapeHTML(rawText)}</div>
          </details>

          <div class="pending-actions">
            <button type="button" class="small approve"
              data-approve-id="${escapeHTML(item.id)}">
              Approve & Publish
            </button>

            <button type="button" class="small reject"
              data-reject-id="${escapeHTML(item.id)}">
              Reject
            </button>
          </div>
        </article>
      `;
    }).join("");

    updatePendingSelectionUI();

  } catch (error) {
    summary.textContent = "Could not load pending updates: " + error.message;

    message(
      "pendingMessage",
      "Loading failed: " + error.message,
      true
    );
  }
}

// REFRESH PENDING

async function refreshPendingUpdates(button) {
  if (!button || button.disabled) return;

  button.disabled = true;
  button.textContent = "Refreshing...";
  message("pendingMessage", "Checking pending notifications...");

  try {
    await loadPendingUpdates();

    if ($("pendingSummary").textContent.startsWith("Could not load")) {
      message("pendingMessage", $("pendingSummary").textContent, true);
    } else {
      message("pendingMessage", "Pending updates refreshed.");
    }
  } finally {
    button.disabled = false;
    button.textContent = "Refresh Pending Updates";
  }
}

// AUTOMATIC COLLECTION

const COLLECTION_BATCHES = [
  { number: 1, label: "NCS" },
  { number: 2, label: "MahaSwayam" },
  { number: 3, label: "Employment News" },
  { number: 4, label: "India Post" }
];

async function getCollectorError(error) {
  let detail = error?.message || "Function request failed";

  try {
    const context = error?.context;

    if (context) {
      let responseData = null;

      if (typeof context.clone === "function") {
        const response = context.clone();

        try {
          responseData = await response.json();
        } catch {
          responseData = await response.text();
        }
      } else if (typeof context.json === "function") {
        responseData = await context.json();
      }

      if (responseData && typeof responseData === "object") {
        detail =
          responseData.message ||
          responseData.error ||
          responseData.details ||
          responseData.msg ||
          detail;

        if (responseData.results) {
          detail += "\n" + JSON.stringify(responseData.results);
        }
      } else if (typeof responseData === "string" && responseData) {
        detail = responseData;
      }
    }
  } catch (_) {
    // Keep original error.
  }

  return detail;
}

function formatBatchFailure(data) {
  const details = [];

  if (data?.message) details.push(data.message);

  if (Array.isArray(data?.missing_sources) && data.missing_sources.length) {
    details.push("Missing sources: " + data.missing_sources.join(", "));
  }

  if (Array.isArray(data?.results)) {
    data.results.forEach(source => {
      if (source.status === "failed") {
        details.push(
          `${source.source}: ${source.error || "Unknown source error"}`
        );
      }
    });
  }

  return details.join(" | ") || "Collector returned an unsuccessful response.";
}

async function runAutomaticCollection(button) {
  if (!button || button.disabled) return;

  const confirmed = confirm(
    "Automatic collection will check all 4 configured sources in four batches. Continue?"
  );

  if (!confirmed) return;

  button.disabled = true;
  button.textContent = "Collection Running...";

  const statusBox = $("collectorBatchStatus");
  if (statusBox) statusBox.textContent = "";

  message("collectorMessage", "Starting automatic collection...");

  let successful = 0;
  let failed = 0;
  const report = [];

  try {
    for (const batch of COLLECTION_BATCHES) {
      const line = `Batch ${batch.number}/4: ${batch.label}`;

      if (statusBox) statusBox.textContent += line + " — Running...\n";
      message("collectorMessage", `Running ${line}`);

      try {
        const { data, error } = await db.functions.invoke(
          "collect-job-updates",
          { body: { batch: batch.number } }
        );

        if (error) throw new Error(await getCollectorError(error));
        if (!data) throw new Error("Edge Function returned an empty response.");
        if (data.success === false) throw new Error(formatBatchFailure(data));

        const sourceResults = Array.isArray(data.results) ? data.results : [];

        const checked = Number(data.checked ?? sourceResults.length);
        const inserted = Number(data.inserted ??
          sourceResults.reduce((total, source) => total + Number(source.inserted || 0), 0));

        const sourceFailures = Number(data.failed ??
          sourceResults.filter(source => source.status === "failed").length);

        if (checked === 0) {
          throw new Error(
            "No enabled source was found for this batch. Check automation_sources names and enabled status."
          );
        }

        if (sourceFailures > 0) failed++;
        else successful++;

        report.push(
          `Batch ${batch.number}: completed; checked ${checked}; new pending ${inserted}; source failures ${sourceFailures}.`
        );

        sourceResults.forEach(source => {
          report.push(
            source.status === "failed"
              ? `  FAILED SOURCE: ${source.source} — ${source.error || "Unknown error"}`
              : `  ${source.source}: checked; found ${source.found || 0}; inserted ${source.inserted || 0}.`
          );
        });

        if (Array.isArray(data.missing_sources) && data.missing_sources.length) {
          report.push("  Missing sources: " + data.missing_sources.join(", "));
        }

      } catch (error) {
        failed++;
        report.push(`Batch ${batch.number}: FAILED — ${error.message}`);
      }

      if (statusBox) statusBox.textContent = report.join("\n");
    }

    await loadPendingUpdates();

    if (failed === 0) {
      message(
        "collectorMessage",
        "All four collection batches completed. Review pending notifications before publishing."
      );
    } else {
      message(
        "collectorMessage",
        `${failed} batch(es) had errors. Check the detailed report below.`,
        true
      );
    }

  } catch (error) {
    message("collectorMessage", "Collection process failed: " + error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = "Run Automatic Collection";
  }
}

// APPROVAL CONFIGURATION

function getApprovalConfig(item) {
  const configs = {
    jobs: {
      table: "jobs",
      load: loadJobs,
      record: () => ({
        title: item.title,
        department: item.department || null,
        qualification: item.qualification || null,
        location: item.location || null,
        total_posts:
          item.total_posts && !isNaN(Number(item.total_posts))
            ? Number(item.total_posts)
            : null,
        application_start: item.application_start || null,
        last_date: item.last_date || null,
        official_url: safeURL(item.official_url) || null,
        notification_url: safeURL(item.notification_url) || null,
        description:
          item.description ||
          item.raw_data?.original_text ||
          item.raw_data?.collected_row ||
          null,
        status: "published"
      })
    },

    admit_cards: {
      table: "admit_cards",
      load: loadAdmitCards,
      record: () => ({
        title: item.title,
        department: item.department || null,
        exam_date: item.exam_date || null,
        download_url:
          safeURL(item.download_url) ||
          safeURL(item.notification_url) ||
          safeURL(item.official_url) ||
          null,
        official_url: safeURL(item.official_url) || null,
        status: "published"
      })
    },

    results: {
      table: "results",
      load: loadResults,
      record: () => ({
        title: item.title,
        department: item.department || null,
        result_date: item.result_date || null,
        result_url:
          safeURL(item.result_url) ||
          safeURL(item.notification_url) ||
          safeURL(item.official_url) ||
          null,
        official_url: safeURL(item.official_url) || null,
        status: "published"
      })
    },

    answer_keys: {
      table: "answer_keys",
      load: loadAnswerKeys,
      record: () => ({
        title: item.title,
        department: item.department || null,
        exam_date: item.exam_date || null,
        answer_key_url:
          safeURL(item.answer_key_url) ||
          safeURL(item.notification_url) ||
          safeURL(item.official_url) ||
          null,
        official_url: safeURL(item.official_url) || null,
        status: "published"
      })
    }
  };

  return configs[item.category];
}

// APPROVE ONE PENDING UPDATE

async function approvePendingUpdate(id, button, options = {}) {
  const askConfirmation = options.confirmUser !== false;
  const refreshAfter = options.refresh !== false;

  if (askConfirmation && !confirm(
    "क्या आपने official notification verify कर लिया है? Approve करने पर यह record public website पर publish होगा।"
  )) {
    return { success: false, cancelled: true };
  }

  if (button) button.disabled = true;
  message("pendingMessage", "Approving notification...");

  let config = null;

  try {
    const { data: item, error: fetchError } = await db
      .from("collected_updates")
      .select("*")
      .eq("id", id)
      .eq("status", "pending")
      .single();

    if (fetchError) throw fetchError;

    config = getApprovalConfig(item);
    if (!config) throw new Error("Unsupported category: " + item.category);

    const { data: existing, error: checkError } = await db
      .from(config.table)
      .select("id, title, department")
      .eq("title", item.title);

    if (checkError) throw checkError;

    const duplicate = (existing || []).some(record =>
      String(record.department || "").trim().toLowerCase() ===
      String(item.department || "").trim().toLowerCase()
    );

    if (duplicate) {
      throw new Error(
        "इस title और department का record पहले से मौजूद है। पहले संबंधित section जाँचें।"
      );
    }

    const { error: insertError } = await db
      .from(config.table)
      .insert(config.record());

    if (insertError) throw insertError;

    const { data: updatedRows, error: updateError } = await db
      .from("collected_updates")
      .update({
        status: "approved",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending")
      .select("id");

    if (updateError) {
      throw new Error(
        "Record publish हो गया है, लेकिन approval status update नहीं हुआ। दोबारा approve न करें। Error: " +
        updateError.message
      );
    }

    if (!updatedRows || updatedRows.length === 0) {
      throw new Error(
        "Record publish हुआ हो सकता है, लेकिन pending status बदल चुका है। Public section में duplicate जाँचें।"
      );
    }

    if (refreshAfter) {
      await Promise.all([loadPendingUpdates(), config.load()]);
    }

    message("pendingMessage", item.category + " notification approved and published successfully.");
    return { success: true, category: item.category };

  } catch (error) {
    message("pendingMessage", "Approval failed: " + error.message, true);
    return { success: false, error: error.message };
  } finally {
    if (button) button.disabled = false;
  }
}

// BULK APPROVE

async function approveSelectedPending(button) {
  const ids = getSelectedPendingIds();
  if (!ids.length || button.disabled) return;

  const confirmed = confirm(
    `आपने ${ids.length} notifications select किए हैं। सभी selected records verify करके public website पर publish होंगे। Continue?`
  );

  if (!confirmed) return;

  button.disabled = true;
  const deleteButton = $("deleteSelectedBtn");
  if (deleteButton) deleteButton.disabled = true;

  let approved = 0;
  let failed = 0;
  const affectedCategories = new Set();
  const errors = [];

  try {
    for (let i = 0; i < ids.length; i++) {
      message(
        "pendingMessage",
        `Bulk approval: ${i + 1}/${ids.length} processing...`
      );

      const result = await approvePendingUpdate(ids[i], null, {
        confirmUser: false,
        refresh: false
      });

      if (result.success) {
        approved++;
        affectedCategories.add(result.category);
      } else {
        failed++;
        errors.push(`${ids[i]}: ${result.error || "Approval failed"}`);
      }
    }

    await loadPendingUpdates();

    const loaders = [];
    if (affectedCategories.has("jobs")) loaders.push(loadJobs());
    if (affectedCategories.has("admit_cards")) loaders.push(loadAdmitCards());
    if (affectedCategories.has("results")) loaders.push(loadResults());
    if (affectedCategories.has("answer_keys")) loaders.push(loadAnswerKeys());

    await Promise.all(loaders);

    let resultMessage = `Bulk approval completed. Published: ${approved}; Failed: ${failed}.`;

    if (errors.length) {
      resultMessage += " Errors: " + errors.slice(0, 5).join(" | ");
    }

    message("pendingMessage", resultMessage, failed > 0);

  } finally {
    button.disabled = false;
    updatePendingSelectionUI();
  }
}

// BULK DELETE PENDING

async function deleteSelectedPending(button) {
  const ids = getSelectedPendingIds();
  if (!ids.length || button.disabled) return;

  const confirmed = confirm(
    `क्या आप ${ids.length} selected pending notifications को permanently DELETE करना चाहते हैं? यह action वापस नहीं किया जा सकता। Approved या published records delete नहीं होंगे।`
  );

  if (!confirmed) return;

  button.disabled = true;
  const approveButton = $("approveSelectedBtn");
  if (approveButton) approveButton.disabled = true;

  message("pendingMessage", "Deleting selected pending notifications...");

  try {
    const { data, error } = await db
      .from("collected_updates")
      .delete()
      .in("id", ids)
      .eq("status", "pending")
      .select("id");

    if (error) throw error;

    const deleted = data?.length || 0;

    await loadPendingUpdates();

    message(
      "pendingMessage",
      `Delete completed. Deleted: ${deleted} of ${ids.length}.`
    );

  } catch (error) {
    message(
      "pendingMessage",
      "Delete failed: " + error.message +
      ". Supabase RLS policy may not allow DELETE on collected_updates.",
      true
    );
  } finally {
    button.disabled = false;
    updatePendingSelectionUI();
  }
}

// REJECT PENDING UPDATE

async function rejectPendingUpdate(id, button) {
  if (!confirm("क्या आप इस notification को reject करना चाहते हैं?")) return;

  button.disabled = true;
  message("pendingMessage", "Rejecting notification...");

  try {
    const { error } = await db
      .from("collected_updates")
      .update({
        status: "rejected",
        reviewed_at: new Date().toISOString()
      })
      .eq("id", id)
      .eq("status", "pending");

    if (error) throw error;

    message("pendingMessage", "Notification rejected.");
    await loadPendingUpdates();

  } catch (error) {
    message("pendingMessage", "Reject failed: " + error.message, true);
  } finally {
    button.disabled = false;
  }
}

// GENERIC FORM SAVE

async function saveForm(event, config) {
  event.preventDefault();

  const id = $(config.id).value;
  const record = config.fields();

  $(config.button).disabled = true;
  message(config.message, "Saving...");

  try {
    const result = id
      ? await db.from(config.table).update(record).eq("id", id)
      : await db.from(config.table).insert(record);

    if (result.error) throw result.error;

    config.reset();
    message(config.message, id ? config.updated : config.created);
    await config.load();

  } catch (error) {
    message(config.message, "Save failed: " + error.message, true);
  } finally {
    $(config.button).disabled = false;
  }
}

// FORM RESET HELPERS

function resetForm(formId, idId, headingId, heading, buttonId, buttonText, cancelId) {
  $(formId).reset();
  $(idId).value = "";
  $(headingId).textContent = heading;
  $(buttonId).textContent = buttonText;
  $(cancelId).classList.add("hidden");
}

function resetJobForm() {
  resetForm("jobForm", "jobId", "jobFormHeading", "Add New Job", "saveJobBtn", "Save Job", "cancelJobEdit");
}

function resetAdmitForm() {
  resetForm("admitForm", "admitId", "admitFormHeading", "Add New Admit Card", "saveAdmitBtn", "Save Admit Card", "cancelAdmitEdit");
}

function resetResultForm() {
  resetForm("resultForm", "resultId", "resultFormHeading", "Add New Result", "saveResultBtn", "Save Result", "cancelResultEdit");
}

function resetAnswerForm() {
  resetForm("answerForm", "answerId", "answerFormHeading", "Add New Answer Key", "saveAnswerBtn", "Save Answer Key", "cancelAnswerEdit");
}

// JOB FORM

$("jobForm").addEventListener("submit", event => saveForm(event, {
  table: "jobs",
  id: "jobId",
  button: "saveJobBtn",
  message: "jobMessage",
  load: loadJobs,
  created: "Job added successfully.",
  updated: "Job updated successfully.",
  reset: resetJobForm,
  fields: () => ({
    title: $("title").value.trim(),
    department: $("department").value.trim() || null,
    qualification: $("qualification").value.trim() || null,
    location: $("location").value.trim() || null,
    total_posts: $("totalPosts").value === "" ? null : Number($("totalPosts").value),
    application_start: $("applicationStart").value || null,
    last_date: $("lastDate").value || null,
    official_url: safeURL($("officialUrl").value) || null,
    notification_url: safeURL($("notificationUrl").value) || null,
    description: $("description").value.trim() || null,
    status: $("status").value
  })
}));

// ADMIT FORM

$("admitForm").addEventListener("submit", event => saveForm(event, {
  table: "admit_cards",
  id: "admitId",
  button: "saveAdmitBtn",
  message: "admitMessage",
  load: loadAdmitCards,
  created: "Admit card added successfully.",
  updated: "Admit card updated successfully.",
  reset: resetAdmitForm,
  fields: () => ({
    title: $("admitTitle").value.trim(),
    department: $("admitDepartment").value.trim() || null,
    exam_date: $("examDate").value || null,
    download_url: safeURL($("downloadUrl").value) || null,
    official_url: safeURL($("admitOfficialUrl").value) || null,
    status: $("admitStatus").value
  })
}));

// RESULT FORM

$("resultForm").addEventListener("submit", event => saveForm(event, {
  table: "results",
  id: "resultId",
  button: "saveResultBtn",
  message: "resultMessage",
  load: loadResults,
  created: "Result added successfully.",
  updated: "Result updated successfully.",
  reset: resetResultForm,
  fields: () => ({
    title: $("resultTitle").value.trim(),
    department: $("resultDepartment").value.trim() || null,
    result_date: $("resultDate").value || null,
    result_url: safeURL($("resultUrl").value) || null,
    official_url: safeURL($("resultOfficialUrl").value) || null,
    status: $("resultStatus").value
  })
}));

// ANSWER KEY FORM

$("answerForm").addEventListener("submit", event => saveForm(event, {
  table: "answer_keys",
  id: "answerId",
  button: "saveAnswerBtn",
  message: "answerMessage",
  load: loadAnswerKeys,
  created: "Answer key added successfully.",
  updated: "Answer key updated successfully.",
  reset: resetAnswerForm,
  fields: () => ({
    title: $("answerTitle").value.trim(),
    department: $("answerDepartment").value.trim() || null,
    exam_date: $("answerExamDate").value || null,
    answer_key_url: safeURL($("answerKeyUrl").value) || null,
    official_url: safeURL($("answerOfficialUrl").value) || null,
    status: $("answerStatus").value
  })
}));

// CANCEL EDIT BUTTONS

$("cancelJobEdit").addEventListener("click", resetJobForm);
$("cancelAdmitEdit").addEventListener("click", resetAdmitForm);
$("cancelResultEdit").addEventListener("click", resetResultForm);
$("cancelAnswerEdit").addEventListener("click", resetAnswerForm);

// PENDING SELECTION EVENTS

document.addEventListener("change", event => {
  if (event.target.id === "selectAllPending") {
    document.querySelectorAll("[data-pending-select]").forEach(input => {
      input.checked = event.target.checked;
    });
    updatePendingSelectionUI();
    return;
  }

  if (event.target.matches("[data-pending-select]")) {
    updatePendingSelectionUI();
  }
});

// EVENT DELEGATION

document.addEventListener("click", async event => {
  const target = event.target;

  const refreshButton = target.closest("#refreshPendingBtn");
  if (refreshButton) {
    event.preventDefault();
    await refreshPendingUpdates(refreshButton);
    return;
  }

  const collectorButton = target.closest("#runCollectorBtn");
  if (collectorButton) {
    event.preventDefault();
    await runAutomaticCollection(collectorButton);
    return;
  }

  const approveSelectedButton = target.closest("#approveSelectedBtn");
  if (approveSelectedButton) {
    event.preventDefault();
    await approveSelectedPending(approveSelectedButton);
    return;
  }

  const deleteSelectedButton = target.closest("#deleteSelectedBtn");
  if (deleteSelectedButton) {
    event.preventDefault();
    await deleteSelectedPending(deleteSelectedButton);
    return;
  }

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

  const configs = {
    jobs: {
      table: "jobs",
      form: "jobForm",
      id: "jobId",
      heading: "jobFormHeading",
      save: "saveJobBtn",
      cancel: "cancelJobEdit",
      message: "jobMessage",
      section: "jobsSection",
      title: "Edit Job",
      saveText: "Update Job",
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
      }
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
      title: "Edit Admit Card",
      saveText: "Update Admit Card",
      fields: {
        title: "admitTitle",
        department: "admitDepartment",
        exam_date: "examDate",
        download_url: "downloadUrl",
        official_url: "admitOfficialUrl",
        status: "admitStatus"
      }
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
      title: "Edit Result",
      saveText: "Update Result",
      fields: {
        title: "resultTitle",
        department: "resultDepartment",
        result_date: "resultDate",
        result_url: "resultUrl",
        official_url: "resultOfficialUrl",
        status: "resultStatus"
      }
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
      title: "Edit Answer Key",
      saveText: "Update Answer Key",
      fields: {
        title: "answerTitle",
        department: "answerDepartment",
        exam_date: "answerExamDate",
        answer_key_url: "answerKeyUrl",
        official_url: "answerOfficialUrl",
        status: "answerStatus"
      }
    }
  };

  // EDIT RECORD

  if (edit) {
    const config = configs[edit.dataset.editType];
    if (!config) return;

    try {
      const { data, error } = await db
        .from(config.table)
        .select("*")
        .eq("id", edit.dataset.editId)
        .single();

      if (error) throw error;

      $(config.id).value = data.id;

      Object.entries(config.fields).forEach(([column, elementId]) => {
        $(elementId).value = data[column] ?? "";
      });

      $(config.heading).textContent = config.title;
      $(config.save).textContent = config.saveText;
      $(config.cancel).classList.remove("hidden");

      const tab = document.querySelector(`[data-tab="${config.section}"]`);
      if (tab) tab.click();

      $(config.form).scrollIntoView({ behavior: "smooth" });

    } catch (error) {
      message(config.message, "Could not open record: " + error.message, true);
    }

    return;
  }

  // DELETE PUBLIC RECORD

  if (remove) {
    const type = remove.dataset.deleteType;
    const config = configs[type];
    if (!config) return;

    if (!confirm("Are you sure you want to delete this record?")) return;

    try {
      const { error } = await db
        .from(config.table)
        .delete()
        .eq("id", remove.dataset.deleteId);

      if (error) throw error;

      alert("Record deleted successfully.");

      const loaders = {
        jobs: loadJobs,
        admit: loadAdmitCards,
        results: loadResults,
        answers: loadAnswerKeys
      };

      await loaders[type]();

    } catch (error) {
      alert("Delete failed: " + error.message);
    }
  }
});

// INITIAL SESSION

async function startAdmin() {
  const { data, error } = await db.auth.getSession();

  if (error || !data.session) {
    showLogin();
    return;
  }

  await openAdmin(data.session.user);
}

startAdmin();