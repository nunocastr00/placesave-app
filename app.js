/**
 * PlaceSave - UI Premium Refinada (Black, Typography-centric, Text Cards)
 */

const MOCK_PLACES = [
  { id: '1', name: 'A Tasca do Zé', category: 'Tasco', city: 'Lisboa', country: 'Portugal', description: 'Comida de tacho autêntica, vinho da casa servido em jarro e ambiente bairrista.', what_they_sell: 'Bacalhau, pregos, vinho', price_range: '€', price_description: 'Pratos a 8€', tags: ['tradicional', 'barato'], opening_hours: 'Seg-Sáb 12h-23h', website: null, rating: 4.8, lat: 38.718, lon: -9.145, created_at: 1001 },
  { id: '2', name: 'JNcQUOI Avenida', category: 'Chique', city: 'Lisboa', country: 'Portugal', description: 'Restaurante luxuoso no coração da Avenida da Liberdade, com dinossauro à escala real.', what_they_sell: 'Alta cozinha, cocktails', price_range: '€€€€', price_description: 'Pratos acima de 35€', tags: ['luxo', 'exclusivo'], opening_hours: 'Seg-Dom 12h-00h', website: 'https://www.jncquoi.com', rating: 4.5, lat: 38.721, lon: -9.145, created_at: 1002 },
  { id: '3', name: 'Livraria Bertrand', category: 'Shop', city: 'Lisboa', country: 'Portugal', description: 'A livraria mais antiga do mundo em funcionamento.', what_they_sell: 'Livros, artigos', price_range: '€€', price_description: 'Normal', tags: ['livros', 'história'], opening_hours: 'Seg-Dom 09h-22h', website: 'https://www.bertrand.pt', rating: 4.7, lat: 38.710, lon: -9.140, created_at: 1003 }
];

let places = JSON.parse(localStorage.getItem('placesave_data')) || MOCK_PLACES;
let mapInstance = null;
let mapMarkers = [];
let activeCategoryFilter = null;
let userLocation = null; 
let sortByDistance = false;

// Emojis Premium para Categorias, INCLUINDO TASCO E CHIQUE
const CAT_EMOJIS = {
  'All': '📚', 'Restaurant': '🍽️', 'Café': '☕', 'Bar': '🍸', 
  'Tasco': '🍷', 'Chique': '✨', 'Museum': '🏛️', 'Hotel': '🏨', 'Shop': '🛍️', 'Park': '🌳', 'Other': '📍'
};

function init() {
  saveData();
  setupEvents();
  renderCategoryFilters();
  renderList();
  
  const swCode = `
    const CACHE = "placesave-v1";
    self.addEventListener("install", e => e.waitUntil(caches.open(CACHE).then(c => c.addAll(["/", "/index.html", "/app.js", "/manifest.json", "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"]))));
    self.addEventListener("fetch", e => e.respondWith(caches.match(e.request).then(r => r || fetch(e.request))));
  `;
  const blob = new Blob([swCode], {type: "application/javascript"});
  if('serviceWorker' in navigator) navigator.serviceWorker.register(URL.createObjectURL(blob));
}

function saveData() { localStorage.setItem('placesave_data', JSON.stringify(places)); }

const showToast = (msg, type = 'error', duration = 3000) => {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast show ${type}`;
  if(duration) setTimeout(() => t.className = 'toast', duration);
};

const getStars = (rating) => {
  if(!rating) return '';
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  return '★'.repeat(full) + (half ? '⯪' : '') + '☆'.repeat(5 - full - half);
};

function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; const dLat = (lat2 - lat1) * Math.PI / 180; const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); return R * c; 
}
function formatDistance(dist) { return dist < 1 ? (dist * 1000).toFixed(0) + ' m' : dist.toFixed(1) + ' km'; }

window.exportBackup = () => {
  const dataStr = JSON.stringify(places, null, 2);
  const url = URL.createObjectURL(new Blob([dataStr], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = `library_backup.json`; a.click();
  URL.revokeObjectURL(url); showToast('Backup exportado!', 'loading');
};

async function fetchPlaceData(query) {
  showToast(`A pesquisar '${query}'...`, 'loading', 0);
  try {
    const GEMINI_API_KEY = AIzaSyBqYOg46E1_TeH2ggkn7RZHiBvwCTeVFIc;
    const prompt = `Pesquisa informação sobre este lugar: "${query}"\n\nResponde APENAS com um objeto JSON válido, sem texto antes ou depois, sem backticks.\nFormato exato:\n{\n  "name": "nome oficial do lugar",\n  "category": "Restaurant | Café | Bar | Museum | Hotel | Shop | Park | Tasco | Chique | Other",\n  "city": "cidade",\n  "country": "país",\n  "description": "1-2 frases descritivas sobre o lugar",\n  "what_they_sell": "descrição curta do que vendem/oferecem (comida, produtos, experiência)",\n  "price_range": "€ | €€ | €€€ | €€€€",\n  "price_description": "ex: pratos entre 8€-15€ | entrada gratuita | produtos a partir de 20€",\n  "tags": ["tag1", "tag2", "tag3"],\n  "opening_hours": "ex: Seg-Sex 12h-23h, Sab-Dom 10h-24h | Desconhecido",\n  "website": "URL oficial ou null",\n  "rating": número de 1 a 5,\n  "nominatim_query": "query otimizada para pesquisar este lugar na API Nominatim"\n}`;

    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 1024 }
      })
    });
    if(!geminiRes.ok) throw new Error('Erro na API do Gemini');

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates[0].content.parts[0].text.trim();
    // Remove eventuais backticks de markdown que o Gemini possa incluir
    const cleanText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    let placeData = JSON.parse(cleanText);

    const nomRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(placeData.nominatim_query)}&format=json&limit=1`);
    const nomData = await nomRes.json();
    if(nomData && nomData.length > 0) { placeData.lat = parseFloat(nomData[0].lat); placeData.lon = parseFloat(nomData[0].lon); }

    placeData.id = Date.now().toString(); placeData.created_at = Date.now();
    places.unshift(placeData); saveData(); renderList(); if(mapInstance) renderMap();
    
    document.getElementById('toast').className = 'toast';
    document.getElementById('modal-add').classList.remove('open');
    document.getElementById('input-place-name').value = '';
  } catch (error) { showToast(error.message, 'error'); }
}

// Filtros de Topo (Adicionado Tasco e Chique)
function renderCategoryFilters() {
  const cats = ['All', 'Tasco', 'Chique', 'Restaurant', 'Café', 'Bar', 'Museum', 'Shop', 'Hotel', 'Park'];
  const cont = document.getElementById('category-filters');
  cont.innerHTML = cats.map(c => `
    <div class="cat-block ${activeCategoryFilter===c || (c==='All' && !activeCategoryFilter) ? 'active' : ''}" onclick="setFilter('${c}')">
      <div class="cat-icon-bg">${CAT_EMOJIS[c] || '📍'}</div>
      <span>${c}</span>
    </div>
  `).join('');
}

window.setFilter = (cat) => {
  activeCategoryFilter = cat === 'All' ? null : cat;
  renderCategoryFilters(); renderList(); if(mapInstance) renderMap();
};

function renderList(filterQuery = '') {
  const container = document.getElementById('places-list');
  const empty = document.getElementById('empty-state');
  container.innerHTML = '';
  
  const q = filterQuery.toLowerCase();
  let filtered = places.filter(p => 
    (!activeCategoryFilter || p.category === activeCategoryFilter) &&
    (p.name.toLowerCase().includes(q) || p.city.toLowerCase().includes(q) || p.tags.some(t => t.toLowerCase().includes(q)))
  );

  if (sortByDistance && userLocation) {
    filtered.forEach(p => p._distance = (p.lat && p.lon) ? calculateDistance(userLocation.lat, userLocation.lon, p.lat, p.lon) : Infinity);
    filtered.sort((a, b) => a._distance - b._distance);
  }

  if(filtered.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    filtered.forEach(p => {
      const emoji = CAT_EMOJIS[p.category] || '📍';
      let locDisplay = sortByDistance && userLocation && p._distance !== Infinity ? `📍 ${formatDistance(p._distance)}` : p.city;

      // Cartões Minimalistas Tipo Widget
      const html = `
        <div class="card-wrapper" data-id="${p.id}">
          <div class="delete-btn-bg"><i class="ti ti-trash"></i></div>
          <div class="place-card">
            
            <div class="card-header-top">
              <span class="card-cat"><i>${emoji}</i> ${p.category}</span>
            </div>
            
            <div style="margin-top: 16px;">
              <h3 class="card-title serif">${p.name}</h3>
              <div class="card-desc">${p.description}</div>
            </div>
            
            <div class="card-footer">
              <span>${locDisplay}</span>
              <span>${p.price_range}</span>
            </div>
            
          </div>
        </div>
      `;
      container.insertAdjacentHTML('beforeend', html);
    });
  }
}

window.sharePlace = async (id) => {
  const p = places.find(x => x.id === id); if (!p) return;
  if (navigator.share) {
    try { await navigator.share({ title: p.name, text: `${CAT_EMOJIS[p.category]} ${p.name}\n${p.description}\n\n📍 ${p.city}`, url: p.website || (p.lat ? `https://maps.apple.com/?q=${p.lat},${p.lon}` : window.location.href) }); } 
    catch (err) {}
  } else showToast('Partilha não suportada.', 'error');
};

function renderDetail(id) {
  const p = places.find(x => x.id === id); if(!p) return;
  const emoji = CAT_EMOJIS[p.category] || '📍';

  const content = document.getElementById('detail-content');
  content.innerHTML = `
    <div class="sheet-handle"></div>
    
    <div class="detail-body">
      <div style="margin-bottom:24px;">
        <span style="font-size:40px; line-height:1; display:block; margin-bottom:12px;">${emoji}</span>
        <h2 class="serif" style="font-size:32px; line-height:1.1; margin-bottom:8px;">${p.name}</h2>
        <div style="color:var(--muted); font-size:15px;">${p.city}, ${p.country}</div>
      </div>
      
      <div style="display:flex; gap:8px; margin-bottom: 24px; flex-wrap:wrap;">
        <span class="pill">${p.category}</span>
        <span class="pill">${p.price_range}</span>
        ${p.rating ? `<span class="pill" style="color:#FFD60A;">${getStars(p.rating)}</span>` : ''}
      </div>
      
      <p style="font-size:16px; line-height:1.5; margin-bottom:24px; color:rgba(255,255,255,0.9);">${p.description}</p>
      
      <div style="background:var(--surface-light); border-radius:16px; padding:16px; margin-bottom:24px; border: 1px solid rgba(255,255,255,0.05);">
        <div style="margin-bottom:12px; font-size:14px;"><strong style="color:white; display:block; margin-bottom:2px;">O que oferecem:</strong> ${p.what_they_sell}</div>
        <div style="margin-bottom:12px; font-size:14px;"><strong style="color:white; display:block; margin-bottom:2px;">Preço:</strong> ${p.price_description}</div>
        <div style="font-size:14px;"><strong style="color:white; display:block; margin-bottom:2px;">Horário:</strong> ${p.opening_hours}</div>
      </div>
      
      <div style="display: flex; gap: 12px; margin-bottom: 12px;">
        <button class="btn btn-secondary" onclick="sharePlace('${p.id}')" style="flex: 1;"><i class="ti ti-share"></i> Partilhar</button>
        ${p.lat ? `<button class="btn btn-primary" onclick="window.open('https://maps.apple.com/?daddr=${p.lat},${p.lon}')" style="flex: 1;"><i class="ti ti-navigation"></i> Direções</button>` : ''}
      </div>
      
      ${p.website ? `<button class="btn btn-secondary" onclick="window.open('${p.website}', '_blank')"><i class="ti ti-world"></i> Website</button>` : ''}
      
      <button class="btn btn-danger" onclick="deletePlace('${p.id}')"><i class="ti ti-trash"></i> Apagar Lugar</button>
    </div>
  `;
  document.getElementById('modal-detail').classList.add('open');
}

function deletePlace(id) {
  places = places.filter(p => p.id !== id); saveData(); renderList();
  if(mapInstance) renderMap(); document.getElementById('modal-detail').classList.remove('open');
}

function initMap() {
  if(mapInstance) { mapInstance.invalidateSize(); return; }
  mapInstance = L.map('map-container', {zoomControl: false}).setView([38.722, -9.139], 13);
  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '' }).addTo(mapInstance);
  renderMap();
}

function renderMap() {
  if(!mapInstance) return;
  mapMarkers.forEach(m => mapInstance.removeLayer(m)); mapMarkers = [];
  const toShow = activeCategoryFilter ? places.filter(p => p.category === activeCategoryFilter) : places;
  const bounds = [];

  toShow.forEach(p => {
    if(p.lat && p.lon) {
      const emoji = CAT_EMOJIS[p.category] || '📍';
      const markerHtml = `<div style="background:var(--primary); color:black; width:28px; height:28px; border-radius:14px; display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:0 4px 8px rgba(0,0,0,0.5);">${emoji}</div>`;
      const icon = L.divIcon({ html: markerHtml, className: 'custom-pin', iconSize: [28,28], iconAnchor: [14,14] });
      const m = L.marker([p.lat, p.lon], {icon}).on('click', () => renderDetail(p.id)).addTo(mapInstance);
      mapMarkers.push(m); bounds.push([p.lat, p.lon]);
    }
  });
  if(bounds.length > 0) mapInstance.fitBounds(bounds, {padding: [40, 40]});
}

function renderStats() {
  const container = document.getElementById('stats-view');
  container.innerHTML = `
    <div style="background:var(--surface-light); border-radius:24px; padding:24px; text-align:center; margin-bottom:16px;">
      <h2 class="serif" style="font-size:48px; margin-bottom:4px;">${places.length}</h2>
      <div class="muted">Lugares Guardados</div>
    </div>
    
    <div style="background:var(--surface-light); border-radius:24px; padding:24px;">
      <h3 class="serif" style="margin-bottom:16px; font-size:22px;">Cópia de Segurança</h3>
      <p class="muted" style="font-size:14px; margin-bottom:20px; line-height: 1.4;">Protege a tua biblioteca. Exporta um ficheiro JSON para os Ficheiros do iPhone.</p>
      <button class="btn btn-primary" onclick="exportBackup()" style="margin-bottom:12px;"><i class="ti ti-download"></i> Exportar Dados</button>
      <button class="btn btn-secondary" onclick="document.getElementById('backup-input').click()"><i class="ti ti-upload"></i> Importar Dados</button>
    </div>
  `;
}

function setupEvents() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const target = btn.closest('.tab-btn'); target.classList.add('active');
      document.getElementById(`tab-${target.dataset.tab}`).classList.add('active');
      document.getElementById('search-container').style.display = target.dataset.tab === 'list' ? 'flex' : 'none';
      document.getElementById('category-filters').style.display = target.dataset.tab === 'list' ? 'flex' : 'none';
      document.getElementById('header-title').textContent = target.dataset.tab === 'list' ? 'Library' : (target.dataset.tab === 'map' ? 'Map' : 'Settings');
      if(target.dataset.tab === 'map') setTimeout(initMap, 100);
      if(target.dataset.tab === 'stats') renderStats();
    });
  });

  document.getElementById('btn-sort-dist').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    if (!sortByDistance) {
      if (!navigator.geolocation) { showToast('Geolocalização não suportada.', 'error'); return; }
      showToast('A obter localização...', 'loading', 0);
      navigator.geolocation.getCurrentPosition(
        pos => {
          userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude }; sortByDistance = true;
          btn.classList.add('active'); btn.innerHTML = '<i class="ti ti-x"></i> Limpar';
          document.getElementById('toast').className = 'toast'; renderList(document.getElementById('search-input').value);
        },
        err => {
          document.getElementById('toast').className = 'toast';
          const msgs = { 1: 'Permissão de localização negada.', 2: 'Localização indisponível.', 3: 'Tempo esgotado a obter localização.' };
          showToast(msgs[err.code] || 'Erro ao obter localização.', 'error');
        },
        { timeout: 10000, maximumAge: 60000, enableHighAccuracy: false }
      );
    } else { sortByDistance = false; userLocation = null; btn.classList.remove('active'); btn.innerHTML = '<i class="ti ti-location"></i> Distância'; renderList(); }
  });

  document.getElementById('fab-add').addEventListener('click', () => document.getElementById('modal-add').classList.add('open'));
  document.querySelectorAll('.overlay').forEach(overlay => { overlay.addEventListener('click', (e) => { if(e.target === overlay) overlay.classList.remove('open'); }); });
  document.getElementById('btn-cancel-add').addEventListener('click', () => document.getElementById('modal-add').classList.remove('open'));
  document.getElementById('btn-save').addEventListener('click', () => { const val = document.getElementById('input-place-name').value.trim(); if(val) fetchPlaceData(val); });
  document.getElementById('search-input').addEventListener('input', (e) => renderList(e.target.value));

  document.getElementById('fab-location').addEventListener('click', () => {
    navigator.geolocation.getCurrentPosition(pos => {
      userLocation = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      if(mapInstance) mapInstance.setView([pos.coords.latitude, pos.coords.longitude], 15);
    });
  });

  document.getElementById('backup-input').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try { const importedData = JSON.parse(event.target.result);
        if (Array.isArray(importedData)) { places = importedData; saveData(); renderList(); renderStats(); showToast('Biblioteca restaurada!', 'loading'); }
      } catch (err) { showToast('Ficheiro inválido.', 'error'); }
      e.target.value = '';
    }; reader.readAsText(file);
  });

  // Swipe-to-dismiss no painel de detalhe
  const detailSheet = document.getElementById('detail-content');
  let sheetStartY = 0, sheetCurrentY = 0, sheetDragging = false;
  detailSheet.addEventListener('touchstart', e => {
    // Só arranca o gesto se o toque começa na zona do handle (topo 60px) ou se o scroll interno já está no topo
    const touchY = e.touches[0].clientY;
    const rect = detailSheet.getBoundingClientRect();
    const relY = touchY - rect.top;
    if (relY < 60 || detailSheet.scrollTop === 0) {
      sheetStartY = touchY; sheetDragging = true;
      detailSheet.style.transition = 'none';
    }
  }, { passive: true });
  detailSheet.addEventListener('touchmove', e => {
    if (!sheetDragging) return;
    sheetCurrentY = e.touches[0].clientY - sheetStartY;
    if (sheetCurrentY > 0) detailSheet.style.transform = `translateY(${sheetCurrentY}px)`;
  }, { passive: true });
  detailSheet.addEventListener('touchend', () => {
    if (!sheetDragging) return;
    sheetDragging = false;
    detailSheet.style.transition = 'transform 0.3s cubic-bezier(0.1, 0.8, 0.2, 1)';
    if (sheetCurrentY > 100) {
      document.getElementById('modal-detail').classList.remove('open');
      detailSheet.style.transform = '';
    } else {
      detailSheet.style.transform = 'translateY(0)';
    }
    sheetCurrentY = 0;
  });

  // Swipe logic mantida
  let startX = 0, currentX = 0;
  const listEl = document.getElementById('places-list');
  listEl.addEventListener('touchstart', e => { const card = e.target.closest('.place-card'); if(card) { startX = e.touches[0].clientX; card.style.transition = 'none'; } }, {passive: true});
  listEl.addEventListener('touchmove', e => {
    const card = e.target.closest('.place-card');
    if(card) { currentX = e.touches[0].clientX - startX; if(currentX < 0 && currentX > -80) card.style.transform = `translateX(${currentX}px)`; }
  }, {passive: true});
  listEl.addEventListener('touchend', e => {
    const card = e.target.closest('.place-card');
    if(card) { card.style.transition = 'transform 0.2s ease'; if(currentX < -40) card.style.transform = `translateX(-60px)`; else card.style.transform = `translateX(0)`; currentX = 0; }
  });

  listEl.addEventListener('click', e => {
    const wrapper = e.target.closest('.card-wrapper'); if(!wrapper) return;
    const card = wrapper.querySelector('.place-card');
    if(e.target.closest('.delete-btn-bg')) { deletePlace(wrapper.dataset.id); return; }
    if(card.style.transform === 'translateX(-60px)') { card.style.transform = `translateX(0)`; return; }
    renderDetail(wrapper.dataset.id);
  });
}

document.addEventListener('DOMContentLoaded', init);
document.addEventListener('DOMContentLoaded', init);
