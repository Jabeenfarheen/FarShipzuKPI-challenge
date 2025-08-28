function getCurrentISTDateTime() {
  let istOffset = 5 * 60 + 30;
  let now = new Date();
  let utc = now.getTime() + now.getTimezoneOffset() * 60000;
  let istTime = new Date(utc + istOffset * 60000);
  return istTime.toISOString().replace("Z", "+05:30");
}

let thresholds = {
  delivered_percent: 85,
  rto_percent: 8,
  orders_at_risk: 20,
};

let orders = [];
let kpis = {
  delivered_percent: 0,
  rto_percent: 0,
  orders_at_risk: 0,
  drr: 0,
};

function updateThresholdsFromInputs() {
  thresholds.delivered_percent = parseFloat(
    document.getElementById("thDelivered").value
  );
  thresholds.rto_percent = parseFloat(document.getElementById("thRto").value);
  thresholds.orders_at_risk = parseInt(document.getElementById("thRisk").value);
}

function calculateKPIs() {
  if (!orders.length) return;

  const total = orders.length;
  const cancelled = orders.filter(
    (o) => o.current_status === "CANCELLED"
  ).length;
  const denominator = total - cancelled;
  const delivered = orders.filter(
    (o) => o.current_status === "DELIVERED"
  ).length;
  kpis.delivered_percent =
    denominator > 0 ? (delivered / denominator) * 100 : 0;

  const rto_delivered = orders.filter(
    (o) => o.current_status === "RTO_DELIVERED"
  ).length;
  const completed = delivered + rto_delivered;
  kpis.rto_percent = completed > 0 ? (rto_delivered / completed) * 100 : 0;

  kpis.orders_at_risk = orders.filter(
    (o) =>
      (o.current_status === "OUT_FOR_DELIVERY" && o.days_in_state > 2) ||
      (o.current_status === "IN_TRANSIT" && o.days_in_state > 5) ||
      (o.current_status === "NDR" && o.ndr_open === true && o.days_in_state > 1)
  ).length;

  const istOffset = 5 * 60 + 30; // IST offset in minutes (5 hours 30 minutes)
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + istOffset * 60000;
  const sevenDaysAgo = new Date(istMs - 7 * 24 * 60 * 60 * 1000);

  const deliveredLast7Days = orders.filter(
    (o) =>
      o.current_status === "DELIVERED" && new Date(o.created_at) >= sevenDaysAgo
  ).length;

  kpis.drr = deliveredLast7Days / 7;
}

function updateUI() {
  document.getElementById("deliveredPercent").textContent =
    kpis.delivered_percent.toFixed(2) + "%";
  document.getElementById("rtoPercent").textContent =
    kpis.rto_percent.toFixed(2) + "%";
  document.getElementById("ordersAtRisk").textContent = kpis.orders_at_risk;
  document.getElementById("drr").textContent = kpis.drr.toFixed(3);

  updateCardColor(
    "cardDelivered",
    kpis.delivered_percent >= thresholds.delivered_percent
  );
  updateCardColor("cardRTO", kpis.rto_percent <= thresholds.rto_percent);
  updateCardColor("cardRisk", kpis.orders_at_risk <= thresholds.orders_at_risk);

  displayRuleTriggers();

  document.getElementById("istTimestamp").textContent =
    "Current IST timestamp: " + getCurrentISTDateTime();
}

function updateCardColor(cardId, isPassed) {
  var el = document.getElementById(cardId);
  if (!el) return;
  el.classList.toggle("passed", isPassed);
  el.classList.toggle("failed", !isPassed);
}

function displayRuleTriggers() {
  const rules = [];

  if (kpis.delivered_percent < thresholds.delivered_percent) {
    rules.push("Delivered % below threshold");
  } else {
    rules.push("Delivered % within threshold");
  }

  if (kpis.rto_percent > thresholds.rto_percent) {
    rules.push("RTO % above threshold");
  } else {
    rules.push("RTO % within threshold");
  }

  if (kpis.orders_at_risk > thresholds.orders_at_risk) {
    rules.push("Orders at Risk above threshold");
  } else {
    rules.push("Orders at Risk within threshold");
  }

  let rulesDiv = document.getElementById("rulesOutput");
  rulesDiv.innerHTML = "";
  rules.forEach((rule) => {
    let span = document.createElement("span");
    span.className =
      rule.includes("below") || rule.includes("above")
        ? "badge red"
        : "badge green";
    span.textContent = rule;
    rulesDiv.appendChild(span);
  });
}

function getCurrentISTDateTime() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  const istMs = utcMs + (5 * 60 + 30) * 60000;
  return new Date(istMs).toISOString().replace("Z", "+05:30");
}

function downloadSubmissionJSON(kpis, thresholds) {
  const triggers = [];
  if (kpis.delivered_percent < thresholds.delivered_percent)
    triggers.push("delivered_percent_below_threshold");
  if (kpis.rto_percent > thresholds.rto_percent)
    triggers.push("rto_percent_above_threshold");
  if (kpis.orders_at_risk > thresholds.orders_at_risk)
    triggers.push("orders_at_risk_above_threshold");

  const submission = {
    submitted_at_ist: getCurrentISTDateTime(),
    kpi: {
      delivered_percent: Number(kpis.delivered_percent.toFixed(2)),
      rto_percent: Number(kpis.rto_percent.toFixed(2)),
      orders_at_risk: kpis.orders_at_risk,
      drr: Number(kpis.drr.toFixed(3)),
    },
    rules_thresholds: {
      delivered_percent: thresholds.delivered_percent,
      rto_percent: thresholds.rto_percent,
      orders_at_risk: thresholds.orders_at_risk,
    },
    rules_triggers: triggers,
  };

  const dataStr =
    "data:text/json;charset=utf-8," +
    encodeURIComponent(JSON.stringify(submission, null, 2));
  const dlAnchorElem = document.createElement("a");
  dlAnchorElem.setAttribute("href", dataStr);
  dlAnchorElem.setAttribute("download", "submission.json");
  document.body.appendChild(dlAnchorElem);
  dlAnchorElem.click();
  dlAnchorElem.remove();
}

document
  .getElementById("downloadSubmissionBtn")
  .addEventListener("click", function () {
    downloadSubmissionJSON(kpis, thresholds);
  });

function openJSON() {
  fetch("submission.json")
    .then((response) => response.json())
    .then((data) => {
      const newWindow = window.open();
      newWindow.document.write(
        "<pre>" + JSON.stringify(data, null, 2) + "</pre>"
      );
    });
}

function loadDataset() {
  fetch("shipzu_sample_orders_IST.json")
    .then((res) => res.json())
    .then((data) => {
      orders = data;
      updateThresholdsFromInputs();
      calculateKPIs();
      updateUI();
    })
    .catch((err) => {
      console.error("Failed to load dataset:", err);
      document.getElementById("rulesOutput").textContent =
        "Failed to load dataset";
    });
}

document.getElementById("thDelivered").addEventListener("change", () => {
  updateThresholdsFromInputs();
  calculateKPIs();
  updateUI();
});
document.getElementById("thRto").addEventListener("change", () => {
  updateThresholdsFromInputs();
  calculateKPIs();
  updateUI();
});
document.getElementById("thRisk").addEventListener("change", () => {
  updateThresholdsFromInputs();
  calculateKPIs();
  updateUI();
});

loadDataset();
