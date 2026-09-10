/* Progressive enhancement: navigation and recipe content remain usable offline. */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  var menuButton = document.querySelector('.menu-toggle');
  var navigation = document.getElementById('main-nav');
  if (menuButton && navigation) {
    function setMenu(open) {
      navigation.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      menuButton.textContent = open ? '收起导航' : '展开导航';
    }
    menuButton.addEventListener('click', function () {
      setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menuButton.getAttribute('aria-expanded') === 'true') {
        setMenu(false);
        menuButton.focus();
      }
    });
    navigation.addEventListener('click', function (event) {
      if (event.target.closest('a')) setMenu(false);
    });
  }

  var printButton = document.querySelector('.print-button');
  if (printButton) printButton.addEventListener('click', function () { window.print(); });

  var list = document.getElementById('dish-list');
  if (!list) return;
  var form = document.querySelector('.site-search');
  var input = document.getElementById('search-input');
  var cards = Array.prototype.slice.call(list.querySelectorAll('[data-search]'));
  var count = document.getElementById('result-count');
  var state = document.getElementById('search-state');
  var description = document.getElementById('search-description');
  var empty = document.getElementById('empty-state');
  var clear = document.getElementById('clear-search');
  var initialQuery = new URLSearchParams(window.location.search).get('q') || '';

  function normalize(text) { return text.toLowerCase().replace(/\s+/g, ''); }
  function filter() {
    var original = input.value.trim();
    var query = normalize(original);
    var visible = 0;
    cards.forEach(function (card) {
      var match = !query || normalize(card.getAttribute('data-search')).indexOf(query) !== -1;
      card.hidden = !match;
      if (match) visible += 1;
    });
    count.textContent = query ? '找到 ' + visible + ' 道菜肴' : '共 ' + cards.length + ' 道代表菜肴';
    state.hidden = !query;
    description.textContent = '正在搜索：“' + original + '”';
    empty.hidden = visible !== 0;
  }

  input.value = initialQuery.slice(0, 80);
  filter();
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    filter();
    document.getElementById('dishes').scrollIntoView({ block: 'start' });
  });
  input.addEventListener('input', filter);
  clear.addEventListener('click', function () {
    input.value = '';
    filter();
    /* Also remove the query when the site is opened directly from disk. */
    try {
      var clean = new URL(window.location.href);
      clean.searchParams.delete('q');
      var cleanPath = clean.pathname + clean.search + clean.hash;
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, '', cleanPath);
      } else if (window.location.search) {
        window.location.href = clean.href;
      }
    } catch (error) {
      /* Some file:// browsers restrict history changes; the visible list is still cleared. */
    }
    input.focus();
  });
})();
