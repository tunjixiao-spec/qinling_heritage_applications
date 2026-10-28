const DATA_FILES = {
  plan: "./data/route_plan.json",
  route: "./data/route.geojson",
  boundary: "./data/boundary.geojson",
  windows: "./data/windows.geojson",
  segments: "./data/segments.geojson",
  points: "./data/points.geojson",
};

const state = {
  plan: null,
  route: null,
  boundary: null,
  windows: null,
  segments: null,
  points: null,
  map: null,
  layers: {},
};

async function fetchJson(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path} 读取失败：HTTP ${response.status}`);
  return response.json();
}

async function init() {
  try {
    const [plan, route, boundary, windows, segments, points] = await Promise.all([
      fetchJson(DATA_FILES.plan),
      fetchJson(DATA_FILES.route),
      fetchJson(DATA_FILES.boundary),
      fetchJson(DATA_FILES.windows),
      fetchJson(DATA_FILES.segments),
      fetchJson(DATA_FILES.points),
    ]);
    Object.assign(state, { plan, route, boundary, windows, segments, points });
    renderOverview();
    renderRouteSections();
    renderSources();
    renderCommunityMatrix();
    renderScript();
    initMap();
    document.body.dataset.ready = "true";
  } catch (error) {
    document.body.innerHTML = `<main class="app-shell"><section class="panel"><h1>路线数据读取失败</h1><p>${escapeHtml(error.message)}</p><p>请确认 data/route_plan.json、route.geojson 与相关 GeoJSON 已上传。</p></section></main>`;
  }
}

function renderOverview() {
  document.getElementById("planningPrinciple").textContent = state.plan.planning_principle;
  const evidence = state.plan.selection_evidence || {};
  const chips = [
    `秦岭 mountain_JSD ${formatNumber(evidence.C_mountain_JSD)}`,
    `CB mountain_JSD ${formatNumber(evidence.CB_mountain_JSD)}`,
    `可靠覆盖 ${formatPercent(evidence.reliable_coverage_ratio)}`,
    `可靠窗口 ${evidence.n_reliable_windows}/${evidence.n_windows}`,
    `选用窗口 ${evidence.selected_windows.length} 个`,
  ];
  document.getElementById("evidenceChips").innerHTML = chips.map(text => `<span class="chip">${escapeHtml(text)}</span>`).join("");
}

function initMap() {
  const map = L.map("map", { preferCanvas: true }).setView([34, 107], 7);
  const base = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: '&copy; OpenStreetMap',
  }).addTo(map);

  state.layers.windows = L.geoJSON(state.windows, {
    style: feature => ({
      color: feature.properties?.reliable_window ? "#d0a049" : "#b8c8d6",
      weight: feature.properties?.reliable_window ? 5 : 3,
      opacity: feature.properties?.reliable_window ? 0.68 : 0.22,
      lineCap: "round",
    }),
    onEachFeature: bindWindowPopup,
  }).addTo(map);

  state.layers.segments = L.geoJSON(state.segments, {
    style: { color: "#f2b84b", weight: 9, opacity: 0.90, lineCap: "round" },
    onEachFeature: bindSegmentPopup,
  }).addTo(map);

  state.layers.boundary = L.geoJSON(state.boundary, {
    style: { color: "#18364d", weight: 3, opacity: 0.82, dashArray: "8 5" },
  }).addTo(map);

  state.layers.points = L.geoJSON(state.points, {
    pointToLayer: (feature, latlng) => {
      const side = feature.properties?.side;
      return L.circleMarker(latlng, {
        radius: 3.7,
        color: "#fff",
        weight: 0.6,
        fillColor: side === "A" ? "#1e5d86" : side === "B" ? "#bd7b25" : "#8ba0b2",
        fillOpacity: 0.58,
      });
    },
    onEachFeature: bindPointPopup,
  }).addTo(map);

  const coverageAreas = {
    type: "FeatureCollection",
    features: state.route.features.filter(feature => feature.geometry?.type === "Polygon"),
  };
  const routeLines = {
    type: "FeatureCollection",
    features: state.route.features.filter(feature => feature.geometry?.type === "LineString"),
  };
  const routeStops = {
    type: "FeatureCollection",
    features: state.route.features.filter(feature => feature.geometry?.type === "Point"),
  };

  state.layers.coverageAreas = L.geoJSON(coverageAreas, {
    style: { color: "#982d39", weight: 1.4, opacity: 0.8, fillColor: "#982d39", fillOpacity: 0.08 },
  }).addTo(map);

  state.layers.routeLines = L.geoJSON(routeLines, {
    style: { color: "#982d39", weight: 6, opacity: 0.95, lineCap: "round" },
    onEachFeature: bindRouteLinePopup,
  }).addTo(map);

  state.layers.routeStops = L.geoJSON(routeStops, {
    pointToLayer: (feature, latlng) => {
      const type = feature.properties?.stop_type;
      const color = type === "沿线解释节点" ? "#982d39"
        : type === "文化遗址/古道资料点" ? "#2c7a62"
        : feature.properties?.side === "A" ? "#1e5d86" : "#bd7b25";
      return L.circleMarker(latlng, {
        radius: type === "沿线解释节点" ? 8 : type === "文化遗址/古道资料点" ? 7 : 6.5,
        color: "#fff",
        weight: 2,
        fillColor: color,
        fillOpacity: 0.96,
      });
    },
    onEachFeature: bindStopPopup,
  }).addTo(map);

  L.control.layers(
    { OpenStreetMap: base },
    {
      "路线观察范围": state.layers.coverageAreas,
      "研学观察顺序": state.layers.routeLines,
      "研学观察节点": state.layers.routeStops,
      "选用观察窗口": state.layers.segments,
      "JSD 移动窗口": state.layers.windows,
      "秦岭参考线": state.layers.boundary,
      "村镇地名点": state.layers.points,
    },
    { collapsed: false }
  ).addTo(map);

  state.map = map;
  renderStopPanel(routeStops.features);
  renderLegend();
  renderMiniRouteMaps();
  fitAll();
}

function fitAll() {
  const layers = [
    ...state.layers.points.getLayers(),
    ...state.layers.routeLines.getLayers(),
    ...state.layers.coverageAreas.getLayers(),
    ...state.layers.routeStops.getLayers(),
    ...state.layers.segments.getLayers(),
    ...state.layers.boundary.getLayers(),
  ];
  const group = L.featureGroup(layers);
  const bounds = group.getBounds();
  if (bounds.isValid()) state.map.fitBounds(bounds.pad(0.15));
}

function renderLegend() {
  const items = [
    ["路线观察范围", "rgba(152,45,57,0.22)", "line"],
    ["研学观察顺序", "#982d39", "line"],
    ["选用观察窗口", "#f2b84b", "line"],
    ["秦岭线", "#18364d", "line"],
    ["A侧地名点（" + state.plan.selection_evidence.point_display.A.toLocaleString() + "）", "#1e5d86", "dot"],
    ["B侧地名点（" + state.plan.selection_evidence.point_display.B.toLocaleString() + "）", "#bd7b25", "dot"],
    ["沿线资料核查节点", "#982d39", "dot"],
  ];
  document.getElementById("legend").innerHTML = items.map(([label, color, type]) => `
    <span class="legend-item"><span class="${type === "dot" ? "swatch-dot" : "swatch-line"}" style="background:${color}"></span>${label}</span>
  `).join("");
}

function routeStopsBySection(sectionNo) {
  return state.route.features.filter(feature =>
    feature.geometry?.type === "Point"
    && Number(feature.properties?.section_no) === Number(sectionNo)
  );
}

function routeLineBySection(sectionNo) {
  return state.route.features.find(feature =>
    feature.geometry?.type === "LineString"
    && Number(feature.properties?.section_no) === Number(sectionNo)
  );
}

function coverageBySection(sectionNo) {
  return state.route.features.find(feature =>
    feature.geometry?.type === "Polygon"
    && Number(feature.properties?.section_no) === Number(sectionNo)
  );
}

function renderMiniRouteMaps() {
  state.plan.route_sections.forEach(section => {
    const mapId = `routeMiniMap-${section.section_no}`;
    const el = document.getElementById(mapId);
    if (!el || el.dataset.ready === "1") return;

    const mini = L.map(mapId, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      scrollWheelZoom: false,
    }).setView([34, 107], 7);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
    }).addTo(mini);

    const layers = [];
    const coverage = coverageBySection(section.section_no);
    const routeLine = routeLineBySection(section.section_no);
    const stops = routeStopsBySection(section.section_no);

    if (coverage) {
      layers.push(L.geoJSON(coverage, {
        style: { color: "#982d39", weight: 1.2, opacity: 0.75, fillColor: "#982d39", fillOpacity: 0.10 },
      }).addTo(mini));
    }

    if (routeLine) {
      layers.push(L.geoJSON(routeLine, {
        style: { color: "#982d39", weight: 5, opacity: 0.95, lineCap: "round" },
      }).addTo(mini));
    }

    if (stops.length) {
      layers.push(L.geoJSON({ type: "FeatureCollection", features: stops }, {
        pointToLayer: (feature, latlng) => {
          const type = feature.properties?.stop_type;
          const color = type === "文化遗址/古道资料点" ? "#2c7a62"
            : type === "沿线解释节点" ? "#982d39"
            : feature.properties?.side === "A" ? "#1e5d86" : "#bd7b25";
          return L.circleMarker(latlng, {
            radius: type === "文化遗址/古道资料点" ? 6 : 6.8,
            color: "#fff",
            weight: 1.6,
            fillColor: color,
            fillOpacity: 0.96,
          });
        },
        onEachFeature: bindStopPopup,
      }).addTo(mini));
    }

    if (layers.length) {
      const group = L.featureGroup(layers);
      const bounds = group.getBounds();
      if (bounds.isValid()) mini.fitBounds(bounds.pad(0.15));
    }

    el.dataset.ready = "1";
  });
}

function renderStopPanel(stops) {
  document.getElementById("stopPanel").innerHTML = stops.map(feature => {
    const p = feature.properties || {};
    return `
      <div class="stop-card">
        <strong>${escapeHtml(p.stop_id)} ${escapeHtml(p.title)}</strong>
        <p>${escapeHtml(p.route_task || "")}</p>
        <p>地名：${escapeHtml(p.raw_name || "参考线资料核查节点")}；社区：${escapeHtml(p.community_id || p.top_community || "待现场核查")}；语义类型：待人工核验</p>
      </div>
    `;
  }).join("");
}

function renderRouteSections() {
  document.getElementById("routeSections").innerHTML = state.plan.route_sections.map(section => `
    <div class="route-card route-story-card">
      <div class="route-story-map" id="routeMiniMap-${section.section_no}"></div>
      <div class="route-story-content">
        <div class="route-kicker">Route ${section.section_no} · ${escapeHtml(section.coverage_label || "秦岭研学覆盖区")}</div>
        <h3>${escapeHtml(section.title)}</h3>
        <p class="route-subtitle">${escapeHtml(section.subtitle || section.route_value)}</p>
        <div class="route-stats">
          <span>station_km ${formatNumber(section.station_range[0], 0)}-${formatNumber(section.station_range[1], 0)}</span>
          <span>覆盖长度 ${formatNumber(section.length_km, 0)} km</span>
          <span>窗口 JSD ${formatNumber(section.local_JSD)}</span>
          <span>A/B 社区 ${escapeHtml(section.dominant_A_mode || "—")} / ${escapeHtml(section.dominant_B_mode || "—")}</span>
        </div>
        <p class="route-value">${escapeHtml(section.route_value)}</p>
        <div class="route-story-columns">
          <div>
            <strong>文化遗址与资料线索</strong>
            <ul class="task-list">
              ${(section.heritage_sites || []).map(site => `
                <li><b>${escapeHtml(site.name)}</b>：${escapeHtml(site.site_type)}。${escapeHtml(site.description)}</li>
              `).join("")}
            </ul>
          </div>
          <div>
            <strong>研学项目设计</strong>
            <ul class="task-list">
              ${(section.route_projects || []).map(project => `<li>${escapeHtml(project)}</li>`).join("")}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderSources() {
  document.getElementById("sourceCards").innerHTML = state.plan.cultural_sources.map(source => `
    <div class="source-card">
      <strong>${escapeHtml(source.title)}</strong>
      <p>${escapeHtml(source.summary)}</p>
      <p>路线用途：${escapeHtml(source.route_use)}</p>
      <p><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener">查看资料来源</a></p>
    </div>
  `).join("");
}

function renderCommunityMatrix() {
  document.getElementById("communityMatrix").innerHTML = state.plan.route_sections.map(section => {
    const sides = section.side_summaries || {};
    const sideBlocks = Object.entries(sides).map(([side, data]) => `
      <div class="community-side">
        <strong>${escapeHtml(data.side_label || side)}：${escapeHtml(side)}</strong>
        <p>有效来源：${escapeHtml(data.n_sources || 0)} 条</p>
        <p>主要社区：${renderTags(data.top_communities)}</p>
        <p>语义类型：${renderTags([{name: data.semantic_status, share: null}])}</p>
        <p>大类特征：${renderTags([{name: "文化大类待核验", share: null}])}</p>
        <p>实际特征字命中率：${renderTags(data.top_features)}</p>
      </div>
    `).join("");
    return `
      <div class="community-card">
        <div>
          <strong>${escapeHtml(section.title)}</strong>
          <p>窗口 JSD：${formatNumber(section.local_JSD)}；CB 窗口JSD：${formatNumber(section.CB_local_JSD)}</p>
        </div>
        ${sideBlocks}
      </div>
    `;
  }).join("");
}

function renderTags(items) {
  if (!items || !items.length) return '<span class="tag">—</span>';
  return `<span class="tag-list">${items.slice(0, 6).map(item => `<span class="tag">${escapeHtml(item.name)}${item.share == null ? "" : " " + formatPercent(item.share)}</span>`).join("")}</span>`;
}

function renderScript() {
  document.getElementById("scriptBox").innerHTML = state.plan.script_paragraphs.map(escapeHtml).join("<br><br>");
}

function bindStopPopup(feature, layer) {
  const p = feature.properties || {};
  layer.bindPopup(`
    <div class="popup">
      <strong>${escapeHtml(p.stop_id)} ${escapeHtml(p.title)}</strong>
      <div>${escapeHtml(p.route_task || "")}</div>
      <div>地名：${escapeHtml(p.raw_name || "参考线资料核查节点")}</div>
      <div>地名主体：${escapeHtml(p.name_body || "资料待核查")}</div>
      <div>特征字：${escapeHtml(p.features || "资料待核查")}</div>
      <div>位置：具体地名原始坐标或参考线节点</div>
      <div>语义类型：待人工核验</div>
      <div>社区：${escapeHtml(p.community_id || p.top_community || "待现场核查")}</div>
    </div>
  `);
}

function bindRouteLinePopup(feature, layer) {
  const p = feature.properties || {};
  layer.bindPopup(`
    <div class="popup">
      <strong>${escapeHtml(p.title || "研学观察顺序")}</strong>
      <div>对应窗口：${escapeHtml(p.window_id || "—")}</div>
      <div>station_km：${formatNumber(p.start_km, 0)}-${formatNumber(p.end_km, 0)}</div>
      <div>窗口 JSD：${formatNumber(p.local_JSD)}</div>
      <div>说明：路线用于研学观察，不等同于道路导航。</div>
    </div>
  `);
}

function bindSegmentPopup(feature, layer) {
  const p = feature.properties || {};
  layer.bindPopup(`
    <div class="popup">
      <strong>选用观察窗口 #${escapeHtml(p.window_id ?? "—")}</strong>
      <div>station_km：${formatNumber(p.start_km, 0)}-${formatNumber(p.end_km, 0)}</div>
      <div>长度：${formatNumber((p.end_km-p.start_km), 0)} km</div>
      <div>窗口 JSD：${formatNumber(p.local_JSD)}</div>
      <div>A/B 优势社区：${escapeHtml(p.dominant_A_mode || "—")} / ${escapeHtml(p.dominant_B_mode || "—")}</div>
    </div>
  `);
}

function bindWindowPopup(feature, layer) {
  const p = feature.properties || {};
  layer.bindPopup(`
    <div class="popup">
      <strong>选线窗口 #${escapeHtml(p.window_id ?? "—")}</strong>
      <div>station_km：${formatNumber(p.start_km, 0)}-${formatNumber(p.end_km, 0)}</div>
      <div>窗口 JSD：${formatNumber(p.local_JSD)}</div>
      <div>来源与几何合格窗口：${p.reliable_window ? "是" : "否"}</div>
    </div>
  `);
}

function bindPointPopup(feature, layer) {
  const p = feature.properties || {};
  layer.bindPopup(`
    <div class="popup">
      <strong>${escapeHtml(p.raw_name)}</strong>
      <div>完整地名：${escapeHtml(p.full_name)}</div>
      <div>地名主体：${escapeHtml(p.name_body)}</div>
      <div>实际特征字：${escapeHtml(p.features)}</div>
      <div>社区质量：${p.community_memberships.map(g => escapeHtml(g.community_id) + " " + formatPercent(g.mass)).join("；")}</div>
      <div>语义状态：${escapeHtml(p.semantic_status)}</div>
      <div>side：${escapeHtml(p.side)}；所属可靠窗口：${p.window_ids.length}个</div>
      <div>位置：该地名来源记录的原始坐标。</div>
    </div>
  `);
}

function formatNumber(value, digits = 4) {
  if (value == null) return "NA";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return num.toFixed(digits);
}

function formatPercent(value) {
  if (value == null) return "NA";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `${(num * 100).toFixed(1)}%`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

init();
