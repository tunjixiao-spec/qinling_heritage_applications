'use strict';
const DATA_FILES={plan:'./data/route_plan.json',route:'./data/route.geojson',boundary:'./data/boundary.geojson',windows:'./data/windows.geojson',segments:'./data/segments.geojson',points:'./data/points.geojson'};
const state={map:null,layers:{},miniMaps:[]};
const formatNumber=(v,d=4)=>v==null||!Number.isFinite(Number(v))?'NA':Number(v).toFixed(d);
const formatPercent=v=>v==null||!Number.isFinite(Number(v))?'NA':(Number(v)*100).toFixed(1)+'%';
const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'","&#39;");
async function fetchJson(path){const r=await fetch(path);if(!r.ok)throw Error('Input unavailable: '+path);return r.json()}
async function init(){
 try{
  const keys=Object.keys(DATA_FILES),values=await Promise.all(keys.map(k=>fetchJson(DATA_FILES[k])));keys.forEach((k,i)=>state[k]=values[i]);
  renderOverview();renderRouteSections();renderSources();renderCommunityMatrix();renderScript();initMap();
  document.body.dataset.ready='true';
 }catch(error){console.error(error);document.querySelector('.lead-panel').innerHTML='<div><h2>成果数据暂未读取成功</h2><p>请稍后刷新页面重试。</p></div>'}
}
function renderOverview(){
 document.getElementById('planningPrinciple').textContent=state.plan.planning_principle;
 const e=state.plan.selection_evidence,items=['C 山脉JSD '+formatNumber(e.C_mountain_JSD),'CB 山脉JSD '+formatNumber(e.CB_mountain_JSD),'可靠窗口 '+e.n_reliable_windows+'/'+e.n_windows,'可靠覆盖 '+formatPercent(e.reliable_coverage_ratio),'每侧宽度 '+state.plan.primary_side_width_km+'km'];
 document.getElementById('evidenceChips').innerHTML=items.map(s=>'<span class="chip">'+escapeHtml(s)+'</span>').join('');
}
function bindPopup(feature,layer){
 const p=feature.properties||{};let title=p.title||'秦岭成果',lines=[];
 if(p.stop_id){title=p.stop_id+' '+p.title;lines=[p.route_task,p.n_sources?'观察格网：'+p.n_sources+'条来源':'参考线上的资料核查节点',p.top_features?'当前窗口特征：'+p.top_features:'具体地形、古道和参访位置待核查']}
 else if(p.coordinate_role==='aggregate_cell_center'){title=p.side+'侧20km观察格网';lines=['对应窗口 '+p.window_id,p.n_sources+'条有效来源','主要社区 '+p.top_community+' · '+formatPercent(p.top_share),'格网内命中：'+p.features,'格网中心表示聚合位置，不是村庄点位。']}
 else if(p.geometry_role==='observation_sequence_not_road'){lines=['对应窗口 '+p.window_id,'参考里程 '+formatNumber(p.start_km,0)+'—'+formatNumber(p.end_km,0)+'km','C 窗口JSD '+formatNumber(p.local_JSD),'连线表示观察顺序，不表示道路。']}
 else if(p.window_id!=null){title=(p.geometry_role==='selected_window_not_significant_segment'?'选用观察窗口 #':'移动窗口 #')+p.window_id;lines=['参考里程 '+formatNumber(p.start_km,0)+'—'+formatNumber(p.end_km,0)+'km','C 窗口JSD '+formatNumber(p.local_JSD),p.reliable_window===false?'NA：未达到当前几何或来源资格':'观察资格以冻结窗口记录为准']}
 else if(p.geometry_role==='bounding_box_of_displayed_cells_not_sample_support_polygon'){lines=['公开格网的包围范围示意，不代表完整抽样支持区域。']}
 layer.bindPopup('<div class="popup"><strong>'+escapeHtml(title)+'</strong>'+lines.filter(Boolean).map(s=>'<div>'+escapeHtml(s)+'</div>').join('')+'</div>');
}
function baseMap(id,mini=false){
 const map=L.map(id,{preferCanvas:true,zoomControl:!mini,attributionControl:!mini,scrollWheelZoom:!mini}).setView([34,107],7);
 L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
 return map;
}
const pick=features=>({type:'FeatureCollection',features});
function geo(data,options={}){return L.geoJSON(data,{onEachFeature:bindPopup,...options})}
function pointStyle(feature){return {radius:3.7,color:'#fff',weight:.6,fillColor:feature.properties.side==='A'?'#1e5d86':'#bd7b25',fillOpacity:.65}}
function stopStyle(feature){return {radius:feature.properties.stop_type==='沿线解释节点'?8:6.5,color:'#fff',weight:2,fillColor:feature.properties.stop_type==='沿线解释节点'?'#982d39':feature.properties.side==='A'?'#1e5d86':'#bd7b25',fillOpacity:.96}}
function initMap(){
 const map=baseMap('map');state.map=map;
 state.layers.windows=geo(state.windows,{style:f=>({color:f.properties.reliable_window?'#d0a049':'#b8c8d6',weight:f.properties.reliable_window?4:2,opacity:f.properties.reliable_window?.4:.22})}).addTo(map);
 state.layers.segments=geo(state.segments,{style:{color:'#f2b84b',weight:9,opacity:.9,lineCap:'round'}}).addTo(map);
 state.layers.boundary=geo(state.boundary,{style:{color:'#18364d',weight:3,opacity:.82,dashArray:'8 5'}}).addTo(map);
 state.layers.points=geo(state.points,{pointToLayer:(f,c)=>L.circleMarker(c,pointStyle(f))}).addTo(map);
 state.layers.coverageAreas=geo(pick(state.route.features.filter(f=>f.geometry.type==='Polygon')),{style:{color:'#982d39',weight:1.4,opacity:.8,fillColor:'#982d39',fillOpacity:.06}}).addTo(map);
 state.layers.routeLines=geo(pick(state.route.features.filter(f=>f.geometry.type==='LineString')),{style:{color:'#982d39',weight:6,opacity:.95,lineCap:'round'}}).addTo(map);
 state.layers.routeStops=geo(pick(state.route.features.filter(f=>f.geometry.type==='Point')),{pointToLayer:(f,c)=>L.circleMarker(c,stopStyle(f))}).addTo(map);
 L.control.layers({}, {'观察格网范围示意':state.layers.coverageAreas,'研学观察顺序':state.layers.routeLines,'研学观察节点':state.layers.routeStops,'选用观察窗口':state.layers.segments,'全部34个移动窗口':state.layers.windows,'秦岭参考线':state.layers.boundary,'两侧20km观察格网':state.layers.points},{collapsed:false}).addTo(map);
 renderStopPanel();renderLegend();renderMiniRouteMaps();
 const bounds=state.layers.boundary.getBounds();if(bounds.isValid())map.fitBounds(bounds.pad(.15));
}
function renderLegend(){
 const items=[['格网范围示意','rgba(152,45,57,.22)','line'],['观察顺序','#982d39','line'],['选用窗口','#f2b84b','line'],['秦岭参考线','#18364d','line'],['A侧20km格网','#1e5d86','dot'],['B侧20km格网','#bd7b25','dot'],['沿线资料核查节点','#982d39','dot']];
 document.getElementById('legend').innerHTML=items.map(([s,c,t])=>'<span class="legend-item"><span class="'+(t==='dot'?'swatch-dot':'swatch-line')+'" style="background:'+c+'"></span>'+escapeHtml(s)+'</span>').join('');
}
function renderStopPanel(){
 document.getElementById('stopPanel').innerHTML=state.route.features.filter(f=>f.geometry.type==='Point').map(f=>{const p=f.properties;return '<div class="stop-card"><strong>'+escapeHtml(p.stop_id+' '+p.title)+'</strong><p>'+escapeHtml(p.route_task)+'</p><p>'+escapeHtml(p.n_sources?'20km格网：'+p.n_sources+'条有效来源；当前窗口特征：'+p.top_features:'在冻结参考线上组织资料核查，具体参访位置待确认。')+'</p></div>'}).join('');
}
function renderRouteSections(){
 document.getElementById('routeSections').innerHTML=state.plan.route_sections.map(s=>`
 <div class="route-card route-story-card"><div class="route-story-map" id="routeMiniMap-${s.section_no}"></div><div class="route-story-content">
 <div class="route-kicker">Route ${s.section_no} · ${escapeHtml(s.coverage_label)}</div><h3>${escapeHtml(s.title)}</h3><p class="route-subtitle">${escapeHtml(s.subtitle)}</p>
 <div class="route-stats"><span>窗口 ${s.window_id}</span><span>C JSD ${formatNumber(s.local_JSD)}</span><span>CB JSD ${formatNumber(s.CB_local_JSD)}</span><span>A/B 来源 ${s.n_effective_A} / ${s.n_effective_B}</span></div>
 <p class="route-value">${escapeHtml(s.route_value)}</p><div class="route-story-columns"><div><strong>文化遗址与资料线索</strong><ul class="task-list">${s.heritage_sites.map(t=>'<li><b>'+escapeHtml(t.name)+'</b>：'+escapeHtml(t.site_type)+'。'+escapeHtml(t.description)+'</li>').join('')}</ul></div><div><strong>研学项目设计</strong><ul class="task-list">${s.route_projects.map(t=>'<li>'+escapeHtml(t)+'</li>').join('')}</ul></div></div>
 <p>50种子范围：${formatNumber(s.seed_min_JSD)}—${formatNumber(s.seed_max_JSD)}；属于算法变化范围。</p><p><a href="${escapeHtml(s.full_result_url)}" target="_blank" rel="noopener">查看此窗口的完整成果 ↗</a></p>
 </div></div>`).join('');
}
function renderMiniRouteMaps(){
 for(const s of state.plan.route_sections){
  const mini=baseMap('routeMiniMap-'+s.section_no,true),items=state.route.features.filter(f=>f.properties.section_no===s.section_no),layers=[];
  const area=geo(pick(items.filter(f=>f.geometry.type==='Polygon')),{style:{color:'#982d39',weight:1.2,opacity:.75,fillOpacity:.07}}).addTo(mini);layers.push(area);
  geo(pick(state.segments.features.filter(f=>f.properties.window_id===s.window_id)),{style:{color:'#f2b84b',weight:8,opacity:.8}}).addTo(mini);
  geo(pick(state.points.features.filter(f=>f.properties.section_no===s.section_no)),{pointToLayer:(f,c)=>L.circleMarker(c,pointStyle(f))}).addTo(mini);
  geo(pick(items.filter(f=>f.geometry.type==='LineString')),{style:{color:'#982d39',weight:5,opacity:.95}}).addTo(mini);
  const stops=geo(pick(items.filter(f=>f.geometry.type==='Point')),{pointToLayer:(f,c)=>L.circleMarker(c,stopStyle(f))}).addTo(mini);layers.push(stops);
  const bounds=L.featureGroup(layers).getBounds();if(bounds.isValid())mini.fitBounds(bounds.pad(.15));
  state.miniMaps.push(mini);
 }
}
function renderSources(){
 document.getElementById('sourceCards').innerHTML=state.plan.cultural_sources.map(s=>'<div class="source-card"><strong>'+escapeHtml(s.title)+'</strong><p>'+escapeHtml(s.summary)+'</p><p>路线用途：'+escapeHtml(s.route_use)+'</p><p><a href="'+escapeHtml(s.url)+'" target="_blank" rel="noopener">查看资料来源</a></p></div>').join('');
}
function renderTags(items,counts=false){return '<span class="tag-list">'+items.slice(0,6).map(x=>'<span class="tag">'+escapeHtml(x.name)+' '+formatPercent(x.share)+(counts?'（'+x.count+'）':'')+'</span>').join('')+'</span>'}
function renderCommunityMatrix(){
 document.getElementById('communityMatrix').innerHTML=state.plan.route_sections.map(s=>'<div class="community-card"><div><strong>'+escapeHtml(s.title)+'</strong><p>C 窗口JSD：'+formatNumber(s.local_JSD)+'；CB：'+formatNumber(s.CB_local_JSD)+'</p><p>窗口 '+s.window_id+'，参考里程 '+formatNumber(s.station_range[0],0)+'—'+formatNumber(s.station_range[1],0)+'km。</p></div>'+['A','B'].map(side=>{const d=s.side_summaries[side];return '<div class="community-side"><strong>'+escapeHtml(d.side_label)+'</strong><p>有效来源：'+d.n_sources+'条；显示格网：'+d.n_cells+'个。</p><p>主要社区质量比例：'+renderTags(d.top_communities)+'</p><p>实际特征字来源命中率：'+renderTags(d.top_features,true)+'</p><p>语义类型：'+escapeHtml(d.semantic_status)+'。</p><p>格网未单列来源：'+d.suppressed_sources+'条，仍计入窗口统计。</p></div>'}).join('')+'</div>').join('');
}
function renderScript(){document.getElementById('scriptBox').innerHTML=state.plan.script_paragraphs.map(p=>'<p>'+escapeHtml(p)+'</p>').join('')}
init();

