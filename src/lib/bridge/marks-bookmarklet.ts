const APP_ORIGIN_PLACEHOLDER = "__CLA_APP_ORIGIN__";

/**
 * Bookmarklet source.
 *
 * Runs on AcademicBridge, finds the Grades view (navigating there when the
 * student clicked from another page), starts at page 1 when possible or reads
 * backwards from the current page, scrapes every assessment page, then posts
 * the rows plus live progress to an estimator tab opened by the bookmarklet.
 *
 * Two rules for this string:
 *  - no line comments, because newlines are collapsed before the href is built;
 *  - no template literals or `${}`, because the outer literal owns them.
 */
const BOOKMARKLET_SOURCE = String.raw`
(async function () {
  "use strict";

  var APP_ORIGIN = "__CLA_APP_ORIGIN__";
  var SOURCE_ORIGIN = "https://app.academicbridge.ai";
  var GRADES_URL = SOURCE_ORIGIN + "/s/grades";
  var IMPORT_URL = APP_ORIGIN + "/bridge";
  var WINDOW_NAME = "cla-bridge-import";
  var PANEL_ID = "cla-bridge-import-status";
  var GRADES_PATH = /\/grades(?:[/?#]|$)/i;
  var PAGE_PATTERN = /Page\s+(\d+)\s*(?:of|\/)\s*(\d+)/i;

  if (location.origin !== SOURCE_ORIGIN) {
    alert("Open AcademicBridge first, sign in, then click this bookmark.");
    return;
  }

  var previousPanel = document.getElementById(PANEL_ID);
  if (previousPanel) previousPanel.remove();

  var panel = document.createElement("div");
  panel.id = PANEL_ID;
  panel.style.cssText = "position:fixed;right:18px;bottom:18px;z-index:2147483647;width:min(340px,calc(100vw - 36px));padding:16px 18px;border-radius:16px;background:#0f231c;color:#f7f4ea;font:14px/1.5 system-ui,-apple-system,'Segoe UI',sans-serif;box-shadow:0 18px 50px rgba(0,0,0,.35)";
  var heading = document.createElement("p");
  heading.textContent = "CLA BRIDGE";
  heading.style.cssText = "margin:0 0 6px;font-size:11px;font-weight:700;letter-spacing:.14em;color:#8fd3b6";
  var status = document.createElement("p");
  status.style.cssText = "margin:0;white-space:pre-line";
  status.textContent = "Preparing the import...";
  panel.appendChild(heading);
  panel.appendChild(status);
  document.body.appendChild(panel);

  var setStatus = function (text) { status.textContent = text; };
  var wait = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  var textOf = function (el) { return el && el.innerText ? el.innerText.replace(/\s+/g, " ").trim() : ""; };
  var isVisible = function (el) { return el.offsetParent !== null || (el.getClientRects && el.getClientRects().length > 0); };

  if (/login|signin|sign-in|auth/i.test(location.pathname)) {
    setStatus("Sign in to AcademicBridge, open Grades, then click this bookmark again.");
    return;
  }

  /* Open the estimator while the click still counts as a user gesture.
     window.focus() keeps AcademicBridge in front so its timers are not throttled. */
  var popup = window.open(IMPORT_URL, WINDOW_NAME);
  try { window.focus(); } catch (error) {}
  if (!popup) {
    setStatus("Allow pop-ups for AcademicBridge, then click the bookmark again.");
    return;
  }

  var importId = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  var expectedCount = null;
  var lastProgress = null;

  var postToApp = function (message) {
    if (!popup || popup.closed) return;
    try {
      popup.postMessage(message, APP_ORIGIN);
    } catch (error) {}
  };

  var report = function (stage, message, extra) {
    setStatus(message);
    var progress = {
      type: "cla-bridge:progress",
      version: 1,
      id: importId,
      stage: stage,
      message: message,
      page: extra && typeof extra.page === "number" ? extra.page : null,
      totalPages: extra && typeof extra.totalPages === "number" ? extra.totalPages : null,
      rows: extra && typeof extra.rows === "number" ? extra.rows : 0,
      expectedCount: expectedCount,
      sentAt: Date.now()
    };
    lastProgress = progress;
    postToApp(progress);
  };

  /* Re-send the current stage until the app finishes loading, so the CLA Bridge
     tab shows progress even though it opens a moment after the scraping starts. */
  var heartbeat = setInterval(function () {
    if (lastProgress) postToApp(lastProgress);
  }, 1200);
  var stopHeartbeatSoon = function (delay) {
    setTimeout(function () { clearInterval(heartbeat); }, delay);
  };

  function findTable() {
    var containers = Array.prototype.slice.call(document.querySelectorAll("table, [role='table'], [role='grid']"));
    for (var index = 0; index < containers.length; index++) {
      var text = textOf(containers[index]);
      if (/Class/i.test(text) && /Score/i.test(text) && /Max\s*Score/i.test(text)) return containers[index];
    }
    return null;
  }

  function rowsOf(container) {
    var rows = Array.prototype.slice.call(container.querySelectorAll("tbody tr"));
    if (!rows.length) rows = Array.prototype.slice.call(container.querySelectorAll("[role='row']"));
    if (!rows.length) rows = Array.prototype.slice.call(container.querySelectorAll("tr")).slice(1);
    return rows;
  }

  function cellsOf(row) {
    var cells = Array.prototype.slice.call(row.querySelectorAll("td"));
    if (!cells.length) cells = Array.prototype.slice.call(row.querySelectorAll("[role='cell'], [role='gridcell']"));
    if (!cells.length) cells = Array.prototype.slice.call(row.children);
    return cells.map(textOf);
  }

  function numberFrom(text) {
    var match = String(text).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : NaN;
  }

  function headerMap(container) {
    var headerRow = container.querySelector("thead tr");
    if (!headerRow) {
      var roleRows = Array.prototype.slice.call(container.querySelectorAll("[role='row']"));
      headerRow = roleRows.find(function (row) { return row.querySelector("[role='columnheader']"); }) || container.querySelector("tr");
    }
    if (!headerRow) return null;

    var headers = Array.prototype.slice.call(headerRow.querySelectorAll("th, [role='columnheader']")).map(textOf);
    if (!headers.length) headers = Array.prototype.slice.call(headerRow.children).map(textOf);
    if (!headers.length) return null;

    var find = function (pattern, exclude) {
      return headers.findIndex(function (header) {
        return pattern.test(header) && (!exclude || !exclude.test(header));
      });
    };

    var date = find(/date/i);
    var subject = find(/class|subject|course/i);
    var type = find(/type|assessment/i);
    var score = find(/score|marks?|achieved|obtained/i, /max/i);
    var max = find(/max|out\s*of|possible/i) >= 0 ? find(/max|out\s*of|possible/i) : find(/total/i);

    if ([date, subject, type, score, max].every(function (index) { return index >= 0; })) {
      return { date: date, subject: subject, type: type, score: score, max: max };
    }
    return null;
  }

  var table = null;

  function tableReady() {
    var candidate = findTable();
    if (!candidate) return null;
    var candidateRows = rowsOf(candidate);
    if (!candidateRows.length) return null;
    if (cellsOf(candidateRows[0]).length < 5) return null;
    return candidate;
  }

  function firstRowText() {
    var freshTable = findTable() || table;
    if (!freshTable) return "";
    var freshRows = rowsOf(freshTable);
    return freshRows.length ? textOf(freshRows[0]) : "";
  }

  function pageInfo() {
    var match = document.body.innerText.match(PAGE_PATTERN);
    return match ? { page: Number(match[1]), total: Number(match[2]) } : null;
  }

  function controls() {
    return Array.prototype.slice.call(document.querySelectorAll("button, a")).filter(function (el) {
      return isVisible(el) && !el.disabled;
    });
  }

  function labelledControl(pattern) {
    var found = controls().find(function (el) {
      return pattern.test((el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || ""));
    });
    return found || null;
  }

  function findGradesLink() {
    var links = Array.prototype.slice.call(document.querySelectorAll("a[href]"));
    var byHref = links.find(function (link) {
      var href = link.getAttribute("href") || "";
      var target = link.getAttribute("target");
      return GRADES_PATH.test(href) && (!target || target === "_self");
    });
    if (byHref) return byHref;

    var candidates = Array.prototype.slice.call(document.querySelectorAll("a, button, [role='tab'], [role='link']"));
    var byLabel = candidates.find(function (el) {
      var label = (textOf(el) + " " + (el.getAttribute("aria-label") || "")).trim();
      var target = el.getAttribute("target");
      return /^grades?$/i.test(label) && isVisible(el) && (!target || target === "_self");
    });
    return byLabel || null;
  }

  function previousControlIn(container, allowBack) {
    var elements = Array.prototype.slice.call(container.querySelectorAll("button, a")).filter(function (el) {
      return !el.disabled;
    });
    var pattern = allowBack
      ? /previous|prev|back|go\s*to\s*previous/i
      : /previous|prev|go\s*to\s*previous/i;
    var labelled = elements.find(function (el) {
      return pattern.test((el.getAttribute("aria-label") || "") + " " + (el.getAttribute("title") || ""));
    });
    if (labelled) return labelled;
    var glyph = elements.find(function (el) {
      return allowBack
        ? /^(prev(ious)?|back|‹|«|←)$/i.test(textOf(el))
        : /^(prev(ious)?|‹|«|←)$/i.test(textOf(el));
    });
    if (glyph) return glyph;
    var single = elements.filter(function (el) { return el.querySelector("svg.lucide-chevron-left"); });
    if (single.length) return single[0];
    var double = elements.filter(function (el) { return el.querySelector("svg.lucide-chevrons-left"); });
    return double.length ? double[0] : null;
  }

  function previousButton() {
    /* Prefer a Previous control that shares the Next control's container, so a
       "Back" link elsewhere in the app can never navigate away from Grades. */
    var next = nextButton();
    if (next && next.parentElement) {
      var local = previousControlIn(next.parentElement, true);
      if (local) return local;
    }
    return previousControlIn(document, false);
  }

  /* AcademicBridge's true "jump to first page" control is the double-chevron
     button; its Previous button is mislabelled "Go to first page" and its
     first-page button has an empty label, so only the icon is reliable. */
  function jumpToFirstButton() {
    var next = nextButton();
    if (next && next.parentElement) {
      var local = Array.prototype.slice.call(next.parentElement.querySelectorAll("button, a")).find(
        function (el) {
          return !el.disabled && el.querySelector("svg.lucide-chevrons-left");
        },
      );
      if (local) return local;
    }

    var doubles = controls().filter(function (el) {
      return el.querySelector("svg.lucide-chevrons-left");
    });
    if (doubles.length === 1) return doubles[0];

    var labelled = labelledControl(/first\s*page|go\s*to\s*first/i);
    /* Never accept the mislabelled Previous button, which has a single chevron. */
    if (labelled && !labelled.querySelector("svg.lucide-chevron-left")) return labelled;

    var glyph = controls().find(function (el) { return /^(first|««)$/i.test(textOf(el)); });
    if (glyph) return glyph;
    return numberedFirstButton();
  }

  function numberedFirstButton() {
    /* Only trust a "1" button when it sits in a group of page numbers, or next
       to the paginator's Next control. */
    var ones = controls().filter(function (el) {
      if (textOf(el) !== "1") return false;
      var parent = el.parentElement;
      if (!parent) return false;
      var siblings = Array.prototype.slice.call(parent.querySelectorAll("button, a"));
      var numericSibling = siblings.some(function (sibling) {
        return sibling !== el && /^\d+$/.test(textOf(sibling));
      });
      if (numericSibling) return true;
      return siblings.some(function (sibling) {
        if (sibling === el) return false;
        var label = (sibling.getAttribute("aria-label") || "") + " " + (sibling.getAttribute("title") || "") + " " + textOf(sibling);
        return /next|forward|›|»|→/i.test(label);
      });
    });
    return ones.length === 1 ? ones[0] : null;
  }

  function nextButton() {
    var labelled = labelledControl(/next|forward|go\s*to\s*next/i);
    if (labelled) return labelled;
    var glyph = controls().find(function (el) { return /^(next|›|»|→)$/i.test(textOf(el)); });
    if (glyph) return glyph;
    var single = controls().filter(function (el) { return el.querySelector("svg.lucide-chevron-right"); });
    if (single.length) return single[0];
    var double = controls().filter(function (el) { return el.querySelector("svg.lucide-chevrons-right"); });
    if (double.length) return double[double.length - 1];
    return null;
  }

  async function waitForTable(attempts) {
    for (var attempt = 0; attempt < attempts; attempt++) {
      var candidate = tableReady();
      if (candidate) return candidate;
      if (attempt === 4) report("locating", "Waiting for the Grades table to finish loading...");
      await wait(500);
    }
    return null;
  }

  /* Prefer AcademicBridge's direct first-page control so the normal forward
     scan starts at page 1 without stepping through every intervening page. */
  async function goToFirstPage() {
    var info = pageInfo();
    if (!info || info.page <= 1) return true;

    var jump = jumpToFirstButton();
    if (!jump) return false;

    var jumpFrom = info.page;
    var jumpTotal = info.total;
    var beforeJump = firstRowText();
    report("reading", "Jumping to page 1 of " + jumpTotal + " (from page " + jumpFrom + ")...", {
      page: jumpFrom,
      totalPages: jumpTotal,
      rows: 0
    });
    jump.click();
    for (var jumpTick = 0; jumpTick < 16; jumpTick++) {
      await wait(250);
      var jumped = pageInfo();
      /* The jump control disables itself on page 1, and the indicator also
         reads page 1; either signal means the jump worked. */
      if (jump.disabled || (jumped && jumped.page <= 1)) {
        for (var settle = 0; settle < 40; settle++) {
          await wait(250);
          var freshFirst = firstRowText();
          if (freshFirst && freshFirst !== beforeJump) break;
        }
        table = findTable() || table;
        return true;
      }
    }
    return false;
  }

  var alreadyOnGrades = GRADES_PATH.test(location.pathname);
  report(
    alreadyOnGrades ? "locating" : "navigating",
    alreadyOnGrades ? "Looking for your assessments..." : "Opening your Grades page..."
  );

  if (!alreadyOnGrades) {
    var gradesLink = findGradesLink();
    if (!gradesLink) {
      report("navigating", "Taking this tab to Grades. Click the bookmark again when the table loads.");
      await wait(600);
      location.assign(GRADES_URL);
      return;
    }

    /* Remember any table already on this page, so a dashboard table with the
       same headers is never mistaken for the Grades table after the click. */
    var beforeTable = tableReady();
    var beforeTableText = beforeTable ? textOf(beforeTable) : "";
    gradesLink.click();
    var navigated = null;
    for (var navAttempt = 0; navAttempt < 24 && !navigated; navAttempt++) {
      await wait(500);
      var candidateTable = tableReady();
      if (!candidateTable) continue;
      if (candidateTable !== beforeTable || textOf(candidateTable) !== beforeTableText) {
        navigated = candidateTable;
      }
      if (!navigated && navAttempt === 12) {
        report("navigating", "Still opening Grades... click the bookmark again if this page does not change.");
      }
    }

    if (!navigated && !GRADES_PATH.test(location.pathname)) {
      report("navigating", "Taking this tab to Grades. Click the bookmark again when the table loads.");
      await wait(600);
      location.assign(GRADES_URL);
      return;
    }
  }

  table = await waitForTable(40);
  if (!table) {
    report("error", "Could not find the assessments table. Open Grades, make sure the table is visible, then click the bookmark again.");
    stopHeartbeatSoon(20000);
    return;
  }

  var expectedMatch = document.body.innerText.match(/All Assessments\s+([\d,]+)/i);
  expectedCount = expectedMatch ? Number(expectedMatch[1].replace(/,/g, "")) : null;

  try {
    var chips = Array.prototype.slice.call(document.querySelectorAll("button, [role='tab'], [role='radio']"));
    var academic = chips.find(function (chip) { return /^academic$/i.test(textOf(chip)); });
    var nonAcademic = chips.find(function (chip) { return /^non-academic$/i.test(textOf(chip)); });
    var isActive = function (chip) {
      return chip.getAttribute("aria-pressed") === "true" || chip.getAttribute("aria-selected") === "true" || /active|selected/.test(chip.className || "");
    };
    if (academic && nonAcademic && isActive(nonAcademic) && !isActive(academic)) {
      report("locating", "Switching to academic assessments...");
      academic.click();
      await wait(900);
      table = findTable() || table;
    }
  } catch (error) {}

  var columnIndex = headerMap(table) || { date: 0, subject: 1, type: 2, score: 3, max: 4 };
  var lastColumn = Math.max(columnIndex.date, columnIndex.subject, columnIndex.type, columnIndex.score, columnIndex.max);

  report("reading", "Looking for the first page...");
  var reachedFirstPage = await goToFirstPage();
  table = findTable() || table;
  expectedMatch = document.body.innerText.match(/All Assessments\s+([\d,]+)/i);
  if (expectedMatch) expectedCount = Number(expectedMatch[1].replace(/,/g, ""));

  var pageChunks = [];
  var seenRows = new Set();
  var pageFirstRows = new Map();
  var pagesRead = 0;
  var readBackwards = !reachedFirstPage;

  function chunkRowCount() {
    var count = 0;
    for (var chunkIndex = 0; chunkIndex < pageChunks.length; chunkIndex++) {
      count += pageChunks[chunkIndex].rows.length;
    }
    return count;
  }

  function readPageRows(dataRows) {
    var extracted = [];
    for (var rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
      var row = dataRows[rowIndex];
      if (row.querySelector("[role='columnheader']")) continue;
      var cells = cellsOf(row);
      if (cells.length <= lastColumn) continue;
      var date = cells[columnIndex.date];
      var subject = cells[columnIndex.subject];
      var type = cells[columnIndex.type];
      if (/^date$/i.test(date) || !subject || !type) continue;

      var score = numberFrom(cells[columnIndex.score]);
      var maxScore = numberFrom(cells[columnIndex.max]);
      if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) continue;

      extracted.push({ date: date, subject: subject, type: type, score: score, maxScore: maxScore });
    }
    return extracted;
  }

  /* Read the page on screen once and remember its page number, so a backwards
     walk can be put back into page order before it is sent. */
  function capturePage(direction) {
    var info = pageInfo();
    var currentPage = info ? info.page : null;
    var totalPages = info ? info.total : null;
    var dataRows = rowsOf(table);
    var firstRow = dataRows.length ? textOf(dataRows[0]) : "";
    var duplicate = false;

    if (currentPage !== null) {
      var previousFirst = pageFirstRows.get(currentPage);
      duplicate = previousFirst !== undefined && previousFirst === firstRow;
      if (!duplicate) pageFirstRows.set(currentPage, firstRow);
    }

    if (!duplicate) {
      pageChunks.push({ page: currentPage, rows: readPageRows(dataRows) });
      pagesRead += 1;
      report(
        "reading",
        "Reading page " + (currentPage !== null ? currentPage : pagesRead) +
          (totalPages !== null ? " of " + totalPages : "") +
          (direction === "back" ? " backwards" : "") + "...",
        { page: currentPage, totalPages: totalPages, rows: chunkRowCount() }
      );
    }

    return { page: currentPage, totalPages: totalPages, firstRow: firstRow, duplicate: duplicate };
  }

  async function waitForPageTurn(beforePage, beforeFirst, backwards) {
    for (var tick = 0; tick < 90; tick++) {
      await wait(250);
      var info = pageInfo();
      var pageChanged =
        beforePage !== null &&
        info !== null &&
        (backwards ? info.page < beforePage : info.page !== beforePage);
      var rowsChanged = firstRowText() && firstRowText() !== beforeFirst;

      if (pageChanged) {
        for (var settle = 0; settle < 40; settle++) {
          await wait(250);
          var fresh = firstRowText();
          if (fresh && fresh !== beforeFirst) break;
        }
        return true;
      }
      if (rowsChanged && tick > 8) return true;
      /* Without a page indicator, assume the click worked once rows settle. */
      if (beforePage === null && tick > 20) return true;
    }
    return false;
  }

  /* Reading backwards must not reverse the assessment order inside a column. */
  function assembleRows() {
    var chunks = pageChunks.slice();
    var allNumbered = chunks.length > 0;
    for (var chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
      if (typeof chunks[chunkIndex].page !== "number") allNumbered = false;
    }
    if (allNumbered) {
      chunks.sort(function (left, right) { return left.page - right.page; });
    }

    var rows = [];
    var mixed = !allNumbered;
    chunks.forEach(function (chunk) {
      chunk.rows.forEach(function (row) {
        if (mixed) {
          var key = [row.date, row.subject, row.type, row.score, row.maxScore].join("|");
          if (seenRows.has(key)) return;
          seenRows.add(key);
        }
        rows.push({ subject: row.subject, type: row.type, score: row.score, maxScore: row.maxScore });
      });
    });
    return rows;
  }

  if (!readBackwards) {
    for (var pageIndex = 0; pageIndex < 150; pageIndex++) {
      var captured = capturePage("forward");
      if (captured.duplicate) break;
      if (
        captured.totalPages !== null &&
        captured.page !== null &&
        captured.page >= captured.totalPages
      ) {
        break;
      }

      var next = nextButton();
      if (!next) break;
      next.click();

      var advanced = await waitForPageTurn(captured.page, captured.firstRow, false);
      table = findTable() || table;
      if (!advanced) break;
    }
  } else {
    /* If the jump control is unavailable, collect each page while moving back
       so starting near the end cannot omit earlier assessments. */
    var startingPage = pageInfo();
    report(
      "reading",
      "Reading backwards from page " + (startingPage ? startingPage.page : "the current page") +
        " because the jump to page 1 did not work."
    );
    for (var backIndex = 0; backIndex < 150; backIndex++) {
      var capturedBack = capturePage("back");
      if (capturedBack.duplicate) break;
      if (capturedBack.page !== null && capturedBack.page <= 1) break;

      var previous = previousButton() || numberedFirstButton();
      if (!previous) break;
      previous.click();

      var moved = await waitForPageTurn(capturedBack.page, capturedBack.firstRow, true);
      table = findTable() || table;
      if (!moved) break;
    }
  }

  var collected = assembleRows();

  if (!collected.length) {
    report("error", "No marks were found. Choose the Academic filter, make sure scores are visible, then try again.");
    stopHeartbeatSoon(20000);
    return;
  }

  var payload = {
    type: "cla-bridge:import",
    version: 1,
    id: importId,
    rows: collected,
    pages: pagesRead,
    expectedCount: expectedCount
  };

  var short = expectedCount !== null && collected.length < expectedCount;
  report(
    "sending",
    "Sending " + collected.length + " marks to CLA Bridge..." + (short ? " Only " + collected.length + " of " + expectedCount + " rows were readable." : ""),
    { rows: collected.length, page: null, totalPages: null }
  );

  var acknowledged = false;
  var onMessage = function (event) {
    if (event.origin !== APP_ORIGIN) return;
    var message = event.data;
    if (!message || message.type !== "cla-bridge:import-ack" || message.id !== payload.id) return;
    acknowledged = true;
  };

  window.addEventListener("message", onMessage);
  for (var send = 0; send < 120 && !acknowledged; send++) {
    if (popup.closed) break;
    try {
      popup.postMessage(payload, APP_ORIGIN);
    } catch (error) {
      break;
    }
    await wait(500);
  }
  window.removeEventListener("message", onMessage);

  if (acknowledged) {
    report("done", "Marks received. Filling your estimate...", { rows: collected.length });
    clearInterval(heartbeat);
    try { popup.focus(); } catch (error) {}
    setTimeout(function () { panel.remove(); }, 6000);
  } else if (popup.closed) {
    report("error", "The CLA Bridge tab closed before the import finished. Try again.", { rows: collected.length });
    stopHeartbeatSoon(20000);
  } else {
    report("error", "CLA Bridge did not confirm the import. Sign in there, then click the bookmark again.", { rows: collected.length });
    stopHeartbeatSoon(20000);
  }
})();
`;

/**
 * Build the `javascript:` href for the draggable bookmarklet button. The app
 * origin is injected so local development imports into localhost instead of
 * silently sending marks to production.
 */
export function bookmarkletCode(appOrigin: string): string {
  const origin = String(appOrigin || "").replace(/\/+$/, "");
  const source = BOOKMARKLET_SOURCE.replace(APP_ORIGIN_PLACEHOLDER, () => origin)
    .replace(/\n\s*/g, " ")
    .trim();
  return `javascript:${source}`;
}
