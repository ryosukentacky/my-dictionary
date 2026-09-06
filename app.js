let baseWords = [];
let words = [];
let selectedCategory = 'すべて';

const extraKey = 'mydict-extra-v1';
const favKey = 'mydict-favs-v1';
const themeKey = 'mydict-theme-v1';

const $ = s => document.querySelector(s);

const esc = s =>
  String(s ?? '').replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));

function loadFavs() {
  return new Set(JSON.parse(localStorage.getItem(favKey) || '[]'));
}

function saveFavs(set) {
  localStorage.setItem(favKey, JSON.stringify([...set]));
}

function mergeWords() {
  let extras = JSON.parse(localStorage.getItem(extraKey) || '[]');

  // GitHub の words.json に存在する語は
  // 端末内の古いコピーを削除して最新版を優先
  const baseIds = new Set(
    baseWords.map(w =>
      w.id || (w.word + '-' + (w.reading || '')).toLowerCase()
    )
  );

  extras = extras.filter(w => {
    const id = w.id || (w.word + '-' + (w.reading || '')).toLowerCase();
    return !baseIds.has(id);
  });

  localStorage.setItem(extraKey, JSON.stringify(extras));

  const map = new Map();

  [...extras, ...baseWords].forEach((w, i) => {
    const id =
      w.id || (w.word + '-' + (w.reading || '')).toLowerCase();

    map.set(id, {
      ...w,
      id,
      _order: i
    });
  });

  words = [...map.values()];
}

function renderCategories() {
  const cats = [
    'すべて',
    ...new Set(words.map(w => w.category || 'その他'))
  ];

  $('#categories').innerHTML = cats
    .map(
      c =>
        `<button class="chip ${
          c === selectedCategory ? 'active' : ''
        }" data-cat="${esc(c)}">${esc(c)}</button>`
    )
    .join('');

  document.querySelectorAll('.chip').forEach(b => {
    b.onclick = () => {
      selectedCategory = b.dataset.cat;
      renderCategories();
      renderList();
    };
  });
}

function renderList() {
  const q = $('#search').value.trim().toLowerCase();
  const favs = loadFavs();

  let arr = words.filter(w => {
    const cat =
      selectedCategory === 'すべて' ||
      (w.category || 'その他') === selectedCategory;

    const text = [
      w.word,
      w.reading,
      w.category,
      w.content
    ]
      .join(' ')
      .toLowerCase();

    const favOk =
      !$('#favOnly').checked || favs.has(w.id);

    return cat && favOk && (!q || text.includes(q));
  });

  if ($('#sortSelect').value === 'word') {
    arr.sort((a, b) =>
      (a.word || '').localeCompare(b.word || '', 'ja')
    );
  } else {
    arr.sort((a, b) => a._order - b._order);
  }

  $('#count').textContent = `${arr.length}語`;

  $('#wordList').innerHTML = arr.length
    ? arr
        .map(
          w => `
      <button class="wordCard" data-id="${esc(w.id)}">
        <div>
          <div class="wordMain">${esc(w.word)}</div>
          <div class="wordSub">
            ${esc(w.reading || '')}
            ${w.category ? '　' + esc(w.category) : ''}
          </div>
        </div>
        <div class="star">${favs.has(w.id) ? '★' : '›'}</div>
      </button>
    `
        )
        .join('')
    : `<div class="empty">該当する単語がありません</div>`;

  document.querySelectorAll('.wordCard').forEach(b => {
    b.onclick = () => openDetail(b.dataset.id);
  });
}

function openDetail(id) {
  const w = words.find(x => x.id === id);

  if (!w) return;

  $('#detailWord').textContent = w.word;
  $('#detailReading').textContent = w.reading || '';
  $('#detailCategory').textContent =
    w.category || 'その他';

  $('#detailContent').textContent =
    w.content || '';

  $('#detailFav').dataset.id = id;

  updateDetailFav();

  $('#homeView').classList.add('hidden');
  $('#detailView').classList.remove('hidden');

  window.scrollTo({
    top: 0,
    behavior: 'instant'
  });

  history.replaceState(
    null,
    '',
    '#' + encodeURIComponent(id)
  );
}

function closeDetail() {
  $('#detailView').classList.add('hidden');
  $('#homeView').classList.remove('hidden');

  history.replaceState(
    null,
    '',
    location.pathname + location.search
  );
}

function updateDetailFav() {
  const id = $('#detailFav').dataset.id;
  const favs = loadFavs();

  $('#detailFav').textContent =
    favs.has(id) ? '★' : '☆';
}

$('#detailFav').onclick = () => {
  const id = $('#detailFav').dataset.id;
  const favs = loadFavs();

  if (favs.has(id)) {
    favs.delete(id);
  } else {
    favs.add(id);
  }

  saveFavs(favs);
  updateDetailFav();
};

$('#backBtn').onclick = closeDetail;

$('#search').oninput = renderList;

$('#sortSelect').onchange = renderList;

$('#favOnly').onchange = renderList;

$('#jsonFile').onchange = async e => {
  try {
    const text = await e.target.files[0].text();

    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      throw new Error(
        'JSONは配列形式にしてください'
      );
    }

    const cleaned = data
      .filter(x => x && x.word)
      .map(x => ({
        id:
          x.id ||
          (
            x.word +
            '-' +
            (x.reading || '')
          ).toLowerCase(),

        word: String(x.word),

        reading: String(
          x.reading || ''
        ),

        category: String(
          x.category || 'その他'
        ),

        content: String(
          x.content || ''
        )
      }));

    const old = JSON.parse(
      localStorage.getItem(extraKey) || '[]'
    );

    const map = new Map(
      old.map(x => [x.id, x])
    );

    cleaned.forEach(x =>
      map.set(x.id, x)
    );

    localStorage.setItem(
      extraKey,
      JSON.stringify([...map.values()])
    );

    mergeWords();
    renderCategories();
    renderList();

    alert(
      `${cleaned.length}件を読み込みました`
    );
  } catch (err) {
    alert(
      '読み込みに失敗しました: ' +
        err.message
    );
  }

  e.target.value = '';
};

$('#exportBtn').onclick = () => {
  const data = words.map(
    ({ _order, ...w }) => w
  );

  const blob = new Blob(
    [JSON.stringify(data, null, 2)],
    { type: 'application/json' }
  );

  const a = document.createElement('a');

  a.href =
    URL.createObjectURL(blob);

  a.download =
    'my-dictionary-backup.json';

  a.click();

  URL.revokeObjectURL(a.href);
};

$('#resetBtn').onclick = () => {
  if (
    confirm(
      'この端末で追加した単語データを初期化しますか？'
    )
  ) {
    localStorage.removeItem(extraKey);

    mergeWords();

    selectedCategory = 'すべて';

    renderCategories();
    renderList();
  }
};

function applyTheme() {
  const v =
    localStorage.getItem(themeKey) ||
    'auto';

  document.documentElement.classList.toggle(
    'dark',
    v === 'dark' ||
      (
        v === 'auto' &&
        matchMedia(
          '(prefers-color-scheme:dark)'
        ).matches
      )
  );
}

$('#themeBtn').onclick = () => {
  const dark =
    document.documentElement.classList.contains(
      'dark'
    );

  localStorage.setItem(
    themeKey,
    dark ? 'light' : 'dark'
  );

  applyTheme();
};

async function init() {
  try {
    const res = await fetch(
      'words.json?v=' + Date.now(),
      {
        cache: 'no-store'
      }
    );

    baseWords = await res.json();
  } catch (e) {
    baseWords = [
      {
        id: 'load-error',
        word: '読み込みエラー',
        reading: '',
        category: 'その他',
        content:
          'words.json を読み込めませんでした。GitHub Pages上で開いてください。'
      }
    ];
  }

  mergeWords();

  applyTheme();

  renderCategories();

  renderList();

  if (location.hash) {
    const id = decodeURIComponent(
      location.hash.slice(1)
    );

    setTimeout(
      () => openDetail(id),
      50
    );
  }
}

init();
