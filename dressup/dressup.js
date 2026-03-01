(() => {
  'use strict';

  // v2：對應 dressup/index.html + dressup/dressup.css 的結構（不再動態造整頁 UI）。
  const STORAGE_KEY = 'dressup.state.v2';

  const $ = (id) => document.getElementById(id);

  function setError(ui, message) {
    ui.error.textContent = message || '';
  }

  function safeParseJson(text) {
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  async function fetchManifest() {
    const res = await fetch('./manifest.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`manifest.json HTTP ${res.status}`);
    return res.json();
  }

  function normalizeManifest(manifest) {
    if (!manifest || typeof manifest !== 'object') throw new Error('manifest 不是物件');
    if (!manifest.models || !manifest.models.base) throw new Error('manifest.models.base 缺失');
    if (!Array.isArray(manifest.categories)) throw new Error('manifest.categories 必須是 array');
    if (!Array.isArray(manifest.layers)) throw new Error('manifest.layers 必須是 array');
    if (!Array.isArray(manifest.items)) throw new Error('manifest.items 必須是 array');

    const categories = manifest.categories;
    const layers = manifest.layers;
    const slots = Array.isArray(manifest.accessorySlots) ? manifest.accessorySlots : [];

    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const layerById = new Map(layers.map((l) => [l.id, l]));
    const slotById = new Map(slots.map((s) => [s.id, s]));
    const itemById = new Map(manifest.items.map((it) => [it.id, it]));

    return {
      raw: manifest,
      categories,
      layers,
      slots,
      categoryById,
      layerById,
      slotById,
      itemById
    };
  }

  function defaultState(manifest) {
    const selectedByCategory = {};
    for (const cat of manifest.categories) {
      if (cat.type !== 'accessory') selectedByCategory[cat.id] = null;
    }

    const accessoriesBySlot = {};
    for (const s of manifest.slots) accessoriesBySlot[s.id] = null;

    return {
      view: 'front',
      activeCategoryId: manifest.categories[0]?.id || 'accessories',
      activeAccessorySlotId: 'all',
      selectedByCategory,
      accessoriesBySlot
    };
  }

  function loadState(fallback, manifest) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = safeParseJson(raw);
    if (!parsed || typeof parsed !== 'object') return fallback;

    const state = {
      ...fallback,
      ...parsed
    };

    // view
    if (state.view !== 'front' && state.view !== 'back') state.view = fallback.view;

    // active category
    if (!manifest.categoryById.has(state.activeCategoryId)) state.activeCategoryId = fallback.activeCategoryId;

    // selectedByCategory
    const selectedByCategory = { ...fallback.selectedByCategory };
    if (parsed.selectedByCategory && typeof parsed.selectedByCategory === 'object') {
      for (const [catId, itemId] of Object.entries(parsed.selectedByCategory)) {
        if (!(catId in selectedByCategory)) continue;
        selectedByCategory[catId] = manifest.itemById.has(itemId) ? itemId : null;
      }
    }

    // accessoriesBySlot
    const accessoriesBySlot = { ...fallback.accessoriesBySlot };
    if (parsed.accessoriesBySlot && typeof parsed.accessoriesBySlot === 'object') {
      for (const [slotId, itemId] of Object.entries(parsed.accessoriesBySlot)) {
        if (!(slotId in accessoriesBySlot)) continue;
        accessoriesBySlot[slotId] = manifest.itemById.has(itemId) ? itemId : null;
      }
    }

    state.selectedByCategory = selectedByCategory;
    state.accessoriesBySlot = accessoriesBySlot;

    // active accessory slot
    if (typeof parsed.activeAccessorySlotId !== 'string') {
      state.activeAccessorySlotId = fallback.activeAccessorySlotId;
    } else if (parsed.activeAccessorySlotId !== 'all' && !manifest.slotById.has(parsed.activeAccessorySlotId)) {
      state.activeAccessorySlotId = 'all';
    }

    return state;
  }

  function saveState(state) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resolveOverlaySrc(item, view) {
    return item?.images?.[view] || null;
  }

  function resolveTransform(item, view) {
    const t = item?.transform?.[view] || item?.transform?.default || null;
    if (!t || typeof t !== 'object') return null;

    const x = Number.isFinite(Number(t.x)) ? Number(t.x) : 0;
    const y = Number.isFinite(Number(t.y)) ? Number(t.y) : 0;
    const scale = Number.isFinite(Number(t.scale)) ? Number(t.scale) : 1;
    const rotate = Number.isFinite(Number(t.rotate)) ? Number(t.rotate) : 0;
    const origin = typeof t.origin === 'string' ? t.origin : 'center center';

    return { x, y, scale, rotate, origin };
  }

  function buildCssTransform(t) {
    if (!t) return '';
    const parts = [];
    if (t.x || t.y) parts.push(`translate(${t.x}%, ${t.y}%)`);
    if (t.scale !== 1) parts.push(`scale(${t.scale})`);
    if (t.rotate) parts.push(`rotate(${t.rotate}deg)`);
    return parts.join(' ');
  }

  function resolveThumbSrc(item, view) {
    return item?.thumb || item?.images?.[view] || item?.images?.front || null;
  }

  function computeOverlayZ(manifest, item) {
    const layerId = item.layer || item.category;
    const layer = layerId ? manifest.layerById.get(layerId) : null;
    const baseZ = layer && typeof layer.baseZ === 'number' ? layer.baseZ : 0;
    const z = typeof item.zIndex === 'number' ? item.zIndex : 0;
    return baseZ + z;
  }

  function getEquippedItemIds(state) {
    const ids = [];
    for (const id of Object.values(state.selectedByCategory)) {
      if (id) ids.push(id);
    }
    for (const id of Object.values(state.accessoriesBySlot)) {
      if (id) ids.push(id);
    }
    return ids;
  }

  function renderViewButtons(ui, state) {
    const isFront = state.view === 'front';
    ui.btnFront.setAttribute('aria-pressed', isFront ? 'true' : 'false');
    ui.btnBack.setAttribute('aria-pressed', isFront ? 'false' : 'true');

    ui.btnFront.classList.toggle('dressup-btn-primary', isFront);
    ui.btnBack.classList.toggle('dressup-btn-primary', !isFront);
  }

  function renderStage(ui, manifest, state) {
    ui.stage.innerHTML = '';

    // base model
    const base = manifest.raw.models.base;
    const baseSrc = base[state.view] || base.front || null;
    if (baseSrc) {
      const img = document.createElement('img');
      img.className = 'dressup-layer';
      img.alt = base.name || '模特兒';
      img.decoding = 'async';
      img.src = baseSrc;
      img.style.zIndex = '0';
      img.addEventListener('error', () => {
        img.remove();
        setError(ui, '模特兒圖片載入失敗：請確認 manifest.json 內的路徑正確，且對應檔案存在（assets/model/base_front.* / base_back.*）。');
      });
      ui.stage.appendChild(img);
    }

    const equipped = getEquippedItemIds(state)
      .map((id) => manifest.itemById.get(id))
      .filter(Boolean)
      .map((item) => ({ item, z: computeOverlayZ(manifest, item) }))
      .sort((a, b) => (a.z - b.z) || String(a.item.id).localeCompare(String(b.item.id)));

    for (const { item, z } of equipped) {
      const src = resolveOverlaySrc(item, state.view);
      if (!src) continue; // 該視角沒有圖就不顯示

      const img = document.createElement('img');
      img.className = 'dressup-layer';
      img.alt = item.name || item.id;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.src = src;
      img.style.zIndex = String(10 + z);

      const t = resolveTransform(item, state.view);
      const cssTransform = buildCssTransform(t);
      if (cssTransform) {
        img.style.transform = cssTransform;
        img.style.transformOrigin = t.origin;
      }

      img.addEventListener('error', () => {
        img.style.display = 'none';
        setError(ui, `圖片載入失敗：${item.name || item.id}`);
      });
      ui.stage.appendChild(img);
    }
  }

  function renderCategoryTabs(ui, manifest, state) {
    ui.tabs.innerHTML = '';

    for (const cat of manifest.categories) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dressup-tab${state.activeCategoryId === cat.id ? ' is-selected' : ''}`;
      btn.textContent = cat.label || cat.id;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', state.activeCategoryId === cat.id ? 'true' : 'false');
      btn.dataset.categoryId = cat.id;
      ui.tabs.appendChild(btn);
    }
  }

  function renderAccessorySlotTabs(ui, manifest, state) {
    const cat = manifest.categoryById.get(state.activeCategoryId);
    const show = cat && cat.type === 'accessory';

    ui.slotSection.classList.toggle('dressup-hidden', !show);
    if (!show) return;

    ui.slotTabs.innerHTML = '';

    const addBtn = (id, label) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dressup-tab${state.activeAccessorySlotId === id ? ' is-selected' : ''}`;
      btn.textContent = label;
      btn.setAttribute('role', 'tab');
      btn.setAttribute('aria-selected', state.activeAccessorySlotId === id ? 'true' : 'false');
      btn.dataset.slotId = id;
      ui.slotTabs.appendChild(btn);
    };

    addBtn('all', '全部');
    for (const s of manifest.slots) addBtn(s.id, s.label || s.id);
  }

  function isSelected(state, item) {
    if (item.slot) return state.accessoriesBySlot[item.slot] === item.id;
    return state.selectedByCategory[item.category] === item.id;
  }

  function getVisibleItems(manifest, state) {
    const cat = manifest.categoryById.get(state.activeCategoryId);
    if (!cat) return [];

    if (cat.type === 'accessory') {
      return manifest.raw.items.filter((it) => {
        if (it.category !== cat.id) return false;
        if (!it.slot) return false;
        if (state.activeAccessorySlotId === 'all') return true;
        return it.slot === state.activeAccessorySlotId;
      });
    }

    return manifest.raw.items.filter((it) => it.category === cat.id);
  }

  function renderGrid(ui, manifest, state) {
    ui.grid.innerHTML = '';

    const cat = manifest.categoryById.get(state.activeCategoryId);
    ui.gridTitle.textContent = cat?.label || '物品';

    if (cat?.type === 'accessory') {
      ui.gridHint.textContent = '飾品可以多選；同一個 slot（例如頭飾）只能戴一個。';
    } else {
      ui.gridHint.textContent = '同一分類互斥（上身/下身/襪子/鞋子）。';
    }

    const items = getVisibleItems(manifest, state);

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'dressup-subtitle';
      empty.textContent = '這個分類目前沒有物品。';
      ui.grid.appendChild(empty);
      return;
    }

    for (const item of items) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `dressup-item${isSelected(state, item) ? ' is-selected' : ''}`;
      btn.dataset.itemId = item.id;

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'dressup-item-thumb';

      const img = document.createElement('img');
      img.alt = item.name || item.id;
      img.loading = 'lazy';
      img.decoding = 'async';
      const thumbSrc = resolveThumbSrc(item, state.view);
      if (thumbSrc) img.src = thumbSrc;
      img.addEventListener('error', () => {
        img.removeAttribute('src');
      });

      thumbWrap.appendChild(img);

      const label = document.createElement('div');
      label.className = 'dressup-item-label';
      label.textContent = item.name || item.id;

      btn.appendChild(thumbWrap);
      btn.appendChild(label);

      ui.grid.appendChild(btn);
    }
  }

  function toggleItem(manifest, state, itemId) {
    const item = manifest.itemById.get(itemId);
    if (!item) return;

    if (item.slot) {
      const slotId = item.slot;
      const current = state.accessoriesBySlot[slotId] || null;
      state.accessoriesBySlot[slotId] = current === itemId ? null : itemId;
      return;
    }

    const catId = item.category;
    if (!catId || !(catId in state.selectedByCategory)) return;

    const current = state.selectedByCategory[catId] || null;
    state.selectedByCategory[catId] = current === itemId ? null : itemId;
  }

  function resetState(manifest) {
    const state = defaultState(manifest);
    return state;
  }

  async function main() {
    const ui = {
      stage: $('dressup-stage'),
      btnFront: $('dressup-view-front'),
      btnBack: $('dressup-view-back'),
      btnReset: $('dressup-reset'),
      error: $('dressup-error'),
      tabs: $('dressup-tabs'),
      slotSection: $('dressup-slot-section'),
      slotTabs: $('dressup-slot-tabs'),
      gridTitle: $('dressup-grid-title'),
      gridHint: $('dressup-grid-hint'),
      grid: $('dressup-grid')
    };

    // 基本結構檢查
    for (const [k, v] of Object.entries(ui)) {
      if (!v) throw new Error(`缺少必要的 DOM 節點：${k}`);
    }

    let manifest;
    try {
      manifest = normalizeManifest(await fetchManifest());
    } catch (err) {
      setError(ui, `manifest.json 載入失敗：${err?.message || String(err)}`);
      return;
    }

    let state = loadState(defaultState(manifest), manifest);

    function renderAll() {
      setError(ui, '');
      renderViewButtons(ui, state);
      renderCategoryTabs(ui, manifest, state);
      renderAccessorySlotTabs(ui, manifest, state);
      renderGrid(ui, manifest, state);
      renderStage(ui, manifest, state);
      saveState(state);
    }

    ui.btnFront.addEventListener('click', () => {
      state.view = 'front';
      renderAll();
    });

    ui.btnBack.addEventListener('click', () => {
      state.view = 'back';
      renderAll();
    });

    ui.btnReset.addEventListener('click', () => {
      state = resetState(manifest);
      renderAll();
    });

    ui.tabs.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-category-id]');
      const id = btn?.dataset?.categoryId;
      if (!id || !manifest.categoryById.has(id)) return;
      state.activeCategoryId = id;
      // 切換到飾品時，不清掉 slot filter，但如果該 slot 不存在就回 all。
      if (state.activeAccessorySlotId !== 'all' && !manifest.slotById.has(state.activeAccessorySlotId)) {
        state.activeAccessorySlotId = 'all';
      }
      renderAll();
    });

    ui.slotTabs.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-slot-id]');
      const id = btn?.dataset?.slotId;
      if (!id) return;
      if (id !== 'all' && !manifest.slotById.has(id)) return;
      state.activeAccessorySlotId = id;
      renderAll();
    });

    ui.grid.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('[data-item-id]');
      const id = btn?.dataset?.itemId;
      if (!id) return;
      toggleItem(manifest, state, id);
      renderAll();
    });

    renderAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      main().catch((err) => {
        const el = $('dressup-error');
        if (el) el.textContent = err?.message || String(err);
      });
    });
  } else {
    main().catch((err) => {
      const el = $('dressup-error');
      if (el) el.textContent = err?.message || String(err);
    });
  }
})();
