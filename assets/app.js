(async function(){
  const data = await loadData();
  const seasonal = await loadSeasonalData();

  const params = new URLSearchParams(location.search);
  const exportMode = params.get('export') === '1';
  const exportMapName = params.get('map') || '';

  const SEASON_ORDER = [
    'Lunar New Year',
    'Easter',
    'Summer',
    'Halloween',
    'Winter'
  ];

  function seasonOrderIndex(label){
    const i = SEASON_ORDER.indexOf(label);
    return (i === -1) ? 999 : i;
  }

  function mapImageSlug(name){
    return String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function testImage(url){
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(url);
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  function openImageLightbox(url, title, images=[url], startIndex=0){
    let currentIndex = Math.max(0, startIndex);

    let lightbox = document.querySelector('.imageLightbox');

    if(!lightbox){
      lightbox = document.createElement('div');
      lightbox.className = 'imageLightbox';

      lightbox.innerHTML = `
        <div class="imageLightboxPanel">
          <button class="imageLightboxClose" type="button" aria-label="Close image">×</button>

          <button class="imageLightboxArrow imageLightboxPrev" type="button" aria-label="Previous image">
            <span class="lightboxChevron lightboxChevronPrev"></span>
          </button>

          <img class="imageLightboxImg" alt="">

          <button class="imageLightboxArrow imageLightboxNext" type="button" aria-label="Next image">
            <span class="lightboxChevron lightboxChevronNext"></span>
          </button>

          <div class="imageLightboxTitle"></div>

          <div class="imageLightboxThumbs"></div>
        </div>
      `;

      document.body.appendChild(lightbox);

      lightbox.addEventListener('click', e => {
        if(e.target === lightbox || e.target.classList.contains('imageLightboxClose')){
          lightbox.classList.remove('open');
        }
      });

      document.addEventListener('keydown', e => {
        if(!lightbox.classList.contains('open')) return;

        if(e.key === 'Escape'){
          lightbox.classList.remove('open');
        }

        if(e.key === 'ArrowLeft'){
          lightbox.querySelector('.imageLightboxPrev')?.click();
        }

        if(e.key === 'ArrowRight'){
          lightbox.querySelector('.imageLightboxNext')?.click();
        }
      });
    }

    const img = lightbox.querySelector('.imageLightboxImg');
    const titleEl = lightbox.querySelector('.imageLightboxTitle');
    const prevBtn = lightbox.querySelector('.imageLightboxPrev');
    const nextBtn = lightbox.querySelector('.imageLightboxNext');

    const thumbsEl = lightbox.querySelector('.imageLightboxThumbs');

    thumbsEl.innerHTML = '';

    images.forEach((thumbUrl, index) => {
      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'imageLightboxThumb';
      thumb.style.backgroundImage = `url("${thumbUrl}")`;
      thumb.setAttribute('aria-label', `View image ${index + 1}`);

      thumb.addEventListener('click', e => {
        e.stopPropagation();
        showImage(index);
      });

      thumbsEl.appendChild(thumb);
    });

    function showImage(index){
      currentIndex = (index + images.length) % images.length;

      img.src = images[currentIndex];
      img.alt = title || 'Map image';

      titleEl.textContent = images.length > 1
        ? `${title || 'Map image'} (${currentIndex + 1}/${images.length})`
        : title || '';

      prevBtn.style.display = images.length > 1 ? '' : 'none';
      nextBtn.style.display = images.length > 1 ? '' : 'none';

      thumbsEl.querySelectorAll('.imageLightboxThumb').forEach((thumb, i) => {
        thumb.classList.toggle('active', i === currentIndex);
      });

      thumbsEl.style.display = images.length > 1 ? 'flex' : 'none';
    }

    prevBtn.onclick = e => {
      e.stopPropagation();
      showImage(currentIndex - 1);
    };

    nextBtn.onclick = e => {
      e.stopPropagation();
      showImage(currentIndex + 1);
    };

    showImage(currentIndex);
    lightbox.classList.add('open');
  }

  async function getMapGalleryImages(m){
    const slug = mapImageSlug(m.name);
    const base = `assets/map-images/${slug}`;
    const found = [];

    for(let i = 1; i <= 7; i++){
      const img = await testImage(`${base}/${i}.webp`);
      if(img) found.push(img);
    }

    return found;
  }

  function stripLeadingEmoji(name){
    if(!name) return '';
    const s = String(name).trim();
    try{
      return s.replace(/^(\p{Extended_Pictographic})\s*/u, '');
    }catch(_){
      return s;
    }
  }

  function detectSeasonLabel(m){
    const direct =
      m.season ||
      m.seasonLabel ||
      m.event ||
      m.holiday;

    if(direct) return String(direct).trim();

    const n = String(m.name || '').trim();
    if(n.startsWith('🐰')) return 'Easter';
    if(n.startsWith('☀️')) return 'Summer';
    if(n.startsWith('🎃')) return 'Halloween';
    if(n.startsWith('❄️')) return 'Winter';
    if(n.startsWith('🧧')) return 'Lunar New Year';

    return 'Winter';
  }

  function seasonEmoji(label){
    const s = String(label || '').toLowerCase();

    if(s.includes('lunar')) return '🧧';
    if(s.includes('easter')) return '🐰';
    if(s.includes('summer')) return '☀️';
    if(s.includes('halloween')) return '🎃';
    if(s.includes('winter') || s.includes('holiday')) return '❄️';

    return '🎉';
  }


  const seasonalMaps = (seasonal.maps || []).map(m => {
    const seasonLabel = detectSeasonLabel(m);

    const image_url = m.image_url || m.imageId || m.image || '';
    const effective_date = m.effective_date || m.dateStatus || m.last_seen || 'Unknown';

    return {
      ...m,

      name: stripLeadingEmoji(m.name || ''),
      mode: (m.mode || 'Solos/Doubles'),
      isSeasonal: true,
      status: (m.status || 'out'),
      inRotation: !!m.inRotation,

      seasonLabel,
      seasonOrder: seasonOrderIndex(seasonLabel),
      seasonEmoji: seasonEmoji(seasonLabel),


      image_url,
      effective_date,

      released: m.released || 'Unknown',
      playstyle: m.playstyle || 'Not specified.',
      wiki: m.wiki || ''
    };
  });


  const maps = ([(data.maps || []), seasonalMaps].flat()).slice();

  let focusNames = null;

  const meta = data.meta || {};
  const metaLine = document.getElementById('metaLine');
  if(metaLine){
    metaLine.innerHTML = `
      Latest update:<br>
      <span class="topInfoValueLarge">${meta.latest_update}</span>
    `;
  }

  const USE_REAL_TODAY = true;


  function parseDateLoose(s){
    if(!s) return null;
    const t = String(s).trim();
    if(!t || t.toLowerCase() === 'unknown') return null;

    const dt = new Date(t);
    if(Number.isNaN(dt.getTime())) return null;

    // normalize to midnight local to avoid DST hour weirdness
    dt.setHours(0,0,0,0);
    return dt;
  }

  function getBaseDate(){
    const now = new Date();
    now.setHours(0,0,0,0);
    return now;
  }




  function formatDaysLive(m){
    const base = getBaseDate();
    const eff = parseDateLoose(m.effective_date);

    if(!eff) return '—';

    const diffMs = base.getTime() - eff.getTime();
    const diffDays = Math.floor(diffMs / 86400000);

    // Guard against negative if dates are weird
    return (diffDays >= 0) ? String(diffDays) : '0';
  }

  function shortDate(dateStr){
    if(!dateStr) return '';

    const months = {
      January: 'Jan.',
      February: 'Feb.',
      August: 'Aug.',
      September: 'Sept.',
      October: 'Oct.',
      November: 'Nov.',
      December: 'Dec.'
    };

    for(const [longName, shortName] of Object.entries(months)){
      if(dateStr.startsWith(longName)){
        return dateStr.replace(longName, shortName);
      }
    }

    return dateStr;
  }

  const playstyles = uniq(
    maps
      .map(m => (m.playstyle ?? '').toString().trim())
      .filter(p => p && p.toLowerCase() !== 'not specified.' && p.toLowerCase() !== 'not specified')
  );

  const psSel = document.getElementById('playstyle');
  for(const p of playstyles){
    const opt = document.createElement('option');
    opt.value = p;
    opt.textContent = p;
    psSel.appendChild(opt);
  }

  const els = {
    q: document.getElementById('q'),
    mode: document.getElementById('mode'),
    status: document.getElementById('status'),
    playstyle: document.getElementById('playstyle'),
    sort: document.getElementById('sort'),
    in_list: document.getElementById('in-list'),
    out_list: document.getElementById('out-list'),

    rotation_overview: document.getElementById('rotation-overview'),
    latestRotationDate: document.getElementById('latestRotationDate'),
    latestEnteringCount: document.getElementById('latestEnteringCount'),
    latestLeavingCount: document.getElementById('latestLeavingCount'),
    latestEnteringList: document.getElementById('latestEnteringList'),
    latestLeavingList: document.getElementById('latestLeavingList'),
    viewLatestRotation: document.getElementById('viewLatestRotation'),

    eventPanel: document.getElementById('eventPanel'),
    eventPanelTitle: document.getElementById('eventPanelTitle'),
    eventPanelStatus: document.getElementById('eventPanelStatus'),
    eventPanelBody: document.getElementById('eventPanelBody'),
    viewEventMaps: document.getElementById('viewEventMaps'),

    nextRotationCountdown: document.getElementById('nextRotationCountdown'),
  };

  function setSearchUrl(value){
    const url = new URL(window.location.href);
    const clean = String(value || '').trim();

    if(clean){
      url.searchParams.set('q', clean);
    }else{
      url.searchParams.delete('q');
    }

    history.replaceState(null, '', url);
  }

  function loadSearchFromUrl(){
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');

    if(q){
      els.q.value = q;
    }
  }

  function searchAliasMaps(value){
    const q = String(value || '').trim().toLowerCase();

    if(q === 'latest rotation'){
      const normalMaps = maps.filter(m => !m.isSeasonal);
      const latestDateValue = newestRotationDate(normalMaps);
      return mapsOnDate(normalMaps, latestDateValue);
    }

    if(q === 'new maps'){
      return maps.filter(m => m.is_new);
    }

    const seasonAliases = {
      'lunar maps': 'lunar',
      'easter maps': 'easter',
      'summer maps': 'summer',
      'halloween maps': 'halloween',
      'winter maps': 'winter'
    };

    if(seasonAliases[q]){
      return maps.filter(m =>
        m.isSeasonal &&
        m.status === 'in' &&
        String(m.seasonLabel || '').toLowerCase().includes(seasonAliases[q])
      );
    }

    return null;
  }

  function isSearchAlias(value){
    const q = String(value || '').trim().toLowerCase();

    return [
      'latest rotation',
      'new maps',
      'easter maps',
      'summer maps',
      'halloween maps',
      'winter maps'
    ].includes(q);
  }

  function matches(m){
    const aliasMaps = searchAliasMaps(els.q.value);

    if(exportMode && exportMapName){
      return String(m.name || '').toLowerCase() === String(exportMapName || '').toLowerCase();
    }

    const q = (focusNames || aliasMaps) ? '' : norm(els.q.value);
    const mode = els.mode.value;
    const status = els.status.value;
    const playstyle = els.playstyle ? els.playstyle.value : 'all';

    if(mode === 'Seasonal'){
      if(!m.isSeasonal) return false;
    }else if(mode === 'Solos/Doubles' || mode === '3s/4s'){
      if(m.isSeasonal){
        if(m.status !== 'in') return false;
        if(m.mode !== mode) return false;
      }else{
        if(m.mode !== mode) return false;
      }
    }else{
      if(m.isSeasonal && m.status !== 'in') return false;
    }

    if(status !== 'all' && m.status !== status) return false;

    if(playstyle !== 'all' && m.playstyle !== playstyle) return false;

    if(q){
      const blob = `${m.name} ${m.note || ''}`.toLowerCase();
      if(!blob.includes(q)) return false;
    }

    if(aliasMaps && !aliasMaps.some(x => x.name === m.name)) return false;
    if(focusNames && !focusNames.has(m.name)) return false;

    return true;
  }

  const bgIO = ('IntersectionObserver' in window)
    ? new IntersectionObserver((entries, obs) => {
        for(const e of entries){
          if(!e.isIntersecting) continue;
          const el = e.target;
          const bg = el.dataset.bg;
          if(bg){
            el.style.backgroundImage = `url("${bg}")`;
            delete el.dataset.bg;
          }
          obs.unobserve(el);
        }
      }, { rootMargin: '600px 0px' })
    : null;

  function mapShareText(m){
    const statusWord = m.status === 'in' ? 'in' : 'out';
    const days = Number(formatDaysLive(m));
    const daysText = Number.isFinite(days) && days === 0
      ? 'today'
      : `${formatDaysLive(m)} day${formatDaysLive(m) === '1' ? '' : 's'} ago`;

    const dateText = m.effective_date || 'Unknown date';

    const url = new URL(window.location.href);
    url.searchParams.set('q', m.name || '');

    return `Check out ${m.name}, rotated ${statusWord} ${daysText} on ${dateText}! ${url.toString()}`;
  }

  function mapShareCardUrl(m){
    const base = window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/');
    return `${base}assets/share-cards/${mapImageSlug(m.name)}.png`;
  }

  function shareOptionHTML(iconClass, label){
    return `<span class="shareIcon ${iconClass}"></span><span>${label}</span>`;
  }

  function mapHypixelBBCode(m){
    const url = new URL(window.location.href);
    url.searchParams.set('q', m.name || '');

    return `[IMG]${mapShareCardUrl(m)}[/IMG]

  ${m.name} on Jaay's Bed Wars Map List
  ${mapShareText(m)}

  ${url.toString()}`;
  }

  async function createMapCardFile(card, m){
    if(typeof html2canvas === 'undefined'){
      alert('Download tool failed to load. Please refresh and try again.');
      return null;
    }

    const clone = card.cloneNode(true);
    clone.open = true;
    clone.classList.add('shareExportCard');

    clone.querySelectorAll('.mapShareRow').forEach(el => el.remove());

    clone.querySelectorAll('.kv').forEach(row => {
      const label = row.querySelector('.k');
      if(label && label.textContent.trim() === 'Links'){
        row.remove();
      }
    });

    const watermark = document.createElement('div');
    watermark.className = 'shareExportWatermark';

    const generatedDate = new Date().toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    watermark.textContent =
      `Generated on ${generatedDate} with Jaay's Bed Wars Map List • https://jaaymc.com/bedwars`;

    clone.appendChild(watermark);

    const hero = clone.querySelector('.mapHero');
    const bg = `assets/map-images/${mapImageSlug(m.name)}/main.webp`;

    if(hero){
      const bgDataUrl = await new Promise(resolve => {
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          resolve(canvas.toDataURL('image/webp'));
        };

        img.onerror = () => resolve('');
        img.src = bg;
      });

      if(bgDataUrl){
        hero.style.setProperty('--export-bg', `url("${bgDataUrl}")`);
        hero.style.backgroundImage = `url("${bgDataUrl}")`;
      }
    }

    const holder = document.createElement('div');
    holder.className = 'shareExportHolder';
    holder.appendChild(clone);
    document.body.appendChild(holder);

    await new Promise(resolve => setTimeout(resolve, 120));

    const canvas = await html2canvas(clone, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      width: clone.offsetWidth,
      height: clone.offsetHeight,
      windowWidth: 520
    });

    holder.remove();

    const fileName = String(m.name || 'bed-wars-map')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/png');
    });

    if(!blob) return null;

    return new File([blob], `${fileName}-bedwars-map.png`, {
      type: 'image/png'
    });
  }

  async function downloadMapCard(card, m){
    const file = await createMapCardFile(card, m);
    if(!file) return;

    const link = document.createElement('a');
    link.download = file.name;
    link.href = URL.createObjectURL(file);
    link.click();

    setTimeout(() => {
      URL.revokeObjectURL(link.href);
    }, 1000);
  }

  function mapCard(m){
    const d = document.createElement('details');
    d.classList.add('mapcard');
    d.classList.add(m.status === 'in' ? 'is-in' : 'is-out');

    if(exportMode){
      d.classList.add('exportMode');
      d.open = true;
    }

    const summary = document.createElement('summary');
    summary.className = 'mapSummary';

    const hero = document.createElement('div');
    hero.className = 'mapHero';
    const initialImage = m.image_url || '';

    if(initialImage){
      hero.dataset.fullImage = initialImage;

      if(bgIO){
        hero.dataset.bg = initialImage;
        bgIO.observe(hero);
      }else{
        hero.style.backgroundImage = `url("${initialImage}")`;
      }
    }

    if(m.isSeasonal){
      const seasonPill = document.createElement('div');
      seasonPill.className = 'mapPill mapPill-season';
      seasonPill.textContent = `${m.seasonEmoji || '🎉'} ${m.seasonLabel || 'Seasonal'}`;
      hero.appendChild(seasonPill);
    }

    const overlay = document.createElement('div');
    overlay.className = 'mapOverlay';

    const left = document.createElement('div');
    left.className = 'mapLeft';

    const title = document.createElement('div');
    title.className = 'mapTitle';
    title.textContent = m.name || '';

    if(m.is_new){
      const inlineNew = document.createElement('span');
      inlineNew.className = 'inlineNewPill';
      inlineNew.textContent = 'NEW';
      title.appendChild(inlineNew);
    }

    left.appendChild(title);

    const chipRow = document.createElement('div');
    chipRow.className = 'mapChipRow';

    function chip(text, className){
      if(!text) return;
      const el = document.createElement('span');
      el.className = `mapChip ${className || ''}`;
      el.textContent = text;
      chipRow.appendChild(el);
    }

    chip(m.mode || '', m.mode === '3s/4s' ? 'mapChip-mode34' : 'mapChip-modeSD');
    const playstyleText = (m.playstyle || '').trim();
    if(
      playstyleText &&
      playstyleText.toLowerCase() !== 'not specified.' &&
      playstyleText.toLowerCase() !== 'not specified'
    ){
      chip(playstyleText, playstyleText === 'Quick & Rushy' ? 'mapChip-quick' : 'mapChip-long');
    }

    if(m.mode !== '3s/4s'){
      const genText = (m.gen_html || '')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      chip(genText, 'mapChip-gen');
    }

    left.appendChild(chipRow);

    const daysWrap = document.createElement('div');
    daysWrap.className = 'mapDays';

    const label = document.createElement('div');
    label.className = 'mapDaysLabel';
    label.textContent = (m.status === 'in')
      ? 'Available since'
      : 'Unavailable since';

    const sinceDate = document.createElement('div');
    sinceDate.className = 'mapDaysDate';

    if(exportMode){
      sinceDate.classList.add(
        m.status === 'in'
          ? 'mapDaysDateIn'
          : 'mapDaysDateOut'
      );
    }

    sinceDate.textContent = m.effective_date || 'Unknown';

    daysWrap.appendChild(label);
    daysWrap.appendChild(sinceDate);

    if(!exportMode){
      const days = document.createElement('div');
      days.className = 'mapDaysValue';
      days.textContent = `${formatDaysLive(m)} days`;
      daysWrap.appendChild(days);
    }

    overlay.appendChild(left);
    overlay.appendChild(daysWrap);
    hero.appendChild(overlay);

    summary.appendChild(hero);

    const body = document.createElement('div');
    body.className = 'detailsBody';

    if(!exportMode){
      getMapGalleryImages(m).then(images => {
        if(!images.length) return;

        const setHeroImage = url => {
          hero.style.backgroundImage = `url("${url}")`;
          hero.dataset.fullImage = url;
          delete hero.dataset.bg;
        };

        hero.galleryImages = images;
        hero.galleryIndex = 0;

        if(images.length <= 1) return;

        const gallery = document.createElement('div');
        gallery.className = 'mapGallery';

        images.forEach((url, index) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'mapGalleryThumb';

          btn.style.backgroundImage = `url("${url}")`;
          btn.setAttribute('aria-label', `View image ${index + 1}`);

          btn.addEventListener('click', e => {
            e.preventDefault();
            e.stopPropagation();

            hero.galleryIndex = index;
            openImageLightbox(
              url,
              m.name || 'Map image',
              images,
              index
            );
          });

          gallery.appendChild(btn);
        });

        body.insertBefore(gallery, body.firstChild);
      });
    }

    const detailsGrid = document.createElement('div');
    detailsGrid.className = 'detailsGrid';
    body.appendChild(detailsGrid);

    const mapInfoWrap = document.createElement('div');
    mapInfoWrap.className = 'detailsColumn';
    detailsGrid.appendChild(mapInfoWrap);

    const mapInfoTitle = document.createElement('div');
    mapInfoTitle.className = 'detailsSectionTitle';
    mapInfoTitle.innerHTML = `
      <span class="sectionIcon sectionIcon-map"></span>
      <span>Map Info</span>
    `;
    mapInfoWrap.appendChild(mapInfoTitle);

    function kv(k, v, isHtml=false, icon=''){
      const row = document.createElement('div');
      row.className = 'kv';

      const ii = document.createElement('div');
      ii.className = `kvIcon kvIcon-${icon}`;

      const kk = document.createElement('div');
      kk.className = 'k';
      kk.textContent = k;

      const vv = document.createElement('div');
      vv.className = 'v';

      if(isHtml) vv.innerHTML = v || '';
      else vv.textContent = v || '';

      if(k === 'Mode'){
        if(v === 'Solos/Doubles') vv.classList.add('mode-sd');
        if(v === '3s/4s') vv.classList.add('mode-34');
      }

      if(k === 'Playstyle'){
        if(v === 'Quick & Rushy') vv.classList.add('ps-quick');
        if(v === 'Long & Tactical') vv.classList.add('ps-long');
      }

      row.appendChild(ii);
      row.appendChild(kk);
      row.appendChild(vv);
      return row;
    }

    const mapInfoPanel = document.createElement('div');
    mapInfoPanel.className = 'detailsPanel';
    mapInfoWrap.appendChild(mapInfoPanel);

    mapInfoPanel.appendChild(kv('Mode', m.mode || '', false, 'mode'));
    const displayPlaystyle =
      playstyleText &&
      playstyleText.toLowerCase() !== 'not specified.' &&
      playstyleText.toLowerCase() !== 'not specified'
        ? playstyleText
        : '—';

    mapInfoPanel.appendChild(kv('Playstyle', displayPlaystyle, false, 'playstyle'));

    mapInfoPanel.appendChild(
      kv('Gen Speed', m.gen_html || '—', true, 'generator')
    );

    mapInfoPanel.appendChild(
        kv('Released', shortDate(m.released), false, 'released')
    );

    if(m.note){
        mapInfoPanel.appendChild(kv('Note', m.note, true, 'note'));
    }

    if(!exportMode){
      const links = document.createElement('div');
      links.className = 'kv';

      const k = document.createElement('div');
      k.className = 'k';
      k.textContent = 'Links';

      const v = document.createElement('div');
      v.innerHTML = (m.wiki ? `<a href="${m.wiki}" target="_blank" rel="noopener">Wiki</a>` : '')
        + (m.image_url ? ` • <a href="${m.image_url}" target="_blank" rel="noopener">Image</a>` : '');

      const icon = document.createElement('div');
      icon.className = 'kvIcon kvIcon-links';

      links.appendChild(icon);
      links.appendChild(k);
      links.appendChild(v);
      mapInfoPanel.appendChild(links);
    }

    const buildInfoWrap = document.createElement('div');
    buildInfoWrap.className = 'detailsColumn';
    detailsGrid.appendChild(buildInfoWrap);

    const buildInfoTitle = document.createElement('div');
    buildInfoTitle.className = 'detailsSectionTitle detailsSectionTitle-build';
    buildInfoTitle.innerHTML = `
      <span class="sectionIcon sectionIcon-build"></span>
      <span>Build Info</span>
    `;
    buildInfoWrap.appendChild(buildInfoTitle);

    const buildInfoPanel = document.createElement('div');
    buildInfoPanel.className = 'detailsPanel buildInfoPanel';
    buildInfoWrap.appendChild(buildInfoPanel);

    buildInfoPanel.appendChild(kv('Maximum Y', m.buildMaxY ?? '—', false, 'maxy'));
    buildInfoPanel.appendChild(kv('Minimum Y', m.buildMinY ?? '—', false, 'miny'));
    buildInfoPanel.appendChild(kv('Y Range', m.buildRange ?? '—', false, 'range'));
    buildInfoPanel.appendChild(kv('Build Radius', m.buildRadius ?? '—', false, 'radius'));

    if(exportMode){
      const exportFooter = document.createElement('div');
      exportFooter.className = 'shareExportWatermark';

      const generatedDate = new Date().toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });

      exportFooter.textContent =
        `Generated on ${generatedDate} with Jaay's Bed Wars Map List • https://jaaymc.com/bedwars`;

      body.appendChild(exportFooter);
    }

    if(!exportMode){
      const shareRow = document.createElement('div');
      shareRow.className = 'mapShareRow';

      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'mapShareBtn';
      shareBtn.innerHTML = '🔗 Share';

      const shareMenu = document.createElement('div');
      shareMenu.className = 'mapShareMenu';
      shareMenu.hidden = true;

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'mapShareOption';
      copyBtn.innerHTML = shareOptionHTML('shareIcon-link', 'Copy Link');

      const downloadBtn = document.createElement('button');
      downloadBtn.type = 'button';
      downloadBtn.className = 'mapShareOption';
      downloadBtn.innerHTML = shareOptionHTML('shareIcon-download', 'Download Card');

      const twitterBtn = document.createElement('button');
      twitterBtn.type = 'button';
      twitterBtn.className = 'mapShareOption';
      twitterBtn.innerHTML = shareOptionHTML('shareIcon-twitter', 'Share to Twitter');

      const hypixelBtn = document.createElement('button');
      hypixelBtn.type = 'button';
      hypixelBtn.className = 'mapShareOption';
      hypixelBtn.innerHTML = shareOptionHTML('shareIcon-hypixel', 'Share to Hypixel Forums');

      hypixelBtn.addEventListener('click', async e => {
        e.stopPropagation();

        shareMenu.hidden = true;

        await navigator.clipboard.writeText(mapHypixelBBCode(m));

        alert('BBCode copied. Paste it into your Hypixel profile post.');

        window.open('https://hypixel.net/whats-new/profile-posts/', '_blank', 'noopener');
      });

      copyBtn.addEventListener('click', async e => {
        e.stopPropagation();

        const url = new URL(window.location.href);
        url.searchParams.set('q', m.name || '');

        await navigator.clipboard.writeText(url.toString());

        copyBtn.textContent = '✅ Copied!';
        setTimeout(() => {
          copyBtn.innerHTML = shareOptionHTML('shareIcon-link', 'Copy Link');
        }, 1200);

        shareMenu.hidden = true;
      });

      downloadBtn.addEventListener('click', async e => {
        e.stopPropagation();

        shareMenu.hidden = true;
        downloadBtn.textContent = '⏳ Downloading...';

        await downloadMapCard(d, m);

        downloadBtn.innerHTML = shareOptionHTML('shareIcon-download', 'Download Card');
      });

      twitterBtn.addEventListener('click', e => {
        e.stopPropagation();

        shareMenu.hidden = true;

        const text = `${mapShareText(m)}\n\n${mapShareCardUrl(m)}`;
        const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;

        window.open(url, '_blank', 'noopener');
      });

      shareMenu.append(copyBtn, downloadBtn, twitterBtn, hypixelBtn);

      shareBtn.addEventListener('click', e => {
        e.stopPropagation();
        shareMenu.hidden = !shareMenu.hidden;
      });

      document.addEventListener('click', () => {
        shareMenu.hidden = true;
      });

      shareRow.append(shareMenu, shareBtn);
      body.appendChild(shareRow);
    }

    d.appendChild(summary);
    d.appendChild(body);
    return d;
  }

  const cardCache = new Map();
  function cardKey(m){
    return `${m.isSeasonal ? 'S' : 'N'}|${m.mode || ''}|${m.name || ''}`;
  }
  function getCard(m){
    const k = cardKey(m);
    let el = cardCache.get(k);
    if(el) return el;
    el = mapCard(m);
    cardCache.set(k, el);
    return el;
  }

  function escapeHTML(str){
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  function modeLabel(mode){
    if(mode === 'Solos/Doubles') return '8 teams';
    if(mode === '3s/4s') return '4 teams';
    return mode || '';
  }

  function modeClass(mode){
    if(mode === 'Solos/Doubles') return 'rotationModeSD';
    if(mode === '3s/4s') return 'rotationMode34';
    return '';
  }

  function validDateValue(m){
    const raw = m.effective_date || m.dateStatus || m.rotation_date || m.last_seen || '';
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : 0;
  }

  function newestRotationDate(maps){
    return Math.max(...maps.map(validDateValue));
  }

  function mapsOnDate(maps, dateValue){
    return maps.filter(m => validDateValue(m) === dateValue);
  }

  function groupedMiniList(maps){
    const groups = [
      ['Solos/Doubles', maps.filter(m => m.mode === 'Solos/Doubles')],
      ['3s/4s', maps.filter(m => m.mode === '3s/4s')]
    ];

    return groups
      .filter(([, items]) => items.length)
      .map(([mode, items]) => {
        const names = items
          .slice()
          .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')))
          .map(m => `<span class="rotationMapLink" data-map="${m.name}">${m.name}${m.is_new ? ' <span class="rotationNewPill">NEW</span>' : ''}</span>`)
          .join(', ');

        return `
          <div class="rotationModeLine">
            <span class="${modeClass(mode)}">[${modeLabel(mode)}]</span>
            ${names}
          </div>
        `;
      })
      .join('');
  }
  function setFiltersForMaps(maps, label){
    const names = new Set(maps.map(m => m.name));
    els.q.value = label || '';
    setSearchUrl(label || '');
    els.mode.value = 'all';
    els.status.value = 'all';
    els.playstyle.value = 'all';

    focusNames = names;
    render();

    document.querySelector('.controls')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function focusMap(name){
      focusNames = null;

      els.q.value = name;
      setSearchUrl(name);
      els.mode.value = 'all';
      els.status.value = 'all';
      els.playstyle.value = 'all';

      render();

      document.querySelector('.controls')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
      });
  }

  function renderRotationOverview(){
    const normalMaps = maps.filter(m => !m.isSeasonal);
    const latestDateValue = newestRotationDate(normalMaps);

    if(!latestDateValue || latestDateValue <= 0){
      els.rotation_overview.style.display = 'none';
      return;
    }

    const latestMaps = mapsOnDate(normalMaps, latestDateValue);
    const entering = latestMaps.filter(m => m.status === 'in');
    const leaving = latestMaps.filter(m => m.status === 'out');

    const dateText = new Date(latestDateValue).toLocaleDateString('en-US', {
      month:'long',
      day:'numeric',
      year:'numeric'
    });

    els.rotation_overview.style.display = '';
    els.latestRotationDate.textContent = dateText;
    els.latestEnteringCount.textContent = entering.length;
    els.latestLeavingCount.textContent = leaving.length;
    els.latestEnteringList.innerHTML = groupedMiniList(entering) || '<span class="muted">No entering maps detected.</span>';
    els.latestLeavingList.innerHTML = groupedMiniList(leaving) || '<span class="muted">No leaving maps detected.</span>';
    document.querySelectorAll('.rotationMapLink').forEach(btn => {
        btn.onclick = () => focusMap(btn.dataset.map);
    });

    els.viewLatestRotation.onclick = () => {
      setFiltersForMaps(latestMaps, 'Latest rotation');
    };

    const newMaps = maps.filter(m => m.is_new);
    const activeSeasonalMaps = maps.filter(m =>
      m.isSeasonal &&
      m.status === 'in'
    );

    const activeSeasonLabel = activeSeasonalMaps.length
      ? activeSeasonalMaps[0].seasonLabel || 'Seasonal Event'
      : '';

    const activeSeasonEmoji = activeSeasonalMaps.length
      ? activeSeasonalMaps[0].seasonEmoji || '🎉'
      : '';

    const sideMaps = activeSeasonalMaps.length ? activeSeasonalMaps : newMaps;
    const showingSeasonal = activeSeasonalMaps.length > 0;

    if(sideMaps.length){
      els.eventPanel.classList.remove(
        'eventPanel-new',
        'eventPanel-easter',
        'eventPanel-summer',
        'eventPanel-halloween',
        'eventPanel-winter',
        'eventPanel-lunar'
      );

      const seasonKey = String(activeSeasonLabel || '').toLowerCase();

      if(showingSeasonal){
        if(seasonKey.includes('easter')){
          els.eventPanel.classList.add('eventPanel-easter');
        }else if(seasonKey.includes('summer')){
          els.eventPanel.classList.add('eventPanel-summer');
        }else if(seasonKey.includes('halloween')){
          els.eventPanel.classList.add('eventPanel-halloween');
        }else if(seasonKey.includes('winter')){
          els.eventPanel.classList.add('eventPanel-winter');
        }else if(seasonKey.includes('lunar')){
          els.eventPanel.classList.add('eventPanel-lunar');
        }
      }else{
        els.eventPanel.classList.add('eventPanel-new');
      }

      els.eventPanel.style.display = '';
      els.eventPanelTitle.textContent = showingSeasonal
        ? `${activeSeasonEmoji} ${activeSeasonLabel} Event`
        : '🆕 New Maps';
      els.eventPanelStatus.textContent = showingSeasonal
        ? 'Active'
        : `${sideMaps.length} map${sideMaps.length === 1 ? '' : 's'}`;
      els.eventPanelBody.innerHTML = showingSeasonal
        ? `
          <div class="eventCountBlock">
            <strong>${sideMaps.length}</strong>
            <span>${activeSeasonLabel} Maps</span>
          </div>
          ${groupedMiniList(sideMaps)}
        `
        : groupedMiniList(sideMaps);
      document.querySelectorAll('.rotationMapLink').forEach(btn => {
          btn.onclick = () => focusMap(btn.dataset.map);
      });
      els.viewEventMaps.textContent = showingSeasonal
        ? `View ${activeSeasonLabel.toLowerCase()} maps →`
        : 'View new maps →';
      els.viewEventMaps.onclick = () => {
        setFiltersForMaps(
          sideMaps,
          showingSeasonal ? `${activeSeasonLabel} maps` : 'New maps'
        );
      };
    }else{
      els.eventPanel.style.display = 'none';
    }
  }

  function updateNextRotationCountdown(){
    if(!els.nextRotationCountdown) return;

    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const latestRotation = parseDateLoose(meta.latest_rotation || meta.latest_update);
    const siteUpdatedToday = latestRotation && latestRotation.getTime() === today.getTime();

    const day = today.getDay();

    if(day === 1 && !siteUpdatedToday){
      els.nextRotationCountdown.textContent = 'Today';
      return;
    }

    if(day === 0){
      els.nextRotationCountdown.textContent = 'Tomorrow';
      return;
    }

    let daysUntilMonday = (8 - day) % 7;
    if(daysUntilMonday === 0) daysUntilMonday = 7;

    els.nextRotationCountdown.textContent =
      `${daysUntilMonday} day${daysUntilMonday === 1 ? '' : 's'}`;
  }

  function render(){
    els.in_list.textContent = '';
    els.out_list.textContent = '';
    renderRotationOverview();

    const seasonalActive = maps.some(m => m.isSeasonal && m.status === 'in');

    function daysVal(m){
      const raw = formatDaysLive(m);

      if(raw === '—' || raw == null) return Number.POSITIVE_INFINITY;

      const cleaned = String(raw).replace(/[^\d-]/g,'');
      if(!cleaned) return Number.POSITIVE_INFINITY;

      const n = Number(cleaned);
      return Number.isFinite(n) ? n : Number.POSITIVE_INFINITY;
    }

    function seasonalFirstOrLast(a,b){
      if(!!a.isSeasonal !== !!b.isSeasonal){
        if(seasonalActive){
          return a.isSeasonal ? -1 : 1;
        }
        return a.isSeasonal ? 1 : -1;
      }
      return 0;
    }

    function seasonalInternalSort(a,b, sortKey){
      const sa = (typeof a.seasonOrder === 'number') ? a.seasonOrder : 999;
      const sb = (typeof b.seasonOrder === 'number') ? b.seasonOrder : 999;
      if(sa !== sb) return sa - sb;

      return (sortKey === 'name_desc') ? -byName(a,b) : byName(a,b);
    }

    function compare(a,b){
      const sortKey = els.sort ? els.sort.value : 'name_asc';
      const isDaysSort = (sortKey === 'days_desc' || sortKey === 'days_asc');

      if(sortKey === 'name_asc'){
        if(!!a.is_new !== !!b.is_new) return a.is_new ? -1 : 1;
      }

      if(!isDaysSort){
        const block = seasonalFirstOrLast(a,b);
        if(block !== 0) return block;

        if(a.isSeasonal && b.isSeasonal){
          return seasonalInternalSort(a,b, sortKey);
        }

        return (sortKey === 'name_desc') ? -byName(a,b) : byName(a,b);
      }

      const da = daysVal(a);
      const db = daysVal(b);

      if(sortKey === 'days_desc'){
        if(da === db) return byName(a,b);
        return (db - da);
      }

      if(da === db) return byName(a,b);
      return (da - db);
    }

    const filtered = maps.filter(matches);

    const inMaps  = filtered.filter(m => m.status === 'in').slice().sort(compare);
    const outMaps = filtered.filter(m => m.status === 'out').slice().sort(compare);

    const fragIn = document.createDocumentFragment();
    const fragOut = document.createDocumentFragment();

    for(const m of inMaps)  fragIn.appendChild(getCard(m));
    for(const m of outMaps) fragOut.appendChild(getCard(m));

    els.in_list.appendChild(fragIn);
    els.out_list.appendChild(fragOut);

  }

  let rafPending = false;
  function scheduleRender(){
    if(rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      render();
    });
  }

  let qTimer = 0;
  function scheduleRenderDebounced(){
    clearTimeout(qTimer);
    qTimer = setTimeout(scheduleRender, 90);
  }

  els.q.addEventListener('input', () => {
    focusNames = null;
    setSearchUrl(els.q.value);
    scheduleRenderDebounced();
  });

  els.q.addEventListener('keydown', e => {
    if(e.key !== 'Backspace') return;

    if(
      els.q.selectionStart !== els.q.selectionEnd ||
      els.q.selectionStart !== els.q.value.length
    ){
      return;
    }

    if(!isSearchAlias(els.q.value)) return;

    e.preventDefault();

    els.q.value = '';
    focusNames = null;
    setSearchUrl('');
    scheduleRender();
  });

  for(const el of [els.mode, els.status, els.playstyle, els.sort]){
    el.addEventListener('change', () => {
      focusNames = null;
      scheduleRender();
    });
  }

  function seasonalSortKey(m, seasonalActive){
    if(seasonalActive){
      return m.isSeasonal ? 0 : 1;
    }
    return m.isSeasonal ? 1 : 0;
  }

  loadSearchFromUrl();
  updateNextRotationCountdown();
  setInterval(updateNextRotationCountdown, 60000);
  render();


})().catch(err=>{
  console.error(err);
  alert(err.message || String(err));
});

document.addEventListener('toggle', (e) => {
  const opened = e.target;
  if(!(opened instanceof HTMLDetailsElement)) return;
  if(!opened.classList.contains('mapcard')) return;
  if(opened.classList.contains('shareExportCard')) return;
  if(!opened.open) return;

  document.querySelectorAll('details.mapcard[open]').forEach(d => {
    if(d !== opened) d.open = false;
  });
}, true);

