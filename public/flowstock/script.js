/* ============================================================
   FlowStock AI — Warehouse Control Center
   Vanilla JS. No frameworks, no APIs. Mock data only.
   ============================================================ */

/* ---------------------- MOCK DATA ---------------------- */
const ZONES = ["A", "B", "C", "D"];

function seedProducts() {
  const raw = [
    ["SKU-1001","Thermal Label Roll 4x6","Packaging","A-01-14",420,60,120,3.2],
    ["SKU-1002","Lithium Cell 18650","Electronics","A-02-05",96,40,60,7.9],
    ["SKU-1003","Wireless Barcode Scanner","Electronics","A-03-11",34,12,20,148.0],
    ["SKU-1004","Industrial Pallet Wrap","Packaging","B-01-02",210,25,80,11.4],
    ["SKU-1005","Steel Shelving Bracket","Hardware","B-02-09",64,30,45,18.6],
    ["SKU-1006","Cold Chain Gel Pack","Cold","D-01-03",180,90,140,1.8],
    ["SKU-1007","Smart Thermostat V3","Electronics","A-04-07",22,15,25,89.0],
    ["SKU-1008","Conveyor Drive Belt","Hardware","B-03-01",41,10,25,64.5],
    ["SKU-1009","Vaccine Cooler Box","Cold","D-02-06",17,9,20,132.0],
    ["SKU-1010","Ergonomic Picking Glove","Safety","C-01-08",300,55,100,6.4],
    ["SKU-1011","High-Vis Safety Vest","Safety","C-02-04",145,20,60,9.1],
    ["SKU-1012","RFID Asset Tag (100pk)","Electronics","A-05-12",78,34,50,42.0],
    ["SKU-1013","Corrugated Box M","Packaging","B-04-10",530,120,200,1.1],
    ["SKU-1014","Forklift Hydraulic Oil","Hardware","B-05-05",29,6,20,37.5],
    ["SKU-1015","Temperature Data Logger","Cold","D-03-02",53,21,35,26.9],
    ["SKU-1016","Anti-Static Bubble Wrap","Packaging","B-06-07",190,44,90,8.3],
    ["SKU-1017","Handheld Label Printer","Electronics","A-06-03",26,11,18,215.0],
    ["SKU-1018","Warehouse Floor Marking Tape","Safety","C-03-06",122,18,50,5.6],
  ];
  return raw.map(([sku, name, category, location, stock, reserved, reorderPoint, cost]) => ({
    sku, name, category, location, stock, reserved, reorderPoint, cost,
    damaged: 0,
  }));
}

function seedOrders() {
  const raw = [
    ["ORD-8801","NordMed Clinics","Critical",4,[["SKU-1009",10],["SKU-1006",24]]],
    ["ORD-8802","Halden Retail Group","High",8,[["SKU-1013",120],["SKU-1001",40]]],
    ["ORD-8803","Vertex Robotics","Critical",6,[["SKU-1003",12],["SKU-1012",8]]],
    ["ORD-8804","BlueLine Logistics","Medium",24,[["SKU-1004",30],["SKU-1016",25]]],
    ["ORD-8805","Aurora Foods","High",10,[["SKU-1006",60],["SKU-1015",12]]],
    ["ORD-8806","Ironworks Supply","Low",48,[["SKU-1005",20],["SKU-1008",6]]],
    ["ORD-8807","Meridian Hospital","Critical",3,[["SKU-1009",6],["SKU-1015",10]]],
    ["ORD-8808","Cobalt Electronics","Medium",18,[["SKU-1002",50],["SKU-1012",10]]],
    ["ORD-8809","Sunridge Warehousing","Low",72,[["SKU-1010",80],["SKU-1011",40]]],
    ["ORD-8810","Pace Fulfilment","High",9,[["SKU-1001",60],["SKU-1013",90]]],
    ["ORD-8811","Trident Marine","Medium",20,[["SKU-1014",8],["SKU-1008",4]]],
    ["ORD-8812","Helix Labs","Critical",5,[["SKU-1007",14],["SKU-1017",6]]],
    ["ORD-8813","Orchard Grocers","High",12,[["SKU-1006",40],["SKU-1013",60]]],
    ["ORD-8814","Kestrel Safety Co.","Low",60,[["SKU-1011",35],["SKU-1018",20]]],
    ["ORD-8815","Zenith Automation","Medium",22,[["SKU-1012",16],["SKU-1003",5]]],
    ["ORD-8816","Fjord Cold Storage","High",11,[["SKU-1015",18],["SKU-1009",4]]],
    ["ORD-8817","Atlas Packaging","Medium",26,[["SKU-1016",60],["SKU-1004",20]]],
  ];
  return raw.map(([id, customer, priority, slaHours, items]) => ({
    id, customer, priority, slaHours,
    status: "New",
    items: items.map(([sku, qty]) => ({ sku, qty, allocated: 0, backordered: 0, picked: 0 })),
    log: [{ t: now(), text: "Order received from channel" }],
  }));
}

/* ---------------------- STATE ---------------------- */
const PRIORITY_WEIGHT = { Critical: 100, High: 60, Medium: 30, Low: 10 };
const FLOW = ["New", "Allocated", "Picking", "Packing", "QC", "Dispatched"];

let state = null;
let seq = 0;
const uid = (p) => `${p}-${String(++seq).padStart(3, "0")}`;
function now() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function resetState(silent) {
  seq = 0;
  state = {
    products: seedProducts(),
    orders: seedOrders(),
    exceptions: [],
    decisions: [],
    activity: [],
    route: [],
    throughput: [4, 9, 7, 12, 15, 11, 18, 14],
    view: state ? state.view : "dashboard",
    filters: { inv: "", invStatus: "all", ord: "", ordStatus: "all", ordPriority: "all" },
    auto: false,
  };
  logAct("info", "Demo dataset loaded — 18 SKUs, 17 orders, 4 zones");
  if (!silent) toast("info", "Demo data reset to baseline.");
}

/* ---------------------- HELPERS ---------------------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const product = (sku) => state.products.find((p) => p.sku === sku);
const order = (id) => state.orders.find((o) => o.id === id);
const available = (p) => Math.max(0, p.stock - p.reserved - p.damaged);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function stockStatus(p) {
  const a = available(p);
  if (a <= 0) return { key: "out", label: "Out of Stock", cls: "b-bad" };
  if (p.stock <= p.reorderPoint) return { key: "low", label: "Low Stock", cls: "b-warn" };
  if (p.stock <= p.reorderPoint * 1.35) return { key: "watch", label: "Watch", cls: "b-info" };
  return { key: "ok", label: "Healthy", cls: "b-ok" };
}
function priorityBadge(p) {
  const cls = p === "Critical" ? "b-bad" : p === "High" ? "b-warn" : p === "Medium" ? "b-info" : "b-muted";
  return `<span class="badge ${cls}">${p}</span>`;
}
function statusBadge(s) {
  const map = { New: "b-muted", Allocated: "b-info", Picking: "b-info", Packing: "b-info", QC: "b-warn", Dispatched: "b-ok", Blocked: "b-bad" };
  return `<span class="badge ${map[s] || "b-muted"}">${s}</span>`;
}
function orderQty(o) { return o.items.reduce((s, i) => s + i.qty, 0); }
function orderAllocated(o) { return o.items.reduce((s, i) => s + i.allocated, 0); }
function orderBackordered(o) { return o.items.reduce((s, i) => s + i.backordered, 0); }
function orderValue(o) { return o.items.reduce((s, i) => s + i.qty * (product(i.sku)?.cost || 0), 0); }
function isAtRisk(o) {
  return o.status !== "Dispatched" && (orderBackordered(o) > 0 || state.exceptions.some((e) => e.orderId === o.id && e.status === "Open"));
}
function scoreOrder(o) {
  return PRIORITY_WEIGHT[o.priority] * 10 - o.slaHours * 2 + Math.min(orderValue(o) / 100, 40);
}
function logAct(kind, text) {
  state.activity.unshift({ kind, text, t: now() });
  state.activity = state.activity.slice(0, 60);
}

/* ---------------------- TOASTS + MODAL ---------------------- */
function toast(kind, msg) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = msg;
  $("#toasts").appendChild(el);
  setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translateX(20px)"; }, 3600);
  setTimeout(() => el.remove(), 4100);
}
function openModal(title, bodyHTML, buttons = []) {
  $("#modalTitle").textContent = title;
  $("#modalBody").innerHTML = bodyHTML;
  const foot = $("#modalFoot");
  foot.innerHTML = "";
  buttons.forEach((b) => {
    const btn = document.createElement("button");
    btn.className = `btn ${b.cls || ""}`;
    btn.textContent = b.label;
    btn.onclick = () => b.onClick && b.onClick();
    foot.appendChild(btn);
  });
  const close = document.createElement("button");
  close.className = "btn btn-ghost";
  close.textContent = "Close";
  close.onclick = closeModal;
  foot.appendChild(close);
  $("#modalBackdrop").classList.remove("hidden");
}
function closeModal() { $("#modalBackdrop").classList.add("hidden"); }

/* ---------------------- DECISION ENGINE ---------------------- */
function addDecision({ title, context, options, chosen, why, impact, orderId, excId }) {
  const d = { id: uid("DEC"), title, context, options, chosen, why, impact, orderId, excId, status: "Recommended", t: now() };
  state.decisions.unshift(d);
  return d;
}
function applyDecision(id) {
  const d = state.decisions.find((x) => x.id === id);
  if (!d || d.status === "Applied") return;
  d.status = "Applied";
  d.appliedAt = now();
  if (d.excId) {
    const e = state.exceptions.find((x) => x.id === d.excId);
    if (e && e.status === "Open") {
      e.status = "Resolved";
      e.resolution = d.chosen;
      e.resolvedAt = now();
      if (e.resolveFn) e.resolveFn();
      const o = order(e.orderId);
      if (o) o.log.push({ t: now(), text: `Exception resolved → ${d.chosen}` });
    }
  }
  logAct("ok", `Decision applied: ${d.chosen}`);
  toast("ok", `<b>Decision applied</b><br>${esc(d.chosen)}`);
  render();
}

/* -------- Smart priority + inventory allocation engine -------- */
function runAllocation(silentToast) {
  const queue = state.orders
    .filter((o) => o.status === "New" || o.status === "Allocated")
    .sort((a, b) => scoreOrder(b) - scoreOrder(a));

  let allocatedUnits = 0, shortUnits = 0, touched = 0;

  queue.forEach((o) => {
    let changed = false;
    o.items.forEach((it) => {
      const p = product(it.sku);
      const need = it.qty - it.allocated - it.backordered;
      if (need <= 0) return;
      const free = available(p);
      const give = Math.min(free, need);
      if (give > 0) {
        p.reserved += give;
        it.allocated += give;
        allocatedUnits += give;
        changed = true;
      }
      const short = need - give;
      if (short > 0) {
        it.backordered += short;
        shortUnits += short;
        changed = true;
        raiseShortageDecision(o, it, p, give, short);
      }
    });
    if (changed) {
      touched++;
      if (o.status === "New") o.status = "Allocated";
      o.log.push({ t: now(), text: `Allocation engine ran — ${orderAllocated(o)}/${orderQty(o)} units reserved` });
    }
  });

  logAct("info", `Allocation engine: ${allocatedUnits} units reserved across ${touched} orders, ${shortUnits} short`);
  if (!silentToast) {
    toast(shortUnits ? "warn" : "ok",
      `<b>Allocation engine complete</b><br>${allocatedUnits} units reserved · ${shortUnits} units backordered`);
  }
  render();
  return { allocatedUnits, shortUnits, touched };
}

function raiseShortageDecision(o, it, p, given, short) {
  const dup = state.decisions.find((d) => d.orderId === o.id && d.sku === it.sku && d.kind === "shortage" && d.status !== "Applied");
  if (dup) return;
  const competing = state.orders.filter(
    (x) => x.id !== o.id && x.status !== "Dispatched" && x.items.some((i) => i.sku === it.sku && i.allocated > 0)
  );
  const lower = competing.filter((x) => PRIORITY_WEIGHT[x.priority] < PRIORITY_WEIGHT[o.priority]);

  const e = raiseException({
    orderId: o.id,
    type: "Stock Shortage",
    severity: o.priority === "Critical" ? "Critical" : "High",
    detail: `${it.sku} — ${o.customer} requires ${it.qty}, only ${given} available at allocation time.`,
  });

  const options = [
    `Partial-ship ${given} now, backorder ${short} (chosen)`,
    lower.length ? `Reallocate ${short} from lower-priority orders (${lower.map((x) => x.id).join(", ")})` : "Hold entire order until replenishment",
    "Cancel line item and refund customer",
  ];

  const d = addDecision({
    title: `Shortage on ${it.sku} for ${o.id}`,
    context: `${o.priority} priority order · SLA ${o.slaHours}h · requested ${it.qty} units · available ${given}`,
    options,
    chosen: `Allocate ${given} units to ${o.id} now, mark ${short} units as backordered`,
    why:
      `${o.id} scores ${Math.round(scoreOrder(o))} on the priority index (${o.priority} weight ${PRIORITY_WEIGHT[o.priority]}, ` +
      `SLA ${o.slaHours}h, order value $${orderValue(o).toFixed(0)}). Partial shipment protects ${Math.round((given / it.qty) * 100)}% ` +
      `of the line immediately and keeps the SLA clock alive, while a full hold would breach it for 100% of units. ` +
      (lower.length
        ? `Reallocation from ${lower.map((x) => x.id).join(", ")} was rejected because it converts one late order into ${lower.length} late orders with no net SLA gain.`
        : `No lower-priority holder of ${it.sku} exists, so reallocation is not available.`) +
      ` Replenishment for ${it.sku} is triggered automatically (reorder point ${p.reorderPoint}).`,
    impact: `${given} units ship on time · ${short} units backordered · replenishment PO raised for ${it.sku}`,
    orderId: o.id,
    excId: e.id,
  });
  d.kind = "shortage";
  d.sku = it.sku;
  e.decisionId = d.id;
  e.resolveFn = () => {
    logAct("ok", `Backorder of ${short} × ${it.sku} scheduled for replenishment`);
  };
}

/* ---------------------- EXCEPTIONS ---------------------- */
function raiseException({ orderId, type, severity, detail }) {
  const e = { id: uid("EXC"), orderId, type, severity, detail, status: "Open", t: now(), decisionId: null };
  state.exceptions.unshift(e);
  const o = order(orderId);
  if (o) o.log.push({ t: now(), text: `Exception raised: ${type} — ${detail}` });
  logAct("bad", `${type} on ${orderId}`);
  return e;
}

function reportDamage(orderId, sku, qty) {
  const o = order(orderId), p = product(sku);
  if (!o || !p) return;
  const line = o.items.find((i) => i.sku === sku);
  qty = Math.max(1, line && line.allocated > 0 ? Math.min(qty, line.allocated) : Math.min(qty, p.stock));
  p.damaged += qty;
  p.stock = Math.max(0, p.stock - qty);
  p.reserved = Math.max(0, p.reserved - qty);
  if (line) line.allocated = Math.max(0, line.allocated - qty);

  const e = raiseException({
    orderId, type: "Damaged Item", severity: o.priority === "Critical" ? "Critical" : "High",
    detail: `${qty} × ${sku} damaged during handling at ${p.location}. Quarantined and removed from sellable stock.`,
  });

  const free = available(p);
  const canSwap = free >= qty;
  const d = addDecision({
    title: `Damaged stock on ${o.id}`,
    context: `${qty} × ${p.name} rejected at QC · ${o.priority} order · SLA ${o.slaHours}h`,
    options: [
      canSwap ? `Substitute ${qty} units from ${p.location.split("-")[0]}-zone buffer stock (chosen)` : `Split shipment: dispatch clean units now, backorder ${qty} (chosen)`,
      "Hold full shipment until replacement stock arrives",
      "Escalate to customer for approval before shipping",
    ],
    chosen: canSwap
      ? `Swap in ${qty} clean units from buffer stock and quarantine the damaged units`
      : `Split shipment — dispatch clean units now and backorder ${qty} damaged units`,
    why: canSwap
      ? `${free} sellable units of ${sku} remain in ${p.location}, which covers the ${qty} damaged units without touching any other order's reservation. Swapping keeps ${o.id} inside its ${o.slaHours}h SLA at zero SLA cost, versus a full hold that would breach it. Damaged units are quarantined so the cycle count stays accurate and a supplier claim can be filed.`
      : `Only ${free} sellable units of ${sku} remain, so a same-day swap is impossible. Splitting the shipment protects the units that are already picked and clean, which is better than holding 100% of the order for a partial defect. The ${qty} short units enter the backorder queue with priority ${o.priority}.`,
    impact: canSwap ? `SLA preserved · supplier claim filed · stock accuracy maintained` : `Partial dispatch on time · ${qty} units backordered`,
    orderId, excId: e.id,
  });
  e.decisionId = d.id;
  e.resolveFn = () => {
    if (canSwap && line) { p.reserved += qty; line.allocated += qty; }
    else if (line) { line.backordered += qty; }
  };
  toast("bad", `<b>Damaged item detected</b><br>${qty} × ${sku} on ${orderId}`);
  render();
}

function reportMissing(orderId, sku, qty) {
  const o = order(orderId), p = product(sku);
  if (!o || !p) return;
  const e = raiseException({
    orderId, type: "Missing Item", severity: "High",
    detail: `${qty} × ${sku} not found at ${p.location} during picking. System vs physical mismatch.`,
  });
  const d = addDecision({
    title: `Pick shortfall on ${o.id}`,
    context: `Picker could not locate ${qty} × ${p.name} at ${p.location}`,
    options: [
      `Trigger cycle count at ${p.location} and re-pick from alternate bin (chosen)`,
      "Mark line as lost and backorder immediately",
      "Pause the whole wave until inventory is audited",
    ],
    chosen: `Cycle count ${p.location}, correct system stock, re-pick from an alternate bin`,
    why: `A mismatch of ${qty} units is small relative to the ${p.stock} units on record, so the most likely cause is a misplaced bin rather than lost stock. Cycle counting one bin costs minutes; pausing the wave would idle every order in the zone. System stock is corrected immediately so the allocation engine stops over-promising ${sku}.`,
    impact: `Inventory record corrected · wave keeps moving · no SLA breach`,
    orderId, excId: e.id,
  });
  e.decisionId = d.id;
  e.resolveFn = () => {
    p.stock = Math.max(0, p.stock - qty);
    logAct("info", `Cycle count adjusted ${sku} by -${qty}`);
  };
  toast("warn", `<b>Missing item</b><br>${qty} × ${sku} at ${p.location}`);
  render();
}

function reportWrongItem(orderId, sku) {
  const o = order(orderId), p = product(sku);
  if (!o || !p) return;
  const e = raiseException({
    orderId, type: "Wrong Item Picked", severity: "Medium",
    detail: `Scan mismatch on ${o.id}: a neighbouring SKU was picked instead of ${sku} at ${p.location}.`,
  });
  const d = addDecision({
    title: `Wrong item picked on ${o.id}`,
    context: `Barcode scan mismatch caught before packing`,
    options: [
      "Return wrong SKU to bin, re-pick correct SKU, flag bin for relabelling (chosen)",
      "Ship as-is and issue a credit note",
      "Cancel the line",
    ],
    chosen: `Return the wrong SKU, re-pick ${sku}, and flag ${p.location} for relabelling`,
    why: `The error was caught at QC, before dispatch, so correcting it costs one pick cycle instead of a return shipment plus a credit note. Adjacent-bin confusion is a recurring cause in this aisle, so flagging the bin for relabelling prevents repeat exceptions rather than just fixing this one.`,
    impact: `Order accuracy preserved · root cause flagged · no customer-facing error`,
    orderId, excId: e.id,
  });
  e.decisionId = d.id;
  toast("warn", `<b>Wrong item picked</b><br>${o.id} — corrected at QC`);
  render();
}

/* ---------------------- WORKFLOW ---------------------- */
function advance(id) {
  const o = order(id);
  if (!o) return;
  const i = FLOW.indexOf(o.status);
  if (i < 0 || i >= FLOW.length - 1) return;
  const openExc = state.exceptions.some((e) => e.orderId === o.id && e.status === "Open");
  if (openExc && o.status !== "New") {
    toast("bad", `<b>${o.id} blocked</b><br>Resolve its open exception in the Decision Center first.`);
    return;
  }
  const next = FLOW[i + 1];
  if (next === "Picking") {
    buildRoute(o);
    o.items.forEach((it) => (it.picked = it.allocated));
  }
  if (next === "Dispatched") {
    o.items.forEach((it) => {
      const p = product(it.sku);
      const ship = Math.min(it.allocated, p.stock);
      p.stock -= ship;
      p.reserved = Math.max(0, p.reserved - ship);
    });
    state.throughput.push(state.throughput[state.throughput.length - 1] + 1);
    state.throughput = state.throughput.slice(-8);
  }
  o.status = next;
  o.log.push({ t: now(), text: `Moved to ${next}` });
  logAct(next === "Dispatched" ? "ok" : "info", `${o.id} → ${next}`);
  toast(next === "Dispatched" ? "ok" : "info", `<b>${o.id}</b> → ${next}`);
  render();
}

function buildRoute(o) {
  const locs = o.items.map((i) => product(i.sku)).filter(Boolean).map((p) => p.location);
  state.route = locs.sort((a, b) => a.localeCompare(b));
  state.routeOrder = o.id;
}

function autoRun() {
  if (state.auto) return;
  state.auto = true;
  $("#autoBtn").textContent = "⏳ Running…";
  runAllocation(true);
  let step = 0;
  const timer = setInterval(() => {
    const movable = state.orders
      .filter((o) => o.status !== "Dispatched" && !state.exceptions.some((e) => e.orderId === o.id && e.status === "Open"))
      .sort((a, b) => scoreOrder(b) - scoreOrder(a));
    if (!movable.length || step++ > 40) {
      clearInterval(timer);
      state.auto = false;
      $("#autoBtn").textContent = "▶ Auto-Run Fulfillment";
      toast("ok", "<b>Auto-run finished</b><br>All unblocked orders advanced.");
      render();
      return;
    }
    advance(movable[0].id);
  }, 550);
}

/* ---------------------- CRISIS SCENARIO ---------------------- */
function runCrisis() {
  const btn = $("#crisisBtn");
  btn.disabled = true;
  btn.textContent = "⚡ Crisis running…";
  const steps = [];

  steps.push(() => {
    resetState(true);
    go("dashboard");
    toast("info", "<b>Crisis simulation started</b><br>Emergency medical order inbound.");
    const p = product("SKU-1009");
    p.reserved = 0; p.damaged = 0; p.stock = 7; // only 7 sellable
    const p2 = product("SKU-1015");
    p2.reserved = 0; p2.damaged = 0; p2.stock = 60;
    const o = {
      id: "ORD-9001", customer: "St. Marien Emergency Hospital", priority: "Critical", slaHours: 2,
      status: "New",
      items: [{ sku: "SKU-1009", qty: 10, allocated: 0, backordered: 0, picked: 0 },
              { sku: "SKU-1015", qty: 6, allocated: 0, backordered: 0, picked: 0 }],
      log: [{ t: now(), text: "Emergency order received — 2h SLA" }],
    };
    state.orders.unshift(o);
    logAct("bad", "Emergency order ORD-9001 received: 10 × SKU-1009 needed, 7 sellable");
    render();
  });

  steps.push(() => { go("allocation"); toast("warn", "<b>Shortage detected</b><br>10 units needed, 7 available."); });

  steps.push(() => {
    runAllocation(true);
    toast("info", "<b>Smart allocation</b><br>7 allocated to ORD-9001, 3 backordered.");
    go("decisions");
  });

  steps.push(() => {
    state.decisions.filter((x) => x.orderId === "ORD-9001" && x.status !== "Applied").forEach((d) => applyDecision(d.id));
  });

  steps.push(() => { advance("ORD-9001"); go("picking"); });
  steps.push(() => { advance("ORD-9001"); });

  steps.push(() => {
    go("exceptions");
    reportDamage("ORD-9001", "SKU-1015", 2);
  });

  steps.push(() => {
    go("decisions");
    const d = state.decisions.find((x) => x.orderId === "ORD-9001" && x.title.startsWith("Damaged"));
    if (d) applyDecision(d.id);
  });

  steps.push(() => { go("packing"); advance("ORD-9001"); });
  steps.push(() => { advance("ORD-9001"); });
  steps.push(() => {
    advance("ORD-9001");
    go("dashboard");
    toast("ok", "<b>Crisis resolved</b><br>ORD-9001 dispatched within SLA. 3 units backordered with a replenishment PO.");
    btn.disabled = false;
    btn.textContent = "⚡ Run Warehouse Crisis";
  });

  steps.forEach((fn, i) => setTimeout(fn, i * 1350));
}

/* ---------------------- WHAT-IF SIMULATOR ---------------------- */
function whatIf(sku, newAvail) {
  const p = product(sku);
  if (!p) return "";
  const demand = state.orders
    .filter((o) => o.status !== "Dispatched")
    .map((o) => ({ o, need: o.items.filter((i) => i.sku === sku).reduce((s, i) => s + i.qty, 0) }))
    .filter((x) => x.need > 0)
    .sort((a, b) => scoreOrder(b.o) - scoreOrder(a.o));

  let pool = Math.max(0, newAvail);
  const rows = demand.map(({ o, need }) => {
    const give = Math.min(pool, need);
    pool -= give;
    const short = need - give;
    return `<tr>
      <td><b>${o.id}</b><div class="tiny">${esc(o.customer)}</div></td>
      <td>${priorityBadge(o.priority)}</td>
      <td class="mono">${need}</td>
      <td class="mono" style="color:#86efac">${give}</td>
      <td class="mono" style="color:${short ? "#fca5a5" : "var(--muted)"}">${short}</td>
      <td>${short === 0 ? '<span class="badge b-ok">Fully served</span>' : give ? '<span class="badge b-warn">Partial</span>' : '<span class="badge b-bad">Starved</span>'}</td>
    </tr>`;
  });

  const totalNeed = demand.reduce((s, x) => s + x.need, 0);
  const served = Math.min(totalNeed, Math.max(0, newAvail));
  const cover = totalNeed ? Math.round((served / totalNeed) * 100) : 100;
  const starved = demand.length - rows.filter((r) => r.includes("Fully served")).length;

  return `
    <div class="reco"><b>Simulation result:</b> with <b>${newAvail}</b> sellable units of ${sku}, the engine covers
      <b>${cover}%</b> of open demand (${served}/${totalNeed} units). ${starved} order(s) would be partially served or starved.
      Priority order is preserved: Critical and short-SLA orders consume the pool first.</div>
    <div class="bar"><div class="bar-fill ${cover > 85 ? "ok" : cover > 50 ? "warn" : "bad"}" style="width:${cover}%"></div></div>
    <div class="table-wrap"><table><thead><tr><th>Order</th><th>Priority</th><th>Needs</th><th>Would get</th><th>Short</th><th>Outcome</th></tr></thead>
    <tbody>${rows.join("") || '<tr><td colspan="6" class="tiny">No open demand for this SKU.</td></tr>'}</tbody></table></div>
    ${totalNeed > newAvail ? `<div class="why"><b>Recommended action:</b> raise a replenishment PO for ${totalNeed - newAvail} units of ${sku} (reorder point ${p.reorderPoint}), and partial-ship the highest-scoring orders now instead of holding the queue.</div>` : ""}
  `;
}

/* ---------------------- KPI CALC ---------------------- */
function kpis() {
  const open = state.orders.filter((o) => o.status !== "Dispatched");
  return {
    orders: open.length,
    dispatched: state.orders.filter((o) => o.status === "Dispatched").length,
    inventory: state.products.reduce((s, p) => s + p.stock, 0),
    atRisk: open.filter(isAtRisk).length,
    lowStock: state.products.filter((p) => ["low", "out"].includes(stockStatus(p).key)).length,
    picking: state.orders.filter((o) => o.status === "Picking").length,
    packing: state.orders.filter((o) => ["Packing", "QC"].includes(o.status)).length,
    openExc: state.exceptions.filter((e) => e.status === "Open").length,
  };
}
function health() {
  const k = kpis();
  const total = state.orders.length || 1;
  const score = Math.max(0, Math.min(100, Math.round(100 - (k.atRisk / total) * 120 - k.openExc * 6 - (k.lowStock / state.products.length) * 30)));
  return score;
}

/* ---------------------- RENDERERS ---------------------- */
function render() {
  const k = kpis();
  $("#navExcCount").textContent = k.openExc;
  $("#navExcCount").classList.toggle("hidden", k.openExc === 0);
  const h = health();
  $("#healthVal").textContent = h + "%";
  const hb = $("#healthBar");
  hb.style.width = h + "%";
  hb.className = "bar-fill " + (h > 75 ? "ok" : h > 45 ? "warn" : "bad");

  ({
    dashboard: renderDashboard, inventory: renderInventory, orders: renderOrders,
    allocation: renderAllocation, picking: renderPicking, packing: renderPacking,
    exceptions: renderExceptions, decisions: renderDecisions, analytics: renderAnalytics,
  })[state.view]();
}

function kpiCard(label, val, foot, color) {
  return `<div class="glass kpi" style="--k:${color}">
    <div class="label">${label}</div><div class="val">${val}</div><div class="foot">${foot}</div></div>`;
}

function renderDashboard() {
  const k = kpis();
  const wave = state.orders.filter((o) => o.status !== "Dispatched").sort((a, b) => scoreOrder(b) - scoreOrder(a)).slice(0, 6);
  $("#view-dashboard").innerHTML = `
    <div class="grid kpis">
      ${kpiCard("Open Orders", k.orders, `${k.dispatched} dispatched today`, "rgba(59,130,246,.5)")}
      ${kpiCard("Inventory Units", k.inventory.toLocaleString(), `${state.products.length} active SKUs`, "rgba(34,211,238,.45)")}
      ${kpiCard("At Risk", k.atRisk, `${k.openExc} open exceptions`, "rgba(239,68,68,.5)")}
      ${kpiCard("Low Stock", k.lowStock, "below reorder point", "rgba(245,179,1,.5)")}
      ${kpiCard("Picking", k.picking, "waves in progress", "rgba(139,92,246,.5)")}
      ${kpiCard("Pack &amp; Dispatch", k.packing, "at pack / QC stage", "rgba(34,197,94,.45)")}
    </div>

    <div class="grid g3">
      <div class="glass card" style="grid-column:span 2">
        <div class="card-head"><h3>Priority Wave</h3><span class="sub">ranked by the smart priority index</span>
          <div class="right"><button class="btn btn-sm btn-primary" data-act="alloc">Run Allocation</button></div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Order</th><th>Priority</th><th>SLA</th><th>Fill</th><th>Status</th><th>Score</th><th></th></tr></thead>
          <tbody>${wave.map((o) => {
            const fill = Math.round((orderAllocated(o) / orderQty(o)) * 100);
            return `<tr>
              <td><b>${o.id}</b><div class="tiny">${esc(o.customer)}</div></td>
              <td>${priorityBadge(o.priority)}</td>
              <td class="mono">${o.slaHours}h</td>
              <td style="min-width:110px"><div class="bar"><div class="bar-fill ${fill === 100 ? "ok" : fill ? "warn" : "bad"}" style="width:${fill}%"></div></div><div class="tiny">${fill}% allocated</div></td>
              <td>${statusBadge(o.status)}</td>
              <td class="mono">${Math.round(scoreOrder(o))}</td>
              <td><button class="btn btn-sm" data-order="${o.id}">View</button></td>
            </tr>`;
          }).join("")}</tbody></table></div>
      </div>

      <div class="glass card">
        <div class="card-head"><h3>Live Activity</h3></div>
        <div class="timeline">${state.activity.slice(0, 9).map((a) => `
          <div class="tl"><div class="node ${a.kind === "bad" ? "bad" : a.kind === "ok" ? "ok" : "info"}">•</div>
            <div><h4>${esc(a.text)}</h4><p>${a.t}</p></div></div>`).join("") || '<p class="tiny">No activity yet.</p>'}</div>
      </div>
    </div>

    <div class="grid g2">
      <div class="glass card">
        <div class="card-head"><h3>Warehouse Map</h3><span class="sub">${state.route.length ? `picking route for ${state.routeOrder}` : "no active route"}</span></div>
        ${renderMap()}
      </div>
      <div class="glass card">
        <div class="card-head"><h3>Exception Center</h3><span class="sub">Exception → Decision → Resolution</span></div>
        <div class="stack">${state.exceptions.slice(0, 3).map(excCard).join("") || '<p class="tiny">No exceptions. Warehouse is clean.</p>'}</div>
      </div>
    </div>`;
}

function renderMap() {
  const cells = {};
  state.products.forEach((p) => {
    const zone = p.location.split("-")[0] + "-" + p.location.split("-")[1];
    (cells[zone] = cells[zone] || []).push(p);
  });
  const routeZones = state.route.map((l) => l.split("-").slice(0, 2).join("-"));
  return `<div class="map">${Object.entries(cells).map(([zone, ps]) => {
    const idx = routeZones.indexOf(zone);
    const worst = ps.map(stockStatus).some((s) => s.key === "out") ? "out" : ps.map(stockStatus).some((s) => s.key === "low") ? "low" : "";
    return `<div class="cell ${idx >= 0 ? "route" : ""} ${worst}">
      ${idx >= 0 ? `<div class="seq">${idx + 1}</div>` : ""}
      <b>${zone}</b>
      <div class="tiny">${ps.length} SKU${ps.length > 1 ? "s" : ""}</div>
      <div class="tiny">${ps.reduce((s, p) => s + p.stock, 0)} units</div>
    </div>`;
  }).join("")}</div>
  <p class="tiny" style="margin-top:10px">Blue cells with a sequence number form the optimised pick path (zone-sorted to minimise travel). Amber/red borders flag low or out-of-stock bins.</p>`;
}

function renderInventory() {
  const f = state.filters;
  const list = state.products.filter((p) => {
    const q = f.inv.toLowerCase();
    const okQ = !q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q);
    const okS = f.invStatus === "all" || stockStatus(p).key === f.invStatus;
    return okQ && okS;
  });
  $("#view-inventory").innerHTML = `
    <div class="glass card">
      <div class="card-head"><h3>Inventory Management</h3><span class="sub">${list.length} of ${state.products.length} SKUs</span>
        <div class="right toolbar">
          <input type="text" id="invSearch" placeholder="Search SKU, name, category" value="${esc(f.inv)}" />
          <select id="invStatus">
            ${["all", "ok", "watch", "low", "out"].map((v) => `<option value="${v}" ${f.invStatus === v ? "selected" : ""}>${{ all: "All statuses", ok: "Healthy", watch: "Watch", low: "Low stock", out: "Out of stock" }[v]}</option>`).join("")}
          </select>
          <button class="btn btn-sm btn-primary" data-act="replenish">Replenish Low Stock</button>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>SKU</th><th>Product</th><th>Location</th><th>Stock</th><th>Reserved</th><th>Available</th><th>Reorder</th><th>Coverage</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.map((p) => {
          const s = stockStatus(p);
          const cov = Math.min(100, Math.round((p.stock / Math.max(1, p.reorderPoint * 2)) * 100));
          return `<tr>
            <td class="mono"><b>${p.sku}</b></td>
            <td>${esc(p.name)}<div class="tiny">${p.category} · $${p.cost.toFixed(2)}/unit</div></td>
            <td class="mono">${p.location}</td>
            <td class="mono">${p.stock}</td>
            <td class="mono">${p.reserved}</td>
            <td class="mono"><b>${available(p)}</b></td>
            <td class="mono">${p.reorderPoint}</td>
            <td style="min-width:100px"><div class="bar"><div class="bar-fill ${s.key === "ok" ? "ok" : s.key === "watch" ? "" : s.key === "low" ? "warn" : "bad"}" style="width:${cov}%"></div></div></td>
            <td><span class="badge ${s.cls}">${s.label}</span></td>
            <td><div class="row"><button class="btn btn-sm" data-sim="${p.sku}">What-If</button><button class="btn btn-sm" data-restock="${p.sku}">+50</button></div></td>
          </tr>`;
        }).join("") || '<tr><td colspan="10" class="tiny">No SKUs match this filter.</td></tr>'}</tbody></table></div>
    </div>`;
  $("#invSearch").oninput = (e) => { state.filters.inv = e.target.value; renderInventory(); $("#invSearch").focus(); };
  $("#invStatus").onchange = (e) => { state.filters.invStatus = e.target.value; renderInventory(); };
}

function renderOrders() {
  const f = state.filters;
  const list = state.orders.filter((o) => {
    const q = f.ord.toLowerCase();
    const okQ = !q || o.id.toLowerCase().includes(q) || o.customer.toLowerCase().includes(q);
    const okS = f.ordStatus === "all" || o.status === f.ordStatus;
    const okP = f.ordPriority === "all" || o.priority === f.ordPriority;
    return okQ && okS && okP;
  }).sort((a, b) => scoreOrder(b) - scoreOrder(a));

  $("#view-orders").innerHTML = `
    <div class="glass card">
      <div class="card-head"><h3>Order Management</h3><span class="sub">${list.length} orders · sorted by priority index</span>
        <div class="right toolbar">
          <input type="text" id="ordSearch" placeholder="Search order or customer" value="${esc(f.ord)}" />
          <select id="ordPriority">${["all", "Critical", "High", "Medium", "Low"].map((v) => `<option ${f.ordPriority === v ? "selected" : ""}>${v}</option>`).join("")}</select>
          <select id="ordStatus">${["all", ...FLOW].map((v) => `<option ${f.ordStatus === v ? "selected" : ""}>${v}</option>`).join("")}</select>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Order</th><th>Customer</th><th>Priority</th><th>SLA</th><th>Units</th><th>Value</th><th>Fill</th><th>Status</th><th>Risk</th><th></th></tr></thead>
        <tbody>${list.map((o) => {
          const fill = Math.round((orderAllocated(o) / orderQty(o)) * 100);
          return `<tr>
            <td class="mono"><b>${o.id}</b></td>
            <td>${esc(o.customer)}</td>
            <td>${priorityBadge(o.priority)}</td>
            <td class="mono">${o.slaHours}h</td>
            <td class="mono">${orderQty(o)}</td>
            <td class="mono">$${orderValue(o).toFixed(0)}</td>
            <td style="min-width:100px"><div class="bar"><div class="bar-fill ${fill === 100 ? "ok" : fill ? "warn" : "bad"}" style="width:${fill}%"></div></div><div class="tiny">${fill}%</div></td>
            <td>${statusBadge(o.status)}</td>
            <td>${isAtRisk(o) ? '<span class="badge b-bad">At risk</span>' : '<span class="badge b-ok">On track</span>'}</td>
            <td><div class="row">
              <button class="btn btn-sm" data-order="${o.id}">Details</button>
              ${o.status !== "Dispatched" ? `<button class="btn btn-sm btn-primary" data-advance="${o.id}">→ ${FLOW[FLOW.indexOf(o.status) + 1]}</button>` : ""}
            </div></td>
          </tr>`;
        }).join("") || '<tr><td colspan="10" class="tiny">No orders match this filter.</td></tr>'}</tbody></table></div>
    </div>`;
  $("#ordSearch").oninput = (e) => { state.filters.ord = e.target.value; renderOrders(); $("#ordSearch").focus(); };
  $("#ordStatus").onchange = (e) => { state.filters.ordStatus = e.target.value; renderOrders(); };
  $("#ordPriority").onchange = (e) => { state.filters.ordPriority = e.target.value; renderOrders(); };
}

function renderAllocation() {
  const pending = state.orders.filter((o) => o.status === "New" || o.status === "Allocated").sort((a, b) => scoreOrder(b) - scoreOrder(a));
  const shorts = state.orders.filter((o) => orderBackordered(o) > 0);
  $("#view-allocation").innerHTML = `
    <div class="grid g2">
      <div class="glass card">
        <div class="card-head"><h3>Smart Allocation Engine</h3><span class="sub">priority index × inventory availability</span>
          <div class="right"><button class="btn btn-sm btn-primary" data-act="alloc">Run Engine</button></div></div>
        <div class="why">Score = priority weight × 10 − SLA hours × 2 + capped order value. Stock is committed strictly in score order.
        When a line cannot be fully covered, the engine partial-allocates, backorders the remainder and writes a justified decision record instead of silently failing.</div>
        <div class="table-wrap" style="margin-top:12px"><table>
          <thead><tr><th>Rank</th><th>Order</th><th>Priority</th><th>Score</th><th>Requested</th><th>Allocated</th><th>Backorder</th></tr></thead>
          <tbody>${pending.map((o, i) => `<tr>
            <td class="mono">#${i + 1}</td>
            <td><b>${o.id}</b><div class="tiny">${esc(o.customer)}</div></td>
            <td>${priorityBadge(o.priority)}</td>
            <td class="mono">${Math.round(scoreOrder(o))}</td>
            <td class="mono">${orderQty(o)}</td>
            <td class="mono" style="color:#86efac">${orderAllocated(o)}</td>
            <td class="mono" style="color:${orderBackordered(o) ? "#fca5a5" : "var(--muted)"}">${orderBackordered(o)}</td>
          </tr>`).join("") || '<tr><td colspan="7" class="tiny">Allocation queue is empty.</td></tr>'}</tbody></table></div>
      </div>

      <div class="glass card">
        <div class="card-head"><h3>What-If Simulator</h3><span class="sub">stress-test a stock shortage</span></div>
        <div class="toolbar">
          <select id="simSku">${state.products.map((p) => `<option value="${p.sku}">${p.sku} — ${esc(p.name)}</option>`).join("")}</select>
          <input type="number" id="simQty" min="0" value="7" style="width:100px" />
          <button class="btn btn-sm btn-primary" id="simRun">Simulate</button>
        </div>
        <div id="simOut" class="stack" style="margin-top:12px"><p class="tiny">Pick a SKU and a hypothetical available quantity to see how the engine would split it across open demand.</p></div>
      </div>
    </div>

    <div class="glass card">
      <div class="card-head"><h3>Backorder Watchlist</h3><span class="sub">${shorts.length} orders with unfulfilled units</span></div>
      <div class="stack">${shorts.map((o) => `<div class="exc ${isAtRisk(o) ? "open" : "resolved"}">
        <div class="row"><b>${o.id}</b>${priorityBadge(o.priority)}<span class="tiny">${esc(o.customer)}</span>
          <span class="right badge b-warn">${orderBackordered(o)} units backordered</span></div>
        <div class="tiny" style="margin-top:6px">${o.items.filter((i) => i.backordered).map((i) => `${i.backordered} × ${i.sku}`).join(" · ")}</div>
      </div>`).join("") || '<p class="tiny">No backorders — every open line is fully covered.</p>'}</div>
    </div>`;
  $("#simRun").onclick = () => {
    const sku = $("#simSku").value, qty = parseInt($("#simQty").value || "0", 10);
    $("#simOut").innerHTML = whatIf(sku, qty);
  };
}

function renderPicking() {
  const picking = state.orders.filter((o) => o.status === "Picking");
  const ready = state.orders.filter((o) => o.status === "Allocated");
  $("#view-picking").innerHTML = `
    <div class="grid g2">
      <div class="glass card">
        <div class="card-head"><h3>Pick Waves</h3><span class="sub">${picking.length} active · ${ready.length} ready to release</span></div>
        <div class="stack">
          ${[...picking, ...ready].map((o) => `<div class="exc ${o.status === "Picking" ? "open" : ""}">
            <div class="row"><b>${o.id}</b>${priorityBadge(o.priority)}${statusBadge(o.status)}
              <span class="right row">
                <button class="btn btn-sm" data-route="${o.id}">Show Route</button>
                <button class="btn btn-sm btn-primary" data-advance="${o.id}">${o.status === "Allocated" ? "Release to Picking" : "Complete Pick"}</button>
              </span></div>
            <div class="tiny" style="margin-top:8px">${o.items.map((i) => `${product(i.sku).location} · ${i.allocated}/${i.qty} × ${i.sku}`).join(" &nbsp;|&nbsp; ")}</div>
            <div class="bar" style="margin-top:8px"><div class="bar-fill ${o.status === "Picking" ? "ok" : ""}" style="width:${Math.round((orderAllocated(o) / orderQty(o)) * 100)}%"></div></div>
            <div class="row" style="margin-top:9px">
              <button class="btn btn-sm" data-missing="${o.id}">Report Missing Item</button>
              <button class="btn btn-sm" data-wrong="${o.id}">Report Wrong Item</button>
            </div>
          </div>`).join("") || '<p class="tiny">No orders in the picking pipeline. Run the allocation engine first.</p>'}
        </div>
      </div>
      <div class="glass card">
        <div class="card-head"><h3>Warehouse Map &amp; Route</h3><span class="sub">${state.route.length ? state.routeOrder : "select an order"}</span></div>
        ${renderMap()}
        ${state.route.length ? `<div class="reco" style="margin-top:12px"><b>Optimised path:</b> ${state.route.join(" → ")} · estimated travel ${state.route.length * 34}m, saving roughly ${state.route.length * 12}m versus unsorted picking.</div>` : ""}
      </div>
    </div>`;
}

function renderPacking() {
  const packing = state.orders.filter((o) => ["Packing", "QC"].includes(o.status));
  const dispatched = state.orders.filter((o) => o.status === "Dispatched");
  $("#view-packing").innerHTML = `
    <div class="glass card">
      <div class="card-head"><h3>Packing, Quality Check &amp; Dispatch</h3><span class="sub">${packing.length} in station · ${dispatched.length} dispatched</span></div>
      <div class="stack">${packing.map((o) => `<div class="exc open">
        <div class="row"><b>${o.id}</b>${priorityBadge(o.priority)}${statusBadge(o.status)}<span class="tiny">${esc(o.customer)}</span>
          <span class="right row">
            <button class="btn btn-sm" data-damage="${o.id}">Fail QC — Damaged</button>
            <button class="btn btn-sm btn-ok" data-advance="${o.id}">${o.status === "Packing" ? "Send to QC" : "Pass QC &amp; Dispatch"}</button>
          </span></div>
        <div class="tiny" style="margin-top:8px">${o.items.map((i) => `${i.allocated} × ${i.sku}`).join(" · ")} — ${orderAllocated(o)} units, $${orderValue(o).toFixed(0)}</div>
      </div>`).join("") || '<p class="tiny">Packing station is empty.</p>'}</div>
    </div>

    <div class="glass card">
      <div class="card-head"><h3>Dispatched Today</h3></div>
      <div class="table-wrap"><table><thead><tr><th>Order</th><th>Customer</th><th>Priority</th><th>Units shipped</th><th>Backordered</th><th>Status</th></tr></thead>
      <tbody>${dispatched.map((o) => `<tr><td class="mono"><b>${o.id}</b></td><td>${esc(o.customer)}</td><td>${priorityBadge(o.priority)}</td>
        <td class="mono">${orderAllocated(o)}</td><td class="mono">${orderBackordered(o)}</td>
        <td><span class="badge b-ok">Dispatched ✓</span></td></tr>`).join("") || '<tr><td colspan="6" class="tiny">Nothing dispatched yet.</td></tr>'}</tbody></table></div>
    </div>`;
}

function excCard(e) {
  const d = state.decisions.find((x) => x.id === e.decisionId);
  return `<div class="exc ${e.status === "Open" ? "open" : "resolved"}">
    <div class="row"><b>${e.type}</b>
      <span class="badge ${e.severity === "Critical" ? "b-bad" : e.severity === "High" ? "b-warn" : "b-info"}">${e.severity}</span>
      <span class="badge ${e.status === "Open" ? "b-bad" : "b-ok"}">${e.status}</span>
      <span class="tiny right">${e.id} · ${e.orderId} · ${e.t}</span></div>
    <p class="tiny" style="margin-top:7px;line-height:1.55">${esc(e.detail)}</p>
    ${d ? `<div class="reco" style="margin-top:9px"><b>Recommended decision:</b> ${esc(d.chosen)}</div>` : ""}
    <div class="row" style="margin-top:9px">
      ${d ? `<button class="btn btn-sm" data-decision="${d.id}">Why this decision?</button>` : ""}
      ${e.status === "Open" && d ? `<button class="btn btn-sm btn-ok" data-apply="${d.id}">Apply &amp; Resolve</button>` : ""}
      ${e.status !== "Open" ? `<span class="tiny">Resolved at ${e.resolvedAt || e.t} — ${esc(e.resolution || "")}</span>` : ""}
    </div>
  </div>`;
}

function renderExceptions() {
  const open = state.exceptions.filter((e) => e.status === "Open");
  const closed = state.exceptions.filter((e) => e.status !== "Open");
  const candidates = state.orders.filter((o) => !["New", "Dispatched"].includes(o.status));
  $("#view-exceptions").innerHTML = `
    <div class="grid kpis" style="grid-template-columns:repeat(3,1fr)">
      ${kpiCard("Open Exceptions", open.length, "awaiting decision", "rgba(239,68,68,.5)")}
      ${kpiCard("Resolved", closed.length, "closed with a decision record", "rgba(34,197,94,.45)")}
      ${kpiCard("Mean Resolution", closed.length ? "1 cycle" : "—", "exception → decision → resolution", "rgba(59,130,246,.45)")}
    </div>
    <div class="glass card">
      <div class="card-head"><h3>Exception Center</h3><span class="sub">every problem follows Exception → Decision → Resolution</span>
        <div class="right toolbar">
          <select id="excOrder">${candidates.map((o) => `<option value="${o.id}">${o.id} — ${esc(o.customer)}</option>`).join("") || "<option>No eligible orders</option>"}</select>
          <button class="btn btn-sm" data-act="simDamage">Simulate Damage</button>
          <button class="btn btn-sm" data-act="simMissing">Simulate Missing</button>
          <button class="btn btn-sm" data-act="simWrong">Simulate Wrong Item</button>
        </div></div>
      <div class="stack">${open.map(excCard).join("") || '<p class="tiny">No open exceptions.</p>'}</div>
    </div>
    <div class="glass card">
      <div class="card-head"><h3>Resolution History</h3></div>
      <div class="stack">${closed.map(excCard).join("") || '<p class="tiny">Nothing resolved yet.</p>'}</div>
    </div>`;
}

function renderDecisions() {
  $("#view-decisions").innerHTML = `
    <div class="glass card">
      <div class="card-head"><h3>Decision Center</h3><span class="sub">${state.decisions.length} recommendations generated</span></div>
      <div class="stack">${state.decisions.map((d) => `<div class="exc ${d.status === "Applied" ? "resolved" : "open"}">
        <div class="row"><b>${esc(d.title)}</b>
          <span class="badge ${d.status === "Applied" ? "b-ok" : "b-warn"}">${d.status}</span>
          <span class="tiny right">${d.id} · ${d.t}</span></div>
        <p class="tiny" style="margin-top:6px">${esc(d.context)}</p>
        <div class="reco" style="margin-top:9px"><b>Recommendation:</b> ${esc(d.chosen)}</div>
        <div class="why" style="margin-top:9px"><b>Why:</b> ${esc(d.why)}</div>
        <div class="tiny" style="margin-top:7px"><b>Options considered:</b> ${d.options.map(esc).join(" · ")}</div>
        <div class="row" style="margin-top:9px">
          <span class="badge b-info">Impact: ${esc(d.impact)}</span>
          ${d.status !== "Applied" ? `<button class="btn btn-sm btn-ok right" data-apply="${d.id}">Apply Decision</button>` : `<span class="tiny right">Applied at ${d.appliedAt}</span>`}
        </div>
      </div>`).join("") || '<p class="tiny">No decisions yet — run the allocation engine or a crisis to generate recommendations.</p>'}</div>
    </div>`;
}

function renderAnalytics() {
  const stages = FLOW.map((s) => ({ s, n: state.orders.filter((o) => o.status === s).length }));
  const maxStage = Math.max(1, ...stages.map((x) => x.n));
  const maxT = Math.max(1, ...state.throughput);
  const bottleneck = stages.filter((x) => x.s !== "Dispatched").sort((a, b) => b.n - a.n)[0];
  const prio = ["Critical", "High", "Medium", "Low"].map((p) => ({ p, n: state.orders.filter((o) => o.priority === p).length }));
  const total = state.orders.length || 1;
  let acc = 0;
  const colors = { Critical: "#ef4444", High: "#f5b301", Medium: "#3b82f6", Low: "#64748b" };
  const segs = prio.map((x) => { const from = acc; acc += (x.n / total) * 360; return `${colors[x.p]} ${from}deg ${acc}deg`; }).join(",");
  const fillRate = Math.round((state.orders.reduce((s, o) => s + orderAllocated(o), 0) / Math.max(1, state.orders.reduce((s, o) => s + orderQty(o), 0))) * 100);
  const onTime = Math.max(0, 100 - state.orders.filter(isAtRisk).length * 6);

  $("#view-analytics").innerHTML = `
    <div class="grid kpis" style="grid-template-columns:repeat(4,1fr)">
      ${kpiCard("Order Fill Rate", fillRate + "%", "units allocated vs requested", "rgba(34,197,94,.45)")}
      ${kpiCard("On-Time Estimate", onTime + "%", "SLA projection", "rgba(59,130,246,.45)")}
      ${kpiCard("Exceptions", state.exceptions.length, `${state.exceptions.filter((e) => e.status !== "Open").length} resolved`, "rgba(239,68,68,.45)")}
      ${kpiCard("Inventory Value", "$" + state.products.reduce((s, p) => s + p.stock * p.cost, 0).toLocaleString(undefined, { maximumFractionDigits: 0 }), "on-hand valuation", "rgba(139,92,246,.45)")}
    </div>

    <div class="grid g2">
      <div class="glass card">
        <div class="card-head"><h3>Pipeline by Stage</h3><span class="sub">bottleneck detection</span></div>
        <div class="chart">${stages.map((x) => `<div class="col">
          <div class="stick" style="height:${(x.n / maxStage) * 100}%;${x.s === bottleneck.s && x.n > 1 ? "background:linear-gradient(180deg,#f87171,#ef4444)" : ""}"></div>
          <div class="lbl">${x.s}<br><b>${x.n}</b></div></div>`).join("")}</div>
        <div class="reco" style="margin-top:12px"><b>Bottleneck:</b> ${bottleneck && bottleneck.n > 1
          ? `the <b>${bottleneck.s}</b> stage holds ${bottleneck.n} orders — the largest queue in the pipeline. Recommendation: shift one operator from packing to ${bottleneck.s.toLowerCase()} and release the next wave in priority order.`
          : "no meaningful queue build-up detected. Flow is balanced across stages."}</div>
      </div>

      <div class="glass card">
        <div class="card-head"><h3>Throughput Trend</h3><span class="sub">orders dispatched per hour</span></div>
        <div class="chart">${state.throughput.map((v, i) => `<div class="col">
          <div class="stick" style="height:${(v / maxT) * 100}%"></div><div class="lbl">H${i + 1}<br><b>${v}</b></div></div>`).join("")}</div>
      </div>
    </div>

    <div class="grid g2">
      <div class="glass card">
        <div class="card-head"><h3>Order Priority Mix</h3></div>
        <div class="row" style="gap:24px;flex-wrap:wrap">
          <div class="donut" style="background:conic-gradient(${segs})"><div class="center"><b>${state.orders.length}</b><span class="tiny">orders</span></div></div>
          <div class="legend">${prio.map((x) => `<div><i style="background:${colors[x.p]}"></i>${x.p} — <b>${x.n}</b></div>`).join("")}</div>
        </div>
      </div>
      <div class="glass card">
        <div class="card-head"><h3>Top Stock Risks</h3></div>
        <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Available</th><th>Reorder</th><th>Status</th></tr></thead><tbody>
        ${state.products.slice().sort((a, b) => available(a) - available(b)).slice(0, 6).map((p) => {
          const s = stockStatus(p);
          return `<tr><td class="mono">${p.sku}<div class="tiny">${esc(p.name)}</div></td><td class="mono">${available(p)}</td><td class="mono">${p.reorderPoint}</td><td><span class="badge ${s.cls}">${s.label}</span></td></tr>`;
        }).join("")}</tbody></table></div>
      </div>
    </div>`;
}

/* ---------------------- ORDER DETAIL MODAL ---------------------- */
function showOrder(id) {
  const o = order(id);
  if (!o) return;
  const excs = state.exceptions.filter((e) => e.orderId === id);
  const body = `
    <div class="row">${priorityBadge(o.priority)}${statusBadge(o.status)}
      <span class="badge b-muted">SLA ${o.slaHours}h</span>
      <span class="badge b-info">$${orderValue(o).toFixed(0)}</span></div>
    <p class="tiny">${esc(o.customer)}</p>
    <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Location</th><th>Qty</th><th>Allocated</th><th>Backorder</th></tr></thead><tbody>
      ${o.items.map((i) => `<tr><td class="mono">${i.sku}<div class="tiny">${esc(product(i.sku).name)}</div></td>
        <td class="mono">${product(i.sku).location}</td><td class="mono">${i.qty}</td>
        <td class="mono" style="color:#86efac">${i.allocated}</td>
        <td class="mono" style="color:${i.backordered ? "#fca5a5" : "var(--muted)"}">${i.backordered}</td></tr>`).join("")}
    </tbody></table></div>
    ${excs.length ? `<h4 style="font-size:13px">Exceptions</h4><div class="stack">${excs.map(excCard).join("")}</div>` : ""}
    <h4 style="font-size:13px">Order timeline</h4>
    <div class="timeline">${o.log.slice().reverse().map((l) => `<div class="tl"><div class="node info">•</div><div><h4>${esc(l.text)}</h4><p>${l.t}</p></div></div>`).join("")}</div>`;
  const btns = [];
  if (o.status !== "Dispatched") btns.push({ label: `Advance to ${FLOW[FLOW.indexOf(o.status) + 1]}`, cls: "btn-primary", onClick: () => { advance(o.id); showOrder(o.id); } });
  openModal(`${o.id} — ${o.customer}`, body, btns);
}

function showDecision(id) {
  const d = state.decisions.find((x) => x.id === id);
  if (!d) return;
  openModal(d.title, `
    <p class="tiny">${esc(d.context)}</p>
    <div class="reco"><b>Selected:</b> ${esc(d.chosen)}</div>
    <div class="why"><b>Why this decision:</b><br>${esc(d.why)}</div>
    <h4 style="font-size:13px">Options evaluated</h4>
    <div class="stack">${d.options.map((op, i) => `<div class="exc ${i === 0 ? "resolved" : ""}"><div class="row"><span>${esc(op)}</span>${i === 0 ? '<span class="badge b-ok right">Chosen</span>' : '<span class="badge b-muted right">Rejected</span>'}</div></div>`).join("")}</div>
    <div class="badge b-info">Impact: ${esc(d.impact)}</div>`,
    d.status !== "Applied" ? [{ label: "Apply Decision", cls: "btn-ok", onClick: () => { applyDecision(d.id); closeModal(); } }] : []);
}

/* ---------------------- NAV + EVENTS ---------------------- */
const TITLES = {
  dashboard: ["Dashboard", "Live operations overview"],
  inventory: ["Inventory", "Stock, reservations and reorder health"],
  orders: ["Orders", "Priority-ranked order book"],
  allocation: ["Allocation", "Smart allocation engine and what-if simulator"],
  picking: ["Picking", "Waves, routes and warehouse map"],
  packing: ["Packing", "Pack, quality check and dispatch"],
  exceptions: ["Exceptions", "Exception → Decision → Resolution"],
  decisions: ["Decisions", "Recommendations with full reasoning"],
  analytics: ["Analytics", "Throughput, fill rate and bottlenecks"],
};
function go(view) {
  state.view = view;
  $$(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  $$(".view").forEach((v) => v.classList.toggle("hidden", v.id !== "view-" + view));
  $("#viewTitle").textContent = TITLES[view][0];
  $("#viewSub").textContent = TITLES[view][1];
  $("#sidebar").classList.remove("open");
  render();
}

function init() {
  resetState(true);
  $("#nav").addEventListener("click", (e) => {
    const b = e.target.closest(".nav-item");
    if (b) go(b.dataset.view);
  });
  $("#menuBtn").onclick = () => $("#sidebar").classList.toggle("open");
  $("#crisisBtn").onclick = runCrisis;
  $("#autoBtn").onclick = autoRun;
  $("#resetBtn").onclick = () => { resetState(); go("dashboard"); };
  $("#modalClose").onclick = closeModal;
  $("#modalBackdrop").addEventListener("click", (e) => { if (e.target.id === "modalBackdrop") closeModal(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

  document.addEventListener("click", (e) => {
    const t = e.target.closest("[data-order],[data-advance],[data-apply],[data-decision],[data-act],[data-sim],[data-restock],[data-route],[data-damage],[data-missing],[data-wrong]");
    if (!t) return;
    const d = t.dataset;
    if (d.order) return showOrder(d.order);
    if (d.advance) return advance(d.advance);
    if (d.apply) return applyDecision(d.apply);
    if (d.decision) return showDecision(d.decision);
    if (d.route) { buildRoute(order(d.route)); toast("info", `<b>Route generated</b><br>${state.route.length} stops for ${d.route}`); return render(); }
    if (d.restock) {
      const p = product(d.restock); p.stock += 50;
      logAct("ok", `Replenished ${p.sku} by 50 units`);
      toast("ok", `<b>${p.sku}</b> replenished +50 units`);
      return render();
    }
    if (d.sim) {
      openModal(`What-If — ${d.sim}`, `<div class="toolbar"><label class="tiny">Hypothetical available units</label>
        <input type="number" id="mSim" value="${available(product(d.sim))}" min="0" style="width:110px" />
        <button class="btn btn-sm btn-primary" id="mSimRun">Simulate</button></div><div id="mSimOut" class="stack"></div>`);
      $("#mSimRun").onclick = () => { $("#mSimOut").innerHTML = whatIf(d.sim, parseInt($("#mSim").value || "0", 10)); };
      $("#mSimRun").click();
      return;
    }
    if (d.damage) {
      const o = order(d.damage);
      const line = o.items.find((i) => i.allocated > 0) || o.items[0];
      return reportDamage(o.id, line.sku, Math.max(1, Math.min(2, line.allocated || 1)));
    }
    if (d.missing) {
      const o = order(d.missing);
      return reportMissing(o.id, o.items[0].sku, 2);
    }
    if (d.wrong) {
      const o = order(d.wrong);
      return reportWrongItem(o.id, o.items[0].sku);
    }
    if (d.act === "alloc") return runAllocation();
    if (d.act === "replenish") {
      let n = 0;
      state.products.forEach((p) => { if (["low", "out"].includes(stockStatus(p).key)) { p.stock += p.reorderPoint; n++; } });
      logAct("ok", `Replenishment PO raised for ${n} SKUs`);
      toast(n ? "ok" : "info", n ? `<b>Replenished ${n} SKUs</b> to above reorder point` : "No SKUs below reorder point.");
      return render();
    }
    if (d.act && d.act.startsWith("sim")) {
      const sel = $("#excOrder");
      const id = sel && sel.value;
      const o = order(id);
      if (!o) return toast("warn", "No eligible order — advance an order past <b>New</b> first.");
      const line = o.items.find((i) => i.allocated > 0) || o.items[0];
      if (d.act === "simDamage") return reportDamage(o.id, line.sku, 2);
      if (d.act === "simMissing") return reportMissing(o.id, line.sku, 2);
      if (d.act === "simWrong") return reportWrongItem(o.id, line.sku);
    }
  });

  setInterval(() => { $("#clock").textContent = now(); }, 1000);
  $("#clock").textContent = now();
  go("dashboard");
}
document.addEventListener("DOMContentLoaded", init);
